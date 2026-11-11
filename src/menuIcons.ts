import {Image} from '@tauri-apps/api/image';
export type MenuSymbol='play'|'play-one'|'add'|'playlist'|'rename'|'delete'|'remove'|'up'|'down';
const paths:Record<MenuSymbol,string[]>={
 play:['M5 3 13 8 5 13Z'],
 'play-one':['M4 3 12 8 4 13Z','M14 4V12'],
 add:['M3 4H9M3 8H8M3 12H8','M12 7V13M9 10H15'],
 playlist:['M3 4H13M3 8H13M3 12H13'],
 rename:['M3 13 4 9 11 2 14 5 7 12 3 13Z','M9 4 12 7'],
 delete:['M3 4H13M6 4V2H10V4','M4 4 5 14H11L12 4M7 7V11M9 7V11'],
 remove:['M4 8H12'],
 up:['M8 13V3M4 7 8 3 12 7'],
 down:['M8 3V13M4 9 8 13 12 9'],
};
// Render at native menu size with Retina backing. Cache per system appearance;
// AppKit menus follow macOS appearance, independently of Bee's content theme.
const cache=new Map<string,Promise<Image>>();
export function menuIcon(symbol:MenuSymbol,submenu=false){
 const dark=matchMedia('(prefers-color-scheme: dark)').matches;
 const key=`${dark}:${symbol}:${submenu}`;
 let image=cache.get(key);
 if(!image){
  image=(async()=>{
   const size=submenu?16:32;
   const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
   const ctx=canvas.getContext('2d')!;ctx.scale(size/16,size/16);ctx.strokeStyle=dark?'#dedee2':'#48484c';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=1.25;ctx.lineCap='round';ctx.lineJoin='round';
   for(const path of paths[symbol])ctx.stroke(new Path2D(path));
   return Image.new(new Uint8Array(ctx.getImageData(0,0,size,size).data),size,size);
  })();cache.set(key,image);
  void image.catch(()=>cache.delete(key));
 }
 return image;
}
