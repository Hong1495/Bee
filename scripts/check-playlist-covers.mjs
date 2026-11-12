import {i18n} from './i18n-test-loader.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const load=file=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:id=>{assert.equal(id,'./i18n');return i18n;}});return exports;};
const {playlistCover}=load('src/playlistCovers.ts'),{fallbackArtwork}=load('src/fallbackArtwork.ts');
const byTrack=new Map([['a',{id:'album-a'}],['b',{id:'album-a'}],['c',{id:'album-c'}],['d',{id:'album-d'}],['e',{id:'album-e'}],['f',{id:'album-f'}]]);
const result=playlistCover({id:'list',name:'List'},['a','b','missing','c','d','e','f'],byTrack);
assert.equal(result.count,7);assert.equal(result.covers.map(a=>a.id).join(','),'album-a,album-c,album-d,album-e');
assert.equal(playlistCover({id:'empty',name:'Empty'},[],byTrack).covers.length,0);
assert.equal(playlistCover({id:'loading',name:'Loading'},undefined,byTrack).count,undefined);
const paths=new Set();for(let i=0;i<2000;i++){const path=fallbackArtwork(`album-${i}`);assert.equal(path,fallbackArtwork(`album-${i}`));assert.ok(fs.existsSync('public'+path));paths.add(path);}assert.equal(paths.size,48);
console.log('PASS: unique source album collage order, missing tracks, empty/loading lists, 48 stable packaged fallback covers');
for(let i=0;i<48;i++){
 const name=String(i).padStart(2,'0')+'.svg';
 assert.ok(fs.existsSync('public/artwork/notation/dark/'+name));
 const light=fs.readFileSync('public/artwork/notation/'+name,'utf8'),dark=fs.readFileSync('public/artwork/notation/dark/'+name,'utf8');
 assert.equal(light.replace(/#[0-9a-f]{6}/g,'COLOR'),dark.replace(/#[0-9a-f]{6}/g,'COLOR'));
}
assert.equal(fallbackArtwork('stable',true),fallbackArtwork('stable').replace('/notation/','/notation/dark/'));
console.log('PASS: all 48 fallback motifs keep identical geometry and assignment across themes');
