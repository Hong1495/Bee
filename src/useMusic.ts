import { t } from './i18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { readPlayback,savePlayback,restorePlayback } from './playbackSession';
import { resetArtworkSession } from './artworkCache';
import { albumKey, groupAlbums, type Album, type MusicPlaylist, type MusicTrack } from './data';
export type PlaybackPosition = { trackId:string; seconds:number; duration:number; playing:boolean; sampledAt:number };
export type QueueState = {name:string; tracks:MusicTrack[]; index:number};
export type Folder = {id:string;name:string;path:string};
type Library = {tracks:MusicTrack[];playlists:MusicPlaylist[]};
type LocalLibrary = Library & {folders:Folder[];warnings:string[]};
type Snapshot = {running:boolean;playing:boolean;track:MusicTrack|null};
function sameTrack(a:MusicTrack|null,b:MusicTrack|null) {
 if(a===b)return true;if(!a||!b)return false;
 return a.id===b.id&&a.source===b.source&&a.title===b.title&&a.duration===b.duration&&a.artist===b.artist&&a.albumArtist===b.albumArtist&&a.album===b.album&&a.year===b.year&&a.genre===b.genre&&a.disc===b.disc&&a.number===b.number&&a.added===b.added;
}
const emptyLibrary:Library={tracks:[],playlists:[]};
const request = <T,>(operation:string, id?:string) => invoke<T>('music_request', {operation,id:id??null});
const local = <T,>(operation:string,id?:string) => invoke<T>('local_request',{operation,id:id??null});
export type PlaylistEdit = {operation:'create'|'rename'|'delete'|'add'|'remove'|'move';id:string;name?:string;trackIds?:string[];beforeId?:string};
export function useMusic() {
 const [customLists,setCustomLists]=useState<MusicPlaylist[]>([]);
 const [listsReady,setListsReady]=useState(false);
 const edits=useRef<Promise<unknown>>(Promise.resolve());
 const [source,setSource]=useState<'music'|'local'>(()=>localStorage.getItem('bee-library-source')==='local'?'local':'music');
 const sourceRef=useRef(source);
 const [initialSession]=useState(readPlayback);
 const saved=useRef(initialSession);const awaitingResume=useRef(false);const lastSave=useRef(0);
 const [library,setLibrary]=useState<Library>(emptyLibrary);
 const [localLibrary,setLocalLibrary]=useState<LocalLibrary>({...emptyLibrary,folders:[],warnings:[]});
 const [musicConnected,setMusicConnected]=useState(false);
 const [busy,setBusy]=useState(false);const [folderBusy,setFolderBusy]=useState(false);const [error,setError]=useState('');
 const [snapshot,setSnapshot]=useState<Snapshot>({running:false,playing:false,track:null});
 const current=useRef(snapshot);const connectedRef=useRef(false);
 const position=useRef<PlaybackPosition>({trackId:'',seconds:0,duration:0,playing:false,sampledAt:0});
 const [queue,setQueue]=useState<QueueState>({name:'',tracks:[],index:-1});const queueRef=useRef(queue);
 const persistedTracks=useRef<MusicTrack[]|null>(null);const persistedIds=useRef<string[]>([]);
 const [transportBusy,setTransportBusy]=useState(false);const lock=useRef(false);const epoch=useRef(0);const polling=useRef(false);const completed=useRef(false);
 const persist=useCallback((force=false)=>{
  if(saved.current)return;
  const now=performance.now();if(!force&&now-lastSave.current<3000)return;lastSave.current=now;
  const q=queueRef.current,p=position.current;
  if(persistedTracks.current!==q.tracks){persistedTracks.current=q.tracks;persistedIds.current=q.tracks.map(t=>t.id);}
  savePlayback(q.tracks.length?{version:1,source:sourceRef.current,name:q.name,ids:persistedIds.current,index:q.index,seconds:Math.min(p.duration||Infinity,p.seconds+(p.playing?(now-p.sampledAt)/1000:0))}:null);
 },[]);
 const publish=useCallback((next:Snapshot,seconds=0)=>{current.current=next;position.current={trackId:next.track?.id??'',seconds,duration:next.track?.duration??0,playing:next.playing,sampledAt:performance.now()};setSnapshot(old=>old.running===next.running&&old.playing===next.playing&&sameTrack(old.track,next.track)?old:next);persist(!next.playing);},[persist]);
 const replaceQueue=useCallback((next:QueueState)=>{queueRef.current=next;setQueue(next);},[]);
 const restore=useCallback((available:MusicTrack[])=>{
  const session=saved.current;if(!session)return;saved.current=null;
  if(session.source!==sourceRef.current){persist(true);return;}
  const restored=restorePlayback(session,available);replaceQueue(restored.queue);
  const song=restored.queue.tracks[restored.queue.index];awaitingResume.current=!!song;
  publish({running:false,playing:false,track:song??null},restored.seconds);
 },[replaceQueue,publish,persist]);
 useEffect(()=>{const save=()=>persist(true);window.addEventListener('bee-before-update',save);window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',save);return()=>{save();window.removeEventListener('bee-before-update',save);window.removeEventListener('pagehide',save);document.removeEventListener('visibilitychange',save);};},[persist]);
 const tracks=useMemo(()=>source==='music'?library.tracks:localLibrary.tracks,[source,library,localLibrary]);
 const lookup=useMemo(()=>new Map(tracks.map(t=>[t.id,t])),[tracks]);
 useEffect(()=>{
  if(!isTauri())return;
  let active=true;
  void invoke<MusicPlaylist[]>('playlist_request',{change:{operation:'list',source:'music'}}).then(lists=>{if(active){setCustomLists(lists);setListsReady(true);}}).catch(e=>{if(active)setError(String(e));});
  return()=>{active=false;};
 },[]);
 const editPlaylist=useCallback((change:PlaylistEdit)=>{
  const editSource=sourceRef.current;
  const task=edits.current.catch(()=>{}).then(async()=>{
   const lists=await invoke<MusicPlaylist[]>('playlist_request',{change:{...change,source:editSource}});
   setCustomLists(lists);
  });
  edits.current=task;
  return task;
 },[]);
 const playlists=useMemo(()=>[...(source==='music'?library.playlists:localLibrary.playlists),...customLists.filter(p=>p.source===source)],[source,library,localLibrary,customLists]);
 const albums=useMemo(()=>groupAlbums(tracks),[tracks]);
 const start=useCallback(async(next:QueueState,seconds=0)=>{
  const song=next.tracks[next.index];if(!song)return;
  if(song.source==='local') {if(connectedRef.current)await request('pause');await invoke('local_request',{operation:'play',id:song.id,seconds});}
  else {await local('pause');await invoke('music_request',{operation:'play',id:song.id,trackIds:[song.id],sourceName:next.name});if(seconds>0)await invoke('music_seek',{seconds});}
  saved.current=null;awaitingResume.current=false;completed.current=false;replaceQueue(next);publish({running:true,playing:true,track:song},seconds);persist(true);
 },[publish,replaceQueue,persist]);
 const control=useCallback(async(operation:()=>Promise<unknown>)=>{
  if(lock.current)return;lock.current=true;epoch.current++;setTransportBusy(true);setError('');
  try{await operation();}catch(e){setError(String(e));}finally{lock.current=false;setTransportBusy(false);}
 },[]);
 const refreshStatus=useCallback(async()=>{
  if(lock.current||polling.current||awaitingResume.current)return;polling.current=true;const token=epoch.current;
  try{
   const prev=current.current;const oldPos=position.current;
   let next:Snapshot;let seconds=0;let ended=false;
   if(prev.track?.source==='local') {const data=await local<{playing:boolean;ended:boolean;position:number}>('status');next={...prev,playing:data.playing};seconds=data.position;ended=data.ended&&prev.playing;}
   else {
    if(sourceRef.current!=='music'||!connectedRef.current)return;
    const data=await request<Snapshot&{position:number;unchanged?:boolean}>('status',prev.track?.id);
    if(data.unchanged)data.track=prev.track;
    const projected=oldPos.seconds+(performance.now()-oldPos.sampledAt)/1000;
    ended=data.running&&!data.track&&prev.playing&&oldPos.duration>0&&projected>=oldPos.duration-2;
    next={running:data.running,playing:data.playing,track:data.track??(queueRef.current.tracks.length?prev.track:null)};seconds=data.track?data.position:ended?oldPos.duration:oldPos.seconds;
   }
   if(token!==epoch.current)return;
   const q=queueRef.current;
   if(ended&&q.tracks[q.index]?.id===prev.track?.id){
    if(q.index+1<q.tracks.length){publish({...prev,playing:false},oldPos.duration);await control(()=>start({...q,index:q.index+1}));return;}
    completed.current=true;
   }else if(next.track&&q.tracks.length&&next.track.id!==q.tracks[q.index]?.id){replaceQueue({name:'',tracks:[],index:-1});}
   publish(next,Number.isFinite(seconds)?Math.max(0,seconds):0);
  }catch(e){if(token===epoch.current)setError(String(e));}finally{polling.current=false;}
 },[publish,replaceQueue,start,control]);
 const connect=useCallback(async()=>{
  if(sourceRef.current!=='music')return;
  if(!isTauri()){setError(t("请在 Bee macOS App 中连接“音乐”。"));return;}
  setBusy(true);setError('');try{await request('connect');const data=await request<Library>('library');setLibrary(data);setMusicConnected(true);connectedRef.current=true;localStorage.setItem('bee-music-reconnect','true');restore(data.tracks);resetArtworkSession();}catch(e){setError(String(e));}finally{setBusy(false);}
 },[restore]);
 const disconnect=useCallback(async()=>{
  saved.current=null;awaitingResume.current=false;localStorage.removeItem('bee-music-reconnect');
  if(connectedRef.current&&current.current.track?.source!=='local'){try{await request('pause');}catch(e){setError(String(e));return;}}
  if(current.current.track?.source!=='local'){epoch.current++;replaceQueue({name:'',tracks:[],index:-1});publish({running:false,playing:false,track:null});}
  connectedRef.current=false;setMusicConnected(false);setLibrary(emptyLibrary);resetArtworkSession();await request('disconnect').catch(e=>setError(String(e)));
 },[publish,replaceQueue]);
 const folders=useCallback(async(operation='scan',id?:string)=>{
  if(sourceRef.current!=='local')return;
  setFolderBusy(true);setError('');try{const data=await local<LocalLibrary|null>(operation,id);if(data){if(current.current.track?.source==='local'&&!data.tracks.some(t=>t.id===current.current.track?.id)){epoch.current++;await local('pause');replaceQueue({name:'',tracks:[],index:-1});publish({running:false,playing:false,track:null});}else if(current.current.track?.source==='local'){const q=queueRef.current;const available=new Set(data.tracks.map(t=>t.id));const before=q.tracks.slice(0,q.index).filter(t=>available.has(t.id));const after=q.tracks.slice(q.index).filter(t=>available.has(t.id));replaceQueue({...q,tracks:[...before,...after],index:before.length});}setLocalLibrary(data);restore(data.tracks);resetArtworkSession();}}catch(e){setError(String(e));}finally{setFolderBusy(false);}
 },[publish,replaceQueue,restore]);
 useEffect(()=>{if(!isTauri())return;if(sourceRef.current==='local')void folders();else if(localStorage.getItem('bee-music-reconnect')==='true'||saved.current?.source==='music')void connect();},[folders,connect]);
 const selectLibrary=useCallback(async(next:'music'|'local')=>{
  if(next===sourceRef.current||lock.current)return;
  await control(async()=>{
   saved.current=null;awaitingResume.current=false;
   if(current.current.track?.source==='local')await local('pause');else if(connectedRef.current)await request('pause');
   if(connectedRef.current){await request('disconnect');connectedRef.current=false;setMusicConnected(false);}
   replaceQueue({name:'',tracks:[],index:-1});publish({running:false,playing:false,track:null});
   sourceRef.current=next;setSource(next);localStorage.setItem('bee-library-source',next);resetArtworkSession();
   if(next==='local')await folders();else await connect();
  });
 },[control,replaceQueue,publish,folders,connect]);
 // Queue advancement must keep running while hidden. The main WebView disables
 // background suspension on macOS 14+; only visual updates use document.hidden.
 useEffect(()=>{let stopped=false;let timer:ReturnType<typeof setTimeout>;const poll=async()=>{await refreshStatus();if(!stopped)timer=setTimeout(poll,800);};void poll();return()=>{stopped=true;clearTimeout(timer);};},[refreshStatus]);
 const loadPlaylist=useCallback(async(id:string)=>{const list=playlists.find(p=>p.id===id);return list?.managed||list?.source==='local'?list.trackIds??[]:request<string[]>('playlist',id);},[playlists]);
 const playTrack=useCallback((record:Album,index:number,only=false)=>control(async()=>{const songs=record.tracks.flatMap(t=>lookup.get(t.id)?[lookup.get(t.id)!]:[]);await start({name:only?record.tracks[index].title:record.title,tracks:only?[songs[index]]:songs,index:only?0:index});}),[control,lookup,start]);
 const playAlbum=useCallback((record:Album)=>playTrack(record,0),[playTrack]);
 const playPlaylist=useCallback((id:string,songId?:string)=>control(async()=>{const ids=await loadPlaylist(id);const songs=ids.flatMap(key=>lookup.get(key)?[lookup.get(key)!]:[]);await start({name:playlists.find(p=>p.id===id)?.name??'',tracks:songs,index:songId?Math.max(0,songs.findIndex(s=>s.id===songId)):0});}),[control,loadPlaylist,lookup,playlists,start]);
 const toggle=useCallback(()=>control(async()=>{
  const s=current.current;if(!s.track)return;
  if(awaitingResume.current){await start(queueRef.current,position.current.seconds);return;}
  if(completed.current){await start(queueRef.current);return;}
  if(s.track.source==='local')await local('toggle');else await request('toggle');
  const p=position.current;publish({...s,playing:!s.playing},p.seconds+(s.playing?(performance.now()-p.sampledAt)/1000:0));
 }),[control,start,publish]);
 const skip=useCallback((direction:'previous'|'next')=>control(async()=>{const q=queueRef.current;const index=q.index+(direction==='next'?1:-1);if(index>=0&&index<q.tracks.length)await start({...q,index});}),[control,start]);
 const jump=useCallback((index:number)=>control(()=>start({...queueRef.current,index})),[control,start]);
 const albumIndex=useMemo(()=>new Map(albums.map(a=>[a.id,a])),[albums]);
 const currentAlbum=useMemo(()=>snapshot.track?albumIndex.get(albumKey(snapshot.track))??groupAlbums([snapshot.track])[0]:undefined,[snapshot.track,albumIndex]);
 return {source,selectLibrary,editPlaylist,listsReady,queue,jump,transportBusy,canPrevious:queue.index>0,canNext:queue.index>=0&&queue.index+1<queue.tracks.length,position,albums,playlists,connected:source==='music'?musicConnected:localLibrary.folders.length>0,musicConnected,busy,error,setError,connect,disconnect,playAlbum,playTrack,playPlaylist,toggle,skip,loadPlaylist,currentAlbum,currentId:snapshot.track?albumKey(snapshot.track):'',track:snapshot.track,playing:snapshot.playing,running:snapshot.running,folders:localLibrary.folders,folderWarnings:localLibrary.warnings,folderBusy,updateFolders:folders};
}
