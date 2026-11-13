use serde_json::{json, Value};
use std::path::Path;
use std::{
    io::Write,
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::{Duration, Instant},
};

pub struct MusicBridge {
    connected: AtomicBool,
    serial: Mutex<()>,
    artwork: Mutex<()>,
    context: Mutex<Value>,
}
impl Default for MusicBridge {
    fn default() -> Self {
        Self {
            connected: AtomicBool::new(false),
            serial: Mutex::new(()),
            artwork: Mutex::new(()),
            context: Mutex::new(Value::Null),
        }
    }
}

// Metadata/control are serialized; artwork extraction uses a separate gate.
fn script(source: &str, language: &str, argument: &str) -> Result<String, String> {
    let mut child = Command::new("/usr/bin/osascript")
        .args(["-l", language, "-", argument])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;
    child
        .stdin
        .take()
        .unwrap()
        .write_all(source.as_bytes())
        .map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let output = std::thread::spawn(move || {
        use std::io::Read;
        let mut s = String::new();
        let _ = std::io::BufReader::new(stdout).read_to_string(&mut s);
        s
    });
    let errors = std::thread::spawn(move || {
        use std::io::Read;
        let mut s = String::new();
        let _ = std::io::BufReader::new(stderr).read_to_string(&mut s);
        s
    });
    let start = Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            break status;
        }
        if start.elapsed() > Duration::from_secs(90) {
            let _ = child.kill();
            let _ = child.wait();
            let _ = output.join();
            let _ = errors.join();
            return Err("音乐 App 响应超时，请检查授权弹窗或音乐 App 后重试".into());
        }
        std::thread::sleep(Duration::from_millis(25));
    };
    let out = output.join().unwrap_or_default();
    let err = errors.join().unwrap_or_default();
    if !status.success() {
        if err.contains("-1743") || err.contains("not authorized") {
            return Err("未获授权。请在系统设置 → 隐私与安全性 → 自动化中，允许 Bee 控制“音乐”，然后重新连接。".into());
        }
        return Err(format!("音乐 App 操作失败：{}", err.trim()));
    }
    Ok(out.trim().to_owned())
}
fn valid_id(id: &str) -> bool {
    id.len() == 16 && id.bytes().all(|b| b.is_ascii_hexdigit())
}

fn cached_artwork(cache: &Path, id: &str) -> Option<std::path::PathBuf> {
    ["jpg", "png"].iter().map(|ext| cache.join(format!("{id}.{ext}"))).find(|path| {
        std::fs::metadata(path).ok().is_some_and(|m| m.len()>0 && m.modified().ok()
            .and_then(|t|t.elapsed().ok()).is_some_and(|age|age<Duration::from_secs(30*86400)))
    })
}

