import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const store=new Map();
const document=new EventTarget();document.hidden=false;
const load=(file,require=()=>{})=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,performance,localStorage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)},window:{addEventListener(){},removeEventListener(){}},document,console,setTimeout,clearTimeout});return exports;};
const {parseLrc,lyricIndex}=load('src/parseLyrics.ts');
const lines=parseLrc('[offset:-500]\n[00:01.00][00:03.5]Repeat\n[00:02.25]Middle\n[ar:Artist]\n[01:70.00]Invalid');
assert.deepEqual(JSON.parse(JSON.stringify(lines)),[{time:.5,text:'Repeat'},{time:1.75,text:'Middle'},{time:3,text:'Repeat'}]);
assert.equal(lyricIndex(lines,.4),-1);assert.equal(lyricIndex(lines,.5),0);assert.equal(lyricIndex(lines,2),1);assert.equal(lyricIndex(lines,999),2);
assert.equal(parseLrc('untimed words').length,0);
// Minimal hook host: exercise the actual hook command paths and source transitions.
let slots=[],cursor=0,effects=[],hook,result;const calls=[];
const song=(id,source='music')=>({id,source,title:id,artist:'Artist',albumArtist:'',album:'Record',duration:100,year:2026,genre:'',disc:1,number:Number(id.slice(-1))||1,added:0});
const musicTracks=[song('0000000000000001'),song('0000000000000002'),song('0000000000000003')];
const localTracks=[song('local:1','local'),song('local:2','local')];
let musicStatus={running:true,playing:false,track:null,position:0},localStatus={playing:true,ended:false,position:0};
const React={useState(initial){const i=cursor++;slots[i]??={value:typeof initial==='function'?initial():initial};return [slots[i].value,v=>{slots[i].value=typeof v==='function'?v(slots[i].value):v;}];},useRef(initial){const i=cursor++;slots[i]??={current:initial};return slots[i];},useMemo(fn){cursor++;return fn();},useCallback(fn){cursor++;return fn;},useEffect(fn){cursor++;effects.push(fn);}};
let customLists=[];
const invoke=async(command,args)=>{calls.push({command,...args});
 if(command==='playlist_request'){
  const c=args.change;
  if(c.operation==='create')customLists.push({id:c.id,name:c.name,source:c.source,managed:true,trackIds:c.trackIds??[]});
  if(c.operation==='remove')customLists=customLists.map(p=>p.id===c.id?{...p,trackIds:p.trackIds.filter(id=>!c.trackIds.includes(id))}:p);
  if(c.operation==='delete')customLists=customLists.filter(p=>p.id!==c.id);
  return structuredClone(customLists);
 }
if(command==='local_request'){if(['scan','add','remove'].includes(args.operation))return {tracks:localTracks,playlists:[],folders:[{id:'folder:1',name:'Folder',path:'/fixture'}],warnings:[]};if(args.operation==='status')return localStatus;return {};}
 if(args.operation==='library')return {tracks:musicTracks,playlists:[{id:'playlist',name:'List'}]};if(args.operation==='playlist')return musicTracks.map(t=>t.id).reverse();if(args.operation==='status')return musicStatus;return {};};
const data=load('src/data.ts');
const session=load('src/playbackSession.ts');
hook=load('src/useMusic.ts',name=>name==='react'?React:name.includes('/core')?{invoke,isTauri:()=>true}:name==='./data'?data:name==='./playbackSession'?session:{resetArtworkSession(){}}).useMusic;
const render=()=>{cursor=0;effects=[];result=hook();};render();await result.connect();render();
assert.equal(result.albums.length,1);assert.equal(result.albums[0].tracks.length,3);
await result.playTrack(result.albums[0],1);render();assert.equal(result.queue.tracks.length,3);assert.equal(result.queue.index,1);assert.equal(result.canPrevious,true);assert.equal(result.canNext,true);
await result.skip('next');render();assert.equal(result.queue.index,2);assert.equal(result.canNext,false);
await result.playTrack(result.albums[0],1,true);render();assert.equal(result.queue.tracks.length,1);assert.equal(result.canNext,false);
await result.playPlaylist('playlist',musicTracks[1].id);render();assert.equal(result.queue.tracks[0].id,musicTracks[2].id);assert.equal(result.queue.index,1);
await result.selectLibrary('local');render();assert.equal(result.source,'local');assert.equal(result.playlists.length,0);assert.equal(result.track,null);assert.equal(result.queue.tracks.length,0);assert.equal(result.musicConnected,false);assert.equal(result.albums[0].tracks.length,2);assert.ok(result.albums[0].tracks.every(t=>t.id.startsWith('local:')));
await result.playAlbum(result.albums[0]);render();assert.equal(result.track.id,'local:1');
localStatus={playing:false,ended:true,position:100};
const cleanup=effects.at(-1)();await new Promise(r=>setTimeout(r,10));cleanup();render();assert.equal(result.track.id,'local:2');assert.equal(result.queue.index,1);
await result.selectLibrary('music');render();assert.equal(result.source,'music');assert.equal(result.queue.tracks.length,0);assert.equal(result.track,null);assert.ok(result.albums[0].tracks.every(t=>!t.id.startsWith('local:')));
assert.ok(calls.some(c=>c.command==='local_request'&&c.operation==='pause'));
await result.playAlbum(result.albums[0]);render();
result.position.current.seconds=99.5;result.position.current.sampledAt=performance.now();
musicStatus={running:true,playing:false,track:null,position:0};
const cleanupMusic=effects.at(-1)();await new Promise(r=>setTimeout(r,10));cleanupMusic();render();assert.equal(result.queue.index,1);
musicStatus={running:true,playing:false,track:musicTracks[1],position:30};
const cleanupPause=effects.at(-1)();await new Promise(r=>setTimeout(r,10));cleanupPause();render();assert.equal(result.queue.index,1);assert.equal(result.playing,false);

