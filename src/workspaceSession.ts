export type Page = 'library' | 'artists' | 'playlists' | 'playing' | 'radio' | 'settings';
export type Location = {page:Page;albumId:string;playlist:string;artist:string;query:string;view:'grid'|'spines';sort:string;scroll:number;spine?:number};
export type WorkspaceSession = {version:1;source:string;sidebarOpen:boolean;radioExpanded:boolean;location:Location};
const key='bee-workspace-session';
const pages:Page[]=['library','artists','playlists','playing','radio','settings'];
const text=(v:unknown)=>typeof v==='string'?v.slice(0,4096):'';
const position=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,v):0;
export function readWorkspace():WorkspaceSession {
 let source='music';
 try{source=localStorage.getItem('bee-library-source')==='local'?'local':'music';}catch{}
 const fallback:WorkspaceSession={version:1,source,sidebarOpen:true,radioExpanded:false,location:{page:'library',albumId:'',playlist:'',artist:'',query:'',view:'grid',sort:'added',scroll:0}};
 try {
  fallback.location.view=JSON.parse(localStorage.getItem('bee-view')||'null')==='spines'?'spines':'grid';
  const saved=JSON.parse(localStorage.getItem(key)||'null');
  if(saved?.version!==1||!saved.location)return fallback;
  const l=saved.location;
  return {version:1,source,sidebarOpen:typeof saved.sidebarOpen==='boolean'?saved.sidebarOpen:true,radioExpanded:saved.radioExpanded===true,
   location:{page:pages.includes(l.page)?l.page:'library',albumId:saved.source===source?text(l.albumId):'',playlist:saved.source===source?text(l.playlist):'',artist:saved.source===source?text(l.artist):'',query:saved.source===source?text(l.query):'',view:l.view==='spines'?'spines':'grid',sort:['added','title','year'].includes(l.sort)?l.sort:'added',scroll:saved.source===source?position(l.scroll):0,spine:saved.source===source&&typeof l.spine==='number'?position(l.spine):undefined}};
 } catch {return fallback;}
}
export function saveWorkspace(session:WorkspaceSession){try{localStorage.setItem(key,JSON.stringify(session));}catch{/* Keep the active session usable when storage is unavailable. */}}
