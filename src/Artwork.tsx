import { memo, useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';
import type { Album } from './data';
import { loadArtwork, peekArtwork } from './artworkCache';

// A single observer serves the entire shelf, including both faces of sleeves.
const visibleCallbacks = new Map<Element, () => void>();
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) {
    observer.unobserve(entry.target);
    visibleCallbacks.get(entry.target)?.();
    visibleCallbacks.delete(entry.target);
  }
}, {rootMargin:'200px'});
export const Artwork = memo(function Artwork({album, ...props}: {album:Album} & ImgHTMLAttributes<HTMLImageElement>) {
  const ref = useRef<HTMLImageElement>(null);
  const [image, setImage] = useState<{id:string;url:string} | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (peekArtwork(album.id) !== undefined) return;
    let cancelled = false;
    visibleCallbacks.set(node, () => { void loadArtwork(album).then(url => {
      if (!cancelled && url) setImage({id:album.id,url});
    }); });
    observer.observe(node);
    return () => { cancelled = true; observer.unobserve(node); visibleCallbacks.delete(node); };
  }, [album]);
  const cached = peekArtwork(album.id);
  return <img {...props} ref={ref} src={cached ?? (image?.id === album.id ? image.url : album.artwork)} decoding={cached ? 'sync' : 'async'}/>;
});
