import {t} from './i18n';
import type {Album,MusicPlaylist} from './data';
export type PlaylistCover = Album & {covers:Album[];count:number|undefined};
export function playlistCover(list:MusicPlaylist,ids:readonly string[]|undefined,byTrack:Map<string,Album>):PlaylistCover {
 const covers:Album[]=[];const seen=new Set<string>();
 for(const id of ids??[]){const album=byTrack.get(id);if(album&&!seen.has(album.id)){seen.add(album.id);covers.push(album);if(covers.length===4)break;}}
 return {id:list.id,title:list.name,artist:ids?t('{0} 首歌曲', ids.length):t('播放列表'),year:'',genre:'',color:'#b8bdc5',ink:'#30343b',artwork:'',added:0,tracks:[],covers,count:ids?.length};
}
