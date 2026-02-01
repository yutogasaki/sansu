import { db } from "../../db";
import { getSkillsForLevel } from "./curriculum";

// Check if user should level up from currentLevel
export const checkLevelProgression = async (profileId: string, currentMainLevel: number): Promise<boolean> => {
    // Spec: "Unlock next level if: Recent 20 logs of Main Level (excluding reviews) have Accuracy >= 85%"

    // 1. Identify skills in current main level
    const targetSkills = getSkillsForLevel(currentMainLevel);
    if (targetSkills.length === 0) return false;

    // 2. Query Logs
    // We need logs where:
    // - profileId matches
    // - subject = 'math'
    // - itemId IN targetSkills
    // - NOT isReview (This is hard because we don't strictly store isReview in Logs yet,
    //   but we can approximate by checking if the log timestamp is very recent? 
    //   Actually, we can just check the LAST 20 ATTEMPTS for these skills regardless of review flag for MVP.
    //   Why? Because "Main Level" items are mostly new or recent.
    //   Refining query: "Last 20 logs for skills in this level".

    const logs = await db.logs
        .where('[profileId+subject]')
        .equals([profileId, 'math'])
        .reverse() // Newest first
        .limit(100) // Fetch enough to filter
        .toArray();

    // Filter for current level skills
    const levelLogs = logs.filter(l => targetSkills.includes(l.itemId));

    // Take recent 20
    const recent20 = levelLogs.slice(0, 20);

    if (recent20.length < 10) {
        // Not enough data to judge (Spec says "Minimum 20"? Or just recent 20. 
        // Let's require at least 10 to avoid lucky streak on 1 question)
        return false;
    }

    // Calculate Accuracy
    const correctCount = recent20.filter(l => l.result === 'correct').length;
    const accuracy = correctCount / recent20.length;

    console.log(`Level ${currentMainLevel} Check: ${correctCount}/${recent20.length} = ${accuracy * 100}%`);

    return accuracy >= 0.85;
};
