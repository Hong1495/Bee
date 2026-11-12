import { t, useLanguage } from './i18n';
import {useEffect,useRef,useState} from 'react';
import type {MusicPlaylist} from './data';
export type PlaylistDialogState = {kind:'create'|'rename'|'delete'|'add';list?:MusicPlaylist;ids?:string[]};
export function PlaylistDialog({state,lists,onSave,onClose}:{state:PlaylistDialogState;lists:MusicPlaylist[];onSave:(id:string,name:string)=>Promise<void>;onClose:()=>void}){
  useLanguage();
 const dialog=useRef<HTMLDialogElement>(null);
 const [name,setName]=useState(state.kind==='rename'?state.list?.name??'':'');
 const [target,setTarget]=useState(lists[0]?.id??'');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const title=state.kind==='create'?t("新建播放列表"):state.kind==='rename'?t("重命名播放列表"):state.kind==='delete'?t("删除播放列表"):t("添加到播放列表");
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
 const creating=state.kind==='create'||(state.kind==='add'&&!target);
 return <dialog ref={dialog} className="playlist-dialog" onCancel={e=>{e.preventDefault();if(!busy)onClose();}} aria-labelledby="playlist-dialog-title">
  <form onSubmit={e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');void onSave(target,name.trim()).then(onClose).catch(e=>setError(String(e))).finally(()=>setBusy(false));}}>
   <h2 id="playlist-dialog-title">{title}</h2>
   {state.kind==='delete'?<p>{t("删除「{0}」？歌曲文件和当前播放队列会保留。", state.list?.name)}</p>:<>
    {state.kind==='add'&&<label>{t("播放列表")}<select autoFocus value={target} disabled={busy} onChange={e=>setTarget(e.target.value)}>{lists.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}<option value="">{t("新建播放列表…")}</option></select></label>}
    {(creating||state.kind==='rename')&&<label>{t("名称")}<input autoFocus={state.kind!=='add'||!lists.length} value={name} maxLength={100} disabled={busy} onChange={e=>setName(e.target.value)} placeholder={t("播放列表名称")} required/></label>}
   </>}
   {error&&<p className="settings-error" role="alert">{error}</p>}
   <footer><button type="button" disabled={busy} onClick={onClose}>{t("取消")}</button><button className="dark-button" disabled={busy||((creating||state.kind==='rename')&&!name.trim())}>{busy?t("正在保存…"):state.kind==='delete'?t("删除"):state.kind==='add'?t("添加"):t("保存")}</button></footer>
  </form>
 </dialog>;
}
