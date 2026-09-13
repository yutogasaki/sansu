import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { discoveryParticipants } from './discoveryRecall';
import { evaluateDiscovery } from './discovery';
import { appendPresentedScene, createDiscoveryScene, emptyDiscoveryJournal, replayDiscoveryScene, saveDiscoveryMemory,
    sceneDigest, unpinDiscoveryMemory, type DiscoveryScene, type PresentationEvidence } from './discoveryJournal';
import { DiscoveryPresentation, type VisibleSceneFrame } from './discoveryPresentation';
import { editDiscoveryMemory, recordPresentedScene } from './discoveryRepository';
import { IslandLifeDatabase, updateLife } from './repository';
import { learningDay, newLife } from './model';
import { commandLife, replayLife } from './simulation';

const databases: IslandLifeDatabase[] = [];
afterEach(async () => { await Promise.all(databases.splice(0).map(db => db.delete())); });
function owner() {
    const record = newLife('p', 100);
    record.credits = [{ id: 'learned', at: 100, day: learningDay(100) }];
    return commandLife(record, { type: 'buy', kind: 'flower', cell: { x: 0, z: 2 } }, 'flower', 100);
}
async function scene(id = 'seen', source: 'live' | 'simulated' = 'live') {
    const state = replayLife(owner());
    const rule = evaluateDiscovery(state, 'p').find(rule => rule.ruleId === 'M2')!;
    return createDiscoveryScene('p', state, rule, source, id, 1000);
}
function evidence(event: DiscoveryScene): PresentationEvidence {
    return { eventId: event.eventId, firstVisibleAt: 1000, visibleDurationMs: 1000, coreShown: true, presentationKind: event.source };
}
const visible: VisibleSceneFrame = { rendered: true, foreground: true, onScreen: true, unoccluded: true, preview: false, coreShown: true };

