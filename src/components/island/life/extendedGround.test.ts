import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { newLife, type LifeItem, type LifeState } from '../../../domain/islandLife/model';
import { replayLife } from '../../../domain/islandLife/simulation';
import { buildLifeScene } from './scene';
import { displayedGatherings, gatheringVisible } from './gatheringVisibility';
function state(kind: 'sapling' | 'water-bowl', count: number): LifeState {
    return { ...replayLife(newLife('shade', 0)), landscapeVersion: 'groves-water-v1', items: Array.from({ length: count }, (_, i): LifeItem => ({
        id: `i${i}`, kind, cell: { x: i % 3, z: 2 + Math.floor(i / 3) }, growth: kind === 'sapling' ? 18 : 0, style: 'original',
    })) };
}
describe('rendered groves and water retain exact cells and readable connections', () => {
    it.each([['sapling', 3, 'GT3'], ['sapling', 6, 'GT6'], ['water-bowl', 2, 'GW2']] as const)('can see %s x %i with its real connecting ground', (kind, count, ruleId) => {
        const world = state(kind, count);
        if (kind === 'water-bowl') world.residents[0].visit = { itemId: 'i0', from: { x: 0, z: 3 }, path: [{ x: 0, z: 3 }], start: 0, end: 30000 };
        const before = structuredClone(world), scene = buildLifeScene(world);
        const camera = new T.OrthographicCamera(-3, 3, 3, -3, .1, 100);
        camera.position.set(4, 7.9, 11.5); camera.lookAt(-1.5, .1, .5); camera.updateMatrixWorld(true);
        scene.animate(4800, true); scene.root.updateMatrixWorld(true);
        const rule = displayedGatherings(world, 'shade').find(r => r.ruleId === ruleId)!;
        try {
            const reasons: string[] = [];
            expect(gatheringVisible(world, rule, scene.root, camera, scene.point, () => true, r => reasons.push(r)), reasons.join(',')).toBe(true);
            scene.root.getObjectByName('life-extended-ground')!.visible = false;
            expect(gatheringVisible(world, rule, scene.root, camera, scene.point, () => true)).toBe(false);
            expect(world).toEqual(before);
        } finally { scene.dispose(); }
    });
    it('shows a five-tree grove while a resident rests under the front crown', () => {
        const world = state('sapling', 6); world.items.shift();
        world.residents[1].visit = { itemId: 'i5', from: { x: 2, z: 4 }, path: [{ x: 2, z: 4 }], start: 0, end: 30000 };
        const scene = buildLifeScene(world), camera = new T.OrthographicCamera(-5, 5, 6, -6, .1, 100);
        camera.position.set(4.5, 7.8, 11); camera.lookAt(0, .04, 0); camera.updateMatrixWorld(true);
        scene.animate(4800, true); scene.root.updateMatrixWorld(true);
        const rule = displayedGatherings(world, 'shade').find(r => r.ruleId === 'GT3')!, reasons: string[] = [];
        try { expect(gatheringVisible(world, rule, scene.root, camera, scene.point, () => true, r => reasons.push(r)), reasons.join(',')).toBe(true); }
        finally { scene.dispose(); }
    });
    it('keeps water comparison head focus when a reduced-motion memory is replayed with normal motion', () => {
        const world = state('water-bowl', 2);
        world.residents[0].visit = { itemId: 'i0', from: { x: 0, z: 3 }, path: [{ x: 0, z: 3 }], start: 0, end: 30000 };
        const original = buildLifeScene(world);
        try {
            original.animate(1200, true); const pose = original.audit()[0];
            expect(pose.waterLook?.ready).toBe(true);
            const captured = { ...original.snapshot(), scenePose: 'captured-v1' as const }, replay = buildLifeScene(captured);
            try {
                replay.animate(999999, false);
                expect(replay.audit()[0].waterLook).toEqual(pose.waterLook);
                expect(replay.audit()[0].headYaw).toBeCloseTo(pose.headYaw!, 8);
                expect(replay.audit()[0].headPitch).toBeCloseTo(pose.headPitch, 8);
            } finally { replay.dispose(); }
        } finally { original.dispose(); }
    });
    it('rests beside a mature tree inside its local shade while retaining the old unversioned pose', () => {
        const world = state('sapling', 1);
        world.residents[0].visit = { itemId: 'i0', from: { x: 0, z: 3 }, path: [{ x: 0, z: 3 }], start: 0, end: 30000 };
        const scene = buildLifeScene(world), old = buildLifeScene({ ...world, landscapeVersion: undefined });
        try {
            scene.animate(2000, true); old.animate(2000, true);
            const p = scene.point(world.items[0].cell!), at = new T.Vector3().fromArray(scene.audit()[0].position);
            expect(at.distanceTo(p)).toBeCloseTo(.56, 6);
            expect(new T.Vector3().fromArray(old.audit()[0].position).distanceTo(p)).toBeCloseTo(1, 6);
        } finally { scene.dispose(); old.dispose(); }
    });
    it('keeps an old mature G0 memory on its original soil without the newer shade or crowns', () => {
        const world = state('sapling', 6); delete world.landscapeVersion;
        const old = buildLifeScene(world);
        try {
            expect(old.root.getObjectByName('life-extended-ground')!.children).toHaveLength(0);
            expect(old.root.getObjectByName('life-grove-crowns')!.children).toHaveLength(0);
            expect(old.root.getObjectByName('life-young-plant-ground')!.children.length).toBeGreaterThan(0);
        } finally { old.dispose(); }
    });
});
