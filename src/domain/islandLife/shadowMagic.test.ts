import { expect, it } from 'vitest';
import { shadowResident } from './shadowMagic';
import { evaluateDiscovery } from './discovery';
import { createDiscoveryScene, replayDiscoveryScene, sceneDigest } from './discoveryJournal';
import { newLife } from './model';
import { replayLife } from './simulation';
function fixture() {
    const s=replayLife(newLife('shadow',0));s.now=5000;s.shadowMagicVersion=1;
    s.items=[{id:'bench',kind:'bench',cell:{x:3,z:2},access:'front',growth:0,style:'original'}];
    s.residents[0].visit={itemId:'bench',from:{x:3,z:3},path:[{x:3,z:3}],start:0,end:10000};return s;
}
it('requires the actual settled named bench user and ends eligibility on leaving or storage',()=>{
    const s=fixture();expect(shadowResident(s,'bench','pokomoko')?.id).toBe('pokomoko');expect(shadowResident(s,'bench','rabbit')).toBeUndefined();
    for(const time of [0,899,10000]){s.now=time;expect(shadowResident(s,'bench')).toBeUndefined();}
    s.now=5000;s.items[0].cell=undefined;expect(shadowResident(s,'bench')).toBeUndefined();s.items[0].cell={x:3,z:2};s.shadowMagicVersion=undefined;expect(shadowResident(s,'bench')).toBeUndefined();
});
it('stores the original resident and shadow input without moving the body or charging a reward',async()=>{
    const s=fixture(),before=structuredClone(s);s.shadowTouch={itemId:'bench',residentId:'pokomoko'};
    const rule=evaluateDiscovery(s,'shadow').find(r=>r.ruleId==='M3')!;
    const event=await createDiscoveryScene('shadow',s,rule,'current-context-test','shadow-touch',0,['pokomoko']);
    expect(s.residents).toEqual(before.residents);expect(s.drops).toBe(before.drops);expect(s.light).toBe(before.light);
    s.residents[0].visit=undefined;s.items[0].cell=undefined;
    const replay=replayDiscoveryScene(event,'again',1);expect(replay.snapshot.scene.shadowTouch).toEqual({itemId:'bench',residentId:'pokomoko'});
    expect(await sceneDigest(replay.snapshot.scene)).toBe(event.snapshot.immutableHash);
    expect(shadowResident({...before,...replay.snapshot.scene},'bench')?.id).toBe('pokomoko');
});
it('does not turn mere eligibility or another resident input into a shadow discovery',async()=>{
    const s=fixture(),rule=evaluateDiscovery(s,'shadow').find(r=>r.ruleId==='M3')!;
    await expect(createDiscoveryScene('shadow',s,rule,'current-context-test','none',0,['pokomoko'])).rejects.toThrow();
    s.shadowTouch={itemId:'bench',residentId:'rabbit'};
    await expect(createDiscoveryScene('shadow',s,rule,'current-context-test','other',0,['rabbit'])).rejects.toThrow();
});
