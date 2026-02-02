import { db } from "../../db";
import { getSkillsForLevel } from "./curriculum";

// Check if user should level up from currentLevel
// 仕様 5.2: 「復習以外」の直近20問で正答率85%以上
export const checkLevelProgression = async (profileId: string, currentMainLevel: number): Promise<boolean> => {
    // 1. Identify skills in current main level
    const targetSkills = getSkillsForLevel(currentMainLevel);
    if (targetSkills.length === 0) return false;

    // 2. Query Logs
    const logs = await db.logs
        .where('[profileId+subject]')
        .equals([profileId, 'math'])
        .reverse() // Newest first
        .limit(200) // Fetch enough to filter
        .toArray();

    // Filter for current level skills AND exclude reviews (仕様: 復習以外)
    const levelLogs = logs.filter(l =>
        targetSkills.includes(l.itemId) &&
        !l.isReview && // 復習を除外
        l.result !== 'skipped' // スキップも除外
    );

    // Take recent 20
    const recent20 = levelLogs.slice(0, 20);

    // 仕様: 直近20問が必要
    if (recent20.length < 20) {
        return false;
    }

    // Calculate Accuracy
    const correctCount = recent20.filter(l => l.result === 'correct').length;
    const accuracy = correctCount / recent20.length;

    console.log(`Level ${currentMainLevel} Check: ${correctCount}/${recent20.length} = ${accuracy * 100}%`);

    return accuracy >= 0.85;
};
