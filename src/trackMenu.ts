import { Menu,MenuItem,IconMenuItem,Submenu } from '@tauri-apps/api/menu';
import { LogicalPosition } from '@tauri-apps/api/dpi';
import { isTauri } from '@tauri-apps/api/core';
import {menuIcon,type MenuSymbol} from './menuIcons';
let current:Menu|null=null;
export type MenuAction={text:string;icon?:MenuSymbol;action?:()=>void;enabled?:boolean;children?:MenuAction[]};
async function build(item:MenuAction):Promise<MenuItem|IconMenuItem|Submenu>{
 const icon=item.icon?await menuIcon(item.icon):undefined;
 if(!item.children){const options={text:item.text,enabled:item.enabled,action:item.action};return icon?IconMenuItem.new({...options,icon}):MenuItem.new(options);}
 const items=await Promise.all(item.children.map(build));
 const menu=await Submenu.new({text:item.text,enabled:item.enabled,items,icon});
 await Promise.all(items.map(item=>item.close()));return menu;
}
export async function actionMenu(x:number,y:number,actions:MenuAction[]){
 if(!isTauri())return;
 await current?.close();
 const items=await Promise.all(actions.map(build));
 current=await Menu.new({items});await Promise.all(items.map(item=>item.close()));await current.popup(new LogicalPosition(x,y));
}
export function trackMenu(x:number,y:number,play:()=>void,only:()=>void,extra:MenuAction[]=[]){
 return actionMenu(x,y,[{text:'从此处播放',icon:'play',action:play},{text:'仅播放这首',icon:'play-one',action:only},...extra]);
}
