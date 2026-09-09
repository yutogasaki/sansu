export const CHALLENGE_ID = 'addition-within-10-60s';
export const RULE_VERSION = 1;
export const SOURCE_VERSION = 1;
export const DURATION_MS = 60_000;
export const FEEDBACK_MS = 300;

export interface ChallengeQuestion {
  id: string;
  index: number;
  a: number;
  b: number;
  answer: number;
}
type Pair = { a: number; b: number };
const samePair = (left: Pair, right: Pair) =>
  (left.a === right.a && left.b === right.b) || (left.a === right.b && left.b === right.a);

/** A larger count preserves the original deterministic prefix. */
export function generateChallengeQuestions(seed: string, count = 300): ChallengeQuestion[] {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid question count');
  let value = 2166136261;
  for (const character of seed) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  const random = () => {
    value += 0x6d2b79f5;
    let next = Math.imul(value ^ (value >>> 15), 1 | value);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
  const shuffle = <T>(items: T[]): T[] => {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };
  const strata: Pair[][] = [[], [], []];
  for (let a = 1; a <= 9; a++) {
    for (let b = 1; a + b <= 10; b++) {
      strata[a + b <= 5 ? 0 : a + b <= 8 ? 1 : 2].push({ a, b });
    }
  }
  const bags: Pair[][] = [[], [], []];
  const output: ChallengeQuestion[] = [];
  while (output.length < count) {
    const block: Pair[][] = [[], [], []];
    for (const [stratum, quota] of [3, 4, 3].entries()) {
      for (let i = 0; i < quota; i++) {
        if (!bags[stratum].length) bags[stratum] = shuffle([...strata[stratum]]);
        block[stratum].push(bags[stratum].pop()!);
      }
    }
    // Interleave stratum queues without crossing a bag boundary within a stratum.
    // Backtracking only exchanges candidate positions inside this ten-question block.
    const arrange = (queues: Pair[][], previous?: Pair): Pair[] | null => {
      if (queues.every((queue) => !queue.length)) return [];
      for (const stratum of shuffle([0, 1, 2])) {
        const candidate = queues[stratum][0];
        if (!candidate || (previous && samePair(previous, candidate))) continue;
        const tail = arrange(queues.map((queue, index) => index === stratum ? queue.slice(1) : queue), candidate);
        if (tail) return [candidate, ...tail];
      }
      return null;
    };
    const arranged = arrange(block, output[output.length - 1]);
    if (!arranged) throw new Error('Cannot arrange challenge block');
    for (const pair of arranged) {
      const index = output.length;
      output.push({ ...pair, index, id: `challenge-${SOURCE_VERSION}-${index}`, answer: pair.a + pair.b });
    }
  }
  return output.slice(0, count);
}

export type ChallengeOutcome = 'correct' | 'incorrect' | 'skipped';
export interface ChallengeEvent {
  questionId: string;
  questionIndex: number;
  answer: number | null;
  outcome: ChallengeOutcome;
  elapsedMs: number;
}
export interface ChallengeRun {
  phase: 'countdown' | 'running' | 'finalizing' | 'interrupted';
  questions: ChallengeQuestion[];
  index: number;
  startedAt: number | null;
  feedbackUntil: number | null;
  events: ChallengeEvent[];
  interruptionReason?: string;
}

export function createChallengeRun(questions: ChallengeQuestion[]): ChallengeRun {
  return { phase: 'countdown', questions, index: 0, startedAt: null, feedbackUntil: null, events: [] };
}
export function startChallengeRun(state: ChallengeRun, now: number): ChallengeRun {
  if (state.phase !== 'countdown' || !Number.isFinite(now)) return state;
  if (!state.questions.length) return interruptChallengeRun(state, 'source-exhausted');
  return { ...state, phase: 'running', startedAt: now };
}
export function normalizeChallengeAnswer(input: string): number | null {
  if (!/^\d+$/.test(input)) return null;
  const answer = Number(input);
  return Number.isSafeInteger(answer) ? answer : null;
}
/** Capture now at the beginning of the input handler using performance.now(). */
export function submitChallengeAnswer(
  state: ChallengeRun,
  { questionId, input, now }: { questionId: string; input: string | null; now: number },
): ChallengeRun {
  if (state.phase !== 'running' || state.startedAt === null || !Number.isFinite(now)) return state;
  const elapsedMs = now - state.startedAt;
  if (elapsedMs < 0) return state;
  if (elapsedMs >= DURATION_MS) return { ...state, phase: 'finalizing' };
  const question = state.questions[state.index];
  if (state.feedbackUntil !== null || !question || question.id !== questionId) return state;
  if (state.events.some((event) => event.questionId === questionId)) return state;
  const answer = input === null ? null : normalizeChallengeAnswer(input);
  if (input !== null && answer === null) return state;
  const outcome: ChallengeOutcome = input === null ? 'skipped' : answer === question.answer ? 'correct' : 'incorrect';
  return {
    ...state, feedbackUntil: now + FEEDBACK_MS,
    events: [...state.events, { questionId, questionIndex: state.index, answer, outcome, elapsedMs }],
  };
}
export function advanceChallengeRun(state: ChallengeRun, now: number): ChallengeRun {
  if (state.phase !== 'running' || state.startedAt === null || !Number.isFinite(now)) return state;
  if (now - state.startedAt >= DURATION_MS) return { ...state, phase: 'finalizing' };
  if (state.feedbackUntil === null || now < state.feedbackUntil) return state;
  if (!state.questions[state.index + 1]) return interruptChallengeRun(state, 'source-exhausted');
  return { ...state, index: state.index + 1, feedbackUntil: null };
}
export function interruptChallengeRun(state: ChallengeRun, reason: string): ChallengeRun {
  if (state.phase === 'interrupted') return state;
  return { ...state, phase: 'interrupted', interruptionReason: reason, feedbackUntil: null };
}
export function challengeCounts(state: Pick<ChallengeRun, 'events'>) {
  return state.events.reduce((counts, event) => {
    counts[event.outcome]++;
    return counts;
  }, { correct: 0, incorrect: 0, skipped: 0 });
}
export function remainingChallengeSeconds(state: ChallengeRun, now: number): number {
  if (state.startedAt === null) return DURATION_MS / 1000;
  return Math.ceil(Math.max(0, Math.min(DURATION_MS, DURATION_MS - (now - state.startedAt))) / 1000);
}
