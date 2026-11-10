import { playUISound } from './uiSounds';
import { Artwork } from './Artwork';
import { memo } from 'react';
import { Play } from 'lucide-react';
import type { Album } from './data';
import { Vinyl } from './Vinyl';

export const AlbumGrid = memo(function AlbumGrid({ albums, showYear, onOpen, onPlay }: {
  albums: Album[]; showYear: boolean; onOpen: (album: Album) => void; onPlay: (album: Album) => void;
}) {
  return <div className="album-collection grid">{albums.map(item => <article className="album-card" key={item.id} onPointerEnter={event => { if (event.pointerType === 'mouse') playUISound('flat-hover'); }}>
    <div className="album-art">
      <button className="album-open" onClick={() => onOpen(item)} aria-label={`查看 ${item.title}`}>
        <div className="peek-record"><Vinyl album={item}/></div>
        <Artwork className="album-cover" data-album-art={item.id} album={item} alt={`${item.title} 专辑封面`}/>
      </button>
      <button className="album-play" aria-label={`播放 ${item.title}`} onClick={() => onPlay(item)}><Play size={17} fill="currentColor"/></button>
    </div>
    <button className="album-info" onClick={() => onOpen(item)}><h3>{item.title}</h3><p>{showYear ? item.year : item.artist}</p></button>
  </article>)}</div>;
});
