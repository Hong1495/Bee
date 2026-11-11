import { flushSync } from 'react-dom';
import { installUISounds, setUISoundsEnabled } from './uiSounds';
import { EmptyScore } from './EmptyScore';
import { Artwork } from './Artwork';
import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { Grid2X2, Columns3, Headphones, Users, ListMusic, PanelLeft, ArrowLeft, ArrowRight, Disc3, Monitor, Moon, Play, Pause, SkipBack, SkipForward, Settings2, Sun, Plus, MoreHorizontal, ListPlus } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { time, type Album } from './data';
import { buildLibrarySearchIndex, matchLibrary, selectSearchArtist } from './librarySearch';
import { SpineBrowser } from './SpineBrowser';
import { Vinyl } from './Vinyl';
import { AlbumGrid } from './AlbumGrid';
import { SidebarDivider, clampSidebar } from './SidebarDivider';
import { useAlbumTransition } from './useAlbumTransition';
import { useMusic } from './useMusic';
import { Tonearm } from './Tonearm';
import { PlaybackQueue } from './PlaybackQueue';
import { useUpdater } from './useUpdater';
import { UpdateIndicator,UpdateSettings } from './UpdateUI';
import { MediaSettings } from './MediaSettings';
import { Lyrics } from './Lyrics';
import { trackMenu, actionMenu, type MenuAction } from './trackMenu';
import { PlaylistDialog, type PlaylistDialogState } from './PlaylistDialog';
import { PlaylistSongs } from './PlaylistSongs';
import {usePlaylistCovers} from './usePlaylistCovers';
import {PlaylistArtwork} from './PlaylistArtwork';
import type {PlaylistCover} from './playlistCovers';
import type { PlaylistEdit } from './useMusic';
import { queueContentBacking } from './windowBacking';
import { ToolbarSearch } from './ToolbarSearch';
import { SortMenu } from './SortMenu';

import {createNavigationHistory} from './navigationHistory';
import {suppressBrowserMenu} from './contextMenu';

type Page = 'library' | 'artists' | 'playlists' | 'playing' | 'settings';
type Location = {page:Page;albumId:string;playlist:string;artist:string;query:string;view:'grid'|'spines';sort:string;scroll:number;spine?:number};
const read = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
const IconButton = ({ label, children, onClick, active = false, className = '' }: { label: string; children: React.ReactNode; onClick?: () => void; active?: boolean; className?: string }) => <button type="button" className={`icon-button ${active ? 'active' : ''} ${className}`} aria-label={label} title={label} onClick={onClick}>{children}</button>;


