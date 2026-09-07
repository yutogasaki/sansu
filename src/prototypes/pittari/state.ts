import { boards, CANDIDATE } from './boards';
import { clone, play, type Columns } from './engine';

export const STORAGE_KEY = 'sansu:pittari:positive-v1';
export type Snapshot = { columns: Columns; best: number; last: number };
export type Session = {
    boardId: string; moves: number[]; dots: boolean; sound: boolean; paused: boolean;
    visits: Record<string, number>; afterUndo: boolean;
};
export const fresh = (): Session => ({ boardId: '5-1', moves: [], dots: true, sound: false,
    paused: false, visits: { '5-1': 1 }, afterUndo: false });

// Store manual move history, then reconstruct it through the engine on reload.
// No arbitrary persisted board state is trusted, and undo stays one complete manual turn.
export function replay(session: Session): Snapshot[] {
    const board = boards.find(b => b.id === session.boardId);
    if (!board) throw new Error('Unknown board');
    const snapshots: Snapshot[] = [{ columns: clone(board.columns), best: 0, last: 0 }];
    for (const move of session.moves) {
        const previous = snapshots[snapshots.length - 1];
        const steps = play(previous.columns, board.target, move);
        snapshots.push({ columns: steps[steps.length - 1].after,
            best: Math.max(previous.best, steps.length), last: steps.length });
    }
    return snapshots;
}

export function decode(raw: string): Session {
    const parsed = JSON.parse(raw);
    if (parsed.version !== CANDIDATE || !parsed.session) throw new Error('Invalid version');
    const s = parsed.session;
    if (typeof s.boardId !== 'string' || !Array.isArray(s.moves) || s.moves.length > 12 ||
        !s.moves.every((n: unknown) => Number.isInteger(n)) ||
        !['dots', 'sound', 'paused', 'afterUndo'].every(key => typeof s[key] === 'boolean') ||
        !s.visits || typeof s.visits !== 'object' || Array.isArray(s.visits) ||
        Object.entries(s.visits).some(([id, n]) => !boards.some(b => b.id === id) ||
            typeof n !== 'number' || !Number.isSafeInteger(n) || n < 1)) throw new Error('Invalid save');
    replay(s);
    return s;
}

export function save(session: Session, storage: Pick<Storage, 'setItem'>): boolean {
    try { storage.setItem(STORAGE_KEY, JSON.stringify({ version: CANDIDATE, session })); return true; }
    catch { return false; }
}

export type Observation = {
    sequence: number; at: string; event: string; boardId: string; dots: boolean;
    visit: number; afterUndo: boolean; details: Record<string, unknown>;
};
export function createJournal() {
    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const events: Observation[] = [];
    let dropped = 0;
    let sequence = 0;
    return {
        record(event: string, session: Session, details: Record<string, unknown> = {}) {
            events.push({ sequence: ++sequence, at: new Date().toISOString(), event, boardId: session.boardId,
                dots: session.dots, visit: session.visits[session.boardId] || 1, afterUndo: session.afterUndo, details });
            if (events.length > 5000) { events.shift(); dropped++; }
        },
        export() { return { candidate: CANDIDATE, sessionId, scope: 'current-page-session-only',
            affectsSrs: false, dropped, events: [...events] }; },
    };
}
