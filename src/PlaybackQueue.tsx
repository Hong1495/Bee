import { EmptyScore } from './EmptyScore';
import { memo, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { time, type MusicTrack } from './data';
import type { QueueState } from './useMusic';
export const PlaybackQueue = memo(function PlaybackQueue({queue,onSelect,onClose}:{queue:QueueState;onSelect:(index:number)=>void;onClose:()=>void}) {
 const panel=useRef<HTMLElement>(null);
 useEffect(()=>{panel.current?.querySelector<HTMLElement>('[aria-current=true]')?.scrollIntoView({block:'nearest'});},[queue.index]);
 useEffect(()=>{panel.current?.querySelector<HTMLButtonElement>('button')?.focus();const dismiss=(e:PointerEvent)=>{if(!(e.target as Element).closest('.floating-transport'))onClose();};document.addEventListener('pointerdown',dismiss);return()=>document.removeEventListener('pointerdown',dismiss);},[onClose]);
 return <section ref={panel} id="playback-queue" className="playback-queue" aria-label="待播放列表" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();panel.current?.parentElement?.querySelector<HTMLButtonElement>('[aria-controls="playback-queue"]')?.focus();onClose();}}}>
  <header><strong>待播放</strong><button type="button" aria-label="关闭待播放列表" onClick={onClose}><X size={14}/></button></header>
  {!queue.tracks.length?<EmptyScore compact label="暂无待播放歌曲"/>:<ol>{queue.tracks.map((song,index)=><QueueRow key={`${song.id}-${index}`} song={song} index={index} current={index===queue.index} onSelect={onSelect}/>)}</ol>}
 </section>;
});

const QueueRow = memo(function QueueRow({song,index,current,onSelect}:{song:MusicTrack;index:number;current:boolean;onSelect:(index:number)=>void}) {
 return <li aria-current={current}><button className="queue-track" onClick={()=>onSelect(index)} aria-label={`播放 ${song.title}`}><span><strong>{song.title}</strong><small>{song.artist}</small></span><span>{time(song.duration)}</span></button></li>;
});
