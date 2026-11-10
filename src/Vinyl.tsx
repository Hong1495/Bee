import { Artwork } from './Artwork';
import { memo, type CSSProperties } from 'react';
import type { Album } from './data';

export const Vinyl = memo(function Vinyl({ album, playing = false, className = '' }: { album: Album; playing?: boolean; className?: string }) {
  return <div className={`vinyl ${playing ? 'spinning' : ''} ${className}`} style={{ '--record-color': album.color } as CSSProperties}><div className="vinyl-glint"/><div className="record-label"><Artwork album={album} alt=""/><span className="spindle"/></div></div>;
});
