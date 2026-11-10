import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {performance} from 'node:perf_hooks';
const load=(file,extra={})=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,...extra});return exports;};
const {nearestShelfSlot,lowerBound}=load('src/shelfPositions.ts');
const originalNearest=(centers,width,max,position)=>{const clamp=n=>Math.max(0,Math.min(max,n));return centers.reduce((best,center)=>{const slot=clamp(center-width/2);return Math.abs(slot-position)<Math.abs(best-position)?slot:best;},clamp((centers[0]??0)-width/2));};
for(const count of [0,1,2,20,1000])for(const width of [320,713.5,1400]){
 const centers=Array.from({length:count},(_,i)=>56+i*112),max=Math.max(0,count*112-width);
 for(let i=0;i<100;i++){
  const p=(max+200)*i/99-100;
  assert.equal(nearestShelfSlot(centers,width,max,p),originalNearest(centers,width,max,p));
  const origin=originalNearest(centers,width,max,p);
  for(const direction of [-1,1]){
   const old=direction>0?centers.find(c=>c-width/2>origin+1):[...centers].reverse().find(c=>c-width/2<origin-1);
   let at=lowerBound(centers,origin+width/2+direction);
   if(direction>0&&centers[at]===origin+width/2+1)at++;
   if(direction<0)at--;
   assert.equal(centers[at],old);
  }
 }
}
const {buildLibrarySearchIndex,matchLibrary,selectSearchArtist,searchLibrary}=load('src/librarySearch.ts');
const albums=Array.from({length:10000},(_,i)=>({id:String(i),title:`Album ${i}`,artist:`Artist ${i%400}`,tracks:[{title:i%3?'Other':'Match',artist:`Artist ${i%400}`}]}));
const index=buildLibrarySearchIndex(albums),matches=matchLibrary(albums,index,'match');
for(let i=0;i<400;i++){
 const name=`Artist ${i}`,actual=selectSearchArtist(matches,name);
 assert.deepEqual(JSON.parse(JSON.stringify(actual.artistAlbums)),albums.filter(a=>index.get(a.id).includes('match')&&a.artist===name));
 assert.equal(actual.artists,matches.artists);
}
let writes=0;const storage=new Map();
const session=load('src/playbackSession.ts',{localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>{writes++;storage.set(k,v);},removeItem:k=>storage.delete(k)}});
const state={version:1,source:'music',name:'Queue',ids:albums.map(a=>a.id),index:0,seconds:12};
session.savePlayback(state);const first=writes;
for(let i=0;i<100;i++)session.savePlayback({...state});
assert.equal(writes,first);
assert.deepEqual(JSON.parse(JSON.stringify(session.readPlayback())),state);
session.savePlayback({...state,seconds:13});assert.equal(writes,first+1);
session.savePlayback({...state,ids:['replacement'],index:0});assert.equal(session.readPlayback().ids[0],'replacement');
session.savePlayback(null);assert.equal(session.readPlayback(),null);
const bench=(fn,n)=>{const start=performance.now();for(let i=0;i<n;i++)fn(i);return performance.now()-start;};
const centers=Array.from({length:10000},(_,i)=>56+i*112),width=900,max=centers.length*112-width;
const oldShelf=bench(i=>originalNearest(centers,width,max,(i*137)%max),5000);
const newShelf=bench(i=>nearestShelfSlot(centers,width,max,(i*137)%max),5000);
const oldSearch=bench(i=>searchLibrary(albums,index,'match',`Artist ${i%400}`),200);
const newSearch=bench(i=>selectSearchArtist(matches,`Artist ${i%400}`),200);
console.log('PASS: binary shelf positions match previous behaviour including boundaries/ties, cached artist groups preserve results, unchanged long queues avoid storage writes');
console.log(`10,000 albums, 5,000 shelf lookups: linear ${oldShelf.toFixed(1)}ms; binary ${newShelf.toFixed(1)}ms`);
console.log(`10,000 albums, 200 artist switches: repeated search ${oldSearch.toFixed(1)}ms; cached groups ${newSearch.toFixed(1)}ms`);
