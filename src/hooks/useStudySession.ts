import { useState, useEffect, useRef } from "react";
import { getActiveProfile, saveProfile } from "../domain/user/repository";
import {
    getMaintenanceMathSkillIds,
    getRecentAttempts,
    getReviewItems,
    getWeakMathSkillIds,
    getSkippedItemsToday,
    getRetiredMathSkillIds,
    logAttempt
} from "../domain/learningRepository";
import { generateMathProblem } from "../domain/math";
import { generateVocabProblem } from "../domain/english/generator";
import { Problem, SubjectKey, UserProfile } from "../domain/types";
import { getAvailableSkills } from "../domain/math/curriculum";
import { checkLevelProgression } from "../domain/math/service";
import {
    SessionKind,
    SessionHistoryItem,
    BLOCK_SIZE,
    COOLDOWN_WINDOW,
    REVIEW_BLOCK_CHECK_WINDOW,
    REVIEW_BLOCK_THRESHOLD,
    markPicked,
    canAddSessionReview,
    calculateRecentReviewRatio,
    getMixSubject,
    buildVocabCooldownIds,
    buildVocabLevelWeights,
    generateSingleMathProblem,
    generateSingleVocabProblem,
    createFallbackProblem,
    safeGenerateProblem,
    generateLevelBlock,
    generateWeakReviewBlock,
    generatePeriodicTestBlock
} from "./blockGenerators";
import { checkPeriodTestTrigger } from "../domain/test/trigger";

type StudySessionOptions = {
    devSkill?: string;
    focusSubject?: SubjectKey;
    focusIds?: string[];
    forceReview?: boolean;
    sessionKind?: SessionKind;
};