describe('display is distinct from eligibility, saving and understanding', () => {
    it('requires one second of real rendered intervals and excludes hidden, offscreen, preview and occluded frames', async () => {
        const event = await scene();
        for (const excluded of [{ rendered: false }, { foreground: false }, { onScreen: false }, { unoccluded: false }, { preview: true }, { coreShown: false }]) {
            const clock = new DiscoveryPresentation(event);
            for (let at = 0; at <= 2000; at += 100) expect(clock.sample(at, 1000 + at, { ...visible, ...excluded })).toBeUndefined();
            for (let at = 2100; at < 3100; at += 100) expect(clock.sample(at, 1000 + at, visible)).toBeUndefined();
            expect(clock.sample(3100, 4100, visible)).toMatchObject({ firstVisibleAt: 3100, visibleDurationMs: 1000 });
            expect(clock.sample(3200, 4200, visible)).toBeUndefined();
        }
    });
    it('does not infer visibility across callback gaps, backward clock or cancellation', async () => {
        const clock = new DiscoveryPresentation(await scene());
        expect(clock.sample(0, 1000, visible)).toBeUndefined();
        expect(clock.sample(10000, 11000, visible)).toBeUndefined();
        expect(clock.sample(0, 1000, visible)).toBeUndefined();
        clock.cancel();
        for (let at = 0; at <= 2000; at += 100) expect(clock.sample(at, 1000 + at, visible)).toBeUndefined();
    });
    it('does not write eligibility or incomplete evidence and does not infer understanding', async () => {
        const event = await scene(), empty = emptyDiscoveryJournal();
        expect(appendPresentedScene(empty, event, { ...evidence(event), visibleDurationMs: 999 })).toBe(empty);
        expect(appendPresentedScene(empty, event, { ...evidence(event), coreShown: false })).toBe(empty);
        const shown = appendPresentedScene(empty, event, evidence(event));
        expect(shown.savedIds).toEqual([]);
        expect(shown.firstPresented).toEqual([{ ruleId: 'M2', ruleVersion: event.ruleVersion, eventId: 'seen', at: 1000 }]);
        expect(JSON.stringify(shown)).not.toMatch(/comprehension|understood|creativity/);
        expect(appendPresentedScene(shown, event, evidence(event))).toBe(shown);
    });
    it('freezes the displayed world style without rewriting old memory content or hashes', async () => {
        const old = await scene(), oldBytes = JSON.stringify(old);
        expect(old.snapshot.scene.worldStyle).toBeUndefined();
        const state = { ...replayLife(owner()), worldStyle: 'canopy-dots-c3-v1' as const };
        const rule = evaluateDiscovery(state, 'p').find(rule => rule.ruleId === 'M2')!;
        const current = await createDiscoveryScene('p', state, rule, 'live', 'new-world', 1000);
        expect(current.snapshot.scene.worldStyle).toBe('canopy-dots-c3-v1');
        expect(current.snapshot.immutableHash).not.toBe(old.snapshot.immutableHash);
        expect(replayDiscoveryScene(current, 'replay-new', 2000).snapshot).toEqual(current.snapshot);
        expect(replayDiscoveryScene(old, 'replay-old', 2000).snapshot).toEqual(old.snapshot);
        expect(await sceneDigest(old.snapshot.scene)).toBe(old.snapshot.immutableHash);
        expect(JSON.stringify(old)).toBe(oldBytes);
    });
    it('freezes placement rules while old memories retain their original absent marker and hash', async () => {
        const old = await scene(), oldBytes = JSON.stringify(old);
        const state = { ...replayLife(owner()), placementVersion: 1 as const };
        const rule = evaluateDiscovery(state, 'p').find(rule => rule.ruleId === 'M2')!;
        const current = await createDiscoveryScene('p', state, rule, 'live', 'new-placement', 1000);
        expect(current.snapshot.scene.placementVersion).toBe(1);
        expect(current.snapshot.immutableHash).not.toBe(old.snapshot.immutableHash);
        const oldReplay = replayDiscoveryScene(old, 'old-replay', 2000);
        const newReplay = replayDiscoveryScene(current, 'new-replay', 2000);
        expect('placementVersion' in oldReplay.snapshot.scene).toBe(false);
        expect(newReplay.snapshot.scene.placementVersion).toBe(1);
        expect(discoveryParticipants(oldReplay).map(item => item.id)).toEqual(['flower']);
        expect(discoveryParticipants(newReplay).map(item => item.id)).toEqual(['flower']);
        expect(oldReplay.snapshot).toEqual(old.snapshot);
        expect(newReplay.snapshot).toEqual(current.snapshot);
        expect(await sceneDigest(old.snapshot.scene)).toBe(old.snapshot.immutableHash);
        expect(JSON.stringify(old)).toBe(oldBytes);
    });
    it('captures a detached snapshot and rejects stale conditions', async () => {
        const state = replayLife(owner()), rule = evaluateDiscovery(state, 'p').find(rule => rule.ruleId === 'M2')!;
        const event = await createDiscoveryScene('p', state, rule, 'live', 'event', 1000);
        state.items[0].cell = undefined;
        expect(event.snapshot.scene.items[0].cell).toEqual({ x: 0, z: 2 });
        expect(await sceneDigest(event.snapshot.scene)).toBe(event.snapshot.immutableHash);
        await expect(createDiscoveryScene('p', state, rule, 'live', 'stale', 1000)).rejects.toThrow();
    });
    it('caps automatic history while protecting first presentation and all twelve explicit memories', async () => {
        let journal = emptyDiscoveryJournal(); const base = await scene();
        for (let i = 0; i < 35; i++) {
            const event = { ...base, eventId: `event${i}`, semanticSignature: `different${i}` };
            journal = appendPresentedScene(journal, event, evidence(event));
            if (i < 12) journal = saveDiscoveryMemory(journal, event.eventId);
        }
        expect(journal.historyIds).toHaveLength(20); expect(journal.savedIds).toHaveLength(12);
        expect(journal.entries.some(entry => entry.event.eventId === 'event0')).toBe(true);
        expect(journal.entries.some(entry => entry.event.eventId === 'event12')).toBe(false);
        expect(() => saveDiscoveryMemory(journal, 'event34')).toThrow('いっぱい');
        const unpinned = unpinDiscoveryMemory(journal, 'event0');
        expect(unpinned.entries.some(entry => entry.event.eventId === 'event0')).toBe(true);
        expect(saveDiscoveryMemory(unpinned, 'event34').savedIds).toHaveLength(12);
        expect(journal.savedIds).toHaveLength(12);
    });
    it('deduplicates history without replacing a first or manually saved snapshot', async () => {
        const first = await scene('first');
        let journal = appendPresentedScene(emptyDiscoveryJournal(), first, evidence(first));
        journal = saveDiscoveryMemory(journal, first.eventId);
        for (let i = 0; i < 30; i++) { const event = { ...first, eventId: `same${i}` }; journal = appendPresentedScene(journal, event, evidence(event)); }
        expect(journal.historyIds).toEqual(['same29']); expect(journal.entries).toHaveLength(2);
        expect(journal.savedIds).toEqual(['first']); expect(journal.firstPresented[0].eventId).toBe('first');
    });
    it('keeps simulated and replay source distinct and never changes the current world', async () => {
        const simulated = await scene('simulated', 'simulated');
        const before = owner(); let journal = appendPresentedScene(emptyDiscoveryJournal(), simulated, evidence(simulated));
        const replay = replayDiscoveryScene(simulated, 'replay', 1000);
        journal = appendPresentedScene(journal, replay, evidence(replay));
        expect(journal.firstPresented).toHaveLength(0);
        expect(replay.originEventId).toBe('simulated'); expect(replay.source).toBe('replay');
        expect(journal.entries[0].event.source).toBe('simulated');
        expect(replayLife({ ...before, discoveryJournal: journal })).toEqual(replayLife(before));
        replay.snapshot.scene.items[0].cell = undefined;
        expect(simulated.snapshot.scene.items[0].cell).toBeDefined();
    });
});

