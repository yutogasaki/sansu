import type { EngineContext, Resident, WorldState } from './types';
import { activeProps, cellCost, equal, graph, key, route, routeOn } from './grid';
export function releaseJob(w: WorldState, resident: Resident) {
    const job=w.jobs.find(j=>j.id===resident.jobId);
    if(job) {
        const source=w.props.find(p=>p.id===job.sourceId), hub=w.props.find(p=>p.id===job.hubId);
        if(source?.kind==='farm' && resident.carriedFood===0) source.inventory.outgoingReserved-=job.quantity;
        if(hub?.kind==='hub') hub.inventory.incomingReserved-=job.quantity;
        w.jobs=w.jobs.filter(j=>j.id!==job.id);
    }
    delete resident.jobId; resident.path=[]; resident.edgeProgress=0; resident.state='idle';
}
export function clearSeat(w: WorldState, r: Resident) {
    for(const p of w.props) if(p.kind==='bench') { if(p.reservedById===r.id) delete p.reservedById; if(p.occupantId===r.id) delete p.occupantId; }
    delete r.targetId; delete r.dwellUntil;
}
/** Edits cancel reservations, never ownership. A carrier replans with the same cargo. */
export function repairAfterEdit(w: WorldState) {
    const g=graph(w);
    for(const r of w.residents) {
        releaseJob(w,r); clearSeat(w,r);
        if(!g.has(key(r.position))) {
            const safe=[...g.values()].sort((a,b)=>Math.abs(a.position[0]-r.position[0])+Math.abs(a.position[1]-r.position[1])-Math.abs(b.position[0]-r.position[0])-Math.abs(b.position[1]-r.position[1])||key(a.position).localeCompare(key(b.position)))[0];
            if(safe) r.position=safe.position;
        }
    }
}
export function moveResident(w: WorldState, r: Resident, mass: number) {
    if(!r.path.length) return true;
    const c=graph(w).get(key(r.path[0]));
    if(!c) { releaseJob(w,r); clearSeat(w,r); return false; }
    r.edgeProgress+=1;
    if(r.edgeProgress+1e-9>=cellCost(c)) {
        r.edgeProgress=0; r.position=r.path.shift()!; c.traffic+=mass;
        const job=w.jobs.find(j=>j.id===r.jobId); if(job) job.lastProgressTick=w.tick;
    }
    return r.path.length===0;
}
export function deliver(w: WorldState, ctx: EngineContext) {
    const b=ctx.config.transport;
    const people=[...w.residents].sort((a,b)=>a.id.localeCompare(b.id));
    for(const r of people) {
        const job=w.jobs.find(j=>j.id===r.jobId);
        if(!job) continue;
        const source=w.props.find(p=>p.id===job.sourceId), hub=w.props.find(p=>p.id===job.hubId);
        if(!hub || hub.stored || hub.kind!=='hub' || (!r.carriedFood && (!source || source.stored || source.kind!=='farm'))) { releaseJob(w,r); continue; }
        if(!moveResident(w,r,job.usingCart?b.cartTrafficMass:b.walkerTrafficMass)) continue;
        if(job.phase==='toSource' && source?.kind==='farm') {
            if(!equal(r.position,source.entrance)) { releaseJob(w,r); continue; }
            const path=route(w,r.position,hub.entrance,job.usingCart);
            if(!path) { releaseJob(w,r); continue; }
            source.inventory.food-=job.quantity; source.inventory.outgoingReserved-=job.quantity;
            r.carriedFood=job.quantity; job.phase='toHub'; r.path=path.path; job.lastProgressTick=w.tick;
        } else if(job.phase==='toHub') {
            if(!equal(r.position,hub.entrance) || hub.inventory.food+r.carriedFood>hub.inventory.capacity) { releaseJob(w,r); continue; }
            hub.inventory.food+=r.carriedFood;
            const metric=w.hubMetrics.find(m=>m.hubId===hub.id)!;
            metric.history.push({tick:w.tick,requested:0,served:0,delivered:r.carriedFood});
            // Keep phase and cargo until release has subtracted only the destination reservation.
            releaseJob(w,r); r.carriedFood=0;
            r.dwellUntil=w.tick+ctx.config.residents.dwellTicks; r.state='using';
        }
    }
    const hubs=activeProps(w).filter(p=>p.kind==='hub');
    for(const r of people.filter(r=>!r.jobId && r.carriedFood>0)) {
        const targets=hubs.map(h=>({h,path:route(w,r.position,h.entrance)})).filter(t=>t.path && t.h.inventory.capacity-t.h.inventory.food-t.h.inventory.incomingReserved>=r.carriedFood).sort((a,b)=>a.path!.cost-b.path!.cost||a.h.id.localeCompare(b.h.id));
        const target=targets[0]; if(!target) continue;
        const id=`delivery:${r.id}:${w.tick}`;
        target.h.inventory.incomingReserved+=r.carriedFood;
        w.jobs.push({id,sourceId:'carried',hubId:target.h.id,residentId:r.id,quantity:r.carriedFood,usingCart:false,phase:'toHub',createdTick:w.tick,lastProgressTick:w.tick});
        clearSeat(w,r); r.jobId=id; r.path=target.path!.path; r.state='moving';
    }
    let slots=Math.max(1,Math.floor(people.length/3))-w.jobs.length;
    const farms=activeProps(w).filter(p=>p.kind==='farm');
    // Rotate the responsibility at meal boundaries; no permanent worker identity.
    const offset=Math.floor(w.tick/ctx.config.simulation.mealEveryTicks)%people.length;
    for(const r of [...people.slice(offset),...people.slice(0,offset)]) {
        if(slots<=0) break;
        if(r.jobId || r.carriedFood || r.path.length || (r.dwellUntil??0)>w.tick) continue;
        const candidates=[];
        for(const farm of farms) for(const hub of hubs) {
            const population=people.filter(p=>p.hubId===hub.id).length;
            const wanted=Math.min(hub.inventory.capacity,population*b.reserveMeals+ctx.config.plants.harvestBatch)-hub.inventory.food-hub.inventory.incomingReserved;
            const available=farm.inventory.food-farm.inventory.outgoingReserved;
            if(wanted<=0 || available<=0) continue;
            const cartPath=hub.transportPolicy==='cart_if_connected' && ctx.capabilities.has('handcart') ? route(w,farm.entrance,hub.entrance,true):undefined;
            const delivery=cartPath ?? route(w,farm.entrance,hub.entrance), pickup=route(w,r.position,farm.entrance);
            if(!delivery || !pickup) continue;
            const quantity=Math.min(available,wanted,cartPath?b.cartCarry:b.walkerCarry);
            const waitKey=`farm-ready:${farm.id}`;
            candidates.push({farm,hub,pickup,cart:!!cartPath,quantity,cost:pickup.cost+delivery.cost,ready:w.randomEvaluationOrdinals[waitKey]??w.tick});
        }
        candidates.sort((a,b)=>a.ready-b.ready||a.cost-b.cost||a.farm.id.localeCompare(b.farm.id)||a.hub.id.localeCompare(b.hub.id));
        const chosen=candidates[0]; if(!chosen) continue;
        const id=`delivery:${r.id}:${w.tick}`;
        chosen.farm.inventory.outgoingReserved+=chosen.quantity; chosen.hub.inventory.incomingReserved+=chosen.quantity;
        w.jobs.push({id,sourceId:chosen.farm.id,hubId:chosen.hub.id,residentId:r.id,quantity:chosen.quantity,usingCart:chosen.cart,phase:'toSource',createdTick:w.tick,lastProgressTick:w.tick});
        clearSeat(w,r); r.jobId=id; r.path=chosen.pickup.path; r.state='moving'; slots--;
    }
}
export function meals(w: WorldState, ctx: EngineContext) {
    const b=ctx.config;
    for(const m of w.hubMetrics) m.history=m.history.filter(h=>h.tick>w.tick-b.population.historyTicks);
    if(w.tick%b.simulation.mealEveryTicks) return;
    const g=graph(w);
    for(const m of w.hubMetrics) {
        const hub=w.props.find(p=>p.id===m.hubId); if(hub?.kind!=='hub' || hub.stored) continue;
        const people=w.residents.filter(r=>r.hubId===hub.id).sort((a,b)=>a.id.localeCompare(b.id));
        const offset=Math.floor(w.tick/b.simulation.mealEveryTicks)%Math.max(1,people.length); let served=0;
        for(const r of [...people.slice(offset),...people.slice(0,offset)]) {
            const home=w.props.find(p=>p.id===r.homeId);
            const reachable=home?.kind==='home' && !home.stored && (routeOn(g,home.entrance,hub.entrance)?.cost??Infinity)<=b.transport.serviceMaxPathCost;
            if(reachable && hub.inventory.food>0) { hub.inventory.food--; served++; }
        }
        w.foodAccounting.consumed+=served;
        m.history.push({tick:w.tick,requested:people.length,served,delivered:0});
    }
}
