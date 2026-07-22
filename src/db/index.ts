import Dexie, { type DexieOptions, type Table } from 'dexie';
import type { UserProfile, MemoryState, AppData } from '../domain/types';
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

export class SansuDatabase extends Dexie {
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
    }
}

export const db = new SansuDatabase();
