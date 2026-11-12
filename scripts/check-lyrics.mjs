import {i18n} from './i18n-test-loader.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let slots=[],cursor=0,effects=[],pending=[],calls=[],response=null,fail=false;
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const react={memo:x=>x,useRef:v=>{const i=cursor++;return slots[i]??=( {current:v} );},useState:v=>{const i=cursor++;if(!(i in slots))slots[i]=v;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useMemo:(fn)=>{cursor++;return fn();},useEffect:(fn,deps)=>{const i=cursor++;if(!same(slots[i]?.deps,deps)){slots[i]?.cleanup?.();slots[i]={deps};effects.push(()=>{slots[i].cleanup=fn();});}},useLayoutEffect:()=>{cursor++;}};
const parser={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/parseLyrics.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:parser});
const exports={};let tick;

const jsx=(type,props)=>({type,props});
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/Lyrics.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,performance,setInterval:fn=>{tick=fn;return 1;},clearInterval:()=>{},document:{hidden:false,addEventListener:()=>{},removeEventListener:()=>{}},require:id=>id==='./i18n'?i18n:id==='react'?react:id==='react/jsx-runtime'?{jsx,jsxs:jsx}:id.includes('/core')?{isTauri:()=>true,invoke:(_,args)=>{calls.push(args);const p=fail?Promise.reject(new Error('offline')):Promise.resolve(response);pending.push(p.catch(()=>{}));return p;}}:parser});
let props={track:{id:'a',title:'Totoro',artist:'Artist',album:'Album',duration:120},position:{current:{seconds:2,playing:false,duration:120,sampledAt:performance.now()}},revision:0,refreshToken:0};
const render=()=>{cursor=0;const tree=exports.Lyrics(props);effects.splice(0).forEach(f=>f());return tree;};
const settle=async()=>{render();await Promise.all(pending.splice(0));return render();};
const quiet=tree=>assert.equal(tree.props.className,'lyrics-space');
quiet(render());quiet(await settle());assert.equal(calls.at(-1).refresh,false);
props.refreshToken++;quiet(await settle());assert.equal(calls.at(-1).refresh,true);
// App keys Lyrics by track id; a new track must not inherit forced refresh.
slots=[];props={...props,track:{...props.track,id:'b'}};quiet(await settle());assert.equal(calls.at(-1).refresh,false);
fail=true;props.refreshToken++;quiet(await settle());
fail=false;response={instrumental:true,synced:'',plain:''};props.refreshToken++;quiet(await settle());
response={instrumental:false,synced:'',plain:'Actual song words'};props.refreshToken++;const tree=await settle();assert.equal(tree.props.className,'lyrics-plain');assert.equal(tree.props.children[0].props.children,'歌词 · 无时间轴');
console.log('PASS: quiet loading/missing/error/instrumental states, explicit retry bypasses cache, next track uses cache, plain lyrics remain available');

response={instrumental:false,synced:'[00:01.00]First line\n[00:05.00]Second line',plain:''};props.refreshToken++;
await settle();const synced=render();assert.equal(synced.props.className,'synced-lyrics');
let rows=synced.props.children.props.children;assert.equal(rows.length,2);assert.equal(rows[0].props.className,'lyric-current');assert.equal(rows[0].props.children.props.children,'First line');
props.position.current.seconds=6;tick();rows=render().props.children.props.children;assert.equal(rows[1].props.className,'lyric-current');assert.equal(rows[1].props.style.opacity,1);
console.log('PASS: real LRC parser renders timed lyrics and playback clock advances the highlighted line');