console.log('PASS: LRC timestamps/offsets/boundaries, source-context queue, single-only playback, playlist order, library isolation, source switch reset, local completion advances queue');

// Relaunch using the persisted local queue and position, without autoplay.
await result.selectLibrary('local');render();await result.playTrack(result.albums[0],1);render();
result.position.current.seconds=37;result.position.current.playing=false;
const savedEffect=effects[0]();savedEffect();
const savedSession=session.readPlayback();assert.equal(savedSession.index,1);assert.equal(savedSession.ids.length,2);assert.equal(savedSession.seconds,37);
slots=[];render();await result.updateFolders();render();assert.equal(result.track.id,'local:2');assert.equal(result.playing,false);assert.equal(result.position.current.seconds,37);assert.equal(result.queue.index,1);
const pollRestore=effects.at(-1)();await new Promise(r=>setTimeout(r,10));pollRestore();render();assert.equal(result.position.current.seconds,37);
await result.toggle();render();assert.equal(result.playing,true);assert.equal(calls.filter(c=>c.operation==='play').at(-1).seconds,37);
const removed=session.restorePlayback(savedSession,[localTracks[0]]);assert.equal(removed.queue.index,0);assert.equal(removed.seconds,0);
store.set('bee-playback-session','broken json');assert.equal(session.readPlayback(),null);
console.log('PASS: persisted queue/current index/position, paused relaunch, polling preserves restored position, resume seeks, removed track fallback, corrupt storage');
store.set('bee-library-source','music');
session.savePlayback({version:1,source:'music',name:'Album',ids:musicTracks.map(t=>t.id),index:1,seconds:24});
slots=[];render();await result.connect();render();assert.equal(result.track.id,musicTracks[1].id);assert.equal(result.queue.tracks.length,3);assert.equal(result.playing,false);
await result.toggle();render();assert.equal(calls.at(-1).command,'music_seek');assert.equal(calls.at(-1).seconds,24);
await result.disconnect();assert.equal(session.readPlayback(),null);
console.log('PASS: Apple Music queue restore and explicit resume seek; disconnect clears session');

const {buildLibrarySearchIndex,searchLibrary}=load('src/librarySearch.ts');
const searchAlbums=data.groupAlbums([
 {...song('a1'),album:'甲匹配专辑',artist:'歌手甲',title:'父亲'},
 {...song('a2'),album:'甲其他专辑',artist:'歌手甲',title:'晴天'},
 {...song('b1'),album:'乙匹配专辑',artist:'歌手乙',title:'父亲 Live'},
 {...song('b2'),album:'乙其他专辑',artist:'歌手乙',title:'后来'},
]);
const searchIndex=buildLibrarySearchIndex(searchAlbums);
const searchA=searchLibrary(searchAlbums,searchIndex,' 父亲 ','歌手甲');
const searchB=searchLibrary(searchAlbums,searchIndex,'父亲','歌手乙');
assert.equal(searchA.artists.length,2);
assert.equal(searchB.artists.length,2);
assert.equal(searchA.artistAlbums.length,1);
assert.equal(searchA.artistAlbums[0].title,'甲匹配专辑');
assert.equal(searchB.artistAlbums.length,1);
assert.equal(searchB.artistAlbums[0].title,'乙匹配专辑');
assert.equal(searchB.matches.length,2);
assert.equal(searchLibrary(searchAlbums,searchIndex,'','歌手乙').artistAlbums.length,2);
assert.equal(searchLibrary(searchAlbums,searchIndex,'歌手乙','歌手甲').activeArtist,'歌手乙');
assert.equal(searchLibrary(searchAlbums,searchIndex,'不存在','歌手甲').artists.length,0);
assert.equal(searchLibrary(searchAlbums,searchIndex,'不存在','歌手甲').artistAlbums.length,0);
assert.equal(searchLibrary(searchAlbums,searchIndex,'live','歌手乙').artistAlbums.length,1);
assert.equal(searchLibrary(searchAlbums,searchIndex,'乙其他专辑','歌手乙').artistAlbums.length,1);
console.log('PASS: song search across artists, artist switching retains matching albums and artist choices, query clearing, artist/album search, case folding and empty results');

