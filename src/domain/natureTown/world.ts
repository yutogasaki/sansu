import balance from './balance.json';
import content from './content.json';
import starter from './starter.json';
import type { CellPos, Chunk, EngineContext, Prop, Resident, WorldState } from './types';
import { environment } from './environment';
import { randomAt } from './random';
export const context = (capabilities: EngineContext['capabilities'] = new Set(balance.learning.initialCapabilities as import('./types').Capability[])): EngineContext => ({config:balance,capabilities,randomAt});
export function makeProp(id: string, kind: Prop['kind'], position: CellPos, rotation: Prop['rotation']=0): Prop {
    const offsets: Record<Prop['rotation'],CellPos>={0:[0,1],90:[1,0],180:[0,-1],270:[-1,0]};
    const o=offsets[rotation], entrance: CellPos=[position[0]+o[0],position[1]+o[1]];
    const base={id,kind,position,rotation,stored:false};
    if (kind==='farm') return {...base,kind,entrance,growth:0,inventory:{food:0,capacity:balance.plants.farmStorageCap,incomingReserved:0,outgoingReserved:0}};
    if (kind==='hub') return {...base,kind,entrance,transportPolicy:'hand',inventory:{food:0,capacity:balance.transport.pantryCap,incomingReserved:0,outgoingReserved:0}};
    if (kind==='home') return {...base,kind,entrance,beds:balance.population.bedsPerHouse,hubId:''};
    if (kind==='bench') return {...base,kind,entrance};
    return {...base,kind};
}
export function makeChunk(coordinate: CellPos): Chunk {
    const size=balance.scope.chunkSide, template=starter.futureChunkTemplates.find(t=>t.chunk[0]===coordinate[0]&&t.chunk[1]===coordinate[1]);
    const water=template?.waterWorldCells ?? starter.terrain.waterCells;
    const cells: Chunk['cells']=[];
    for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
        const position: CellPos=[coordinate[0]*size+x,coordinate[1]*size+y];
        cells.push({position,terrain:water.some(p=>p[0]===position[0]&&p[1]===position[1])?'water':'ground',elevation:template?.ridge && position[0]<=template.ridge.worldXRange[1] ? template.ridge.height:0,moisture:0,shade:0,traffic:0,path:false,bridge:false,channel:false});
    }
    return {id:`chunk:${coordinate.join(',')}`,coordinate,terrainVersion:'0.2.0',opened:true,cells};
}
export function makeResident(id: string, index: number, homeId: string, hubId: string, position: CellPos): Resident {
    const t=content.residentProfiles[index%content.residentProfiles.length];
    return {id,templateId:t.id,appearanceRef:t.appearanceRef,homeId,hubId,position,naturePreference:t.naturePreference,socialPreference:t.socialPreference,state:'idle',path:[],edgeProgress:0,carriedFood:0,recentTargetIds:[]};
}
export function newWorld(profileId: string, seed=starter.seed): WorldState {
    const w: WorldState={schemaVersion:'0.2.0',engineVersion:'nature-town-1',balanceVersion:balance.specVersion,worldId:`nature:${profileId}`,profileId,seed,tick:0,revision:0,weather:'clear',chunks:[makeChunk([0,0])],props:[],residents:[],jobs:[],hubMetrics:[],nextOfferEligibleTick:0,insectVisits:[],randomEvaluationOrdinals:{},observations:[],significantMilestones:[],recentlyAppliedCommandIds:[],foodAccounting:{initialized:12,harvested:0,consumed:0}};
    w.props=starter.props.map(p=> {
        const prop=makeProp(p.id,p.definitionId as Prop['kind'],p.position as unknown as CellPos);
        if ('inventory' in prop) prop.inventory.food=('food' in p ? p.food : 0) ?? 0;
        if (prop.kind==='farm') prop.growth=('growth' in p ? p.growth:0) ?? 0;
        if (prop.kind==='home') prop.hubId='hub-0';
        return prop;
    });
    for(const c of w.chunks[0].cells) c.path=starter.pathCells.some(p=>p[0]===c.position[0]&&p[1]===c.position[1]);
    w.residents=starter.residents.map((r,i)=>makeResident(r.id,i,r.homeId,r.hubId,r.position as unknown as CellPos));
    w.hubMetrics=[{hubId:'hub-0',historyStartedTick:0,history:[],eligibleStreak:0}];
    environment(w,context(),true); return w;
}
