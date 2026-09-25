import type { LifeRecord, LifeState } from './model';
import { cadenceReplayKey, rememberLifeState } from './replayCache';

/** Disposable projection, never a replacement for the authoritative event log. */
export interface LifeReplaySnapshot {
    format: 1;
    build: string;
    key: string;
    state: LifeState;
    digest: string;
}
// UI-only deployments must not force a cold replay of the owner's entire history.
// The build tool fingerprints runtime rules, transitive dependencies and flags.
const build = __LIFE_REPLAY_VERSION__;
async function digest(payload: unknown) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function restoreLifeSnapshot(record: LifeRecord): Promise<boolean> {
    try {
        const snapshot = record.replaySnapshot;
        if (!snapshot || snapshot.format !== 1 || snapshot.build !== build
            || !snapshot.state || snapshot.state.now !== record.now || !snapshot.state.cadenceVersion
            || snapshot.key !== cadenceReplayKey(record, record.now)) return false;
        const { digest: expected, ...payload } = snapshot;
        if (expected !== await digest(payload)) return false;
        rememberLifeState(snapshot.key, snapshot.state);
        return true;
    } catch { return false; } // A missing/corrupt cache cannot prevent opening a valid island.
}
export async function createLifeSnapshot(record: LifeRecord, state: LifeState): Promise<LifeReplaySnapshot | undefined> {
    try {
        const key = cadenceReplayKey(record, record.now);
        if (!key || state.now !== record.now || !state.cadenceVersion) return;
        const payload = { format: 1 as const, build, key, state: structuredClone(state) };
        return { ...payload, digest: await digest(payload) };
    } catch { return undefined; }
}
