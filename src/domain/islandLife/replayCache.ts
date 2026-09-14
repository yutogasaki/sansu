import type { LifeRecord, LifeState } from './model';

// An optional, bounded acceleration of deterministic replay. No cached data is
// persisted or trusted instead of record validation. Different events, owners,
// versions and checkpoints always get different keys, even after in-place edits.
const states = new Map<string, LifeState>();
export function cadenceReplayKey(record: LifeRecord, to: number) {
    if (record.version !== 16 || !Number.isFinite(to) || to < record.now
        || record.actions.some(a => a.at > to) || record.credits.some(c => c.at > to)) return;
    return JSON.stringify({ ...record, now: 0, realAt: 0, revision: 0, offsets: [],
        clockIntents: [], clockIntentHours: undefined, discoveryJournal: undefined });
}
export function cachedLifeState(key: string | undefined, to: number) {
    const state = key === undefined ? undefined : states.get(key);
    return state && state.now <= to ? structuredClone(state) : undefined;
}
export function rememberLifeState(key: string | undefined, state: LifeState) {
    if (key === undefined || !state.cadenceVersion) return;
    states.delete(key); states.set(key, structuredClone(state));
    while (states.size > 8) states.delete(states.keys().next().value!);
}
export function clearLifeReplayCache() { states.clear(); }
