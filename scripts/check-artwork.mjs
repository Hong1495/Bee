import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let calls = 0, active = 0, peak = 0;
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/artworkCache.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {
  exports, require:() => ({convertFileSrc:path => `asset:${path}`,invoke:async (_,args) => {
    calls++; active++; peak = Math.max(peak,active);
    await new Promise(resolve => setTimeout(resolve,5)); active--;
    return args.id === 'missing' ? null : `/cache/${args.id}.jpg`;
  }})
});
const album = id => ({id,tracks:[{id}]});
const first = exports.loadArtwork(album('a'));
assert.equal(first,exports.loadArtwork(album('a')));
await Promise.all([first,...Array.from({length:20},(_,i) => exports.loadArtwork(album(`b${i}`)))]);
assert.equal(peak,2); assert.equal(calls,21);
assert.equal(await exports.loadArtwork(album('a')),'asset:/cache/a.jpg'); assert.equal(calls,21);
assert.equal(await exports.loadArtwork({id:'fallback',tracks:[{id:'missing'},{id:'good'}]}),'asset:/cache/good.jpg');
assert.equal(await exports.loadArtwork(album('missing')),null);
const afterMissing = calls; await exports.loadArtwork(album('missing')); assert.equal(calls,afterMissing);
const stale = exports.loadArtwork(album('stale')); exports.resetArtworkSession(); await stale;
const beforeRetry = calls; await exports.loadArtwork(album('stale')); assert.equal(calls,beforeRetry+1);
console.log('PASS: bounded concurrency, duplicate coalescing, cache hits, alternate-track fallback, negative cache, stale-session rejection');
assert.equal(exports.peekArtwork('stale'),'asset:/cache/stale.jpg');
const beforePeek = calls;
assert.equal(exports.peekArtwork('not-loaded'),undefined);
assert.equal(calls,beforePeek);
exports.resetArtworkSession();
assert.equal(exports.peekArtwork('stale'),undefined);
console.log('PASS: synchronous cache reads support first-frame remounts without IPC and clear on session reset');

const paletteModule = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/recordPalette.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {exports:paletteModule});
const solid = (r,g,b,n=100) => Array.from({length:n},()=>[r,g,b,255]).flat();
assert.equal(paletteModule.paletteFromPixels([]),paletteModule.defaultPalette);
assert.equal(paletteModule.paletteFromPixels([255,0,0,0]),paletteModule.defaultPalette);
assert.equal(paletteModule.paletteFromPixels(solid(245,245,245)).ink,'#171715');
assert.equal(paletteModule.paletteFromPixels(solid(10,20,35)).ink,'#fffdf5');
const coloured = paletteModule.paletteFromPixels([...solid(255,255,255,70),...solid(40,90,160,30)]);
assert.equal(coloured.paper,paletteModule.paletteFromPixels(solid(40,90,160)).paper);
assert.equal(paletteModule.readRecordPalette('missing'),paletteModule.defaultPalette);
console.log('PASS: label palette ignores transparency, handles blank images, preserves cover hue through white margins and chooses light/dark ink');
// Edge sampling must follow the paper surrounding a face, not its centre.
const square=Array.from({length:32*32},(_,i)=>{const x=i%32,y=Math.floor(i/32);return x<3||x>=29||y<3||y>=29?[40,90,160,255]:[230,170,120,255];}).flat();
const edge=paletteModule.edgePalette(square,32,32);
assert.equal(edge.edge,'rgb(43,90,156)');assert.equal(edge.edgeInk,'#fffdf5');
assert.notEqual(edge.edgeDark,edge.edge);
assert.equal(Object.keys(paletteModule.edgePalette(new Array(32*32*4).fill(0),32,32)).length,0);
assert.equal(paletteModule.edgePalette(solid(245,245,245,32*32),32,32).edgeInk,'#171715');
assert.equal(paletteModule.edgePalette(solid(0,0,0,32*32),32,32).edge,'rgb(0,0,0)');
console.log('PASS: edge colour ignores central portraits, skips transparent pixels, preserves original black/white edges and derives legible spine ink');
