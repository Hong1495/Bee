import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let now = 0, starts = 0, stops = 0, decodes = 0;
const exports = {}, listeners = new Map();
const document = {hidden:false,addEventListener(){},removeEventListener(){}};
class AudioContext {
  state='running'; currentTime=0; destination={};
  async decodeAudioData() { decodes++; return {}; }
  async resume() {this.state='running';}
  async suspend() {this.state='suspended';}
  createBufferSource() {return {connect(){return this;},disconnect(){},start(){starts++;},stop(){stops++;}};}
  createGain() {return {gain:{value:0,setTargetAtTime(){}},connect(){return this;},disconnect(){}};}
}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/uiSounds.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {
 exports,AudioContext,document,performance:{now:()=>now},window:{addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)},fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)})
});
const cleanup = exports.installUISounds();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(decodes,2);
exports.playUISound('flat-hover'); assert.equal(starts,1);
now=30; exports.playUISound('flat-hover'); assert.equal(starts,1);
now=180; exports.playUISound('natural-step'); assert.equal(starts,2); assert.equal(stops,1);
exports.setUISoundsEnabled(false); now=400; exports.playUISound('flat-hover'); assert.equal(starts,2);
exports.setUISoundsEnabled(true); document.hidden=true; exports.playUISound('natural-step'); assert.equal(starts,2);
cleanup(); assert.equal(listeners.size,0);
console.log('PASS: decode once, rate limit, overlapping voice fade, mute, background silence and listener cleanup');
