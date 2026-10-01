import { db, type SansuDatabase } from '../../db';
import type { SubjectKey, UserProfile } from '../types';
import { getLearningItemMapping } from './catalog';

export function evaluationContactTimes(profile: UserProfile | null, subject: SubjectKey, itemId: string): string[] {
    const contacts = profile?.evaluationContacts?.[subject] ?? {};
    const unit = subject === 'math' ? getLearningItemMapping(subject, itemId)?.unitId : undefined;
    return Object.entries(contacts).filter(([id]) => id === itemId
        || unit !== undefined && getLearningItemMapping(subject, id)?.unitId === unit).map(([, time]) => time);
}

/** Persist an exposure without creating an answer, memory, or achievement. */
export async function recordEvaluationContact(profileId: string, subject: SubjectKey, itemId: string,
    timestamp = new Date().toISOString(), database: SansuDatabase = db): Promise<boolean> {
    if (!Number.isFinite(Date.parse(timestamp))) throw new Error('Invalid evaluation contact time');
    return database.transaction('rw', database.appData, database.profiles, async () => {
        const data = await database.appData.get('app');
        const profile = data?.profiles[profileId];
        if (!profile || data?.activeProfileId !== profileId) return false;
        const previous = profile.evaluationContacts?.[subject]?.[itemId];
        // A repeated exposure cannot move the clock backwards.
        const latest = previous && Date.parse(previous) >= Date.parse(timestamp) ? previous : timestamp;
        const updated = { ...profile, evaluationContacts: { ...profile.evaluationContacts,
            [subject]: { ...profile.evaluationContacts?.[subject], [itemId]: latest } } };
        await database.appData.put({ ...data, profiles: { ...data.profiles, [profileId]: updated } });
        await database.profiles.put(updated);
        return true;
    });
}
