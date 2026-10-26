import type { KokugoCourse, KokugoProgress, KokugoPlan, KokugoEvent, KokugoOutbox, KokugoWork } from '../domain/kokugo/types';
import type { FoundationCourseRecord, FoundationOwner, FoundationProgress, FoundationPlan, FoundationEvent, FoundationOutbox } from '../domain/englishFoundation/types';
import type { ChallengeRun, ChallengeEvent, ChallengeSummary, ChallengeContact } from '../domain/challenge/types';
import Dexie, { type DexieOptions, type Table } from 'dexie';
import type { UserProfile, MemoryState, AppData } from '../domain/types';
import type { LearningEvidenceContext } from '../domain/learning/types';
import type { ParkRecord, ParkPlan, ParkEvent } from '../domain/park/types';
import type { IslandRecord, IslandPlan, IslandEvent } from '../domain/island/types';
import type { IslandPhotoAlbum, IslandPhotoMetadata, IslandPhotoBlobRecord } from '../domain/island/photos';
import type {
    ExploreDiscoveryRecord,
    ExploreRunEventRecord,
    ExploreRunRecord,
} from '../domain/explore/persistenceTypes';

// We need a flattened version of MemoryState for the DB index efficiency if needed,
// but Dexie handles objects well. However, composite keys [profileId+itemId] are useful.

export interface AttemptLog {
    id?: number; // Auto-increment
    profileId: string;
    subject: 'math' | 'vocab';
    itemId: string; // skillId or wordId
    result: 'correct' | 'incorrect' | 'skipped';
    skipped?: boolean;
    isReview?: boolean;
    timestamp: string; // ISO
    timeMs?: number; // 回答にかかった時間（ミリ秒）
    learningEvidence?: LearningEvidenceContext;
}

export const SANSU_V4_STORES = {
    profiles: '&id',
    logs: '++id, profileId, subject, [profileId+subject], timestamp, [profileId+timestamp]',
    memoryMath: '[profileId+id], profileId, nextReview, [profileId+nextReview], strength, status',
    memoryVocab: '[profileId+id], profileId, nextReview, [profileId+nextReview], strength',
    appData: '&id',
} as const;

export const SANSU_V5_STORES = {
    ...SANSU_V4_STORES,
    exploreRuns: '&runId, profileId, [profileId+status], startedAt, status',
    exploreRunEvents: '++id, &attemptKey, profileId, runId, [profileId+runId], timestamp, type',
    exploreDiscoveries: '[profileId+discoveryId], profileId, kind, firstFoundAt',
} as const;

export const SANSU_V6_STORES = {
    ...SANSU_V5_STORES,
    parks: '&profileId',
    parkPlans: '&id, profileId, [profileId+status]',
    parkEvents: '&id, profileId, planId, type, timestamp',
} as const;

export const SANSU_V7_STORES = {
    ...SANSU_V6_STORES,
    islands: '&profileId',
    islandPlans: '&id, profileId, [profileId+status]',
    islandEvents: '&id, profileId, planId, type, timestamp',
} as const;

export const SANSU_V8_STORES = {
    ...SANSU_V7_STORES,
    islandPhotoAlbums: '&profileId',
    islandPhotos: '&id, profileId, [profileId+capturedAt]',
    islandPhotoBlobs: '&id, profileId',
} as const;

export const SANSU_V9_STORES = { ...SANSU_V8_STORES,
    challengeRuns: '&id, profileId, [profileId+status], createdAt',
    challengeEvents: '&key, profileId, runId',
    challengeSummaries: '&profileId',
    challengeContacts: '[profileId+itemId], profileId',
} as const;

export const SANSU_V10_STORES = { ...SANSU_V9_STORES,
    foundationCourses: '&profileId',
    foundationOwners: '&profileId',
    foundationProgress: '[profileId+id], profileId',
    foundationPlans: '&id, profileId, [profileId+status]',
    foundationEvents: '&id, profileId, planId',
    foundationOutbox: '&completionId, profileId',
} as const;

export const SANSU_V11_STORES = { ...SANSU_V10_STORES,
    kokugoCourses: '&profileId',
    kokugoProgress: '[profileId+id], profileId',
    kokugoPlans: '&id, profileId, [profileId+status]',
    kokugoEvents: '&id, profileId, planId',
    kokugoOutbox: '&completionId, profileId',
    kokugoWorks: '&id, profileId, unitId',
} as const;

