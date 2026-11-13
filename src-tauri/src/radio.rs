use serde::Serialize;
use std::{io::Read, time::Duration};

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NowPlaying { title: String, credit: Option<String> }

fn parse_metadata(block: &[u8], station: &str) -> Option<NowPlaying> {
    let text = std::str::from_utf8(block).ok()?.trim_end_matches('\0');
    let start = text.find("StreamTitle='")? + "StreamTitle='".len();
    let rest = &text[start..];
    let end = rest.find("';StreamUrl=").or_else(|| rest.rfind("';"))?;
    let raw = rest[..end].trim();
    if raw.is_empty() || raw.chars().any(char::is_control) { return None; }
    // YourClassical's quoted format separates the work from supplied credits.
    // The general channel also sends Work-Composer. Only split an unambiguous
    // single separator and a name-like credit; multiple hyphens remain intact.
    let (title, credit) = if let Some(quoted) = raw.strip_prefix('"') {
        if let Some((title, credit)) = quoted.split_once("\" - ") {
            (title.trim(), Some(credit.trim().trim_end_matches('-').trim()))
        } else { (raw, None) }
    } else if station == "ycradio" && raw.matches('-').count() == 1 {
        let (title, credit) = raw.split_once('-')?;
        let credit = credit.trim();
        if !title.trim().is_empty() && credit.split_whitespace().count() >= 2
            && credit.chars().all(|c| c.is_alphabetic() || c.is_whitespace() || ".'’".contains(c)) {
            (title.trim(), Some(credit))
        } else { (raw, None) }
    } else { (raw, None) };
    if title.is_empty() { return None; }
    Some(NowPlaying { title: title.chars().take(300).collect(), credit: credit.filter(|s| !s.is_empty()).map(|s| s.chars().take(400).collect()) })
}

#[tauri::command]
pub async fn radio_now_playing(station: String) -> Result<Option<NowPlaying>, String> {
    if !["ycradio", "peacefulpiano", "chambermusic", "relax"].contains(&station.as_str()) {
        return Err("Unknown radio station".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let client = reqwest::blocking::Client::builder()
            .http1_only().user_agent("Bee/0.1 radio metadata")
            .connect_timeout(Duration::from_secs(4)).timeout(Duration::from_secs(10))
            .redirect(reqwest::redirect::Policy::none()).build().map_err(|e| e.to_string())?;
        let mut response = client.get(format!("https://{station}.stream.publicradio.org/{station}.aac"))
            .header("Icy-MetaData", "1").send().and_then(|r| r.error_for_status()).map_err(|e| e.to_string())?;
        let Some(interval) = response.headers().get("icy-metaint").and_then(|h| h.to_str().ok()).and_then(|h| h.parse::<usize>().ok()).filter(|n| (1..=65536).contains(n)) else { return Ok(None); };
        let mut audio = vec![0; interval];
        let mut consumed = 0;
        // A short bounded probe, never a second persistent audio connection.
        while consumed + interval + 1 <= 131072 {
            response.read_exact(&mut audio).map_err(|e| e.to_string())?;
            let mut size = [0]; response.read_exact(&mut size).map_err(|e| e.to_string())?;
            let mut block = vec![0; size[0] as usize * 16];
            response.read_exact(&mut block).map_err(|e| e.to_string())?;
            consumed += interval + 1 + block.len();
            if !block.is_empty() {
                return Ok(parse_metadata(&block, &station));
            }
        }
        Ok(None)
    }).await.map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "requires live radio network"]
    fn live_metadata_probe() {
        let mut found = 0;
        for station in ["ycradio", "peacefulpiano", "chambermusic", "relax"] {
            let value = tauri::async_runtime::block_on(radio_now_playing(station.into())).unwrap();
            println!("{station}: {value:?}");
            if value.is_some() { found += 1; }
        }
        assert!(found > 0, "no channel supplied metadata in this live sample");
    }
    #[test]
    fn quoted_work_and_credits() {
        let song = parse_metadata(b"StreamTitle='\"Oboe Concerto No. 2: 2nd movement\" - Ludwig Lebrun - Potsdam Chamber Academy';StreamUrl='id.mp3';\0", "peacefulpiano").unwrap();
        assert_eq!(song.title, "Oboe Concerto No. 2: 2nd movement");
        assert_eq!(song.credit.as_deref(), Some("Ludwig Lebrun - Potsdam Chamber Academy"));
        assert_eq!(parse_metadata(b"StreamTitle='\"Energy Flow\" - Ryuichi Sakamoto -';", "peacefulpiano").unwrap().credit.as_deref(), Some("Ryuichi Sakamoto"));
    }
    #[test]
    fn ambiguous_and_missing_metadata() {
        let general = parse_metadata(b"StreamTitle='The River-Virgil Thomson';StreamUrl='';", "ycradio").unwrap();
        assert_eq!(general.title, "The River");
        assert_eq!(general.credit.as_deref(), Some("Virgil Thomson"));
        assert_eq!(parse_metadata(b"StreamTitle='Symphony No. 3-Camille Saint-Saens';", "ycradio").unwrap().title, "Symphony No. 3-Camille Saint-Saens");
        assert_eq!(parse_metadata(b"StreamTitle='The River-Virgil Thomson';", "relax").unwrap().title, "The River-Virgil Thomson");
        assert!(parse_metadata(b"StreamTitle='';", "peacefulpiano").is_none());
        assert!(parse_metadata(b"StreamUrl='recording.mp3';", "peacefulpiano").is_none());
        assert!(parse_metadata(b"StreamTitle='bad\ntext';", "peacefulpiano").is_none());
        assert_eq!(parse_metadata(b"StreamTitle='\"L'amour\" - Composer -';", "peacefulpiano").unwrap().title, "L'amour");
    }
}
