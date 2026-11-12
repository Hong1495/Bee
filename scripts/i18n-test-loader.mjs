import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
export function loadI18n(initial = 'zh-Hans') {
 const storage = new Map([['bee-language', initial]]), listeners = new Set();
 let subscribed = false;
 const exports = {}, document = {documentElement:{lang:''}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/i18n.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{
  exports,document,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},
  require:id=>id==='react'?{useSyncExternalStore:(subscribe,snapshot)=>{if(!subscribed){subscribe(()=>listeners.forEach(fn=>fn()));subscribed=true;}return snapshot();}}:JSON.parse(fs.readFileSync('src/'+id.replace('./',''),'utf8')),
 });
 return {api:exports,storage,document,listeners};
}
export const i18n = loadI18n().api;
