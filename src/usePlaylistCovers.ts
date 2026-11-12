import { t, useLanguage } from './i18n';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {Album,MusicPlaylist} from './data';
import {playlistCover} from './playlistCovers';
export function usePlaylistCovers(source:string,lists:MusicPlaylist[],albums:Album[],load:(id:string)=>Promise<string[]>,enabled:boolean){
 const language=useLanguage();
 const [members,setMembers]=useState<{source:string;albums:Album[];ids:Record<string,string[]>}>({source,albums,ids:{}});
 const loader=useRef(load);loader.current=load;
 const [error,setError]=useState('');
 // Reset external membership when the source library is refreshed. Custom
 // membership comes directly from its persisted model and needs no IPC.

 const external=useMemo(()=>lists.filter(p=>!p.managed&&!p.trackIds).map(p=>p.id),[lists]);
 useEffect(()=>{
  if(!enabled)return;
  let cancelled=false,index=0;setError('');
  const pending=external.filter(id=>members.source!==source||members.albums!==albums||!members.ids[id]);
  const worker=async()=>{while(!cancelled&&index<pending.length){const id=pending[index++];try{
   const ids=await loader.current(id);
   if(!cancelled)setMembers(old=>({source,albums,ids:{...(old.source===source&&old.albums===albums?old.ids:{}),[id]:ids}}));
  }catch(e){if(!cancelled)setError(t("播放列表封面读取失败：{0}", String(e)));}}};
  void Promise.all([worker(),worker()]);
  return()=>{cancelled=true;};
 // Membership updates must not cancel/restart the in-flight workers.
 },[source,external,albums,enabled]);
 const byTrack=useMemo(()=>new Map(albums.flatMap(album=>album.tracks.map(track=>[track.id,album] as const))),[albums]);
 const covers=useMemo(()=>lists.map(list=>playlistCover(list,list.trackIds??(members.source===source&&members.albums===albums?members.ids[list.id]:undefined),byTrack)),[lists,members,source,byTrack,language]);
 return {covers,error};
}
