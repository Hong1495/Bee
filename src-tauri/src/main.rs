#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod local;
mod lyrics;
mod music;
mod storage;
mod restart;
mod playlists;
#[cfg(target_os = "macos")]
mod menu_appearance;

#[derive(Debug, PartialEq)]
enum ReopenAction {
    RestoreFromDock,
    ShowClosedWindow,
    None,
}

fn reopen_action(miniaturized: bool, visible: bool) -> ReopenAction {
    if miniaturized {
        ReopenAction::RestoreFromDock
    } else if !visible {
        ReopenAction::ShowClosedWindow
    } else {
        ReopenAction::None
    }
}

#[tauri::command]
fn titlebar_double_click(window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let handle = window.clone();
        window
            .run_on_main_thread(move || {
                use objc2_foundation::{NSString, NSUserDefaults};
                if let Ok(ptr) = handle.ns_window() {
                    let native = unsafe { &*(ptr as *const objc2_app_kit::NSWindow) };
                    let defaults = NSUserDefaults::standardUserDefaults();
                    let action = defaults
                        .stringForKey(&NSString::from_str("AppleActionOnDoubleClick"))
                        .map(|s| s.to_string());
                    match action.as_deref() {
                        Some("Minimize") => native.performMiniaturize(None),
                        Some("None") => {}
                        _ => native.performZoom(None),
                    }
                }
            })
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

// This backing surface is resized by AppKit in the same transaction as the
// window. A transparent WKWebView can otherwise expose glass at the trailing
// edge while WebKit catches up with live resize.
#[cfg(target_os = "macos")]
fn update_content_backing(native: &objc2_app_kit::NSWindow, dark: bool, sidebar_width: f64) {
    use objc2::{MainThreadMarker, MainThreadOnly, Message};
    use objc2_app_kit::{
        NSAutoresizingMaskOptions, NSBox, NSBoxType, NSColor, NSView, NSWindowOrderingMode,
    };
    let Some(content) = native.contentView() else {
        return;
    };
    let existing = content
        .subviews()
        .iter()
        .find_map(|view| view.downcast_ref::<NSBox>().map(|view| view.retain()));
    let backing = existing.unwrap_or_else(|| {
        let mtm = MainThreadMarker::new().expect("window updates run on main thread");
        let backing = NSBox::initWithFrame(NSBox::alloc(mtm), content.bounds());
        backing.setBoxType(NSBoxType::Custom);
        backing.setBorderWidth(0.0);
        backing.setCornerRadius(0.0);
        backing.setTransparent(false);
        backing.setAutoresizingMask(
            NSAutoresizingMaskOptions::ViewWidthSizable
                | NSAutoresizingMaskOptions::ViewHeightSizable,
        );
        // The WebView is the topmost child; keep the backing above glass and
        // below WebKit so navigation and all interactive content stay intact.
        let top = content.subviews().lastObject();
        content.addSubview_positioned_relativeTo(
            &backing,
            NSWindowOrderingMode::Below,
            top.as_deref().map(|v| v as &NSView),
        );
        backing
    });
    let mut frame = content.bounds();
    let sidebar_width = if sidebar_width.is_finite() {
        sidebar_width.clamp(0.0, 320.0)
    } else {
        220.0
    };
    frame.origin.x += sidebar_width;
    frame.size.width = (frame.size.width - sidebar_width).max(0.0);
    backing.setFrame(frame);
    let (r, g, b) = if dark {
        (41.0, 42.0, 46.0)
    } else {
        (247.0, 247.0, 249.0)
    };
    backing.setFillColor(&NSColor::colorWithSRGBRed_green_blue_alpha(
        r / 255.0,
        g / 255.0,
        b / 255.0,
        1.0,
    ));
}

#[tauri::command]
fn set_content_backing(
    window: tauri::WebviewWindow,
    dark: bool,
    sidebar_width: f64,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let handle = window.clone();
        window
            .run_on_main_thread(move || {
                if let Ok(ptr) = handle.ns_window() {
                    update_content_backing(
                        unsafe { &*(ptr as *const objc2_app_kit::NSWindow) },
                        dark,
                        sidebar_width,
                    );
                }
            })
            .map_err(|err| err.to_string())?;
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .manage(restart::RestartTarget::capture())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(music::MusicBridge::default())
        .manage(local::LocalMedia::default())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            menu_appearance::install();
            #[cfg(target_os = "macos")]
            {
                use objc2::{MainThreadMarker, MainThreadOnly};
                use objc2_app_kit::{NSToolbar, NSWindow, NSWindowToolbarStyle};
                use objc2_foundation::NSString;
                use tauri::Manager;
                use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
                let menu = Menu::default(app.handle())?;
                if let Some(tauri::menu::MenuItemKind::Submenu(bee)) = menu.items()?.first() {
                    bee.insert_items(&[
                        &MenuItem::with_id(app, "bee-settings", "设置…", true, Some("CmdOrCtrl+,"))?,
                        &MenuItem::with_id(app, "bee-check-updates", "检查更新…", true, None::<&str>)?,
                        &PredefinedMenuItem::separator(app)?,
                    ], 2)?;
                }
                app.set_menu(menu)?;
                if let Some(window) = app.get_webview_window("main") {
                    let ptr = window.ns_window()?;
                    // AppKit owns titlebar geometry throughout live resize and
                    // fullscreen transitions. Never reposition its buttons from JS.
                    let native = unsafe { &*(ptr as *const NSWindow) };
                    let mtm = MainThreadMarker::new().expect("setup runs on main thread");
                    let toolbar = NSToolbar::initWithIdentifier(
                        NSToolbar::alloc(mtm),
                        &NSString::from_str("BeeWindowToolbar"),
                    );
                    native.setToolbarStyle(NSWindowToolbarStyle::Unified);
                    native.setToolbar(Some(&toolbar));
                    native.setTitlebarAppearsTransparent(true);
                    // Let AppKit restore the user's window geometry and choose
                    // the animation appropriate to the current system settings.
                    native.setFrameAutosaveName(&NSString::from_str("BeeMainWindow"));
                    native.setAnimationBehavior(objc2_app_kit::NSWindowAnimationBehavior::Default);
                    update_content_backing(native, false, 220.0);
                }
            }
            Ok(())
        })
        .on_menu_event(|app, event| {
            use tauri::{Emitter, Manager};
            let action = event.id().as_ref();
            if !matches!(action, "bee-settings" | "bee-check-updates") { return; }
            if let Some(window) = app.get_webview_window("main") {
                // Restore through AppKit so the user's Dock animation is kept.
                #[cfg(target_os = "macos")]
                if let Ok(ptr) = window.ns_window() {
                    let native = unsafe { &*(ptr as *const objc2_app_kit::NSWindow) };
                    if native.isMiniaturized() { native.deminiaturize(None); }
                    else { native.makeKeyAndOrderFront(None); }
                }
                let _ = window.emit("bee-menu-action", action);
            }
        })
        .invoke_handler(tauri::generate_handler![
            set_content_backing,
            titlebar_double_click,
            update_indicator_position,
            restart::restart_after_update,
            music::music_request,
            music::music_seek,
            local::local_request,
            storage::storage_request,
            playlists::playlist_request,
            lyrics::lyrics_request
        ])
        .on_window_event(|window, event| {
            #[cfg(target_os = "macos")]
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Closing the sole window does not quit a macOS music app.
                // Keep the webview/connection alive for a subsequent Dock reopen.
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("Unable to start Bee")
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    if let Ok(ptr) = window.ns_window() {
                        let native = unsafe { &*(ptr as *const objc2_app_kit::NSWindow) };
                        match reopen_action(native.isMiniaturized(), native.isVisible()) {
                            ReopenAction::RestoreFromDock => {
                                // AppKit owns deminiaturization, including Dock
                                // animation and activation. Do not immediately
                                // order the window front during that transition.
                                native.deminiaturize(None);
                            }
                            ReopenAction::ShowClosedWindow => {
                                // A red-button close was orderOut, not minimize.
                                native.makeKeyAndOrderFront(None);
                            }
                            // A visible window (including a restore in progress)
                            // is already managed by normal application activation.
                            ReopenAction::None => {}
                        }
                    }
                }
            }
        });
}

