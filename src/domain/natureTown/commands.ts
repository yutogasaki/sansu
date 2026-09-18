import type { CellPos, EngineContext, Prop, Transition, WorldCommand, WorldState } from './types';
import { activeProps, at, cells, entrance, equal, graph, key, neighbors, route, validBridges } from './grid';
import { makeChunk, makeProp, makeResident } from './world';
import { availableHomes, observe } from './life';
import { repairAfterEdit } from './transport';
import { environment } from './environment';
import starter from './starter.json';
function validPlacement(w: WorldState, prop: Prop, ctx: EngineContext) {
    const cell=at(w,prop.position); if(!cell || cell.terrain!=='ground') return false;
    if(activeProps(w).some(p=>p.id!==prop.id && (equal(p.position,prop.position)||'entrance' in p&&equal(p.entrance,prop.position)))) return false;
    if(cell.path||cell.bridge||cell.channel) return false;
    if('entrance' in prop) {
        const e=at(w,prop.entrance);
        if(!e || !graph(w).has(key(prop.entrance))) return false;
    }
    return activeProps(w).filter(p=>p.id!==prop.id && Math.floor(p.position[0]/ctx.config.scope.chunkSide)===Math.floor(prop.position[0]/ctx.config.scope.chunkSide)&&Math.floor(p.position[1]/ctx.config.scope.chunkSide)===Math.floor(prop.position[1]/ctx.config.scope.chunkSide)).length<ctx.config.scope.maxPropsPerChunk;
}
export function canOpen(w: WorldState, coordinate: CellPos, ctx: EngineContext) {
    if(!ctx.config.scope.expandableChunks.some(p=>equal(p as unknown as CellPos,coordinate))||w.chunks.some(c=>equal(c.coordinate,coordinate))) return false;
    const hub=activeProps(w).find(p=>p.id==='hub-0'); if(hub?.kind!=='hub') return false;
    const land=new Set(makeChunk(coordinate).cells.filter(c=>c.terrain==='ground').map(c=>key(c.position)));
    return cells(w).some(c=>c.terrain==='ground'&&c.path&&neighbors(c.position).some(p=>land.has(key(p)))&&route(w,hub.entrance,c.position,true));
}
export function applyWorldCommand(state: WorldState, command: WorldCommand, ctx: EngineContext): Transition {
    const reject=(message='そこには おけないよ。べつの ばしょを ためそう。'): Transition=>({state,events:[],rejection:{code:'invalid-command',childMessage:message}});
    if(command.profileId!==state.profileId||command.worldId!==state.worldId) return reject();
    if(state.recentlyAppliedCommandIds.includes(command.commandId)) return {state,events:[]};
    if(command.expectedRevision!==state.revision) return reject('しまが かわったよ。もういちど えらんでね。');
    const w=structuredClone(state), p=command.payload;
    let edit=false;
    if(p.type==='placeProp') {
        if(!p.id||w.props.some(q=>q.id===p.id)||!ctx.capabilities.has(p.kind)) return reject();
        const prop=makeProp(p.id,p.kind,p.position,p.rotation);
        if(!validPlacement(w,prop,ctx)) return reject();
        w.props.push(prop);
        if(prop.kind==='hub') w.hubMetrics.push({hubId:prop.id,historyStartedTick:w.tick,history:[],eligibleStreak:0});
        if(prop.kind==='home') {
            const best=activeProps(w).filter(h=>h.kind==='hub').map(h=>({h,path:route(w,prop.entrance,h.entrance)})).filter(h=>h.path).sort((a,b)=>a.path!.cost-b.path!.cost||a.h.id.localeCompare(b.h.id))[0];
            prop.hubId=best?.h.id??'';
        }
        edit=true;
    } else if(p.type==='moveProp'||p.type==='restoreProp'||p.type==='storeProp') {
        const prop=w.props.find(q=>q.id===p.propId); if(!prop) return reject();
        if(p.type==='storeProp') {
            if(prop.stored) return reject();
            if(prop.kind==='home'&&w.residents.some(r=>r.homeId===prop.id)) return reject('すんでいる 家は「うごかす」で ばしょを かえよう。');
            if(prop.kind==='hub'&&w.residents.some(r=>r.hubId===prop.id)) return reject('先に 家の 食たくを かえてね。');
            prop.stored=true;
        } else {
            if(p.type==='restoreProp'!==prop.stored) return reject();
            const replacement={...prop,...{position:p.position,rotation:p.rotation,stored:false}};
            if('entrance' in replacement) replacement.entrance=entrance(makeProp(prop.id,prop.kind,p.position,p.rotation));
            // Validate against the world with the moving object removed, including its old blocked cell.
            const validation={...w,props:w.props.filter(q=>q.id!==prop.id)};
            if(!validPlacement(validation,replacement,ctx)) return reject();
            Object.assign(prop,replacement);
        }
        edit=true;
    } else if(p.type==='paintPath'||p.type==='paintChannel'||p.type==='placeBridge'||p.type==='removeOverlay') {
        if(!p.cells.length||p.cells.some(c=>!Number.isInteger(c[0])||!Number.isInteger(c[1]))) return reject();
        const kind=p.type==='removeOverlay'?p.kind:p.type==='paintPath'?'path':p.type==='paintChannel'?'channel':'bridge';
        if(p.type!=='removeOverlay'&&!ctx.capabilities.has(kind==='channel'?'irrigation':kind)) return reject('この どうぐは れんしゅうで ひらけるよ。');
        for(const position of p.cells) {
            const c=at(w,position); if(!c) return reject();
            if(p.type!=='removeOverlay' && (activeProps(w).some(q=>q.kind!=='flowers'&&equal(q.position,position)) || (kind==='bridge'?c.terrain!=='water':c.terrain!=='ground'))) return reject();
            c[kind]=p.type!=='removeOverlay';
        }
        if(p.type==='placeBridge'&&p.cells.some(c=>!validBridges(w).has(key(c)))) return reject('橋の 両がわを 岸に つなごう。');
        edit=true;
    } else if(p.type==='openChunk') {
        if(!canOpen(w,p.coordinate,ctx)) return reject('食たくから 境めまで 道を つなごう。');
        const chunk=makeChunk(p.coordinate);
        w.chunks.push(chunk);
        const template=starter.futureChunkTemplates.find(t=>equal(t.chunk as unknown as CellPos,p.coordinate));
        for(const q of template?.initialProps??[]) w.props.push(makeProp(q.id,q.definitionId as Prop['kind'],q.position as unknown as CellPos));
        observe(w,'expansion',[`chunk:${key(p.coordinate)}`],[p.coordinate[0]*ctx.config.scope.chunkSide,p.coordinate[1]*ctx.config.scope.chunkSide]);
        environment(w,ctx,new Set(chunk.cells.map(c=>key(c.position)))); edit=true;
    } else if(p.type==='assignHomeHub') {
        const home=activeProps(w).find(q=>q.id===p.homeId), hub=activeProps(w).find(q=>q.id===p.hubId);
        if(home?.kind!=='home'||hub?.kind!=='hub'||!route(w,home.entrance,hub.entrance)) return reject();
        home.hubId=hub.id; for(const r of w.residents) if(r.homeId===home.id) r.hubId=hub.id;
    } else if(p.type==='setHubTransportPolicy') {
        const hub=w.props.find(q=>q.id===p.hubId);
        if(hub?.kind!=='hub'||p.policy==='cart_if_connected'&&!ctx.capabilities.has('handcart')) return reject();
        hub.transportPolicy=p.policy;
    } else if(p.type==='acceptSettlement') {
        const offer=w.offer;
        if(!offer||offer.status!=='pending'||offer.id!==p.offerId||w.residents.length>=ctx.config.scope.prototypePopulationCap) return reject();
        const home=availableHomes(w,offer.preferredHubId,ctx).find(h=>h.id===p.homeId);
        if(home?.kind!=='home') return reject('空いている 家と 食たくへの 道を たしかめよう。');
        const r=makeResident(`resident:${offer.id}`,w.residents.length,home.id,home.hubId,home.entrance);
        w.residents.push(r); offer.status='accepted'; offer.admittedResidentId=r.id;
        w.nextOfferEligibleTick=w.tick+ctx.config.population.arrivalCooldownTicks;
        for(const m of w.hubMetrics) m.eligibleStreak=0;
        observe(w,'settlement',[r.id],home.position);
    }
    if(edit) repairAfterEdit(w);
    if(w.residents.some(r=>!graph(w).has(key(r.position)))) return reject();
    w.recentlyAppliedCommandIds.push(command.commandId); w.revision++;
    return {state:w,events:[]};
}
