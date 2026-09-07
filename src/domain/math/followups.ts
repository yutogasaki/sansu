import type { MathRepresentationMode, RecentAttempt } from "../types";
import { getLevelForSkill, getMathSkillMetadata } from "./curriculum";

const REPRESENTATION_PROGRESSIONS = {
    concrete: ["bridge", "symbol"],
    bridge: ["symbol", "strategy", "mental", "algorithm"],
    reverse: ["symbol", "strategy", "mental", "algorithm"],
    strategy: ["mental", "algorithm", "symbol"],
    mental: ["algorithm", "symbol"],
    algorithm: ["symbol"],
    symbol: [],
} as const;

export interface MathFollowupCandidate {
    skillId: string;
    priority: number;
    reason: "remediation" | "progression";
}

export const getLatestMathAttemptForSkillIds = (
    recentAttempts: RecentAttempt[] | undefined,
    skillIds: string[]
): RecentAttempt | undefined => {
    if (!recentAttempts || recentAttempts.length === 0) return undefined;
    const skillIdSet = new Set(skillIds);
    for (let i = recentAttempts.length - 1; i >= 0; i--) {
        const attempt = recentAttempts[i];
        if (attempt?.subject === "math" && skillIdSet.has(attempt.skillId)) {
            return attempt;
        }
    }
    return undefined;
};

export const getMathFollowupPlan = (
    recentAttempts: RecentAttempt[] | undefined,
    currentLevelSkills: string[],
    maxUnlockedLevel: number
): MathFollowupCandidate[] => {
    const weighted = new Map<string, { priority: number; reason: MathFollowupCandidate["reason"] }>();

    const addCandidate = (skillId: string, priority: number, reason: MathFollowupCandidate["reason"]) => {
        const level = getLevelForSkill(skillId);
        if (level === null || level > maxUnlockedLevel) return;
        if ((weighted.get(skillId)?.priority ?? 0) < priority) weighted.set(skillId, { priority, reason });
    };

    currentLevelSkills.forEach(skillId => {
        const metadata = getMathSkillMetadata(skillId);
        const relatedSkillIds = [skillId, ...(metadata.sameConceptSkillIds || [])];
        const latestAttempt = getLatestMathAttemptForSkillIds(recentAttempts, relatedSkillIds);
        if (!latestAttempt) return;

        const sourceMetadata = getMathSkillMetadata(latestAttempt.skillId);

        if (latestAttempt.result !== "correct") {
            (sourceMetadata.reviewFallbackSkillIds || []).forEach((fallbackId, index) => {
                addCandidate(fallbackId, 70 - index, "remediation");
            });
            return;
        }

        const targetRepresentations: readonly MathRepresentationMode[] =
            REPRESENTATION_PROGRESSIONS[sourceMetadata.representation] || [];

        relatedSkillIds.forEach(relatedSkillId => {
            if (relatedSkillId === latestAttempt.skillId) return;
            const relatedMetadata = getMathSkillMetadata(relatedSkillId);
            const progressionIndex = targetRepresentations.indexOf(relatedMetadata.representation);
            if (progressionIndex === -1) return;
            addCandidate(relatedSkillId, 65 - progressionIndex * 5, "progression");
        });
    });

    return [...weighted.entries()]
        .sort((a, b) => b[1].priority - a[1].priority)
        .map(([skillId, metadata]) => ({ skillId, ...metadata }));
};
