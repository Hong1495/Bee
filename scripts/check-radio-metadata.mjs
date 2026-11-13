import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let slots=[],cursor=0,effects=[],requests=[],timers=new Map(),timerId=0;
const React={
  useState(initial){const i=cursor++;slots[i]??={value:initial};return[slots[i].value,value=>slots[i].value=value];},
  useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){old?.cleanup?.();const slot={deps};slots[i]=slot;effects.push(()=>slot.cleanup=fn());}}
};
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/useRadioMetadata.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
  exports,require:n=>n==='react'?React:{isTauri:()=>true,invoke:(command,args)=>new Promise((resolve,reject)=>requests.push({command,...args,resolve,reject}))},
  setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)
});
let state={station:{id:'peacefulpiano'},phase:'playing'};
const render=()=>{cursor=0;const value=exports.useRadioMetadata(state);effects.splice(0).forEach(fn=>fn());return value;};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
assert.equal(render(),null);const old=requests.shift();
state={...state,station:{id:'relax'}};assert.equal(render(),null);const current=requests.shift();
old.resolve({title:'Old work',credit:'Old artist'});await flush();assert.equal(render(),null);assert.equal(timers.size,0);
current.resolve({title:'Current work',credit:'Provided credit'});await flush();assert.equal(render().title,'Current work');assert.equal(timers.size,1);
const [id,poll]=[...timers][0];timers.delete(id);poll();const refresh=requests.shift();
state={...state,phase:'stopped'};assert.equal(render(),null);refresh.resolve({title:'Late work',credit:null});await flush();assert.equal(render(),null);assert.equal(timers.size,0);
state={...state,phase:'playing'};render();requests.shift().reject(new Error('offline'));await flush();assert.equal(render(),null);assert.equal(timers.size,1);
const [retryId,retry]=[...timers][0];timers.delete(retryId);retry();requests.shift().resolve({title:'Recovered work',credit:null});await flush();assert.equal(render().title,'Recovered work');
state={...state,phase:'stopped'};render();assert.equal(timers.size,0);
console.log('PASS: metadata station isolation, late response cancellation, stop cleanup, failure fallback and recovery');
