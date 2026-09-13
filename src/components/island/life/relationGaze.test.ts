import { Vector3 } from 'three';
import { describe, it, expect } from 'vitest';
import { newLife, type LifeState, type ResidentId } from '../../../domain/islandLife/model';
import { replayLife } from '../../../domain/islandLife/simulation';
import { buildLifeScene } from './scene';

function fixture(who: ResidentId, swing = false): LifeState {
    const state = replayLife(newLife('gaze', 0)); state.now = 2000;
    state.items = [{ id: 'bench', kind: 'bench', cell: { x: 0, z: 2 }, growth: 0, style: 'original' },
        { id: 'target', kind: swing ? 'swing' : 'flower', cell: { x: 2, z: 2 }, growth: 0, style: 'original' }];
    state.residents.forEach(resident => { resident.visit = resident.id === who
        ? { itemId: 'bench', from: { x: 0, z: 3 }, path: [{ x: 0, z: 3 }], start: 0, end: 20000 } : undefined; });
    return state;
}
describe('same-seat R1/R3 gaze', () => {
    it.each<ResidentId>(['pokomoko', 'rabbit', 'otter'])('turns %s toward a young plant without moving its seat contact', who => {
        const state = fixture(who), before = structuredClone(state), scene = buildLifeScene(state);
        try {
            scene.animate(2000, false);
            const pose = scene.audit().find(pose => pose.id === who)!;
            expect(pose.relation).toMatchObject({ ruleId: 'R1', targetId: 'target', ready: true });
            expect(pose.headYaw).toBeGreaterThan(.5); expect(pose.seatGap).toBeLessThan(1e-8);
            scene.root.updateMatrixWorld(true);
            const actor = scene.root.getObjectByName(`life-resident-${who}`)!;
            const head = actor.getObjectByName(who === 'pokomoko' ? 'life-hero-head' : 'resident-head')!;
            const toward = new Vector3(...pose.relation!.focus).sub(head.getWorldPosition(new Vector3())).normalize();
            expect(head.getWorldDirection(new Vector3()).dot(toward)).toBeGreaterThan(.99);
            const position = pose.position;
            scene.animate(3000, true);
            expect(scene.audit().find(pose => pose.id === who)!.position).toEqual(position);
            expect(state).toEqual(before);
        } finally { scene.dispose(); }
        const far = structuredClone(state); far.items[1].cell = { x: 5, z: 4 };
        const normal = buildLifeScene(far);
        try {
            normal.animate(2000, false);
            const pose = normal.audit().find(pose => pose.id === who)!;
            expect(pose.relation).toBeUndefined(); expect(pose.headYaw).toBe(0);
            expect(pose.seatGap).toBeLessThan(1e-8);
        } finally { normal.dispose(); }
    });
    it('looks at the actual swing occupant after arrival and at the toy while it is empty', () => {
        const state = fixture('pokomoko', true);
        state.residents[1].visit = { itemId: 'target', from: { x: 2, z: 3 }, path: [{ x: 2, z: 3 }], start: 0, end: 20000 };
        const scene = buildLifeScene(state);
        try {
            scene.animate(2000, false);
            expect(scene.audit()[0].relation).toMatchObject({ ruleId: 'R3', targetResidentId: 'rabbit' });
            expect(scene.audit()[0].seatGap).toBeLessThan(1e-8);
        } finally { scene.dispose(); }
        state.residents[1].visit = undefined;
        const empty = buildLifeScene(state);
        try { empty.animate(2000, true); expect(empty.audit()[0].relation).toMatchObject({ ruleId: 'R3', targetResidentId: undefined }); }
        finally { empty.dispose(); }
    });
    it('replays a short swing motion without advancing the recorded visit clock', () => {
        const state = fixture('pokomoko', true);
        state.residents[1].visit = { itemId: 'target', from: { x: 2, z: 3 }, path: [{ x: 2, z: 3 }], start: 0, end: 2500 };
        const before = structuredClone(state), scene = buildLifeScene(state);
        try {
            scene.animate(2000, false, 2000); const first = scene.audit()[1].position;
            scene.animate(2000, false, 4000);
            expect(scene.audit()[1].position).not.toEqual(first);
            expect(scene.audit()[0].relation?.targetResidentId).toBe('rabbit');
            expect(scene.audit()[1].seatGap).toBeLessThan(1e-8);
            expect(state).toEqual(before);
        } finally { scene.dispose(); }
    });
    it('does not present a relation before sitting or after the visit expires', () => {
        const scene = buildLifeScene(fixture('pokomoko'));
        try {
            scene.animate(500, false); expect(scene.audit()[0].relation).toBeUndefined();
            scene.animate(20000, false); expect(scene.audit()[0].relation).toBeUndefined();
        } finally { scene.dispose(); }
    });
});
