import { t, useLanguage } from './i18n';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {Album} from './data';
export function PlaylistSongs({albums,existing,onSave,onClose}:{albums:Album[];existing:string[];onSave:(ids:string[])=>Promise<void>;onClose:()=>void}){
  useLanguage();
 const dialog=useRef<HTMLDialogElement>(null);
 const [query,setQuery]=useState(''),[selected,setSelected]=useState<Set<string>>(new Set());
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const present=useMemo(()=>new Set(existing),[existing]);
 const songs=useMemo(()=>albums.flatMap(album=>album.tracks.map(track=>({id:track.id,title:track.title,artist:track.artist||album.artist,album:album.title}))),[albums]);
 const matches=useMemo(()=>{const q=query.trim().toLocaleLowerCase();return songs.filter(s=>`${s.title} ${s.artist} ${s.album}`.toLocaleLowerCase().includes(q));},[songs,query]);
 // Bound DOM work for large libraries; search covers the entire library.
 const [limit,setLimit]=useState(100);
 useEffect(()=>setLimit(100),[query]);
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
 return <dialog ref={dialog} className="playlist-dialog song-picker" onCancel={e=>{e.preventDefault();if(!busy)onClose();}} aria-labelledby="song-picker-title"><form onSubmit={e=>{e.preventDefault();if(!selected.size||busy)return;setBusy(true);void onSave([...selected]).then(onClose).catch(e=>setError(String(e))).finally(()=>setBusy(false));}}>
  <h2 id="song-picker-title">{t("添加歌曲")}</h2><input autoFocus type="search" aria-label={t("搜索歌曲、艺术家或专辑")} placeholder={t("搜索歌曲、艺术家或专辑")} value={query} onChange={e=>setQuery(e.target.value)}/>
  <div className="song-picker-results">{matches.slice(0,limit).map(song=><label key={song.id} className="song-picker-row"><input type="checkbox" disabled={busy||present.has(song.id)} checked={present.has(song.id)||selected.has(song.id)} onChange={e=>setSelected(old=>{const next=new Set(old);if(e.target.checked)next.add(song.id);else next.delete(song.id);return next;})}/><span>{song.title}<small>{song.artist} · {song.album}</small></span>{present.has(song.id)&&<small>{t("已添加")}</small>}</label>)}{!matches.length&&<p>{t("没有匹配的歌曲")}</p>}{matches.length>limit&&<button type="button" onClick={()=>setLimit(n=>n+100)}>{t("显示更多")}</button>}</div>
  {error&&<p role="alert" className="settings-error">{error}</p>}<footer><button type="button" disabled={busy} onClick={onClose}>{t("取消")}</button><button className="dark-button" disabled={busy||!selected.size}>{busy?t("正在添加…"):t("添加{0}", selected.size?t(" {0} 首", selected.size):'')}</button></footer>
 </form></dialog>;
}
