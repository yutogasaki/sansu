import { db } from '../db';
import { getAppData, saveAppData, updateProfileAtomically } from './user/repository';
import { readMathLevel11Pilot } from './learning/pilotRepository';
import { buildPeriodicTestSet } from './test/testSet';
import { applyFinishTestCompletion, finishEligibility, type FinishTestReservation } from './finishTest';
import type { SubjectKey } from './types';

// Coverage, active ownership, readiness and promotion use one persisted snapshot.
const stores = [db.appData, db.profiles, db.logs, db.parkEvents, db.islandEvents, db.challengeContacts];
export async function reserveFinishTest(profileId: string, subject: SubjectKey): Promise<FinishTestReservation> {
    return db.transaction('rw', stores, async () => {
        const data = await getAppData();
        const profile = data.profiles[profileId];
        if (!profile || data.activeProfileId !== profileId) throw new Error('学習者が変わりました。画面を開き直してください。');
        const missingUnits = subject === 'math' && profile.mathMainLevel === 11
            ? (await readMathLevel11Pilot(db, profileId)).practice.coverageReady ? [] : ['coverage'] : [];
        if (finishEligibility(profile, subject, missingUnits).status !== 'ready') throw new Error('しあげの準備中です。');
        const existing = profile.finishTestSets?.[subject];
        const mainLevel = subject === 'math' ? profile.mathMainLevel : profile.vocabMainLevel;
        if (existing?.profileId === profileId && existing.subject === subject && existing.level === mainLevel
            && existing.targetLevel === mainLevel + 1 && existing.problems.length === 20) return existing;
        const set = { ...buildPeriodicTestSet(profile, subject), id: crypto.randomUUID(), profileId,
            targetLevel: (subject === 'math' ? profile.mathMainLevel : profile.vocabMainLevel) + 1 };
        if (set.problems.length !== 20) throw new Error('しあげの問題を準備できませんでした。');
        const updated = { ...profile, finishTestSets: { ...profile.finishTestSets, [subject]: set } };
        await saveAppData({ ...data, profiles: { ...data.profiles, [profileId]: updated } });
        await db.profiles.put(updated);
        return set;
    });
}

export async function completeFinishTest(reservation: FinishTestReservation,
    stats: { correct: number; total: number; durationSeconds: number; timedOut?: boolean }) {
    return db.transaction('rw', stores, async () => {
        const data = await getAppData();
        const profile = data.profiles[reservation.profileId];
        if (!profile || data.activeProfileId !== reservation.profileId) return null;
        const missingUnits = reservation.subject === 'math' && profile.mathMainLevel === 11
            ? (await readMathLevel11Pilot(db, profile.id)).practice.coverageReady ? [] : ['coverage'] : [];
        const persisted = profile.finishTestSets?.[reservation.subject];
        const answers = persisted?.id === reservation.id ? Object.values(persisted.answers ?? {}) : [];
        const completed = applyFinishTestCompletion(profile, reservation, { ...stats,
            total: stats.timedOut ? 20 : answers.length,
            correct: answers.filter(Boolean).length }, Date.now(), missingUnits);
        if (!completed.result) return null;
        await saveAppData({ ...data, profiles: { ...data.profiles, [profile.id]: completed.profile } });
        await db.profiles.put(completed.profile);
        return completed;
    });
}

/** Persist the first response before advancing; re-entry resumes the same test. */
export async function recordFinishTestAnswer(reservation: FinishTestReservation, index: number, correct: boolean) {
    let accepted = false;
    await updateProfileAtomically(reservation.profileId, async current => {
        if ((await getAppData()).activeProfileId !== reservation.profileId) return current;
        const set = current.finishTestSets?.[reservation.subject];
        if (!set || set.id !== reservation.id || set.profileId !== current.id
            || (reservation.subject === 'math' ? current.mathMainLevel : current.vocabMainLevel) !== set.level
            || !Number.isInteger(index) || index < 0 || index >= 20) return current;
        accepted = true;
        if (set.answers?.[String(index)] !== undefined) return current;
        return { ...current, finishTestSets: { ...current.finishTestSets,
            [reservation.subject]: { ...set, answers: { ...set.answers, [String(index)]: correct } } } };
    });
    return accepted;
}
