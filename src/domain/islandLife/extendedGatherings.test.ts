import { describe, expect, it } from 'vitest';
import { newLife, type LifeItem, type LifeState } from './model';
import { advanceLifeState, replayLife } from './simulation';
import { evaluateDiscovery } from './discovery';
import { createDiscoveryScene, sceneDigest } from './discoveryJournal';
import { displayedGatherings } from '../../components/island/life/gatheringVisibility';
function world(kind: 'sapling' | 'water-bowl', cells = [{ x: 0, z: 2 }, { x: 1, z: 2 }, { x: 2, z: 2 }]): LifeState {
    return { ...replayLife(newLife('groves', 0)), landscapeVersion: 'groves-water-v1',
        items: cells.map((cell, index): LifeItem => ({ id: `item-${index}`, kind, cell, growth: kind === 'sapling' ? 18 : 0, style: 'original' })) };
}
describe('grove and water presentation without new progression gates', () => {
    it('keeps old presentation and snapshots unchanged until the explicit version is present', async () => {
        const state = world('sapling'), old = { ...state, landscapeVersion: undefined };
        expect(evaluateDiscovery(old, 'groves').some(r => r.ruleId === 'GT3')).toBe(false);
        const rule = evaluateDiscovery(old, 'groves').find(r => r.ruleId === 'G0')!;
        const event = await createDiscoveryScene('groves', old, rule, 'live', 'old', 0), before = JSON.stringify(event);
        expect(Object.prototype.hasOwnProperty.call(event.snapshot.scene, 'landscapeVersion')).toBe(false);
        const now = evaluateDiscovery(state, 'groves').find(r => r.ruleId === 'GT3')!;
        const current = await createDiscoveryScene('groves', state, now, 'live', 'new', 0);
        expect(current.snapshot.scene.landscapeVersion).toBe('groves-water-v1');
        expect(await sceneDigest(event.snapshot.scene)).toBe(event.snapshot.immutableHash); expect(JSON.stringify(event)).toBe(before);
        expect(evaluateDiscovery({ ...old, ...event.snapshot.scene }, 'groves').some(r => r.ruleId === 'GT3')).toBe(false);
    });
    it('requires mature trees, rejects a six-tree line for GT6, and presents only the upper ground', () => {
        const state = world('sapling');
        expect(displayedGatherings(state, 'groves').map(r => r.ruleId)).toEqual(['GT3']);
        state.items[0].growth = 6; expect(displayedGatherings(state, 'groves').map(r => r.ruleId)).toEqual(['G0']);
        const line = world('sapling', Array.from({ length: 6 }, (_, x) => ({ x, z: 2 })));
        expect(evaluateDiscovery(line, 'groves').some(r => r.ruleId === 'GT6')).toBe(false);
        const block = world('sapling', [0, 1].flatMap(z => [0, 1, 2].map(x => ({ x, z: z + 2 }))));
        expect(evaluateDiscovery(block, 'groves').filter(r => r.ruleId.startsWith('G')).map(r => r.ruleId)).toEqual(['G0', 'GT3', 'GT6']);
        expect(displayedGatherings(block, 'groves').map(r => r.ruleId)).toEqual(['GT6']);
        block.items[1].cell = undefined;
        expect(evaluateDiscovery(block, 'groves').some(r => r.ruleId === 'GT6')).toBe(false);
    });
    it('joins only placed cardinal water neighbors and never supplies a water-square rule', () => {
        const water = world('water-bowl', [{ x: 0, z: 2 }, { x: 1, z: 3 }]);
        expect(evaluateDiscovery(water, 'groves')).toEqual([]);
        water.items[1].cell = { x: 1, z: 2 };
        expect(evaluateDiscovery(water, 'groves').map(r => r.ruleId)).toEqual(['GW2']);
        water.items[1].cell = undefined; expect(evaluateDiscovery(water, 'groves')).toEqual([]);
    });
    it('does not change visit selection, growth or resources when the visual version is added', () => {
        const modern = world('sapling'), old = structuredClone(modern); delete old.landscapeVersion;
        advanceLifeState(old, 10000); advanceLifeState(modern, 10000);
        const { landscapeVersion: ignored, ...rest } = modern; void ignored;
        expect(rest).toEqual(old);
    });
});
