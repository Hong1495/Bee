import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={}, timers=new Map();let timerId=0;
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/radio.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)});
const states=[],audios=[];
const session=new exports.RadioSession(s=>states.push(s),()=>{
 const audio={src:'',volume:1,paused:false,play(){return Promise.resolve();},pause(){this.paused=true;},removeAttribute(){this.src='';},load(){}};
 audios.push(audio);return audio;
});
const phase=()=>states.at(-1).phase;
const tick=()=>{const [id,fn]=timers.entries().next().value;timers.delete(id);fn();};
session.start(exports.radioStations[0]);assert.equal(phase(),'connecting');
const oldPlaying=audios[0].onplaying;audios[0].onplaying();assert.equal(phase(),'playing');assert.equal(timers.size,0);
audios[0].onwaiting();assert.equal(phase(),'buffering');assert.equal(timers.size,1);
// Repeated stall events must not postpone the timeout forever.
const firstTimer=[...timers.keys()][0];audios[0].onstalled();assert.equal([...timers.keys()][0],firstTimer);
session.start(exports.radioStations[1]);assert.equal(audios[0].paused,true);assert.equal(audios[0].src,'');oldPlaying();assert.equal(phase(),'connecting');
session.setVolume(.25);assert.equal(audios[1].volume,.25);
audios[1].onerror();assert.equal(phase(),'retrying');tick();assert.equal(audios.length,3);assert.equal(audios[2].volume,.25);
audios[2].onerror();tick();audios[3].onerror();assert.equal(phase(),'error');assert.equal(timers.size,0);
session.start(exports.radioStations[2]);tick();assert.equal(phase(),'retrying');session.stop();assert.equal(phase(),'stopped');assert.equal(timers.size,0);
session.start(exports.radioStations[3]);audios.at(-1).onplaying();session.clear();assert.equal(states.at(-1).station,null);assert.equal(phase(),'idle');assert.equal(audios.at(-1).paused,true);
session.start(exports.radioStations[0]);session.dispose();assert.equal(timers.size,0);assert.equal(audios.at(-1).src,'');
console.log('PASS: live connection ownership, stale events, stall timeout, bounded retries, stop cancellation, volume and disposal');
