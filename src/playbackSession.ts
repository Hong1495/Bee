import type { MusicTrack } from './data';
export type SavedPlayback={version:1;source:'music'|'local';name:string;ids:string[];index:number;seconds:number};
const key='bee-playback-session';
export function readPlayback():SavedPlayback|null {
 try {const s=JSON.parse(localStorage.getItem(key)||'null');
  if(!s||s.version!==1||!['music','local'].includes(s.source)||!Array.isArray(s.ids)||s.ids.length>100000||!s.ids.every((id:unknown)=>typeof id==='string')||!Number.isInteger(s.index)||s.index<0||s.index>=s.ids.length||typeof s.name!=='string'||!Number.isFinite(s.seconds)||s.seconds<0)return null;
  return s;
 }catch{return null;}
}
// The queue is immutable between edits. Serialize its potentially thousands of
// IDs once; progress saves only serialize the small changing header.
let savedIds: string[] | undefined, encodedIds = '', lastWrite: string | null | undefined;
export function savePlayback(s:SavedPlayback|null){try{
 if(!s){if(lastWrite!==null)localStorage.removeItem(key);lastWrite=null;savedIds=undefined;return;}
 if(savedIds!==s.ids){encodedIds=JSON.stringify(s.ids);savedIds=s.ids;}
 const {ids:_,...header}=s;
 const encoded=JSON.stringify(header).slice(0,-1)+',"ids":'+encodedIds+'}';
 if(encoded===lastWrite)return;
 localStorage.setItem(key,encoded);lastWrite=encoded;
}catch{/* A full or unavailable preferences store must not interrupt playback. */}}
export function restorePlayback(saved:SavedPlayback,available:MusicTrack[]){
 const byId=new Map(available.map(t=>[t.id,t]));
 const before=saved.ids.slice(0,saved.index).flatMap(id=>byId.has(id)?[byId.get(id)!]:[]);
 const after=saved.ids.slice(saved.index).flatMap(id=>byId.has(id)?[byId.get(id)!]:[]);
 const tracks=[...before,...after];const index=after.length?before.length:tracks.length-1;
 const song=tracks[index];const same=!!song&&song.id===saved.ids[saved.index];
 return {queue:{name:saved.name,tracks,index},seconds:same?Math.min(saved.seconds,Math.max(0,song.duration-.5)):0};
}
