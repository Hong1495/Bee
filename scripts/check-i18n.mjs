import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {loadI18n} from './i18n-test-loader.mjs';
const catalogs=['zh-Hant','en','ja'].map(lang=>JSON.parse(fs.readFileSync(`src/locales/${lang}.json`,'utf8')));
const placeholders=text=>[...text.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort();
for(const catalog of catalogs){
 assert.deepEqual(Object.keys(catalog).sort(),Object.keys(catalogs[0]).sort());
 for(const [key,value] of Object.entries(catalog)){assert.ok(value.trim(),key);assert.deepEqual(placeholders(value),placeholders(key),key);}
}
// Validate every literal translation call against all catalogs, including aria labels.
for(const file of fs.readdirSync('src').filter(f=>/\.tsx?$/.test(f))){
 const sf=ts.createSourceFile(file,fs.readFileSync('src/'+file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const walk=node=>{if(ts.isCallExpression(node)&&node.expression.getText(sf)==='t'&&ts.isStringLiteral(node.arguments[0]))for(const catalog of catalogs)assert.ok(node.arguments[0].text in catalog,`${file}: ${node.arguments[0].text}`);ts.forEachChild(node,walk);};walk(sf);
}
const {api,storage,document,listeners}=loadI18n();let changed=0;
api.useLanguage();listeners.add(()=>changed++);
for(const lang of ['zh-Hant','en','ja','zh-Hans']){api.setLanguage(lang);assert.equal(api.languages.map(item=>item.label).join('|'),'简体中文|繁體中文|English|日本語');assert.equal(api.useLanguage(),lang);assert.equal(storage.get('bee-language'),lang);assert.equal(document.documentElement.lang,lang);}
assert.equal(changed,4);
api.setLanguage('en');assert.equal(api.t('设置'),'Settings');assert.equal(api.t('查看 {0}','上海1943'),'View 上海1943');
assert.equal(api.t('删除「{0}」？歌曲文件和当前播放队列会保留。','My Playlist'),'Delete “My Playlist”? Song files and the current queue will be kept.');
api.setLanguage('invalid');assert.equal(api.useLanguage(),'en');
assert.equal(loadI18n('ja').api.t('设置'),'設定');assert.equal(loadI18n('bad').api.useLanguage(),'zh-Hans');
assert.equal(api.t('untranslated diagnostic'),'untranslated diagnostic');
console.log('PASS: complete catalogs, interpolation, language switching, subscriptions, persistence, document language, invalid preference fallback and untouched metadata');
