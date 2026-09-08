import type { UserProfile } from "../types";
import type { RandomSource } from "../../utils/random";
import {
    getMathSkillFamily,
    getSkillsForLevel,
    isMathSkillUnlockedForProfile,
} from "./curriculum";
import { getMathFollowupPlan } from "./followups";

export type MathProblemPlanSource =
    | "retry"
    | "due"
    | "maintenance"
    | "weak"
    | "followup"
    | "main"
    | "plus-one";

export interface MathProblemPlanItem {
    skillId: string;
    source: MathProblemPlanSource;
    isReview: boolean;
    isMaintenanceCheck: boolean;
    countsTowardReviewCap: boolean;
}

export type MathProblemPlanSlot = MathProblemPlanItem | undefined;

type ReviewAdmission =
    | boolean
    | ((
        planned: readonly MathProblemPlanItem[],
        plannedSlots: readonly MathProblemPlanSlot[],
    ) => boolean);

export interface MathProblemPlanOptions {
    profile: UserProfile;
    /** Exploration uses the three-question default; Study passes its block size. */
    count?: number;
    /** Ordered by learning priority, normally most overdue first. */
    dueSkillIds?: readonly string[];
    weakSkillIds?: readonly string[];
    maintenanceSkillIds?: readonly string[];
    retiredSkillIds?: readonly string[];
    /** Immediate fallback candidates after an incorrect answer, in priority order. */
    retrySkillIds?: readonly string[];
    /** Defaults to one immediate retry when retrySkillIds is non-empty. */
    retryLimit?: number;
    cooldownIds?: readonly string[];
    /** Allows Study's persisted cooldown window to shrink as the plan fills. */
    cooldownIdsForIndex?: (plannedCount: number) => readonly string[];
    skippedTodayIds?: readonly string[];
    recentIds?: readonly string[];
    blockCounts?: ReadonlyMap<string, number>;
    canAddReview?: ReviewAdmission;
    currentWeakCount?: number;
    weakLimit?: number;
    plusOneCount?: number;
    plusOneLimit?: number;
    sameSkillLimit?: number;
    recentWindow?: number;
    maintenanceRate?: number;
    weakRate?: number;
    plusOneRate?: number;
    /**
     * Lets a surface exclude generators its current answer UI cannot render.
     * The callback is ANDed with the built-in curriculum/unlock guard.
     */
    isSkillEligible?: (skillId: string, plannedIndex: number) => boolean;
    random?: RandomSource;
}

const DEFAULT_PLAN_COUNT = 3;
const DEFAULT_RECENT_WINDOW = 5;
const DEFAULT_SAME_SKILL_LIMIT = 2;
const DEFAULT_MAINTENANCE_RATE = 0.01;
const DEFAULT_WEAK_RATE = 0.3;
const DEFAULT_PLUS_ONE_RATE = 0.3;

interface SelectionOptions {
    cooldownIds: readonly string[];
    skippedTodayIds: readonly string[];
    recentIds: readonly string[];
    blockCounts: ReadonlyMap<string, number>;
    sameSkillLimit: number;
    plannedIndex: number;
    isSkillEligible: (skillId: string, plannedIndex: number) => boolean;
    random: RandomSource;
}

const randomItem = <T>(items: readonly T[], random: RandomSource): T | undefined => {
    if (items.length === 0) return undefined;
    const index = Math.min(items.length - 1, Math.floor(random() * items.length));
    return items[index];
};

const getEligible = (
    candidates: readonly string[],
    options: SelectionOptions,
): string[] => candidates.filter(skillId =>
    options.isSkillEligible(skillId, options.plannedIndex)
    && !options.skippedTodayIds.includes(skillId)
    && (options.blockCounts.get(skillId) || 0) < options.sameSkillLimit
);

const pickOrderedId = (
    candidates: readonly string[],
    options: SelectionOptions,
): string | undefined => {
    const eligible = getEligible(candidates, options);
    if (eligible.length === 0) return undefined;

    return eligible.find(skillId =>
        !options.recentIds.includes(skillId)
        && !options.cooldownIds.includes(skillId)
    ) ?? eligible[0];
};

