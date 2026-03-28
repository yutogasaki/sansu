import { describe, it, expect } from 'vitest';
import { updateMemoryState, updateSkillStatus } from './algorithms/srs';
import { MemoryState, UserProfile, RecentAttempt, SkillStatus } from './types';
import { syncLevelState, createInitialProfile } from './user/profile';
import { checkEnglishLevelProgression } from './english/service';
import { ENGLISH_WORDS } from './english/words';
import { generateSessionQueue, isWeakByRecentAttempts } from './sessionManager';
import { getInitialNextReviewIso } from './learningRepository';
import { getLearningDayStart } from '../utils/learningDay';
import { buildVocabCooldownIds } from '../hooks/blockGenerators';
import { getLevelStartTimestamp } from './test/trigger';
import { getMathSkillFamily, getMathSkillMetadata, getSkillsForLevel } from './math/curriculum';

const mockState = (id: string, strength: number, status?: SkillStatus): MemoryState => ({
    id,
    strength,
    nextReview: new Date().toISOString(),
    totalAnswers: 10,
    correctAnswers: 10,
    incorrectAnswers: 0,
    skippedAnswers: 0,
    updatedAt: new Date().toISOString(),
    status,
});

describe('SRS Algorithm', () => {
    describe('updateMemoryState', () => {
        it('should increase strength on correct answer', () => {
            const initial = mockState('1', 1);
            const next = updateMemoryState(initial, true);
            expect(next.strength).toBe(2);
        });

        it('should decrease strength by 1 on incorrect answer (min 1)', () => {
            const initial = mockState('1', 4);
            const next = updateMemoryState(initial, false);
            expect(next.strength).toBe(3); // 4 - 1 = 3
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
        // Use a level with a single skill so the queue has to duplicate.
        const profile = createInitialProfile("Test", 1, 0, 1, 'math');
        profile.mathMainLevel = 28;
        profile.mathMaxUnlocked = 28;

        const queue = generateSessionQueue(profile, 5); // Request 5

        expect(queue.length).toBe(5);
        const ids = queue.map(q => q.categoryId);
        const unique = new Set(ids);
        if (unique.size < queue.length) {
            expect(true).toBe(true);
        } else {
            expect(unique.size).toBe(1);
        }
    });

    it('should respect subject overrides', () => {
        const profile = createInitialProfile("Test", 1, 1, 1, 'vocab');
        // subjectMode = vocab
        const queue = generateSessionQueue(profile, 5);
        expect(queue[0].subject).toBe('vocab');
    });

    it('keeps level 0 math queues inside level 0 skills and soft-spreads families', () => {
        const profile = createInitialProfile("Test", 1, 0, 1, 'math');
        profile.mathMainLevel = 0;
        profile.mathMaxUnlocked = 0;

        const queue = generateSessionQueue(profile, 2);
        const level0Skills = new Set(getSkillsForLevel(0));

        expect(queue).toHaveLength(2);
        expect(queue.every(item => level0Skills.has(item.categoryId))).toBe(true);
        expect(getMathSkillFamily(queue[0].categoryId)).not.toBe(getMathSkillFamily(queue[1].categoryId));
    });

    it('boosts bridge skills after a recent symbolic miss', () => {
        const profile = createInitialProfile("Test", 1, 0, 1, 'math');
        profile.mathMainLevel = 9;
        profile.mathMaxUnlocked = 9;
        profile.mathSkills['add_1d_2'] = {
            ...mockState('add_1d_2', 2, 'active'),
            nextReview: new Date(2099, 0, 1).toISOString(),
        };
        profile.mathSkills['add_1d_2_bridge'] = {
            ...mockState('add_1d_2_bridge', 2, 'active'),
            nextReview: new Date(2099, 0, 1).toISOString(),
        };
        profile.recentAttempts = [
            {
                id: 'attempt-1',
                timestamp: new Date(2026, 2, 28, 9, 0, 0).toISOString(),
                subject: 'math',
                skillId: 'add_1d_2',
                result: 'incorrect',
            },
        ];

        const queue = generateSessionQueue(profile, 1);

        expect(queue).toHaveLength(1);
        expect(queue[0]?.categoryId).toBe('add_1d_2_bridge');
    });

    it('boosts bridge follow-up after a recent concrete success', () => {
        const profile = createInitialProfile("Test", 1, 0, 1, 'math');
        profile.mathMainLevel = 8;
        profile.mathMaxUnlocked = 8;
        profile.mathSkills['add_1d_1'] = {
            ...mockState('add_1d_1', 2, 'active'),
            nextReview: new Date(2099, 0, 1).toISOString(),
        };
        profile.mathSkills['add_1d_1_bridge'] = {
            ...mockState('add_1d_1_bridge', 2, 'active'),
            nextReview: new Date(2099, 0, 1).toISOString(),
        };
        profile.recentAttempts = [
            {
                id: 'attempt-concrete-1',
                timestamp: new Date(2026, 2, 28, 8, 55, 0).toISOString(),
                subject: 'math',
                skillId: 'add_tiny',
                result: 'correct',
            },
        ];

        const queue = generateSessionQueue(profile, 1);

        expect(queue).toHaveLength(1);
        expect(queue[0]?.categoryId).toBe('add_1d_1_bridge');
    });

    it('falls back to concrete after a recent bridge miss', () => {
        const profile = createInitialProfile("Test", 1, 0, 1, 'math');
        profile.mathMainLevel = 8;
        profile.mathMaxUnlocked = 8;
        profile.mathSkills['add_1d_1'] = {
            ...mockState('add_1d_1', 2, 'active'),
            nextReview: new Date(2099, 0, 1).toISOString(),
        };
        profile.mathSkills['add_1d_1_bridge'] = {
            ...mockState('add_1d_1_bridge', 2, 'active'),
            nextReview: new Date(2099, 0, 1).toISOString(),
        };
        profile.recentAttempts = [
            {
                id: 'attempt-bridge-1',
                timestamp: new Date(2026, 2, 28, 9, 2, 0).toISOString(),
                subject: 'math',
                skillId: 'add_1d_1_bridge',
                result: 'incorrect',
            },
        ];

        const queue = generateSessionQueue(profile, 1);

        expect(queue).toHaveLength(1);
        expect(queue[0]?.categoryId).toBe('add_tiny');
    });

    it('boosts symbolic follow-up after a recent bridge success', () => {
        const profile = createInitialProfile("Test", 1, 0, 1, 'math');
        profile.mathMainLevel = 9;
        profile.mathMaxUnlocked = 9;
        profile.mathSkills['add_1d_2'] = {
            ...mockState('add_1d_2', 2, 'active'),
            nextReview: new Date(2099, 0, 1).toISOString(),
        };
        profile.mathSkills['add_1d_2_bridge'] = {
            ...mockState('add_1d_2_bridge', 2, 'active'),
            nextReview: new Date(2099, 0, 1).toISOString(),
        };
        profile.recentAttempts = [
            {
                id: 'attempt-2',
                timestamp: new Date(2026, 2, 28, 9, 5, 0).toISOString(),
                subject: 'math',
                skillId: 'add_1d_2_bridge',
                result: 'correct',
            },
        ];

        const queue = generateSessionQueue(profile, 1);

        expect(queue).toHaveLength(1);
        expect(queue[0]?.categoryId).toBe('add_1d_2');
    });
});

describe('Math Skill Metadata', () => {
    it('defines bridge fallback metadata for early symbolic skills', () => {
        expect(getMathSkillMetadata('add_1d_2')).toMatchObject({
            family: 'addition-basic',
            representation: 'symbol',
            reviewFallbackSkillIds: ['add_1d_2_bridge'],
        });
        expect(getMathSkillMetadata('add_1d_2_bridge')).toMatchObject({
            family: 'addition-basic',
            representation: 'bridge',
            sameConceptSkillIds: ['add_finger', 'add_1d_1_bridge', 'add_1d_2'],
        });
        expect(getMathSkillMetadata('add_1d_1_bridge')).toMatchObject({
            reviewFallbackSkillIds: ['add_tiny', 'add_finger'],
        });
    });
});

describe('Regression Guards', () => {
    it('uses latest attempts for weak judgement', () => {
        const attempts: RecentAttempt[] = [];
        for (let i = 0; i < 10; i++) {
            attempts.push({
                id: `old-${i}`,
                timestamp: new Date(2025, 0, i + 1).toISOString(),
                subject: 'math',
                skillId: 'skill-a',
                result: 'incorrect'
            });
        }
        for (let i = 0; i < 10; i++) {
            attempts.push({
                id: `new-${i}`,
                timestamp: new Date(2025, 1, i + 1).toISOString(),
                subject: 'math',
                skillId: 'skill-a',
                result: 'correct'
            });
        }

        expect(isWeakByRecentAttempts('skill-a', attempts)).toBe(false);
    });

    it('sets initial next review to today when skipped', () => {
        expect(getInitialNextReviewIso(1, true)).toBe(getLearningDayStart().toISOString());
    });

    it('excludes skipped vocab attempts from cooldown source', () => {
        const ids = buildVocabCooldownIds(
            [
                { subject: 'vocab', itemId: 'apple', result: 'skipped' },
                { subject: 'vocab', itemId: 'cat', result: 'correct' },
            ],
            []
        );
        expect(ids).toEqual(['cat']);
    });

    it('uses explicit main level start timestamp when available', () => {
        const profile = createInitialProfile('T', 1, 1, 1, 'mix');
        profile.mathMainLevelStartedAt = '2025-01-15T00:00:00.000Z';
        profile.recentAttempts = [
            {
                id: 'a1',
                timestamp: '2025-01-20T00:00:00.000Z',
                subject: 'math',
                skillId: 'count_10',
                result: 'correct'
            }
        ];

        const ts = getLevelStartTimestamp(profile, 'math', ['count_10'], profile.mathMainLevelStartedAt, undefined);
        expect(new Date(ts).toISOString()).toBe('2025-01-15T00:00:00.000Z');
    });
});
