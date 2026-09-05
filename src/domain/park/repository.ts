import { db, type SansuDatabase } from '../../db';
import { getLearningAttemptTransactionTables } from '../learningAttemptWriter';
import { assertPark, courseLayout, createPark, editPark } from './course';
import { planParkLearning } from './learning';
import { PART_KINDS, type ParkEdit, type ParkEvent, type ParkRecord, type PartKind } from './types';

export class ParkConflict extends Error {}
export const parkTables = (database: SansuDatabase) => [
    ...getLearningAttemptTransactionTables(database), database.parks, database.parkPlans, database.parkEvents,
];

export async function ownedPark(database: SansuDatabase, profileId: string) {
    const app = await database.appData.get('app');
    if (app?.activeProfileId !== profileId || !app.profiles[profileId]) throw new ParkConflict('Profile changed');
    const park = await database.parks.get(profileId);
    if (!park) throw new ParkConflict('Park missing');
    assertPark(park);
    return { park, profile: app.profiles[profileId] };
}

export async function openPark(profileId: string, database = db): Promise<ParkRecord> {
    return database.transaction('rw', parkTables(database), async () => {
        const app = await database.appData.get('app');
        if (!app?.profiles[profileId] || app.activeProfileId !== profileId) throw new ParkConflict('Profile changed');
        let park = await database.parks.get(profileId);
        if (!park) {
            park = createPark(profileId, Date.now());
            await database.parks.add(park);
        }
        assertPark(park);
        return park;
    });
}

export async function saveParkEdit(profileId: string, revision: number, edit: ParkEdit, database = db) {
    return database.transaction('rw', parkTables(database), async () => {
        const { park } = await ownedPark(database, profileId);
        if (park.revision !== revision) throw new ParkConflict('Course changed in another tab');
        const updated = { ...editPark(park, edit), revision: park.revision + 1, updatedAt: Date.now() };
        await database.parks.put(updated);
        return updated;
    });
}

export async function startParkPlan(profileId: string, partKind: PartKind, database = db) {
    return database.transaction('rw', parkTables(database), async () => {
        const { park, profile } = await ownedPark(database, profileId);
        // The first reservation wins, irrespective of later game choices.
        if (park.pendingPlanId) {
            const pending = await database.parkPlans.get(park.pendingPlanId);
            if (!pending || pending.profileId !== profileId || pending.schemaVersion !== 1 || pending.status !== 'active') throw new ParkConflict('Invalid pending plan');
            return pending;
        }
        if (!PART_KINDS.includes(partKind)) throw new Error('Unknown part');
        const id = JSON.stringify(['park-plan-v1', profileId, park.completedPlans]);
        const [math, vocab, logs] = await Promise.all([
            database.memoryMath.where('profileId').equals(profileId).toArray(),
            database.memoryVocab.where('profileId').equals(profileId).toArray(),
            database.logs.where('profileId').equals(profileId).toArray(),
        ]);
        const now = Date.now();
        const mergeMemory = (legacy: typeof profile.mathSkills, rows: typeof math) => Object.values({ ...legacy, ...Object.fromEntries(rows.map(m => [m.id, m])) });
        const learning = planParkLearning(profile, mergeMemory(profile.mathSkills, math), mergeMemory(profile.vocabWords, vocab), logs, park.completedPlans, id, now);
        const plan = {
            id, profileId, schemaVersion: 1 as const, plannerVersion: 'park-learning-v1' as const,
            ...learning, partKind, rewardId: `${id}:part`, status: 'active' as const,
            cursor: 0, revision: 0, startedAt: now,
        };
        await database.parkPlans.add(plan);
        await database.parks.put({ ...park, pendingPlanId: id, revision: park.revision + 1, updatedAt: now });
        await database.parkEvents.add({ id: `${id}:started`, profileId, planId: id, type: 'plan_started', timestamp: now });
        return plan;
    });
}

export async function recordParkVisit(
    profileId: string,
    id: string,
    type: Extract<ParkEvent['type'], 'replay_started' | 'replay_completed' | 'learning_resumed'>,
    courseId: string,
    database = db,
) {
    return database.transaction('rw', parkTables(database), async () => {
        const { park } = await ownedPark(database, profileId);
        const prior = await database.parkEvents.get(id);
        if (prior) {
            if (prior.profileId !== profileId || prior.type !== type || prior.courseId !== courseId) throw new ParkConflict('Visit conflict');
            return prior;
        }
        const event: ParkEvent = { id, profileId, type, courseId, timestamp: Date.now(),
            planId: type === 'learning_resumed' ? park.pendingPlanId : undefined,
            layout: type === 'replay_started' ? courseLayout(park, courseId) : undefined };
        await database.parkEvents.add(event);
        return event;
    });
}
