import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
// Render App's real state/effects with controlled IPC latency and a scroll surface.
const store=new Map();
let slots=[],cursor=0,dirty=false,layout=[],effects=[],tree,music;
const document=new EventTarget();Object.assign(document,{hidden:false,documentElement:{dataset:{}}});
const window=new EventTarget();
const root=new EventTarget();Object.assign(root,{scrollTop:0,scrollTo({top}){this.scrollTop=top;},querySelector(){return null;}});
const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
const React={
 useState(init){const i=cursor++;slots[i]??={value:typeof init==='function'?init():init};return [slots[i].value,v=>{const next=typeof v==='function'?v(slots[i].value):v;if(!Object.is(next,slots[i].value)){slots[i].value=next;dirty=true;}}];},
 useRef(initial){const i=cursor++;slots[i]??={current:initial};return slots[i];},
 useMemo(fn,deps){const i=cursor++;if(!slots[i]||!equal(slots[i].deps,deps))slots[i]={value:fn(),deps};return slots[i].value;},
 useCallback(fn,deps){return this.useMemo(()=>fn,deps);},
 useDeferredValue(value){return value;},
 useEffect(fn,deps){schedule(effects,fn,deps);},useLayoutEffect(fn,deps){schedule(layout,fn,deps);},
};
// Calls are destructured by the compiled module.
React.useCallback=(fn,deps)=>React.useMemo(()=>fn,deps);
function schedule(queue,fn,deps){const i=cursor++;if(slots[i]&&equal(slots[i].deps,deps))return;const previous=slots[i];slots[i]={deps};queue.push(()=>{previous?.cleanup?.();slots[i].cleanup=fn();});}
const jsx=(type,props)=>({type,props});
const nothing=()=>null;
const generic=new Proxy({}, {get:(_,name)=>name==='useUpdater'?()=>({phase:'idle'}):name==='useSidebarPeek'?()=>({open:false,dismiss(){},trigger:{},panel:{}}):name==='useAlbumTransition'?()=>fn=>fn():name==='usePlaylistCovers'?()=>({covers:[],error:''}):name==='clampSidebar'?v=>v:nothing});
const load=file=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:resolve,localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},document,window,matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),console,setTimeout,clearTimeout});return exports;};
let workspace,search,history;
function resolve(name){if(name==='react')return React;if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};if(name==='react-dom')return {flushSync:fn=>fn()};if(name==='./i18n')return {t:x=>x,useLanguage:()=> 'zh-Hans',languages:[]};if(name==='./useMusic')return {useMusic:()=>music};if(name==='./workspaceSession')return workspace;if(name==='./librarySearch')return search;if(name==='./navigationHistory')return history;if(name==='./radio')return {radioStations:[{id:'classical',label:'综合古典'}]};if(name==='@tauri-apps/api/core')return {isTauri:()=>false};return generic;}
workspace=load('src/workspaceSession.ts');search=load('src/librarySearch.ts');history=load('src/navigationHistory.ts');
const App=load('src/App.tsx').default;
function nodes(node,result=[]){if(Array.isArray(node)){for(const n of node)nodes(n,result);}else if(node?.props){result.push(node);nodes(node.props.children,result);}return result;}
function render(){let rounds=0;do{if(++rounds>20)throw Error('render loop');dirty=false;cursor=0;layout=[];effects=[];tree=App();for(const node of nodes(tree))if(node.props.className==='main-scroll')node.props.ref.current=root;for(const effect of layout)effect();for(const effect of effects)effect();}while(dirty);}
const saved=()=>JSON.parse(store.get('bee-workspace-session'));
const record={id:'album:1',title:'Concertos',artist:'Bach',year:1720,tracks:[],color:'',ink:'',added:1};
const seed=(location,sidebarOpen=false)=>({version:1,source:'music',sidebarOpen,radioExpanded:true,location:{page:'library',albumId:'',playlist:'',artist:'',query:'',sort:'added',view:'grid',scroll:0,...location}});
function mount(session){for(const slot of slots)slot?.cleanup?.();slots=[];root.scrollTop=0;store.clear();store.set('bee-workspace-session',JSON.stringify(session));music={source:'music',albums:[],playlists:[],queue:{tracks:[]},radio:{station:null,phase:'idle'},lastRadioStation:{id:'classical',label:'综合古典'},connected:false,libraryReady:false,busy:true,folderBusy:false,listsReady:false,folders:[],folderWarnings:[],loadPlaylist:async()=>[],setError(){},position:{current:{}},radioVolume:.7};render();}
function navigate(page){const button=nodes(tree).find(n=>n.type==='button'&&n.props.className?.startsWith('nav-item')&&n.props['aria-label']===page);assert.ok(button,page);button.props.onClick();render();}
mount(seed({page:'library',albumId:record.id,scroll:240}));
assert.equal(saved().location.albumId,record.id);assert.equal(saved().location.scroll,240);assert.equal(saved().sidebarOpen,false);
music={...music,albums:[record],connected:true,libraryReady:true,busy:false,listsReady:true};render();assert.equal(root.scrollTop,240);assert.ok(nodes(tree).some(n=>n.props.className==='album-detail-page'));
// A refreshed Album object must not reset the user's current detail scroll.
root.scrollTop=310;music={...music,albums:[{...record}]};render();assert.equal(root.scrollTop,310);
root.dispatchEvent(new Event('scroll'));assert.equal(saved().location.scroll,310);
const back=nodes(tree).find(n=>n.type==='button'&&n.props['aria-label']==='后退');assert.equal(back.props.disabled,false);back.props.onClick();render();assert.equal(saved().location.albumId,'');
const toggle=nodes(tree).find(n=>n.type==='button'&&n.props.className==='icon-button sidebar-toggle');toggle.props.onClick();render();assert.equal(saved().sidebarOpen,true);
mount(seed({page:'library',albumId:record.id,scroll:240}));navigate('正在播放');music={...music,albums:[record],connected:true,libraryReady:true,busy:false,listsReady:true};render();assert.equal(saved().location.page,'playing');assert.equal(saved().location.albumId,'');assert.equal(root.scrollTop,0);
mount(seed({page:'library',albumId:'deleted',scroll:240}));music={...music,connected:true,libraryReady:true,busy:false,listsReady:true};render();assert.equal(saved().location.page,'library');assert.equal(saved().location.albumId,'');
// A playlist's shell arrives before membership; do not consume its scroll yet.
let finish;const delayed=new Promise(resolve=>{finish=resolve;});
mount(seed({page:'playlists',playlist:'list:1',scroll:480}));music={...music,connected:true,libraryReady:true,busy:false,listsReady:true,playlists:[{id:'list:1',name:'List'}],loadPlaylist:()=>delayed};render();assert.equal(saved().location.scroll,480);assert.equal(root.scrollTop,0);
finish([]);await new Promise(resolve=>setImmediate(resolve));render();assert.equal(root.scrollTop,480);
// A late response after explicit navigation cannot reopen the old list.
let late;mount(seed({page:'playlists',playlist:'list:1',scroll:480}));music={...music,connected:true,libraryReady:true,busy:false,listsReady:true,playlists:[{id:'list:1',name:'List'}],loadPlaylist:()=>new Promise(resolve=>{late=resolve;})};render();navigate('古典电台');late([]);await new Promise(resolve=>setImmediate(resolve));render();assert.equal(saved().location.page,'radio');assert.equal(saved().location.playlist,'');
mount(seed({page:'artists',artist:'Bach',albumId:record.id,query:'concerto',scroll:200}));music={...music,source:'local',busy:false};render();assert.equal(saved().source,'local');assert.equal(saved().location.albumId,'');assert.equal(saved().location.query,'');assert.equal(saved().sidebarOpen,false);
console.log('PASS: actual App delayed-library/detail restore, scroll persistence, refresh stability, deleted album fallback, delayed playlist membership, late-response navigation cancellation and source switch');
