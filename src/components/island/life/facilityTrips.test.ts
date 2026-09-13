import { describe, expect, it } from 'vitest';
import { newLife, type ResidentId } from '../../../domain/islandLife/model';
import { advanceLifeState, replayLife } from '../../../domain/islandLife/simulation';
import { buildLifeScene } from './scene';
function fixture(kind:'library'|'garden-hut',who:ResidentId) {
    const s=replayLife(newLife('carry-scene',0));s.facilityTripVersion=1;s.tourVersion=1;s.landscapeVersion='groves-water-v1';
    s.items=[{id:'building',kind,cell:{x:0,z:0},growth:0,style:'original'},
        {id:'target',kind:kind==='library'?'bench':'flower',cell:{x:3,z:2},growth:0,style:'original',access:'front'}];
    s.residents.forEach(r=>{r.visit={itemId:'building',from:{x:0,z:2},path:[{x:0,z:2}],start:0,end:r.id===who?2000:1e9};r.cell={x:0,z:2};});
    const r=s.residents.find(r=>r.id===who)!;
    r.facilityTrip={facilityId:'building',targetId:'target',kind,phase:'collect',end:1e6,path:[{x:0,z:2},{x:0,z:3},{x:1,z:3},{x:2,z:3},{x:3,z:3}]};
    return s;
}
describe('continuous held work and captured transport',()=>{
    it.each(['pokomoko','rabbit','otter'] as const)('keeps %s and its prop through collection, real walking and use without changing the feet',who=>{
        for(const kind of ['library','garden-hut'] as const){
            const s=fixture(kind,who),scene=buildLifeScene(s);
            try{
                scene.animate(1500,false);expect(scene.audit().find(p=>p.id===who)?.facilityUse?.kind).toBe(kind);
                scene.animate(3500,false);const walking=scene.audit().find(p=>p.id===who)!;
                expect(walking.facilityUse).toEqual({kind,action:'carrying'});expect(walking.headPitch).toBe(0);expect(walking.relation).toBeUndefined();
                const captured={...scene.snapshot(),scenePose:'captured-v1' as const},replay=buildLifeScene(captured);
                try{replay.animate(90000,true);expect(replay.audit()).toEqual(scene.audit());}finally{replay.dispose();}
                const ordinary=structuredClone(captured);delete ordinary.residents.find(r=>r.id===who)!.facilityTrip;
                const without=buildLifeScene(ordinary);
                try{without.animate(90000,true);expect(without.audit().find(p=>p.id===who)?.position).toEqual(walking.position);}finally{without.dispose();}
                scene.animate(8000,false);const using=scene.audit().find(p=>p.id===who)!;
                expect(using.itemId).toBe('target');expect(using.facilityUse).toEqual({kind,action:kind==='library'?'reading':'tool-care'});
                if(kind==='library')expect(using.seatGap).toBeLessThan(1e-8);
                const projected=scene.snapshot();advanceLifeState(projected,9000);expect(projected.residents.find(r=>r.id===who)?.facilityTrip?.kind).toBe(kind);
            }finally{scene.dispose();}
        }
    });
});
