'use strict';
// Sansu owns this synchronous read-only contract. No execution/adoption writes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
function read(root,rel){
 if(typeof rel!=='string'||! /^(?:docs\/|qa\/evidence\/|\.agents\/(?:tasks|memory)\/|scripts\/(?:portal-work-model\.cjs|portal-workspace\.cjs|portal-review-loop\.(?:cjs|js)|standard-portal\.mjs)$|scripts\/vendor\/portal-(?:site|workspace)\/\d+\.\d+\.\d+\/lock\.json$|CONSTITUTION\.md$|AGENTS\.md$)/.test(rel)||rel.includes('\\')||path.isAbsolute(rel)||rel.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Unsafe Sansu work source');
 let file=path.resolve(root);if(fs.lstatSync(file).isSymbolicLink())throw Error('Symlink root');for(const p of rel.split('/')){file=path.join(file,p);if(fs.lstatSync(file).isSymbolicLink())throw Error('Symlink source');}const s=fs.statSync(file);if(!s.isFile()||s.size>8*1024*1024)throw Error('Invalid work source');return fs.readFileSync(file);
}
const plain=s=>s.replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/[*`]/g,'').trim();
function load({root,repo='sansu',now}={}){
 if(repo!=='sansu'||!root)throw Error('Invalid Sansu repository');
 const sourceFiles={},resource=p=>{const bytes=read(root,p);sourceFiles[p]=sha(bytes);return {path:p,href:'/repos/sansu/'+p.split('/').map(encodeURIComponent).join('/'),sha256:sha(bytes)};};
 const ledger='.agents/tasks/TASKS.md',board=resource(ledger),text=read(root,ledger).toString();
 let section='',excluded=false;const rows=[];
 for(const line of text.split(/\r?\n/)){
  const h=line.match(/^## (.+)$/);if(h){section=h[1];excluded=/実装済み|完了|実行キューから分ける|保留|後続候補/.test(section);}
  if(excluded)continue;
  const m=line.match(/^\| ([^|]+?) \| \[([^\]]+)\]\(\.\.\/\.\.\/(docs\/tasks\/active\/[^\s)]+\.md)\) \| ([^|]+?) \| ([^|]+?) \|$/);
  if(m)rows.push({title:m[2],path:m[3],category:m[1],current:m[4],next:m[5],section});
 }
 if(!rows.length||new Set(rows.map(r=>r.path)).size!==rows.length)throw Error('Unrecognized or duplicate Sansu task ledger');
 // Only explicit links in the existing done index retain closed identities.
 const history='.agents/tasks/DONE.md';resource(history);
 for(const line of read(root,history).toString().split(/\r?\n/)){
  const match=line.match(/^[-*] \d{4}-\d{2}-\d{2}: \[([^\]]+)\]\(\.\.\/\.\.\/(docs\/tasks\/active\/[^\s)]+\.md)\)/);
  if(match&&!rows.some(r=>r.path===match[2]))rows.push({title:match[1],path:match[2],category:'完了履歴',current:'完了索引に記録。対象版と確認範囲は原文で確認。',next:'残課題と次の許可は原文を確認。',section:'完了履歴'});
 }
 const required=['CONSTITUTION.md','docs/product/01_app_spec.md','docs/ai/verification_matrix.md','.agents/tasks/BLOCKED.md','docs/tasks/backlog.md','.agents/memory/durable.md','docs/wiki/memory.md','scripts/portal-work-model.cjs','scripts/portal-workspace.cjs','scripts/standard-portal.mjs','scripts/vendor/portal-site/3.2.0/lock.json','scripts/vendor/portal-workspace/1.1.0/lock.json','docs/portal/workspace.md','docs/runbooks/requirements-review-loop.md','scripts/portal-review-loop.cjs','scripts/portal-review-loop.js','.agents/tasks/DONE.md'];
 const context=required.map(resource);
 const tasks=rows.map(row=>{
  const id=path.basename(row.path,'.md');if(!/^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/.test(id))throw Error('Invalid canonical filename ID');
  const source=resource(row.path),raw=read(root,row.path).toString(),lines=raw.split(/\r?\n/);
  const field=name=>lines.find(l=>new RegExp('^- '+name+':').test(l))?.replace(/^- [^:]+:\s*/,'')||null;
  const sectionLines=pattern=>{const out=[];let active=false;for(const l of lines){if(/^## /.test(l))active=pattern.test(l);else if(active&&l.trim())out.push(plain(l));}return out;};
  // No inference that every related parent is running or accepted.
  const status=field('Status')||'独立した状態欄なし。共有キューの現在地と次の一手を確認';
  const state=row.section==='完了履歴'?'done':/^作業中/.test(status)?'running':/^レビュー待ち/.test(status)?'review':/^完了/.test(status)?'done':'requested';
  const links=[...raw.matchAll(/\]\(([^)#\s]+\.md)(?:#[^)]*)?\)/g)].map(m=>path.posix.normalize(path.posix.join(path.posix.dirname(row.path),m[1]))).filter(p=>p.startsWith('docs/')||p.startsWith('.agents/'));
  const knowledge=[...new Set(['CONSTITUTION.md','docs/ai/verification_matrix.md',...links])].flatMap(p=>{try{return [{...resource(p),confirmed:true,basis:'仕事の原文にあるリンク、または全仕事に適用されるSansu契約。表示は実使用の証明ではない。'}];}catch{return [];}});
  const fields={id,title:plain(row.title),category:row.category,current:plain(row.current),next:plain(row.next),section:row.section,status,owner:field('Owner')||'未設定（要相談）',scope:field('Scope')||'共有キューと仕事の全文を確認。範囲を補完しない。',completion:sectionLines(/完了条件/),verification:sectionLines(/Verification|検証条件/),dependencies:field('Dependencies')?[field('Dependencies')]:[],blockers:sectionLines(/停止条件|残課題/)};
  return {...fields,repo,ref:repo+':work/'+id,version:sha(stable({fields,source:source.sha256,ledger:board.sha256})).slice(0,12),state,source,output:source,knowledge,planning:knowledge.filter(k=>/product|strategy|backlog/.test(k.path)),evidence:[],sourcePaths:context.map(c=>c.path),report:{at:null,logs:[],targets:[]},issues:['検査の過去記録は現在版の合格へ転記しない。'],raw};
 });
 return {schema:1,available:true,repo,title:'Sansu',...(now?{readAt:now}:{}),tasks,sourceFiles,config:{memory:context.filter(r=>/memory/.test(r.path)).map(r=>({...r,title:r.path.includes('wiki')?'製品の長期判断':'共有運用の記憶'}))},issues:[]};
}
module.exports={load,read,sha};
