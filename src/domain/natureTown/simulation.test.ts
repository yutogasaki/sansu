import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { context, newWorld } from './world';
import { randomAt, sha256 } from './random';
import { applyWorldCommand } from './commands';
import { stepWorld } from './simulation';
import { assertWorld } from './validation';
import { environment, growthRate } from './environment';
import { at, route } from './grid';
import { insectProbability, settlement } from './life';
import { applyProgressCommand, balanceUnits, capabilities, newProgress } from './progress';
import type { EngineContext, LearningCheckpointCompleted, WorldCommandPayload, WorldState } from './types';
const ctx=context();
function command(w: WorldState, payload: WorldCommandPayload, c=ctx, id=`cmd:${w.revision}`) {return applyWorldCommand(w,{commandId:id,profileId:w.profileId,worldId:w.worldId,expectedRevision:w.revision,payload},c);}
function steps(w: WorldState, n: number, c=ctx) {for(let i=0;i<n;i++) {w=stepWorld(w,c).state; assertWorld(w,w.profileId);} return w;}
const checkpoint=(overrides: Partial<LearningCheckpointCompleted>={}): LearningCheckpointCompleted=>({eventId:'e',profileId:'p',assignmentId:'a',checkpointId:'c',subject:'math',completion:'independent',issuedUnits:1,learningRecordRef:'record',issuerVersion:'test',...overrides});
describe('Nature Town deterministic simulation',()=> {
    it('uses the exact UTF-8 SHA-256 reference including non-ASCII IDs',()=> {
        for(const s of ['','abc','種🌿','x'.repeat(1000)]) expect(sha256(s)).toBe(createHash('sha256').update(s).digest('hex'));
        const input=JSON.stringify(['sansu-v0.2','種','insects','花',15]);
        expect(randomAt('種','insects','花',15)).toBe(createHash('sha256').update(input).digest().readUInt32BE(0)/2**32);
    });
    it('SIM-01/04 computes water and shade effects without random harvest',()=> {
        const w=newWorld('p');expect(growthRate(.7,0,w,ctx)).toBeCloseTo(1/120);
        expect(growthRate(.2,0,w,ctx)).toBeLessThan(growthRate(.7,0,w,ctx));
        expect(growthRate(.7,1,w,ctx)).toBeCloseTo(1/240);
    });
    it('SIM-02/03 respects connected channels, upstream height and eight edges',()=> {
        const w=newWorld('p');w.props=[];
        for(let x=2;x<=11;x++) at(w,[x,3])!.channel=true;
        environment(w,ctx,true);
        expect(at(w,[4,3])!.moisture).toBeCloseTo(.7);
        expect(at(w,[2,3])!.moisture).toBeLessThan(.7);
        at(w,[10,3])!.elevation=1;environment(w,ctx,true);
        expect(at(w,[4,3])!.moisture).toBeCloseTo(.2);
        at(w,[10,3])!.elevation=0;at(w,[11,3])!.channel=false;
        const before=at(w,[4,3])!.moisture;environment(w,ctx);
        expect(at(w,[4,3])!.moisture).toBeCloseTo(before);
    });
    it('SIM-06/07/11 conserves all food for 20 active minutes and deterministic save continuation',()=> {
        const initial=newWorld('p');const a=steps(initial,600), b=steps(JSON.parse(JSON.stringify(a)),600);
        expect(b).toEqual(steps(initial,1200));
        expect(b.foodAccounting.harvested).toBeGreaterThan(0);expect(b.foodAccounting.consumed).toBeGreaterThan(0);
        expect(initial.tick).toBe(0);
    },30000);
    it('SIM-05 preserves stored farm inventory and growth through restore',()=> {
        let w=newWorld('p');const farm=w.props.find(p=>p.kind==='farm')!;
        if(farm.kind!=='farm')throw Error();farm.inventory.food=8;farm.growth=1;w.foodAccounting.initialized+=8;
        w=command(w,{type:'storeProp',propId:farm.id}).state;w=steps(w,120);
        const restored=command(w,{type:'restoreProp',propId:farm.id,position:[10,6],rotation:0});expect(restored.rejection).toBeUndefined();
        const next=restored.state.props.find(p=>p.id===farm.id);expect(next).toMatchObject({growth:1,inventory:{food:8}});assertWorld(restored.state,'p');
    });
    it('SIM-08 carries four only over continuously connected road',()=> {
        const create=(cart:boolean,gap:boolean)=> {
            const w=newWorld('p');const farm=w.props.find(p=>p.kind==='farm')!,hub=w.props.find(p=>p.kind==='hub')!;
            if(farm.kind!=='farm'||hub.kind!=='hub')throw Error();farm.inventory.food=4;hub.inventory.food=0;w.foodAccounting.initialized=4;
            hub.transportPolicy=cart?'cart_if_connected':'hand';if(gap)at(w,[11,8])!.path=false;
            const c={...ctx,capabilities:new Set([...ctx.capabilities,'handcart'] as const)};
            return stepWorld(w,c).state.jobs[0]?.quantity;
        };
        expect(create(false,false)).toBe(2);expect(create(true,false)).toBe(4);expect(create(true,true)).toBe(2);
    });
    it('SIM-10 protects carried food when destination is moved',()=> {
        let w=newWorld('p');w=steps(w,100);
        const carrying=Array.from({length:200}).some(()=>{w=stepWorld(w,ctx).state;return w.residents.some(r=>r.carriedFood>0);});expect(carrying).toBe(true);
        const cargo=w.residents.reduce((s,r)=>s+r.carriedFood,0);
        const result=command(w,{type:'moveProp',propId:'hub-0',position:[8,11],rotation:0});expect(result.rejection).toBeUndefined();
        expect(result.state.residents.reduce((s,r)=>s+r.carriedFood,0)).toBe(cargo);assertWorld(result.state,'p');steps(result.state,120);
    });
    it('rejects atomic brushes and occupied-home storage without mutation',()=> {
        const w=newWorld('p'),before=structuredClone(w);
        expect(command(w,{type:'paintPath',cells:[[1,1],[12,1]]}).rejection).toBeDefined();
        expect(command(w,{type:'storeProp',propId:'home-0'}).rejection).toBeDefined();expect(w).toEqual(before);
    });
    it('GROW-06/07 opens connected northern land once, with coordinates preserved',()=> {
        let w=newWorld('p');expect(command(w,{type:'openChunk',coordinate:[0,1]}).rejection).toBeDefined();
        w=command(w,{type:'paintPath',cells:Array.from({length:7},(_,i)=>[9,9+i] as const)}).state;
        const old=w.props;w=command(w,{type:'openChunk',coordinate:[0,1]}).state;
        expect(w.chunks).toHaveLength(2);expect(w.props).toEqual(old);expect(w.chunks[1].cells).toHaveLength(256);
        expect(command(w,{type:'openChunk',coordinate:[0,1]}).rejection).toBeDefined();assertWorld(w,'p');
    });
    it('GROW-01/02/03/04/11 separates eligibility, lottery, persistent offer and acceptance',()=> {
        let w=newWorld('p');w=command(w,{type:'placeProp',id:'new-home',kind:'home',position:[8,11],rotation:0}).state;expect(w.residents).toHaveLength(3);
        const hub=w.props.find(p=>p.kind==='hub')!;if(hub.kind!=='hub')throw Error();hub.inventory.food=24;w.foodAccounting.initialized=24;
        w.tick=240;w.hubMetrics[0].history=[{tick:120,requested:3,served:3,delivered:0},{tick:240,requested:3,served:3,delivered:0}];
        const unlucky: EngineContext={...ctx,randomAt:()=>.99};settlement(w,unlucky);w.tick=300;settlement(w,unlucky);expect(w.offer).toBeUndefined();
        w.tick=360;settlement(w,{...ctx,randomAt:()=>0});expect(w.offer?.status).toBe('pending');expect(w.residents).toHaveLength(3);
        const payload: WorldCommandPayload={type:'acceptSettlement',offerId:w.offer!.id,homeId:'new-home'};
        w=command(w,payload).state;expect(w.residents).toHaveLength(4);expect(command(w,payload).rejection).toBeDefined();assertWorld(w,'p');
    });
    it('SIM-09 chooses a longer empty route when the shortcut is congested',()=> {
        const w=newWorld('p');w.props=[];
        for(let x=1;x<=5;x++) {at(w,[x,1])!.path=true;at(w,[x,2])!.path=true;at(w,[x,1])!.traffic=100;}
        const found=route(w,[1,1],[5,1]);expect(found?.path.some(p=>p[1]===2)).toBe(true);
    });
    it('RNG-04 compares 2000 common-random trials to the reference probabilities',()=> {
        const low=insectProbability(1,.3,'clear',ctx),high=insectProbability(4,.65,'clear',ctx);let l=0,h=0;
        for(let i=0;i<2000;i++){const u=randomAt('distribution','insects','patch',i);if(u<low)l++;if(u<high)h++;}
        expect(high-low).toBeGreaterThan(.1);expect(h).toBeGreaterThan(l);
        for(const [actual,p] of [[l/2000,low],[h/2000,high]]) expect(Math.abs(actual-p)).toBeLessThan(4*Math.sqrt(p*(1-p)/2000));
    });
});
describe('learning ledger',()=> {
    it('EDU-01/02 supports equal credit and both dedupe keys',()=> {
        const start=newProgress('p');const a=applyProgressCommand(start,{type:'applyCheckpoint',event:checkpoint()}).progress;
        const b=applyProgressCommand(start,{type:'applyCheckpoint',event:checkpoint({completion:'supported'})}).progress;expect(balanceUnits(a)).toBe(balanceUnits(b));
        expect(applyProgressCommand(a,{type:'applyCheckpoint',event:checkpoint({eventId:'different'})}).duplicate).toBe(true);
        expect(applyProgressCommand(a,{type:'applyCheckpoint',event:checkpoint({assignmentId:'different'})}).duplicate).toBe(true);
    });
    it('EDU-05/06/07 spends atomically once and preserves excess credit',()=> {
        let p=newProgress('p');for(let i=0;i<8;i++)p=applyProgressCommand(p,{type:'applyCheckpoint',event:checkpoint({eventId:`e${i}`,assignmentId:`a${i}`})}).progress;
        const unlock={type:'unlock' as const,profileId:'p',commandId:'u',expectedRevision:p.revision,capability:'irrigation' as const};
        p=applyProgressCommand(p,unlock).progress;expect(balanceUnits(p)).toBe(5);expect(capabilities(p).has('irrigation')).toBe(true);expect(applyProgressCommand(p,unlock).progress).toEqual(p);
        expect(applyProgressCommand(newProgress('p'),{...unlock,expectedRevision:0}).rejection).toBeDefined();
    });
});
