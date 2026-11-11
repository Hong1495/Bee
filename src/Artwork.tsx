import { memo, useEffect, useRef, useState, type CSSProperties, type ImgHTMLAttributes } from 'react';
import type { Album } from './data';
import { loadArtwork, peekArtwork, forgetArtwork } from './artworkCache';
import {fallbackArtwork} from './fallbackArtwork';
import { sampleRecordPalette } from './recordPalette';
import {useArtworkPalette} from './useArtworkPalette';
import {useArtworkTheme} from './useArtworkTheme';

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
  const palette=useArtworkPalette(album.id);
  const dark=useArtworkTheme();
  const [revision,setRevision]=useState(0);
  useEffect(()=>{const reset=()=>{setImage(null);setRevision(v=>v+1);};window.addEventListener('bee-artwork-reset',reset);return()=>window.removeEventListener('bee-artwork-reset',reset);},[]);
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
  }, [album,revision]);
  const cached = peekArtwork(album.id);
  const failed = useRef('');
  const fallback=fallbackArtwork(album.id,dark);
  const [broken,setBroken]=useState('');
  const source=image?.id===album.id?image.url:cached??(album.artwork&&album.artwork!=='/artwork/placeholder.svg'?album.artwork:fallback);
  return <img {...props} className={`artwork-image ${props.className??''}`} style={{'--artwork-edge':palette.edge??palette.paper,'--artwork-edge-dark':palette.edgeDark??palette.paper,...props.style} as CSSProperties} crossOrigin="anonymous" onLoad={event => { sampleRecordPalette(album.id,event.currentTarget); props.onLoad?.(event); }} onError={() => { setBroken(source); if(failed.current===album.id)return;failed.current=album.id;forgetArtwork(album.id);void loadArtwork(album).then(url=>{if(url)setImage({id:album.id,url:url+'?reload='+Date.now()});}); }} ref={ref} src={broken===source?fallback:source} decoding={cached ? 'sync' : 'async'}/>;
});