describe('atomic journal persistence stays within the original owner', () => {
    async function setup() {
        const db = new IslandLifeDatabase(`discovery-${crypto.randomUUID()}`); databases.push(db);
        const record = owner(); await db.worlds.put(record); return { db, record };
    }
    it('keeps economy unchanged, survives refresh, and handles duplicate submission', async () => {
        const { db, record } = await setup(), event = await scene();
        const results = await Promise.all([recordPresentedScene('p', event, evidence(event), db), recordPresentedScene('p', event, evidence(event), db)]);
        expect(results[0]).toEqual(results[1]);
        const saved = (await db.worlds.get('p'))!;
        expect(saved.revision).toBe(record.revision); expect(replayLife(saved)).toEqual(replayLife(record));
        const refreshed = await updateLife('p', [], undefined, 101, db);
        expect(refreshed.discoveryJournal).toEqual(saved.discoveryJournal);
        const journal = await editDiscoveryMemory('p', event.eventId, 'save', results[0]!.revision, db);
        expect(journal.savedIds).toEqual([event.eventId]);
    });
    it('rejects changed snapshots and another owner, and does not resurrect deleted owners', async () => {
        const { db } = await setup(), event = await scene();
        await expect(recordPresentedScene('other', event, evidence(event), db)).rejects.toThrow('持ち主');
        const altered = structuredClone(event); altered.snapshot.scene.items[0].growth = 6;
        await expect(recordPresentedScene('p', altered, evidence(altered), db)).rejects.toThrow('内容');
        await db.worlds.delete('p');
        await expect(recordPresentedScene('p', event, evidence(event), db)).rejects.toThrow('みつからない');
        expect(await db.worlds.count()).toBe(0);
    });
    it('rolls back an interrupted write, then retries the same event once', async () => {
        const { db, record } = await setup(), event = await scene();
        const fail = () => { throw new Error('Injected save abort'); };
        db.worlds.hook('updating', fail);
        await expect(recordPresentedScene('p', event, evidence(event), db)).rejects.toThrow('abort');
        expect(await db.worlds.get('p')).toEqual(record);
        db.worlds.hook('updating').unsubscribe(fail);
        expect((await recordPresentedScene('p', event, evidence(event), db))?.historyIds).toEqual([event.eventId]);
    });
    it('rejects competing manual edits while preserving an idempotent save retry', async () => {
        const { db } = await setup(), event = await scene();
        const journal = (await recordPresentedScene('p', event, evidence(event), db))!;
        const saved = await editDiscoveryMemory('p', event.eventId, 'save', journal.revision, db);
        expect(await editDiscoveryMemory('p', event.eventId, 'save', journal.revision, db)).toEqual(saved);
        await expect(editDiscoveryMemory('p', event.eventId, 'unpin', journal.revision, db)).rejects.toThrow('かわった');
        expect((await db.worlds.get('p'))?.discoveryJournal).toEqual(saved);
    });
});
