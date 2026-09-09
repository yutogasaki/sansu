import { describe, expect, it } from 'vitest';
import {
  advanceChallengeRun, challengeCounts, createChallengeRun, generateChallengeQuestions,
  interruptChallengeRun, normalizeChallengeAnswer, remainingChallengeSeconds,
  startChallengeRun, submitChallengeAnswer,
} from './engine';

const pairKey = (question: { a: number; b: number }) => `${question.a},${question.b}`;
const stratum = (question: { answer: number }) => question.answer <= 5 ? 0 : question.answer <= 8 ? 1 : 2;
const initial = () => startChallengeRun(createChallengeRun(generateChallengeQuestions('test')), 500);

describe('challenge source v1', () => {
  it('reproduces a seed and keeps its prefix when extending the prepared 300 questions', () => {
    const questions = generateChallengeQuestions('same');
    expect(questions).toHaveLength(300);
    expect(generateChallengeQuestions('same', 600).slice(0, 300)).toEqual(questions);
    expect(generateChallengeQuestions('other')).not.toEqual(questions);
    expect(generateChallengeQuestions('same', 7)).toEqual(questions.slice(0, 7));
  });

  it('covers all 45 ordered pairs, balances each block, exhausts bags, and avoids repeated/reversed neighbors', () => {
    for (let seed = 0; seed < 100; seed++) {
      const questions = generateChallengeQuestions(String(seed), 600);
      expect(new Set(questions.map(pairKey)).size).toBe(45);
      for (const [index, question] of questions.entries()) {
        expect(question.index).toBe(index);
        expect(question.a).toBeGreaterThanOrEqual(1);
        expect(question.b).toBeGreaterThanOrEqual(1);
        expect(question.answer).toBe(question.a + question.b);
        expect(question.answer).toBeLessThanOrEqual(10);
        const previous = questions[index - 1];
        if (previous) {
          expect(pairKey(question)).not.toBe(pairKey(previous));
          expect(pairKey(question)).not.toBe(`${previous.b},${previous.a}`);
        }
      }
      for (let index = 0; index < questions.length; index += 10) {
        const block = questions.slice(index, index + 10);
        expect([0, 1, 2].map((layer) => block.filter((question) => stratum(question) === layer).length)).toEqual([3, 4, 3]);
      }
      for (const [layer, size] of [10, 18, 17].entries()) {
        const entries = questions.filter((question) => stratum(question) === layer);
        for (let index = 0; index + size <= entries.length; index += size) {
          expect(new Set(entries.slice(index, index + size).map(pairKey)).size).toBe(size);
        }
      }
    }
  });
});

describe('challenge scoring and monotonic deadline', () => {
  it.each(['', ' ', '-1', '1.5', '1e1', '0xA', 'Infinity', '１２'])('rejects invalid input %j', (input) => {
    const state = initial();
    expect(normalizeChallengeAnswer(input)).toBeNull();
    expect(submitChallengeAnswer(state, { questionId: state.questions[0].id, input, now: 1000 })).toBe(state);
  });

  it('accepts normalized leading zeros and ignores repeat submits during and after feedback', () => {
    const state = initial();
    const question = state.questions[0];
    const accepted = submitChallengeAnswer(state, { questionId: question.id, input: `00${question.answer}`, now: 1000 });
    expect(challengeCounts(accepted)).toEqual({ correct: 1, incorrect: 0, skipped: 0 });
    expect(submitChallengeAnswer(accepted, { questionId: question.id, input: '0', now: 1100 })).toBe(accepted);
    expect(advanceChallengeRun(accepted, 1299)).toBe(accepted);
    const next = advanceChallengeRun(accepted, 1300);
    expect(next.index).toBe(1);
    expect(submitChallengeAnswer(next, { questionId: question.id, input: String(question.answer), now: 1300 })).toBe(next);
    expect(next.events).toHaveLength(1);
  });

  it('counts wrong answers and skips separately without penalties or correction scoring', () => {
    let state = initial();
    state = submitChallengeAnswer(state, { questionId: state.questions[0].id, input: '99', now: 1000 });
    state = advanceChallengeRun(state, 1300);
    state = submitChallengeAnswer(state, { questionId: state.questions[1].id, input: null, now: 1300 });
    expect(challengeCounts(state)).toEqual({ correct: 0, incorrect: 1, skipped: 1 });
    expect(state.startedAt).toBe(500);
  });

  it('includes an answer at 59,999ms even when finalization occurs later', () => {
    const state = initial();
    const accepted = submitChallengeAnswer(state, { questionId: state.questions[0].id, input: String(state.questions[0].answer), now: 60_499 });
    expect(accepted.events[0].elapsedMs).toBe(59_999);
    const finalized = advanceChallengeRun(accepted, 65_000);
    expect(finalized.phase).toBe('finalizing');
    expect(challengeCounts(finalized).correct).toBe(1);
    expect(advanceChallengeRun(finalized, 70_000)).toBe(finalized);
  });

  it('rejects an answer exactly at 60,000ms and leaves the unanswered question uncounted', () => {
    const state = initial();
    const finalized = submitChallengeAnswer(state, { questionId: state.questions[0].id, input: String(state.questions[0].answer), now: 60_500 });
    expect(finalized.phase).toBe('finalizing');
    expect(finalized.events).toEqual([]);
  });

  it('does not accept countdown input or revive an interrupted run', () => {
    const countdown = createChallengeRun(generateChallengeQuestions('test'));
    expect(submitChallengeAnswer(countdown, { questionId: countdown.questions[0].id, input: '1', now: 0 })).toBe(countdown);
    const interrupted = interruptChallengeRun(countdown, 'hidden');
    expect(startChallengeRun(interrupted, 100)).toBe(interrupted);
    expect(interruptChallengeRun(interrupted, 'other')).toBe(interrupted);
    expect(advanceChallengeRun(interrupted, 60_000)).toBe(interrupted);
  });

  it('rounds remaining seconds upward, with no wall-clock dependency', () => {
    const state = initial();
    expect(remainingChallengeSeconds(state, 501)).toBe(60);
    expect(remainingChallengeSeconds(state, 60_499)).toBe(1);
    expect(remainingChallengeSeconds(state, 60_500)).toBe(0);
    expect(remainingChallengeSeconds(state, 80_000)).toBe(0);
  });

  it('marks unavailable next questions as technical interruption', () => {
    let state = startChallengeRun(createChallengeRun(generateChallengeQuestions('test', 1)), 0);
    state = submitChallengeAnswer(state, { questionId: state.questions[0].id, input: null, now: 1 });
    expect(advanceChallengeRun(state, 301).interruptionReason).toBe('source-exhausted');
  });
});
