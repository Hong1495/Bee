import { useEffect,useState } from 'react';
import { invoke,isTauri } from '@tauri-apps/api/core';
import { resetArtworkSession } from './artworkCache';
import type { useMusic } from './useMusic';
type Provider={kind:string;url:string;enabled:boolean};
type Preferences={limitMb:number;lyricsEnabled:boolean;providers:Provider[]};
type Storage={preferences:Preferences;covers:number;lyrics:number;cacheBytes:number;dataBytes:number;appBytes:number};
const bytes=(value:number)=>value<1024*1024?`${(value/1024).toFixed(0)} KB`:`${(value/1024/1024).toFixed(1)} MB`;
export function MediaSettings({music,onPreferencesChanged}:{music:ReturnType<typeof useMusic>;onPreferencesChanged:()=>void}){
 const [storage,setStorage]=useState<Storage|null>(null);const [prefs,setPrefs]=useState<Preferences|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const storageAction=async(operation:string)=>{setBusy(true);setError('');try{const next=await invoke<Storage>('storage_request',{operation,value:operation==='save'?prefs:null});setStorage(next);setPrefs(old=>operation==='save'||old===null?next.preferences:old);if(operation!=='get'){resetArtworkSession();onPreferencesChanged();}}catch(e){setError(String(e));}finally{setBusy(false);}};
 useEffect(()=>{if(isTauri())void storageAction('get');},[]);
 const provider=(index:number,change:Partial<Provider>)=>setPrefs(old=>old?{...old,providers:old.providers.map((p,i)=>i===index?{...p,...change}:p)}:old);
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
   <div className="preference-row"><label htmlFor="lyrics-enabled">在线歌词</label><input id="lyrics-enabled" type="checkbox" checked={prefs.lyricsEnabled} onChange={e=>setPrefs({...prefs,lyricsEnabled:e.target.checked})}/></div>
   {prefs.providers.map((p,index)=><div className="provider-row" key={index}><input aria-label={`启用歌词源 ${index+1}`} type="checkbox" checked={p.enabled} onChange={e=>provider(index,{enabled:e.target.checked})}/><select aria-label={`歌词源 ${index+1} 接口类型`} value={p.kind} onChange={e=>provider(index,{kind:e.target.value,url:({lrclib:'https://lrclib.net',netease:'https://music.163.com',lyricsovh:'https://api.lyrics.ovh'} as Record<string,string>)[e.target.value]})}><option value="lrclib">LRCLIB</option><option value="netease">网易云</option><option value="lyricsovh">lyrics.ovh</option></select><input aria-label={`歌词源 ${index+1} 地址`} type="url" value={p.url} onChange={e=>provider(index,{url:e.target.value})}/><button disabled={index===0} aria-label={`优先使用歌词源 ${index+1}`} onClick={()=>setPrefs({...prefs,providers:prefs.providers.map((item,i)=>i===index-1?p:i===index?prefs.providers[index-1]:item)})}>↑</button><button aria-label={`移除歌词源 ${index+1}`} onClick={()=>setPrefs({...prefs,providers:prefs.providers.filter((_,i)=>i!==index)})}>移除</button></div>)}
   <div className="preference-row"><span className="preference-value">按顺序匹配，优先同步歌词</span><button disabled={prefs.providers.length>=8} onClick={()=>setPrefs({...prefs,providers:[...prefs.providers,{kind:'lrclib',url:'https://',enabled:true}]})}>添加来源</button></div>
  </div></section>
  <section className="preferences-section"><h2>储存空间</h2><div className="preferences-group">
   <div className="preference-row"><span>缓存上限</span><select aria-label="缓存上限" value={prefs.limitMb} onChange={e=>setPrefs({...prefs,limitMb:Number(e.target.value)})}>{[64,128,256,512,1024,2048,4096,8192].map(n=><option key={n} value={n}>{n>=1024?`${n/1024} GB`:`${n} MB`}</option>)}</select></div>
   {storage&&<><div className="storage-meter"><div><span>缓存 {bytes(storage.cacheBytes)}</span><span>{prefs.limitMb} MB</span></div><progress value={storage.cacheBytes} max={prefs.limitMb*1024*1024}/><small>封面 {bytes(storage.covers)} · 歌词 {bytes(storage.lyrics)}</small></div><div className="preference-row"><span>App 与设置</span><span className="preference-value">{bytes(storage.appBytes+storage.dataBytes)}</span></div></>}
   <div className="preference-row"><span>封面与歌词缓存</span><div className="setting-actions"><button disabled={busy} onClick={()=>void storageAction('get')}>刷新占用</button><button disabled={busy} onClick={()=>void storageAction('clear')}>清空缓存</button></div></div>
  </div></section>
  <div className="settings-save"><span role="status">{error}</span><button className="dark-button" disabled={busy||JSON.stringify(prefs)===JSON.stringify(storage?.preferences)} onClick={()=>void storageAction('save')}>{busy?'正在处理…':'保存设置'}</button></div></>}
  {!prefs&&error&&<p role="alert" className="settings-error">{error}</p>}
 </>;
}
