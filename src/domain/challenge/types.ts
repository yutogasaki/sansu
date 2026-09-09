import type { ChallengeQuestion, ChallengeEvent as EngineEvent } from './engine';
export type ChallengeAwardId = 'certificate' | 'trophy';
export type ChallengeAnswer = EngineEvent;
export interface ChallengeResult { correct: number; incorrect: number; skipped: number; official: boolean; reason?: string; newAwards: ChallengeAwardId[]; best: number | null; improved: boolean; finishedAt: string }
export interface ChallengeRun { id: string; profileId: string; ownerId: string; version: 1; challengeId: 'addition-within-10-60s'; ruleVersion: 1; sourceVersion: 1; inputMode: 'digits'; settingsSnapshot: string; seed: string; questions: ChallengeQuestion[]; createdAt: string; status: 'countdown' | 'running' | 'result' | 'interrupted'; shownThrough: number; startedAt?: string; result?: ChallengeResult }
export interface ChallengeEvent extends ChallengeAnswer { key: string; runId: string; profileId: string }
export interface ChallengeAward { id: ChallengeAwardId; acquiredAt: string; correct: number; runId: string }
export interface ChallengeSummary { profileId: string; version: 1; best: number | null; bestRunId?: string; completedCount: number; awards: ChallengeAward[]; displayed: ChallengeAwardId[] }
export interface ChallengeContact { profileId: string; itemId: string; latestAt: string; uncertain: boolean }
