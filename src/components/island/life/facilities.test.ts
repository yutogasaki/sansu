import { visibleRelationObject } from './relationVisibility';
import { describe, expect, it } from 'vitest';
import { Box3, Mesh, MeshBasicMaterial, OrthographicCamera } from 'three';
import { newLife, type ResidentId } from '../../../domain/islandLife/model';
import { replayLife } from '../../../domain/islandLife/simulation';
import { buildLifeScene } from './scene';
import { previewPlacement } from './placement';
function fixture(kind:'library'|'garden-hut',who:ResidentId) {
    const state=replayLife(newLife('facility-scene',0));
    state.items=[{id:'building',kind,cell:{x:0,z:0},growth:0,style:'original'}];
    state.residents.forEach(r=>{r.visit=r.id===who?{itemId:'building',from:{x:0,z:2},path:[{x:0,z:2}],start:0,end:20000}:undefined;});return state;
}
describe('facility entrance uses',()=>{
    it.each(['pokomoko','rabbit','otter'] as const)('shows one held book or tools at the entrance for %s',who=>{
        for(const kind of ['library','garden-hut'] as const){
            const state=fixture(kind,who),before=structuredClone(state),scene=buildLifeScene(state);
            try{
                scene.animate(3000,true);scene.root.updateMatrixWorld(true);
                const pose=scene.audit().find(p=>p.id===who)!;expect(pose.facilityUse).toEqual({kind,action:kind==='library'?'reading':'tool-care'});
                expect(pose.position).toEqual(scene.point({x:0,z:2}).toArray());expect(pose.headPitch).toBeGreaterThan(0);
                const camera=new OrthographicCamera(-3,3,3,-3,.1,100);camera.position.set(1.5,6,11);camera.lookAt(-2.5,.3,0);camera.updateMatrixWorld(true);
                const actor=scene.root.getObjectByName(`life-resident-${who}`)!;
                const held=actor.getObjectByName(kind==='library'?'life-held-book':'life-held-tools')!;
                expect(visibleRelationObject(held,scene.root,camera,()=>true),`${who} ${kind} must be visible outside its body`).toBe(true);
                let visible=0;scene.root.traverse(o=>{if(o.name.startsWith('life-held-')&&o.visible)visible++;});expect(visible).toBe(1);
                const bounds=new Box3().setFromObject(scene.root.getObjectByName('life-item-building')!);expect(bounds.max.x-bounds.min.x).toBeLessThan(2);expect(bounds.max.z-bounds.min.z).toBeLessThan(2);
                scene.animate(20000,true);visible=0;scene.root.traverse(o=>{if(o.name.startsWith('life-held-')&&o.visible)visible++;});expect(visible).toBe(0);expect(state).toEqual(before);
            }finally{scene.dispose();}
        }
    });
    it('keeps the four-cell preview and only legal anchors while preserving old scenes without props',()=>{
        const state=replayLife(newLife('preview',0)),placement=previewPlacement(state,'library',{x:0,z:0});expect(placement.valid).toBe(true);expect(placement.allowed).not.toContain('5,0');
        const preview=buildLifeScene(state,undefined,{x:0,z:0},placement),old=buildLifeScene(state);
        try{
            const active=preview.clickables.filter(o=>{const c=o.userData.cell;return [0,1].includes(c.x)&&[0,1].includes(c.z);});expect(active).toHaveLength(4);expect(active.every(o=>((o as Mesh).material as MeshBasicMaterial).opacity===.55)).toBe(true);
            expect(old.root.getObjectByName('life-held-book')).toBeUndefined();expect(old.root.getObjectByName('life-held-tools')).toBeUndefined();
            expect(preview.root.getObjectByName('life-placement-ghost')).toBeDefined();
        }finally{preview.dispose();old.dispose();}
    });
});
