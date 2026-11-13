import { invoke } from '@tauri-apps/api/core';

// Coalesce pointer frames while the native main thread processes the last update.
let pending: { dark: boolean; sidebarWidth: number; classical: boolean } | undefined;
let running = false;
export function queueContentBacking(dark: boolean, sidebarWidth: number, classical = false) {
  pending = { dark, sidebarWidth, classical };
  if (running) return;
  running = true;
  void (async () => {
    try {
      while (pending) {
        const value = pending;
        pending = undefined;
        await invoke('set_content_backing', value);
      }
    } catch (error) { console.error('Window backing update failed', error); }
    finally { running = false; }
  })();
}
