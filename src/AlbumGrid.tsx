import { playUISound } from './uiSounds';
import { Artwork } from './Artwork';
import { memo, type ReactNode } from 'react';
import { Play } from 'lucide-react';
import type { Album } from './data';
import { Vinyl } from './Vinyl';

export const AlbumGrid = memo(function AlbumGrid({ albums, showYear, onOpen, onPlay, renderArtwork }: {
  albums: Album[]; showYear: boolean; onOpen: (album: Album) => void; onPlay: (album: Album) => void; renderArtwork?:(album:Album,className:string)=>ReactNode;
}) {
  return <div className="album-collection grid">{albums.map(item => <AlbumCard key={item.id} item={item} showYear={showYear} onOpen={onOpen} onPlay={onPlay} renderArtwork={renderArtwork}/>)}</div>;
});

const AlbumCard = memo(function AlbumCard({item,showYear,onOpen,onPlay,renderArtwork}:{item:Album;showYear:boolean;onOpen:(album:Album)=>void;onPlay:(album:Album)=>void;renderArtwork?:(album:Album,className:string)=>ReactNode}) {
  return <article className={`album-card ${renderArtwork?'playlist-card':''}`} key={item.id} onPointerEnter={event => { if (event.pointerType === 'mouse') playUISound('flat-hover'); }}>
    <div className="album-art">
      <button className="album-open" onClick={() => onOpen(item)} aria-label={`查看 ${item.title}`}>
        {!renderArtwork&&<div className="peek-record"><Vinyl album={item}/></div>}
        {renderArtwork?renderArtwork(item,'album-cover'):<Artwork className="album-cover" data-album-art={item.id} album={item} alt={`${item.title} 专辑封面`}/>}
      </button>
      <button className="album-play" disabled={renderArtwork&&'count' in item&&item.count===0} aria-label={`播放 ${item.title}`} title={`播放 ${item.title}`} onClick={() => onPlay(item)}><Play size={12} fill="currentColor" strokeWidth={1.5}/></button>
    </div>
    <button className="album-info" onClick={() => onOpen(item)}><h3>{item.title}</h3><p>{showYear ? item.year : item.artist}</p></button>
  </article>;
});
