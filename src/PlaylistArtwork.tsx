import { t, useLanguage } from './i18n';
import {Artwork} from './Artwork';
import {fallbackArtwork} from './fallbackArtwork';
import type {PlaylistCover} from './playlistCovers';
import {useArtworkTheme} from './useArtworkTheme';
import {sampleRecordPalette} from './recordPalette';
export function PlaylistArtwork({item,className=''}:{item:PlaylistCover;className?:string}){
  useLanguage();
 const dark=useArtworkTheme();
 return <span className={`playlist-artwork tiles-${item.covers.length} ${className}`} data-album-art={item.id} role="img" aria-label={t("{0} 播放列表封面", item.title)}>
  {item.covers.length?item.covers.map(album=><Artwork key={album.id} album={album} alt="" draggable={false}/>):<img src={fallbackArtwork(item.id,dark)} alt="" draggable={false} onLoad={event=>sampleRecordPalette(item.id,event.currentTarget)}/>}
 </span>;
}
