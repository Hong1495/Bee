// Stable assignment: navigation, restarts and appearance changes keep the same art.
export function fallbackArtwork(id:string){
 let hash=2166136261;
 for(let i=0;i<id.length;i++)hash=Math.imul(hash^id.charCodeAt(i),16777619);
 return `/artwork/notation/${String((hash>>>0)%48).padStart(2,'0')}.svg`;
}
