import { describe, expect, it } from 'vitest';
import { advanceLearningShow, learningShowLevel, type LearningShow } from './learningShow';
import type { IslandLearningFeedback } from './learningFeedback';

describe('the learning stage progresses independently from the streak', () => {
    const receipt = (id: string, kind: IslandLearningFeedback['kind']): IslandLearningFeedback => ({ id, kind, text: '' });
    it('counts each completed receipt once including assistance, never intermediate rows or mistakes', () => {
        let show: LearningShow = { completed: 0 };
        for (const item of [receipt('a', 'correct'), receipt('a', 'correct'), receipt('b', 'step'), receipt('c', 'retry'), receipt('d', 'support'), receipt('e', 'supported'), receipt('f', 'correct')]) show = advanceLearningShow(show, item);
        expect(show.completed).toBe(3);
        expect(learningShowLevel(show.completed)).toBe(1);
        show = advanceLearningShow(show, receipt('g', 'retry'));
        expect(show.completed).toBe(3);
    });
    it('caps persistent visual density even during an unbounded session', () => {
        let show: LearningShow = { completed: 0 };
        for (let i = 0; i < 100; i++) show = advanceLearningShow(show, receipt(String(i), 'correct'));
        expect(show.completed).toBe(9);
        expect(learningShowLevel(show.completed)).toBe(3);
    });
});
