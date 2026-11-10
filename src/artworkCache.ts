import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import type { Album } from './data';

// Shared across every sleeve/label: one request per album, bounded concurrency.
// Artwork never changes the library metadata or causes the whole app to render.
const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();
const queue: (() => Promise<void>)[] = [];
let active = 0;
let epoch = 0;
const pump = () => {
  while (active < 2 && queue.length) {
    active++;
    void queue.shift()!().finally(() => { active--; pump(); });
  }
};
export function resetArtworkSession() { epoch++; cache.clear(); pending.clear(); }
// Synchronous read for the first render after navigation. A cached cover must
// never regress to a placeholder while waiting for IntersectionObserver.
export function peekArtwork(albumId: string): string | null | undefined { return cache.get(albumId); }
export function loadArtwork(album: Album): Promise<string | null> {
  if (cache.has(album.id)) return Promise.resolve(cache.get(album.id)!);
  if (pending.has(album.id)) return pending.get(album.id)!;
  const token = epoch;
  const task = new Promise<string | null>((resolve) => {
    queue.push(async () => {
      try {
        if (token !== epoch) { resolve(null); return; }
        for (const song of album.tracks) {
          if (token !== epoch) { resolve(null); return; }
          const path = await invoke<string | null>('music_request', {operation:'artwork', id:song.id, playlistId:null});
          if (path) {
            const url = convertFileSrc(path);
            if (token === epoch) cache.set(album.id, url);
            resolve(url); return;
          }
        }
        if (token === epoch) cache.set(album.id, null);
        resolve(null);
      } catch { resolve(null); } // Keep a valid placeholder; retry on remount/refresh.
      finally { if (token === epoch) pending.delete(album.id); }
    });
  });
  pending.set(album.id, task); pump(); return task;
}