#[tauri::command]
pub async fn music_request(
    app: tauri::AppHandle,
    operation: String,
    id: Option<String>,
    playlist_id: Option<String>,
    track_ids: Option<Vec<String>>,
    source_name: Option<String>,
) -> Result<Value, String> {
    // All requests are allowlisted; never accept executable scripts from WebView.
    if ![
        "connect",
        "disconnect",
        "library",
        "playlist",
        "status",
        "play",
        "pause",
        "toggle",
        "previous",
        "next",
        "queue",
        "artwork",
    ]
    .contains(&operation.as_str())
    {
        return Err("不支持的音乐操作".into());
    }
    if id.as_ref().is_some_and(|id| !valid_id(id))
        || playlist_id.as_ref().is_some_and(|id| !valid_id(id))
    {
        return Err("无效的音乐标识".into());
    }
    if (["playlist", "artwork"].contains(&operation.as_str())
        || (operation == "play" && playlist_id.is_none()))
        && id.is_none()
    {
        return Err("缺少歌曲或播放列表标识".into());
    }
    if track_ids
        .as_ref()
        .is_some_and(|ids| ids.len() > 10000 || ids.iter().any(|id| !valid_id(id)))
    {
        return Err("无效的播放队列".into());
    }
    if source_name.as_ref().is_some_and(|name| name.len() > 4096) {
        return Err("播放来源名称过长".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        use tauri::Manager;
        let cache = app
            .path()
            .app_cache_dir()
            .map_err(|e| e.to_string())?
            .join("artwork-v2");
        let artwork = operation == "artwork";
        let _cache_gate = if artwork {
            Some(
                crate::storage::CACHE_LOCK
                    .lock()
                    .map_err(|_| "缓存不可用")?,
            )
        } else {
            None
        };
        // Reads cannot increase disk usage. Only a newly extracted cover needs
        // budget enforcement; scanning all cached files on every hit made warm
        // library navigation quadratic in the number of covers.
        if artwork && app.state::<MusicBridge>().connected.load(Ordering::SeqCst) {
            if let Some(path) = id.as_deref().and_then(|id| cached_artwork(&cache,id)) {
                return Ok(json!(path));
            }
        }
        let result = execute(
            &app.state::<MusicBridge>(),
            &cache,
            operation,
            id,
            playlist_id,
            track_ids,
            source_name,
        )?;
        if artwork {
            crate::storage::enforce(&app, result.as_str().map(Path::new))?;
        }
        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}

pub fn execute(
    state: &MusicBridge,
    cache: &Path,
    operation: String,
    id: Option<String>,
    playlist_id: Option<String>,
    track_ids: Option<Vec<String>>,
    source_name: Option<String>,
) -> Result<Value, String> {
    if operation == "disconnect" {
        state.connected.store(false, Ordering::SeqCst);
        *state.context.lock().map_err(|_| "播放来源不可用")? = Value::Null;
        return Ok(json!({}));
    }
    if operation != "connect" && !state.connected.load(Ordering::SeqCst) {
        return Err("请先连接 Apple Music".into());
    }
    if operation == "artwork" {
        // Cached images do not send Apple Events or hold the playback gate.
        let id = id.unwrap();
        std::fs::create_dir_all(cache).map_err(|e| e.to_string())?;
        if let Some(cached) = cached_artwork(cache,&id) {
            return Ok(json!(cached));
        }
        // Only one artwork extraction at once; playback has an independent gate.
        let _artwork = state.artwork.lock().map_err(|_| "封面读取不可用")?;
        if !state.connected.load(Ordering::SeqCst) {
            return Err("连接已断开".into());
        }
        if let Some(cached) = cached_artwork(cache,&id) {
            return Ok(json!(cached));
        }
        let path = std::env::temp_dir().join(format!("bee-art-{}-{}.bin", std::process::id(), id));
        let source = format!(
            r#"on run argv
set artworkFile to POSIX file (item 1 of argv)
tell application "Music"
set matches to (every track of library playlist 1 whose persistent ID is "{id}")
if (count of matches) is 0 then return ""
set artworkTrack to item 1 of matches
if (count of artworks of artworkTrack) is 0 then return ""
set imageBytes to raw data of artwork 1 of artworkTrack
end tell
set fileRef to open for access artworkFile with write permission
try
set eof fileRef to 0
write imageBytes to fileRef
close access fileRef
on error messageText number errorNumber
close access fileRef
error messageText number errorNumber
end try
return "ok"
end run"#
        );
        let result = script(&source, "AppleScript", path.to_str().unwrap());
        if let Err(error) = result {
            let _ = std::fs::remove_file(&path);
            return Err(error);
        }
        if std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0) == 0 {
            let _ = std::fs::remove_file(path);
            return Ok(Value::Null);
        }
        // Keep original JPEG/PNG bytes whenever they already fit the Retina
        // budget. Avoid a lossy re-encode of small source images.
        let probe = Command::new("/usr/bin/sips")
            .args(["-g", "pixelWidth", "-g", "pixelHeight", "-g", "format"])
            .arg(&path)
            .output();
        let properties = probe
            .ok()
            .filter(|p| p.status.success())
            .map(|p| String::from_utf8_lossy(&p.stdout).into_owned())
            .unwrap_or_default();
        let property = |key: &str| {
            properties
                .lines()
                .find_map(|line| line.trim().strip_prefix(key).map(str::trim))
        };
        let width = property("pixelWidth:")
            .and_then(|v| v.parse::<u32>().ok())
            .unwrap_or(0);
        let height = property("pixelHeight:")
            .and_then(|v| v.parse::<u32>().ok())
            .unwrap_or(0);
        let format = property("format:").unwrap_or("");
        let original = width > 0
            && height > 0
            && width.max(height) <= 2048
            && ["jpeg", "png"].contains(&format);
        let extension = if original && format == "png" {
            "png"
        } else {
            "jpg"
        };
        let cached = cache.join(format!("{id}.{extension}"));
        let staging = cache.join(format!("{id}.tmp.{extension}"));
        if original {
            std::fs::copy(&path, &staging).map_err(|e| e.to_string())?;
        } else {
            let conversion = Command::new("/usr/bin/sips")
                .args([
                    "-Z",
                    "2048",
                    "-s",
                    "format",
                    "jpeg",
                    "-s",
                    "formatOptions",
                    "95",
                ])
                .arg(&path)
                .arg("--out")
                .arg(&staging)
                .output();
            if !conversion.is_ok_and(|output| output.status.success()) {
                let _ = std::fs::remove_file(&path);
                let _ = std::fs::remove_file(staging);
                return Err("无法解码歌曲封面".into());
            }
        }
        let _ = std::fs::remove_file(path);
        std::fs::rename(staging, &cached).map_err(|e| e.to_string())?;
        return Ok(json!(cached));
    }
    let _gate = state.serial.lock().map_err(|_| "音乐连接不可用")?;
    if operation != "connect" && !state.connected.load(Ordering::SeqCst) {
        return Err("连接已断开".into());
    }
    let context = state.context.lock().map_err(|_| "播放来源不可用")?.clone();
    let input = json!({"operation":operation,"id":id,"playlistId":playlist_id,"trackIds":track_ids,"sourceName":source_name,"context":context}).to_string();
    let output = script(include_str!("../music/bridge.js"), "JavaScript", &input)?;
    let result: Value =
        serde_json::from_str(&output).map_err(|_| "音乐 App 返回了无法识别的数据")?;
    if let Some(context) = result.get("context") {
        *state.context.lock().map_err(|_| "播放来源不可用")? = context.clone();
    }
    if operation == "status" && result.get("track").is_some_and(|track| !track.is_null()) {
        let id = result["track"]["id"].as_str().unwrap_or("");
        let mut context = state.context.lock().map_err(|_| "播放来源不可用")?;
        if !context["ids"]
            .as_array()
            .is_some_and(|ids| ids.iter().any(|value| value.as_str() == Some(id)))
        {
            *context = Value::Null;
        }
    }
    if operation == "connect" {
        state.connected.store(true, Ordering::SeqCst);
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cached_artwork_avoids_music_and_control_gate() {
        let state = MusicBridge::default();
        state.connected.store(true, Ordering::SeqCst);
        let cache = std::env::temp_dir().join(format!("bee-cache-test-{}", std::process::id()));
        std::fs::create_dir_all(&cache).unwrap();
        let id = "1234ABCDEF567890";
        let image = cache.join(format!("{id}.jpg"));
        std::fs::write(&image, b"cached-test-data").unwrap();
        let _control = state.serial.lock().unwrap();
        let _artwork = state.artwork.lock().unwrap();
        assert_eq!(
            execute(
                &state,
                &cache,
                "artwork".into(),
                Some(id.into()),
                None,
                None,
                None
            )
            .unwrap(),
            json!(image)
        );
        state.connected.store(false, Ordering::SeqCst);
        assert!(execute(
            &state,
            &cache,
            "artwork".into(),
            Some(id.into()),
            None,
            None,
            None
        )
        .is_err());
        std::fs::remove_dir_all(cache).unwrap();
    }
    #[test]
    fn identifiers_are_strict() {
        assert!(valid_id("1234ABCDEF567890"));
        assert!(!valid_id("\" & do shell script"));
        assert!(!valid_id(""));
    }
    #[test]
    fn cache_lookup_rejects_empty_files_and_supports_png() {
        let root=std::env::temp_dir().join(format!("bee-cache-lookup-{}",std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let id="0123456789ABCDEF";
        assert!(cached_artwork(&root,id).is_none());
        std::fs::write(root.join(format!("{id}.jpg")),[]).unwrap();
        assert!(cached_artwork(&root,id).is_none());
        let png=root.join(format!("{id}.png"));
        std::fs::write(&png,b"cached-png").unwrap();
        assert_eq!(cached_artwork(&root,id),Some(png));
        std::fs::remove_dir_all(root).unwrap();
    }
}

#[tauri::command]
pub async fn music_seek(app:tauri::AppHandle,seconds:f64)->Result<(),String>{
 if !seconds.is_finite() || !(0.0..=604800.0).contains(&seconds){return Err("无效的播放位置".into());}
 tauri::async_runtime::spawn_blocking(move||{
  use tauri::Manager;let state=app.state::<MusicBridge>();let _gate=state.serial.lock().map_err(|_|"音乐连接不可用")?;
  if !state.connected.load(Ordering::SeqCst){return Err("请先连接 Apple Music".into());}
  script("function run(argv) { const music=Application('com.apple.Music'); music.playerPosition=Number(argv[0]); }","JavaScript",&seconds.to_string())?;Ok(())
 }).await.map_err(|e|e.to_string())?
}

#[tauri::command]
pub async fn music_volume(app:tauri::AppHandle,value:Option<f64>)->Result<f64,String>{
 if value.is_some_and(|v| !v.is_finite() || !(0.0..=1.0).contains(&v)){return Err("无效的音量".into());}
 tauri::async_runtime::spawn_blocking(move||{
  use tauri::Manager;let state=app.state::<MusicBridge>();let _gate=state.serial.lock().map_err(|_|"音乐连接不可用")?;
  if !state.connected.load(Ordering::SeqCst){return Err("请先连接 Apple Music".into());}
  let arg=value.map(|v|(v*100.0).round().to_string()).unwrap_or_default();
  let result=script("function run(argv) { const music=Application('com.apple.Music'); if(argv[0] !== '') music.soundVolume=Number(argv[0]); return String(music.soundVolume()/100); }","JavaScript",&arg)?;
  result.trim().parse::<f64>().map_err(|e|e.to_string())
 }).await.map_err(|e|e.to_string())?
}
