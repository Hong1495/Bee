import { flushSync } from 'react-dom';
import { installUISounds, setUISoundsEnabled } from './uiSounds';
import { EmptyScore } from './EmptyScore';
import { Artwork } from './Artwork';
import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { Grid2X2, Columns3, Headphones, Users, ListMusic, PanelLeft, ArrowLeft, Disc3, Monitor, Moon, Play, Pause, SkipBack, SkipForward, Settings2, Sun } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke, isTauri } from '@tauri-apps/api/core';
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
import { trackMenu } from './trackMenu';
import { queueContentBacking } from './windowBacking';
import { ToolbarSearch } from './ToolbarSearch';
import { SortMenu } from './SortMenu';

type Page = 'library' | 'artists' | 'playlists' | 'playing' | 'settings';
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
  useEffect(()=>{setSelected(null);setQuery('');},[music.source]);
  const album = music.currentAlbum;
  const trackIndex = album?.tracks.findIndex(item => item.id === track?.id) ?? -1;
  const [preferencesRevision,setPreferencesRevision] = useState(0);
  const [playlistIds, setPlaylistIds] = useState<string[]>([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [themeMode, setTheme] = useState<'light' | 'dark' | 'system'>(() => read('bee-theme', 'light'));
  const [systemDark, setSystemDark] = useState(matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = themeMode === 'system' ? (systemDark ? 'dark' : 'light') : themeMode;
  const [query, setQuery] = useState('');
  const artists = useMemo(() => [...new Set(albums.map(item => item.artist))].sort((a, b) => a.localeCompare(b)), [albums]);
  const [artist, setArtist] = useState('');
  const [playlist, setPlaylist] = useState('');
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
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const openAlbum = useCallback((record: Album) => {
    returnScroll.current = scrollRef.current?.scrollTop ?? 0;
    transitionAlbum(() => setSelected(record), record.id, true);
  }, [transitionAlbum]);
  const closeAlbum = () => {
    const record = selectedRef.current;
    if (record) transitionAlbum(() => setSelected(null), record.id, false);
  };
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
    if (view === 'grid') { gridScroll.current = root.scrollTop; spineScroll.current = undefined; }
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
  const iconPath = '/icons/light.png';
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
  const navigate = (nextPage: Page) => { setPage(nextPage); setSelected(null); setQuery(''); };
  useEffect(() => { if (!artists.includes(artist)) setArtist(artists[0] ?? ''); }, [artists, artist]);
  useEffect(() => { if (!music.playlists.some(item => item.id === playlist)) setPlaylist(music.playlists[0]?.id ?? ''); }, [music.playlists, playlist]);
  useEffect(() => {
    let cancelled = false;
    setPlaylistIds([]);
    if (!playlist || !music.connected) { setPlaylistLoading(false); return; }
    setPlaylistLoading(true);
    music.loadPlaylist(playlist).then(ids => { if (!cancelled) setPlaylistIds(ids); })
      .catch(error => { if (!cancelled) music.setError(String(error)); })
      .finally(() => { if (!cancelled) setPlaylistLoading(false); });
    return () => { cancelled = true; };
  }, [playlist, music.connected, music.loadPlaylist]);
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
      if ((event.metaKey || event.ctrlKey) && event.key === ',') { event.preventDefault(); setSelected(null); setPage('settings'); return; }
      if ((event.metaKey || event.ctrlKey) && /^[1-4]$/.test(event.key)) { event.preventDefault(); setSelected(null); setPage((['playing','artists','library','playlists'] as Page[])[Number(event.key)-1]); return; }
      if (event.code === 'Space' && !['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(target.tagName)) { event.preventDefault(); void togglePlayback.current(); }
      if (event.key === 'Escape') { closeAlbum(); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, []);
  useLayoutEffect(() => {
    returnScroll.current = 0;
    spineScroll.current = undefined;
    gridScroll.current = 0; viewAnchor.current = undefined;
    viewAnimation.current?.cancel();
    scrollRef.current?.scrollTo({ top: 0 });
  }, [page, artist, playlist, query, sort]);
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: selected ? 0 : returnScroll.current, behavior: 'instant' });
  }, [selected]);


  const search = useDeferredValue(query.trim().toLowerCase());
  const searchIndex = useMemo(() => buildLibrarySearchIndex(albums), [albums]);
  const searchMatches = useMemo(() => matchLibrary(albums,searchIndex,search),[albums,searchIndex,search]);
  const searchResults = useMemo(() => selectSearchArtist(searchMatches,artist),[searchMatches,artist]);
  const shownAlbums = useMemo(() => [...(page === 'artists' ? searchResults.artistAlbums : searchResults.matches)]
    .sort((a,b) => sort === 'title' ? a.title.localeCompare(b.title, 'zh-CN') : sort === 'year' ? Number(b.year)-Number(a.year) : b.added-a.added), [page, searchResults, sort]);
  const trackLookup = useMemo(() => new Map(albums.flatMap(record => record.tracks.map((song,index) => [song.id,{record,song,index}] as const))), [albums]);
  const playlistTracks = useMemo(() => playlistIds.flatMap(id => { const item = trackLookup.get(id); return item ? [item] : []; }).filter(item => !search || `${item.song.title} ${item.record.artist} ${item.record.title}`.toLowerCase().includes(search)), [playlistIds,trackLookup,search]);
  const closeQueue = useCallback(() => setQueueOpen(false), []);
  const playlistName = music.playlists.find(item => item.id === playlist)?.name ?? '播放列表';
  const pageTitle = page === 'artists' ? searchResults.activeArtist || (search ? '搜索结果' : '艺术家') : page === 'library' ? '专辑' : page === 'playlists' ? playlistName : page === 'settings' ? '设置' : track?.title || '正在播放';
  const isCollection = ['library', 'artists', 'playlists'].includes(page);
  const navItems: { page: Page; label: string; icon: React.ReactNode }[] = [
    { page: 'playing', label: '正在播放', icon: <Headphones size={19}/> },
    { page: 'artists', label: '艺术家', icon: <Users size={19}/> },
    { page: 'library', label: '专辑', icon: <Disc3 size={19}/> },
    { page: 'playlists', label: '播放列表', icon: <ListMusic size={19}/> },
  ];

  return <div style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties} className={`app native-redesign ${visible ? '' : 'app-hidden'} ${sidebarOpen ? '' : 'sidebar-collapsed'} ${page === 'artists' || page === 'playlists' ? 'three-column' : ''}`}>
    <UpdateIndicator updater={updater} open={updateOpen} setOpen={setUpdateOpen}/>
    <aside className="sidebar">
      <div className={`window-chrome ${isTauri() ? 'native' : ''}`} onMouseDown={dragWindow}>
        {!isTauri() && <span className="preview-traffic-lights"><i/><i/><i/></span>}
        <IconButton label="隐藏侧栏" className="sidebar-toggle" onClick={() => setSidebarOpen(false)}><PanelLeft size={18}/></IconButton>
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
        <div className="toolbar-leading">{!sidebarOpen && <IconButton label="显示侧栏" onClick={() => setSidebarOpen(true)}><PanelLeft size={18}/></IconButton>}<span>{selected ? selected.title : pageTitle}</span></div>
        <div className="top-actions">{music.connected && isCollection && !selected && <><ToolbarSearch key={page} query={query} onChange={setQuery} label="搜索资料库"/>{page !== 'playlists' && <><SortMenu value={sort} onChange={setSort}/><div className="view-toggle" role="group" aria-label="专辑显示方式"><IconButton label="封面" active={view === 'grid'} onClick={() => changeView('grid')}><Grid2X2 size={17} aria-hidden="true"/></IconButton><IconButton label="封脊" active={view === 'spines'} onClick={() => changeView('spines')}><Columns3 size={18} aria-hidden="true"/></IconButton></div></>}</>}</div>
      </header>
      <div className="browser-body">
        {music.connected && page === 'artists' && <aside className="browser-column" aria-label="艺术家列表"><div className="column-list">{searchResults.artists.map(name => { return <button key={name} aria-pressed={searchResults.activeArtist === name} className={`artist-row ${searchResults.activeArtist === name ? 'selected' : ''}`} onClick={() => { setArtist(name); setSelected(null); }}><span>{name}</span></button>; })}{searchResults.artists.length === 0 && <EmptyScore compact label="未找到艺术家"/>}</div></aside>}
        {music.connected && page === 'playlists' && <aside className="browser-column" aria-label="播放列表"><div className="column-list">{music.playlists.map(item => <button className={`artist-row playlist-row ${playlist === item.id ? 'selected' : ''}`} aria-pressed={playlist === item.id} onClick={() => {setPlaylist(item.id);setSelected(null);setQuery('');}} key={item.id}><span className={`playlist-icon ${item.id}`}><ListMusic size={19}/></span><span>{item.name}</span></button>)}</div></aside>}
      <div className="main-scroll" ref={scrollRef}>
        {music.error && page!=='settings' && <div className="music-error" role="alert">{music.error}<button onClick={() => navigate('settings')}>查看设置</button></div>}
        {!music.connected && page !== 'settings' && <EmptyScore label="尚未连接音乐，可在设置中选择音乐库"/>}
        {music.connected && page === 'playing' && !album && <EmptyScore label="暂无正在播放的歌曲"/>}

        {music.connected && isCollection && page !== 'playlists' && !selected && <div className={`library-page ${view === 'spines' ? 'shelf-page' : ''}`}>
          {view === 'grid' ? <AlbumGrid albums={shownAlbums} showYear={page === 'artists'} onOpen={openAlbum} onPlay={startAlbum}/> : shownAlbums.length > 0 && <SpineBrowser albums={shownAlbums} onOpen={openAlbum} initialScroll={spineScroll.current} initialAlbumId={viewAnchor.current} onScrollPosition={saveSpineScroll}/>}
          {!shownAlbums.length && <EmptyScore label={query ? '没有符合条件的专辑' : '资料库暂无专辑'}/>}

        </div>}

        {music.connected && page === 'playlists' && !selected && <section className="playlist-content"><div className="playlist-actions"><button className="dark-button" disabled={playlistLoading || !playlistIds.length} onClick={() => void music.playPlaylist(playlist)}><Play size={14} fill="currentColor"/>播放</button></div><div className="playlist-table"><div className="playlist-table-head"><span>#</span><span>歌曲</span><span>专辑</span><span>时长</span></div>{playlistTracks.map(({record,song,index},row) => <button className={`playlist-song ${record.id === currentId && trackIndex === index ? 'current' : ''}`} key={`${song.id}-${row}`} onContextMenu={e=>{e.preventDefault();void trackMenu(e.clientX,e.clientY,()=>void music.playPlaylist(playlist,song.id),()=>void music.playTrack(record,index,true));}} onClick={() => music.playPlaylist(playlist,song.id)}><span className="song-number">{record.id === currentId && trackIndex === index && playing ? <span className="equalizer"><i/><i/><i/></span> : row+1}</span><span className="song-title"><Artwork album={record} alt=""/><span>{song.title}<small>{record.artist}</small></span></span><span className="song-album">{record.title}</span><span className="song-time">{time(song.duration)}</span></button>)}</div>{!playlistTracks.length && <EmptyScore label={playlistLoading ? '正在读取播放列表' : '暂无歌曲'}/>}</section>}

      {selected && <section className="album-detail-page"><button className="detail-back text-button" onClick={closeAlbum}><ArrowLeft size={17}/>返回</button><div className="album-detail-header" style={{ background: selected.color, color: selected.ink }}><div className="detail-record-art"><Vinyl album={selected}/><Artwork album={selected} alt={`${selected.title} 封面`}/></div><div><p>{selected.artist}</p><small>{selected.year} · {selected.genre} · {selected.tracks.length} 首歌曲</small><div className="detail-actions"><button className="dark-button" onClick={() => startAlbum(selected)}><Play size={14} fill="currentColor"/>播放</button><button className="outline-button" onClick={() => {navigate('playing');}}>进入播放页</button></div></div></div><div className="track-list">{selected.tracks.map((item, index) => <button className={`track-row ${currentId === selected.id && trackIndex === index ? 'current' : ''}`} key={item.id} onContextMenu={e=>{e.preventDefault();void trackMenu(e.clientX,e.clientY,()=>void music.playTrack(selected,index),()=>void music.playTrack(selected,index,true));}} onClick={() => music.playTrack(selected, index)}><span className="track-number">{currentId === selected.id && trackIndex === index && playing ? <span className="equalizer"><i/><i/><i/></span> : String(index + 1).padStart(2, '0')}</span><span>{item.title}</span><span>{time(item.duration)}</span><Play size={13}/></button>)}</div></section>}

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
          <footer className="preferences-about"><img src={iconPath} alt=""/><span>Bee<small>版本 {updater.version}</small></span></footer>
        </div>}
      </div>
      </div>
    </main>



    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}
