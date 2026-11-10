import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/data.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {exports});
const base = {title:'Song',duration:123,artist:'Singer',albumArtist:'Various',album:'Collection',year:2026,genre:'Pop',disc:1,number:2,added:1};
const records = exports.groupAlbums([{...base,id:'A'}, {...base,id:'B',artist:'Other',number:1,added:3}, {...base,id:'C',albumArtist:'Separate'}]);
assert.equal(records.length,2);
assert.equal(records[0].tracks[0].id,'B');
assert.equal(records[0].added,3);
assert.equal(exports.groupAlbums([]).length,0);
assert.equal(exports.groupAlbums([{...base,id:'D',album:'',artist:'',albumArtist:''}])[0].title,'未知专辑');
const bridge = fs.readFileSync('src-tauri/music/bridge.js','utf8');
const context = {Application:() => ({running:() => false})};
vm.createContext(context); vm.runInContext(bridge, context);
assert.equal(JSON.parse(context.run([JSON.stringify({operation:'status'})])).running,false);
const song = {persistentID:()=>'1234567890ABCDEF', name:()=>'Song', artist:()=>'Singer', albumArtist:()=>'Singer', album:()=>'Record', duration:()=>123, year:()=>2026, genre:()=>'', discNumber:()=>1, trackNumber:()=>1};
let played = false;
const tracks = {whose:() => () => [song]};
context.Application = () => ({running:()=>true, libraryPlaylists:[{tracks}], playerState:()=> 'paused', playerPosition:()=>42, currentTrack:song, play:track => { assert.equal(track,song); played=true; }});
assert.equal(JSON.parse(context.run([JSON.stringify({operation:'status'})])).track.title,'Song');
context.run([JSON.stringify({operation:'play',id:'1234567890ABCDEF'})]); assert.equal(played,true);
console.log('PASS: grouping, track order, empty metadata, stopped/paused status and track dispatch (mock Music API)');

assert.equal(JSON.parse(context.run([JSON.stringify({operation:'status'})])).position,42);
assert.equal(JSON.parse(context.run([JSON.stringify({operation:'status',id:'1234567890ABCDEF'})])).unchanged,true);
console.log('PASS: repeated playback polling skips unchanged metadata');
// Source navigation is explicit even if Music's private Up Next is empty.
const ids = ['0000000000000001','0000000000000002','0000000000000003'];
let current = ids[0], dispatches = 0;
const sourceTracks = {whose:({persistentID}) => () => ids.includes(persistentID) ? [{...song,persistentID:()=>persistentID}] : [],persistentID:()=>ids};
const source = {ids,name:'Album',playlistId:null};
context.Application = () => ({running:()=>true,libraryPlaylists:[{tracks:sourceTracks}],playerState:()=> 'playing',playerPosition:()=>0,
 currentTrack:{...song,persistentID:()=>current},play:t=>{current=t.persistentID();dispatches++;},
 userPlaylists:{whose:()=>()=>[{tracks:sourceTracks,name:()=> 'List'}]}});
const command = operation => JSON.parse(context.run([JSON.stringify({operation,context:source})]));
assert.equal(command('status').canPrevious,false); assert.equal(command('status').canNext,true);
command('previous'); assert.equal(dispatches,0);
command('next'); assert.equal(current,ids[1]); assert.equal(command('status').canPrevious,true);
command('next'); assert.equal(current,ids[2]); assert.equal(command('status').canNext,false);
command('next'); assert.equal(dispatches,2);
command('previous'); assert.equal(current,ids[1]);
const single = {ids:[current],name:'Single',playlistId:null};
const singleStatus = JSON.parse(context.run([JSON.stringify({operation:'status',context:single})]));
assert.equal(singleStatus.canPrevious,false); assert.equal(singleStatus.canNext,false);
const listResult = JSON.parse(context.run([JSON.stringify({operation:'play',id:ids[0],playlistId:'000000000000000A'})]));
assert.deepEqual(listResult.context.ids,ids); assert.equal(current,ids[0]);
console.log('PASS: previous/next source order, first/last boundaries, one-track source and materialized playlist lookup');
// Album and single-track actions carry distinct source IDs.
const albumResult = JSON.parse(context.run([JSON.stringify({operation:'play',id:ids[0],trackIds:ids,sourceName:'Album'})]));
assert.deepEqual(albumResult.context.ids,ids);
const singleResult = JSON.parse(context.run([JSON.stringify({operation:'play',id:ids[1],trackIds:[ids[1]],sourceName:'Song'})]));
assert.deepEqual(singleResult.context.ids,[ids[1]]);
// Whole-list playback always starts at its first track, not a filtered row.
context.run([JSON.stringify({operation:'play',id:ids[2],playlistId:'000000000000000A'})]);
assert.equal(current,ids[0]);
context.run([JSON.stringify({operation:'play',playlistId:'000000000000000A'})]);
assert.equal(current,ids[0]);
const queueIds = Array.from({length:125},(_,i)=>(i+1).toString(16).padStart(16,'0'));
context.Application = () => ({running:()=>true,playerState:()=> 'playing',currentTrack:{persistentID:()=>queueIds[60]},
 libraryPlaylists:[{tracks:{persistentID:()=>queueIds,name:()=>queueIds.map((_,i)=>`Song ${i}`),artist:()=>queueIds.map(()=> 'Artist'),duration:()=>queueIds.map(()=>123)}}]});
const fullQueue = JSON.parse(context.run([JSON.stringify({operation:'queue',context:{ids:queueIds,name:'Full album',playlistId:null}})]));
assert.equal(fullQueue.tracks.length,125);
assert.equal(fullQueue.tracks[0].id,queueIds[0]);
assert.equal(fullQueue.tracks[124].id,queueIds[124]);
assert.equal(fullQueue.tracks.filter(t=>t.current).length,1);
assert.equal(fullQueue.tracks[60].current,true);
const onlySong = JSON.parse(context.run([JSON.stringify({operation:'queue',context:{ids:[queueIds[60]],name:'Single',playlistId:null}})]));
assert.equal(onlySong.tracks.length,1);
console.log('PASS: album vs single intent, playlist first-track semantics, complete 125-track queue and current-row position');
