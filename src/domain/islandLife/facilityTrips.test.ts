import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { HOUR, LIFE_RULES, LIFE_STEP_MS, learningDay, newLife, type LifeState } from './model';
import { advanceLifeState, applyCommand, commandLife, replayLife } from './simulation';
import { prepareEconomyMigration } from './economyMigration';
import { prepareTourMigration } from './tourMigration';
import { prepareFacilityMigration, verifyFacilityCutover } from './facilityMigration';
import { IslandLifeDatabase, updateLife } from './repository';
import { observationVisit } from './observationVisit';
function fixture(kind: 'library' | 'garden-hut'): LifeState {
    const s = replayLife(newLife('trip', 0)); s.facilityTripVersion = 1; s.tourVersion = 1;
    s.items = [{id:'facility',kind,cell:{x:0,z:0},style:'original',growth:0},
        {id:'target',kind:kind==='library'?'bench':'flower',cell:{x:3,z:2},style:'original',growth:0,access:'front'}];
    s.residents = s.residents.slice(0,1); s.residents[0].visit = undefined; s.residents[0].cell = {x:0,z:2}; s.target = 'facility';
    return s;
}
async function legacy() {
    const r = newLife('trip', 0); r.credits = Array.from({length:100},(_,i)=>({id:`q${i}`,at:0,day:learningDay(0)}));
    let next = await prepareTourMigration(await prepareEconomyMigration(r, []));
    next = commandLife(next,{type:'buy',kind:'library',cell:{x:0,z:0}},'facility',100);
    return commandLife(next,{type:'buy',kind:'bench',cell:{x:3,z:2}},'target',100);
}
describe('one resident collects, carries and uses facility work',()=>{
    it.each(['library','garden-hut'] as const)('%s reserves its partner and crosses actual adjacent ground without awarding a second use',kind=>{
        const s=fixture(kind); advanceLifeState(s,0); const r=s.residents[0];
        expect(r.facilityTrip?.phase).toBe('collect'); expect(r.visit?.itemId).toBe('facility');
        expect(observationVisit(s,'target').kind).toBe(kind==='library'?'busy':'unavailable');
        advanceLifeState(s,2000); expect(r.facilityTrip?.phase).toBe('carry'); expect(r.visit?.itemId).toBe('target');
        expect(r.visit!.from).toEqual({x:0,z:2});expect(r.visit!.path.at(-1)).toEqual({x:3,z:3});
        expect(r.visit!.path.length).toBe(5);
        expect(r.visit!.path.slice(1).every((p,i)=>Math.abs(p.x-r.visit!.path[i].x)+Math.abs(p.z-r.visit!.path[i].z)===1)).toBe(true);
        advanceLifeState(s,2000+4*LIFE_STEP_MS+1000);expect(r.enjoyed).toBe(0);expect(s.light).toBe(0);
        advanceLifeState(s,LIFE_RULES.activityMs);expect(r.enjoyed).toBe(1);expect(s.light).toBe(1);
        expect(r.enjoyedBy[kind==='library'?'bench':'flower']).toBe(1);
        if(kind==='garden-hut')expect(s.items[1].growth).toBeCloseTo(.125);
    });
    it('keeps occupied destinations and old entrance visits, and falls back when the partner is too far',()=>{
        for(const reason of ['occupied','far','legacy']){
            const s=fixture('library');
            if(reason==='occupied')s.residents.push({id:'rabbit',cell:{x:3,z:3},enjoyed:0,enjoyedBy:{},visit:{itemId:'target',from:{x:3,z:3},path:[{x:3,z:3}],start:0,end:HOUR}});
            if(reason==='far')s.items[1].cell={x:5,z:3};
            if(reason==='legacy')delete s.facilityTripVersion;
            advanceLifeState(s,8000);expect(s.residents[0].facilityTrip).toBeUndefined();expect(s.residents[0].visit?.itemId).toBe('facility');
        }
    });
    it('does not give a second user the reserved target and cancels a trip when its target is stored',()=>{
        const s=fixture('library');s.residents.push({id:'rabbit',cell:{x:4,z:3},enjoyed:0,enjoyedBy:{}});
        advanceLifeState(s,3000);expect(s.residents.filter(r=>r.visit?.itemId==='target')).toHaveLength(1);
        expect(s.residents[0].facilityTrip?.phase).toBe('carry');
        applyCommand(s,{id:'store',at:s.now,command:{type:'store',itemId:'target'}});
        expect(s.residents.every(r=>!r.facilityTrip)).toBe(true);expect(s.light).toBe(0);expect(s.residents[0].enjoyed).toBe(0);
    });
    it('replays identically across collection, route, reward and long elapsed boundaries',()=>{
        const full=fixture('garden-hut'),split=structuredClone(full);advanceLifeState(full,3*HOUR);
        for(const at of [100,2000,2001,5000,7100,30*60*1000,HOUR,3*HOUR])advanceLifeState(split,at);
        expect(split).toEqual(full);
    });
});
describe('facility transport migration',()=>{
    it('versions the new facility observation action without downgrading later purchases, land or refreshes',async()=>{
        const old=await prepareFacilityMigration(await legacy());
        let next=commandLife(old,{type:'observe',itemId:'facility'},'facility-observation',old.now);
        expect(next.version).toBe(12);expect(next.actions.slice(0,-1)).toEqual(old.actions);
        expect(()=>replayLife({...next,version:11})).toThrow();
        expect(commandLife(next,{type:'observe',itemId:'facility'},'facility-observation',old.now+1)).toBe(next);
        next=commandLife(next,{type:'expand',side:'east'},'new-land',next.now);
        next=commandLife(next,{type:'buy',kind:'flower',cell:{x:6,z:0}},'new-flower',next.now);
        expect(next.version).toBe(12);expect(await prepareFacilityMigration(next)).toBe(next);
        const db=new IslandLifeDatabase(`observation-version-${crypto.randomUUID()}`);
        try{await db.worlds.put(next);const refreshed=await updateLife('trip',[],undefined,100,db);expect(refreshed.version).toBe(17);expect(refreshed.actions).toEqual(next.actions);}finally{await db.delete();}
    });
    it('uses a free resident for a bounded observation trip without cancelling a busy resident or awarding use credit',()=>{
        const s=fixture('library');s.target=undefined;
        expect(observationVisit(s,'facility').kind).toBe('ready');
        applyCommand(s,{id:'observe-trip',at:0,command:{type:'observe',itemId:'facility'}});
        const r=s.residents[0],end=r.facilityTrip!.end;
        expect(r.visit?.observationTest).toBe(true);
        expect(observationVisit(s,'facility').kind).toBe('existing');
        advanceLifeState(s,8000);expect(r.facilityTrip?.phase).toBe('carry');expect(r.visit?.observationTest).toBe(true);
        advanceLifeState(s,end);expect(r.enjoyed).toBe(0);expect(s.light).toBe(0);
    });
    it('keeps all old actions and ongoing visits, orders later same-time edits after cutover, and preserves version through purchases/land',async()=>{
        const old=await legacy(),next=await prepareFacilityMigration(old),{facilityTripVersion,...after}=replayLife(next);
        expect(facilityTripVersion).toBe(1);expect(after).toEqual(replayLife(old));expect(next.actions).toEqual(old.actions);
        expect(replayLife(next,99)).toEqual(replayLife(old,99));expect(next.economyCheckpoint).toEqual(old.economyCheckpoint);
        expect(await prepareFacilityMigration(next)).toBe(next);await verifyFacilityCutover(next);
        let edited=commandLife(next,{type:'move',itemId:'target',cell:{x:3,z:2}},'after',100);
        edited=commandLife(edited,{type:'visit',itemId:'facility'},'call',100);
        expect(replayLife(edited).facilityTripVersion).toBe(1);
        expect(edited.facilityCutover!.priorActions).toEqual(old.actions);
        edited=commandLife(edited,{type:'expand',side:'east'},'land',100);
        edited=commandLife(edited,{type:'buy',kind:'flower',cell:{x:6,z:0}},'flower',100);
        expect(edited.version).toBe(11);expect(()=>replayLife(edited)).not.toThrow();
    });
    it('rejects missing, altered, foreign and backdated cutovers',async()=>{
        const next=await prepareFacilityMigration(await legacy());
        expect(()=>replayLife({...next,facilityCutover:undefined})).toThrow();expect(()=>replayLife({...next,version:10})).toThrow();
        const changed=structuredClone(next);changed.actions[1].at=99;expect(()=>replayLife(changed)).toThrow();
        const hash=structuredClone(next);hash.facilityCutover!.validationHash='wrong';await expect(verifyFacilityCutover(hash)).rejects.toThrow();
        const foreign=structuredClone(next);foreign.facilityCutover!.profileId='other';await expect(verifyFacilityCutover(foreign)).rejects.toThrow();
        expect(()=>commandLife(next,{type:'store',itemId:'target'},'past',99)).toThrow();
    });
    it('atomically rolls back and retries without changing old history or double revision increments',async()=>{
        const db=new IslandLifeDatabase(`facility-trip-${crypto.randomUUID()}`);
        try{
            const old=await legacy();await db.worlds.put(old);const fail=()=>{throw new Error('disk failure');};db.worlds.hook('updating',fail);
            await expect(updateLife('trip',[],undefined,100,db)).rejects.toThrow('disk failure');expect(await db.worlds.get('trip')).toEqual(old);
            db.worlds.hook('updating').unsubscribe(fail);const first=await updateLife('trip',[],undefined,100,db);
            expect(first.version).toBe(17);expect(first.revision).toBe(old.revision+1);
            const intent={id:'store',revision:first.revision,command:{type:'store' as const,itemId:'target'}};
            const stored=await updateLife('trip',[],intent,200,db);expect(await updateLife('trip',[],intent,300,db)).toEqual(stored);
            expect(stored.facilityCutover).toEqual(first.facilityCutover);
        }finally{await db.delete();}
    });
});
