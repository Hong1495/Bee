import { useEffect, useRef, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { t } from './i18n';

export function PlaybackVolume({target,radioVolume,onRadioVolume,onError,disabled=false}:{target:'radio'|'local'|'music';radioVolume:number;onRadioVolume:(v:number)=>void;onError:(error:string)=>void;disabled?:boolean}) {
  const [value,setValue]=useState(1);
  const [ready,setReady]=useState(false);
  const revision=useRef(0);
  const pending=useRef<{target:'local'|'music';value:number}|null>(null);
  const writing=useRef(false);
  const active=useRef(target);active.current=target;
  useEffect(()=>{
    const token=++revision.current;setReady(false);
    if(target==='radio'||!isTauri()){setReady(true);return;}
    if(disabled)return;
    void invoke<number>(`${target}_volume`,{value:null}).then(v=>{if(token===revision.current){setValue(v);setReady(true);}}).catch(e=>{if(token===revision.current)onError(String(e));});
    return()=>{revision.current++;};
  },[target,disabled]);
  const change=(v:number)=>{
    if(target==='radio'){onRadioVolume(v);return;}
    setValue(v);revision.current++;
    if(!isTauri())return;
    pending.current={target,value:v};
    if(writing.current)return;
    writing.current=true;
    void (async()=>{
      try{while(pending.current){const next=pending.current;pending.current=null;try{await invoke(`${next.target}_volume`,{value:next.value});}catch(e){onError(String(e));if(active.current===next.target)setReady(false);}}}
      finally{writing.current=false;}
    })();
  };
  const volume=target==='radio'?radioVolume:value;
  return <div className={`playback-volume score-volume${disabled||!ready?' is-disabled':''}${volume===0?' is-muted':''}`} role="group" aria-label={t('音量')}>
    <span className="volume-staff" aria-hidden="true"/>
    <span className="volume-note-track" aria-hidden="true"><svg className="volume-note" style={{left:`${volume*100}%`}} viewBox="0 0 20 28"><ellipse cx="6" cy="21" rx="4.7" ry="3.2" transform="rotate(-22 6 21)" fill="currentColor"/><path d="M10 20V3c0 5 9 5 6 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></span>
    <input aria-label={t('音量')} aria-valuetext={volume===0?t('静音'):`${Math.round(volume*100)}%`} title={`${t('音量')} ${Math.round(volume*100)}%`} disabled={disabled||!ready} type="range" min="0" max="1" step=".01" value={volume} onChange={e=>change(Number(e.target.value))}/>
    <span className="volume-readout" aria-hidden="true">{Math.round(volume*100)}<small>%</small></span>
  </div>;
}
