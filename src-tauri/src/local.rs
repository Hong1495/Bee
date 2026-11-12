use crate::storage;
use lofty::{
    file::{AudioFile, TaggedFileExt},
    tag::Accessor,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{mpsc, Mutex},
    time::Duration,
};
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Folder {
    id: String,
    path: String,
    name: String,
}
#[derive(Clone)]
struct LocalTrack {
    path: PathBuf,
    row: Value,
}
pub struct LocalMedia {
    folders: Mutex<Vec<Folder>>,
    tracks: Mutex<HashMap<String, LocalTrack>>,
    audio: Mutex<Option<mpsc::Sender<AudioCommand>>>,
}
impl Default for LocalMedia {
    fn default() -> Self {
        Self {
            folders: Mutex::new(vec![]),
            tracks: Mutex::new(HashMap::new()),
            audio: Mutex::new(None),
        }
    }
}
enum AudioCommand {
    Play(PathBuf, f64, mpsc::Sender<Result<(), String>>),
    Toggle(mpsc::Sender<Result<(), String>>),
    Pause,
    Status(mpsc::Sender<Value>),
}
fn audio_worker(rx: mpsc::Receiver<AudioCommand>) {
    let stream = rodio::OutputStreamBuilder::open_default_stream();
    let mut sink: Option<rodio::Sink> = None;
    let mut position_offset=0.0;
    while let Ok(cmd) = rx.recv() {
        match cmd {
            AudioCommand::Play(path, seconds, reply) => {
                let result = (|| {
                    let output = stream.as_ref().map_err(|e| e.to_string())?;
                    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
                    let mut decoder = rodio::Decoder::try_from(file).map_err(|e| e.to_string())?;
                    if seconds > 0.0 { use rodio::Source; decoder.try_seek(Duration::from_secs_f64(seconds)).map_err(|e| e.to_string())?; }
                    let next = rodio::Sink::connect_new(output.mixer());
                    next.pause();
                    next.append(decoder);
                    if let Some(old) = sink.take() {
                        old.stop();
                    }
                    next.play();
                    sink = Some(next);
                    position_offset=seconds;
                    Ok(())
                })();
                let _ = reply.send(result);
            }
            AudioCommand::Toggle(reply) => {
                let result = if let Some(s) = &sink {
                    if s.is_paused() {
                        s.play()
                    } else {
                        s.pause()
                    };
                    Ok(())
                } else {
                    Err("还没有播放的歌曲".into())
                };
                let _ = reply.send(result);
            }
            AudioCommand::Pause => {
                if let Some(s) = &sink {
                    s.pause();
                }
            }
            AudioCommand::Status(reply) => {
                let value = if let Some(s) = &sink {
                    json!({"playing":!s.is_paused()&&!s.empty(),"ended":s.empty(),"position":position_offset+s.get_pos().as_secs_f64()})
                } else {
                    json!({"playing":false,"ended":false,"position":0})
                };
                let _ = reply.send(value);
            }
        }
    }
}
fn sender(state: &LocalMedia) -> Result<mpsc::Sender<AudioCommand>, String> {
    let mut lock = state.audio.lock().map_err(|_| "音频不可用")?;
    if lock.is_none() {
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || audio_worker(rx));
        *lock = Some(tx);
    }
    Ok(lock.as_ref().unwrap().clone())
}
fn hash(text: &str) -> String {
    format!("{:x}", Sha256::digest(text.as_bytes()))
}
fn folders(app: &tauri::AppHandle) -> Vec<Folder> {
    storage::data(app)
        .ok()
        .and_then(|p| std::fs::read(p.join("folders.json")).ok())
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}
fn save(app: &tauri::AppHandle, list: &[Folder]) -> Result<(), String> {
    std::fs::write(
        storage::data(app)?.join("folders.json"),
        serde_json::to_vec(list).unwrap(),
    )
    .map_err(|e| e.to_string())
}
fn scan(state: &LocalMedia, list: Vec<Folder>) -> Result<Value, String> {
    let mut tracks = HashMap::new();
    // Source folders are library inputs, not user-created playlists.
    let playlists: Vec<Value> = vec![];
    let mut warnings = vec![];
    for folder in &list {
        let root = Path::new(&folder.path);
        if !root.is_dir() {
            warnings.push(format!("{}：目录不可用", folder.name));
            continue;
        }
        let mut paths = storage::files(root);
        paths.sort();
        for path in paths {
            if tracks.len() >= 100000 {
                return Err("文件数超过 100000，请选择较小的目录".into());
            }
            let ext = path
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_lowercase();
            if !["mp3", "flac", "m4a", "aac", "ogg", "wav", "aiff", "aif"].contains(&ext.as_str()) {
                continue;
            }
            let file = match lofty::probe::Probe::open(&path).and_then(|probe|probe.options(lofty::config::ParseOptions::new().read_cover_art(false)).read()) {
                Ok(f) => f,
                Err(_) => {
                    warnings.push(format!(
                        "无法读取：{}",
                        path.file_name().unwrap_or_default().to_string_lossy()
                    ));
                    continue;
                }
            };
            let tag = file.primary_tag().or_else(|| file.first_tag());
            let id = format!("local:{}", hash(&path.to_string_lossy()));
            let props = file.properties();
            let row = json!({"id":id,"source":"local","title":tag.and_then(|t|t.title()).map(|v|v.into_owned()).unwrap_or_else(||path.file_stem().unwrap_or_default().to_string_lossy().into_owned()),"artist":tag.and_then(|t|t.artist()).map(|v|v.into_owned()).unwrap_or_else(||"未知艺术家".into()),"albumArtist":"","album":tag.and_then(|t|t.album()).map(|v|v.into_owned()).unwrap_or_else(||path.parent().and_then(|p|p.file_name()).unwrap_or_default().to_string_lossy().into_owned()),"duration":props.duration().as_secs_f64(),"year":tag.and_then(|t|t.year()).unwrap_or(0),"genre":tag.and_then(|t|t.genre()).map(|v|v.into_owned()).unwrap_or_default(),"disc":tag.and_then(|t|t.disk()).unwrap_or(1),"number":tag.and_then(|t|t.track()).unwrap_or(0),"added":0});
            tracks.entry(id).or_insert(LocalTrack { path, row });
        }
    }
    let mut rows: Vec<_> = tracks.values().map(|t| t.row.clone()).collect();
    rows.sort_by(|a, b| a["id"].as_str().cmp(&b["id"].as_str()));
    *state.tracks.lock().map_err(|_| "资料库不可用")? = tracks;
    *state.folders.lock().map_err(|_| "目录不可用")? = list.clone();
    Ok(json!({"tracks":rows,"playlists":playlists,"folders":list,"warnings":warnings}))
}
#[tauri::command]
pub async fn local_request(
    app: tauri::AppHandle,
    operation: String,
    id: Option<String>,
    seconds: Option<f64>,
) -> Result<Value, String> {
    use tauri::Manager;
    let seconds=seconds.unwrap_or(0.0);
    if !seconds.is_finite() || !(0.0..=604800.0).contains(&seconds) { return Err("无效的播放位置".into()); }
    // Native picker returns only a user-selected directory; no arbitrary path IPC.
    let chosen = if operation == "add" {
        rfd::AsyncFileDialog::new()
            .set_title(crate::music_folder_picker_title())
            .pick_folder()
            .await
            .map(|p| p.path().to_path_buf())
    } else {
        None
    };
    if operation == "add" && chosen.is_none() {
        return Ok(Value::Null);
    }
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<LocalMedia>();
        match operation.as_str() {
            "list" => Ok(json!(folders(&app))),
            "scan" | "add" | "remove" => {
                let mut list = folders(&app);
                if let Some(path) = chosen {
                    let path = path.canonicalize().map_err(|e| e.to_string())?;
                    let text = path.to_string_lossy().into_owned();
                    if !list.iter().any(|f| f.path == text) {
                        list.push(Folder {
                            id: format!("folder:{}", hash(&text)),
                            name: path
                                .file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .into_owned(),
                            path: text,
                        });
                    }
                }
                if operation == "remove" {
                    list.retain(|f| Some(&f.id) != id.as_ref());
                }
                save(&app, &list)?;
                scan(&state, list)
            }
            "play" => {
                let t = state
                    .tracks
                    .lock()
                    .map_err(|_| "资料库不可用")?
                    .get(id.as_deref().unwrap_or(""))
                    .cloned()
                    .ok_or("歌曲已不在本地资料库中")?;
                let (tx, rx) = mpsc::channel();
                sender(&state)?
                    .send(AudioCommand::Play(t.path, seconds, tx))
                    .map_err(|e| e.to_string())?;
                rx.recv_timeout(Duration::from_secs(15))
                    .map_err(|e| e.to_string())??;
                Ok(json!({}))
            }
            "toggle" => {
                let (tx, rx) = mpsc::channel();
                sender(&state)?
                    .send(AudioCommand::Toggle(tx))
                    .map_err(|e| e.to_string())?;
                rx.recv_timeout(Duration::from_secs(5))
                    .map_err(|e| e.to_string())??;
                Ok(json!({}))
            }
            "pause" => {
                if let Some(tx) = state.audio.lock().map_err(|_| "音频不可用")?.as_ref() {
                    let _ = tx.send(AudioCommand::Pause);
                }
                Ok(json!({}))
            }
            "status" => {
                let (tx, rx) = mpsc::channel();
                sender(&state)?
                    .send(AudioCommand::Status(tx))
                    .map_err(|e| e.to_string())?;
                rx.recv_timeout(Duration::from_secs(5))
                    .map_err(|e| e.to_string())
            }
            "artwork" => {
                let t = state
                    .tracks
                    .lock()
                    .map_err(|_| "资料库不可用")?
                    .get(id.as_deref().unwrap_or(""))
                    .cloned()
                    .ok_or("歌曲不存在")?;
                let _gate = storage::CACHE_LOCK.lock().map_err(|_| "缓存不可用")?;
                let root = storage::cache(&app)?.join("local-artwork");
                std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
                let meta = std::fs::metadata(&t.path).map_err(|e| e.to_string())?;
                let key = hash(&format!(
                    "{}:{:?}:{}",
                    t.path.display(),
                    meta.modified(),
                    meta.len()
                ));
                for ext in ["jpg", "png"] {
                    let p = root.join(format!("{key}.{ext}"));
                    if p.is_file() {
                        return Ok(json!(p));
                    }
                }
                let file = lofty::read_from_path(&t.path).map_err(|e| e.to_string())?;
                let pic = file
                    .primary_tag()
                    .or_else(|| file.first_tag())
                    .and_then(|t| t.pictures().first());
                let bytes = if let Some(p) = pic {
                    p.data().to_vec()
                } else {
                    let parent = t.path.parent().unwrap();
                    ["cover.jpg", "folder.jpg", "cover.png"]
                        .iter()
                        .find_map(|name| {
                            std::fs::metadata(parent.join(name))
                                .ok()
                                .filter(|m| m.len() <= 16 * 1024 * 1024)
                                .and_then(|_| std::fs::read(parent.join(name)).ok())
                        })
                        .unwrap_or_default()
                };
                if bytes.is_empty() {
                    return Ok(Value::Null);
                }
                let ext = if bytes.starts_with(b"\x89PNG") {
                    "png"
                } else if bytes.starts_with(b"\xff\xd8") {
                    "jpg"
                } else {
                    return Ok(Value::Null);
                };
                if bytes.len() > 16 * 1024 * 1024 {
                    return Ok(Value::Null);
                }
                let path = root.join(format!("{key}.{ext}"));
                std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
                storage::enforce(&app, Some(&path))?;
                Ok(json!(path))
            }
            _ => Err("未知本地音乐操作".into()),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn scan_and_decode_real_pcm_without_copying_music() {
        let root = std::env::temp_dir().join(format!("bee-local-test-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let audio = root.join("01 Test.wav");
        let samples = 4410u32;
        let size = samples * 2;
        let mut bytes = Vec::new();
        bytes.extend(b"RIFF");
        bytes.extend((36 + size).to_le_bytes());
        bytes.extend(b"WAVEfmt ");
        bytes.extend(16u32.to_le_bytes());
        bytes.extend(1u16.to_le_bytes());
        bytes.extend(1u16.to_le_bytes());
        bytes.extend(44100u32.to_le_bytes());
        bytes.extend(88200u32.to_le_bytes());
        bytes.extend(2u16.to_le_bytes());
        bytes.extend(16u16.to_le_bytes());
        bytes.extend(b"data");
        bytes.extend(size.to_le_bytes());
        bytes.resize((44 + size) as usize, 0);
        std::fs::write(&audio, &bytes).unwrap();
        std::fs::write(root.join("broken.mp3"), b"invalid").unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(&root, root.join("loop")).unwrap();
        let state = LocalMedia::default();
        let folder = Folder {
            id: "folder:test".into(),
            name: "Test".into(),
            path: root.to_string_lossy().into_owned(),
        };
        let result = scan(&state, vec![folder.clone(), folder]).unwrap();
        assert_eq!(result["tracks"].as_array().unwrap().len(), 1);
        assert_eq!(result["tracks"][0]["source"], "local");
        assert_eq!(result["tracks"][0]["title"], "01 Test");
        assert!(result["tracks"][0]["duration"].as_f64().unwrap() > 0.0);
        assert!(result["playlists"].as_array().unwrap().is_empty());
        assert_eq!(result["folders"].as_array().unwrap().len(), 2);
        assert!(!result["warnings"].as_array().unwrap().is_empty());
        let mut decoder = rodio::Decoder::try_from(std::fs::File::open(&audio).unwrap()).unwrap();
        use rodio::Source;
        decoder.try_seek(Duration::from_millis(50)).unwrap();
        let remaining=decoder.count();
        assert!(remaining > 0 && remaining < 4410);
        assert_eq!(std::fs::read(&audio).unwrap(), bytes);
        std::fs::remove_dir_all(root).unwrap();
    }
}
