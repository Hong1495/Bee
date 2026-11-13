import { useEffect, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import type { RadioState } from './radio';
export type RadioMetadata = { title:string; credit:string|null };
export function useRadioMetadata(radio:RadioState) {
  const station=radio.station?.id;
  const playing=radio.phase==='playing';
  const [entry,setEntry]=useState<{station:string;value:RadioMetadata}|null>(null);
  useEffect(()=>{
    setEntry(null);
    if(!station||!playing||!isTauri())return;
    let cancelled=false;
    let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{
      try {
        const value=await invoke<RadioMetadata|null>('radio_now_playing',{station});
        if(!cancelled)setEntry(value?{station,value}:null);
      } catch { if(!cancelled)setEntry(null); }
      if(!cancelled)timer=setTimeout(poll,30000);
    };
    void poll();
    return()=>{cancelled=true;clearTimeout(timer);};
  },[station,playing]);
  return playing&&entry&&entry.station===station?entry.value:null;
}