// Bee-managed Apple Music lists use persisted membership, never Music's playlist endpoint.
await result.connect();render();
await result.editPlaylist({operation:'create',id:'bee:music',name:'Bee list',trackIds:[musicTracks[2].id,'missing',musicTracks[0].id]});render();
const beforeListReads=calls.filter(c=>c.operation==='playlist').length;
await result.playPlaylist('bee:music',musicTracks[0].id);render();
assert.equal(result.queue.tracks.length,2);assert.equal(result.queue.index,1);
assert.equal(result.queue.tracks[0].id,musicTracks[2].id);
assert.equal(calls.filter(c=>c.operation==='playlist').length,beforeListReads);
const queueBefore=result.queue;
await result.editPlaylist({operation:'remove',id:'bee:music',trackIds:[musicTracks[2].id]});render();
assert.equal(result.queue,queueBefore);
await result.selectLibrary('local');render();assert.ok(!result.playlists.some(p=>p.id==='bee:music'));
await result.editPlaylist({operation:'create',id:'bee:local',name:'Local list',trackIds:['local:2','local:1']});render();
await result.playPlaylist('bee:local');render();assert.equal(result.track.id,'local:2');assert.equal(result.queue.tracks.length,2);
const localQueue=result.queue;
await result.editPlaylist({operation:'delete',id:'bee:local'});render();assert.equal(result.queue,localQueue);
await result.selectLibrary('music');render();assert.ok(result.playlists.some(p=>p.id==='bee:music'));
console.log('PASS: custom list source isolation, local and Apple Music playback order, unavailable track skip, edits/deletion preserve live queue');

// Exercise the recurring poll, not just the initial refresh, while the document
// is hidden. This verifies our logic; WebKit suspension requires a native run.
for(const source of ['local','music']){
 store.clear();slots=[];store.set('bee-library-source',source);render();
 if(source==='local')await result.updateFolders();else await result.connect();
 render();await result.playAlbum(result.albums[0]);render();
 const first=result.track;
 localStatus={playing:true,ended:false,position:25};
 musicStatus={running:true,playing:true,track:first,position:25};
 const saveCleanup=effects[0]();const pollCleanup=effects.at(-1)();
 try{
  await new Promise(r=>setTimeout(r,10));
  const beforeHide=calls.length;
  document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));render();
  assert.equal(result.playing,true);
  assert.equal(session.readPlayback().index,0);
  assert.ok(!calls.slice(beforeHide).some(c=>['pause','toggle'].includes(c.operation)));
  result.position.current.seconds=100;result.position.current.sampledAt=performance.now();
  localStatus={playing:false,ended:true,position:100};
  musicStatus={running:true,playing:false,track:null,position:0};
  await new Promise(r=>setTimeout(r,850));render();
  assert.equal(result.queue.index,1,`${source}: hidden queue advances`);
  assert.equal(result.playing,true);
  // A deliberate pause must not be undone by the background scheduler.
  await result.toggle();render();
  localStatus={playing:false,ended:false,position:12};
  musicStatus={running:true,playing:false,track:result.track,position:12};
  const beforePausedPoll=calls.length;
  await new Promise(r=>setTimeout(r,850));render();
  assert.equal(result.playing,false);
  assert.equal(result.queue.index,1);
  assert.ok(!calls.slice(beforePausedPoll).some(c=>c.operation==='play'));
 }finally{
  pollCleanup();saveCleanup();document.hidden=false;
 }
}
console.log('PASS: hidden local/Music playback persists without pausing, recurring polls advance both queues, explicit pause stays paused');
