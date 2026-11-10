import { EmptyScore } from './EmptyScore';
import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X } from 'lucide-react';
import { time } from './data';
type Queue = { name:string; shuffle:boolean; tracks:{id:string; title:string; artist:string; duration:number; current:boolean}[] };
export function PlaybackQueue({trackId,onClose}:{trackId:string;onClose:()=>void}) {
  const [queue,setQueue] = useState<Queue | null>(null);
  const [error,setError] = useState('');
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    let cancelled = false;
    let timer:ReturnType<typeof setTimeout>;
    setQueue(null); setError('');
    const load = async () => {
      try {
        if (document.hidden) { if (!cancelled) timer=setTimeout(load,5000); return; }
        const data = await invoke<Queue>('music_request',{operation:'queue',id:null,playlistId:null});
        if (!cancelled) { setQueue(data); setError(''); }
      } catch { if (!cancelled) setError('暂时无法读取播放来源，请稍后重试。'); }
      if (!cancelled) timer=setTimeout(load,5000);
    };
    void load();
    return () => { cancelled=true; clearTimeout(timer); };
  },[trackId]);
  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const dismiss = (event:PointerEvent) => {
      if (!(event.target as Element).closest('.floating-transport')) onClose();
    };
    document.addEventListener('pointerdown',dismiss);
    return () => document.removeEventListener('pointerdown',dismiss);
  },[onClose]);
  return <section ref={panel} id="playback-queue" className="playback-queue" aria-label="待播放列表" onKeyDown={event => {
    if(event.key==='Escape') { event.stopPropagation(); panel.current?.parentElement?.querySelector<HTMLButtonElement>('[aria-controls="playback-queue"]')?.focus(); onClose(); }
  }}>
    <header><strong>待播放</strong><button type="button" aria-label="关闭待播放列表" onClick={onClose}><X size={14}/></button></header>
    <p>{queue?.shuffle ? '随机播放已开启，实际顺序由“音乐”决定。' : '按当前播放来源排列，不含“音乐”中手动插队的调整。'}</p>
    {error ? <p role="status">{error}</p> : !queue ? <p role="status">正在读取…</p> : !queue.tracks.length ? <EmptyScore compact label="暂无待播放歌曲"/> : <ol>{queue.tracks.map((song,index) => <li key={`${song.id}-${index}`} aria-current={song.current}>
      <span><strong>{song.title}</strong><small>{song.current ? '正在播放 · ' : ''}{song.artist}</small></span><span>{time(song.duration)}</span>
    </li>)}</ol>}
    {queue && queue.tracks.length===101 && <p>显示当前曲目及后续 100 首</p>}
  </section>;
}
