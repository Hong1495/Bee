import {useCallback,useSyncExternalStore} from 'react';
import {readRecordPalette,subscribeRecordPalette} from './recordPalette';
export function useArtworkPalette(id:string){
 const subscribe=useCallback((listener:()=>void)=>subscribeRecordPalette(id,listener),[id]);
 const snapshot=useCallback(()=>readRecordPalette(id),[id]);
 return useSyncExternalStore(subscribe,snapshot);
}
