import { describe, it, expect } from 'vitest';
import { Box3, Mesh, Vector3 } from 'three';
import { newLife } from '../../../domain/islandLife/model';
import { replayLife } from '../../../domain/islandLife/simulation';
import { buildLifeScene } from './scene';
function fixture() {
    const state = replayLife(newLife('wind-scene', 0));
    state.items = [{ id: 'arch', kind: 'flower-arch', cell: { x: 2, z: 2 }, growth: 0, style: 'original' }, { id: 'wind', kind: 'pinwheel', cell: { x: 4, z: 3 }, growth: 0, style: 'original' }];
    state.residents.forEach(r => { r.visit = undefined; });
    return state;
}
describe('wind and arch rendered geometry', () => {
    it('rotates only in normal motion and freezes the recorded mode', () => {
        const state = fixture(), scene = buildLifeScene(state);
        try {
            const rotor = scene.root.getObjectByName('life-pinwheel-rotor')!;
            scene.animate(1000, false); const first = rotor.rotation.z; scene.animate(2000, false); expect(rotor.rotation.z).not.toBe(first);
            scene.animate(1000, true); const reduced = rotor.rotation.z; scene.animate(2000, true); expect(rotor.rotation.z).toBe(reduced);
            const replay = buildLifeScene({ ...state, now: 1000, scenePose: 'captured-v1', poseReducedMotion: false });
            try { replay.animate(8000, true); expect(replay.root.getObjectByName('life-pinwheel-rotor')!.rotation.z).toBe(first); } finally { replay.dispose(); }
        } finally { scene.dispose(); }
    });
    it('lets all existing residents pass along four cardinal lines without touching any arch triangle bounds', () => {
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const state = fixture();
            state.residents.forEach(r => { r.visit = { itemId: 'arch', from: { x: 2 - dx, z: 2 - dz }, path: [{ x: 2 - dx, z: 2 - dz }, { x: 2, z: 2 }, { x: 2 + dx, z: 2 + dz }], start: 0, end: 2800 }; });
            const scene = buildLifeScene(state);
            try {
                scene.root.updateMatrixWorld(true); const arch = scene.root.getObjectByName('life-item-arch')!, bounds = new Box3().setFromObject(arch);
                expect(bounds.max.x - bounds.min.x).toBeLessThan(1); expect(bounds.max.z - bounds.min.z).toBeLessThan(1);
                const triangles: Box3[] = [];
                arch.traverse(object => {
                    if (!(object instanceof Mesh)) return;
                    const positions = object.geometry.attributes.position, index = object.geometry.index;
                    for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
                        triangles.push(new Box3().setFromPoints([0, 1, 2].map(j => new Vector3().fromBufferAttribute(positions, index ? index.getX(i + j) : i + j).applyMatrix4(object.matrixWorld))));
                    }
                });
                for (let time = 0; time <= 2400; time += 60) {
                    scene.animate(time, false); scene.root.updateMatrixWorld(true);
                    for (const resident of state.residents) {
                        const actor = new Box3().setFromObject(scene.root.getObjectByName(`life-resident-${resident.id}`)!);
                        expect(triangles.some(triangle => triangle.intersectsBox(actor)), `${resident.id} ${dx},${dz} at ${time}`).toBe(false);
                    }
                }
            } finally { scene.dispose(); }
        }
    });
    it('adds only a head glance for a nearby forward pinwheel', () => {
        const state = fixture(); state.residents[0].cell = { x: 4, z: 2 };
        const before = structuredClone(state), scene = buildLifeScene(state);
        try {
            scene.animate(1000, true); const pose = scene.audit()[0];
            expect(pose.windLook).toMatchObject({ itemId: 'wind', ready: true }); expect(pose.headPitch).toBeLessThan(0);
            expect(pose.position).toEqual(scene.point(state.residents[0].cell).toArray()); expect(state).toEqual(before);
        } finally { scene.dispose(); }
    });
});
