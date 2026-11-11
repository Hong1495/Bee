use crate::storage::{self, Provider};
use reqwest::{blocking::Client, Url};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{io::Read, time::Duration};
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Song { title:String, artist:String, album:String, duration:f64 }

fn normalized(value:&str)->String { value.to_lowercase().chars().filter(|c|c.is_alphanumeric()).collect() }
// Explicit artist identities, never fuzzy transliteration: a similar-looking
// name must not make a cover artist eligible for the original recording.
fn artist_key(value:&str)->String {
 let key=normalized(value);
 match key.as_str(){
  "筷子兄弟"|"chopstickbrothers"|"chopsticksbrothers"=>"chopstickbrothers".into(),
  "周杰伦"|"周杰倫"|"jaychou"=>"jaychou".into(),
  "陈奕迅"|"陳奕迅"|"easonchan"=>"easonchan".into(),
  "林俊杰"|"林俊傑"|"jjlin"=>"jjlin".into(),
  "孙燕姿"|"孫燕姿"|"stefaniesun"=>"stefaniesun".into(),
  "叶倩文"|"葉倩文"|"叶蒨文"|"葉蒨文"|"sallyyeh"=>"sallyyeh".into(),
  _=>key,
 }
}
// Only digit-by-digit runs are interchangeable (一九四三 / 1943).
// Do not reinterpret words such as 一生 or positional numerals such as 十七.
fn digit(c:char)->Option<u32>{
 c.to_digit(10).or_else(||"０１２３４５６７８９".chars().position(|n|n==c).map(|n|n as u32))
  .or_else(||"〇一二三四五六七八九".chars().position(|n|n==c).map(|n|n as u32))
  .or_else(||if c=='零'{Some(0)}else{None})
}
fn numeric_title(value:&str,chinese:bool)->String{
 let chars:Vec<_>=value.chars().collect();let mut output=String::new();let mut i=0;
 while i<chars.len(){
  if digit(chars[i]).is_none(){output.push(chars[i]);i+=1;continue;}
  let start=i;while i<chars.len()&&digit(chars[i]).is_some(){i+=1;}
  // Single full-width Arabic digits are safe; isolated Chinese digits are not.
  let unit=|c:char|"十百千万億亿萬".contains(c);
  let positional=(start>0&&unit(chars[start-1]))||(i<chars.len()&&unit(chars[i]));
  let convert=!positional&&(i-start>=2||chars[start].is_ascii_digit()||('０'..='９').contains(&chars[start]));
  for c in &chars[start..i]{if convert{let n=digit(*c).unwrap() as usize;output.push(if chinese{"〇一二三四五六七八九".chars().nth(n).unwrap()}else{char::from(b'0'+n as u8)});}else{output.push(*c);}}
 }
 output
}
fn title_variants(value:&str)->Vec<String>{
 let mut variants=Vec::new();
 for variant in [numeric_title(value,false),numeric_title(value,true)]{
  if variant!=value&&!variants.contains(&variant){variants.push(variant);}
 }
 variants
}
// Only remove release/mastering annotations. Live, remix and cover identity
// must survive normalization, even when a provider puts it in parentheses.
fn title_key(value:&str)->String {
 let mut text=value.to_lowercase();
 for (open,close) in [('(',')'),('[',']'),('（','）')] {
  let mut from=0;
  while let Some(start)=text[from..].find(open).map(|i|i+from){
   let Some(end)=text[start..].find(close).map(|i|i+start) else {break};
   let inside=&text[start..end+close.len_utf8()];
   if ["remaster","重制","重製","digitally remastered"].iter().any(|word|inside.contains(word)) {text.replace_range(start..end+close.len_utf8(),"");from=start;}else{from=end+close.len_utf8();}
  }
 }
 if let Some(start)=text.rfind(" - "){if text[start..].contains("remaster"){text.truncate(start);}}
 normalized(&numeric_title(&text,false))
}
fn score(song:&Song,title:&str,artists:&[String],album:&str,duration:f64)->Option<f64>{
 if title_key(&song.title)!=title_key(title)||song.title.trim().is_empty(){return None;}
 let wanted=artist_key(&song.artist);
 if wanted.is_empty()||!artists.iter().any(|a|artist_key(a)==wanted){return None;}
 // Do not apply a timed transcript to a materially different recording.
 if song.duration<=0.0||!duration.is_finite()||duration<=0.0{return None;}
 let delta=(duration-song.duration).abs();if delta>5.0{return None;}
 Some(100.0-delta*4.0+if normalized(&song.album)==normalized(album){10.0}else{0.0})
}
fn timed(text:&str)->bool {
 text.lines().filter(|line|line.starts_with('[')&&line.split(']').next().is_some_and(|tag|tag.contains(':')&&tag.chars().nth(1).is_some_and(|c|c.is_ascii_digit()))).take(2).count()>=2
}
fn instrumental_notice(text:&str)->bool {
 let mut found=false;
 for line in text.lines() {
  let mut content=line.trim();
  while content.starts_with('[') {if let Some(end)=content.find(']'){content=content[end+1..].trim();}else{break;}}
  let key=normalized(content);
  if key.is_empty(){continue;}
  if !matches!(key.as_str(),"纯音乐"|"純音樂"|"纯音乐请欣赏"|"純音樂請欣賞"|"此歌曲为没有填词的纯音乐请您欣赏"|"此歌曲為沒有填詞的純音樂請您欣賞"|"instrumental"|"instrumentalonly") {return false;}
  found=true;
 }
 found
}
fn result(synced:&str,plain:&str,source:&str,instrumental:bool)->Option<Value>{
 let notice=instrumental_notice(&format!("{synced}\n{plain}"));
 if notice{return Some(json!({"synced":"","plain":"","source":source,"instrumental":true}));}
 let synced=if timed(synced){synced}else{""};
 if synced.is_empty()&&plain.trim().is_empty()&&!instrumental{return None;}
 let instrumental=instrumental&&synced.is_empty()&&plain.trim().is_empty();
 Some(json!({"synced":synced,"plain":plain,"source":source,"instrumental":instrumental}))
}
fn endpoint(base:&str,path:&str)->Result<Url,String>{
 let mut u=Url::parse(base.trim_end_matches('/')).map_err(|e|e.to_string())?;
 if u.scheme()!="https"{return Err("歌词源须使用 HTTPS".into());}
 u.set_path(&format!("{}{}",u.path().trim_end_matches('/'),path));Ok(u)
}
// Reinterpret cached responses using current placeholder rules instead of
// discarding valid timed lyrics whenever presentation semantics change.
fn cached_result(value:&Value)->Option<Value>{
 result(value["synced"].as_str().unwrap_or(""),value["plain"].as_str().unwrap_or(""),value["source"].as_str().unwrap_or(""),value["instrumental"].as_bool().unwrap_or(false))
}
fn get(client:&Client,url:Url)->Result<Option<Value>,String>{
 let response=client.get(url).send().map_err(|_|"歌词源连接失败")?;
 if response.status()==reqwest::StatusCode::NOT_FOUND{return Ok(None);}
 if !response.status().is_success(){return Err(format!("歌词源返回 {}",response.status()));}
 let mut bytes=vec![];response.take(1024*1024+1).read_to_end(&mut bytes).map_err(|e|e.to_string())?;
 if bytes.len()>1024*1024{return Err("歌词响应过大".into());}
 serde_json::from_slice(&bytes).map(Some).map_err(|_|"歌词源返回格式无效".into())
}
fn lrclib(client:&Client,p:&Provider,song:&Song)->Result<Option<Value>,String>{
 let mut u=endpoint(&p.url,"/api/get")?;
 u.query_pairs_mut().append_pair("track_name",&song.title).append_pair("artist_name",&song.artist).append_pair("album_name",&song.album).append_pair("duration",&song.duration.round().to_string());
 let exact=get(client,u);let mut fallback=None;
 if let Ok(Some(data))=&exact {
  if data["duration"].as_f64().is_some_and(|d|score(song,data["trackName"].as_str().unwrap_or(""),&[data["artistName"].as_str().unwrap_or("").into()],data["albumName"].as_str().unwrap_or(""),d).is_some()){
   fallback=result(data["syncedLyrics"].as_str().unwrap_or(""),data["plainLyrics"].as_str().unwrap_or(""),"lrclib",data["instrumental"].as_bool().unwrap_or(false));
   if fallback.as_ref().is_some_and(|r|!r["synced"].as_str().unwrap_or("").is_empty()){return Ok(fallback);}
  }
 }
 let mut successes=usize::from(exact.is_ok());
 // First search is precise. A title-only query recovers records indexed under
 // the artist's English/localized name; candidates still pass identity checks.
 let variants=title_variants(&song.title);
 let mut searches=vec![(song.title.as_str(),false),(song.title.as_str(),true)];
 searches.extend(variants.iter().map(|title|(title.as_str(),true)));
 for (title,broad) in searches{
  let mut u=endpoint(&p.url,"/api/search")?;
  if broad {u.query_pairs_mut().append_pair("q",title);}else{u.query_pairs_mut().append_pair("track_name",title).append_pair("artist_name",&song.artist);}
  let search=get(client,u);if search.is_ok(){successes+=1;}
  if let Ok(Some(data))=&search{
   let mut candidates:Vec<_>=data.as_array().into_iter().flatten().filter_map(|v|score(song,v["trackName"].as_str().unwrap_or(""),&[v["artistName"].as_str().unwrap_or("").into()],v["albumName"].as_str().unwrap_or(""),v["duration"].as_f64().unwrap_or(0.0)).map(|s|(s,v))).collect();
   candidates.sort_by(|a,b|b.0.total_cmp(&a.0));
   for (_,v) in candidates {if let Some(r)=result(v["syncedLyrics"].as_str().unwrap_or(""),v["plainLyrics"].as_str().unwrap_or(""),"lrclib",v["instrumental"].as_bool().unwrap_or(false)){if !r["synced"].as_str().unwrap_or("").is_empty(){return Ok(Some(r));}if fallback.is_none(){fallback=Some(r);}}}
  }
 }
 if fallback.is_some()||successes>0{Ok(fallback)}else{Err("LRCLIB 暂时不可用".into())}
}
fn netease(client:&Client,p:&Provider,song:&Song)->Result<Option<Value>,String>{
 let mut queries=vec![format!("{} {}",song.title,song.artist),song.title.clone()];
 queries.extend(title_variants(&song.title));
 let mut seen=std::collections::HashSet::new();
 let mut successes=0;let mut lyric_failure=false;
 for query in queries {
 let mut u=endpoint(&p.url,"/api/search/get")?;
 u.query_pairs_mut().append_pair("s",&query).append_pair("type","1").append_pair("limit","30");
 let Ok(Some(data))=get(client,u) else{continue};
 if data["code"].as_i64()!=Some(200){continue;}
 successes+=1;
 let mut candidates:Vec<_>=data["result"]["songs"].as_array().into_iter().flatten().filter_map(|v|{
  let artists:Vec<_>=v["artists"].as_array().into_iter().flatten().filter_map(|a|a["name"].as_str().map(str::to_owned)).collect();
  score(song,v["name"].as_str().unwrap_or(""),&artists,v["album"]["name"].as_str().unwrap_or(""),v["duration"].as_f64().unwrap_or(0.0)/1000.0).and_then(|s|v["id"].as_u64().map(|id|(s,id)))
 }).collect();candidates.sort_by(|a,b|b.0.total_cmp(&a.0));
 for (_,id) in candidates.into_iter().filter(|(_,id)|seen.insert(*id)).take(2){
  let mut u=endpoint(&p.url,"/api/song/lyric")?;u.query_pairs_mut().append_pair("id",&id.to_string()).append_pair("lv","-1").append_pair("kv","-1").append_pair("tv","-1");
  let data=match get(client,u){Ok(Some(data))=>data,Ok(None)=>continue,Err(_)=>{lyric_failure=true;continue;}};
  if data["code"].as_i64()!=Some(200){lyric_failure=true;continue;}
  {
   // nolyric/uncollected are not reliable proof that a track is instrumental.
   if let Some(r)=result(data["lrc"]["lyric"].as_str().unwrap_or(""),"","netease",false){return Ok(Some(r));}
  }
 }
 }
 if successes==0||lyric_failure{return Err("网易云歌词查询暂不可用".into());}
 Ok(None)
}
fn fetch(client:&Client,p:&Provider,song:&Song)->Result<Option<Value>,String>{
 match p.kind.as_str(){
 "lrclib"=>lrclib(client,p,song),"netease"=>netease(client,p,song),
 "lyricsovh"=>{let mut u=endpoint(&p.url,"")?;u.path_segments_mut().map_err(|_|"歌词源网址无效")?.pop_if_empty().push("v1").push(&song.artist).push(&song.title);
  Ok(get(client,u)?.and_then(|v|result("",v["lyrics"].as_str().unwrap_or(""),"lyricsovh",false)))},
 _=>Err("未知歌词源".into())}
}
#[tauri::command]
pub async fn lyrics_request(app:tauri::AppHandle,song:Song,refresh:Option<bool>)->Result<Value,String>{
 tauri::async_runtime::spawn_blocking(move||{
  if song.title.len()>4096||song.artist.len()>4096||song.album.len()>4096||!song.duration.is_finite(){return Err("歌曲信息无效".into());}
  let prefs=storage::preferences(&app);if !prefs.lyrics_enabled{return Ok(json!({"disabled":true}));}
 let key=format!("{:x}",Sha256::digest(serde_json::to_vec(&(6,&song,&prefs.providers)).unwrap()));
  let path=storage::cache(&app)?.join("lyrics-v1").join(format!("{key}.json"));
  {let _gate=storage::CACHE_LOCK.lock().map_err(|_|"缓存不可用")?;
   if !refresh.unwrap_or(false){for version in [6,5]{
    let key=format!("{:x}",Sha256::digest(serde_json::to_vec(&(version,&song,&prefs.providers)).unwrap()));
    let candidate=path.with_file_name(format!("{key}.json"));
    if let Ok(bytes)=std::fs::read(&candidate){if let Ok(raw)=serde_json::from_slice::<Value>(&bytes){if let Some(value)=cached_result(&raw){
     let ttl=if value["synced"].as_str().is_some_and(|s|!s.is_empty()){30*86400}else{3600};
     if std::fs::metadata(&candidate).ok().and_then(|m|m.modified().ok()).and_then(|t|t.elapsed().ok()).is_some_and(|age|age.as_secs()<ttl){return Ok(value);}
    }}}
   }}
  }
  let client=Client::builder().timeout(Duration::from_secs(6)).connect_timeout(Duration::from_secs(3)).user_agent("Bee/0.1 (https://github.com/Hong1495/Bee)").build().map_err(|e|e.to_string())?;
  let mut fallback=None;let mut failures=0;let mut successes=0;
  // Query at most two sources at once, timed providers before plain fallback.
  let providers:Vec<_>=prefs.providers.iter().filter(|p|p.enabled&&p.kind!="lyricsovh").chain(prefs.providers.iter().filter(|p|p.enabled&&p.kind=="lyricsovh")).collect();
  for batch in providers.chunks(2){
   let responses=std::thread::scope(|scope|{let handles:Vec<_>=batch.iter().map(|p|{let client=&client;let song=&song;scope.spawn(move||fetch(client,p,song))}).collect();handles.into_iter().map(|h|h.join().unwrap_or_else(|_|Err("歌词查询失败".into()))).collect::<Vec<_>>()});
   let mut synced=None;
   for response in responses {match response {Ok(Some(value))=>{if !value["synced"].as_str().unwrap_or("").is_empty(){if synced.is_none(){synced=Some(value);}}else if fallback.is_none(){fallback=Some(value);}},Err(_)=>failures+=1,Ok(None)=>successes+=1}}
   if synced.is_some(){fallback=synced;break;}
  }
  if let Some(value)=fallback{let _gate=storage::CACHE_LOCK.lock().map_err(|_|"缓存不可用")?;std::fs::create_dir_all(path.parent().unwrap()).map_err(|e|e.to_string())?;std::fs::write(&path,serde_json::to_vec(&value).unwrap()).map_err(|e|e.to_string())?;storage::enforce(&app,Some(&path))?;Ok(value)}
  else if failures>0&&successes==0{Err("歌词源暂时不可用".into())}else{Ok(Value::Null)}
 }).await.map_err(|e|e.to_string())?
}
#[cfg(test)]
mod tests{
 use super::*;
 #[test]fn cached_timed_lyrics_survive_placeholder_migration(){
  let text="[00:01.00]One\n[00:05.00]Two";
  let value=cached_result(&json!({"synced":text,"plain":"","source":"netease","instrumental":false})).unwrap();
  assert_eq!(value["synced"],text);assert_eq!(value["instrumental"],false);
  let placeholder=cached_result(&json!({"synced":"[00:00.00]纯音乐，请欣赏\n[00:10.00]","source":"netease"})).unwrap();
  assert_eq!(placeholder["instrumental"],true);assert_eq!(placeholder["synced"],"");
 }
 #[test]fn sally_yeh_spelling_variants_keep_recording_checks(){
  let s=Song{title:"烛光".into(),artist:"叶倩文".into(),album:"烛光".into(),duration:249.0};
  for artist in ["叶蒨文","葉蒨文","葉倩文","Sally Yeh"]{assert!(score(&s,"烛光",&[artist.into()],"昨叶情",249.892).is_some());}
  assert!(score(&s,"烛光",&["孙耀威".into()],"",249.0).is_none());
  assert!(score(&s,"烛光",&["叶蒨文".into()],"",270.0).is_none());
 }
 #[test]
 #[ignore = "Requires provider network access"]
 fn candlelight_finds_timed_lyrics(){
  let client=Client::builder().timeout(Duration::from_secs(8)).user_agent("Bee/0.1").build().unwrap();
  let p=Provider{kind:"netease".into(),enabled:true,url:"https://music.163.com".into()};
  let s=Song{title:"烛光".into(),artist:"叶倩文".into(),album:"烛光".into(),duration:249.0};
  let value=netease(&client,&p,&s).unwrap().expect("matched original recording");
  assert!(timed(value["synced"].as_str().unwrap()));assert_eq!(value["instrumental"],false);
 }
 #[test]fn instrumental_placeholders_are_not_lyrics(){
  for text in ["[00:00.00]纯音乐，请欣赏", "[ar:久石让]\n[00:00.00]此歌曲为没有填词的纯音乐，请您欣赏\n[00:10.00]", "純音樂，請欣賞", "Instrumental"] {
   let value=result(text,"","netease",false).unwrap();
   assert_eq!(value["instrumental"],true);assert_eq!(value["synced"],"");assert_eq!(value["plain"],"");
  }
  assert_eq!(result("","纯音乐，请欣赏","lyricsovh",false).unwrap()["instrumental"],true);
  assert!(result("","","netease",false).is_none());
  assert_eq!(result("","","lrclib",true).unwrap()["instrumental"],true);
 }
 #[test]fn real_lyrics_override_instrumental_hints(){
  let words="[00:00.00]Instrumental\n[00:10.00]This is a real sung line";
  assert!(!instrumental_notice(words));
  let value=result(words,"","lrclib",true).unwrap();
  assert_eq!(value["instrumental"],false);assert_eq!(value["synced"],words);
  for text in ["未找到歌词","No lyrics found","Totoro","Instrumental love","作曲：久石让"] {assert!(!instrumental_notice(text));}
  assert!(!instrumental_notice("[ar:Artist]\n[00:00.00]\n[00:01.00]"));
  assert!(!instrumental_notice("[00:00.00]纯音乐，请欣赏\n普通歌词"));
 }
 #[test]fn numeric_title_compatibility_keeps_recording_identity(){
  let s=Song{title:"上海1943".into(),artist:"Jay Chou".into(),album:"范特西".into(),duration:195.812426};
  assert!(score(&s,"上海一九四三",&["周杰伦".into()],"范特西",196.0).is_some());
  assert_eq!(title_key("上海１９４３"),title_key("上海一九四三"));
  assert_eq!(title_key("二〇〇〇"),title_key("2000"));
  assert_eq!(title_key("二零零零"),title_key("2000"));
  assert_eq!(numeric_title("上海1943",true),"上海一九四三");
  assert_eq!(title_variants("上海一九四三"),vec!["上海1943"]);
  assert_eq!(title_variants("上海1943"),vec!["上海一九四三"]);
  assert!(title_variants("一生所爱").is_empty());
  assert_ne!(title_key("一生所爱"),title_key("1生所爱"));
  assert_ne!(title_key("十七岁"),title_key("17岁"));
  assert_ne!(title_key("上海1943"),title_key("上海1944"));
  assert!(score(&s,"上海一九四三 (Live)",&["周杰伦".into()],"范特西",196.0).is_none());
  assert!(score(&s,"上海一九四三",&["施艾敏".into()],"范特西",196.0).is_none());
  assert!(score(&s,"上海一九四三",&["周杰伦".into()],"范特西",209.0).is_none());
 }
 #[test]
 #[ignore = "Requires provider network access"]
 fn shanghai_numeric_title_finds_timed_lyrics_in_both_sources(){
  let client=Client::builder().timeout(Duration::from_secs(8)).user_agent("Bee/0.1").build().unwrap();
  let s=Song{title:"上海1943".into(),artist:"Jay Chou".into(),album:"范特西".into(),duration:195.812426};
  for (kind,url) in [("lrclib","https://lrclib.net"),("netease","https://music.163.com")] {
   let p=Provider{kind:kind.into(),enabled:true,url:url.into()};
   let value=fetch(&client,&p,&s).unwrap().expect(kind);
   assert!(timed(value["synced"].as_str().unwrap()),"{kind}");
   assert_eq!(value["source"],kind);
  }
 }
 fn song()->Song{Song{title:"父亲".into(),artist:"筷子兄弟".into(),album:"父亲".into(),duration:300.0}}
 #[test]fn reject_wrong_artist_version_and_duration(){let s=song();assert!(score(&s,"父亲",&["筷子兄弟".into()],"精选",302.0).is_some());assert!(score(&s,"父亲",&["翻唱者".into()],"父亲",300.0).is_none());assert!(score(&s,"父亲 (Live)",&["筷子兄弟".into()],"父亲",300.0).is_none());assert!(score(&s,"父亲",&["筷子兄弟".into()],"父亲",320.0).is_none());}
 #[test]fn release_annotation_is_not_recording_identity(){assert_eq!(title_key("Yesterday (2015 Remaster)"),title_key("Yesterday"));assert_eq!(title_key("父亲（重制版）"),title_key("父亲"));assert_ne!(title_key("父亲（现场版）"),title_key("父亲"));assert_ne!(title_key("Yesterday (Live)"),title_key("Yesterday"));assert_eq!(title_key("Don't Stop!"),title_key("Don’t Stop"));}
 #[test]
 #[ignore = "Requires provider network access"]
 fn live_cross_source_queries(){
  let client=Client::builder().timeout(Duration::from_secs(6)).user_agent("Bee/0.1").build().unwrap();
  let prefs=storage::Preferences::default();
  for song in [Song{title:"父亲写的散文诗".into(),artist:"许飞".into(),album:"".into(),duration:228.449},Song{title:"Yesterday".into(),artist:"The Beatles".into(),album:"".into(),duration:123.576}]{
   let r=fetch(&client,prefs.providers.iter().find(|p|p.kind=="netease").unwrap(),&song).unwrap().expect("matched recording");assert!(timed(r["synced"].as_str().unwrap()));
  }
 }
 #[test]fn bilingual_artist_identity(){let s=song();assert!(score(&s,"父亲",&["Chopstick Brothers".into()],"父亲",301.186).is_some());assert!(score(&s,"父亲",&["Chopstick Brother Cover".into()],"父亲",301.186).is_none());assert!(score(&s,"父亲",&["李健".into()],"父亲",301.186).is_none());}
 #[test]
 #[ignore = "Requires provider network access"]
 fn father_chinese_metadata_finds_english_artist(){
  let client=Client::builder().timeout(Duration::from_secs(8)).user_agent("Bee/0.1").build().unwrap();
  let p=Provider{kind:"lrclib".into(),enabled:true,url:"https://lrclib.net".into()};
  let s=Song{title:"父亲".into(),artist:"筷子兄弟".into(),album:"父亲".into(),duration:300.9578};
  let value=lrclib(&client,&p,&s).unwrap().expect("original recording");
  assert!(timed(value["synced"].as_str().unwrap()));assert_eq!(value["source"],"lrclib");
 }
 #[test]fn require_real_timestamps(){assert!(!timed("[ar:Singer]\nplain words"));assert!(timed("[00:01.00]One\n[00:04.25]Two"));assert!(result("plain words","","netease",false).is_none());}
}
