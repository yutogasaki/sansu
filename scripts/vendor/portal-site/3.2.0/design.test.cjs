'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const C=require('./classify.cjs'),R=require('./render.cjs'),{siteModel}=require('./adapter.cjs');

test('IDs move out of titles instead of becoming placeholder prose',()=>{
 assert.deepEqual(C.title('H-030〜H-037: 整数のたし算'),{title:'整数のたし算',id:'H-030〜H-037'});
 assert.deepEqual(C.title('H-030/H-032/H-034後の監査・SW検査の修正'),{title:'監査・SW検査の修正',id:'H-030/H-032/H-034'});
 assert.deepEqual(C.title('Jishuの問題構成と今後の方針'),{title:'Jishuの問題構成と今後の方針',id:null});
 assert.equal(C.title('PI-JISHU-001').title,'PI-JISHU-001'); // an ID alone stays readable
});
test('free-form status text maps to the five shared states',()=>{
 assert.equal(C.state('保留（実装済み）'),'blocked');assert.equal(C.state('進行中（ローカル候補）'),'doing');assert.equal(C.state('Active'),'doing');
 assert.equal(C.state('修正完了（PM再実行待ち）'),'review');assert.equal(C.state('完了（検査済み）'),'done');assert.equal(C.state('TODO'),'idle');
});
test('three tiers: living documents listed, dated records linked, code omitted',()=>{
 assert.equal(C.tier({source:'docs/strategy/a.md',cat:'strategy'}),'list');
 assert.equal(C.tier({source:'docs/strategy/review_20261015.md',cat:'strategy'}),'link');
 assert.equal(C.tier({source:'docs/tasks/active/h-037.md',cat:'record'}),'link');
 assert.equal(C.tier({source:'question_bank.py',cat:'archive'}),'omit');
 assert.equal(C.tier({source:'docs/strategy/current-state-2026-10-15.md',cat:'strategy',pinned:true}),'list');
 assert.equal(C.tier({source:'x.py',tier:'list'}),'list'); // a repo can override
});
test('front matter and document shape are read from the source',()=>{
 const fm=C.frontMatter('---\ntype: strategy\nsummary: |\n  一行目\n  二行目\nstatus: current\n---\n# 題\n');
 assert.equal(fm.type,'strategy');assert.equal(fm.summary,'一行目\n二行目');assert.equal(fm.status,'current');
 const shape=C.shape('strategy',['結論','目的','進め方']);
 assert.deepEqual(shape.filter(s=>s.found).map(s=>s.name),['結論','目的','方針']);
});
test('every page gets the same chrome and escapes data',()=>{
 const site={slug:'x',title:'<X>',accent:'#000',accentSoft:'#fff',generatedAt:'now',workspaceHref:'../index.html',projects:[{slug:'x',title:'<X>',accent:'#000',href:'index.html'}],tabs:[{id:'home',label:'ホーム',icon:'home',href:'index.html'},{id:'work',label:'仕事',icon:'work',href:'work.html',count:2}]};
 const top=R.shell(site,{path:'index.html',tab:'home',title:'t',body:'<h1>t</h1>'}),deep=R.shell(site,{path:'doc/a.html',tab:'work',title:'t',body:'<h1>t</h1>'});
 const tabs=h=>h.match(/<nav class="tabs"[\s\S]*?<\/nav>/)[0].replace(/ aria-current="page"/g,'');
 assert.equal(tabs(top),tabs(deep).replaceAll('../',''));
 assert.match(deep,/href="\.\.\/site\.css"/);assert.match(top,/&lt;X&gt;/);assert.doesNotMatch(top,/<X>/);
 assert.match(top,/aria-label="2件">2</);
});
test('the adapter turns a v1 repo into a tiered site model',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'design-'));
 const w=(f,s)=>{fs.mkdirSync(path.dirname(path.join(root,f)),{recursive:true});fs.writeFileSync(path.join(root,f),s);};
 w('portal/data/project.json',JSON.stringify({title:'Demo',summary:'目的',status:'進行中',nextAction:'次',docs:['docs/index.md'],tasks:[{id:'D-1',title:'D-1: 止まった仕事',status:'保留'}],decisions:[{id:'q',title:'決めること [q]',status:'Yuの判断待ち'}]}));
 const page=t=>`<html><body><main><h1>${t}</h1><h2>結論</h2><p>本文</p><h2>目的</h2></main></body></html>`;
 w('portal/data/ui-component.json',JSON.stringify({ledger:[{path:'index.html',title:'概要'},{path:'read/a.html',title:'索引',source:'docs/index.md'},{path:'read/b.html',title:'監査',source:'docs/audits/2026-10-01.md'},{path:'read/c.html',title:'根拠の原文',source:'x.py'},{path:'old/tasks.html',title:'Demo · タスク'}]}));
 w('portal/read/a.html',page('索引'));w('portal/read/b.html',page('監査'));w('docs/index.md','索引の要点。\n');
 const m=siteModel({root,outDir:path.join(root,'out')});
 assert.equal(m.title,'Demo');assert.equal(m.tasks[0].title,'止まった仕事');assert.equal(m.tasks[0].state,'blocked');
 assert.equal(m.decisions[0].title,'決めること');assert.equal(m.decisions[0].group,'ready');
 assert.deepEqual(m.docs.map(d=>[d.title,d.tier]),[['索引','list'],['監査','link']]); // code and duplicate old screens omitted
 assert.equal(m.docs[0].summary.text,'索引の要点。');assert.equal(m.docs[0].summary.own,false);
 assert.deepEqual(m.docs[0].toc.map(h=>h.text),['結論','目的']);
 // The builder writes the same five pages plus each readable document.
 const out=path.join(root,'site'),res=require('./build.cjs').build({root,outDir:out,slug:'jishu',generatedAt:'test'});
 for(const f of ['index.html','work.html','decisions.html','library.html','search.html','doc/a.html','doc/b.html','site.css','site.js','site-index.js','site-text.js'])assert.ok(fs.existsSync(path.join(out,f)),f);
 assert.equal(res.stats.listed,1);assert.match(fs.readFileSync(path.join(out,'doc/a.html'),'utf8'),/class="brief"/);
 fs.rmSync(root,{recursive:true,force:true});
});