const pickMathSkillId = (
    candidates: readonly string[],
    options: SelectionOptions,
    profile?: UserProfile,
): string | undefined => {
    const eligible = getEligible(candidates, options);
    if (eligible.length === 0) return undefined;

    const cooled = eligible.filter(skillId =>
        !options.recentIds.includes(skillId)
        && !options.cooldownIds.includes(skillId)
    );
    const cooldownPool = prioritizeLearning(
        cooled.length > 0 ? cooled : eligible, options, profile,
    );
    const recentFamilies = options.recentIds.map(getMathSkillFamily);
    const recentFamilyWindow = new Set(recentFamilies.slice(-2));
    const lastFamily = recentFamilies[recentFamilies.length - 1];
    const familyCooled = cooldownPool.filter(
        skillId => !recentFamilyWindow.has(getMathSkillFamily(skillId)),
    );
    if (familyCooled.length > 0) {
        return randomItem(familyCooled, options.random);
    }

    const differentFromLast = cooldownPool.filter(
        skillId => getMathSkillFamily(skillId) !== lastFamily,
    );
    return randomItem(
        differentFromLast.length > 0 ? differentFromLast : cooldownPool,
        options.random,
    );
};

const prioritizeLearning = (
    candidates: readonly string[],
    options: SelectionOptions,
    profile?: UserProfile,
): readonly string[] => {
    if (!profile || candidates.length === 0) return candidates;
    const unseen = candidates.filter(id => !profile.mathSkills?.[id]);
    const introduced = unseen.length > 0 ? unseen : candidates;
    const strength = (id: string) => {
        const value = profile.mathSkills?.[id]?.strength;
        return typeof value === "number" && Number.isFinite(value) && value >= 0
            ? value : 0;
    };
    const minimumStrength = Math.min(...introduced.map(strength));
    const lowStrength = introduced.filter(id => strength(id) === minimumStrength);
    const minimumCount = Math.min(...lowStrength.map(id => options.blockCounts.get(id) || 0));
    return lowStrength.filter(id => (options.blockCounts.get(id) || 0) === minimumCount);
};

const pickOrderedMathSkillId = (
    candidates: readonly string[],
    options: SelectionOptions,
): string | undefined => {
    const eligible = getEligible(candidates, options);
    if (eligible.length === 0) return undefined;

    const cooled = eligible.filter(skillId =>
        !options.recentIds.includes(skillId)
        && !options.cooldownIds.includes(skillId)
    );
    const cooldownPool = cooled.length > 0 ? cooled : eligible;
    const recentFamilies = new Set(options.recentIds.slice(-2).map(getMathSkillFamily));

    return cooldownPool.find(
        skillId => !recentFamilies.has(getMathSkillFamily(skillId)),
    ) ?? cooldownPool[0];
};

const pickLeastUsedMathSkillId = (
    candidates: readonly string[],
    options: SelectionOptions,
    profile?: UserProfile,
): string | undefined => {
    const allowed = candidates.filter(
        skillId => options.isSkillEligible(skillId, options.plannedIndex)
            && !options.skippedTodayIds.includes(skillId),
    );
    if (allowed.length === 0) return undefined;

    const minimumCount = Math.min(
        ...allowed.map(skillId => options.blockCounts.get(skillId) || 0),
    );
    const leastUsed = allowed.filter(
        skillId => (options.blockCounts.get(skillId) || 0) === minimumCount,
    );
    const cooled = leastUsed.filter(skillId =>
        !options.recentIds.includes(skillId)
        && !options.cooldownIds.includes(skillId)
    );
    const cooldownPool = prioritizeLearning(
        cooled.length > 0 ? cooled : leastUsed, options, profile,
    );
    const recentFamilies = new Set(options.recentIds.slice(-2).map(getMathSkillFamily));
    const familyCooled = cooldownPool.filter(
        skillId => !recentFamilies.has(getMathSkillFamily(skillId)),
    );

    return randomItem(
        familyCooled.length > 0 ? familyCooled : cooldownPool,
        options.random,
    );
};

const createPlanItem = (
    skillId: string,
    source: MathProblemPlanSource,
): MathProblemPlanItem => ({
    skillId,
    source,
    isReview: source === "due",
    isMaintenanceCheck: source === "maintenance",
    countsTowardReviewCap:
        source === "due" || source === "maintenance" || source === "weak",
});

