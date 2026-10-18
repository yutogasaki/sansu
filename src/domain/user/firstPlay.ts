import { db, type SansuDatabase } from '../../db';
import type { OnboardingSelection } from './onboarding';

export type FirstPlayStep = 'island' | 'grade' | 'subject' | 'math' | 'english';
export interface FirstPlaySession {
    id: 'island-first-play';
    version: 1;
    ownerId: string;
    step: FirstPlayStep;
    selection: OnboardingSelection;
    completed: boolean;
}
export const FIRST_PLAY_ID = 'island-first-play';
export const emptyFirstPlaySelection = (): OnboardingSelection => ({ name: '', grade: null, subject: null, mathRange: null, englishRange: null });
export const firstPlayTable = (database: SansuDatabase) => database.table<FirstPlaySession, string>('appData');

export async function readFirstPlay(database = db) {
    const session = await firstPlayTable(database).get(FIRST_PLAY_ID);
    if (session && (session.version !== 1 || !session.ownerId || !['island', 'grade', 'subject', 'math', 'english'].includes(session.step)))
        throw new Error('このしまは あたらしいばんで ひらいてね。');
    return session;
}

async function hasProfiles(database: SansuDatabase) {
    const app = await database.appData.get('app');
    return Object.keys(app?.profiles ?? {}).length > 0 || await database.profiles.count() > 0;
}

/** Reserve identity, never a guessed grade, learning profile or answer evidence. */
export async function enterFirstPlay(database = db): Promise<FirstPlaySession> {
    return database.transaction('rw', [database.appData, database.profiles], async () => {
        if (await hasProfiles(database)) throw new Error('じぶんの しまを ひらきなおしてね。');
        const current = await readFirstPlay(database);
        if (current && !current.completed) return current;
        const session: FirstPlaySession = { id: FIRST_PLAY_ID, version: 1, ownerId: crypto.randomUUID(), step: 'island',
            selection: emptyFirstPlaySelection(), completed: false };
        await firstPlayTable(database).put(session);
        return session;
    });
}

/** Form navigation is saved with its choices, so a reload cannot invent a selection. */
export async function saveFirstPlaySetup(ownerId: string, step: FirstPlayStep, selection: OnboardingSelection, database = db) {
    return database.transaction('rw', [database.appData, database.profiles], async () => {
        const current = await readFirstPlay(database);
        if (!current || current.ownerId !== ownerId || current.completed || await hasProfiles(database))
            throw new Error('じぶんの しまを ひらきなおしてね。');
        const next = { ...current, step, selection: structuredClone(selection) };
        await firstPlayTable(database).put(next);
        return next;
    });
}

/** Merge only the nickname; an older input event cannot move the form backwards. */
export async function saveFirstPlayName(ownerId: string, name: string, database = db) {
    return database.transaction('rw', [database.appData], async () => {
        const current = await readFirstPlay(database);
        if (current && current.ownerId === ownerId && !current.completed)
            await firstPlayTable(database).put({ ...current, selection: { ...current.selection, name: name.slice(0, 20) } });
    });
}
