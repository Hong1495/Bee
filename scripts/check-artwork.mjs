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
