//! AppKit 27 hides menu images by default, including images supplied by muda.
//! Apply visibility at tracking time, when the native menu tree exists.
use objc2::{define_class, msg_send, sel, MainThreadMarker, MainThreadOnly};
use objc2::rc::Retained;
use objc2_app_kit::{NSMenu, NSMenuDidBeginTrackingNotification};
use objc2_foundation::{NSObject, NSObjectProtocol, NSNotification, NSNotificationCenter};

fn prepare(menu: &NSMenu) {
    for item in menu.itemArray() {
        if let Some(image) = item.image() {
            // Alpha-only template rendering follows menu appearance and selection.
            image.setTemplate(true);
            image.setSize(objc2_foundation::NSSize::new(18.0,18.0));
            if item.respondsToSelector(sel!(setPreferredImageVisibility:)) {
                // NSMenuItemImageVisibilityVisible (macOS 27+). Guard the new
                // selector so the same binary remains usable on macOS 12+.
                unsafe { let _: () = msg_send![&*item, setPreferredImageVisibility: 1isize]; }
            }
        }
        if let Some(submenu) = item.submenu() { prepare(&submenu); }
    }
}

define_class!(
    #[unsafe(super = NSObject)]
    #[thread_kind = MainThreadOnly]
    struct MenuAppearanceObserver;
    unsafe impl NSObjectProtocol for MenuAppearanceObserver {}
    impl MenuAppearanceObserver {
        #[unsafe(method(menuTracking:))]
        fn menu_tracking(&self, notification: &NSNotification) {
            if let Some(object) = notification.object() {
                if let Some(menu) = object.downcast_ref::<NSMenu>() { prepare(menu); }
            }
        }
    }
);
thread_local! {
    static OBSERVER: std::cell::RefCell<Option<Retained<MenuAppearanceObserver>>> = const { std::cell::RefCell::new(None) };
}
pub fn install() {
    let mtm = MainThreadMarker::new().expect("menu setup on main thread");
    OBSERVER.with(|slot| {
        if slot.borrow().is_some() { return; }
        let observer: Retained<MenuAppearanceObserver> = unsafe { msg_send![MenuAppearanceObserver::alloc(mtm), init] };
        unsafe {
            NSNotificationCenter::defaultCenter().addObserver_selector_name_object(
                &observer, sel!(menuTracking:), Some(NSMenuDidBeginTrackingNotification), None,
            );
        }
        *slot.borrow_mut() = Some(observer);
    });
}
