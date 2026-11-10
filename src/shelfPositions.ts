// Sorted sleeve centres: binary lookup avoids scanning the complete library on
// every wheel step. Compare neighbours to preserve the original tie behaviour.
export function lowerBound(values: number[], value: number) {
  let low=0, high=values.length;
  while(low<high){const mid=(low+high)>>>1;if(values[mid]<value)low=mid+1;else high=mid;}
  return low;
}
export function nearestShelfSlot(centers: number[], width: number, max: number, position: number) {
  const clamp=(n:number)=>Math.max(0,Math.min(max,n));
  if(!centers.length)return 0;
  const at=lowerBound(centers,position+width/2);
  const before=clamp(centers[Math.max(0,at-1)]-width/2);
  const after=clamp(centers[Math.min(at,centers.length-1)]-width/2);
  return Math.abs(after-position)<Math.abs(before-position)?after:before;
}
