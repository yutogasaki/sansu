import Dexie, { Table } from 'dexie';
import { UserProfile, MemoryState, AppData } from '../domain/types';

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
}

export class SansuDatabase extends Dexie {
    profiles!: Table<UserProfile, string>; // id is UUID string
    logs!: Table<AttemptLog, number>;      // id is auto-increment

    // Memory tables: Keyed by composite [profileId, id]
    // properly mapped to the MemoryState type
    memoryMath!: Table<MemoryState, [string, string]>;
    memoryVocab!: Table<MemoryState, [string, string]>;
    appData!: Table<AppData & { id: string }, string>;

    constructor() {
        super('SansuDatabase');

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
    }
}

export const db = new SansuDatabase();
