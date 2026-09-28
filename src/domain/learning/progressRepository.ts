import { db } from '../../db';
import type { UserProfile } from '../types';
import { readMathLevel11Pilot } from './pilotRepository';
import { learningProgressView } from './progressView';

export async function readLearningProgress(profile: UserProfile) {
    const [logs, math, vocab, pilot] = await Promise.all([
        db.logs.where('[profileId+subject]').equals([profile.id, 'math']).toArray(),
        db.memoryMath.where('profileId').equals(profile.id).toArray(),
        db.memoryVocab.where('profileId').equals(profile.id).toArray(),
        profile.mathMainLevel === 11 || profile.mathMainLevel === 10 && profile.mathMaxUnlocked > 10
            ? readMathLevel11Pilot(db, profile.id) : undefined,
    ]);
    return {
        math: learningProgressView(profile, 'math', logs, math, pilot?.practice.missingUnitIds.length),
        vocab: learningProgressView(profile, 'vocab', [], vocab),
        memories: { math, vocab },
    };
}
