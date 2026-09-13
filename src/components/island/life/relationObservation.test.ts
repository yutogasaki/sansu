import { describe, expect, it } from 'vitest';
import { HOUR, newLife, type LifeState } from '../../../domain/islandLife/model';
import { replayLife } from '../../../domain/islandLife/simulation';
import { applyRelationObservation } from '../../../domain/islandLife/relationObservation';
import { visitRelation } from '../../../domain/islandLife/discovery';
import { createDiscoveryScene, replayDiscoveryScene } from '../../../domain/islandLife/discoveryJournal';
import { buildLifeScene } from './scene';
function state(): LifeState {
    const s = replayLife(newLife('scene-trial', 0)); Object.assign(s, { now: 10000, facilityTripVersion: 1, relationSelectionVersion: 1 });
    s.items = [{ id: 'bench', kind: 'bench', cell: { x: 3, z: 2 }, access: 'front', style: 'original', growth: 0 },
        { id: 'flower', kind: 'flower', cell: { x: 5, z: 2 }, style: 'original', growth: 0 },
        { id: 'swing', kind: 'swing', cell: { x: 0, z: 3 }, access: 'front', style: 'original', growth: 0 }];
    s.residents = [
        { id: 'pokomoko', cell: { x: 3, z: 3 }, enjoyed: 0, enjoyedBy: {}, visit: { itemId: 'bench', from: { x: 3, z: 3 }, path: [{ x: 3, z: 3 }], start: 0, end: HOUR, relationSelectionVersion: 1 } },
        { id: 'rabbit', cell: { x: 0, z: 4 }, enjoyed: 0, enjoyedBy: {}, visit: { itemId: 'swing', from: { x: 0, z: 4 }, path: [{ x: 0, z: 4 }], start: 0, end: HOUR, relationSelectionVersion: 1 } },
        { id: 'otter', cell: { x: 5, z: 4 }, enjoyed: 0, enjoyedBy: {} },
    ]; return s;
}
function poses(s: LifeState) {
    const scene = buildLifeScene(s);
    try { scene.animate(s.now, true); return scene.audit(); } finally { scene.dispose(); }
}
describe('rendered explicit resident selection', () => {
    it('looks at the actual swing user without changing either resident or the bench seat', async () => {
        const s = state(), before = poses(s);
        applyRelationObservation(s, 'bench', 'pokomoko', 'swing');
        const after = poses(s), hero = after.find(p => p.id === 'pokomoko')!;
        expect(hero.relation).toMatchObject({ ruleId: 'R3', targetId: 'swing', targetResidentId: 'rabbit', ready: true });
        expect(hero.position).toEqual(before.find(p => p.id === 'pokomoko')!.position); expect(hero.seatGap).toBeLessThan(1e-8);
        expect(after.find(p => p.id === 'rabbit')).toEqual(before.find(p => p.id === 'rabbit'));
        const event = await createDiscoveryScene('scene-trial', s, visitRelation(s, 'scene-trial', s.residents[0].visit!)!, 'current-context-test', 'trial', 10000, ['pokomoko', 'rabbit']);
        applyRelationObservation(s, 'bench', 'pokomoko', 'flower');
        const frozen = { ...event.snapshot.scene, drops: 0, light: 0, styles: [], days: {} };
        expect(poses(frozen).find(p => p.id === 'pokomoko')?.relation).toMatchObject({ ruleId: 'R3', targetId: 'swing' });
        expect(event.snapshot.scene.residents[0].visit?.relationTargetId).toBe('swing');
    });
    it('selects another mature tree for one table user while the partner retains their original tree', async () => {
        const s = state(); s.items = [
            { id: 'table', kind: 'picnic-table', cell: { x: 3, z: 2 }, style: 'original', growth: 0 },
            { id: 'a-tree', kind: 'sapling', cell: { x: 5, z: 2 }, style: 'original', growth: 18 },
            { id: 'z-tree', kind: 'sapling', cell: { x: 0, z: 3 }, style: 'original', growth: 18 },
        ];
        s.residents[0].visit!.itemId = 'table';
        s.residents[1].cell = { x: 3, z: 1 }; s.residents[1].visit = { itemId: 'table', from: { x: 3, z: 1 }, path: [{ x: 3, z: 1 }], start: 0, end: HOUR, relationSelectionVersion: 1 };
        const before = poses(s); expect(before.find(p => p.id === 'rabbit')?.relation?.targetId).toBe('a-tree');
        applyRelationObservation(s, 'table', 'pokomoko', 'z-tree'); const after = poses(s);
        expect(after.find(p => p.id === 'pokomoko')?.relation?.targetId).toBe('z-tree');
        expect(after.find(p => p.id === 'rabbit')).toEqual(before.find(p => p.id === 'rabbit'));
        applyRelationObservation(s, 'table', 'rabbit', 'z-tree');
        const event = await createDiscoveryScene('scene-trial', s, visitRelation(s, 'scene-trial', s.residents[1].visit!)!, 'current-context-test', 'table-trial', 10000, ['rabbit', 'pokomoko']);
        expect(event.focalResidentIds).toEqual(['pokomoko', 'rabbit']);
        expect(event.snapshot.scene.observationResidentId).toBe('rabbit');
        expect(replayDiscoveryScene(event, 'replay-table', 11000).snapshot).toEqual(event.snapshot);
    });
});
