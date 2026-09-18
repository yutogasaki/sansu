import { describe, expect, it } from 'vitest';
import { applyWorldCommand, canOpen } from './commands';
import { environment, growthRate } from './environment';
import { at, cells } from './grid';
import { settlement, visits, wander } from './life';
import { applyProgressCommand, capabilities, newProgress } from './progress';
import { stepWorld } from './simulation';
import { assertWorld } from './validation';
import { context, makeResident, newWorld } from './world';
import type { EngineContext, WorldCommandPayload, WorldState } from './types';
const ctx = context();
function command(w: WorldState, payload: WorldCommandPayload, c = ctx) {
    return applyWorldCommand(w, {commandId:`test:${w.revision}`, profileId:'p', worldId:w.worldId, expectedRevision:w.revision, payload}, c);
}
function edit(w: WorldState, payload: WorldCommandPayload, c = ctx) {
    const result = command(w, payload, c);
    expect(result.rejection).toBeUndefined();
    assertWorld(result.state, 'p');
    return result.state;
}
function credited(units: number) {
    let p = newProgress('p');
    for (let i = 0; i < units; i++) p = applyProgressCommand(p, {type:'applyCheckpoint', event:{eventId:`e${i}`,profileId:'p',assignmentId:`a${i}`,checkpointId:'c',subject:'math',completion:'supported',issuedUnits:1,learningRecordRef:`record:${i}`,issuerVersion:'diagnostic'}}).progress;
    for (const capability of ['irrigation','handcart'] as const) p = applyProgressCommand(p,{type:'unlock',commandId:capability,profileId:'p',expectedRevision:p.revision,capability}).progress;
    return p;
}
describe('NT-3 growth and random boundaries (diagnostic fixtures)', () => {
    it('GROW-10 supports future adjacent allowed chunks while rejecting gaps, duplicates and unlisted land', () => {
        const c: EngineContext = {...ctx, config:{...ctx.config,scope:{...ctx.config.scope,expandableChunks:[[0,1],[0,2],[-1,0]]}}};
        let w = newWorld('p');
        const ids = w.residents.map(r => r.id);
        expect(canOpen(w,[0,2],c)).toBe(false);
        w = edit(w,{type:'paintPath',cells:Array.from({length:7},(_,i)=>[8,9+i] as const)},c);
        w = edit(w,{type:'openChunk',coordinate:[0,1]},c);
        expect(canOpen(w,[0,2],c)).toBe(false);
        w = edit(w,{type:'paintPath',cells:Array.from({length:16},(_,i)=>[8,16+i] as const)},c);
        w = edit(w,{type:'openChunk',coordinate:[0,2]},c);
        w = edit(w,{type:'paintPath',cells:Array.from({length:9},(_,i)=>[i,9] as const)},c);
        w = edit(w,{type:'openChunk',coordinate:[-1,0]},c);
        expect(w.chunks.map(x=>x.id)).toEqual(['chunk:0,0','chunk:0,1','chunk:0,2','chunk:-1,0']);
        expect(w.residents.map(r=>r.id)).toEqual(ids);
        expect(command(w,{type:'openChunk',coordinate:[0,2]},c).rejection).toBeDefined();
        expect(command(w,{type:'openChunk',coordinate:[1,0]},c).rejection).toBeDefined();
    });

    it('GROW-10 stops at nine, retains a pending offer at the cap and permits a higher configured cap', () => {
        let w = newWorld('p');
        for (const [i,position] of ([[6,11],[8,11],[10,11]] as const).entries()) w = edit(w,{type:'placeProp',id:`home-extra-${i}`,kind:'home',position,rotation:0});
        for (let i = 3; i < 8; i++) w.residents.push(makeResident(`diagnostic:${i}`,i,`home-extra-${Math.floor((i-3)/3)}`,'hub-0',[8,9]));
        w.offer={id:'offer:cap',templateId:'r1',preferredHubId:'hub-0',createdTick:0,status:'pending'};
        w = edit(w,{type:'acceptSettlement',offerId:'offer:cap',homeId:'home-extra-1'});
        expect(w.residents).toHaveLength(9);
        w.offer={id:'offer:future',templateId:'r2',preferredHubId:'hub-0',createdTick:0,status:'pending'};
        const payload = {type:'acceptSettlement' as const,offerId:'offer:future',homeId:'home-extra-2'};
        expect(command(w,payload).rejection).toBeDefined();
        expect(w.offer.status).toBe('pending');
        const c={...ctx,config:{...ctx.config,scope:{...ctx.config.scope,prototypePopulationCap:10}}};
        w=edit(w,payload,c);
        expect(w.residents).toHaveLength(10);
        expect(new Set(w.residents.map(r=>r.id)).size).toBe(10);
    });

    it('GROW-09/RNG-06 leaves population, tools and expansion independent of rare visits', () => {
        const c={...ctx,randomAt:(_seed:string,system:string)=>system==='insect-variant'?.99:0};
        let w=newWorld('p');
        w=edit(w,{type:'placeProp',kind:'home',id:'vacant',position:[8,11],rotation:0},c);
        const hub=w.props.find(p=>p.kind==='hub')!;
        if(hub.kind!=='hub') throw Error('hub');
        hub.inventory.food=24; w.foodAccounting.initialized=24;
        w.tick=240; settlement(w,c); w.tick=300; settlement(w,c);
        expect(w.offer?.status).toBe('pending');
        visits(w,c);
        expect(w.insectVisits.length).toBeGreaterThan(0);
        expect(w.insectVisits.every(v=>v.variant==='ordinary')).toBe(true);
        const unlocked=context(capabilities(credited(6)));
        w=edit(w,{type:'paintChannel',cells:[[11,3]]},unlocked);
        w=edit(w,{type:'setHubTransportPolicy',hubId:'hub-0',policy:'cart_if_connected'},unlocked);
        w=edit(w,{type:'paintPath',cells:Array.from({length:7},(_,i)=>[9,9+i] as const)},unlocked);
        w=edit(w,{type:'openChunk',coordinate:[0,1]},unlocked);
        expect(w.residents).toHaveLength(3);
        expect(w.chunks).toHaveLength(2);
        expect(unlocked.capabilities.size).toBe(10);
    });

    it('RNG-05/07 evaluates once per interval despite repainting, failures, weather and full visitor slots', () => {
        let w=newWorld('p');
        const ordinals=structuredClone(w.randomEvaluationOrdinals);
        for(let i=0;i<20;i++) w=edit(w,{type:'paintPath',cells:[[1,1],[1,1]]});
        for(let i=0;i<8;i++) w=edit(w,{type:'placeProp',id:`flower:${i}`,kind:'flowers',position:[i,2],rotation:0});
        expect(w.randomEvaluationOrdinals).toEqual(ordinals);
        const failing={...ctx,randomAt:()=>.999};
        for(let tick=1;tick<=360;tick++) w=stepWorld(w,failing).state;
        expect(w.insectVisits).toHaveLength(0);
        expect(w.foodAccounting.harvested).toBeGreaterThan(0);
        expect(w.foodAccounting.consumed).toBeGreaterThan(0);
        expect(w.randomEvaluationOrdinals['["insects","chunk:0,0"]']).toBe(12);
        const winning={...ctx,randomAt:()=>0};
        w.insectVisits=Array.from({length:3},(_,i)=>({id:`full:${i}`,chunkId:'chunk:0,0',position:[1,1] as const,variant:'ordinary' as const,createdTick:360,expiresTick:500}));
        w.weather='rain'; w.tick=390; visits(w,winning);
        expect(w.insectVisits).toHaveLength(3);
        expect(w.randomEvaluationOrdinals['["insects","chunk:0,0"]']).toBe(13);
        expect(w.randomEvaluationOrdinals['["insect-variant","chunk:0,0"]']).toBeUndefined();
        w.tick=510; visits(w,winning);
        expect(w.insectVisits).toHaveLength(1);
        expect(w.insectVisits[0]).toMatchObject({createdTick:510,expiresTick:570});
        expect(w.randomEvaluationOrdinals['["insects","chunk:0,0"]']).toBe(14);
    });

    it('RNG-08 keeps world outcomes identical with different earned learning rights', () => {
        let a=newWorld('p'), b=structuredClone(a);
        const moreLearning=context(capabilities(credited(12)));
        for(let i=0;i<180;i++) {
            const x=stepWorld(a,ctx), y=stepWorld(b,moreLearning);
            expect(y.events).toEqual(x.events); a=x.state;b=y.state;
        }
        expect(b).toEqual(a);
    });

    it('SIM-04 moves the same tree, changing crop shade and its reachable rest destination', () => {
        let w=newWorld('p');
        w=edit(w,{type:'moveProp',propId:'tree-0',position:[9,6],rotation:0});
        environment(w,ctx,true);
        const shaded=at(w,[10,6])!;
        const rate=growthRate(.7,shaded.shade,w,ctx);
        expect(shaded.shade).toBeGreaterThan(0);
        // Keep one tree candidate, no other attractions, to observe its actual reachable destination.
        const rest=(source:WorldState)=> {
            const diagnostic=structuredClone(source);
            diagnostic.props=diagnostic.props.filter(p=>p.id==='tree-0');
            diagnostic.residents=[makeResident('rest',0,'home-0','hub-0',[8,7])];
            for(const cell of cells(diagnostic)) cell.terrain='ground';
            diagnostic.tick=5; wander(diagnostic,{...ctx,randomAt:()=>0});
            return diagnostic.residents[0];
        };
        const before=rest(w);
        expect(before.targetId).toBe('tree-0');
        w=edit(w,{type:'moveProp',propId:'tree-0',position:[3,6],rotation:0});
        environment(w,ctx,true);
        expect(growthRate(.7,at(w,[10,6])!.shade,w,ctx)).toBeGreaterThan(rate);
        const after=rest(w);
        expect(after.targetId).toBe('tree-0');
        expect(after.path.at(-1)).not.toEqual(before.path.at(-1));
        expect(w.props.find(p=>p.id==='tree-0')).toMatchObject({id:'tree-0',position:[3,6]});
    });
});
