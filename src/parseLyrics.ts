export type LyricLine={time:number;text:string};
export function parseLrc(text:string):LyricLine[]{
 const offset=Number(text.match(/\[offset:([+-]?\d+)\]/i)?.[1]??0)/1000;
 const result:LyricLine[]=[];
 for(const line of text.split(/\r?\n/)){
  const tags=[...line.matchAll(/\[(\d+):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)];
  const words=line.replace(/\[[^\]]*\]/g,'').trim();
  for(const tag of tags){const seconds=Number(tag[2]);if(seconds>=60)continue;result.push({time:Math.max(0,Number(tag[1])*60+seconds+Number(`0.${tag[3]??0}`)+offset),text:words});}
 }
 return result.sort((a,b)=>a.time-b.time).filter((line,i,all)=>i===0||line.time!==all[i-1].time||line.text!==all[i-1].text);
}
export function lyricIndex(lines:LyricLine[],seconds:number){let low=0,high=lines.length;while(low<high){const mid=(low+high)>>>1;if(lines[mid].time<=seconds)low=mid+1;else high=mid;}return low-1;}
