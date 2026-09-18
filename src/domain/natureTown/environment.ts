import type { EngineContext, WorldState } from './types';
import { activeProps, cells, distance, key, neighbors } from './grid';
export const clamp = (n: number) => Math.max(0,Math.min(1,n));
export function channelSources(w: WorldState, ctx: EngineContext) {
    const b=ctx.config, all=cells(w), map=new Map(all.map(c=>[key(c.position),c]));
    const water=all.filter(c=>c.terrain==='water'), sources=[...water];
    const reached = new Set(water.map(c=>key(c.position)));
    let frontier=water;
    for (let step=0; step<b.water.channelMaxSteps; step++) {
        const next: typeof water=[];
        for (const c of frontier) for (const p of neighbors(c.position)) {
            const n=map.get(key(p));
            if (n?.channel && n.elevation<=c.elevation && !reached.has(key(p))) { reached.add(key(p)); next.push(n); sources.push(n); }
        }
        frontier=next;
    }
    return {reached,sources};
}
/** true initializes the world; a cell-key set initializes only newly opened land. */
export function environment(w: WorldState, ctx: EngineContext, initial: boolean | ReadonlySet<string> = false) {
    const b=ctx.config, all=cells(w), {reached,sources}=channelSources(w,ctx);
    const trees=activeProps(w).filter(p=>p.kind==='tree');
    for (const c of all) {
        c.shade=trees.reduce((v,t)=>Math.max(v,clamp(1-distance(t.position,c.position)/b.plants.treeShadeRadius)),0);
        const influence=sources.reduce((v,s)=>Math.max(v,clamp(1-Math.max(0,distance(s.position,c.position)-1)/b.water.sourceInfluenceRadius)),0);
        const target=clamp(b.water.baseMoisture+b.water.waterWeight*influence+b.water.shadeRetention*c.shade+b.weather.moistureAdd[w.weather]);
        if(initial===false) c.moisture=clamp(c.moisture+b.water.relaxationPerTick*(target-c.moisture));
        else if(initial===true || initial.has(key(c.position))) c.moisture=target;
    }
    return reached;
}
export function growthRate(moisture: number, shade: number, w: WorldState, ctx: EngineContext) {
    const p=ctx.config.plants;
    return clamp((moisture-p.cropDryPoint)/(p.cropFullWaterPoint-p.cropDryPoint))*clamp((p.cropWetPenaltyEnd-moisture)/(p.cropWetPenaltyEnd-p.cropWetPenaltyStart))*ctx.config.weather.lightFactor[w.weather]*(1-p.shadeLightPenalty*shade)/p.cropCycleTicksAtFullRate;
}
