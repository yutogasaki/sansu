import { db, type SansuDatabase } from '../../db';
import { isMathSkillUnlockedForProfile } from '../math/curriculum';
import { isIndependentCorrect } from '../learning/independentProgress';
import { parkLearningHistory } from '../park/learningHistory';
import { generateChallengeQuestions } from './engine';
import { challengeEnabled } from './feature';
import type { ChallengeAnswer, ChallengeAwardId, ChallengeRun, ChallengeSummary } from './types';
const ownerId = crypto.randomUUID();
const sessionReleases = new Map<string, () => void>();
const sessionRunProfiles = new Map<string, string>();
export class ChallengeProfileDeletedError extends Error {
    constructor(readonly profileId: string) { super('challenge-profile-deleted'); this.name = 'ChallengeProfileDeletedError'; }
}
/** Hold an origin-wide lease across the entire countdown/run/save, not only a DB transaction. */
async function acquireSession(profileId: string) {
    if (sessionReleases.has(profileId)) throw new Error('challenge-already-active');
    if (typeof navigator === 'undefined' || !navigator.locks) throw new Error('challenge-locks-unavailable');
    await new Promise<void>((resolve, reject) => {
        void navigator.locks.request(`sansu-learning-session:${profileId}`, { ifAvailable: true }, async lock => {
            if (!lock) { reject(new Error('challenge-already-active')); return; }
            await new Promise<void>(release => { sessionReleases.set(profileId, release); resolve(); });
        }).catch(reject);
    });
}
function releaseSession(profileId: string) {
    sessionReleases.get(profileId)?.(); sessionReleases.delete(profileId);
    for (const [runId, ownerProfileId] of sessionRunProfiles) if (ownerProfileId === profileId) sessionRunProfiles.delete(runId);
}

