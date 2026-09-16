import type { EngineContext, Transition, WorldState } from './types';
import { activeProps, at, cells } from './grid';
import { environment, growthRate } from './environment';
import { deliver, meals } from './transport';
import { draw, settlement, visits, wander } from './life';
export function stepWorld(state: WorldState, ctx: EngineContext): Transition {
    const w=structuredClone(state); w.tick++; const events: Transition['events']=[];
    if(w.tick%ctx.config.simulation.weatherEveryTicks===0) {
        const roll=draw(w,ctx,'weather','world'), weights=ctx.config.weather.weights;
        w.weather=roll<weights.clear?'clear':roll<weights.clear+weights.cloud?'cloud':'rain';
    }
    environment(w,ctx);
    for(const c of cells(w)) c.traffic*=ctx.config.transport.trafficDecayPerTick;
    for(const p of activeProps(w)) if(p.kind==='farm') {
        const c=at(w,p.position)!; p.growth+=growthRate(c.moisture,c.shade,w,ctx);
        if(p.growth>=1) {
            if(p.inventory.capacity-p.inventory.food>=ctx.config.plants.harvestBatch) {
                p.inventory.food+=ctx.config.plants.harvestBatch; p.growth-=1; w.foodAccounting.harvested+=ctx.config.plants.harvestBatch;
                events.push({id:`harvest:${p.id}:${w.tick}`,type:'FoodHarvested',tick:w.tick,subjectIds:[p.id],quantity:ctx.config.plants.harvestBatch,position:p.position});
            } else p.growth=1;
        }
        const k=`farm-ready:${p.id}`;
        if(p.inventory.food>p.inventory.outgoingReserved) w.randomEvaluationOrdinals[k]??=w.tick; else delete w.randomEvaluationOrdinals[k];
    }
    deliver(w,ctx); wander(w,ctx); meals(w,ctx); visits(w,ctx); settlement(w,ctx);
    for(const m of w.hubMetrics) for(const sample of m.history.filter(h=>h.tick===w.tick)) {
        if(sample.delivered) events.push({id:`delivery:${m.hubId}:${w.tick}:${events.length}`,type:'FoodTransferred',tick:w.tick,subjectIds:[m.hubId],quantity:sample.delivered});
        if(sample.requested) events.push({id:`meal:${m.hubId}:${w.tick}`,type:'MealServed',tick:w.tick,subjectIds:[m.hubId],quantity:sample.served});
    }
    for(const v of w.insectVisits.filter(v=>v.createdTick===w.tick)) events.push({id:v.id,type:'VisitorArrived',tick:w.tick,subjectIds:[v.id],position:v.position});
    if(w.offer?.createdTick===w.tick) events.push({id:w.offer.id,type:'SettlementOffered',tick:w.tick,subjectIds:[w.offer.id]});
    w.revision++; return {state:w,events};
}
