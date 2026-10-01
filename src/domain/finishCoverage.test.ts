import { describe, expect, it } from 'vitest';
import type { AttemptLog } from '../db';
import { createInitialProfile } from './user/profile';
import { evaluateFinishCoverage, finishContentKey, FINISH_EVIDENCE_FRESHNESS_MS } from './finishCoverage';
import { createSeededRandom } from '../utils/random';
import { generateMathProblem } from './math';
import { generateVocabProblem } from './english/generator';
import { createLearningProblemContext } from './learning/context';
import { learningEvidenceForProblem } from './learning/attemptContext';
import { getSkillsForLevel } from './math/curriculum';
import { getWordsByLevel } from './english/words';
import { finishEligibility } from './finishTest';
import type { UserProfile } from './types';
const NOW = '2026-10-01T12:00:00.000Z';
function mathProfile(level: number) {
    const p = createInitialProfile('T', 1, level, 1, 'math');
    return { ...p, mathMainLevel: level, mathMaxUnlocked: level };
}
function mathLogs(profile: UserProfile, skill: string, count: number, seed: string, override?: { questionText: string; correctAnswer: string }) {
    const random = createSeededRandom(seed);
    return Array.from({ length: count }, (_, index): AttemptLog => {
        const generated = generateMathProblem(skill, { random });
        const problem = { ...generated, ...override, subject: 'math' as const };
        problem.learningContext = createLearningProblemContext('math', problem);
        return { profileId: profile.id, subject: 'math', itemId: skill, result: 'correct', isReview: false,
            timestamp: new Date(Date.parse(NOW) - (count - index) * 1000).toISOString(),
            learningEvidence: learningEvidenceForProblem(problem, 'independent') };
    });
}
describe('finish practice coverage and recent qualification', () => {
    it('cannot admit fabricated legacy windows or one repeated equation in a carry range', () => {
        const p = mathProfile(9);
        p.mathLevels = p.mathLevels?.map(level => level.level === 9 ? { ...level, recentIndependentAnswersNonReview: Array(20).fill(true) } : level);
        const empty = evaluateFinishCoverage(p, 'math', [], NOW);
        expect(finishEligibility(p, 'math', undefined, empty).status).toBe('practicing');
        const easy = mathLogs(p, 'add_1d_2', 20, 'easy', { questionText: '1 + 7 =', correctAnswer: '8' });
        expect(evaluateFinishCoverage(p, 'math', easy, NOW)).toMatchObject({ coverageReady: false, recentCount: 20, recentCorrect: 20 });
        const repeated = mathLogs(p, 'add_1d_2', 20, 'same', { questionText: '8 + 7 =', correctAnswer: '15' });
        expect(evaluateFinishCoverage(p, 'math', repeated, NOW).coverageReady).toBe(false);
        const covered = mathLogs(p, 'add_1d_2', 60, 'carry');
        expect(evaluateFinishCoverage(p, 'math', covered, NOW).coverageReady).toBe(true);
    });
    it('requires each current catalog unit and concrete variant, not each representation', () => {
        const p = mathProfile(10);
        const nc = mathLogs(p, 'sub_1d1d_nc', 40, 'nc');
        expect(evaluateFinishCoverage(p, 'math', nc, NOW).coverageReady).toBe(false);
        const both = [...nc, ...mathLogs(p, 'sub_1d1d_c', 40, 'carry')];
        expect(evaluateFinishCoverage(p, 'math', both, NOW).coverageReady).toBe(true);
        expect(both.every(log => log.itemId.endsWith('_bridge') === false)).toBe(true);
    });
    it('requires three actual distinct problems, excludes unknown and assistance, and rejects future evidence', () => {
        const p = mathProfile(8);
        const valid = mathLogs(p, 'add_1d_1', 60, 'valid');
        expect(evaluateFinishCoverage(p, 'math', valid, NOW).coverageReady).toBe(true);
        expect(evaluateFinishCoverage(p, 'math', valid.map(log => ({ ...log, learningEvidence: undefined })), NOW).coverageReady).toBe(false);
        expect(evaluateFinishCoverage(p, 'math', valid.map(log => ({ ...log,
            learningEvidence: { ...log.learningEvidence!, assistance: 'assisted' as const } })), NOW).coverageReady).toBe(false);
        expect(evaluateFinishCoverage(p, 'math', valid.map(log => ({ ...log, timestamp: '2027-01-01' })), NOW).recentCount).toBe(0);
    });
    it('retains earned coverage but expires old admission evidence after seven days', () => {
        const p = mathProfile(8);
        const logs = mathLogs(p, 'add_1d_1', 60, 'fresh');
        const fresh = evaluateFinishCoverage(p, 'math', logs, NOW);
        expect(finishEligibility(p, 'math', undefined, fresh).status).toBe('ready');
        const after = new Date(Date.parse(NOW) + FINISH_EVIDENCE_FRESHNESS_MS + 1).toISOString();
        const expired = evaluateFinishCoverage(p, 'math', logs, after);
        expect(expired).toMatchObject({ coverageReady: true, fresh: false, recentCount: 0 });
        expect(finishEligibility(p, 'math', undefined, expired).status).toBe('practicing');
    });
    it('requires 70 percent distinct current vocabulary with independent verified contexts', () => {
        const p = createInitialProfile('T', 1, 1, 1, 'vocab');
        const words = getWordsByLevel(1);
        const required = Math.ceil(words.length * 0.7);
        const logs = words.map((word): AttemptLog => ({ profileId: p.id, subject: 'vocab', itemId: word.id,
            result: 'correct', timestamp: NOW, isReview: false,
            learningEvidence: learningEvidenceForProblem({ ...generateVocabProblem(word.id), subject: 'vocab' }, 'independent') }));
        expect(evaluateFinishCoverage(p, 'vocab', logs.slice(0, required - 1), NOW).coverageReady).toBe(false);
        expect(evaluateFinishCoverage(p, 'vocab', logs.slice(0, required), NOW)).toMatchObject({ coverageReady: true, coveredCount: required, requiredCount: required });
        expect(evaluateFinishCoverage(p, 'vocab', Array(50).fill(logs[0]), NOW).coverageReady).toBe(false);
        expect(getSkillsForLevel(9)).toHaveLength(2);
    });
    it('does not treat reordered choices or arithmetic display formatting as a new problem', () => {
        const math = generateMathProblem('add_1d_1');
        expect(finishContentKey(math)).toBe(finishContentKey({ ...math, questionText: math.questionText?.replace(/ /g, ''), inputType: 'hissan' }));
        const vocab = generateVocabProblem('apple');
        expect(finishContentKey(vocab)).toBe(finishContentKey({ ...vocab, inputConfig: { ...vocab.inputConfig,
            choices: [...(vocab.inputConfig?.choices ?? [])].reverse() } }));
    });
});
