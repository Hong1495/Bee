use serde::{Deserialize, Serialize};
use std::{collections::HashSet, path::Path, sync::Mutex};

static LOCK: Mutex<()> = Mutex::new(());
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Playlist {
    id: String,
    name: String,
    source: String,
    track_ids: Vec<String>,
    managed: bool,
}
#[derive(Default, Serialize, Deserialize)]
struct Store {
    version: u8,
    playlists: Vec<Playlist>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Edit {
    operation: String,
    source: String,
    id: Option<String>,
    name: Option<String>,
    track_ids: Option<Vec<String>>,
    before_id: Option<String>,
}
fn read(path: &Path) -> Result<Store, String> {
    match std::fs::read(path) {
        Ok(bytes) => {
            let store: Store = serde_json::from_slice(&bytes).map_err(|_| "播放列表文件无法读取，原文件已保留")?;
            if store.version != 1 { return Err("播放列表版本不受支持".into()); }
            Ok(store)
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Store { version: 1, playlists: vec![] }),
        Err(e) => Err(e.to_string()),
    }
}
fn name(value: Option<&str>) -> Result<String, String> {
    let text = value.unwrap_or("").trim();
    if text.is_empty() || text.chars().count() > 100 { return Err("列表名称应为 1–100 个字符".into()); }
    Ok(text.to_owned())
}
fn edit(store: &mut Store, change: &Edit) -> Result<(), String> {
    if !["music", "local"].contains(&change.source.as_str()) { return Err("未知音乐源".into()); }
    if change.operation == "list" { return Ok(()); }
    let id = change.id.as_deref().ok_or("缺少列表 ID")?;
    if change.operation == "create" {
        if !id.starts_with("bee:") || id.len() > 80 || store.playlists.iter().any(|p| p.id == id) { return Err("列表 ID 无效或已存在".into()); }
        store.playlists.push(Playlist { id: id.to_owned(), name: name(change.name.as_deref())?, source: change.source.clone(), track_ids: vec![], managed: true });
    }
    let index = store.playlists.iter().position(|p| p.id == id && p.source == change.source).ok_or("列表不存在或属于其他音乐源")?;
    let list = &mut store.playlists[index];
    match change.operation.as_str() {
        "create" | "add" => {
            let ids = change.track_ids.as_deref().unwrap_or(&[]);
            if ids.iter().any(|id| id.is_empty() || id.len() > 512 || id.starts_with("local:") != (change.source == "local")) { return Err("歌曲与列表的音乐源不一致".into()); }
            let mut seen: HashSet<String> = list.track_ids.iter().cloned().collect();
            for id in ids { if seen.insert(id.clone()) { list.track_ids.push(id.clone()); } }
        }
        "rename" => list.name = name(change.name.as_deref())?,
        "remove" => {
            let ids: HashSet<&String> = change.track_ids.iter().flatten().collect();
            list.track_ids.retain(|id| !ids.contains(id));
        }
        "move" => {
            let id = change.track_ids.as_ref().and_then(|v| v.first()).ok_or("缺少歌曲")?;
            let from = list.track_ids.iter().position(|v| v == id).ok_or("歌曲不在列表中")?;
            if change.before_id.as_ref() == Some(id) { return Ok(()); }
            if let Some(before) = &change.before_id { if !list.track_ids.contains(before) { return Err("目标歌曲不在列表中".into()); } }
            let song = list.track_ids.remove(from);
            let to = change.before_id.as_ref().and_then(|id| list.track_ids.iter().position(|v| v == id)).unwrap_or(list.track_ids.len());
            list.track_ids.insert(to, song);
        }
        "delete" => { store.playlists.remove(index); }
        _ => return Err("未知播放列表操作".into()),
    }
    Ok(())
}
fn apply(path: &Path, change: &Edit) -> Result<Vec<Playlist>, String> {
    let mut store = read(path)?;
    edit(&mut store, change)?;
    if change.operation != "list" {
        let bytes = serde_json::to_vec(&store).map_err(|e| e.to_string())?;
        let temp = path.with_extension("tmp");
        use std::io::Write;
        let mut file = std::fs::File::create(&temp).map_err(|e| e.to_string())?;
        file.write_all(&bytes).and_then(|_| file.sync_all()).map_err(|e| e.to_string())?;
        std::fs::rename(&temp, path).map_err(|e| e.to_string())?;
    }
    Ok(store.playlists)
}
#[tauri::command]
pub async fn playlist_request(app: tauri::AppHandle, change: Edit) -> Result<Vec<Playlist>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _lock = LOCK.lock().map_err(|_| "播放列表暂不可用")?;
        apply(&crate::storage::data(&app)?.join("playlists.json"), &change)
    }).await.map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    fn change(op: &str, source: &str, ids: &[&str]) -> Edit {
        Edit { operation: op.into(), source: source.into(), id: Some("bee:test".into()), name: Some("我的歌单".into()), track_ids: Some(ids.iter().map(|s| s.to_string()).collect()), before_id: None }
    }
    #[test]
    fn persistence_isolation_order_and_failed_writes() {
        let dir = std::env::temp_dir().join(format!("bee-playlists-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("playlists.json");
        let lists = apply(&path, &change("create", "local", &["local:1", "local:2", "local:1"])).unwrap();
        assert_eq!(lists[0].track_ids, ["local:1", "local:2"]);
        apply(&path, &change("add", "local", &["local:3", "local:2"])).unwrap();
        let before = std::fs::read(&path).unwrap();
        assert!(apply(&path, &change("delete", "music", &[])).is_err());
        assert!(apply(&path, &change("add", "local", &["music-id"])).is_err());
        assert_eq!(std::fs::read(&path).unwrap(), before);
        let mut move_song = change("move", "local", &["local:3"]);
        move_song.before_id = Some("local:1".into());
        assert_eq!(apply(&path, &move_song).unwrap()[0].track_ids, ["local:3", "local:1", "local:2"]);
        apply(&path, &change("remove", "local", &["local:1"])).unwrap();
        let mut rename = change("rename", "local", &[]); rename.name = Some(" 新名字 ".into());
        assert_eq!(apply(&path, &rename).unwrap()[0].name, "新名字");
        assert_eq!(read(&path).unwrap().playlists[0].track_ids, ["local:3", "local:2"]);
        assert!(apply(&path, &change("delete", "local", &[])).unwrap().is_empty());
        std::fs::write(&path, b"broken").unwrap();
        assert!(apply(&path, &change("create", "local", &[])).is_err());
        assert_eq!(std::fs::read(&path).unwrap(), b"broken");
        std::fs::remove_dir_all(dir).unwrap();
    }
}
