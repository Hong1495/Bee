import {useSyncExternalStore} from 'react';
const listeners=new Set<()=>void>();
let observer:MutationObserver|undefined;
const snapshot=()=>document.documentElement.dataset.theme==='dark';
function subscribe(listener:()=>void){
 listeners.add(listener);
 if(!observer){observer=new MutationObserver(()=>listeners.forEach(fn=>fn()));observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});}
 return ()=>{listeners.delete(listener);if(!listeners.size){observer?.disconnect();observer=undefined;}};
}
export function useArtworkTheme(){return useSyncExternalStore(subscribe,snapshot);}
