import { useCallback,useEffect,useRef,useState } from 'react';
import { invoke,isTauri } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { check,type Update } from '@tauri-apps/plugin-updater';
import { scheduleUpdateChecks } from './updateSchedule';

export type UpdatePhase='idle'|'checking'|'available'|'downloading'|'installing'|'ready'|'error';
const preference='bee-auto-update';
export function useUpdater(){
 const [automatic,setAutomatic]=useState(()=>localStorage.getItem(preference)!=='false');
 const [version,setVersion]=useState('0.1.6');
 const [update,setUpdate]=useState<Update|null>(null);
 const [phase,setPhase]=useState<UpdatePhase>('idle');
 const [error,setError]=useState('');const [checked,setChecked]=useState(false);
 const [progress,setProgress]=useState({received:0,total:0});
 const resource=useRef<Update|null>(null);const busy=useRef(false);const installed=useRef(false);const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;if(isTauri())void getVersion().then(v=>{if(mounted.current)setVersion(v);});return()=>{mounted.current=false;};},[]);
 const checkNow=useCallback(async()=>{
  if(!isTauri()||busy.current||installed.current)return null;
  busy.current=true;setPhase('checking');setError('');
  try{
   const next=await check({timeout:20000});
   if(!mounted.current){await next?.close();return null;}
   const old=resource.current;resource.current=next;setUpdate(next);setChecked(true);setPhase(next?'available':'idle');
   await old?.close();
   return true;
  }catch(e){if(mounted.current){setError(`检查更新失败：${String(e)}`);setPhase('error');}return false;}
  finally{busy.current=false;}
 },[]);
 useEffect(()=>{
  localStorage.setItem(preference,String(automatic));
  if(!automatic||!isTauri())return;
  return scheduleUpdateChecks(checkNow,{
   now:Date.now,visible:()=>!document.hidden,later:(fn,ms)=>window.setTimeout(fn,ms),cancel:id=>window.clearTimeout(id),
   listen:(event,fn)=>{const target=event==='visibilitychange'?document:window;target.addEventListener(event,fn);return()=>target.removeEventListener(event,fn);},
  });
 },[automatic,checkNow]);
 const install=useCallback(async()=>{
  const next=resource.current;if(!next||busy.current)return;
  busy.current=true;setError('');setPhase('downloading');setProgress({received:0,total:0});
  let received=0,total=0,last=0;
  try{
   await next.download(event=>{
    if(event.event==='Started'){total=event.data.contentLength??0;}
    if(event.event==='Progress'){received+=event.data.chunkLength;}
    const now=performance.now();
    if(now-last>100||event.event!=='Progress'){last=now;setProgress({received,total});}
   },{timeout:120000});
   setPhase('installing');
   // Persist the exact current queue/position before the updater replaces files.
   window.dispatchEvent(new Event('bee-before-update'));
   await next.install();installed.current=true;setPhase('ready');
  }catch(e){setError(`更新失败：${String(e)}`);setPhase('error');}
  finally{busy.current=false;}
 },[]);
 const restart=useCallback(async()=>{try{window.dispatchEvent(new Event('bee-before-update'));await invoke('restart_after_update');}catch(e){setError(`重启失败，请退出后重新打开 Bee：${String(e)}`);}},[]);
 return {automatic,setAutomatic,version,update,phase,error,checked,progress,checkNow,install,restart};
}
