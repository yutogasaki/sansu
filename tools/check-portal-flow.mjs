import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {loadPortalFlow} from './portal-flow.mjs';
import {parse,elements,textOf,surfaceText,technicalSurface} from './portal-html.mjs';
const require=createRequire(import.meta.url);
const {checkGraph}=require('../scripts/vendor/hub-flow/2.0.0/flow/graph-check.cjs');
const {graphIds}=require('../scripts/vendor/hub-flow/2.0.0/flow/flow-view.cjs');
export function checkPortalFlow(root,out) {
 const flow=loadPortalFlow(root);
 assert(!/\/(?:Users|private|tmp)\/|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(JSON.stringify(flow)),'flow carries no personal paths or email');
 const doc=parse(fs.readFileSync(path.join(out,'index.html'),'utf8'));
 const graph=elements(doc,n=>n.attrs?.id==='work-flow')[0];
 assert(graph,'same-page graph');
 const embedded=elements(doc,n=>n.attrs?.id==='portal-flow-data')[0];
 assert.deepEqual(JSON.parse(textOf(embedded)),flow,'embedded graph matches source');
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out,'data/portal-flow.json'),'utf8')),flow,'bundled graph matches source');
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out,'data/integration.json'),'utf8')).flow,flow,'integration has same graph');
 for(const id of graphIds(flow))assert.equal(elements(doc,n=>n.attrs?.id===id).length,1,'unique graph anchor: '+id);
 const summary=elements(doc,n=>n.attrs?.id==='flow-summary')[0];
 assert(!technicalSurface.test(surfaceText(graph)),'plain graph surface');
 assert(!technicalSurface.test(surfaceText(summary)),'plain summary surface');
 assert(surfaceText(summary).includes('判断待ち '+flow.items.filter(i=>i.needs_yu.required).length+'件'));
 for(const i of flow.items.filter(i=>i.status==='stopped'))assert(surfaceText(graph).includes(i.why_stopped),'stop reason always visible');
 for(const i of flow.items.filter(i=>i.needs_yu.required))assert(surfaceText(graph).includes(i.needs_yu.content),'decision always visible');
 for(const d of flow.dependencies)assert(elements(graph,n=>n.attrs?.href==='#work-flow-items-'+d.from).length,'dependency reaches prerequisite');
 // The source contract must reject broken chains, cycles, unexplained stops and empty decisions.
 const clone=()=>structuredClone(flow);
 let bad=clone();bad.dependencies.push({from:flow.dependencies[0].to,to:flow.dependencies[0].from,reason:'cycle',basis:'proposal',evidence:['fixture']});assert(checkGraph(bad).includes('Dependency cycle'));
 bad=clone();bad.artifacts[0].item_id='missing';assert(checkGraph(bad).some(s=>s.includes('Unknown artifacts.item_id')));
 bad=clone();bad.items.find(i=>i.status==='stopped').why_stopped=null;assert(checkGraph(bad).length);
 bad=clone();bad.items.find(i=>i.needs_yu.required).needs_yu.content='';assert(checkGraph(bad).length);
 console.log(`PASS: flow schema/references/cycles/stops/decisions, ${flow.items.length} work items, same-page anchors and source/embedded/bundled equality`);
}