// Read AppKit's actual traffic-light geometry; never move its native buttons.
#[tauri::command]
async fn update_indicator_position(window:tauri::WebviewWindow)->Result<serde_json::Value,String>{
    let (tx,rx)=std::sync::mpsc::channel();
    let handle=window.clone();
    window.run_on_main_thread(move||{
        let result=(||{
            use objc2_app_kit::{NSWindow,NSWindowButton,NSWindowStyleMask};
            let ptr=handle.ns_window().map_err(|e|e.to_string())?;
            let native=unsafe{&*(ptr as *const NSWindow)};
            if native.styleMask().contains(NSWindowStyleMask::FullScreen){return Ok(serde_json::Value::Null);}
            let content=native.contentView().ok_or("Missing content view")?;
            let green=native.standardWindowButton(NSWindowButton::ZoomButton).ok_or("Missing zoom button")?;
            let yellow=native.standardWindowButton(NSWindowButton::MiniaturizeButton).ok_or("Missing minimize button")?;
            let g=green.convertRect_toView(green.bounds(),None);
            let y=yellow.convertRect_toView(yellow.bounds(),None);
            let c=content.convertRect_toView(content.bounds(),None);
            Ok::<_,String>(serde_json::json!({"left":g.origin.x+(g.origin.x-y.origin.x)-c.origin.x,"top":c.origin.y+c.size.height-g.origin.y-g.size.height,"size":g.size.width}))
        })();
        let _=tx.send(result);
    }).map_err(|e|e.to_string())?;
    tauri::async_runtime::spawn_blocking(move||rx.recv().map_err(|e|e.to_string())?).await.map_err(|e|e.to_string())?
}

#[cfg(test)]
mod window_tests {
    use super::*;
    #[test]
    fn dock_restore_and_closed_window_reopen_are_exclusive() {
        assert_eq!(reopen_action(true, false), ReopenAction::RestoreFromDock);
        assert_eq!(reopen_action(true, true), ReopenAction::RestoreFromDock);
        assert_eq!(reopen_action(false, false), ReopenAction::ShowClosedWindow);
        assert_eq!(reopen_action(false, true), ReopenAction::None);
    }
}