export default function App() {
  const updater=useUpdater();
  const [updateOpen,setUpdateOpen]=useState(false);
  const [uiSounds, setUISounds] = useState(() => read('bee-ui-sounds', true));
  useEffect(() => installUISounds(), []);
  useEffect(() => { setUISoundsEnabled(uiSounds); localStorage.setItem('bee-ui-sounds', JSON.stringify(uiSounds)); }, [uiSounds]);
  const [page, setPage] = useState<Page>('library');
  const [selected, setSelected] = useState<Album | null>(null);
  const music = useMusic();
  const { albums, currentId, playing, track } = music;
  useEffect(()=>{setSelected(null);setQuery('');setPlaylistDialog(null);setAddingSongs(false);setPlaylist('');},[music.source]);
  const album = music.currentAlbum;
  const trackIndex = album?.tracks.findIndex(item => item.id === track?.id) ?? -1;
  const [preferencesRevision,setPreferencesRevision] = useState(0);
  const [loadedPlaylistIds, setPlaylistIds] = useState<string[]>([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [themeMode, setTheme] = useState<'light' | 'dark' | 'system'>(() => read('bee-theme', 'light'));
  const [systemDark, setSystemDark] = useState(matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = themeMode === 'system' ? (systemDark ? 'dark' : 'light') : themeMode;
  const [query, setQuery] = useState('');
  const artists = useMemo(() => [...new Set(albums.map(item => item.artist))].sort((a, b) => a.localeCompare(b)), [albums]);
  const [artist, setArtist] = useState('');
  const [playlist, setPlaylist] = useState('');
  const selectedCustomList=music.playlists.find(item=>item.id===playlist&&item.managed);
  const playlistIds=selectedCustomList?.trackIds??loadedPlaylistIds;
  const [playlistDialog,setPlaylistDialog]=useState<PlaylistDialogState|null>(null);
  const [addingSongs,setAddingSongs]=useState(false);
  const draggedSong=useRef<string|null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(() => clampSidebar(read<number>('bee-sidebar-width', 220)));
  const [view, setView] = useState<'grid' | 'spines'>(() => read('bee-view', 'grid'));
  const [sort, setSort] = useState('added');
  const [toast, setToast] = useState('');
  const [queueOpen, setQueueOpen] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const transitionAlbum = useAlbumTransition(scrollRef);
  const returnScroll = useRef(0);
  const gridScroll = useRef(0);
  const viewAnchor = useRef<string | undefined>(undefined);
  const viewAnimation = useRef<Animation | null>(null);
  useEffect(() => () => viewAnimation.current?.cancel(), []);
  const spineScroll = useRef<number | undefined>(undefined);
  const saveSpineScroll = useCallback((position: number) => { spineScroll.current = position; }, []);
  const location=useRef<Location>(null!);
  location.current={page,albumId:selected?.id??'',playlist,artist,query,view,sort,scroll:0,spine:spineScroll.current};
  const history=useRef(createNavigationHistory(location.current,(a,b)=>a.page===b.page&&a.albumId===b.albumId&&a.playlist===b.playlist&&a.artist===b.artist&&a.query===b.query));
  const [,refreshHistory]=useState(0);
  const pendingLocation=useRef<Location|null>(null);
  const latestLibrary=useRef({albums,lists:music.playlists,connected:music.connected});
  latestLibrary.current={albums,lists:music.playlists,connected:music.connected};
  const capture=useCallback(()=>({...location.current,scroll:scrollRef.current?.scrollTop??0,spine:spineScroll.current}),[]);
  const applyLocation=useCallback((next:Location)=>{
    const library=latestLibrary.current;
    const record=library.connected?library.albums.find(a=>a.id===next.albumId):undefined;
    const target={...next,albumId:record?.id??'',playlist:next.playlist};
    pendingLocation.current=target;spineScroll.current=target.spine;
    setPage(target.page);setSelected(record??null);setArtist(target.artist);setPlaylist(target.playlist);setQuery(target.query);setView(target.view);setSort(target.sort);
    setPlaylistDialog(null);setAddingSongs(false);setQueueOpen(false);
    refreshHistory(n=>n+1);
  },[]);
  const visit=useCallback((patch:Partial<Location>)=>{
    const current=capture(),next={...current,...patch,scroll:0};
    if(!history.current.visit(current,next))return;
    const opening=!!(next.albumId||next.playlist);
    const id=next.albumId||next.playlist||current.albumId||current.playlist;
    if(id)transitionAlbum(()=>applyLocation(next),id,opening);else applyLocation(next);
  },[capture,applyLocation,transitionAlbum]);
  const travelHistory=useCallback((offset:-1|1)=>{
    const current=capture(),entry=history.current.move(current,offset);if(!entry)return;
    const next={...entry,playlist:latestLibrary.current.lists.some(p=>p.id===entry.playlist)?entry.playlist:''};
    const id=next.albumId||next.playlist||current.albumId||current.playlist;
    if(id)transitionAlbum(()=>applyLocation(next),id,!!(next.albumId||next.playlist));else applyLocation(next);
  },[capture,applyLocation,transitionAlbum]);
  const openAlbum=useCallback((record:Album)=>visit({albumId:record.id}),[visit]);
  const closeAlbum=useCallback(()=>{if(location.current.albumId||location.current.playlist)travelHistory(-1);},[travelHistory]);
  useEffect(()=>{history.current.reset({...capture(),albumId:'',playlist:'',query:'',spine:undefined});spineScroll.current=undefined;refreshHistory(n=>n+1);},[music.source,capture]);
  const changeView = (next: 'grid' | 'spines') => {
    if (next === view) return;
    const root = scrollRef.current;
    if (!root) { setView(next); return; }
    viewAnimation.current?.cancel();
    const bounds = root.getBoundingClientRect();
    const covers = [...root.querySelectorAll<HTMLElement>('[data-album-art]')];
    const candidates = covers.map(node => ({node,rect:node.getBoundingClientRect()})).filter(({rect}) => rect.bottom > bounds.top && rect.top < bounds.bottom && rect.right > bounds.left && rect.left < bounds.right);
    candidates.sort((a,b) => view === 'grid' ? a.rect.top-b.rect.top || a.rect.left-b.rect.left : Math.abs(a.rect.left-bounds.left-bounds.width/2)-Math.abs(b.rect.left-bounds.left-bounds.width/2));
    viewAnchor.current = candidates[0]?.node.dataset.albumArt;
    if (view === 'grid') { gridScroll.current = root.scrollTop; spineScroll.current = undefined; viewAnchor.current=undefined; }
    flushSync(() => setView(next));
    if (next === 'grid') {
      root.scrollTop = gridScroll.current;
      const target = [...root.querySelectorAll<HTMLElement>('[data-album-art]')].find(node => node.dataset.albumArt === viewAnchor.current);
      if (target) {
        const rect = target.getBoundingClientRect();
        if (rect.bottom < bounds.top || rect.top > bounds.bottom) root.scrollTop += rect.top - bounds.top - 24;
      }
    }
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const layer = root.querySelector('.library-page');
      viewAnimation.current = layer?.animate([{opacity:.35},{opacity:1}], {duration:170,easing:'cubic-bezier(.22,.75,.2,1)'}) ?? null;
    }
  };
  const notify = (message: string) => setToast(message);
  const dragWindow = (event: MouseEvent<HTMLElement>) => {
    if (!isTauri() || event.button !== 0) return;
    const target = event.target as Element;
    if (target.closest('button, input, select, textarea, a, [role="button"]')) return;
    event.preventDefault();
    // Handle the second press before native dragging consumes the mouse events.
    if (event.detail === 2) {
      invoke('titlebar_double_click').catch(() => notify('窗口大小切换失败，请重试'));
      return;
    }
    getCurrentWindow().startDragging().catch(() => notify('窗口拖动失败，请重试'));
  };
  const startAlbum = music.playAlbum;
  const togglePlayback = useRef(music.toggle);
  togglePlayback.current = music.toggle;
  const navigate = useCallback((nextPage:Page)=>visit({page:nextPage,playlist:'',albumId:'',query:'',spine:undefined}),[visit]);
  const menuUpdater = useRef(updater);
  const menuUpdateRequested = useRef(false);
  menuUpdater.current = updater;
  useEffect(() => {
    if (!menuUpdateRequested.current || updater.phase === 'checking') return;
    menuUpdateRequested.current = false;
    if (updater.phase === 'error') setToast(updater.error || '检查更新失败，请重试');
    else if (updater.update) { setToast(''); setUpdateOpen(true); }
    else setToast('已是最新版本');
  }, [updater.phase, updater.update, updater.error]);
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<string>('bee-menu-action', ({payload}) => {
      if (disposed) return;
      if (payload !== 'bee-settings' && payload !== 'bee-check-updates') return;
      if (payload === 'bee-settings') navigate('settings');
      if (payload === 'bee-check-updates') {
        if (menuUpdater.current.update) setUpdateOpen(true);
        else {
          menuUpdateRequested.current = true;
          setToast('正在检查更新…');
          void menuUpdater.current.checkNow();
        }
      }
    }).then(stop => { if (disposed) stop(); else unlisten = stop; })
      .catch(error => setToast(`菜单连接失败：${String(error)}`));
    return () => { disposed = true; unlisten?.(); };
  }, []);
  useEffect(() => { if (!artists.includes(artist)) setArtist(artists[0] ?? ''); }, [artists, artist]);
  useEffect(() => { if (playlist&&!music.playlists.some(item => item.id === playlist)) setPlaylist(''); }, [music.playlists, playlist]);
  useEffect(() => {
    let cancelled = false;
    if(selectedCustomList){setPlaylistLoading(false);return;}
    setPlaylistIds([]);
    if (!playlist || !music.connected) { setPlaylistLoading(false); return; }
    setPlaylistLoading(true);
    music.loadPlaylist(playlist).then(ids => { if (!cancelled) setPlaylistIds(ids); })
      .catch(error => { if (!cancelled) music.setError(String(error)); })
      .finally(() => { if (!cancelled) setPlaylistLoading(false); });
    return () => { cancelled = true; };
  }, [playlist, music.connected, music.loadPlaylist,selectedCustomList]);
  useEffect(()=>{setAddingSongs(false);draggedSong.current=null;},[page,playlist]);
  useEffect(() => { if (!music.connected) setSelected(null); }, [music.connected]);
  useEffect(() => { setSelected(current => current ? albums.find(item => item.id === current.id) ?? current : null); }, [albums]);
  useEffect(() => {
    localStorage.setItem('bee-theme', JSON.stringify(themeMode));
    // Clear the native override so WebKit receives macOS appearance changes.
    if (isTauri()) getCurrentWindow().setTheme(themeMode === 'system' ? null : themeMode).catch(() => notify('窗口外观更新失败'));
  }, [themeMode]);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    if (isTauri()) queueContentBacking(theme === 'dark', sidebarOpen ? sidebarWidth : 0);
  }, [theme, sidebarOpen, sidebarWidth]);
  useEffect(() => { localStorage.setItem('bee-view', JSON.stringify(view)); }, [view]);
  useEffect(() => { document.documentElement.dataset.native = String(isTauri()); }, []);
  useEffect(() => { localStorage.removeItem('bee-icon'); }, []);
  useEffect(() => { const mq = matchMedia('(prefers-color-scheme: dark)'); const handler = () => setSystemDark(mq.matches); mq.addEventListener('change', handler); return () => mq.removeEventListener('change', handler); }, []);
  useEffect(() => { const handler = () => setVisible(!document.hidden); document.addEventListener('visibilitychange', handler); return () => document.removeEventListener('visibilitychange', handler); }, []);
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timeout); }, [toast]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('dialog')) return;
      if ((event.metaKey || event.ctrlKey) && event.key === ',') { event.preventDefault(); navigate('settings'); return; }
      if ((event.metaKey || event.ctrlKey) && /^[1-4]$/.test(event.key)) { event.preventDefault();navigate((['playing','artists','library','playlists'] as Page[])[Number(event.key)-1]); return; }
      if ((event.metaKey||event.altKey)&&!['INPUT','TEXTAREA','SELECT'].includes(target.tagName)&&['[',']','ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();travelHistory(event.key==='['||event.key==='ArrowLeft'?-1:1);return;}
      if (event.code === 'Space' && !['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(target.tagName)) { event.preventDefault(); void togglePlayback.current(); }
      if (event.key === 'Escape') { closeAlbum(); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, []);
  useLayoutEffect(() => {
    returnScroll.current = 0;
    spineScroll.current = pendingLocation.current?.spine;
    gridScroll.current = 0; viewAnchor.current = undefined;
    viewAnimation.current?.cancel();
    scrollRef.current?.scrollTo({ top: 0 });
  }, [page, artist, query, sort]);
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: selected || playlist ? 0 : returnScroll.current, behavior: 'instant' });
  }, [selected,playlist]);

  useLayoutEffect(()=>{
    const next=pendingLocation.current;if(!next)return;pendingLocation.current=null;
    spineScroll.current=next.spine;gridScroll.current=next.scroll;
    scrollRef.current?.scrollTo({top:next.scroll,behavior:'instant'});
    const shelf=scrollRef.current?.querySelector<HTMLElement>('.crate-browser');
    if(shelf&&next.spine!==undefined)shelf.scrollLeft=next.spine;
  });


  const search = useDeferredValue(query.trim().toLowerCase());
  const searchIndex = useMemo(() => buildLibrarySearchIndex(albums), [albums]);
  const searchMatches = useMemo(() => matchLibrary(albums,searchIndex,search),[albums,searchIndex,search]);
  const searchResults = useMemo(() => selectSearchArtist(searchMatches,artist),[searchMatches,artist]);
  const shownAlbums = useMemo(() => [...(page === 'artists' ? searchResults.artistAlbums : searchResults.matches)]
    .sort((a,b) => sort === 'title' ? a.title.localeCompare(b.title, 'zh-CN') : sort === 'year' ? Number(b.year)-Number(a.year) : b.added-a.added), [page, searchResults, sort]);
  const trackLookup = useMemo(() => new Map(albums.flatMap(record => record.tracks.map((song,index) => [song.id,{record,song,index}] as const))), [albums]);
  const playlistTracks = useMemo(() => playlistIds.flatMap(id => { const item = trackLookup.get(id); return item ? [item] : []; }).filter(item => !search || `${item.song.title} ${item.record.artist} ${item.record.title}`.toLowerCase().includes(search)), [playlistIds,trackLookup,search]);
  const playlistSummary = useMemo(() => {
    const artists = new Set<string>(), records = new Set<string>();
    let seconds = 0;
    for (const id of playlistIds) {
      const item = trackLookup.get(id);
      if (!item) continue;
      artists.add(item.record.artist); records.add(item.record.id);
      seconds += Number.isFinite(item.song.duration) ? Math.max(0,item.song.duration) : 0;
    }
    const names = [...artists].filter(Boolean);
    const minutes = Math.ceil(seconds / 60);
    const duration = minutes >= 60 ? `${Math.floor(minutes/60)} 小时${minutes%60 ? ` ${minutes%60} 分钟` : ''}` : `${minutes} 分钟`;
    return {artists:names.slice(0,3).join('、')+(names.length>3?' 等':''), details:[`${playlistIds.length} 首歌曲`,`${records.size} 张专辑`,...(seconds>0?[duration]:[])].join(' · ')};
  },[playlistIds,trackLookup]);
  const closeQueue = useCallback(() => setQueueOpen(false), []);
  const playlistCovers=usePlaylistCovers(music.source,music.playlists,albums,music.loadPlaylist,page==='playlists');
  const shownLists=useMemo(()=>playlistCovers.covers.filter(p=>!search||p.title.toLowerCase().includes(search)).sort((a,b)=>sort==='title'?a.title.localeCompare(b.title,'zh-CN'):0),[playlistCovers.covers,search,sort]);
  const renderPlaylistArt=useCallback((item:Album,className:string)=><PlaylistArtwork item={item as PlaylistCover} className={className}/>,[]);
  const openPlaylist=useCallback((item:Album)=>visit({playlist:item.id,albumId:'',query:''}),[visit]);
  const activeList=music.playlists.find(item=>item.id===playlist);
  const customLists=music.playlists.filter(item=>item.managed);
  const applyPlaylistEdit=(change:PlaylistEdit)=>{void music.editPlaylist(change).catch(e=>notify(String(e)));};
  const listActions=(list:NonNullable<typeof activeList>):MenuAction[]=>list.managed?[
    {text:'重命名…',icon:'rename' as const,action:()=>setPlaylistDialog({kind:'rename',list})},
    {text:'删除播放列表…',icon:'delete' as const,action:()=>setPlaylistDialog({kind:'delete',list})},
  ]:[];
  const addActions=(ids:string[]):MenuAction[]=>[...customLists.map(list=>({text:list.name,icon:'playlist' as const,enabled:!ids.every(id=>list.trackIds?.includes(id)),action:()=>{void music.editPlaylist({operation:'add',id:list.id,trackIds:ids}).then(()=>notify(`已添加到「${list.name}」`)).catch(e=>notify(String(e)));}})),{text:'新建播放列表…',icon:'add' as const,action:()=>setPlaylistDialog({kind:'create',ids})}];
  const songActions=(id:string,inList=false):MenuAction[]=>[
    {text:'添加到播放列表',icon:'add' as const,enabled:music.listsReady,children:addActions([id])},
    ...(inList&&activeList?.managed?[
      {text:'从播放列表移除',icon:'remove' as const,action:()=>applyPlaylistEdit({operation:'remove',id:playlist,trackIds:[id]})},
      {text:'上移',icon:'up' as const,enabled:!search&&playlistIds.indexOf(id)>0,action:()=>applyPlaylistEdit({operation:'move',id:playlist,trackIds:[id],beforeId:playlistIds[playlistIds.indexOf(id)-1]})},
      {text:'下移',icon:'down' as const,enabled:!search&&playlistIds.indexOf(id)<playlistIds.length-1,action:()=>applyPlaylistEdit({operation:'move',id:playlist,trackIds:[id],beforeId:playlistIds[playlistIds.indexOf(id)+2]})},
    ]:[]),
  ];
  const saveListDialog=async(target:string,name:string)=>{
    if(!playlistDialog)return;
    const {kind,list,ids}=playlistDialog;
    if(kind==='delete'||kind==='rename')await music.editPlaylist({operation:kind,id:list!.id,name});
    else if(kind==='add'&&target){await music.editPlaylist({operation:'add',id:target,trackIds:ids});notify('已添加到播放列表');}
    else {
      const id=`bee:${crypto.randomUUID()}`;
      await music.editPlaylist({operation:'create',id,name,trackIds:ids});
      if(kind==='create'){visit({page:'playlists',playlist:id,albumId:'',query:'',spine:undefined});}else notify('已添加到新播放列表');
    }
  };
  const playlistName = activeList?.name ?? '播放列表';
  const pageTitle = page === 'artists' ? searchResults.activeArtist || (search ? '搜索结果' : '艺术家') : page === 'library' ? '专辑' : page === 'playlists' ? playlistName : page === 'settings' ? '设置' : track?.title || '正在播放';
  const isCollection = ['library', 'artists', 'playlists'].includes(page);
  const navItems: { page: Page; label: string; icon: React.ReactNode }[] = [
    { page: 'playing', label: '正在播放', icon: <Headphones size={19}/> },
    { page: 'artists', label: '艺术家', icon: <Users size={19}/> },
    { page: 'library', label: '专辑', icon: <Disc3 size={19}/> },
    { page: 'playlists', label: '播放列表', icon: <ListMusic size={19}/> },
  ];

  return <div onContextMenu={suppressBrowserMenu} style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties} className={`app native-redesign ${visible ? '' : 'app-hidden'} ${sidebarOpen ? '' : 'sidebar-collapsed'} ${page === 'artists' ? 'three-column' : ''}`}>
    {playlistDialog&&<PlaylistDialog state={playlistDialog} lists={customLists} onSave={saveListDialog} onClose={()=>setPlaylistDialog(null)}/>}
    {addingSongs&&activeList?.managed&&<PlaylistSongs albums={albums} existing={playlistIds} onClose={()=>setAddingSongs(false)} onSave={ids=>music.editPlaylist({operation:'add',id:playlist,trackIds:ids})}/>}
    <UpdateIndicator updater={updater} open={updateOpen} setOpen={setUpdateOpen}/>
    <div className="window-navigation"><div className="history-navigation" role="group" aria-label="浏览导航"><button className="icon-button" aria-label="后退" title="后退（⌘[）" disabled={!history.current.canBack} onClick={()=>travelHistory(-1)}><ArrowLeft size={17} strokeWidth={1.5}/></button><button className="icon-button" aria-label="前进" title="前进（⌘]）" disabled={!history.current.canForward} onClick={()=>travelHistory(1)}><ArrowRight size={17} strokeWidth={1.5}/></button></div><IconButton label={sidebarOpen ? "隐藏侧栏" : "显示侧栏"} className="sidebar-toggle" onClick={() => setSidebarOpen(value=>!value)}><PanelLeft size={18}/></IconButton></div>
    <aside className="sidebar">
      <div className={`window-chrome ${isTauri() ? 'native' : ''}`} onMouseDown={dragWindow}>
        {!isTauri() && <span className="preview-traffic-lights"><i/><i/><i/></span>}
      </div>
      {['资料库', '播放'].map((group, index) => <section className="sidebar-group" key={group} aria-labelledby={`nav-group-${index}`}>
      <div className="nav-label" id={`nav-group-${index}`}>{group}</div>
      <nav aria-label={group}>{navItems.filter(item => (item.page === 'playing') === (group === '播放')).map(item => <button key={item.page} aria-label={item.label} aria-current={page === item.page ? 'page' : undefined} className={`nav-item ${page === item.page ? 'selected' : ''}`} onClick={() => navigate(item.page)}>{item.icon}<span>{item.label}</span>{item.page === 'playing' && playing && <span className="equalizer"><i/><i/><i/></span>}</button>)}</nav>
      </section>)}
      <div className="sidebar-bottom"><button aria-label="设置" className={`nav-item ${page === 'settings' ? 'selected' : ''}`} onClick={() => navigate('settings')}><Settings2 size={18}/><span>设置</span></button></div>
    </aside>

    {sidebarOpen && <SidebarDivider width={sidebarWidth} onChange={setSidebarWidth} onPreview={width => { if (isTauri()) queueContentBacking(theme === 'dark', width); }}/>}
    <main className="main">
      <header className="topbar" onMouseDown={dragWindow}>
        <div className="toolbar-leading"><span>{selected ? selected.title : pageTitle}</span></div>
        <div className="top-actions">{music.connected&&music.listsReady&&page==='playlists'&&!selected&&<>
          <IconButton label="新建播放列表" onClick={()=>setPlaylistDialog({kind:'create'})}><Plus size={18}/></IconButton>
          {activeList?.managed&&<IconButton label="添加歌曲" onClick={()=>setAddingSongs(true)}><ListPlus size={18}/></IconButton>}
          {activeList?.managed&&<button className="icon-button" title="播放列表操作" aria-label="播放列表操作" onClick={e=>{const r=e.currentTarget.getBoundingClientRect();void actionMenu(r.left,r.bottom+4,listActions(activeList));}}><MoreHorizontal size={18}/></button>}
        </>}{music.connected && isCollection && !selected && (page!=='playlists'||music.playlists.length>0) && <><ToolbarSearch key={page} query={query} onChange={setQuery} label="搜索资料库"/>{(page !== 'playlists'||!playlist) && <><SortMenu value={sort} onChange={setSort}/><div className="view-toggle" role="group" aria-label="专辑显示方式"><IconButton label="封面" active={view === 'grid'} onClick={() => changeView('grid')}><Grid2X2 size={17} aria-hidden="true"/></IconButton><IconButton label="封脊" active={view === 'spines'} onClick={() => changeView('spines')}><Columns3 size={18} aria-hidden="true"/></IconButton></div></>}</>}</div>
      </header>
      <div className="browser-body">
        {music.connected && page === 'artists' && <aside className="browser-column" aria-label="艺术家列表"><div className="column-list">{searchResults.artists.map(name => { return <button key={name} aria-pressed={searchResults.activeArtist === name} className={`artist-row ${searchResults.activeArtist === name ? 'selected' : ''}`} onClick={() => visit({artist:name,albumId:'',spine:undefined})}><span>{name}</span></button>; })}{searchResults.artists.length === 0 && <EmptyScore compact label="未找到艺术家"/>}</div></aside>}

      <div className="main-scroll" ref={scrollRef}>
        {music.error && page!=='settings' && <div className="music-error" role="alert">{music.error}<button onClick={() => navigate('settings')}>查看设置</button></div>}
        {!music.connected && page !== 'settings' && <EmptyScore label="尚未连接音乐，可在设置中选择音乐库"/>}
        {music.connected && page === 'playing' && !album && <EmptyScore label="暂无正在播放的歌曲"/>}

        {music.connected && isCollection && page !== 'playlists' && !selected && <div className={`library-page ${view === 'spines' ? 'shelf-page' : ''}`}>
          {view === 'grid' ? <AlbumGrid albums={shownAlbums} showYear={page === 'artists'} onOpen={openAlbum} onPlay={startAlbum}/> : shownAlbums.length > 0 && <SpineBrowser albums={shownAlbums} onOpen={openAlbum} initialScroll={spineScroll.current} onScrollPosition={saveSpineScroll}/>}
          {!shownAlbums.length && <EmptyScore label={query ? '没有符合条件的专辑' : '资料库暂无专辑'}/>}

        </div>}

        {music.connected&&page==='playlists'&&!playlist&&!selected&&<div className={`library-page playlist-library ${view==='spines'?'shelf-page':''}`}>
          {playlistCovers.error&&<p className="settings-error" role="alert">{playlistCovers.error}</p>}
          {view==='grid'?<AlbumGrid albums={shownLists} showYear={false} onOpen={openPlaylist} onPlay={item=>void music.playPlaylist(item.id)} renderArtwork={renderPlaylistArt}/>:shownLists.length>0&&<SpineBrowser albums={shownLists} onOpen={openPlaylist} initialScroll={spineScroll.current} onScrollPosition={saveSpineScroll} renderArtwork={renderPlaylistArt}/>}
          {!shownLists.length&&<EmptyScore label={query?'没有匹配的播放列表':'暂无播放列表'}/>}
        </div>}
        {music.connected && page === 'playlists' && !!playlist && !selected && <section className={`playlist-content ${!playlistTracks.length ? 'playlist-empty' : ''}`}>{playlistTracks.length>0&&<><div className="playlist-detail-header">{playlistCovers.covers.find(p=>p.id===playlist)&&<PlaylistArtwork item={playlistCovers.covers.find(p=>p.id===playlist)!} className="playlist-detail-cover"/>}<div className="playlist-detail-info"><p className="playlist-artists">{playlistSummary.artists}</p><p className="playlist-summary">{playlistSummary.details}</p><div className="detail-actions"><button className="detail-icon-action" title="播放列表" aria-label="播放列表" disabled={playlistLoading || !playlistIds.length} onClick={() => void music.playPlaylist(playlist)}><Play size={18} fill="currentColor"/></button></div></div></div><div className="playlist-table"><div className="playlist-table-head"><span>#</span><span>歌曲</span><span>专辑</span><span>时长</span></div>{playlistTracks.map(({record,song,index},row) => <button className={`playlist-song ${record.id === currentId && trackIndex === index ? 'current' : ''}`} key={`${song.id}-${row}`} draggable={!!activeList?.managed&&!search} onDragStart={e=>{draggedSong.current=song.id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',song.id);}} onDragEnd={()=>{draggedSong.current=null;document.querySelectorAll('[data-drop]').forEach(node=>node.removeAttribute('data-drop'));}} onDragOver={e=>{if(activeList?.managed&&!search&&draggedSong.current){e.preventDefault();e.dataTransfer.dropEffect='move';const r=e.currentTarget.getBoundingClientRect();e.currentTarget.dataset.drop=e.clientY>r.top+r.height/2?'after':'before';}}} onDragLeave={e=>{delete e.currentTarget.dataset.drop;}} onDrop={e=>{e.preventDefault();delete e.currentTarget.dataset.drop;const id=draggedSong.current;draggedSong.current=null;if(id&&id!==song.id){const r=e.currentTarget.getBoundingClientRect();const at=playlistIds.indexOf(song.id);applyPlaylistEdit({operation:'move',id:playlist,trackIds:[id],beforeId:e.clientY>r.top+r.height/2?playlistIds[at+1]:song.id});}}} onContextMenu={e=>{e.preventDefault();void trackMenu(e.clientX,e.clientY,()=>void music.playPlaylist(playlist,song.id),()=>void music.playTrack(record,index,true),songActions(song.id,true));}} onClick={() => music.playPlaylist(playlist,song.id)}><span className="song-number">{record.id === currentId && trackIndex === index && playing ? <span className="equalizer"><i/><i/><i/></span> : row+1}</span><span className="song-title"><Artwork album={record} alt=""/><span>{song.title}<small>{record.artist}</small></span></span><span className="song-album">{record.title}</span><span className="song-time">{time(song.duration)}</span></button>)}</div></>}{!playlistTracks.length && <EmptyScore label={playlistLoading ? '正在读取播放列表' : '暂无歌曲'}/>}</section>}

      {selected && <section className="album-detail-page"><div className="album-detail-header" style={{ background: selected.color, color: selected.ink }}><div className="detail-record-art"><Vinyl album={selected}/><Artwork album={selected} alt={`${selected.title} 封面`}/></div><div><p>{selected.artist}</p><small>{selected.year} · {selected.genre} · {selected.tracks.length} 首歌曲</small><div className="detail-actions"><button className="detail-icon-action" title="播放专辑" aria-label="播放专辑" onClick={()=>startAlbum(selected)}><Play size={18} fill="currentColor" strokeWidth={1.5}/></button><button className="detail-icon-action" title="添加到播放列表" aria-label="添加到播放列表" disabled={!music.listsReady} onClick={e=>{const r=e.currentTarget.getBoundingClientRect();void actionMenu(r.left,r.bottom+4,addActions(selected.tracks.map(t=>t.id)));}}><ListPlus size={19}/></button></div></div></div><div className="track-list">{selected.tracks.map((item, index) => <button className={`track-row ${currentId === selected.id && trackIndex === index ? 'current' : ''}`} key={item.id} onContextMenu={e=>{e.preventDefault();void trackMenu(e.clientX,e.clientY,()=>void music.playTrack(selected,index),()=>void music.playTrack(selected,index,true),songActions(item.id));}} onClick={() => music.playTrack(selected, index)}><span className="track-number">{currentId === selected.id && trackIndex === index && playing ? <span className="equalizer"><i/><i/><i/></span> : String(index + 1).padStart(2, '0')}</span><span>{item.title}</span><span>{time(item.duration)}</span><Play size={13}/></button>)}</div></section>}

        {music.connected && page === 'playing' && !selected && album && track && <section className="minimal-player" aria-label={track.title}>
          <div className="listening-stack">
          <div className="record-stage minimal-deck">
            <button type="button" className="stage-disc" aria-label={playing ? '点击唱片暂停' : '点击唱片播放'} aria-pressed={playing} title={playing ? '点击暂停' : '点击播放'} onClick={() => void togglePlayback.current()}>
              <Vinyl album={album} track={track} mounted playing={playing}/>
            </button>
            <button className="stage-sleeve" aria-label="查看当前专辑" onClick={() => openAlbum(album)}><Artwork data-album-art={album.id} album={album} alt={`${album.title} 封面`}/></button>
            <Tonearm playing={playing} trackId={track.id} position={music.position} onToggle={music.toggle}/>
          </div>
          <div className="listening-footer">
          <Lyrics track={track} position={music.position} revision={preferencesRevision}/>
          <div className="floating-transport" role="group" aria-label="播放控制" aria-busy={music.transportBusy}>
            <button type="button" aria-label="上一首" disabled={!music.canPrevious} title={music.canPrevious ? '上一首' : '没有上一首'} onClick={() => void music.skip('previous')}><SkipBack size={18} fill="currentColor"/></button>
            <button type="button" className="transport-primary" aria-label={playing ? '暂停' : '播放'} title={playing ? '暂停' : '播放'} onClick={() => void music.toggle()}>{playing ? <Pause size={21} fill="currentColor"/> : <Play size={21} fill="currentColor"/>}</button>
            <button type="button" aria-label="下一首" disabled={!music.canNext} title={music.canNext ? '下一首' : '没有下一首'} onClick={() => void music.skip('next')}><SkipForward size={18} fill="currentColor"/></button>
            <span className="transport-separator" aria-hidden="true"/>
            <button type="button" aria-label="待播放列表" title="待播放列表" aria-expanded={queueOpen} aria-controls="playback-queue" onClick={() => setQueueOpen(value => !value)}><ListMusic size={18}/></button>
            {queueOpen && <PlaybackQueue queue={music.queue} onSelect={music.jump} onClose={closeQueue}/>}

          </div>
          </div>
          </div>
        </section>}

        {page === 'settings' && <div className="preferences-page">
          <section className="preferences-section" aria-labelledby="appearance-heading">
            <h2 id="appearance-heading">外观</h2>
            <div className="preferences-group">
              <div className="preference-row"><span id="theme-label">界面外观</span><div className="appearance-picker" role="group" aria-labelledby="theme-label">
                <button aria-pressed={themeMode === 'light'} onClick={() => setTheme('light')}><Sun size={14}/>浅色</button>
                <button aria-pressed={themeMode === 'dark'} onClick={() => setTheme('dark')}><Moon size={14}/>深色</button>
                <button aria-pressed={themeMode === 'system'} onClick={() => setTheme('system')}><Monitor size={14}/>系统</button>
              </div></div>
            </div>
          </section>
          <section className="preferences-section" aria-labelledby="interaction-heading">
            <h2 id="interaction-heading">交互</h2>
            <div className="preferences-group"><div className="preference-row"><span id="ui-sound-label">浏览提示音</span><button type="button" className="sound-switch" role="switch" aria-checked={uiSounds} aria-labelledby="ui-sound-label" onClick={() => setUISounds(value => !value)}><span/></button></div></div>
          </section>
          <UpdateSettings updater={updater} onOpen={()=>setUpdateOpen(true)}/>
          <MediaSettings music={music} onPreferencesChanged={()=>setPreferencesRevision(value=>value+1)}/>
        </div>}
      </div>
      </div>
    </main>



    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}
