export function createNavigationHistory<T>(initial:T,equal:(a:T,b:T)=>boolean){
 let entries=[initial],index=0;
 return {
  get canBack(){return index>0;},get canForward(){return index+1<entries.length;},
  visit(current:T,next:T){entries[index]=current;if(equal(current,next))return false;entries=entries.slice(0,index+1);entries.push(next);index++;if(entries.length>100){entries.shift();index--;}return true;},
  move(current:T,offset:-1|1){const target=index+offset;if(target<0||target>=entries.length)return null;entries[index]=current;index=target;return entries[index];},
  reset(current:T){entries=[current];index=0;},
 };
}
