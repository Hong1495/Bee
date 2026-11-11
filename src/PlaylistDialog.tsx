import {useEffect,useRef,useState} from 'react';
import type {MusicPlaylist} from './data';
export type PlaylistDialogState = {kind:'create'|'rename'|'delete'|'add';list?:MusicPlaylist;ids?:string[]};
export function PlaylistDialog({state,lists,onSave,onClose}:{state:PlaylistDialogState;lists:MusicPlaylist[];onSave:(id:string,name:string)=>Promise<void>;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [name,setName]=useState(state.kind==='rename'?state.list?.name??'':'');
 const [target,setTarget]=useState(lists[0]?.id??'');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const title=state.kind==='create'?'新建播放列表':state.kind==='rename'?'重命名播放列表':state.kind==='delete'?'删除播放列表':'添加到播放列表';
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
 const creating=state.kind==='create'||(state.kind==='add'&&!target);
 return <dialog ref={dialog} className="playlist-dialog" onCancel={e=>{e.preventDefault();if(!busy)onClose();}} aria-labelledby="playlist-dialog-title">
  <form onSubmit={e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');void onSave(target,name.trim()).then(onClose).catch(e=>setError(String(e))).finally(()=>setBusy(false));}}>
   <h2 id="playlist-dialog-title">{title}</h2>
   {state.kind==='delete'?<p>删除「{state.list?.name}」？歌曲文件和当前播放队列会保留。</p>:<>
    {state.kind==='add'&&<label>播放列表<select autoFocus value={target} disabled={busy} onChange={e=>setTarget(e.target.value)}>{lists.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}<option value="">新建播放列表…</option></select></label>}
    {(creating||state.kind==='rename')&&<label>名称<input autoFocus={state.kind!=='add'||!lists.length} value={name} maxLength={100} disabled={busy} onChange={e=>setName(e.target.value)} placeholder="播放列表名称" required/></label>}
   </>}
   {error&&<p className="settings-error" role="alert">{error}</p>}
   <footer><button type="button" disabled={busy} onClick={onClose}>取消</button><button className="dark-button" disabled={busy||((creating||state.kind==='rename')&&!name.trim())}>{busy?'正在保存…':state.kind==='delete'?'删除':state.kind==='add'?'添加':'保存'}</button></footer>
  </form>
 </dialog>;
}
