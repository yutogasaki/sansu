import { describe, it, expect } from 'vitest';
import { updateMemoryState, updateSkillStatus } from './algorithms/srs';
import { MemoryState, UserProfile } from './types';
import { syncLevelState, createInitialProfile } from './user/profile';
import { checkEnglishLevelProgression } from './english/service';
import { ENGLISH_WORDS } from './english/words';
import { generateSessionQueue } from './sessionManager';

// Mock types
const mockState = (id: string, strength: number, status: any = undefined): MemoryState => ({
    id,
    strength: strength as any,
    nextReview: new Date().toISOString(),
    totalAnswers: 10,
    correctAnswers: 10,
    incorrectAnswers: 0,
    skippedAnswers: 0,
    updatedAt: new Date().toISOString(),
    status
});

describe('SRS Algorithm', () => {
    describe('updateMemoryState', () => {
        it('should increase strength on correct answer', () => {
            const initial = mockState('1', 1);
            const next = updateMemoryState(initial, true);
            expect(next.strength).toBe(2);
        });

        it('should decrease strength by 2 on incorrect answer (min 1)', () => {
            const initial = mockState('1', 4);
            const next = updateMemoryState(initial, false);
            expect(next.strength).toBe(2); // 4 - 2 = 2
        });
    });

    describe('updateSkillStatus (Math)', () => {
        it('should retire active skill if enough correct answers', () => {
            // 30 answers, recent 90% correct
            const state = { ...mockState('1', 1, 'active'), totalAnswers: 35 };
            const recent = [true, true, true, true, true, true, true, true, true, false];
            const next = updateSkillStatus(state, recent);
            expect(next).toBe('retired');
        });

        it('should keep retired skill on single failure', () => {
            const state = { ...mockState('1', 5, 'retired'), totalAnswers: 100 };
            // Recent failure
            const recent = [false];
            const next = updateSkillStatus(state, recent);
            expect(next).toBe('retired');
        });

        it('should reactivate retired skill on two consecutive failures', () => {
            const state = { ...mockState('1', 5, 'retired'), totalAnswers: 100 };
            const recent = [false, false];
            const next = updateSkillStatus(state, recent);
            expect(next).toBe('active');
        });
    });
});

describe('Manual Level Consistency (syncLevelState)', () => {
    // Helper to generic profile
    const getProfile = (): UserProfile => createInitialProfile("Test", 1, 1, 1, 'mix');

    it('should unlock levels when leveling up manually (Math)', () => {
        const profile = getProfile();
        // Init: Main=2 (Start=1)
        const updated = syncLevelState(profile, 'math', 5);

        expect(updated.mathMainLevel).toBe(5);
        expect(updated.mathMaxUnlocked).toBe(5);

        // Level 4 check
        const l4 = updated.mathLevels?.find(l => l.level === 4);
        expect(l4?.unlocked).toBe(true);
        expect(l4?.enabled).toBe(true);
    });

    it('should disable higher levels when leveling down manually (Math)', () => {
        let profile = getProfile();
        profile = syncLevelState(profile, 'math', 5); // Up to 5

        // Downgrade to 3
        const downgraded = syncLevelState(profile, 'math', 3);

        expect(downgraded.mathMainLevel).toBe(3);

        // Level 4 should be disabled but remain unlocked
        const l4 = downgraded.mathLevels?.find(l => l.level === 4);
        expect(l4?.unlocked).toBe(true); // Still unlocked
        expect(l4?.enabled).toBe(false); // Disabled
    });

    it('should Sync English levels similarly', () => {
        let profile = getProfile();
        profile = syncLevelState(profile, 'vocab', 4);
        expect(profile.vocabMainLevel).toBe(4);

        const l3 = profile.vocabLevels?.find(l => l.level === 3);
        expect(l3?.unlocked).toBe(true);
    });
});

describe('English Level Progression', () => {
    it('should promote level if 70% of words attempted', async () => {
        // Mock profile with level 1 words attempted
        const profile = createInitialProfile("Test", 1, 1, 1, 'vocab');
        profile.vocabMaxUnlocked = 1;

        // Count words in Level 1
        const level1Words = ENGLISH_WORDS.filter(w => w.level === 1);
        const targetCount = Math.ceil(level1Words.length * 0.75); // 75% > 70%

        // Build memory override (テスト用: DBの代わりにMapを渡す)
        const memoryOverride: Record<string, MemoryState> = {};
        for (let i = 0; i < targetCount; i++) {
            const word = level1Words[i];
            memoryOverride[word.id] = { ...mockState(word.id, 1), totalAnswers: 1 };
        }

        const shouldLevelUp = await checkEnglishLevelProgression(profile, memoryOverride);
        expect(shouldLevelUp).toBe(true);
    });

    it('should NOT promote level if < 70% of words attempted', async () => {
        const profile = createInitialProfile("Test", 1, 1, 1, 'vocab');
        profile.vocabMaxUnlocked = 1;

        // 0 attempted (empty override)
        const shouldLevelUp = await checkEnglishLevelProgression(profile, {});
        expect(shouldLevelUp).toBe(false);
    });
});

describe('Session Queue Generation', () => {
    it('should generate full queue even with few skills (Duplication Logic)', () => {
        // Create profile at Level 1 Math
        const profile = createInitialProfile("Test", 1, 0, 1, 'math');
        // mathStartLevel=0 -> mathMainLevel=1. Level 1 has only 'count_10' skill.

        const queue = generateSessionQueue(profile, 5); // Request 5

        expect(queue.length).toBe(5);
        // All should be 'count_10' probably? Or other level 1 skills?
        // Let's check IDs
        // Assuming Level 1 has only 1 skill.
        // It should contain duplicates.
        const ids = queue.map(q => q.categoryId);
        // If unique count < queue length, we have duplicates.
        const unique = new Set(ids);
        if (unique.size < queue.length) {
            // Good: Duplicates allowed to fill queue
            expect(true).toBe(true);
        } else {
            // Maybe enough skills?
            // Level 1: 'count_10'? 
            // If 'count_10', 'count_50' in Level 2?
            // If MainLevel=1, only 'count_10' is available.
            // So unique.size SHOULD constitute duplication.
            // Unless generateSessionQueue falls back to random?
            // But 'count_10' is only candidate.
            expect(unique.size).toBe(1); // Should match number of available skills
        }
    });

    it('should respect subject overrides', () => {
        const profile = createInitialProfile("Test", 1, 1, 1, 'vocab');
        // subjectMode = vocab
        const queue = generateSessionQueue(profile, 5);
        expect(queue[0].subject).toBe('vocab');
    });
});
