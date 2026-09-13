import { describe, expect, it } from 'vitest';
import { LIFE_STEP_MS, newLife } from './model';
import { replayLife } from './simulation';
import { readingOtter } from './readingEncounter';
import { evaluateDiscovery } from './discovery';
import { createDiscoveryScene, sceneDigest, replayDiscoveryScene } from './discoveryJournal';

// Explicit unit fixture, not evidence that a natural encounter occurred in the UI.
function fixture() {
    const state = replayLife(newLife('reading-test', 0));
    state.facilityTripVersion = 1; state.readingEncounterVersion = 1;
    state.items = [
        { id: 'library', kind: 'library', cell: { x: 0, z: 0 }, style: 'original', growth: 0 },
        { id: 'bench', kind: 'bench', cell: { x: 3, z: 2 }, style: 'original', growth: 0, access: 'front' },
    ];
    const path = [{ x: 0, z: 2 }, { x: 0, z: 3 }, { x: 1, z: 3 }, { x: 2, z: 3 }, { x: 3, z: 3 }];
    const otter = state.residents.find(r => r.id === 'otter')!;
    otter.visit = { itemId: 'bench', from: path[0], path, start: 2000, end: 100000 };
    otter.facilityTrip = { facilityId: 'library', targetId: 'bench', kind: 'library', phase: 'carry', path, end: 100000 };
    state.now = 2000 + 4 * LIFE_STEP_MS + 900;
    return state;
}

describe('X3 uses the existing naturally reading otter', () => {
    it('requires arrival and settling, and never extends the visit', () => {
        const state = fixture(), before = structuredClone(state);
        expect(readingOtter(state)?.resident.id).toBe('otter');
        expect(evaluateDiscovery(state, 'p').some(r => r.ruleId === 'X3')).toBe(true);
        expect(state).toEqual(before);
        state.now--;
        expect(readingOtter(state)).toBeUndefined();
        state.now = before.residents.find(r => r.id === 'otter')!.visit!.end;
        expect(readingOtter(state)).toBeUndefined();
    });
    it.each(['test', 'other-actor', 'collecting', 'missing-library', 'missing-bench', 'wrong-origin', 'different-route', 'old-display'])(
        'does not substitute a reader for %s', reason => {
            const state = fixture(), otter = state.residents.find(r => r.id === 'otter')!;
            if (reason === 'test') otter.visit!.observationTest = true;
            if (reason === 'other-actor') { state.residents.find(r => r.id === 'rabbit')!.visit = otter.visit; delete otter.visit; }
            if (reason === 'collecting') otter.facilityTrip!.phase = 'collect';
            if (reason === 'missing-library') state.items[0].cell = undefined;
            if (reason === 'missing-bench') state.items[1].cell = undefined;
            if (reason === 'wrong-origin') otter.visit!.from = { x: 1, z: 2 };
            if (reason === 'different-route') otter.facilityTrip!.path = [{ x: 3, z: 3 }];
            if (reason === 'old-display') delete state.readingEncounterVersion;
            expect(readingOtter(state)).toBeUndefined();
            expect(evaluateDiscovery(state, 'p').some(r => r.ruleId === 'X3')).toBe(false);
        },
    );
    it('requires exact observed actor and visit before freezing a replay', async () => {
        const state = fixture(), rule = evaluateDiscovery(state, 'p').find(r => r.ruleId === 'X3')!;
        await expect(createDiscoveryScene('p', state, rule, 'current-context-test', 'missing', 1000, ['otter'])).rejects.toThrow();
        state.readingObservation = { benchId: 'bench', libraryId: 'library', visitStart: 2000 };
        for (const actors of [[], ['rabbit'] as const, ['otter', 'rabbit'] as const]) {
            await expect(createDiscoveryScene('p', state, rule, 'current-context-test', 'wrong', 1000, [...actors])).rejects.toThrow();
        }
        const event = await createDiscoveryScene('p', state, rule, 'current-context-test', 'reading', 1000, ['otter']);
        expect(event.snapshot.scene.readingObservation).toEqual(state.readingObservation);
        expect(await sceneDigest(event.snapshot.scene)).toBe(event.snapshot.immutableHash);
        expect(replayDiscoveryScene(event, 'again', 2000).snapshot).toEqual(event.snapshot);
        state.readingObservation.visitStart++;
        await expect(createDiscoveryScene('p', state, rule, 'current-context-test', 'stale', 1000, ['otter'])).rejects.toThrow();
    });
});
