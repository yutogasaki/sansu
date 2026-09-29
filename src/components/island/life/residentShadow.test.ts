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

it('reuses an unchanged silhouette without uploading vertices or recomputing bounds', () => {
    const actor = new T.Group(), material = new T.MeshBasicMaterial();
    const body = new T.Mesh(new T.BoxGeometry(), material); actor.add(body);
    const shadow = buildResidentShadow(actor);
    try {
        shadow.update();
        const output = shadow.root.children[0] as T.Mesh;
        const position = output.geometry.attributes.position as T.BufferAttribute;
        const version = position.version, box = output.geometry.boundingBox!.clone();
        for (let frame = 0; frame < 120; frame++) shadow.update();
        expect(position.version).toBe(version);
        expect(output.geometry.boundingBox).toEqual(box);
        body.visible = false; shadow.update(); expect(output.visible).toBe(false);
        body.visible = true; material.visible = false; shadow.update(); expect(output.visible).toBe(false);
        material.visible = true; shadow.update(); expect(output.visible).toBe(true);
        expect(position.version).toBe(version);
    } finally { shadow.dispose(); body.geometry.dispose(); material.dispose(); }
});

it('updates changed parents, individual instances and vertex buffers without stale bounds or hits', () => {
    const parent = new T.Group(), actor = new T.Group(); parent.add(actor);
    const geometry = new T.BoxGeometry(), material = new T.MeshBasicMaterial();
    const body = new T.InstancedMesh(geometry, material, 2); actor.add(body);
    body.setMatrixAt(0, new T.Matrix4().makeTranslation(-2, 1, 0));
    body.setMatrixAt(1, new T.Matrix4().makeTranslation(2, 1, 0));
    const shadow = buildResidentShadow(actor), outputs = shadow.root.children as T.Mesh[];
    const versions = () => outputs.map(o => (o.geometry.attributes.position as T.BufferAttribute).version);
    try {
        parent.updateMatrixWorld(true); shadow.update();
        const first = versions();
        body.setMatrixAt(1, new T.Matrix4().makeTranslation(3, 1, 0));
        shadow.update(); expect(versions()).toEqual([first[0], first[1] + 1]);
        parent.position.x = 4; parent.rotation.y = .2; parent.scale.set(1.2, .8, 1.1);
        parent.updateMatrixWorld(true); shadow.update();
        expect(versions()).toEqual([first[0] + 1, first[1] + 2]);
        const beforeEdit = vertices(shadow.root);
        geometry.attributes.position.setX(0, 2); geometry.attributes.position.needsUpdate = true;
        shadow.update(); expect(vertices(shadow.root)).not.toEqual(beforeEdit);
        for (const output of outputs) {
            const box = output.geometry.boundingBox!;
            expect(box.min.y).toBeCloseTo(.09); expect(box.max.y).toBeCloseTo(.09);
            const center = box.getCenter(new T.Vector3());
            const hits = new T.Raycaster(center.clone().add(new T.Vector3(0, 3, 0)), new T.Vector3(0, -1, 0)).intersectObject(output);
            expect(hits.length).toBeGreaterThan(0);
            expect(hits[0].point.y).toBeCloseTo(.09);
        }
    } finally { shadow.dispose(); geometry.dispose(); material.dispose(); }
});

it('invalidates reused projections for interleaved edits and replacement position attributes', () => {
    const data = new T.InterleavedBuffer(new Float32Array([0, 1, 0, 9, 1, 1, 0, 9, 0, 1, 1, 9]), 4);
    const geometry = new T.BufferGeometry().setAttribute('position', new T.InterleavedBufferAttribute(data, 3, 0));
    const material = new T.MeshBasicMaterial(), actor = new T.Mesh(geometry, material);
    const shadow = buildResidentShadow(actor);
    try {
        shadow.update(); const initial = vertices(shadow.root);
        data.array[0] = 2; data.needsUpdate = true;
        shadow.update(); expect(vertices(shadow.root)).not.toEqual(initial);
        const edited = vertices(shadow.root);
        geometry.setAttribute('position', new T.Float32BufferAttribute([3, 1, 0, 1, 1, 0, 0, 1, 1], 3));
        shadow.update(); expect(vertices(shadow.root)).not.toEqual(edited);
        const replaced = vertices(shadow.root);
        shadow.update(); expect(vertices(shadow.root)).toEqual(replaced);
    } finally { shadow.dispose(); geometry.dispose(); material.dispose(); }
});
