'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {connect}=require('./references.cjs'),UI=require('./context-ui.cjs');
function fixture(state='preparing'){
 const model={docs:[{source:'docs/k.md',read:true,href:'doc/k.html',related:[]}],tasks:[{id:'H-030',anchor:'task-h-030'}],decisions:[{anchor:'d-D1'}]};
 const config={index:{schema:'portal-contract/refs@1',repo:'demo',items:[
  {ref:'demo:knowledge/docs/k.md',id:'docs/k.md',kind:'knowledge',path:'docs/k.md',title:'<script>知識</script>',version:'abc123',stateLabel:'未確認'},
  {ref:'demo:work/H-030',id:'H-030',kind:'work',path:'tasks.json',title:'仕事',version:'456def',stateRaw:'保留'},
  {ref:'demo:decision/D1',id:'D1',kind:'decision',path:'d.json',title:'判断',version:'789aaa',state,stateLabel:state==='human'?'判断待ち':'準備中',reasons:['推奨が未記入']}
 ],links:[{from:'demo:work/H-030',to:'demo:knowledge/docs/k.md@abc123',type:'uses',confirmed:false,basis:'関係は推測'},{from:'demo:work/H-030',to:'demo:work/H-010',type:'depends',confirmed:true,basis:'台帳'}]},
 records:{'demo:decision/D1':{decision:{status:'needs-human',question:'問い',options:[{label:'A'},{label:'B'}],recommendation:null}}}};
 return {model,config};
}
test('reference projection preserves pins, uncertainty, unresolved references and backlinks',()=>{
 const {model,config}=fixture(),result=connect(model,config),work=result.tasks[0].reference;
 assert.equal(work.relations[0].version,'abc123');assert.equal(work.relations[0].confirmed,false);
 assert.equal(work.relations[1].href,null);assert.equal(work.relations[1].problem,'参照先未解決');
 assert.match(work.warnings[0],/H-010/);assert.equal(result.docs[0].related[0].id,'H-030');
 assert.equal(config.index.items[0].relations,undefined); // canonical input not mutated
});
test('decision display uses evaluated index state instead of raw needs-human status',()=>{
 const {model,config}=fixture();connect(model,config);assert.equal(model.decisions[0].group,'preparing');assert.equal(model.decisions[0].stateText,'準備中');
 const next=fixture('human');connect(next.model,next.config);assert.equal(next.model.decisions[0].group,'ready');
});
test('stale relation remains visible and is never silently repinned',()=>{
 const {model,config}=fixture();config.index.links[0].to='demo:knowledge/docs/k.md@old';connect(model,config);
 assert.equal(model.tasks[0].reference.relations[0].version,'old');assert.equal(model.tasks[0].reference.relations[0].problem,'参照版が古い');
});
test('context payload and reference output escape source text and expose missing state honestly',()=>{
 const {model,config}=fixture();connect(model,config);const html=UI.launcher({...model,title:'Demo'},'knowledge');
 assert.ok(!html.includes('<script>知識'));assert.ok(html.includes('\\u003cscript>'));assert.match(UI.panel(null),/未登録/);
 assert.match(UI.panel(model.tasks[0].reference),/関係は推定・未確認/);assert.match(UI.dialog(),/data-context-copy disabled/);
});
test('opt-in absence preserves existing model and duplicate input is rejected',()=>{
 const {model,config}=fixture();assert.equal(connect(model),model);assert.equal(model.references,undefined);
 config.index.items.push(config.index.items[0]);assert.throws(()=>connect(model,config),/Duplicate/);
});
test('canonical decision identity binds to a prefixed legacy anchor without breaking bookmarks',()=>{
 const {model,config}=fixture();model.decisions[0]={id:'D1',anchor:'d-decision-D1'};connect(model,config);
 assert.equal(model.decisions[0].reference.ref,'demo:decision/D1');assert.equal(model.decisions[0].reference.href,'decisions.html#d-decision-D1');
 assert.equal(model.decisions[0].options.length,2);assert.equal(model.decisions[0].recommendation,'');
});
