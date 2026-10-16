import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {escape as esc} from './portal-html.mjs';
const require=createRequire(import.meta.url);
const vendor='scripts/vendor/hub-flow/2.0.0';
const {readFlow}=require('../'+vendor+'/flow/flow-check.cjs');
const {renderWorkGraph,css,states}=require('../'+vendor+'/flow/flow-view.cjs');
const sha=b=>createHash('sha256').update(b).digest('hex');
export const flowSource='.agents/flow/portal-flow.json';
export function loadPortalFlow(root,source=process.env.SANSU_PORTAL_FLOW_SOURCE||flowSource) {
 const lock=JSON.parse(fs.readFileSync(path.join(root,vendor,'lock.json'),'utf8'));
 const names=['flow-check.cjs','graph-check.cjs','flow.schema.json','flow-view.cjs','graph.css'];
 if(lock.version!=='2.0.0'||Object.keys(lock.files).sort().join()!==names.sort().join())throw Error('Invalid flow vendor lock');
 for(const name of names)if(sha(fs.readFileSync(path.join(root,vendor,'flow',name)))!==lock.files[name])throw Error('Flow vendor changed: '+name);
 const flow=readFlow(path.resolve(root,source));
 for(const kind of ['goals','stages','items','artifacts','checks','dependencies'])for(const record of flow[kind])for(const ref of record.evidence) {
  const abs=path.resolve(root,ref);
  if(!abs.startsWith(root+path.sep)||!fs.existsSync(abs)||!fs.statSync(abs).isFile())throw Error('Missing or unsafe flow evidence: '+ref);
  let part=root;for(const segment of ref.split('/')){part=path.join(part,segment);if(fs.lstatSync(part).isSymbolicLink())throw Error('Symlink flow evidence: '+ref);}
  if(sha(fs.readFileSync(abs))!==flow.source_hashes?.[ref])throw Error('Stale flow evidence: '+ref);
 }
 const current=flow.items.find(i=>i.id===flow.summary?.current_item);
 if(!current||!flow.summary.stage_ids.length||flow.summary.stage_ids.some(id=>!flow.stages.some(s=>s.id===id)))throw Error('Invalid flow summary');
 return flow;
}
export function renderPortalFlow(root,flow,register) {
 const current=flow.items.find(i=>i.id===flow.summary.current_item);
 const node=flow.nodes.find(n=>n.id===current.current_node);
 const decisions=flow.items.filter(i=>i.needs_yu.required);
 const conditions=flow.items.filter(i=>i.status==='stopped'&&!i.needs_yu.required);
 const summary=`<section class="flow-summary" aria-labelledby="flow-summary-title" id="flow-summary"><div class="flow-summary-heading"><h2 id="flow-summary-title"><a href="#work-flow">作業の流れ</a></h2><a href="#decisions">判断待ち ${decisions.length}件</a></div><ol class="flow-summary-stages" aria-label="段階帯">${flow.summary.stage_ids.map(id=>flow.stages.find(s=>s.id===id)).map(s=>`<li class="flow-step wg-${s.status}"><a href="#work-flow-stages-${esc(s.id)}">${esc(s.title)}</a><span>${esc(states[s.status])}</span></li>`).join('')}</ol><p><strong>現在地：</strong>${esc(node.title)}。<a href="#work-flow-items-${esc(current.id)}">停止理由と次の作業へ ↓</a></p><p class="flow-stop">${esc(current.why_stopped||current.next)}</p><p class="flow-condition-count">端末・参加者などの確認条件 ${conditions.length}件は回答依頼とは別です。</p></section>`;
 const refs=[...new Set(flow.items.flatMap(i=>i.evidence))].filter(ref=>ref.endsWith('.md'));
 const evidence=`<details class="flow-evidence"><summary>元のタスク・判断・検査記録を読む</summary><ul>${refs.map(ref=>`<li><a href="${esc(register(ref))}">${esc(ref)}</a></li>`).join('')}</ul><details><summary>流れの全データと参照元の版</summary><pre>${esc(JSON.stringify(flow,null,2))}</pre></details></details>`;
 const embedded=JSON.stringify(flow).replace(/</g,'\\u003c');
 return {summary,detail:renderWorkGraph(flow).replaceAll('検査結果：','検査結果 · ').replaceAll('成果物：','成果物 · ')+evidence+`<script type="application/json" id="portal-flow-data">${embedded}</script>`,css:css()+'\n'+fs.readFileSync(path.join(root,'tools/portal-flow.css'),'utf8')};
}
