use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::Manager;
pub static CACHE_LOCK: Mutex<()> = Mutex::new(());
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    #[serde(default)]
    pub lyrics_sources_version:u8,
    pub limit_mb: u64,
    pub lyrics_enabled: bool,
    pub providers: Vec<Provider>,
}
#[derive(Serialize, Deserialize, Clone)]
pub struct Provider {
    pub kind: String,
    pub enabled: bool,
    pub url: String,
}
impl Default for Preferences {
    fn default() -> Self {
        Self {
            lyrics_sources_version:2,
            limit_mb: 512,
            lyrics_enabled: true,
            providers: vec![
                Provider {
                    kind: "lrclib".into(),
                    enabled: true,
                    url: "https://lrclib.net".into(),
                },
                Provider { kind:"netease".into(),enabled:true,url:"https://music.163.com".into() },
                Provider {
                    kind: "lyricsovh".into(),
                    enabled: true,
                    url: "https://api.lyrics.ovh".into(),
                },
            ],
        }
    }
}
pub fn data(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let p = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&p).map_err(|e| e.to_string())?;
    Ok(p)
}
pub fn cache(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_cache_dir().map_err(|e| e.to_string())
}
pub fn preferences(app: &tauri::AppHandle) -> Preferences {
    let mut prefs:Preferences=data(app)
        .ok()
        .and_then(|p| std::fs::read(p.join("preferences.json")).ok())
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default();
    if prefs.lyrics_sources_version<2 {
        if !prefs.providers.iter().any(|p|p.kind=="netease") && prefs.providers.len()<8 {let index=prefs.providers.iter().position(|p|p.kind=="lyricsovh").unwrap_or(prefs.providers.len());prefs.providers.insert(index,Provider{kind:"netease".into(),enabled:true,url:"https://music.163.com".into()});}
        prefs.lyrics_sources_version=2;
    }
    prefs
}
pub fn files(root: &Path) -> Vec<PathBuf> {
    let mut result = vec![];
    if let Ok(entries) = std::fs::read_dir(root) {
        for e in entries.flatten() {
            let p = e.path();
            if e.file_type().map(|t| t.is_symlink()).unwrap_or(true) {
                continue;
            }
            if p.is_dir() {
                result.extend(files(&p));
            } else {
                result.push(p);
            }
        }
    }
    result
}
const OWNED: &[&str] = &["artwork-v1", "artwork-v2", "local-artwork", "lyrics-v1"];
fn cache_files(app: &tauri::AppHandle) -> Vec<PathBuf> {
    cache(app)
        .map(|root| {
            OWNED
                .iter()
                .flat_map(|name| files(&root.join(name)))
                .collect()
        })
        .unwrap_or_default()
}
pub fn enforce(app: &tauri::AppHandle, protected: Option<&Path>) -> Result<(), String> {
    let limit = preferences(app).limit_mb * 1024 * 1024;
    enforce_files(cache_files(app), limit, protected)
}
fn enforce_files(paths: Vec<PathBuf>, limit: u64, protected: Option<&Path>) -> Result<(), String> {
    let mut entries: Vec<_> = paths
        .into_iter()
        .filter_map(|p| {
            std::fs::metadata(&p)
                .ok()
                .map(|m| (p, m.len(), m.modified().ok()))
        })
        .collect();
    let mut size: u64 = entries.iter().map(|e| e.1).sum();
    if size <= limit { return Ok(()); }
    entries.sort_by_key(|e| e.2);
    for (path, bytes, _) in entries {
        if size <= limit {
            break;
        }
        if protected == Some(path.as_path()) {
            continue;
        }
        std::fs::remove_file(path).map_err(|e| e.to_string())?;
        size = size.saturating_sub(bytes);
    }
    Ok(())
}
#[tauri::command]
pub async fn storage_request(
    app: tauri::AppHandle,
    operation: String,
    value: Option<Preferences>,
) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move||{
 let _lock=CACHE_LOCK.lock().map_err(|_|"缓存不可用")?;
 match operation.as_str(){
 "save"=>{let v=value.ok_or("缺少设置")?;if !(64..=8192).contains(&v.limit_mb)||v.providers.len()>8{return Err("缓存上限应为 64–8192 MB".into());}
 for p in &v.providers {let u=reqwest::Url::parse(&p.url).map_err(|_|"歌词源网址无效")?;if u.scheme()!="https"||!u.username().is_empty()||u.password().is_some()||!["lrclib","lyricsovh","netease"].contains(&p.kind.as_str()){return Err("请选择支持的歌词接口及 HTTPS 地址".into());}}
 std::fs::write(data(&app)?.join("preferences.json"),serde_json::to_vec(&v).unwrap()).map_err(|e|e.to_string())?;enforce(&app,None)?;},
 "clear"=>{for p in cache_files(&app){std::fs::remove_file(p).map_err(|e|e.to_string())?;}},
 "get"=>{},_=>return Err("未知的存储操作".into())}
 let root=cache(&app)?;let size=|p:&Path|files(p).iter().filter_map(|f|std::fs::metadata(f).ok()).map(|m|m.len()).sum::<u64>();
 let covers=OWNED[..3].iter().map(|n|size(&root.join(n))).sum::<u64>();let lyrics=size(&root.join("lyrics-v1"));
 let app_bytes=std::env::current_exe().ok().and_then(|p|p.parent()?.parent().map(Path::to_path_buf)).map(|p|size(&p)).unwrap_or(0);
 Ok(serde_json::json!({"preferences":preferences(&app),"covers":covers,"lyrics":lyrics,"cacheBytes":covers+lyrics,"dataBytes":size(&data(&app)?),"appBytes":app_bytes}))
}).await.map_err(|e|e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn budget_evicts_only_managed_files() {
        let root = std::env::temp_dir().join(format!("bee-budget-test-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let old = root.join("old");
        let current = root.join("current");
        let original = root.join("original.wav");
        std::fs::write(&old, [0u8; 100]).unwrap();
        std::fs::write(&current, [0u8; 80]).unwrap();
        std::fs::write(&original, [0u8; 200]).unwrap();
        enforce_files(vec![old.clone(), current.clone()], 100, Some(&current)).unwrap();
        assert!(!old.exists());
        assert!(current.exists());
        assert_eq!(std::fs::metadata(&original).unwrap().len(), 200);
        enforce_files(vec![current.clone()], 0, None).unwrap();
        assert!(!current.exists());
        assert!(original.exists());
        std::fs::remove_dir_all(root).unwrap();
    }
}