const isReviewAllowed = (
    admission: ReviewAdmission | undefined,
    planned: readonly MathProblemPlanItem[],
    plannedSlots: readonly MathProblemPlanSlot[],
): boolean => typeof admission === "function"
    ? admission(planned, plannedSlots)
    : admission ?? true;

/**
 * Produces a position-preserving skill plan. Undefined slots let a surface
 * supply a separate non-learning fallback without discarding eligible later
 * positions. It does not generate operands or mutate persistence.
 */
export const planMathProblemSlots = (
    options: MathProblemPlanOptions,
): MathProblemPlanSlot[] => {
    const count = Math.max(0, Math.floor(options.count ?? DEFAULT_PLAN_COUNT));
    if (count === 0) return [];

    const random = options.random ?? Math.random;
    const recentWindow = Math.max(1, Math.floor(options.recentWindow ?? DEFAULT_RECENT_WINDOW));
    const sameSkillLimit = Math.max(1, Math.floor(
        options.sameSkillLimit ?? DEFAULT_SAME_SKILL_LIMIT,
    ));
    const maintenanceRate = options.maintenanceRate ?? DEFAULT_MAINTENANCE_RATE;
    const weakRate = options.weakRate ?? DEFAULT_WEAK_RATE;
    const plusOneRate = options.plusOneRate ?? DEFAULT_PLUS_ONE_RATE;
    const weakLimit = Math.max(0, Math.floor(
        options.weakLimit ?? Math.max(1, Math.floor(count * DEFAULT_WEAK_RATE)),
    ));
    const plusOneLimit = Math.max(0, Math.floor(
        options.plusOneLimit ?? Math.max(1, Math.floor(count * DEFAULT_PLUS_ONE_RATE)),
    ));
    const retryLimit = Math.max(0, Math.floor(
        options.retryLimit ?? ((options.retrySkillIds?.length || 0) > 0 ? 1 : 0),
    ));

    const blockCounts = new Map(options.blockCounts || []);
    const initialRecentIds = [...(options.recentIds || [])];
    const plannedSlots: MathProblemPlanSlot[] = [];
    const plannedItems: MathProblemPlanItem[] = [];
    let weakCount = Math.max(0, options.currentWeakCount ?? 0);
    let plusOneCount = Math.max(0, options.plusOneCount ?? 0);
    let retryCount = 0;
    const callerEligibility = options.isSkillEligible ?? (() => true);
    const dormantIds = new Set([
        ...(options.retiredSkillIds || []),
        ...(options.maintenanceSkillIds || []),
        ...Object.entries(options.profile.mathSkills || {})
            .filter(([, state]) => state.status === "retired" || state.status === "maintenance")
            .map(([id]) => id),
    ]);
    // Soft repetition limits may relax for a small pool; graduation preference
    // must not relax just because an active skill was already picked twice.
    const normalCandidates = (ids: string[], selection: SelectionOptions): string[] => {
        const active = ids.filter(id => !dormantIds.has(id)
            && selection.isSkillEligible(id, selection.plannedIndex)
            && !selection.skippedTodayIds.includes(id));
        return active.length ? active : ids;
    };

    const getSelectionOptions = (): SelectionOptions => ({
        cooldownIds: options.cooldownIdsForIndex?.(plannedSlots.length)
            ?? options.cooldownIds
            ?? [],
        skippedTodayIds: options.skippedTodayIds ?? [],
        recentIds: [
            ...initialRecentIds,
            ...plannedItems.map(item => item.skillId),
        ].slice(-recentWindow),
        blockCounts,
        sameSkillLimit,
        plannedIndex: plannedSlots.length,
        isSkillEligible: (skillId, plannedIndex) =>
            isMathSkillUnlockedForProfile(skillId, options.profile)
            && callerEligibility(skillId, plannedIndex),
        random,
    });

    while (plannedSlots.length < count) {
        const selection = getSelectionOptions();
        let item: MathProblemPlanItem | undefined;

        if (retryCount < retryLimit && (options.retrySkillIds?.length || 0) > 0) {
            const retryId = pickOrderedId(options.retrySkillIds || [], selection);
            if (retryId) {
                item = createPlanItem(retryId, "retry");
                retryCount += 1;
            }
        }

        if (!item && (options.dueSkillIds?.length || 0) > 0
            && isReviewAllowed(options.canAddReview, plannedItems, plannedSlots)) {
            const dueId = pickOrderedId(options.dueSkillIds || [], selection);
            if (dueId) item = createPlanItem(dueId, "due");
        }

        if (!item && isReviewAllowed(options.canAddReview, plannedItems, plannedSlots)) {
            const maintenancePool = [
                ...(options.maintenanceSkillIds || []),
                ...(options.retiredSkillIds || []),
            ];
            if (maintenancePool.length > 0 && random() < maintenanceRate) {
                const maintenanceId = pickMathSkillId(maintenancePool, selection);
                if (maintenanceId) {
                    item = createPlanItem(maintenanceId, "maintenance");
                }
            }
        }

        if (!item && isReviewAllowed(options.canAddReview, plannedItems, plannedSlots)
            && weakCount < weakLimit
            && (options.weakSkillIds?.length || 0) > 0
            && random() < weakRate) {
            const weakId = pickMathSkillId(options.weakSkillIds || [], selection);
            if (weakId) item = createPlanItem(weakId, "weak");
        }

        if (!item) {
            const mainLevel = options.profile.mathMainLevel ?? 1;
            const currentLevelSkills = getSkillsForLevel(mainLevel);
            const followups = getMathFollowupPlan(
                options.profile.recentAttempts,
                currentLevelSkills,
                options.profile.mathMaxUnlocked ?? mainLevel,
            );
            const hasActiveCurrent = currentLevelSkills.some(id => !dormantIds.has(id)
                && selection.isSkillEligible(id, selection.plannedIndex)
                && !selection.skippedTodayIds.includes(id));
            const followupIds = followups.filter(candidate => candidate.reason === "remediation"
                || !hasActiveCurrent || !dormantIds.has(candidate.skillId)).map(candidate => candidate.skillId);
            const followupId = pickOrderedMathSkillId(followupIds, selection);
            if (followupId) item = createPlanItem(followupId, "followup");
        }

        if (!item) {
            const mainLevel = options.profile.mathMainLevel ?? 1;
            const maxUnlocked = options.profile.mathMaxUnlocked ?? mainLevel;
            const hasPlusOne = maxUnlocked >= mainLevel + 1;
            const wantsPlusOne = hasPlusOne
                && plusOneCount < plusOneLimit
                && random() < plusOneRate;
            const requestedLevel = wantsPlusOne ? mainLevel + 1 : mainLevel;
            const requestedSkills = getSkillsForLevel(requestedLevel);
            const fallbackSkills = getSkillsForLevel(1);
            const candidates = normalCandidates(requestedSkills.length > 0 ? requestedSkills : fallbackSkills, selection);
            let skillId = pickMathSkillId(candidates, selection, options.profile)
                || pickLeastUsedMathSkillId(candidates, selection, options.profile);
            let source: MathProblemPlanSource = wantsPlusOne ? "plus-one" : "main";

            // If +1 is exhausted by block/skip guards, keep the plan useful and
            // truthfully label the main-level fallback.
            if (!skillId && wantsPlusOne) {
                const mainSkills = normalCandidates(getSkillsForLevel(mainLevel), selection);
                skillId = pickMathSkillId(mainSkills, selection, options.profile)
                    || pickLeastUsedMathSkillId(mainSkills, selection, options.profile);
                source = "main";
            }

            if (skillId) item = createPlanItem(skillId, source);
        }

        plannedSlots.push(item);
        if (!item) continue;
        plannedItems.push(item);
        blockCounts.set(item.skillId, (blockCounts.get(item.skillId) || 0) + 1);
        if (item.source === "weak") weakCount += 1;
        if (item.source === "plus-one") plusOneCount += 1;
    }

    return plannedSlots;
};

/**
 * Compact shared Study plan. Surfaces that must preserve exact positions,
 * such as Explore segments, use `planMathProblemSlots` instead.
 */
export const planMathProblems = (
    options: MathProblemPlanOptions,
): MathProblemPlanItem[] => planMathProblemSlots(options).filter(
    (item): item is MathProblemPlanItem => item !== undefined,
);
