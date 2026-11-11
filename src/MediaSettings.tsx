import { useEffect,useRef,useState } from 'react';
import { invoke,isTauri } from '@tauri-apps/api/core';
import { resetArtworkSession } from './artworkCache';
import type { useMusic } from './useMusic';
import { preferenceSaveQueue,validProviderUrl } from './preferenceSaveQueue';
type Provider={kind:string;url:string;enabled:boolean};
type Preferences={limitMb:number;lyricsEnabled:boolean;providers:Provider[]};
type Storage={preferences:Preferences;covers:number;lyrics:number;cacheBytes:number;dataBytes:number;appBytes:number};
const writePreferences=preferenceSaveQueue((value:Preferences)=>invoke<Storage>('storage_request',{operation:'save',value}));
const bytes=(value:number)=>value<1024*1024?`${(value/1024).toFixed(0)} KB`:`${(value/1024/1024).toFixed(1)} MB`;
export function MediaSettings({music,onPreferencesChanged}:{music:ReturnType<typeof useMusic>;onPreferencesChanged:()=>void}){
 const [storage,setStorage]=useState<Storage|null>(null);const [prefs,setPrefs]=useState<Preferences|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const [saveError,setSaveError]=useState('');const [saving,setSaving]=useState(false);
 const current=useRef<Preferences|null>(null),revision=useRef(0),mounted=useRef(true);
 const changed=useRef(onPreferencesChanged);changed.current=onPreferencesChanged;
 const save=(next:Preferences)=>{
  current.current=next;setPrefs(next);setSaving(true);setSaveError('');
  const token=++revision.current;
  void writePreferences(next).then(result=>{
   changed.current();
   if(mounted.current&&token===revision.current){setStorage(result);setSaving(false);}
  }).catch(e=>{if(mounted.current&&token===revision.current){setSaveError(`未能自动保存：${String(e)}`);setSaving(false);}});
 };
 const update=(change:(old:Preferences)=>Preferences)=>{if(current.current)save(change(current.current));};
 const storageAction=async(operation:string)=>{setBusy(true);setError('');try{
  await writePreferences.idle();
  const next=await invoke<Storage>('storage_request',{operation,value:null});
  if(!mounted.current)return;
  setStorage(next);
  if(current.current===null){current.current=next.preferences;setPrefs(next.preferences);}
  if(operation==='clear'){resetArtworkSession();changed.current();}
 }catch(e){if(mounted.current)setError(String(e));}finally{if(mounted.current)setBusy(false);}};
 useEffect(()=>{mounted.current=true;if(isTauri())void storageAction('get');return()=>{mounted.current=false;};},[]);
 const provider=(index:number,change:Partial<Provider>)=>update(old=>({...old,providers:old.providers.map((p,i)=>i===index?{...p,...change}:p)}));
 return <>
  <section className="preferences-section"><h2>音乐库</h2><div className="preferences-group">
   <div className="preference-row"><label htmlFor="library-source">当前音乐库</label><select id="library-source" value={music.source} disabled={music.busy||music.folderBusy||music.transportBusy} onChange={e=>void music.selectLibrary(e.target.value as 'music'|'local')}><option value="music">Apple Music</option><option value="local">本地文件夹</option></select></div>
   {music.source==='music'?<div className="preference-row"><span>Apple Music<small className="setting-detail">本机“音乐”App 中的本地及订阅歌曲</small></span><div className="setting-actions"><button disabled={music.busy} onClick={()=>void music.connect()}>{music.busy?'正在读取…':music.musicConnected?'刷新':'连接'}</button>{music.musicConnected&&<button disabled={music.busy||music.transportBusy} onClick={()=>void music.disconnect()}>断开</button>}</div></div>:<>
    {music.folders.map(folder=><div className="preference-row folder-row" key={folder.id}><span title={folder.path}>{folder.name}<small className="setting-detail">{folder.path}</small></span><button disabled={music.folderBusy} onClick={()=>void music.updateFolders('remove',folder.id)} aria-label={`移除 ${folder.name}`}>移除</button></div>)}
    <div className="preference-row"><span>{music.folderBusy?'正在读取文件…':`${music.folders.length} 个文件夹`}</span><div className="setting-actions"><button disabled={music.folderBusy} onClick={()=>void music.updateFolders('add')}>添加文件夹…</button><button disabled={music.folderBusy||!music.folders.length} onClick={()=>void music.updateFolders()}>重新扫描</button></div></div>
   </>}
  </div>
  {music.error&&<p className="settings-error" role="alert">{music.error}</p>}{music.source==='local'&&music.folderWarnings.length>0&&<details className="scan-warnings"><summary>{music.folderWarnings.length} 项读取提示</summary>{music.folderWarnings.slice(0,30).map((text,i)=><p key={i}>{text}</p>)}</details>}
  </section>
  {prefs&&<><section className="preferences-section"><h2>歌词</h2><div className="preferences-group">
   <div className="preference-row"><label htmlFor="lyrics-enabled">在线歌词</label><input id="lyrics-enabled" type="checkbox" checked={prefs.lyricsEnabled} onChange={e=>update(old=>({...old,lyricsEnabled:e.target.checked}))}/></div>
   {prefs.providers.map((p,index)=><div className="provider-row" key={index}><input aria-label={`启用歌词源 ${index+1}`} type="checkbox" checked={p.enabled} onChange={e=>provider(index,{enabled:e.target.checked})}/><select aria-label={`歌词源 ${index+1} 接口类型`} value={p.kind} onChange={e=>provider(index,{kind:e.target.value,url:({lrclib:'https://lrclib.net',netease:'https://music.163.com',lyricsovh:'https://api.lyrics.ovh'} as Record<string,string>)[e.target.value]})}><option value="lrclib">LRCLIB</option><option value="netease">网易云</option><option value="lyricsovh">lyrics.ovh</option></select><ProviderAddress key={`${index}:${p.kind}`} label={`歌词源 ${index+1} 地址`} value={p.url} onCommit={url=>provider(index,{url})}/><button disabled={index===0} aria-label={`优先使用歌词源 ${index+1}`} onClick={()=>update(old=>({...old,providers:old.providers.map((item,i)=>i===index-1?old.providers[index]:i===index?old.providers[index-1]:item)}))}>↑</button><button aria-label={`移除歌词源 ${index+1}`} onClick={()=>update(old=>({...old,providers:old.providers.filter((_,i)=>i!==index)}))}>移除</button></div>)}
   <div className="preference-row"><span className="preference-value">按顺序匹配，优先同步歌词</span><button disabled={prefs.providers.length>=8} onClick={()=>update(old=>({...old,providers:[...old.providers,{kind:'lrclib',url:'https://lrclib.net',enabled:true}]}))}>添加来源</button></div>
  </div></section>
  <section className="preferences-section"><h2>储存空间</h2><div className="preferences-group">
   <div className="preference-row"><span>缓存上限</span><select aria-label="缓存上限" value={prefs.limitMb} onChange={e=>update(old=>({...old,limitMb:Number(e.target.value)}))}>{[64,128,256,512,1024,2048,4096,8192].map(n=><option key={n} value={n}>{n>=1024?`${n/1024} GB`:`${n} MB`}</option>)}</select></div>
   {storage&&<><div className="storage-meter"><div><span>缓存 {bytes(storage.cacheBytes)}</span><span>{prefs.limitMb} MB</span></div><progress value={storage.cacheBytes} max={prefs.limitMb*1024*1024}/><small>封面 {bytes(storage.covers)} · 歌词 {bytes(storage.lyrics)}</small></div><div className="preference-row"><span>App 与设置</span><span className="preference-value">{bytes(storage.appBytes+storage.dataBytes)}</span></div></>}
   <div className="preference-row"><span>封面与歌词缓存</span><div className="setting-actions"><button disabled={busy} onClick={()=>void storageAction('get')}>刷新占用</button><button disabled={busy} onClick={()=>void storageAction('clear')}>清空缓存</button></div></div>
  </div></section>
  {saving&&<p className="preferences-note" role="status">正在保存…</p>}
  {saveError&&<p className="settings-error" role="alert">{saveError} <button onClick={()=>{if(current.current)save(current.current);}}>重试</button></p>}</>}
  {error&&<p role="alert" className="settings-error">{error}</p>}
 </>;
}

// Keep incomplete addresses local to the field; they must not block other settings.
function ProviderAddress({label,value,onCommit}:{label:string;value:string;onCommit:(url:string)=>void}){
 const [draft,setDraft]=useState(value),[invalid,setInvalid]=useState(false);
 useEffect(()=>{setDraft(value);setInvalid(false);},[value]);
 const commit=()=>{
  const url=draft.trim();
  if(!validProviderUrl(url)){setInvalid(true);return;}
  setInvalid(false);setDraft(url);if(url!==value)onCommit(url);
 };
 return <span className="provider-address"><input aria-label={label} aria-invalid={invalid} type="url" value={draft} onChange={e=>{setDraft(e.target.value);setInvalid(false);}} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit();}if(e.key==='Escape'){setDraft(value);setInvalid(false);}}}/>{invalid&&<small role="alert">请输入有效的 HTTPS 地址</small>}</span>;
}
