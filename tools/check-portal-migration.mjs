// Exhaustive occurrence-level parity; a PASS here is mechanical, not visual acceptance.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parse,elements} from './portal-html.mjs';
import {destinations} from './integrated-portal.mjs';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const portalRoot=path.resolve(process.env.SANSU_PORTAL_CANDIDATE||path.join(root,'portal'));
const read=file=>fs.readFileSync(file.startsWith('portal/')?path.join(portalRoot,file.slice(7)):path.join(root,file),'utf8');
const sha=value=>createHash('sha256').update(value).digest('hex');
const data=JSON.parse(read('portal/data/integration.json'));
const inventory=JSON.parse(read('portal/data/original-inventory.json'));
const structural=JSON.parse(read('portal/data/parity.json'));
const structuralMap=new Map(structural.map(row=>[row.source+':'+row.ordinal,row]));
const elementTargets=new Map();
for(const [source] of destinations){
 let ordinal=0;
 for(const [index,node] of elements(parse(read(source)),n=>n.tag!=='root').entries()){
  if(['h1','h2','h3','article','section','details','a','img','input','nav','style','script'].includes(node.tag))ordinal++;
  elementTargets.set(source+':'+index,structuralMap.get(source+':'+ordinal));
 }
}
const search=JSON.parse(read('portal/data/search.json'));
assert.equal(read('portal/search-index.js'),'window.sansuSearchIndex='+JSON.stringify(search)+';\n');
const categories={};
for(const row of search){
 assert.equal(row.body,read(row.source),'exact searchable original: '+row.source);
 assert.equal(row.sha256,sha(row.body),'same source version: '+row.source);
 assert(row.category&&row.format&&row.id,'all search facets are declared');
 categories[row.category]=(categories[row.category]||0)+1;
}
const resourceRows=[];
for(const row of data.resources){
 const file=path.join(root,row.source);assert(fs.existsSync(file),row.source);
 assert.equal(sha(fs.readFileSync(file)),row.sha256,'resource version: '+row.source);
 assert.equal(fs.statSync(file).size,row.bytes);
 resourceRows.push({original:row.source,destination:row.target,preserve:'元ファイル・容量・内容hash・参照先。最新版/出典/配布条件は原資料の記載を保持し、未登録は補作しない。',kind:'resource',bytes:row.bytes,sha256:row.sha256,
  evidence:'portal/data/integration.json → resources / tools/check-portal-migration.mjs',verdict:'ローカル参照と内容一致。hubへの配布可否はhubの除外記録で別照合'});
}
const rows=inventory.items.map(item=>({
 original:item.source,locator:item.locator,id:item.id,kind:item.kind,sha256:item.sha256,
 destination:elementTargets.get(item.source+':'+item.locator.element)?.human||destinations.get(item.source)||'map.html',
 detail:elementTargets.get(item.source+':'+item.locator.element)?.ai||item.target,
 preservedOriginal:item.target,
 preserve:item.kind==='behavior'?'検索・開閉・戻るの動作定義':item.kind==='css'||item.kind==='css-rule'||item.kind==='media-condition'?'元の配色・図の配置・文字・応答幅':'全文・属性・分類・識別子・元の値',
 evidence:'portal/data/original-inventory.json → '+item.id+' / tools/check-portal-originals.mjs / browser.json',
 verdict:'機械保持確認。表示・操作は同ページの同幅比較と独立審査に依存',
}));
const routes=[];
for(const [source,target] of destinations){
 const doc=parse(read(source));
 const anchors=elements(doc,node=>!!node.attrs?.id).map(node=>node.attrs.id);
 routes.push({old:source,target:'portal/'+target,original:'portal/original/'+target,anchors,
  policy:'受入前は元URLを現状維持。受入後も保持期限未決のURLを削除しない。'});
}
const controls=inventory.sources.map(row=>{
 const doc=parse(read(row.source));
 const tags=elements(doc,n=>['input','textarea','select','button','form','details','dialog'].includes(n.tag));
 return {page:row.source,controls:tags.map(n=>({tag:n.tag,id:n.attrs.id||null,type:n.attrs.type||null})),
  absent:['追加・編集・削除・保存・import/exportは元ポータルに存在しない。製品アプリの操作は移行対象に含めず既存入口を保持。','相談文の編集・コピーの専用操作は元ポータルに存在しない。相談資料への導線と外部送信の承認境界を保持。']};
});
const result={schemaVersion:1,acceptance:'機械照合。表示・操作・独立審査・hub配布照合はbrowser.jsonとcloseoutで別判定',
 candidate:data.currentCandidate,inputHash:sha(JSON.stringify({inventory:sha(read('portal/data/original-inventory.json')),resources:data.resources,search:sha(read('portal/data/search.json'))})),
 counts:{pages:inventory.sources.length,originalItems:rows.length,resources:resourceRows.length,searchableDocuments:search.length,categories,oldURLs:routes.length,anchors:routes.reduce((s,r)=>s+r.anchors.length,0)},routes,controls,
 exclusions:[{scope:'児童/家族の実保存・IndexedDB・localStorage・端末内写真',reason:'ポータル生成元にせず、内容を読取・転記・撮影しない。'},{scope:'.env・秘密鍵・Git内部・node_modules',reason:'生成器の依存探索から除外。固定vendor・公開選別を維持。'}],rows:[...rows,...resourceRows]};
const out='qa/evidence/PI-001-SANSU';
const json=JSON.stringify(result,null,2)+'\n';
const cell=v=>String(v).replaceAll('|','\\|').replaceAll('\n',' ');
const md='# Sansu 全項目対応表\n\n'+result.acceptance+'。入力hash: '+result.inputHash+'\n\n'+JSON.stringify(result.counts)+'\n\n| 元の場所・項目 | 統合先 | 保持する情報・操作・表現 | 検証方法・証拠 | 判定・除外理由 |\n| --- | --- | --- | --- | --- |\n'+result.rows.map(r=>`| ${cell(r.original+' '+(r.id||''))} | ${cell(r.destination)} | ${cell(r.preserve)} | ${cell(r.evidence)} | ${cell(r.verdict)} |`).join('\n')+'\n';
if(process.argv.includes('--write')){fs.mkdirSync(path.join(root,out),{recursive:true});fs.writeFileSync(path.join(root,out,'parity.json'),json);fs.writeFileSync(path.join(root,out,'parity.md'),md);}
else if(process.argv.includes('--check')){assert.equal(read(out+'/parity.json'),json,'mapping is reproducible');assert.equal(read(out+'/parity.md'),md,'mapping summary uses identical data');}
console.log(JSON.stringify({status:'PASS',candidate:result.candidate,inputHash:result.inputHash,counts:result.counts}));
