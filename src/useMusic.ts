import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { resetArtworkSession } from './artworkCache';
import { albumKey, groupAlbums, type Album, type MusicPlaylist, type MusicTrack } from './data';

export type PlaybackPosition = { trackId:string; seconds:number; duration:number; playing:boolean; sampledAt:number };
type Snapshot = { running:boolean; playing:boolean; canPrevious:boolean; canNext:boolean; track:MusicTrack | null };
const request = <T,>(operation:string, id?:string, playlistId?:string) => invoke<T>('music_request', {operation, id:id ?? null, playlistId:playlistId ?? null});
export function useMusic() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState<Snapshot>({running:false, playing:false, canPrevious:false, canNext:false, track:null});
  const position = useRef<PlaybackPosition>({trackId:'', seconds:0, duration:0, playing:false, sampledAt:0});
  const generation = useRef(0);
  const connectedRef = useRef(false);
  const [transportBusy, setTransportBusy] = useState(false);
  const transportLock = useRef(false);
  const knownTrack = useRef<MusicTrack | null>(null);
  const refreshStatus = useCallback(async () => {
    if (!connectedRef.current) return;
    const token = generation.current;
    try {
      const previousTrack = knownTrack.current;
      const response = await request<Snapshot & {position:number; unchanged?:boolean}>('status', previousTrack?.id);
      const { position:seconds, unchanged, ...next } = response;
      if (unchanged) next.track = previousTrack;
      if (token === generation.current) {
        knownTrack.current = next.track;
        position.current = {trackId:next.track?.id ?? '', seconds:Number.isFinite(seconds) ? Math.max(0,seconds) : 0, duration:next.track?.duration ?? 0, playing:next.playing, sampledAt:performance.now()};
        setSnapshot(old => JSON.stringify(old) === JSON.stringify(next) ? old : next);
      }
    } catch (e) { if (token === generation.current) setError(String(e)); }
  }, []);
  const connect = useCallback(async () => {
    if (!isTauri()) { setError('请在 Bee macOS App 中连接“音乐”。'); return; }
    const token = ++generation.current;
    setBusy(true); setError('');
    try {
      await request('connect');
      const library = await request<{tracks:MusicTrack[]; playlists:MusicPlaylist[]}>('library');
      if (token !== generation.current) return;
      const records = groupAlbums(library.tracks);
      resetArtworkSession();
      setAlbums(records); setPlaylists(library.playlists);
      setConnected(true); connectedRef.current = true;
      setBusy(false);
      await refreshStatus();
    } catch (e) { if (token === generation.current) setError(String(e)); }
    finally { if (token === generation.current) setBusy(false); }
  }, [refreshStatus]);
  const disconnect = useCallback(async () => {
    ++generation.current; connectedRef.current = false; knownTrack.current = null;
    setConnected(false); setBusy(false); setAlbums([]); setPlaylists([]); setError('');
    setSnapshot({running:false, playing:false, canPrevious:false, canNext:false, track:null});
    position.current = {trackId:'', seconds:0, duration:0, playing:false, sampledAt:0};
    resetArtworkSession();
    await request('disconnect').catch(e => setError(String(e)));
  }, []);
  useEffect(() => {
    // Remove only the old demo preference keys, preserving appearance and layout.
    localStorage.removeItem('bee-favorites'); localStorage.removeItem('bee-recent'); localStorage.removeItem('bee-music-connected');
  }, []);
  useEffect(() => {
    if (!connected) return;
    let stopped = false;
    let timer:ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (!document.hidden) await refreshStatus();
      if (!stopped) timer = setTimeout(poll, 1500);
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [connected, refreshStatus]);
  const control = useCallback(async (operation: () => Promise<unknown>) => {
    if (!connectedRef.current || transportLock.current) return;
    transportLock.current = true; setTransportBusy(true);
    try { setError(''); await operation(); await refreshStatus(); }
    catch (e) { setError(String(e)); }
    finally { transportLock.current = false; setTransportBusy(false); }
  }, [refreshStatus]);
  const play = useCallback(async (record:Album, index=0, playlistId?:string) => {
    if (!record.tracks[index]) return;
    await control(() => invoke('music_request', {operation:'play', id:record.tracks[index].id,
      playlistId:playlistId ?? null, trackIds:record.tracks.map(song => song.id), sourceName:record.title}));
  }, [control]);
  const toggle = useCallback(() => control(() => request('toggle')), [control]);
  const skip = useCallback(async (direction:'previous' | 'next') => {
    if (direction === 'previous' ? !snapshot.canPrevious : !snapshot.canNext) return;
    await control(() => request(direction));
  }, [control, snapshot.canPrevious, snapshot.canNext]);
  const loadPlaylist = useCallback((id:string) => request<string[]>('playlist',id), []);
  const albumIndex = useMemo(() => new Map(albums.map(item => [item.id,item])), [albums]);
  const currentAlbum = useMemo(() => snapshot.track ? albumIndex.get(albumKey(snapshot.track)) ?? groupAlbums([snapshot.track])[0] : undefined, [snapshot.track, albumIndex]);
  const currentId = snapshot.track ? albumKey(snapshot.track) : '';
  return { transportBusy, canPrevious:snapshot.canPrevious, canNext:snapshot.canNext, position, albums, playlists, connected, busy, error, setError, connect, disconnect, play, toggle, skip, loadPlaylist,
    currentAlbum, currentId, track:snapshot.track, playing:snapshot.playing, running:snapshot.running };
}
