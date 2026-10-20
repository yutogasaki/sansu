'use strict';
// Projection only: the repo supplies its canonical index and verified record fields.
// This module never adopts knowledge, answers decisions, or writes a source record.
const base=ref=>String(ref||'').split('@')[0];
const anchor=ref=>'ref-'+require('node:crypto').createHash('sha256').update(ref).digest('hex').slice(0,16);
const REL={uses:'使う知識',depends:'前提の仕事',answers:'回答',produces:'成果',verifies:'検証',supersedes:'後継'};
function connect(model,config){
 if(!config)return model;
 const {index,records={},environment=[]}=config;
 if(index?.schema!=='portal-contract/refs@1'||!Array.isArray(index.items)||!Array.isArray(index.links))throw Error('Invalid reference projection input');
 const byRef=new Map();
 for(const item of index.items){
  if(byRef.has(item.ref)||!item.version)throw Error('Duplicate or unversioned reference: '+item.ref);
  const record=records[item.ref]||{};
  const doc=model.docs.find(d=>d.source===item.path&&d.read);
  const task=item.kind==='work'&&model.tasks.find(t=>t.id===item.id||t.anchor==='task-'+item.id.toLowerCase().replace(/[^a-z0-9-]+/g,'-'));
  if(task&&!task.id)task.id=item.id;
  const decision=item.kind==='decision'&&model.decisions.find(d=>d.id===item.id||d.anchor==='d-'+item.id);
  const href=task?'work.html#'+task.anchor:decision?'decisions.html#'+decision.anchor:doc?.href||'library.html#'+anchor(item.ref);
  const evidence=(record.evidence||[]).map(e=>({...e,href:model.docs.find(d=>d.source===e.path&&d.read)?.href||e.href||null}));
  byRef.set(item.ref,{...item,...record,evidence,anchor:anchor(item.ref),href,sourceHref:doc?.href||null,relations:[],warnings:[],label:item.stateLabel||item.stateRaw||'未確認'});
 }
 for(const link of index.links){
  const from=byRef.get(base(link.from)),to=byRef.get(base(link.to)),pin=link.to.split('@')[1];
  const relation={...link,title:to?.title||base(link.to),href:to?.href||null,label:REL[link.type]||link.type,version:pin||null,currentVersion:to?.version||null,
   problem:!to?'参照先未解決':pin&&pin!==to.version?'参照版が古い':link.type==='uses'&&!pin?'版未固定':null};
  if(from)from.relations.push(relation);
  if(to)to.relations.push({from:link.from,to:link.from,title:from?.title||link.from,href:from?.href||null,label:'関連する仕事',confirmed:link.confirmed,basis:link.basis,version:from?.version||null,problem:null});
 }
 for(const item of byRef.values()){
  item.warnings=[...(item.reasons||[]),...(item.basisMissing?['採用根拠の記録がありません。currentを採用へ対応付けた表示です。']:[]),...item.relations.filter(r=>r.problem).map(r=>r.problem+'：'+r.to)];
 }
 for(const doc of model.docs){
  doc.reference=byRef.get(index.repo+':knowledge/'+doc.source)||null;
  if(doc.reference){
   const related=doc.reference.relations.filter(r=>r.label==='関連する仕事'&&r.href).map(r=>({id:base(r.to).split('/').at(-1),title:r.title,href:r.href}));
   doc.related=[...doc.related,...related.filter(r=>!doc.related.some(t=>t.href===r.href))];
  }
 }
 for(const task of model.tasks){task.reference=byRef.get(index.repo+':work/'+task.id)||null;if(task.reference)Object.assign(task,task.reference.fields||{});}
 for(const decision of model.decisions){
  const ref=[...byRef.values()].find(x=>x.kind==='decision'&&(x.id===decision.id||'d-'+x.id===decision.anchor));
  if(!ref)continue;
  const raw=ref.decision||{};
  Object.assign(decision,{reference:ref,title:ref.title,reason:raw.question||decision.reason,recommendation:typeof raw.recommendation==='string'?raw.recommendation:raw.recommendation?.reason||'',options:raw.options||[],
   impact:raw.whyNow||'',facts:[{label:'対象',value:raw.target?.candidate||'未記録'},{label:'対象のrevision',value:raw.revision||'未記録'},{label:'文脈指紋',value:raw.target?.contextFingerprint||'未記録'},{label:'対象範囲',value:raw.target?.scope||'未記録'}],evidence:[],
   group:ref.state==='human'?'ready':['decided','cancelled'].includes(ref.state)?'done':'preparing',state:ref.state==='human'?'review':ref.state==='decided'?'done':'idle',stateText:ref.label});
 }
 model.references={repo:index.repo,items:[...byRef.values()],issues:index.issues||[],environment};
 return model;
}
module.exports={connect,base};