const settingsSnapshot = (profile: import('../types').UserProfile) => JSON.stringify([profile.mathMaxUnlocked, profile.mathLevels, profile.mathStartLevel]);
export const CHALLENGE_CONTACT_SKILLS = ['add_tiny', 'add_finger', 'add_5', 'add_1d_1_bridge', 'add_1d_1', 'add_1d_2_bridge', 'add_1d_2'] as const;
async function saveContact(d: SansuDatabase, profileId: string, latestAt: string, uncertain: boolean) {
    await d.challengeContacts.bulkPut(CHALLENGE_CONTACT_SKILLS.map(itemId => ({ profileId, itemId, latestAt, uncertain })));
}
const emptySummary = (profileId: string): ChallengeSummary => ({ profileId, version: 1, best: null, completedCount: 0, awards: [], displayed: [] });
export const challengeTables = (d: SansuDatabase) => [d.challengeRuns, d.challengeEvents, d.challengeSummaries, d.challengeContacts, d.appData, d.logs, d.memoryMath];
async function eligibility(d: SansuDatabase, profileId: string) {
    const app = await d.appData.get('app');
    const profile = app?.profiles[profileId];
    if (!profile || app.activeProfileId !== profileId) return false;
    const logs = await d.logs.where('[profileId+subject]').equals([profileId, 'math']).toArray();
    return isMathSkillUnlockedForProfile('add_1d_1', profile)
        && !parkLearningHistory('math', [], logs, Date.now()).skipped.includes('add_1d_1')
        && logs.some(log => log.itemId === 'add_1d_1' && isIndependentCorrect(log));
}
export async function readChallengeHome(profileId: string, d = db) {
    return d.transaction('r', challengeTables(d), async () => {
        const runs = (await d.challengeRuns.where('profileId').equals(profileId).toArray()).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
        return { eligible: await eligibility(d, profileId), summary: await d.challengeSummaries.get(profileId) ?? emptySummary(profileId), latestRun: runs[0] ?? null, active: runs.some(run => !run.result) };
    });
}
export async function startChallenge(profileId: string, d = db): Promise<ChallengeRun> {
    if (!challengeEnabled()) throw new Error('challenge-disabled');
    await acquireSession(profileId);
    try { return await d.transaction('rw', challengeTables(d), async () => {
        if (!await eligibility(d, profileId)) throw new Error('challenge-ineligible');
        const runs = await d.challengeRuns.where('profileId').equals(profileId).toArray();
        if (runs.some(run => !run.result)) throw new Error('challenge-already-active');
        const profile = (await d.appData.get('app'))!.profiles[profileId];
        const seed = crypto.randomUUID();
        const run: ChallengeRun = { id: crypto.randomUUID(), profileId, ownerId, version: 1, challengeId: 'addition-within-10-60s', ruleVersion: 1, sourceVersion: 1, inputMode: 'digits', settingsSnapshot: settingsSnapshot(profile), seed, questions: generateChallengeQuestions(seed), createdAt: new Date().toISOString(), status: 'countdown', shownThrough: -1 };
        await d.challengeRuns.add(run);
        // Reserve a conservative contact before any question can be displayed.
        await saveContact(d, profileId, run.createdAt, true);
        return run;
    }).then(run => { sessionRunProfiles.set(run.id, profileId); return run; }); } catch (error) { releaseSession(profileId); throw error; }
}
async function owned(d: SansuDatabase, id: string) {
    const run = await d.challengeRuns.get(id);
    if (!run || run.ownerId !== ownerId) throw new Error('challenge-owner-conflict');
    const app = await d.appData.get('app');
    if (!app?.profiles[run.profileId] || app.activeProfileId !== run.profileId) throw new Error('challenge-profile-conflict');
    return run;
}
export async function markShown(id: string, questionIndex: number, d = db) {
    return d.transaction('rw', challengeTables(d), async () => {
        const run = await owned(d, id);
        if (run.result || questionIndex < 0 || questionIndex >= run.questions.length || questionIndex > run.shownThrough + 1) throw new Error('challenge-question-conflict');
        const now = new Date().toISOString();
        await d.challengeRuns.update(id, { shownThrough: Math.max(run.shownThrough, questionIndex), status: 'running', startedAt: run.startedAt ?? now });
        await saveContact(d, run.profileId, now, true);
    });
}
async function append(d: SansuDatabase, run: ChallengeRun, event: ChallengeAnswer) {
    const q = run.questions[event.questionIndex];
    if (!q || q.id !== event.questionId || event.questionIndex > run.shownThrough || !Number.isFinite(event.elapsedMs) || event.elapsedMs < 0 || event.elapsedMs >= 60000) throw new Error('challenge-event-invalid');
    if (event.answer !== null && (!Number.isSafeInteger(event.answer) || event.answer < 0)) throw new Error('challenge-answer-invalid');
    const outcome = event.answer === null ? 'skipped' : event.answer === q.answer ? 'correct' : 'incorrect';
    if (outcome !== event.outcome) throw new Error('challenge-score-invalid');
    const key = `${run.id}:${event.questionIndex}`;
    const existing = await d.challengeEvents.get(key);
    if (existing) {
        if (existing.answer !== event.answer || existing.elapsedMs !== event.elapsedMs) throw new Error('challenge-event-conflict');
        return;
    }
    const events = await d.challengeEvents.where('runId').equals(run.id).toArray();
    if (event.questionIndex !== events.length || (events.length && event.elapsedMs < Math.max(...events.map(e => e.elapsedMs)) + 300)) throw new Error('challenge-event-order');
    await d.challengeEvents.add({ ...event, key, runId: run.id, profileId: run.profileId });
}
export async function appendChallengeAnswer(id: string, event: ChallengeAnswer, d = db) {
    return d.transaction('rw', challengeTables(d), async () => { const run = await owned(d, id); if (!run.result) await append(d, run, event); });
}
export async function finishChallenge(id: string, events: ChallengeAnswer[], elapsedMs: number, d = db) {
    return d.transaction('rw', challengeTables(d), async () => {
        const run = await owned(d, id);
        if (run.result) return run.result;
        for (const event of events) await append(d, run, event);
        if (elapsedMs < 60000 || !Number.isFinite(elapsedMs) || !run.startedAt) throw new Error('challenge-not-finished');
        const profile = (await d.appData.get('app'))!.profiles[run.profileId];
        return complete(d, run, await eligibility(d, run.profileId) && settingsSnapshot(profile) === run.settingsSnapshot, 'challenge-settings-changed');
    }).then(async result => { const run = await d.challengeRuns.get(id); if (run) releaseSession(run.profileId); return result; });
}
async function complete(d: SansuDatabase, run: ChallengeRun, official: boolean, reason?: string) {
    const events = await d.challengeEvents.where('runId').equals(run.id).toArray();
    const correct = events.filter(e => e.outcome === 'correct').length;
    const summary = await d.challengeSummaries.get(run.profileId) ?? emptySummary(run.profileId);
    const finishedAt = new Date().toISOString();
    const newAwards: ChallengeAwardId[] = [];
    const improved = official && summary.best !== null && correct > summary.best;
    if (official) {
        summary.completedCount++;
        if (summary.best === null || correct > summary.best) { summary.best = correct; summary.bestRunId = run.id; }
        for (const id of ['certificate', ...(correct >= 10 ? ['trophy'] : [])] as ChallengeAwardId[]) {
            if (!summary.awards.some(a => a.id === id)) { summary.awards.push({ id, acquiredAt: finishedAt, correct, runId: run.id }); newAwards.push(id); }
        }
        await d.challengeSummaries.put(summary);
    }
    const result = { correct, incorrect: events.filter(e => e.outcome === 'incorrect').length, skipped: events.filter(e => e.outcome === 'skipped').length, official, ...(official ? {} : { reason }), newAwards, best: summary.best, improved, finishedAt };
    await d.challengeRuns.update(run.id, { status: official ? 'result' : 'interrupted', result });
    // Ending the run establishes a latest upper bound even for a failed contact write.
    await saveContact(d, run.profileId, finishedAt, false);
    const history = (await d.challengeRuns.where('profileId').equals(run.profileId).toArray()).filter(r => r.result).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    for (const old of history.slice(20)) { await d.challengeEvents.where('runId').equals(old.id).delete(); await d.challengeRuns.delete(old.id); }
    return result;
}
export async function interruptChallenge(id: string, reason: string, d = db) {
    return d.transaction('rw', challengeTables(d), async () => {
        const run = await d.challengeRuns.get(id);
        const app = await d.appData.get('app');
        const knownProfileId = sessionRunProfiles.get(id);
        if (!run && knownProfileId && !app?.profiles[knownProfileId]) throw new ChallengeProfileDeletedError(knownProfileId);
        if (!run || run.ownerId !== ownerId) throw new Error('challenge-owner-conflict');
        if (!app?.profiles[run.profileId]) throw new ChallengeProfileDeletedError(run.profileId);
        if (run.result) return run.result;
        return complete(d, run, false, reason);
    }).then(async result => {
        const profileId = sessionRunProfiles.get(id) ?? (await d.challengeRuns.get(id))?.profileId;
        if (profileId) releaseSession(profileId);
        return result;
    }).catch(error => {
        if (error instanceof ChallengeProfileDeletedError && sessionRunProfiles.get(id) === error.profileId) releaseSession(error.profileId);
        throw error;
    });
}
export async function recoverChallenge(profileId: string, d = db) {
    await acquireSession(profileId);
    try { return await d.transaction('rw', challengeTables(d), async () => {
        const app = await d.appData.get('app');
        if (app?.activeProfileId !== profileId || !app.profiles[profileId]) return null;
        const runs = (await d.challengeRuns.where('profileId').equals(profileId).toArray()).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
        const run = runs[0];
        if (!run) return null;
        if (!run.result) { run.result = await complete(d, run, false, 'reload'); run.status = 'interrupted'; }
        return run;
    }); } finally { releaseSession(profileId); }
}
export async function setChallengeAwardDisplayed(profileId: string, id: ChallengeAwardId, displayed: boolean, d = db) {
    return d.transaction('rw', challengeTables(d), async () => {
        const app = await d.appData.get('app');
        if (app?.activeProfileId !== profileId) throw new Error('challenge-profile-conflict');
        const summary = await d.challengeSummaries.get(profileId);
        if (!summary?.awards.some(award => award.id === id)) throw new Error('challenge-award-unowned');
        summary.displayed = summary.displayed.filter(awardId => awardId !== id);
        if (displayed) summary.displayed.push(id);
        await d.challengeSummaries.put(summary);
        return summary;
    });
}
