import { t, useLanguage } from './i18n';
import { useEffect,useRef,useState,type CSSProperties } from 'react';
import { ArrowDown,X } from 'lucide-react';
import { invoke,isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { useUpdater } from './useUpdater';
type Updater=ReturnType<typeof useUpdater>;
export function UpdateSettings({updater,onOpen}:{updater:Updater;onOpen:()=>void}){
  useLanguage();
 const busy=['checking','downloading','installing'].includes(updater.phase);
 return <section className="preferences-section"><h2>{t("软件更新")}</h2><div className="preferences-group">
  <div className="preference-row"><label htmlFor="automatic-updates">{t("自动检查更新")}</label><input id="automatic-updates" type="checkbox" checked={updater.automatic} onChange={e=>updater.setAutomatic(e.target.checked)}/></div>
  <div className="preference-row"><span>{t("当前版本")} {updater.version}</span><div className="setting-actions">{updater.update?<button onClick={onOpen}>{updater.phase==='ready'?t("重启以完成更新"):t("新版本 {0}", updater.update.version)}</button>:<button disabled={busy} onClick={()=>void updater.checkNow()}>{updater.phase==='checking'?t("正在检查…"):t("检查更新")}</button>}</div></div>
 </div>{updater.error&&<p className="settings-error" role="alert">{updater.error}</p>}{updater.checked&&!updater.update&&updater.phase==='idle'&&<p className="preferences-note" role="status">{t("已是最新版本")}</p>}</section>;
}

export function UpdateIndicator({updater,open,setOpen}:{updater:Updater;open:boolean;setOpen:(open:boolean)=>void}){
  useLanguage();
 const [position,setPosition]=useState<{left:number;top:number;size:number}|null>(isTauri()?null:{left:80,top:20,size:12});
 const panel=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!updater.update||!isTauri())return;
  let cancelled=false;let dispose:(()=>void)|undefined;
  const measure=()=>void invoke<typeof position>('update_indicator_position').then(value=>{if(!cancelled)setPosition(value);}).catch(()=>{});
  measure();void getCurrentWindow().onResized(measure).then(fn=>{if(cancelled)fn();else dispose=fn;});
  return()=>{cancelled=true;dispose?.();};
 },[!!updater.update]);
 useEffect(()=>{
  if(!open)return;
  panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
  const dismiss=(e:PointerEvent)=>{if(!panel.current?.contains(e.target as Node)&&!button.current?.contains(e.target as Node))setOpen(false);};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);button.current?.focus();}};
  document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',key,true);
  return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',key,true);};
 },[open,setOpen]);
 if(!updater.update)return null;
 const busy=updater.phase==='downloading'||updater.phase==='installing';
 const percent=updater.progress.total?Math.min(100,Math.round(updater.progress.received/updater.progress.total*100)):null;
 return <>
  {position&&<button ref={button} className="update-indicator" style={{left:position.left,top:position.top,width:position.size,height:position.size} as CSSProperties} title={t("Bee {0} 可更新", updater.update.version)} aria-label={t("查看软件更新")} aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(!open)}><ArrowDown aria-hidden="true"/></button>}
  {open&&<div ref={panel} className="update-popover" role="dialog" aria-modal="false" aria-label={t("软件更新")} style={{left:Math.max(12,(position?.left??80)-12),top:(position?.top??20)+(position?.size??12)+12}}>
   <header><strong>Bee {updater.update.version}</strong><button aria-label={t("关闭更新窗口")} onClick={()=>setOpen(false)}><X size={14}/></button></header>
   <p className="update-subtitle">{updater.phase==='ready'?t("更新已安装，重启后生效"):t("有新版本可用")}</p>
   {updater.update.body&&<div className="update-notes">{updater.update.body}</div>}
   {busy&&<div role="status"><progress max={100} value={updater.phase==='installing'?100:percent??undefined}/><p>{updater.phase==='installing'?t("正在安装…"):t("正在下载{0}", percent===null?'…':` ${percent}%`)}</p></div>}
   {updater.error&&<p className="settings-error" role="alert">{updater.error}</p>}
   <button className="dark-button update-action" disabled={busy} onClick={()=>void(updater.phase==='ready'?updater.restart():updater.install())}>{updater.phase==='ready'?t("重启 Bee"):busy?t("正在更新…"):updater.phase==='error'?t("重试下载安装"):t("下载并安装")}</button>
  </div>}
 </>;
}
