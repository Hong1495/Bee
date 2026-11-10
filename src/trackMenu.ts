import { Menu,MenuItem } from '@tauri-apps/api/menu';
import { LogicalPosition } from '@tauri-apps/api/dpi';
import { isTauri } from '@tauri-apps/api/core';
let current:Menu|null=null;
export async function trackMenu(x:number,y:number,play:()=>void,only:()=>void){
 if(!isTauri())return;
 await current?.close();
 const items=await Promise.all([MenuItem.new({text:'从此处播放',action:play}),MenuItem.new({text:'仅播放这首',action:only})]);
 current=await Menu.new({items});await Promise.all(items.map(item=>item.close()));await current.popup(new LogicalPosition(x,y));
}
