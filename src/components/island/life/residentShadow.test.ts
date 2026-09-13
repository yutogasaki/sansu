import { expect, it } from 'vitest';
import * as T from 'three';
import { buildLifeScene } from './scene';
import { buildResidentShadow } from './residentShadow';
import { newLife, type ResidentId } from '../../../domain/islandLife/model';
import { replayLife } from '../../../domain/islandLife/simulation';
function identity(actor: T.Object3D) { const result: unknown[] = []; actor.traverse(o => result.push([o.position.toArray(),o.quaternion.toArray(),o.scale.toArray(),o instanceof T.Mesh ? o.geometry.uuid : null,o instanceof T.Mesh ? o.material : null])); return result; }
function vertices(root: T.Object3D) { const result: number[] = []; root.traverse(o => { if(o instanceof T.Mesh) result.push(...o.geometry.getAttribute('position').array); }); return result; }
for (const who of ['pokomoko','rabbit','otter'] as ResidentId[]) it(`${who}: only the copied shadow waves, and normal shape and cast flags return`, () => {
    const state = replayLife(newLife('shadow',0)); state.now=5000;
    state.items=[{id:'bench',kind:'bench',cell:{x:3,z:2},access:'front',growth:0,style:'original'}];
    const resident=state.residents.find(r=>r.id===who)!; resident.visit={itemId:'bench',from:{x:3,z:3},path:[{x:3,z:3}],start:0,end:30000};
    const scene=buildLifeScene(state);scene.animate(state.now,true);
    const actor=scene.root.getObjectByName(`life-resident-${who}`)!, before=identity(actor), beforePoses=scene.audit(), casts: boolean[]=[];
    actor.traverse(o=>{if(o instanceof T.Mesh)casts.push(o.castShadow);});
    const shadow=buildResidentShadow(actor);
    try {
        shadow.update();const normal=vertices(shadow.root);expect(normal.length).toBeGreaterThan(0);
        shadow.update(1200);expect(vertices(shadow.root)).not.toEqual(normal);expect(identity(actor)).toEqual(before);expect(scene.audit()).toEqual(beforePoses);
        shadow.update(1200,true);expect(vertices(shadow.root)).not.toEqual(normal);expect(identity(actor)).toEqual(before);
        const box=new T.Box3().setFromObject(shadow.root);expect(box.min.y).toBeCloseTo(.09);expect(box.max.y).toBeCloseTo(.09);
        shadow.update(4000);expect(vertices(shadow.root)).toEqual(normal);
    }finally{shadow.dispose();const after:boolean[]=[];actor.traverse(o=>{if(o instanceof T.Mesh)after.push(o.castShadow);});expect(after).toEqual(casts);scene.dispose();}
});
