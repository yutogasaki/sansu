import type { ProfileProgress, WorldState } from './types';
import { balanceUnits } from './progress';
import { graph, key } from './grid';
import balance from './balance.json';
export function assertWorld(w: WorldState, profileId: string) {
    const fail=()=>{ throw new Error('保存した島を確認できません。元のデータは残しています。'); };
    const integer=(n: number)=>Number.isSafeInteger(n)&&n>=0;
    const finite=(v: unknown): boolean=>typeof v==='number'?Number.isFinite(v):Array.isArray(v)?v.every(finite):v!==null&&typeof v==='object'?Object.values(v).every(finite):true;
    if(!w||!finite(w)||w.schemaVersion!=='0.2.0'||w.engineVersion!=='nature-town-1'||w.balanceVersion!==balance.specVersion||w.profileId!==profileId||w.worldId!==`nature:${profileId}`||!w.seed||!integer(w.tick)||!integer(w.revision)||!['clear','cloud','rain'].includes(w.weather)) fail();
    if(!Array.isArray(w.props)||!Array.isArray(w.residents)||!Array.isArray(w.chunks)||!Array.isArray(w.jobs)||!Array.isArray(w.hubMetrics)||!Array.isArray(w.observations)||!Array.isArray(w.significantMilestones)||!Array.isArray(w.recentlyAppliedCommandIds)||!Array.isArray(w.insectVisits)) fail();
    if(new Set(w.recentlyAppliedCommandIds).size!==w.recentlyAppliedCommandIds.length||!Object.values(w.randomEvaluationOrdinals).every(integer)||!Object.values(w.foodAccounting).every(integer)) fail();
    for(const items of [w.props,w.residents,w.chunks,w.jobs]) if(new Set(items.map(i=>i.id)).size!==items.length) fail();
    const positions=new Set<string>();
    for(const chunk of w.chunks) {
        if(chunk.cells.length!==balance.scope.chunkSide**2||!chunk.coordinate.every(Number.isInteger)||!chunk.opened) fail();
        for(const c of chunk.cells) {
            if(positions.has(key(c.position))||c.moisture<0||c.moisture>1||c.shade<0||c.shade>1||c.traffic<0||!['ground','water'].includes(c.terrain)||!c.position.every(Number.isInteger)) fail();
            if(Math.floor(c.position[0]/balance.scope.chunkSide)!==chunk.coordinate[0]||Math.floor(c.position[1]/balance.scope.chunkSide)!==chunk.coordinate[1]) fail();
            positions.add(key(c.position));
        }
    }
    for(const p of w.props) {
        if(!['home','hub','farm','tree','flowers','bench'].includes(p.kind)||!p.position.every(Number.isInteger)||!positions.has(key(p.position))) fail();
        if('inventory' in p) {
            const i=p.inventory, capacity=p.kind==='farm'?balance.plants.farmStorageCap:balance.transport.pantryCap;
            if(i.capacity!==capacity||![i.food,i.incomingReserved,i.outgoingReserved].every(integer)||i.food>capacity||i.outgoingReserved>i.food||i.food+i.incomingReserved>capacity) fail();
            const outgoing=w.jobs.filter(j=>j.sourceId===p.id&&j.phase==='toSource').reduce((s,j)=>s+j.quantity,0);
            const incoming=w.jobs.filter(j=>j.hubId===p.id).reduce((s,j)=>s+j.quantity,0);
            if(i.outgoingReserved!==outgoing||i.incomingReserved!==incoming) fail();
        }
        if(p.kind==='farm'&&(p.growth<0||p.growth>1)) fail();
        if(p.kind==='home'&&w.residents.filter(r=>r.homeId===p.id).length>p.beds) fail();
    }
    for(const hub of w.props.filter(p=>p.kind==='hub')) if(w.hubMetrics.filter(m=>m.hubId===hub.id).length!==1) fail();
    for(const m of w.hubMetrics) if(!w.props.some(p=>p.kind==='hub'&&p.id===m.hubId)||!integer(m.historyStartedTick)||m.historyStartedTick>w.tick||m.history.some(h=>![h.tick,h.served,h.requested,h.delivered].every(integer)||h.served>h.requested||h.tick>w.tick)) fail();
    const g=graph(w);
    for(const r of w.residents) {
        if(!integer(r.carriedFood)||!g.has(key(r.position))||!w.props.some(p=>p.kind==='home'&&!p.stored&&p.id===r.homeId)||!w.props.some(p=>p.kind==='hub'&&!p.stored&&p.id===r.hubId)||r.jobId&&!w.jobs.some(j=>j.id===r.jobId&&j.residentId===r.id)) fail();
    }
    for(const j of w.jobs) {
        const r=w.residents.find(r=>r.id===j.residentId);
        if(!r||r.jobId!==j.id||!integer(j.quantity)||j.quantity===0||!w.props.some(p=>p.kind==='hub'&&!p.stored&&p.id===j.hubId)||!['toSource','toHub'].includes(j.phase)) fail();
        if(j.phase==='toHub'&&r?.carriedFood!==j.quantity) fail();
        if(j.phase==='toSource'&&(!w.props.some(p=>p.kind==='farm'&&!p.stored&&p.id===j.sourceId)||r?.carriedFood!==0)) fail();
    }
    const total=w.props.reduce((s,p)=>s+('inventory' in p?p.inventory.food:0),0)+w.residents.reduce((s,r)=>s+r.carriedFood,0);
    if(total!==w.foodAccounting.initialized+w.foodAccounting.harvested-w.foodAccounting.consumed) fail();
}
export function assertProgress(p: ProfileProgress, id: string) {
    if(!p||p.profileId!==id||!Number.isSafeInteger(p.revision)||!Array.isArray(p.awards)||!Array.isArray(p.unlocks)||!Array.isArray(p.initialCapabilities)||balanceUnits(p)<0||new Set(p.awards.map(a=>a.eventId)).size!==p.awards.length||new Set(p.awards.map(a=>a.awardKey)).size!==p.awards.length||new Set(p.unlocks.map(u=>u.capability)).size!==p.unlocks.length||p.awards.some(a=>!Number.isSafeInteger(a.units)||a.units<=0)||p.unlocks.some(u=>!['irrigation','handcart'].includes(u.capability)||!Number.isSafeInteger(u.spentUnits)||u.spentUnits<=0)) throw new Error('道具の記録を確認できません。元のデータは残しています。');
    if(JSON.stringify([...p.initialCapabilities].sort())!==JSON.stringify([...balance.learning.initialCapabilities].sort())||p.target&&(!['irrigation','handcart'].includes(p.target.capability)||!Number.isSafeInteger(p.target.quotedCost)||p.target.quotedCost<=0)||p.awards.some(a=>!a.eventId||!a.awardKey||!a.learningRecordRef)) throw new Error('道具の権利を確認できません。');
}
