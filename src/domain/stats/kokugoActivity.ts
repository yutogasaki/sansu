import type { KokugoEvent, KokugoWork } from '../kokugo/types';

export interface KokugoActivityEntry {
    id: string; profileId: string; at: number;
    kind: 'answer' | 'skip' | 'practice' | 'work' | 'reading';
    correct?: boolean;
}

/** A read-only projection. Draft edits and learning support are never invented answers. */
export function kokugoActivity(events: readonly KokugoEvent[], works: readonly KokugoWork[]): KokugoActivityEntry[] {
    const entries: KokugoActivityEntry[] = [];
    const seen = new Set<string>();
    const add = (entry: KokugoActivityEntry) => {
        const key = JSON.stringify([entry.profileId, entry.id]);
        if (!Number.isFinite(entry.at) || seen.has(key)) return;
        seen.add(key); entries.push(entry);
    };
    for (const event of events) {
        const kind = event.action === 'answer' ? 'answer' : event.action === 'skip' ? 'skip'
            : event.action === 'complete-supported' ? 'practice' : undefined;
        if (kind) add({ id: `event:${event.id}`, profileId: event.profileId, at: event.at, kind, correct: event.correct });
    }
    for (const work of works) {
        const revisions = [...(work.revisions ?? []), ...(work.saved ? [{ text: work.text, at: work.updatedAt }] : [])];
        for (const revision of revisions) if (revision.text.trim()) add({ id: `work:${work.id}:${revision.at}`, profileId: work.profileId,
            at: revision.at, kind: work.id.startsWith(`${work.profileId}:reading:`) ? 'reading' : 'work' });
    }
    return entries.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
}
