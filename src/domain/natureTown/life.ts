import type { CellPos, EngineContext, Observation, WorldState } from './types';
import { activeProps, cells, distance, entrance, graph, key, neighbors, route, routeOn } from './grid';
import { clamp } from './environment';
import { clearSeat, moveResident } from './transport';
export function draw(w: WorldState, ctx: EngineContext, system: string, id: string) {
    const k=JSON.stringify([system,id]), ordinal=w.randomEvaluationOrdinals[k]??0;
    w.randomEvaluationOrdinals[k]=ordinal+1;
    return ctx.randomAt(w.seed,system,id,ordinal);
}
export function observe(w: WorldState, type: Observation['type'], ids: string[], position: CellPos, conditions: Observation['observedConditions']={}) {
    const item: Observation={id:`${type}:${w.tick}:${ids.join(':')}`,type,tick:w.tick,subjectIds:ids,position,observedConditions:conditions};
    w.observations=[...w.observations,item].slice(-50);
    if(type==='settlement'||type==='expansion') w.significantMilestones.push(item);
}
export function wander(w: WorldState, ctx: EngineContext) {
    const g=graph(w), b=ctx.config.residents;
    const props=activeProps(w);
    for(const [index,r] of [...w.residents].sort((a,b)=>a.id.localeCompare(b.id)).entries()) {
        if(r.jobId || r.carriedFood) continue;
        if(r.path.length) {
            if(moveResident(w,r,1)) {
                r.state='using'; r.dwellUntil=w.tick+b.dwellTicks;
                const seat=props.find(p=>p.id===r.targetId);
                if(seat?.kind==='bench') { seat.occupantId=r.id; delete seat.reservedById; }
            }
            continue;
        }
        if((r.dwellUntil??0)>w.tick) continue;
        if(w.tick%ctx.config.simulation.decisionEveryTicks!==index%ctx.config.simulation.decisionEveryTicks) continue;
        clearSeat(w,r);
        const candidates: {id:string;position:CellPos;nature:number}[]=[];
        for(const p of props) {
            if(p.kind==='home'||p.kind==='farm') continue;
            if(p.kind==='bench'&&(p.occupantId||p.reservedById)) continue;
            const position=p.kind==='tree' ? neighbors(p.position).find(n=>g.has(key(n))):entrance(p);
            if(position) candidates.push({id:p.id,position,nature:b.attractorNature[p.kind]});
        }
        for(const v of w.insectVisits) candidates.push({id:v.id,position:v.position,nature:b.attractorNature.insects});
        for(const c of cells(w)) if(c.terrain==='water') {
            const position=neighbors(c.position).find(n=>g.has(key(n)));
            if(position) candidates.push({id:`water:${key(c.position)}`,position,nature:b.attractorNature.waterEdge});
        }
        const choices=candidates.sort((a,b)=>a.id.localeCompare(b.id)).map(c=>{
            const path=routeOn(g,r.position,c.position), d=clamp(w.residents.filter(p=>p.id!==r.id && distance(p.position,c.position)<=2).length/3);
            const shade=g.get(key(c.position))?.shade??0;
            const weight=Math.max(b.minimumChoiceWeight,b.baseScore+b.natureWeight*r.naturePreference*c.nature+b.socialWeight*r.socialPreference*d+b.quietWeight*(1-r.socialPreference)*(1-d)+b.shadeWeight*shade-b.distancePenalty*(path?.cost??Infinity)-(r.recentTargetIds.includes(c.id)?b.recentPenalty:0));
            return {...c,path,weight};
        }).filter(c=>c.path && c.path.cost<=b.maxCandidatePathCost);
        let roll=draw(w,ctx,'resident-choice',r.id)*choices.reduce((s,c)=>s+c.weight,0);
        const chosen=choices.find(c=>{ roll-=c.weight; return roll<0; });
        if(!chosen) { r.state='idle'; continue; }
        r.targetId=chosen.id; r.path=chosen.path!.path; r.edgeProgress=0; r.state=r.path.length?'moving':'using';
        if(!r.path.length) r.dwellUntil=w.tick+b.dwellTicks;
        r.recentTargetIds=[...r.recentTargetIds,chosen.id].slice(-b.recentCount);
        const seat=props.find(p=>p.id===chosen.id); if(seat?.kind==='bench') seat.reservedById=r.id;
    }
    for(const a of w.residents) for(const b of w.residents) if(a.id<b.id) {
        const id=`pair:${a.id}:${b.id}`, since=`${id}:since`, last=`${id}:last`;
        if(['using','reacting'].includes(a.state)&&['using','reacting'].includes(b.state)&&distance(a.position,b.position)<=ctx.config.gathering.radius) {
            w.randomEvaluationOrdinals[since]??=w.tick;
            if(w.tick-w.randomEvaluationOrdinals[since]>=ctx.config.gathering.minDwellTicks && w.tick-(w.randomEvaluationOrdinals[last]??-Infinity)>=ctx.config.gathering.pairCooldownTicks) {
                a.state='reacting'; b.state='reacting'; w.randomEvaluationOrdinals[last]=w.tick;
            }
        } else delete w.randomEvaluationOrdinals[since];
    }
}
export function insectProbability(flowers: number, moisture: number, weather: WorldState['weather'], ctx: EngineContext) {
    const b=ctx.config.insects, f=clamp(flowers/b.flowerSaturation), m=clamp(1-Math.abs(moisture-b.moistureOptimum)/b.moistureTolerance), h=b.habitatFlowerWeight*f+b.habitatMoistureWeight*m;
    return !flowers || h<b.minHabitat ? 0:Math.min(b.probabilityCap,(b.visitBaseP+b.habitatWeight*h)*b.weatherMultiplier[weather]);
}
export function visits(w: WorldState, ctx: EngineContext) {
    w.insectVisits=w.insectVisits.filter(v=>v.expiresTick>w.tick);
    if(w.tick%ctx.config.insects.evaluateEveryTicks) return;
    for(const chunk of w.chunks) {
        const roll=draw(w,ctx,'insects',chunk.id);
        const flowers=activeProps(w).filter(p=>p.kind==='flowers'&&Math.floor(p.position[0]/ctx.config.scope.chunkSide)===chunk.coordinate[0]&&Math.floor(p.position[1]/ctx.config.scope.chunkSide)===chunk.coordinate[1]);
        const patches=flowers.map(f=>({f,near:flowers.filter(p=>distance(p.position,f.position)<=ctx.config.insects.flowerRadius)})).sort((a,b)=>b.near.length-a.near.length||a.f.position[0]-b.f.position[0]||a.f.position[1]-b.f.position[1]);
        const patch=patches[0]; if(!patch) continue;
        const nearby=chunk.cells.filter(c=>distance(c.position,patch.f.position)<=ctx.config.insects.flowerRadius);
        const moisture=nearby.reduce((s,c)=>s+c.moisture,0)/nearby.length;
        if(roll>=insectProbability(patch.near.length,moisture,w.weather,ctx)||w.insectVisits.filter(v=>v.chunkId===chunk.id).length>=ctx.config.scope.maxInsectGroupsPerChunk) continue;
        const id=`insects:${chunk.id}:${w.tick}`, variant=draw(w,ctx,'insect-variant',chunk.id)<ctx.config.insects.rareVariantConditionalP?'unusual':'ordinary';
        w.insectVisits.push({id,chunkId:chunk.id,position:patch.f.position,variant,createdTick:w.tick,expiresTick:w.tick+ctx.config.insects.groupLifetimeTicks});
        observe(w,'visit',[id],patch.f.position,{weather:w.weather,variant});
    }
}
export function availableHomes(w: WorldState, hubId: string, ctx: EngineContext) {
    const hub=activeProps(w).find(p=>p.id===hubId);
    if(hub?.kind!=='hub') return [];
    return activeProps(w).filter(p=>p.kind==='home'&&p.hubId===hubId&&w.residents.filter(r=>r.homeId===p.id).length<p.beds&&(route(w,p.entrance,hub.entrance)?.cost??Infinity)<=ctx.config.transport.serviceMaxPathCost);
}
/** Shared by admission evaluation and its UI; observing readiness never draws randomness. */
export function settlementReadiness(w: WorldState, hubId: string, ctx: EngineContext) {
    const hub=activeProps(w).find(h=>h.id===hubId), metric=w.hubMetrics.find(m=>m.hubId===hubId), p=ctx.config.population;
    const population=w.residents.filter(r=>r.hubId===hubId).length, homes=availableHomes(w,hubId,ctx);
    const history=metric?.history??[];
    const requested=history.reduce((s,h)=>s+h.requested,0), served=history.reduce((s,h)=>s+h.served,0), delivered=history.reduce((s,h)=>s+h.delivered,0);
    const required=(population+1)*p.minFoodReservePerNextResident, food=hub?.kind==='hub'?hub.inventory.food:0;
    const historyReady=!!metric && w.tick-metric.historyStartedTick>=p.historyTicks;
    const serviceReady=!requested||served/requested>=p.minServiceCoverage;
    const supplyReady=delivered+Math.max(0,food-population*p.minSupplyPerNextResident)>=(population+1)*p.minSupplyPerNextResident;
    const reserveReady=food>=required;
    return {hub,homes,population,required,historyReady,serviceReady,supplyReady,reserveReady,
        eligible:hub?.kind==='hub' && homes.length>0 && historyReady && serviceReady && supplyReady && reserveReady};
}
export function settlement(w: WorldState, ctx: EngineContext) {
    if(w.tick%ctx.config.simulation.settlementEveryTicks) return;
    const roll=draw(w,ctx,'settlement','world'), p=ctx.config.population;
    const candidates=[];
    for(const metric of w.hubMetrics) {
        const {hub,homes,required,eligible}=settlementReadiness(w,metric.hubId,ctx);
        metric.eligibleStreak=eligible?metric.eligibleStreak+1:0;
        if(eligible && metric.eligibleStreak>=p.eligibleEvaluationsRequired && hub?.kind==='hub') candidates.push({hub,homes,required,slots:homes.reduce((s,h)=>s+(h.kind==='home'?h.beds:0)-w.residents.filter(r=>r.homeId===h.id).length,0)});
    }
    if(w.offer?.status==='pending' || w.tick<w.nextOfferEligibleTick || w.residents.length>=ctx.config.scope.prototypePopulationCap) return;
    candidates.sort((a,b)=>b.slots-a.slots||a.hub.id.localeCompare(b.hub.id));
    const candidate=candidates[0]; if(!candidate) return;
    const probability=p.arrivalProbabilityMin+(p.arrivalProbabilityMax-p.arrivalProbabilityMin)*clamp((candidate.hub.inventory.food/candidate.required-1)/2);
    if(roll>=probability) return;
    w.offer={id:`offer:${w.tick}`,templateId:`r${w.residents.length%6+1}`,preferredHubId:candidate.hub.id,createdTick:w.tick,status:'pending'};
    observe(w,'settlement',[w.offer.id],candidate.hub.entrance);
}
