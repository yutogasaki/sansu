import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readRegistry} from '../tools/portal-registry.mjs';
import {parse,elements} from '../tools/portal-html.mjs';
const require=createRequire(import.meta.url),M=require('./portal-work-model.cjs');
if(process.env.PORTAL_WORKSPACE==='legacy'){assert(!fs.existsSync('portal/data/workspace-work.json'));console.log('PASS: explicit legacy generation has no workspace projection; all original checks remain enabled');process.exit(0);}
const root=process.cwd(),sha=b=>createHash('sha256').update(b).digest('hex');
const model=M.load({root}),generated=JSON.parse(fs.readFileSync('portal/data/workspace-work.json'));
assert.deepEqual(generated,model,'all canonical fields and raw text, not just IDs, match');
assert.equal(model.tasks.filter(t=>t.section!=='完了履歴').length,JSON.parse(fs.readFileSync('portal/data/project.json')).tasks.length);
for(const t of model.tasks){assert.equal(t.ref,'sansu:work/'+path.basename(t.source.path,'.md'));assert.equal(t.raw,M.read(root,t.source.path).toString());assert(t.version);assert(t.knowledge.every(k=>sha(M.read(root,k.path))===k.sha256));}
assert.throws(()=>M.load({root,repo:'keep-going'}));assert.throws(()=>M.read(root,'docs/../package.json'));
const tmp=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'sansu-work-model-'));
try{
 for(const [p]of Object.entries(model.sourceFiles)){fs.mkdirSync(path.dirname(path.join(tmp,p)),{recursive:true});fs.copyFileSync(path.join(root,p),path.join(tmp,p));}
 const original=fs.readFileSync(path.join(tmp,'.agents/tasks/TASKS.md'),'utf8'),before=M.load({root:tmp});
 const t=before.tasks[0],file=path.join(tmp,t.source.path);fs.utimesSync(file,new Date(0),new Date(0));assert.equal(M.load({root:tmp}).tasks[0].version,t.version,'mtime never confers a new content version');
 fs.appendFileSync(file,'\n未知の根拠フィールド: 保持する\n');assert.notEqual(M.load({root:tmp}).tasks[0].version,t.version);assert(M.load({root:tmp}).tasks[0].raw.includes('未知の根拠フィールド'));
 const row=original.split('\n').find(l=>l.includes('](../../'+t.source.path+')'));
 fs.writeFileSync(path.join(tmp,'.agents/tasks/TASKS.md'),original.replace('## 実装済みとして扱うもの',row+'\n## 実装済みとして扱うもの'));assert.throws(()=>M.load({root:tmp}),/duplicate/);
 fs.writeFileSync(path.join(tmp,'.agents/tasks/TASKS.md'),'# 壊れた台帳\ndocs/tasks/active/unknown.md');assert.throws(()=>M.load({root:tmp}),/Unrecognized/);
 fs.writeFileSync(path.join(tmp,'.agents/tasks/TASKS.md'),original.replace(row+'\n',''));
 fs.appendFileSync(path.join(tmp,'.agents/tasks/DONE.md'),'\n- 2026-10-18: ['+t.title+'](../../'+t.source.path+')。対象版の限定完了。\n');
 const closed=M.load({root:tmp}).tasks.find(x=>x.ref===t.ref);assert(closed&&closed.state==='done','explicit done keeps complete ref readable');assert.equal(M.load({root:tmp}).tasks.filter(x=>x.ref===t.ref).length,1);
 fs.writeFileSync(path.join(tmp,'.agents/tasks/TASKS.md'),original);fs.unlinkSync(file);fs.symlinkSync(path.join(root,t.source.path),file);assert.throws(()=>M.load({root:tmp}),/Symlink/);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
assert.equal(JSON.parse(fs.readFileSync('portal/data/unification-manifest.json')).sourceFiles['docs/portal/project.json'],sha(fs.readFileSync('docs/portal/project.json')),'first generation tracks the current derived adapter, never its previous disk bytes');
const packed=fs.readFileSync('portal/search-data.js','utf8').match(/window\.__portalSearchGzip=("[A-Za-z0-9+/=]+")/)[1];
const search=JSON.parse(gunzipSync(Buffer.from(JSON.parse(packed),'base64'))),fullRegistry=readRegistry('portal/data/unification.json');
assert.equal(sha(JSON.stringify(fullRegistry)),JSON.parse(fs.readFileSync('portal/data/storage.json')).rawModelSha256,'all full fields, order and unknown data restore to the generated source model');
assert.deepEqual(search.items.map(r=>r.key),fullRegistry.items.map(r=>r.key),'search and all raw records have the same order and identity');
for(let i=0;i<search.items.length;i++)assert.equal(search.items[i].haystack,[fullRegistry.items[i].text,fullRegistry.items[i].pageTitle,fullRegistry.items[i].title,...Object.values(fullRegistry.items[i].attributes||{})].join(' ').normalize('NFKC').toLocaleLowerCase(),'full source search terms retained');
const map=JSON.parse(fs.readFileSync('portal/data/workspace-legacy.json')).pages;
for(const [name,p]of Object.entries(map)){assert.equal(sha(fs.readFileSync('portal/'+p.target)),p.sha256,'moved full document bytes: '+name);const old=fs.readFileSync('portal/'+p.target,'utf8'),next=fs.readFileSync('portal/'+name,'utf8');for(const id of new Set([...old.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1])))assert(next.includes('id="'+id+'"'),'old fragment: '+name+'#'+id);}
const manifest=JSON.parse(fs.readFileSync('portal/data/workspace-preservation.json'));
for(const row of manifest){const bytes=fs.readFileSync('portal/'+row.target,'utf8').replace(/<base data-workspace-preserved href="[^"]*">/,'');assert.equal(sha(bytes),row.sha256,'full retained source: '+row.source);const current=fs.readFileSync('portal/'+row.source,'utf8');for(const id of row.mainIds)assert(current.includes('id="'+id+'"'),'main ID unchanged '+row.source+'#'+id);const oldAttrs=elements(parse(bytes),n=>Object.hasOwn(n.attrs||{},'data-search')).map(n=>n.attrs['data-search']);const newAttrs=elements(parse(current),n=>Object.hasOwn(n.attrs||{},'data-sansu-search')).map(n=>n.attrs['data-sansu-search']);assert.deepEqual(newAttrs,oldAttrs,'legacy search attribute values remain identical under the isolated namespace: '+row.source);assert(!current.includes('class="workspace-original"'),'ordinary content is integrated, not viewed in an iframe');}
for(const name of ['index','strategy','work','outcomes','knowledge','ai','memory','decisions','search','library']){const html=fs.readFileSync('portal/'+name+'.html','utf8');assert(html.includes('workspace-menu'));assert.equal((html.match(/class="workspace-nav"/g)||[]).length,1);assert.equal((html.match(/data-workspace-link href="(?:\.\.\/)*?(?:index|strategy|work|outcomes|knowledge|ai)\.html"/g)||[]).length,6);}
assert(fs.readFileSync('portal/sansu-legacy-reader.js','utf8').includes('script[src$="sansu-legacy-reader.js"]'),'reader resolves its actual renamed script');
assert(fs.readFileSync('portal/filters.html','utf8').includes('<script src="sansu-legacy-search.js" defer>'),'search waits for the original deferred data');
console.log(`PASS: Sansu canonical loader/negative guards, ${model.tasks.length} refs, all moved documents/IDs, ${manifest.length} integrated original pages and six-entry navigation`);
