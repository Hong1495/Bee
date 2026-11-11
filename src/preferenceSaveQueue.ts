// Serialize writes so a slower earlier request can never overwrite a newer edit.
// Queued requests keep running when the settings page is closed.
export function preferenceSaveQueue<T, R>(write: (value:T)=>Promise<R>) {
 let pending=Promise.resolve();
 const enqueue=(value:T):Promise<R>=>{
  const next=pending.then(()=>write(value));
  pending=next.then(()=>{},()=>{});
  return next;
 };
 return Object.assign(enqueue,{idle:()=>pending});
}
export function validProviderUrl(value:string) {
 try {const url=new URL(value);return url.protocol==='https:'&&!!url.hostname&&!url.username&&!url.password;} catch {return false;}
}
