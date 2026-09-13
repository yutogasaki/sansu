import { visibleRelationObject } from './relationVisibility';
import { Vector3, OrthographicCamera } from 'three';
import { describe, expect, it } from 'vitest';
import { newLife } from '../../../domain/islandLife/model';
import { replayLife } from '../../../domain/islandLife/simulation';
import { evaluateDiscovery } from '../../../domain/islandLife/discovery';
import { createDiscoveryScene, sceneDigest } from '../../../domain/islandLife/discoveryJournal';
import { discoveryParticipants, discoveryTitle } from '../../../domain/islandLife/discoveryRecall';
import { buildLifeScene } from './scene';
import { facilityRelations } from './facilityRelations';
function fixture(kind:'library'|'garden-hut') {
    const state=replayLife(newLife('transport',0));state.now=10000;state.facilityTripVersion=1;
    state.items=[{id:'origin',kind,cell:{x:0,z:0},style:'original',growth:0},{id:'target',kind:kind==='library'?'bench':'flower',cell:{x:3,z:2},style:'original',growth:0,access:'front'}];
    state.residents.forEach(r=>{r.visit=undefined;r.cell={x:5,z:4};});
    const r=state.residents[0],path=[{x:0,z:2},{x:0,z:3},{x:1,z:3},{x:2,z:3},{x:3,z:3}];
    r.visit={itemId:'target',from:path[0],path,start:2000,end:1e6};r.facilityTrip={facilityId:'origin',targetId:'target',kind,phase:'carry',path,end:1e6};
    return state;
}
function camera() {const c=new OrthographicCamera(-4,4,4,-4,.1,100);c.position.set(3,8,11);c.lookAt(-1,.1,0);c.updateMatrixWorld(true);return c;}
describe('presented facility relations',()=>{
    it('stands back for care beside an ordinary flower visitor while old snapshots retain the sniff distance',()=>{
        const old=fixture('garden-hut');delete old.items[1].access;
        const path=[{x:0,z:2},{x:1,z:2},{x:2,z:2}];
        old.residents[0].visit!.path=path;old.residents[0].facilityTrip!.path=path;
        old.residents[1].visit={itemId:'target',from:{x:3,z:3},path:[{x:3,z:3}],start:0,end:1e6};
        const current={...structuredClone(old),facilityPresentation:'carry-care-v1' as const};
        const before=buildLifeScene(old),after=buildLifeScene(current),view=camera();
        try{
            before.animate(old.now,true);after.animate(current.now,true);before.root.updateMatrixWorld(true);after.root.updateMatrixWorld(true);
            const prior=before.audit()[0],now=after.audit()[0];
            expect(now.position[0]).toBeCloseTo(prior.position[0]-.33);expect(after.audit()[1].position).toEqual(before.audit()[1].position);
            expect(facilityRelations(old,'transport',before,view,()=>true)[0].core).toBe(false);
            expect(facilityRelations(current,'transport',after,view,()=>true)[0].core).toBe(true);
            const frozen=buildLifeScene({...current,scenePose:'captured-v1'});
            try{frozen.animate(90000,false);expect(frozen.audit()[0].position).toEqual(now.position);}finally{frozen.dispose();}
        }finally{before.dispose();after.dispose();}
    });
    it.each(['library','garden-hut'] as const)('%s needs the real carrier and visible prop, source, destination and face',kind=>{
        const state=fixture(kind),scene=buildLifeScene(state),view=camera();
        try{
            scene.animate(state.now,true);scene.root.updateMatrixWorld(true);
            if(kind==='garden-hut'){view.position.set(-8,10,1);view.lookAt(-1,.1,0);view.updateMatrixWorld(true);}
            const sample=(shown=true)=>facilityRelations(state,'transport',scene,view,()=>shown);
            const names=['life-item-origin','life-item-target',kind==='library'?'life-held-book':'life-held-tools'];
            const shown=names.map(name=>[name,visibleRelationObject(scene.root.getObjectByName(name)!,scene.root,view,()=>true)]);
            const actor=scene.root.getObjectByName('life-resident-pokomoko')!,head=actor.getObjectByName('life-hero-head')!;shown.push(['face',visibleRelationObject(actor,scene.root,view,()=>true,head.getWorldPosition(new Vector3()))]);
            expect(sample(),JSON.stringify(shown)).toMatchObject([{core:true,rule:{ruleId:kind==='library'?'R5':'R6'},focalResidentIds:['pokomoko']}]);
            expect(sample(false)[0].core).toBe(false);
            for(const name of ['life-item-origin','life-item-target',kind==='library'?'life-held-book':'life-held-tools']){
                const o=scene.root.getObjectByName(name)!;o.visible=false;expect(sample()[0].core).toBe(false);o.visible=true;
            }
            state.residents[0].visit!.observationTest=true;expect(sample()).toEqual([]);expect(facilityRelations(state,'transport',scene,view,()=>true,true)).toHaveLength(1);
            delete state.residents[0].visit!.observationTest;state.residents[0].visit!.from={x:4,z:4};expect(sample()).toEqual([]);
        }finally{scene.dispose();}
    });
    it('never promotes mere eligibility, a walk, or an old scene to a presented transport',()=>{
        const state=fixture('library'),scene=buildLifeScene(state),view=camera();
        try{
            scene.animate(3000,true);expect(facilityRelations(state,'transport',scene,view,()=>true)).toEqual([]);
            scene.animate(state.now,true);delete state.residents[0].facilityTrip;expect(facilityRelations(state,'transport',scene,view,()=>true)).toEqual([]);
            delete state.facilityTripVersion;expect(evaluateDiscovery(state,'transport').some(r=>r.ruleId==='R5')).toBe(false);
        }finally{scene.dispose();}
    });
    it.each(['library','garden-hut'] as const)('keeps %s participants and transport version in immutable snapshots',async kind=>{
        const state=fixture(kind),rule=evaluateDiscovery(state,'transport').find(r=>r.ruleId===(kind==='library'?'R5':'R6'))!;
        state.facilityPresentation='carry-care-v1';
        const event=await createDiscoveryScene('transport',state,rule,'live','event',20000,['pokomoko']);
        expect(event.snapshot.scene.facilityPresentation).toBe('carry-care-v1');
        const changed=structuredClone(state);delete changed.items[1].access;expect(evaluateDiscovery(changed,'transport').find(r=>r.ruleId===rule.ruleId)?.semanticSignature).not.toBe(rule.semanticSignature);
        expect(event.snapshot.scene.facilityTripVersion).toBe(1);expect(discoveryParticipants(event).map(i=>i.id)).toEqual(['origin','target']);expect(discoveryTitle(event)).toBeTruthy();
        state.items[0].cell=undefined;state.residents[0].facilityTrip=undefined;
        expect(await sceneDigest(event.snapshot.scene)).toBe(event.snapshot.immutableHash);expect(discoveryParticipants(event)).toHaveLength(2);
    });
});
