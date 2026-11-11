import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { flushSync } from 'react-dom';

/** Local animations only. Perspective sleeves must never be stretched from
 * their projected bounding box into a square cover. */
export function useAlbumTransition(scrollRef: RefObject<HTMLDivElement | null>) {
  const animations = useRef<Animation[]>([]);
  const cancel = useCallback(() => { animations.current.forEach(animation => animation.cancel()); animations.current = []; }, []);
  useEffect(() => cancel, [cancel]);
  return useCallback((update: () => void, albumId: string, opening: boolean) => {
    cancel();
    const root = scrollRef.current;
    if (!root) { update(); return; }
    const artwork = (detail: boolean) => detail
      ? root.querySelector<HTMLElement>('.detail-record-art>img,.playlist-detail-cover')
      : [...root.querySelectorAll<HTMLElement>('[data-album-art]')].find(node => node.dataset.albumArt === albumId) ?? null;
    const sourceNode = artwork(!opening);
    const source = sourceNode?.getBoundingClientRect();
    const perspective = Boolean(sourceNode?.closest('.crate-browser,.minimal-deck'));
    flushSync(update); // React layout effects restore scroll before measurement.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animate = (node: Element | null, frames: Keyframe[], duration = 200) => {
      if (!node) return;
      const animation = node.animate(frames, {duration, easing:'cubic-bezier(.22,.75,.2,1)'});
      animations.current.push(animation);
      void animation.finished.then(() => { animations.current = animations.current.filter(item => item !== animation); }, () => {});
    };
    const target = artwork(opening);
    const destination = target?.getBoundingClientRect();
    const bounds = root.getBoundingClientRect();
    const flat = !perspective && !target?.closest('.crate-browser,.minimal-deck');
    const inViewport = (rect: DOMRect) => rect.bottom > bounds.top && rect.top < bounds.bottom && rect.right > bounds.left && rect.left < bounds.right;
    if (flat && source && destination && target && source.width > 24 && destination.width > 24 && inViewport(source) && inViewport(destination)) {
      // Uniform scale preserves the cover's aspect ratio; center coordinates
      // keep open and return motion aligned even when the grid has scrolled.
      animate(target, [
        {transformOrigin:'center',transform:`translate(${source.x + source.width/2 - destination.x - destination.width/2}px,${source.y + source.height/2 - destination.y - destination.height/2}px) scale(${source.width/destination.width})`},
        {transformOrigin:'center',transform:'translate(0,0) scale(1)'},
      ], 220);
    } else {
      animate(target, [{opacity:.25},{opacity:1}], 170);
    }
    const layers = opening ? root.querySelectorAll('.album-detail-header>div:last-child,.track-list,.playlist-table,.detail-back,.detail-record-art>.vinyl') : [];
    for (const layer of layers) animate(layer, [{opacity:0},{opacity:1}], 180);
  }, [scrollRef, cancel]);
}
