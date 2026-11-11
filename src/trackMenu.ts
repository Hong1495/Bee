import { Menu,MenuItem } from '@tauri-apps/api/menu';
import { LogicalPosition } from '@tauri-apps/api/dpi';
import { isTauri } from '@tauri-apps/api/core';
let current:Menu|null=null;
export type MenuAction={text:string;action:()=>void;enabled?:boolean};
export async function actionMenu(x:number,y:number,actions:MenuAction[]){
 if(!isTauri())return;
 await current?.close();
 const items=await Promise.all(actions.map(item=>MenuItem.new(item)));
 current=await Menu.new({items});await Promise.all(items.map(item=>item.close()));await current.popup(new LogicalPosition(x,y));
}
export function trackMenu(x:number,y:number,play:()=>void,only:()=>void,extra:MenuAction[]=[]){
 return actionMenu(x,y,[{text:'从此处播放',action:play},{text:'仅播放这首',action:only},...extra]);
}
