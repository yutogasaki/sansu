/** A finite souvenir collection, separate from currency, grading and mastery. */
export interface IslandLearningParty {
    version: 1;
    streak: number;
    light: number;
    rideRemaining: number;
}

export const EMPTY_LEARNING_PARTY: Readonly<IslandLearningParty> = { version: 1, streak: 0, light: 0, rideRemaining: 0 };
export const PARTY_STAMPS = ['ほし', 'つき', 'にじ'] as const;
export const partyStampCount = (party: IslandLearningParty) => Math.floor(party.light / 10);

export function validLearningParty(value: unknown): value is IslandLearningParty | undefined {
    if (value === undefined) return true;
    if (!value || typeof value !== 'object') return false;
    const p = value as IslandLearningParty;
    return p.version === 1 && Number.isSafeInteger(p.streak) && p.streak >= 0 && p.streak <= 99999
        && Number.isInteger(p.light) && p.light >= 0 && p.light <= 30
        && Number.isInteger(p.rideRemaining) && p.rideRemaining >= 0 && p.rideRemaining <= 3;
}

/** Called once inside the authoritative answer transaction, after grading.
 * Incorrect attempts break only the streak. An earned ride has no time limit. */
export function advanceLearningParty(previous: IslandLearningParty | undefined, fact: {
    completed: boolean; independent: boolean; breakStreak: boolean;
}): IslandLearningParty | undefined {
    const p = previous ?? EMPTY_LEARNING_PARTY;
    const streak = fact.breakStreak || fact.completed && !fact.independent ? 0 : fact.completed ? Math.min(99999, p.streak + 1) : p.streak;
    const launch = fact.completed && fact.independent && streak !== p.streak && streak % 5 === 0;
    const light = fact.completed ? Math.min(30, p.light + (fact.independent && p.rideRemaining > 0 ? 2 : 1)) : p.light;
    const rideRemaining = launch ? 3 : fact.completed ? Math.max(0, p.rideRemaining - 1) : p.rideRemaining;
    if (streak === p.streak && light === p.light && rideRemaining === p.rideRemaining) return previous;
    return { version: 1, streak, light, rideRemaining };
}

export interface IslandPartyMoment {
    kind: 'jump' | 'ride' | 'stamp' | 'catch';
    streak: number;
    light: number;
    stamp?: typeof PARTY_STAMPS[number];
    riding: boolean;
}

/** Presentation of already committed progress; it never awards anything. */
export function learningPartyMoment(before: IslandLearningParty | undefined, after: IslandLearningParty | undefined): IslandPartyMoment | undefined {
    if (!after) return;
    const p = before ?? EMPTY_LEARNING_PARTY;
    const stamp = partyStampCount(after) > partyStampCount(p) ? PARTY_STAMPS[partyStampCount(after) - 1] : undefined;
    const advanced = after.streak > p.streak;
    const ride = advanced && after.streak % 5 === 0;
    return { kind: stamp ? 'stamp' : ride ? 'ride' : advanced && after.streak % 5 === 3 ? 'jump' : 'catch',
        streak: after.streak, light: after.light - p.light, ...(stamp ? { stamp } : {}), riding: p.rideRemaining > 0 || ride };
}
