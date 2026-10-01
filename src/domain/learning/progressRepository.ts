import { evaluateFinishCoverage } from '../finishCoverage';
import { finishEligibility } from '../finishTest';
import { db } from '../../db';
import type { UserProfile } from '../types';
import { readMathLevel11Pilot } from './pilotRepository';
import { learningProgressView } from './progressView';

export async function readLearningProgress(profile: UserProfile) {
    const nowIso = new Date().toISOString();
    const [math, vocab, pilot, logs] = await Promise.all([
        db.memoryMath.where('profileId').equals(profile.id).toArray(),
        db.memoryVocab.where('profileId').equals(profile.id).toArray(),
        profile.mathMainLevel === 11 || profile.mathMainLevel === 10 && profile.mathMaxUnlocked > 10
            ? readMathLevel11Pilot(db, profile.id, nowIso) : undefined,
        db.logs.where('profileId').equals(profile.id).toArray(),
    ]);
    const mathReadiness = evaluateFinishCoverage(profile, 'math', logs, nowIso);
    const vocabReadiness = evaluateFinishCoverage(profile, 'vocab', logs, nowIso);
    return {
        math: learningProgressView(profile, 'math', pilot?.practice.missingUnitIds.length, mathReadiness),
        vocab: learningProgressView(profile, 'vocab', undefined, vocabReadiness),
        memories: { math, vocab },
        finish: { math: finishEligibility(profile, 'math', pilot?.practice.missingUnitIds, mathReadiness), vocab: finishEligibility(profile, 'vocab', undefined, vocabReadiness) },
    };
}