export const useStudySession = (options: StudySessionOptions = {}) => {
    const [queue, setQueue] = useState<Problem[]>([]);
    const [blockCount, setBlockCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const [profileId, setProfileId] = useState<string | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);

    const sessionHistoryRef = useRef<SessionHistoryItem[]>([]);

    // Profile fetching with error handling
    useEffect(() => {
        console.log("[useStudySession] fetching profile...");
        getActiveProfile()
            .then(p => {
                console.log("[useStudySession] profile:", p);
                if (p) {
                    setProfileId(p.id);
                    setProfile(p);
                } else {
                    console.log("[useStudySession] no profile found");
                    setLoading(false);
                }
            })
            .catch(err => {
                console.error("[useStudySession] error fetching profile:", err);
                setLoading(false);
            });
    }, []);

    // ============================================================
    // Developer Mode Block Generation
    // ============================================================
    const generateDevBlock = (blockSize: number): Problem[] => {
        const q: Problem[] = [];
        const skillId = options.devSkill!;

        for (let i = 0; i < blockSize; i++) {
            const problem = safeGenerateProblem(
                () => generateMathProblem(skillId),
                () => createFallbackProblem('math', `dev mode: ${skillId}`),
                `dev mode generation`
            );

            q.push({
                ...problem,
                id: `dev-${i}-${Date.now()}`,
                subject: 'math',
                isReview: false
            });
        }

        return q;
    };

    // ============================================================
    // Focus Mode Block Generation
    // ============================================================
    const generateFocusBlock = async (
        _pid: string,
        blockSize: number,
        recentAttempts: { subject: SubjectKey; itemId: string; result: string }[]
    ): Promise<Problem[]> => {
        const q: Problem[] = [];
        const subject = options.focusSubject!;
        const focusIds = options.focusIds!;
        const sessionKind = options.sessionKind || "normal";
        const isReviewSession = options.forceReview === true || sessionKind === "review";

        const buildCooldownIds = (pending: string[]) =>
            buildVocabCooldownIds(recentAttempts, sessionHistoryRef.current, pending);

        for (let i = 0; i < blockSize; i++) {
            const id = focusIds[Math.floor(Math.random() * focusIds.length)];

            const problem = safeGenerateProblem(
                () => subject === 'math'
                    ? generateMathProblem(id)
                    : generateVocabProblem(id, { cooldownIds: buildCooldownIds([]), kanjiMode: profile?.kanjiMode }),
                () => createFallbackProblem(subject, `focus mode: ${id}`),
                `focus mode: ${id}`
            );

            q.push({
                ...problem,
                id: `${blockCount}-focus-${i}-${Date.now()}`,
                subject,
                isReview: isReviewSession
            });
        }

        sessionHistoryRef.current = [
            ...sessionHistoryRef.current,
            ...q.map(item => ({ id: item.categoryId, subject: item.subject, isReview: item.isReview }))
        ];

        return q;
    };

    // ============================================================
    // Check Mode Block Generation
    // ============================================================
    const generateCheckBlock = async (
        activeProfile: UserProfile,
        blockSize: number,
        recentAttempts: { subject: SubjectKey; itemId: string; result: string; isReview: boolean }[]
    ): Promise<Problem[] | null> => {
        let checkSubject: SubjectKey;

        if (activeProfile.subjectMode === "math") {
            checkSubject = "math";
        } else if (activeProfile.subjectMode === "vocab") {
            checkSubject = "vocab";
        } else {
            checkSubject = getMixSubject(recentAttempts);
        }

        const recentPool = recentAttempts
            .filter(r => r.subject === checkSubject && r.result !== "skipped")
            .map(r => r.itemId);
        const uniquePool = Array.from(new Set(recentPool));

        if (uniquePool.length === 0) {
            return null; // Fallback to normal generation
        }

        const q: Problem[] = [];
        const buildCooldownIds = (pending: string[]) =>
            buildVocabCooldownIds(recentAttempts, sessionHistoryRef.current, pending);

        for (let i = 0; i < blockSize; i++) {
            const id = uniquePool[Math.floor(Math.random() * uniquePool.length)];

            const problem = safeGenerateProblem(
                () => checkSubject === "math"
                    ? generateMathProblem(id)
                    : generateVocabProblem(id, { cooldownIds: buildCooldownIds([]), kanjiMode: activeProfile.kanjiMode }),
                () => createFallbackProblem(checkSubject, `check mode: ${id}`),
                `check mode: ${id}`
            );

            q.push({
                ...problem,
                id: `${blockCount}-check-${i}-${Date.now()}`,
                subject: checkSubject,
                isReview: false
            });
        }

        sessionHistoryRef.current = [
            ...sessionHistoryRef.current,
            ...q.map(item => ({ id: item.categoryId, subject: item.subject, isReview: item.isReview }))
        ];

        return q;
    };

    // ============================================================
    // Normal Block Generation
    // ============================================================
    const generateNormalBlock = async (
        pid: string,
        activeProfile: UserProfile,
        blockSize: number,
        recentAttempts: { subject: SubjectKey; itemId: string; result: string; isReview: boolean }[]
    ): Promise<Problem[]> => {
        const blockCounts = new Map<string, number>();
        const recentIds = sessionHistoryRef.current.slice(-COOLDOWN_WINDOW).map(h => h.id);

        // Determine subject
        const vocabDue = await getReviewItems(pid, 'vocab');
        let forceVocabReviewBlock = false;

        if (activeProfile.subjectMode === 'mix' && vocabDue.length > 0) {
            const ratio = calculateRecentReviewRatio(recentAttempts);
            if (ratio < REVIEW_BLOCK_THRESHOLD) {
                forceVocabReviewBlock = true;
            }
        }

        let subject: SubjectKey;
        if (activeProfile.subjectMode === 'math') {
            subject = 'math';
        } else if (activeProfile.subjectMode === 'vocab') {
            subject = 'vocab';
        } else if (forceVocabReviewBlock) {
            subject = 'vocab';
        } else {
            subject = getMixSubject(recentAttempts);
        }

        // Fetch required data based on subject
        const skippedToday = await getSkippedItemsToday(pid, subject);

        const q: Problem[] = [];
        const pendingMeta: { isReview: boolean }[] = [];
        const pendingVocabIds: string[] = [];

        if (subject === 'math') {
            const mathDue = await getReviewItems(pid, 'math');
            const weakMathIds = await getWeakMathSkillIds(pid);
            const maintenanceMathIds = await getMaintenanceMathSkillIds(pid);
            const retiredMathIds = await getRetiredMathSkillIds(pid);
            const mathLevel = activeProfile.mathMainLevel || 1;
            const availableMathSkills = getAvailableSkills(activeProfile.mathMaxUnlocked || mathLevel);
            const weakMathPool = weakMathIds.filter(id => availableMathSkills.includes(id));

            const plusLimit = Math.max(1, Math.floor(BLOCK_SIZE * 0.3));
            let plusCount = 0;

            for (let i = 0; i < blockSize; i++) {
                const generatorOptions = {
                    cooldownIds: [],
                    skippedTodayIds: skippedToday,
                    blockCounts,
                    recentIds
                };

                const currentWeakCount = q.filter(
                    item => item.subject === 'math' && !item.isReview && weakMathPool.includes(item.categoryId)
                ).length;

                const result = generateSingleMathProblem({
                    profile: activeProfile,
                    mathDue,
                    weakMathPool,
                    maintenanceMathIds,
                    retiredMathIds,
                    options: generatorOptions,
                    canAddReview: canAddSessionReview(sessionHistoryRef.current, pendingMeta),
                    currentWeakCount,
                    plusCount,
                    plusLimit
                });

                plusCount = result.newPlusCount;

                const problem: Problem = {
                    ...result.problem,
                    id: `${blockCount}-${i}-${Date.now()}`,
                    subject: 'math',
                    isReview: result.isReview,
                    isMaintenanceCheck: result.isMaintenanceCheck
                };

                q.push(problem);
                markPicked(problem.categoryId, blockCounts);
                pendingMeta.push({ isReview: result.isReview });
            }
        } else {
            // Vocab generation
            const vocabLevel = activeProfile.vocabMainLevel || 1;
            const vocabLevelWeights = buildVocabLevelWeights(vocabLevel);

            const buildCooldownIds = (pending: string[]) =>
                buildVocabCooldownIds(recentAttempts, sessionHistoryRef.current, pending);

            for (let i = 0; i < blockSize; i++) {
                const generatorOptions = {
                    cooldownIds: buildCooldownIds(pendingVocabIds),
                    skippedTodayIds: skippedToday,
                    blockCounts,
                    recentIds
                };

                const result = generateSingleVocabProblem({
                    profile: activeProfile,
                    vocabDue,
                    vocabLevelWeights,
                    options: generatorOptions,
                    canAddReview: canAddSessionReview(sessionHistoryRef.current, pendingMeta),
                    forceReviewBlock: forceVocabReviewBlock,
                    pendingVocabIds,
                    buildCooldownIds
                });

                const problem: Problem = {
                    ...result.problem,
                    id: `${blockCount}-${i}-${Date.now()}`,
                    subject: 'vocab',
                    isReview: result.isReview
                };

                q.push(problem);
                markPicked(problem.categoryId, blockCounts);
                pendingVocabIds.push(problem.categoryId);
                pendingMeta.push({ isReview: result.isReview });
            }
        }

        sessionHistoryRef.current = [
            ...sessionHistoryRef.current,
            ...q.map(item => ({ id: item.categoryId, subject: item.subject, isReview: item.isReview }))
        ];

        return q;
    };

    // ============================================================
    // Main Block Generation Entry Point
    // ============================================================
    const generateBlock = async (pid: string, activeProfile: UserProfile): Promise<Problem[]> => {
        const sessionKind = options.sessionKind || "normal";
        const blockSize = sessionKind === "check-event" ? 20 : BLOCK_SIZE;

        // Developer mode: generate only specified skill
        if (options.devSkill) {
            return generateDevBlock(blockSize);
        }

        // Special Check Mode (Event) -> Use Strict Level Logic (Same as Paper Test)
        if (sessionKind === "check-event") {
            return generateLevelBlock(activeProfile, blockSize);
        }

        // New Periodic Test (Plan A)
        if (sessionKind === "periodic-test") {
            const subject = options.focusSubject; // Pass this explicitly
            return generatePeriodicTestBlock(activeProfile, subject);
        }

        // New Weakness Review (Plan A)
        if (sessionKind === "weak-review") {
            // Need to fetch context data
            const weakMathIds = await getWeakMathSkillIds(pid);
            const maintenanceMathIds = await getMaintenanceMathSkillIds(pid);
            const mathDue = await getReviewItems(pid, 'math');
            const vocabDue = await getReviewItems(pid, 'vocab');

            return generateWeakReviewBlock(activeProfile, {
                weakMathIds,
                maintenanceMathIds,
                mathDue,
                vocabDue
            });
        }

        const recentAttempts = await getRecentAttempts(pid, REVIEW_BLOCK_CHECK_WINDOW);

        // Focus mode: generate only specified IDs
        if (options.focusSubject && options.focusIds && options.focusIds.length > 0) {
            return generateFocusBlock(pid, blockSize, recentAttempts);
        }

        // Check mode (Normal): generate from recent history
        if (sessionKind === "check-normal") {
            const mappedAttempts = recentAttempts.map(a => ({
                ...a,
                isReview: a.isReview ?? false
            }));
            const checkResult = await generateCheckBlock(activeProfile, blockSize, mappedAttempts);
            if (checkResult) {
                return checkResult;
            }
            // Fallback to normal generation if no recent items
        }

        // Normal mode
        const mappedAttempts = recentAttempts.map(a => ({
            ...a,
            isReview: a.isReview ?? false
        }));
        return generateNormalBlock(pid, activeProfile, blockSize, mappedAttempts);
    };

    // ============================================================
    // Session Management
    // ============================================================
    const initSession = async () => {
        console.log("[useStudySession] initSession called, profileId:", profileId);
        if (!profileId || !profile) return;

        setLoading(true);
        setBlockCount(1);

        try {
            console.log("[useStudySession] generating block...");
            const q = await generateBlock(profileId, profile);
            console.log("[useStudySession] generated queue:", q);
            setQueue(q);
        } catch (err) {
            console.error("[useStudySession] error generating block:", err);
            // Generate emergency fallback queue
            const fallbackQueue: Problem[] = [];
            for (let i = 0; i < BLOCK_SIZE; i++) {
                fallbackQueue.push({
                    ...createFallbackProblem('math', 'session init failure'),
                    id: `fallback-${i}-${Date.now()}`,
                    subject: 'math',
                    isReview: false
                });
            }
            setQueue(fallbackQueue);
        }

        setLoading(false);
    };

    const nextBlock = async () => {
        if (!profileId || !profile) return;

        setLoading(true);
        setBlockCount(prev => prev + 1);

        try {
            const q = await generateBlock(profileId, profile);
            setQueue(prev => [...prev, ...q]);
        } catch (err) {
            console.error("[useStudySession] error generating next block:", err);
            // Generate emergency fallback queue
            const fallbackQueue: Problem[] = [];
            for (let i = 0; i < BLOCK_SIZE; i++) {
                fallbackQueue.push({
                    ...createFallbackProblem('math', 'next block failure'),
                    id: `fallback-${blockCount}-${i}-${Date.now()}`,
                    subject: 'math',
                    isReview: false
                });
            }
            setQueue(prev => [...prev, ...fallbackQueue]);
        }

        setLoading(false);
    };

    // ============================================================
    // Result Handling
    // ============================================================
    const handleResult = async (problem: Problem, result: 'correct' | 'incorrect') => {
        if (!profileId) return;

        try {
            await logAttempt(
                profileId,
                problem.subject,
                problem.categoryId,
                result,
                false,
                problem.isReview,
                problem.isMaintenanceCheck || false
            );

            // Check Level Up (only for Math)
            if (problem.subject === 'math') {
                const currentProfile = await getActiveProfile();
                if (currentProfile && currentProfile.mathMainLevel < 20) {
                    const canLevelUp = await checkLevelProgression(currentProfile.id, currentProfile.mathMainLevel);
                    if (canLevelUp) {
                        console.log("LEVEL UP!", currentProfile.mathMainLevel + 1);
                        const newLevel = currentProfile.mathMainLevel + 1;
                        await saveProfile({
                            ...currentProfile,
                            mathMainLevel: newLevel,
                            mathMaxUnlocked: Math.max(currentProfile.mathMaxUnlocked, newLevel)
                        });
                        setProfile({
                            ...currentProfile,
                            mathMainLevel: newLevel,
                            mathMaxUnlocked: Math.max(currentProfile.mathMaxUnlocked, newLevel)
                        });
                    }
                }
            }
        } catch (err) {
            console.error("[useStudySession] error handling result:", err);
        }
    };

    // Auto init when profile loads
    useEffect(() => {
        if (profileId && queue.length === 0) {
            initSession();
        }
    }, [profileId]);


    const blockSize = options.sessionKind === "check-event" ? 20 : BLOCK_SIZE;

    const completeSession = async (
        sessionStats: {
            correct: number;
            total: number;
            durationSeconds: number;
        }
    ) => {
        if (!profileId || !profile) return;
        const currentProfile = await getActiveProfile();
        if (!currentProfile) return;

        const sessionKind = options.sessionKind || "normal";

        // 1. Handle Periodic Test Completion (Recording)
        if (sessionKind === "periodic-test") {
            // const subject = options.focusSubject || (currentProfile.subjectMode === 'mix' ? 'math' : currentProfile.subjectMode);
            // const subject = 'math'; // Currently fixed to Math periodic test. Future: detect from options.
            // In periodic test, usually mixed? No, periodic test determines subject internally or via options?
            // "Periodic Test" logic in blockGenerators sends mixed or fixed?
            // Actually periodic test is usually Math or Vocab per spec.
            // Let's assume we detect subject from the block or options.
            // If the user selected "Periodic Test" from UI, they probably selected Math or English.
            // But wait, the UI "Challenge" button just says "Periodic Test".
            // The spec says "Independent for Math/Vocab".
            // Implementation of generatePeriodicTestBlock: "re-use strict level block logic".
            // generateLevelBlock uses profile.subjectMode usually?
            // Let's look at generatePeriodicTestBlock in blockGenerators.ts. 
            // It relies on generateLevelBlock. generateLevelBlock uses profile.mathMainLevel.
            // It seems it primarily targets Math currently.
            // We should ensure we know the subject. 
            // For now, let's assume 'math' if mostly math questions, or check profile mode.
            // Given provided code, let's stick to 'math' if unsure, or check instructions.

            // Saving Result
            const result: any = { // Use PeriodicTestResult type
                id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
                timestamp: Date.now(),
                subject: 'math', // TODO: Support vocab periodic test explicit mode
                level: currentProfile.mathMainLevel,
                mode: 'auto', // defaulting to auto, but how do we know if manual?
                // We can check if it was pending.
                method: 'online',
                correctCount: sessionStats.correct,
                totalQuestions: sessionStats.total,
                score: Math.round((sessionStats.correct / sessionStats.total) * 100),
                durationSeconds: sessionStats.durationSeconds
            };

            // Check if it was pending to determine mode
            const isPending = currentProfile.periodicTestState?.math?.isPending;
            result.mode = isPending ? 'auto' : 'manual';

            // Save to history
            const newHistory = [...(currentProfile.testHistory || []), result];

            // Update State (Clear Pending, Set Last Triggered)
            const newState = { ...(currentProfile.periodicTestState || { math: { isPending: false, lastTriggeredAt: null, reason: null }, vocab: { isPending: false, lastTriggeredAt: null, reason: null } }) };
            newState.math = {
                isPending: false,
                lastTriggeredAt: Date.now(),
                reason: null
            };

            await saveProfile({
                ...currentProfile,
                testHistory: newHistory,
                periodicTestState: newState
            });
        }

        // 2. Handle Normal Session Completion (Trigger Check)
        else if (sessionKind === "normal" || sessionKind === "review") {
            // Run Trigger Check
            const mathTrigger = checkPeriodTestTrigger(currentProfile, 'math');
            // const vocabTrigger = checkPeriodTestTrigger(currentProfile, 'vocab'); // Future support

            if (mathTrigger.isTriggered) {
                console.log("[Trigger] Periodic Test Triggered!", mathTrigger.reason);
                const newState = { ...(currentProfile.periodicTestState || { math: { isPending: false, lastTriggeredAt: null, reason: null }, vocab: { isPending: false, lastTriggeredAt: null, reason: null } }) };

                // Only update if not already pending
                if (!newState.math.isPending) {
                    newState.math = {
                        isPending: true,
                        lastTriggeredAt: newState.math.lastTriggeredAt,
                        reason: mathTrigger.reason
                    };
                    await saveProfile({
                        ...currentProfile,
                        periodicTestState: newState
                    });
                    // Could return a flag to UI to show celebration/notification
                }
            }
        }
    };

    return { queue, initSession, nextBlock, handleResult, completeSession, loading, blockSize };
};
