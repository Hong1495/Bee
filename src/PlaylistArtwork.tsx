import {Artwork} from './Artwork';
import {fallbackArtwork} from './fallbackArtwork';
import type {PlaylistCover} from './playlistCovers';
export function PlaylistArtwork({item,className=''}:{item:PlaylistCover;className?:string}){
 return <span className={`playlist-artwork tiles-${item.covers.length} ${className}`} data-album-art={item.id} role="img" aria-label={`${item.title} 播放列表封面`}>
  {item.covers.length?item.covers.map(album=><Artwork key={album.id} album={album} alt="" draggable={false}/>):<img src={fallbackArtwork(item.id)} alt="" draggable={false}/>}
 </span>;
}
