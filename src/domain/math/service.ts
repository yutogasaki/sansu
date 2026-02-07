import { db } from "../../db";
import { getSkillsForLevel } from "./curriculum";
import { getProfile } from "../user/repository";
import { UserProfile } from "../types";

// Check if user should level up from currentLevel
// 仕様 5.2: 「復習以外」の直近20問で正答率85%以上
export const checkLevelProgression = async (profileId: string, currentMainLevel: number): Promise<boolean> => {
    const profile = await getProfile(profileId);
    if (!profile || !profile.mathLevels) return false;

    const levelState = profile.mathLevels.find(l => l.level === currentMainLevel);
    if (!levelState) return false;

    const recent = levelState.recentAnswersNonReview || [];
    if (recent.length < 20) return false;

    const correctCount = recent.filter(Boolean).length;
    const accuracy = correctCount / recent.length;

    console.log(`Level ${currentMainLevel} Check: ${correctCount}/${recent.length} = ${accuracy * 100}%`);
    return accuracy >= 0.85;
};

export const checkMathMainPromotion = async (
    profile: UserProfile,
    targetLevel: number
): Promise<boolean> => {
    const skills = getSkillsForLevel(targetLevel);
    if (skills.length === 0) return false;

    const logs = await db.logs
        .where('[profileId+subject]')
        .equals([profile.id, 'math'])
        .filter(log =>
            skills.includes(log.itemId) &&
            !log.isReview &&
            log.result !== 'skipped'
        )
        .toArray();

    return logs.length >= 30;
};
