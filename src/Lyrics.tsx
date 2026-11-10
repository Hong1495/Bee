import { memo,useEffect,useLayoutEffect,useMemo,useRef,useState,type RefObject } from 'react';
import { invoke,isTauri } from '@tauri-apps/api/core';
import type { MusicTrack } from './data';
import type { PlaybackPosition } from './useMusic';
import { parseLrc,lyricIndex } from './parseLyrics';
type Result={synced:string;plain:string;source:string;instrumental:boolean;disabled?:boolean};
export const Lyrics = memo(function Lyrics({track,position,revision}:{track:MusicTrack;position:RefObject<PlaybackPosition>;revision:number}){
 const [retry,setRetry]=useState(0);const [status,setStatus]=useState<'loading'|'missing'|'error'|'ready'>('loading');
 const [result,setResult]=useState<Result|null>(null);const [index,setIndex]=useState(-1);const [expanded,setExpanded]=useState(false);
 useEffect(()=>{let cancelled=false;setResult(null);setStatus('loading');setIndex(-1);setExpanded(false);if(isTauri())void invoke<Result|null>('lyrics_request',{refresh:retry>0,song:{title:track.title,artist:track.artist,album:track.album,duration:track.duration}}).then(value=>{if(!cancelled){setResult(value);setStatus(value?'ready':'missing');}}).catch(()=>{if(!cancelled)setStatus('error');});return()=>{cancelled=true;};},[track.id,track.title,track.artist,track.album,track.duration,revision,retry]);
 const rail=useRef<HTMLDivElement>(null);
 const [offset,setOffset]=useState(0);
 const lines=useMemo(()=>parseLrc(result?.synced??''),[result]);
 useEffect(()=>{if(!lines.length)return;let timer:ReturnType<typeof setInterval>|undefined;const update=()=>{const p=position.current;const seconds=p.seconds+(p.playing?(performance.now()-p.sampledAt)/1000:0);setIndex(lyricIndex(lines,Math.min(seconds,p.duration||seconds)));};const visibility=()=>{clearInterval(timer);if(!document.hidden){update();timer=setInterval(update,80);}};visibility();document.addEventListener('visibilitychange',visibility);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visibility);};},[lines,position]);
 useLayoutEffect(()=>{
  const node=rail.current;if(!node)return;
  const measure=()=>{
   const active=node.children[Math.max(0,index)] as HTMLElement|undefined;
   if(active)setOffset(index<0?70:56-active.offsetTop-active.offsetHeight/2);
  };
  measure();const observer=new ResizeObserver(measure);observer.observe(node);
  return()=>observer.disconnect();
 },[lines,index]);
 if(status==='loading')return <div className="lyrics-plain"><span className="text-button" role="status">正在查找歌词…</span></div>;
 if(status==='error'||status==='missing')return <div className="lyrics-plain"><button className="text-button" onClick={()=>setRetry(v=>v+1)}>{status==='error'?'歌词暂不可用':'未找到歌词'} · 重试</button></div>;
 if(!result||result.disabled||result.instrumental)return <div className="lyrics-space" aria-hidden="true"/>;
 if(!lines.length)return <div className="lyrics-plain"><button className="text-button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}>歌词 · 无时间轴</button>{expanded&&<div className="plain-lyrics" tabIndex={0}>{result.plain}</div>}</div>;
 return <div className="synced-lyrics" aria-label="同步歌词"><div ref={rail} className="lyrics-track" style={{transform:`translateY(${offset}px)`}}>{lines.map((line,i)=><p key={`${line.time}-${i}`} className={i===index?'lyric-current':''} style={{opacity:i===index?1:Math.abs(i-index)===1?.48:0}}><span>{line.text||'♪'}</span></p>)}</div></div>;
});
