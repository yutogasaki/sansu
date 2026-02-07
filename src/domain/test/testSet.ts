import { Problem, SubjectKey, UserProfile, PeriodicTestSet } from "../types";
import { generateMathProblem } from "../math";
import { generateVocabProblem } from "../english/generator";
import { getSkillsForLevel } from "../math/curriculum";
import { getWordsByLevel } from "../english/words";
import { saveProfile } from "../user/repository";

const SAME_ID_LIMIT = 2;

const pickId = (
    candidates: string[],
    blockCounts: Map<string, number>
): string | undefined => {
    const available = candidates.filter(id => (blockCounts.get(id) || 0) < SAME_ID_LIMIT);
    if (available.length === 0) return undefined;
    return available[Math.floor(Math.random() * available.length)];
};

const buildPeriodicTestSet = (
    profile: UserProfile,
    subject: SubjectKey
): PeriodicTestSet => {
    const level = subject === "math" ? profile.mathMainLevel : profile.vocabMainLevel;
    const blockCounts = new Map<string, number>();
    const problems: Omit<Problem, 'id' | 'subject' | 'isReview'>[] = [];

    const genOptions = { blockCounts };

    if (subject === "math") {
        const skills = getSkillsForLevel(level);
        const pool = skills.length > 0 ? skills : getSkillsForLevel(1);
        for (let i = 0; i < 20; i++) {
            const id = pickId(pool, genOptions.blockCounts) || pool[0];
            if (!id) break;
            const problem = generateMathProblem(id);
            problems.push(problem);
            genOptions.blockCounts.set(id, (genOptions.blockCounts.get(id) || 0) + 1);
        }
    } else {
        const words = getWordsByLevel(level);
        const pool = words.length > 0 ? words.map(w => w.id) : getWordsByLevel(1).map(w => w.id);
        for (let i = 0; i < 20; i++) {
            const id = pickId(pool, genOptions.blockCounts) || pool[0];
            if (!id) break;
            const problem = generateVocabProblem(id, { cooldownIds: [], kanjiMode: profile.kanjiMode });
            problems.push(problem);
            genOptions.blockCounts.set(id, (genOptions.blockCounts.get(id) || 0) + 1);
        }
    }

    return {
        subject,
        level,
        createdAt: new Date().toISOString(),
        problems
    };
};

export const ensurePeriodicTestSet = async (
    profile: UserProfile,
    subject: SubjectKey
): Promise<PeriodicTestSet> => {
    const currentLevel = subject === "math" ? profile.mathMainLevel : profile.vocabMainLevel;
    const existing = profile.periodicTestSets?.[subject];

    if (existing && existing.level === currentLevel && existing.problems.length === 20) {
        return existing;
    }

    const created = buildPeriodicTestSet(profile, subject);
    const updated: UserProfile = {
        ...profile,
        periodicTestSets: {
            ...(profile.periodicTestSets || {}),
            [subject]: created
        }
    };

    await saveProfile(updated);
    return created;
};