export class SansuDatabase extends Dexie {
    kokugoCourses!: Table<KokugoCourse, string>;
    kokugoProgress!: Table<KokugoProgress, [string, string]>;
    kokugoPlans!: Table<KokugoPlan, string>;
    kokugoEvents!: Table<KokugoEvent, string>;
    kokugoOutbox!: Table<KokugoOutbox, string>;
    kokugoWorks!: Table<KokugoWork, string>;
    foundationCourses!: Table<FoundationCourseRecord, string>;
    foundationOwners!: Table<FoundationOwner, string>;
    foundationProgress!: Table<FoundationProgress, [string, string]>;
    foundationPlans!: Table<FoundationPlan, string>;
    foundationEvents!: Table<FoundationEvent, string>;
    foundationOutbox!: Table<FoundationOutbox, string>;
    challengeRuns!: Table<ChallengeRun, string>;
    challengeEvents!: Table<ChallengeEvent, string>;
    challengeSummaries!: Table<ChallengeSummary, string>;
    challengeContacts!: Table<ChallengeContact, [string, string]>;
    islandPhotoAlbums!: Table<IslandPhotoAlbum, string>;
    islandPhotos!: Table<IslandPhotoMetadata, string>;
    islandPhotoBlobs!: Table<IslandPhotoBlobRecord, string>;
    islands!: Table<IslandRecord, string>;
    islandPlans!: Table<IslandPlan, string>;
    islandEvents!: Table<IslandEvent, string>;
    parks!: Table<ParkRecord, string>;
    parkPlans!: Table<ParkPlan, string>;
    parkEvents!: Table<ParkEvent, string>;
    profiles!: Table<UserProfile, string>; // id is UUID string
    logs!: Table<AttemptLog, number>;      // id is auto-increment

    // Memory tables: Keyed by composite [profileId, id]
    // properly mapped to the MemoryState type
    memoryMath!: Table<MemoryState, [string, string]>;
    memoryVocab!: Table<MemoryState, [string, string]>;
    appData!: Table<AppData & { id: string }, string>;
    exploreRuns!: Table<ExploreRunRecord, string>;
    exploreRunEvents!: Table<ExploreRunEventRecord, number>;
    exploreDiscoveries!: Table<ExploreDiscoveryRecord, [string, string]>;

    constructor(databaseName = 'SansuDatabase', options?: DexieOptions) {
        super(databaseName, options);

        // Define Schema
        // We list fields that we want to Index.
        // & = unique primary key
        // [A+B] = compound primary key
        // * = multi-entry index
        this.version(1).stores({
            profiles: '&id', // Simple UUID key
            logs: '++id, profileId, subject, [profileId+subject], timestamp',
            memoryMath: '[profileId+id], nextReview, strength, status', // Compound key: User + Skill
            memoryVocab: '[profileId+id], nextReview, strength'        // Compound key: User + Word
        });

        this.version(2).stores({
            profiles: '&id',
            logs: '++id, profileId, subject, [profileId+subject], timestamp',
            memoryMath: '[profileId+id], nextReview, strength, status',
            memoryVocab: '[profileId+id], nextReview, strength',
            appData: '&id'
        });

        this.version(3).stores({
            profiles: '&id',
            logs: '++id, profileId, subject, [profileId+subject], timestamp',
            memoryMath: '[profileId+id], profileId, nextReview, strength, status',
            memoryVocab: '[profileId+id], profileId, nextReview, strength',
            appData: '&id'
        });

        this.version(4).stores(SANSU_V4_STORES);

        this.version(5).stores(SANSU_V5_STORES);
        this.version(6).stores(SANSU_V6_STORES);
        this.version(7).stores(SANSU_V7_STORES);
        // Additive only: existing learning, island and receipt rows are untouched.
        this.version(8).stores(SANSU_V8_STORES);
        this.version(9).stores(SANSU_V9_STORES);
        this.version(11).stores(SANSU_V11_STORES);
        this.version(10).stores(SANSU_V10_STORES).upgrade(async tx => {
            const profiles = await tx.table('profiles').toArray();
            await tx.table('foundationCourses').bulkPut(profiles.map(p => ({ profileId: p.id, course: 'vocabulary', unit: 'F01' })));
        });
    }
}

export const db = new SansuDatabase();
