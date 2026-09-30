import { finishEligibility } from '../finishTest';
import { db } from '../../db';
import type { UserProfile } from '../types';
import { readMathLevel11Pilot } from './pilotRepository';
import { learningProgressView } from './progressView';

export async function readLearningProgress(profile: UserProfile) {
    const [math, vocab, pilot] = await Promise.all([
        db.memoryMath.where('profileId').equals(profile.id).toArray(),
        db.memoryVocab.where('profileId').equals(profile.id).toArray(),
        profile.mathMainLevel === 11 || profile.mathMainLevel === 10 && profile.mathMaxUnlocked > 10
            ? readMathLevel11Pilot(db, profile.id) : undefined,
    ]);
    return {
        math: learningProgressView(profile, 'math', pilot?.practice.missingUnitIds.length),
        vocab: learningProgressView(profile, 'vocab'),
        memories: { math, vocab },
        finish: { math: finishEligibility(profile, 'math', pilot?.practice.missingUnitIds), vocab: finishEligibility(profile, 'vocab') },
    };
}
