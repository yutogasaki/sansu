import { describe, expect, it } from 'vitest';
import { evaluateDiscovery } from './discovery';
import { createDiscoveryScene, replayDiscoveryScene } from './discoveryJournal';
import { discoveryParticipants, discoverySubject, discoveryTitle } from './discoveryRecall';
import type { LifeState } from './model';

describe('recall reads the recorded subject rather than the current world', () => {
    const world = (): LifeState => ({ now: 0, activityVersion: 2, drops: 99, light: 12, styles: ['original'], heroStyle: 'original', days: {}, residents: [], items: [
        { id: 'other', kind: 'flower', cell: { x: 0, z: 2 }, growth: 6, style: 'sunshine' },
        { id: 'subject', kind: 'flower', cell: { x: 1, z: 2 }, growth: 0, style: 'starlight' },
    ] });
    it('keeps the second plant at its original stage/style/position after growth and removal', async () => {
        const state = world();
        const rule = evaluateDiscovery(state, 'owner').find(rule => rule.ruleId === 'M2' && rule.participantIds.includes('subject'))!;
        const original = await createDiscoveryScene('owner', state, rule, 'current-context-test', 'original', 0);
        state.items[1].growth = 6; state.items[1].style = 'sunshine'; state.items[1].cell = undefined;
        const replay = replayDiscoveryScene(original, 'again', 5);
        expect(discoveryParticipants(replay)).toEqual([{ id: 'subject', kind: 'flower', cell: { x: 1, z: 2 }, growth: 0, style: 'starlight' }]);
        expect(discoveryTitle(replay)).toBe('はっぱが うえへ');
        expect(replay.source).toBe('replay'); expect(replay.originEventId).toBe('original');
        expect(state.items[1].cell).toBeUndefined(); expect(state.drops).toBe(99);
    });
    it('uses petals only for an actually blooming recorded subject', async () => {
        const state = world(), rule = evaluateDiscovery(state, 'owner').find(rule => rule.ruleId === 'M2' && rule.participantIds.includes('other'))!;
        const original = await createDiscoveryScene('owner', state, rule, 'live', 'bloom', 0);
        expect(discoveryTitle(original)).toBe('はなびらが うえへ');
    });
    it('does not guess an item when signature or rule version cannot be resolved', async () => {
        const state = world(), rule = evaluateDiscovery(state, 'owner')[0];
        const original = await createDiscoveryScene('owner', state, rule, 'live', 'bad', 0);
        expect(discoveryParticipants({ ...original, semanticSignature: 'not json' })).toEqual([]);
        expect(discoveryParticipants({ ...original, semanticSignature: JSON.stringify(['unknown', []]) })).toEqual([]);
    });
});

it('keeps the explicit library anchor when recalling the same bench relation', async () => {
    const state: LifeState = { now: 10000, activityVersion: 2, facilityTripVersion: 1, relationSelectionVersion: 1,
        drops: 0, light: 0, styles: [], heroStyle: 'original', days: {}, items: [
            { id: 'library', kind: 'library', cell: { x: 0, z: 0 }, growth: 0, style: 'original' },
            { id: 'bench', kind: 'bench', cell: { x: 3, z: 2 }, access: 'front', growth: 0, style: 'original' },
        ], residents: [{ id: 'rabbit', cell: { x: 3, z: 3 }, enjoyed: 0, enjoyedBy: {}, visit: {
            itemId: 'bench', path: [{ x: 3, z: 3 }], from: { x: 3, z: 3 }, start: 0, end: 30000,
            observationSubjectId: 'library', relationTargetId: 'bench', observationTest: true,
        } }] };
    const rule = evaluateDiscovery(state, 'owner').find(r => r.ruleId === 'R5')!;
    const event = await createDiscoveryScene('owner', state, rule, 'current-context-test', 'library-trial', 10000, ['rabbit']);
    expect(discoverySubject(event)?.id).toBe('library');
    expect(discoverySubject(replayDiscoveryScene(event, 'again', 11000))?.id).toBe('library');
    const legacy = await createDiscoveryScene('owner', state, rule, 'live', 'legacy', 10000, ['rabbit']);
    expect(discoverySubject(legacy)?.id).toBe('bench');
});
