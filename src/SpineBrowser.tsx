import { playUISound } from './uiSounds';
import { Artwork } from './Artwork';
import { memo, forwardRef, useImperativeHandle, useState, useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import type { Album } from './data';
import { lowerBound, nearestShelfSlot } from './shelfPositions';

export const SpineBrowser = memo(function SpineBrowser({ albums, onOpen, initialScroll, onScrollPosition, renderArtwork }: { albums: Album[]; onOpen: (album: Album) => void; initialScroll?: number; onScrollPosition?: (position: number) => void; renderArtwork?:(album:Album,className:string)=>ReactNode }) {
  const caption = useRef<{show:(album:Album|null)=>void}>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const travel = useRef<(position: number) => void>(() => {});
  const suppressClick = useRef(false);
  const hoverMutedUntil = useRef(0);
  const albumKey = useMemo(()=>albums.map(album => album.id).join('|'),[albums]);
  const previousCollection = useRef(albumKey);

  const saveScroll = useRef(onScrollPosition);
  saveScroll.current = onScrollPosition;

  useLayoutEffect(() => {
    const restorePosition = previousCollection.current === albumKey;
    previousCollection.current = albumKey;
    caption.current?.show(null);
    const root = viewport.current;
    if (!root) return;
    const items = [...root.querySelectorAll<HTMLElement>('.crate-item')];
    const stack = root.querySelector<HTMLElement>('.crate-stack')!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let centers: number[] = [];
    let width = 0, max = 0, target = root.scrollLeft;
    let frame = 0, last = 0, animating = false;
    let measured = false;
    let lastSoundSlot = -1;
    let soundUntil = 0;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let wheelDelta = 0;
    let focusPosition = (items.length - 1) / 2;
    let drag: { id: number; x: number; origin: number; previous: number; time: number; velocity: number; moved: boolean } | null = null;
    const clamp = (value: number) => Math.max(0, Math.min(max, value));
    const lastTilts: string[] = [];
    const lastOrders: string[] = [];
    const paint = () => {
      const scrollLeft = root.scrollLeft;
      const eye = scrollLeft + width / 2;
      const spacing = centers.length > 1 ? centers[1] - centers[0] : 112;
      focusPosition = (eye - (centers[0] ?? 0)) / spacing;
      const slot = Math.max(0, Math.min(items.length - 1, Math.round(focusPosition)));
      if (slot !== lastSoundSlot) {
        if (lastSoundSlot >= 0 && performance.now() < soundUntil) playUISound('natural-step');
        lastSoundSlot = slot;
      }
      // Only update the sleeves near the viewport; offscreen transforms need
      // no per-frame writes even in a library with thousands of albums.
      const spacingForRange = centers.length > 1 ? centers[1] - centers[0] : 112;
      const first = Math.max(0, Math.floor((scrollLeft - (centers[0] ?? 0) - 400) / spacingForRange));
      const last = Math.min(items.length - 1, Math.ceil((scrollLeft + width - (centers[0] ?? 0) + 400) / spacingForRange));
      for (let index = first; index <= last; index++) {
        const item = items[index];
        // Perspective belongs to the shelf, not the window width. Resizing
        // must not rotate every sleeve as if the user were browsing.
        const distance = (centers[index] - eye) / 480;
        // A continuous curve keeps the eye-line crossing soft instead of snapping
        // to an angle at each item boundary. Faces recede away from the viewer.
        const tilt = reduced.matches || items.length === 1 ? 62 : 90 + Math.atan(distance * 1.3) * 29;
        const angle = `${tilt.toFixed(2)}deg`;
        const order = String(100 - Math.min(90, Math.round(Math.abs(distance) * 10)));
        if (lastTilts[index] !== angle) { item.style.setProperty('--tilt', angle); lastTilts[index] = angle; }
        if (lastOrders[index] !== order) { item.style.zIndex = order; lastOrders[index] = order; }
      }
    };
    const tick = (now: number) => {
      frame = 0;
      if (animating) {
        const dt = Math.min(40, last ? now - last : 16.7);
        const gap = target - root.scrollLeft;
        if (reduced.matches || Math.abs(gap) < .5) { root.scrollLeft = target; animating = false; }
        else root.scrollLeft += gap * (1 - Math.exp(-dt / 72));
      }
      last = now;
      paint();
      if (animating) frame = requestAnimationFrame(tick);
    };
    const schedule = () => { if (!frame) { last = 0; frame = requestAnimationFrame(tick); } };
    const move = (position: number) => { hoverMutedUntil.current = performance.now() + 180; target = clamp(position); animating = true; schedule(); };
    const nearestSlot = (position: number) => nearestShelfSlot(centers,width,max,position);
    const settle = () => move(nearestSlot(root.scrollLeft));
    travel.current = position => { soundUntil = performance.now() + 1600; move(position); };
    const measure = () => {
      clearTimeout(settleTimer);
      soundUntil = 0; lastSoundSlot = -1;
      const anchor = focusPosition;
      width = root.clientWidth;
      // Resolve against the viewport, not the intrinsic width of the flex row.
      // Symmetric end space lets both ends reach the centre without pushing
      // short collections to the right.
      const padding = Math.max(0, (width - 112) / 2);
      stack.style.paddingInline = `${padding}px`;
      stack.style.width = `${Math.max(width, items.length * 112 + padding * 2)}px`;
      max = Math.max(0, root.scrollWidth - width);
      // Sleeves use one fixed flex-basis. Read layout for two slots, then derive
      // the rest instead of asking WebKit for every album on every resize.
      const firstCenter = items[0] ? items[0].offsetLeft + items[0].offsetWidth/2 : 0;
      const stride = items[1] ? items[1].offsetLeft + items[1].offsetWidth/2 - firstCenter : 112;
      centers = items.map((_,index)=>firstCenter+index*stride);
      if (!measured) { root.scrollLeft = clamp((restorePosition ? initialScroll : undefined) ?? max / 2); measured = true; }
      else {
        const spacing = centers.length > 1 ? centers[1] - centers[0] : 112;
        root.scrollLeft = clamp((centers[0] ?? 0) + anchor * spacing - width / 2);
      }
      target = clamp(root.scrollLeft);
      animating = false;
      paint();
    };
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || !max) return;
      hoverMutedUntil.current = performance.now() + 180;
      soundUntil = performance.now() + 1600;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        // Let macOS trackpad momentum pass through without a second inertia layer.
        animating = false;
        target = root.scrollLeft;
        return;
      }
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? width : 1);
      wheelDelta += delta;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => { wheelDelta = 0; settle(); }, 140);
      if (Math.abs(wheelDelta) >= 32) {
        const direction = Math.sign(wheelDelta);
        const origin = nearestSlot(animating ? target : root.scrollLeft);
        let nextIndex = lowerBound(centers,origin + width/2 + direction);
        if(direction>0 && centers[nextIndex]===origin+width/2+1) nextIndex++;
        if(direction<0) nextIndex--;
        const next = centers[nextIndex];
        if (next !== undefined) move(next - width / 2);
        wheelDelta = 0;
      }
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || event.pointerType !== 'mouse') return;
      animating = false;
      clearTimeout(settleTimer);
      suppressClick.current = false;
      drag = { id: event.pointerId, x: event.clientX, origin: root.scrollLeft, previous: event.clientX, time: event.timeStamp, velocity: 0, moved: false };
    };
    const pointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      if (!drag.moved && Math.abs(event.clientX - drag.x) < 5) return;
      hoverMutedUntil.current = performance.now() + 180;
      if (!drag.moved) { drag.moved = true; root.setPointerCapture(event.pointerId); root.dataset.dragging = 'true'; }
      const dt = Math.max(1, event.timeStamp - drag.time);
      drag.velocity = .65 * drag.velocity + .35 * (drag.previous - event.clientX) / dt;
      soundUntil = performance.now() + 1600;
      drag.previous = event.clientX; drag.time = event.timeStamp;
      root.scrollLeft = clamp(drag.origin + drag.x - event.clientX);
      target = root.scrollLeft;
      suppressClick.current = true;
      event.preventDefault();
      schedule();
    };
    const up = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      if (drag.moved && event.type !== 'pointercancel') {
        const velocity = event.timeStamp - drag.time < 80 ? drag.velocity : 0;
        move(nearestSlot(root.scrollLeft + Math.max(-112, Math.min(112, velocity * 80))));
      }
      if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);
      delete root.dataset.dragging;
      drag = null;
    };
    const resize = new ResizeObserver(measure);
    resize.observe(root);
    const onScroll = () => {
      hoverMutedUntil.current = performance.now() + 180;
      saveScroll.current?.(root.scrollLeft); schedule();
      // Layout/restoration already chose its position. Only user scrolling
      // should snap; otherwise an even-sized centred collection shifts again.
      if (Math.abs(root.scrollLeft - target) < .5) return;
      if (!animating && !drag) { clearTimeout(settleTimer); settleTimer = setTimeout(settle, 140); }
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    root.addEventListener('wheel', wheel, { passive: false });
    root.addEventListener('pointerdown', down);
    root.addEventListener('pointermove', pointerMove);
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
    reduced.addEventListener('change', schedule);
    measure();
    return () => {
      cancelAnimationFrame(frame); resize.disconnect();
      clearTimeout(settleTimer);
      root.removeEventListener('scroll', onScroll); root.removeEventListener('wheel', wheel);
      root.removeEventListener('pointerdown', down); root.removeEventListener('pointermove', pointerMove);
      root.removeEventListener('pointerup', up); root.removeEventListener('pointercancel', up);
      reduced.removeEventListener('change', schedule);
    };
  }, [albumKey]);

  return <div className={`crate-layout ${renderArtwork?'playlist-crate':''}`}><div className="crate-browser" ref={viewport} aria-label="立体唱片架" onPointerLeave={()=>caption.current?.show(null)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))caption.current?.show(null);}}>
    <div className="crate-stack">
      {albums.map((album, index) => <button type="button" className="crate-item" key={album.id}
        onFocus={()=>caption.current?.show(album)}
        onPointerLeave={()=>caption.current?.show(null)}
        onPointerEnter={event => {
          if(event.pointerType==='mouse')caption.current?.show(album);
          if (event.pointerType === 'mouse' && !event.buttons && performance.now() >= hoverMutedUntil.current) {
            playUISound('flat-hover');
          }
        }}
        style={{ '--sleeve-color': album.color, '--sleeve-ink': album.ink } as CSSProperties}
        aria-label={`查看 ${album.title}`} onClick={event => {
          if (suppressClick.current && event.detail !== 0) { suppressClick.current = false; return; }
          onOpen(album);
        }}
        onKeyDown={event => {
          const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
          if (!offset && event.key !== 'Home' && event.key !== 'End') return;
          event.preventDefault();
          const indexToFocus = event.key === 'Home' ? 0 : event.key === 'End' ? albums.length - 1 : Math.max(0, Math.min(albums.length - 1, index + offset));
          const root = viewport.current;
          const item = root?.querySelectorAll<HTMLButtonElement>('.crate-item')[indexToFocus];
          if (root && item) {
            item.focus({ preventScroll: true });
            travel.current(item.offsetLeft + item.offsetWidth / 2 - root.clientWidth / 2);
          }
        }}>
        <span className="crate-sleeve">
          <span className="crate-cover" data-album-art={album.id}>{renderArtwork?<>{renderArtwork(album,'crate-front')}{renderArtwork(album,'crate-back')}</>:<><Artwork className="crate-front" album={album} alt="" draggable={false}/><Artwork className="crate-back" album={album} alt="" draggable={false}/></>}</span>
          <span className="crate-spine"><strong>{album.title}</strong><span>{album.artist}</span></span>
        </span>
      </button>)}
    </div>
  </div><AlbumCaption ref={caption}/></div>;
});

// Isolate hover text updates from the potentially large sleeve tree.
const AlbumCaption = forwardRef<{show:(album:Album|null)=>void}>(function AlbumCaption(_,ref){
 const [album,setAlbum]=useState<Album|null>(null);
 useImperativeHandle(ref,()=>({show:setAlbum}),[]);
 return <div className={`crate-caption ${album?'visible':''}`} aria-live="polite" aria-atomic="true">
  <div className="crate-caption-title">{album?.title}</div>
  <div className="crate-caption-artist">{album?[album.artist,album.year].filter(Boolean).join(' · '):''}</div>
 </div>;
});
