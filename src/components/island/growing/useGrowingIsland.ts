import { drainKokugoRewards } from '../../../domain/growingIsland/kokugoReceipts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { allowPwaUpdateDuringReadOnlyOpening, holdPwaUpdateForCriticalPersistence } from '../../../pwa';
import { drainFoundationRewards } from '../../../domain/growingIsland/foundationReceipts';
import { lifeDb, terminalFacts } from '../../../domain/islandLife/repository';
import { getProfile } from '../../../domain/user/repository';
import { db } from '../../../db';
import { confirmedKokugoLevel } from '../../../domain/kokugo/levels';
import { confirmedMathLevel, confirmedVocabLevel, passedLevel } from '../../../domain/growingIsland/journey';

/** Kokugo unit progress, read only; a missing table or profile reads as nothing confirmed. */
async function kokugoProgressOf(profileId: string) {
    try { return await db.kokugoProgress.where('profileId').equals(profileId).toArray(); } catch { return []; }
}
import { commandGrowingIsland, sailGrowingIsland, growingDb, GuidanceReceiptConflict, readGrowingIsland, syncGrowingIsland, type GrowingRecord } from '../../../domain/growingIsland/repository';
import { applyIntent, type AchievementId, type Command, type NatureEvent, type TownEvent } from '../../../domain/growingIsland';
import { islandIdOf, type IslandStart } from '../../../domain/growingIsland/voyages';
import type { LoadingStep } from './GrowingLoading';
import { prepareIslandOpening } from '../../../domain/growingIsland/openingPreparation';

export interface Reveal { id: number; town: TownEvent[]; nature: NatureEvent[] }
export type PlaceReceipt = Omit<Extract<Command, { type: 'shared-play' }>, 'profileId' | 'expectedRevision'>
    | Omit<Extract<Command, { type: 'place-used' }>, 'profileId' | 'expectedRevision'>
    | Omit<Extract<Command, { type: 'place-shown' }>, 'profileId' | 'expectedRevision'>;

/** Another tab saved this island: reload the saved state instead of showing a stale one. */
const channelName = 'sansu-growing-island';
const announce = (profileId: string) => { try { const c = new BroadcastChannel(channelName); c.postMessage(profileId); c.close(); } catch { /* Old browsers refresh on focus. */ } };

const message = (error: unknown) => error instanceof Error && /[ぁ-ん]/.test(error.message)
    ? error.message : 'しまを ほぞん できなかったよ。もういちど ためしてね。';

/**
 * Keeps the growing island in step with learning: every sync adds new completions, grows
 * nature and opens banked town time in one save. Commands wait for a running sync.
 */
