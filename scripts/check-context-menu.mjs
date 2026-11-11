import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
class HTMLElement {isContentEditable=false;closest(){return null;}}
class HTMLInputElement extends HTMLElement {constructor(type='text',disabled=false){super();this.type=type;this.disabled=disabled;}closest(){return this;}}
class HTMLTextAreaElement extends HTMLElement {disabled=false;closest(){return this;}}
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/contextMenu.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,HTMLElement,HTMLInputElement,HTMLTextAreaElement});
function cancelled(target){let prevented=false;exports.suppressBrowserMenu({target,preventDefault(){prevented=true;},stopPropagation(){assert.fail('Application context menus must still receive the event');}});return prevented;}
assert.equal(cancelled(new HTMLElement()),true); // covers, links, blank content
assert.equal(cancelled(null),true);
assert.equal(cancelled({tagName:'svg'}),true);
for(const type of ['text','search','url','email','tel','password','number'])assert.equal(cancelled(new HTMLInputElement(type)),false);
assert.equal(cancelled(new HTMLTextAreaElement()),false);
for(const type of ['checkbox','range','button'])assert.equal(cancelled(new HTMLInputElement(type)),true);
assert.equal(cancelled(new HTMLInputElement('text',true)),true);
const editable=new HTMLElement();editable.isContentEditable=true;assert.equal(cancelled(editable),false);
console.log('PASS: browser menus suppressed on content, text editing preserved, application event propagation untouched');