export function useGrowingIsland(profileId: string, active: boolean) {
    const [record, setRecord] = useState<GrowingRecord>();
    // Ground shaping is shown at once and saved behind, one stroke after another (the newest shown state is here).
    const shown = useRef<GrowingRecord | undefined>(undefined);
    useEffect(() => { shown.current = record; }, [record]);
    const terrainSaves = useRef<Promise<void>>(Promise.resolve()), terrainWaiting = useRef(0), terrainRound = useRef(0);
    const displayedIslandId = islandIdOf(record);
    const sailing = useRef(false);
    const [reveal, setReveal] = useState<Reveal>();
    const [error, setError] = useState<string>();
    const [busy, setBusy] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [step, setStep] = useState<LoadingStep>('learning');
    const running = useRef<Promise<void> | undefined>(undefined), revealId = useRef(0);
    const placeReceipts = useRef<Promise<unknown>>(Promise.resolve());
    const caller = useRef({ profileId, active });
    useEffect(() => { caller.current = { profileId, active }; return () => { caller.current.active = false; }; }, [profileId, active]);
    // A failed opening is still not a playable session. Keep update recovery available
    // until a saved island appears or the child leaves this screen.
    const hasRecord = Boolean(record);
    useEffect(() => {
        if (active && !hasRecord) return allowPwaUpdateDuringReadOnlyOpening();
    }, [active, hasRecord]);

    /**
     * `full` reads every learning completion and the learning levels; the periodic refresh only
     * grows nature, since learning happens on another screen and returning runs a full sync.
     */
    const sync = useCallback((full = true) => {
        if (running.current) return running.current;
        setSyncing(true);
        running.current = (async () => {
            try {
                // A stroke still being saved is part of the island; read after it.
                await terrainSaves.current;
                const [profile, facts] = full ? await prepareIslandOpening(() => Promise.all([getProfile(profileId), terminalFacts(profileId)])) : [undefined, []];
                const kokugo = profile ? await kokugoProgressOf(profileId) : [];
                // Learning is only read: the shared Lv1–20 whose content was confirmed opens route slots (island-journey.md §3).
                const levels = profile ? { math: profile.mathMainLevel, vocab: profile.vocabMainLevel, confirmed: {
                    math: confirmedMathLevel(passedLevel(profile.testHistory, 'math')), vocab: confirmedVocabLevel(passedLevel(profile.testHistory, 'vocab')),
                    kokugo: confirmedKokugoLevel(kokugo) } } : undefined;
                setStep('saving'); setSaving(true);
                let result = await syncGrowingIsland(profileId, facts, Date.now(), growingDb, lifeDb, levels);
                // A delivery failure must not hide an island whose opening already saved.
                if (!terrainWaiting.current) setRecord(current => current?.profileId === result.record.profileId && current.revision > result.record.revision ? current : result.record);
                if (full) {
                    const foundation = await drainFoundationRewards(profileId);
                    const kokugo = await drainKokugoRewards(profileId);
                    const delivered = { credited: foundation.credited + kokugo.credited, record: kokugo.record ?? foundation.record };
                    if (delivered.credited) {
                        const opened = await syncGrowingIsland(profileId, [], Date.now(), growingDb, lifeDb, levels);
                        const unique = <T,>(events: T[]) => events.filter((event, index) => events.findIndex(other => JSON.stringify(other) === JSON.stringify(event)) === index);
                        result = { ...opened, learned: result.learned + delivered.credited,
                            town: unique([...result.town, ...opened.town]), nature: unique([...result.nature, ...opened.nature]) };
                    } else if (delivered.record) result = { ...result, record: delivered.record };
                }
                if (!terrainWaiting.current) setRecord(current => current?.profileId === result.record.profileId && current.revision > result.record.revision ? current : result.record); setError(undefined);
                // Only meaningful changes are announced, so two open tabs never ping-pong refreshes.
                // A saved but unseen moment is returned again for presentation, not a new change.
                if (result.learned > 0 || result.town.some(event => event.type !== 'moment')) announce(profileId);
                const shown = result.town.some(e => e.type !== 'quiet') || result.nature.some(e => e.type === 'big-tree' || e.type === 'lord-tree' || e.type === 'spread' || e.type === 'mixed');
                if (result.town.length || shown) setReveal({ id: ++revealId.current, town: result.town, nature: result.nature });
            } catch (e) { setError(message(e)); }
            finally { running.current = undefined; setSyncing(false); setSaving(false); }
        })();
        return running.current;
    }, [profileId]);

    // Serialize renderer observations so several newly grown places do not race each
    // other. Each retry re-reads the owner's saved revision; hidden/visiting worlds
    // cannot record another island's shown shape or somebody else's play.
    const acknowledgePlace = useCallback((receipt: PlaceReceipt): Promise<boolean> => {
        const live = () => caller.current.profileId === profileId && caller.current.active && document.visibilityState === 'visible';
        const save = async () => {
            if (!live()) return false;
            if (running.current) await running.current;
            if (!live()) return false;
            const intentId = crypto.randomUUID(), release = holdPwaUpdateForCriticalPersistence();
            try {
                for (let attempt = 0; attempt < 3 && live(); attempt++) {
                    const current = await readGrowingIsland(profileId);
                    if (!current || !live() || islandIdOf(current) !== displayedIslandId) return false;
                    if (receipt.type === 'place-shown' && current.state.placeProgress?.shown[receipt.ruleId] === receipt.revision) return true;
                    if (receipt.type === 'place-used') {
                        const used = current.state.placeProgress?.uses[receipt.ruleId]?.[receipt.actorId === 'pokomoko' ? 'pokomoko' : 'villager'];
                        if (used?.actorId === receipt.actorId && used.targetId === receipt.targetId && used.revision === receipt.revision) return true;
                    }
                    const command: Command = { ...receipt, profileId, expectedRevision: current.revision };
                    try {
                        const result = await commandGrowingIsland(profileId, { id: intentId, islandId: displayedIslandId, command });
                        if (live()) { setRecord(current => current?.profileId === result.record.profileId && current.revision > result.record.revision ? current : result.record); setError(undefined); announce(profileId); }
                        return true;
                    } catch (error) { if (!(error instanceof GuidanceReceiptConflict)) throw error; }
                }
                return false;
            } catch (error) { if (live()) setError(message(error)); return false; }
            finally { release(); }
        };
        const queued = placeReceipts.current.then(save, save);
        placeReceipts.current = queued;
        return queued;
    }, [profileId, displayedIslandId]);

    // Only an actually rendered foreground experience can issue these receipts. A normal
    // sync may win the revision race; refresh and retry without showing a false save error.
    const acknowledge = useCallback(async (type: 'learning-returned' | 'concert-started' | 'ack-achievements', value?: string | AchievementId[]) => {
        const live = () => caller.current.profileId === profileId && caller.current.active && document.visibilityState === 'visible';
        if (!live()) return false;
        if (running.current) await running.current;
        const intentId = crypto.randomUUID(), release = holdPwaUpdateForCriticalPersistence();
        try {
            for (let attempt = 0; attempt < 3 && live(); attempt++) {
                const current = await readGrowingIsland(profileId);
                if (!current || !live() || islandIdOf(current) !== displayedIslandId) return false;
                if (type === 'learning-returned' && current.state.guidance?.starter.steps.S4) return true;
                if (type === 'concert-started' && current.state.guidance?.achievements.A5) return true;
                if (type === 'ack-achievements' && (value as AchievementId[]).every(id => current.state.guidance?.notified.includes(id))) return true;
                const command: Command = type === 'learning-returned'
                    ? { type, profileId, expectedRevision: current.revision }
                    : type === 'ack-achievements' ? { type, ids: value as AchievementId[], profileId, expectedRevision: current.revision }
                        : { type, id: value as string, profileId, expectedRevision: current.revision };
                try {
                    const result = await commandGrowingIsland(profileId, { id: intentId, islandId: displayedIslandId, command });
                    if (live()) { setRecord(current => current?.profileId === result.record.profileId && current.revision > result.record.revision ? current : result.record); setError(undefined); announce(profileId); }
                    return true;
                } catch (e) { if (!(e instanceof GuidanceReceiptConflict)) throw e; }
            }
            return false;
        } catch (e) { if (live()) setError(message(e)); return false; }
        finally { release(); }
    }, [profileId, displayedIslandId]);

    const dispatch = useCallback(async (command: Command) => {
        if (running.current) await running.current;
        setBusy(true);
        const release = holdPwaUpdateForCriticalPersistence();
        try {
            const result = await commandGrowingIsland(profileId, { id: crypto.randomUUID(), islandId: displayedIslandId, command });
            setRecord(current => current?.profileId === result.record.profileId && current.revision > result.record.revision ? current : result.record); setError(undefined); announce(profileId);
            if (result.town.length) setReveal({ id: ++revealId.current, town: result.town, nature: [] });
            return true;
        } catch (e) {
            if (command.type === 'terrain-edit' || command.type === 'terrain-stroke' || command.type === 'terrain-undo' || command.type === 'terrain-redo') {
                try {
                    const latest = await readGrowingIsland(profileId);
                    if (latest && islandIdOf(latest) === displayedIslandId)
                        setRecord(current => current?.profileId === latest.profileId && current.revision > latest.revision ? current : latest);
                } catch { /* Keep the original edit error; an unsuccessful read must not overwrite saved data. */ }
            }
            setError(message(e)); return false;
        }
        finally { release(); setBusy(false); }
    }, [profileId, displayedIslandId]);

    /**
     * Shape the ground (terrain stroke / undo / redo) like a toy: the island changes on the
     * finger's release, and the save follows in order behind it. A refused stroke says why and
     * changes nothing; a save that fails afterwards puts back the saved island and says so.
     */
    const shapeTerrain = useCallback((command: Command): string | undefined => {
        const current = shown.current;
        if (!current) return 'しまを よみこんでね。';
        const intent = { id: crypto.randomUUID(), command };
        let state;
        try { state = applyIntent(current.state, intent, Date.now()).state; } catch (e) { return message(e); }
        if (state === current.state) return undefined;
        const next = { ...current, state };
        shown.current = next; setRecord(next); setError(undefined);
        terrainWaiting.current += 1;
        const round = terrainRound.current;
        terrainSaves.current = terrainSaves.current.then(async () => {
            // After a failed save the strokes shown after it were already put back.
            if (round !== terrainRound.current) return;
            const release = holdPwaUpdateForCriticalPersistence();
            try {
                const result = await commandGrowingIsland(profileId, { ...intent, islandId: displayedIslandId });
                terrainWaiting.current -= 1;
                // Later strokes are already shown; only the last save replaces what is on screen.
                if (!terrainWaiting.current) { shown.current = result.record; setRecord(result.record); announce(profileId); }
            } catch (e) {
                terrainWaiting.current = 0; terrainRound.current += 1;
                const latest = await readGrowingIsland(profileId).catch(() => undefined);
                if (latest && islandIdOf(latest) === displayedIslandId) { shown.current = latest; setRecord(latest); }
                setError(message(e));
            } finally { release(); }
        });
        return undefined;
    }, [profileId, displayedIslandId]);

    const sail = useCallback(async (id: string, create?: { name: string; start: IslandStart }) => {
        if (sailing.current) return false;
        sailing.current = true; setBusy(true);
        try {
            if (running.current) await running.current;
            await placeReceipts.current;
            const next = await sailGrowingIsland(profileId, displayedIslandId, { id, create });
            setRecord(next); setReveal(undefined); setError(undefined); announce(profileId);
            // The voyage is committed. Refresh natural growth in the background;
            // a slow learning scan must not keep the saved destination behind the chart.
            void sync();
            return true;
        } catch (error) { setError(message(error)); return false; }
        finally { sailing.current = false; setBusy(false); }
    }, [profileId, displayedIslandId, sync]);

    useEffect(() => { setRecord(undefined); setReveal(undefined); }, [profileId]);
    useEffect(() => {
        if (!active || typeof BroadcastChannel === 'undefined') return;
        const channel = new BroadcastChannel(channelName);
        channel.onmessage = event => { if (event.data === profileId) void sync(); };
        return () => channel.close();
    }, [active, profileId, sync]);
    useEffect(() => {
        if (!active) return;
        let live = true;
        // A saved island appears at once; the full sync then adds learning and opens town time.
        void readGrowingIsland(profileId).then(saved => { if (live && saved) setRecord(current => current ?? saved); }).catch(() => undefined);
        void sync();
        const visible = () => { if (document.visibilityState === 'visible') void sync(); };
        const id = window.setInterval(() => { if (document.visibilityState === 'visible') void sync(false); }, 15_000);
        document.addEventListener('visibilitychange', visible);
        return () => { live = false; clearInterval(id); document.removeEventListener('visibilitychange', visible); };
    }, [active, profileId, sync]);

    return { sail, record: record?.profileId === profileId ? record : undefined, reveal, error, busy, syncing, saving, dispatch, shapeTerrain, acknowledge, acknowledgePlace, sync, step,
        clearError: () => setError(undefined) };
}
