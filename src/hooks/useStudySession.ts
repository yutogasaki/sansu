import { useState, useEffect, useRef, useCallback } from "react";
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
import { checkLevelProgression, checkMathMainPromotion } from "../domain/math/service";
import { checkVocabMainPromotion, checkVocabUnlockReadiness } from "../domain/english/service";
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
    generateWeakReviewBlock
} from "./blockGenerators";
import { checkPeriodTestTrigger } from "../domain/test/trigger";
import { ensurePeriodicTestSet } from "../domain/test/testSet";

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
    const profileRef = useRef<UserProfile | null>(null);

    const sessionHistoryRef = useRef<SessionHistoryItem[]>([]);

    // profileRef と state を同時に更新するヘルパー
    const updateProfile = useCallback((p: UserProfile | null) => {
        profileRef.current = p;
        setProfile(p);
    }, []);

    // Profile fetching with error handling
    useEffect(() => {
        console.log("[useStudySession] fetching profile...");
        getActiveProfile()
            .then(p => {
                console.log("[useStudySession] profile:", p);
                if (p) {
                    setProfileId(p.id);
                    updateProfile(p);
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
        recentAttempts: { subject: SubjectKey; itemId: string; result: string; skipped?: boolean }[]
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
                    : generateVocabProblem(id, { cooldownIds: buildCooldownIds([]), kanjiMode: profileRef.current?.kanjiMode }),
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
        recentAttempts: { subject: SubjectKey; itemId: string; result: string; isReview: boolean; skipped?: boolean }[]
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
        recentAttempts: { subject: SubjectKey; itemId: string; result: string; isReview: boolean; skipped?: boolean }[]
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
            const subject: SubjectKey =
                options.focusSubject ||
                (activeProfile.subjectMode === "vocab" ? "vocab" : "math");
            const set = await ensurePeriodicTestSet(activeProfile, subject);
            return set.problems.map((p, i) => ({
                ...p,
                id: `test-${i}-${Date.now()}`,
                subject,
                isReview: false
            }));
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
        if (!profileId) return;

        setLoading(true);
        setBlockCount(prev => prev + 1);

        try {
            // DBから最新プロファイルを取得（レベルアップ等の反映）
            const latestProfile = await getActiveProfile();
            const activeProfile = latestProfile || profileRef.current;
            if (!activeProfile) { setLoading(false); return; }
            updateProfile(activeProfile);

            const q = await generateBlock(profileId, activeProfile);
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

            const currentProfile = await getActiveProfile();
            if (!currentProfile) return;

            const ensureMainEnabled = (levels: typeof currentProfile.mathLevels, mainLevel: number) => {
                if (!levels) return levels;
                const hasEnabled = levels.some(l => l.enabled);
                if (hasEnabled) return levels;
                return levels.map(l => (l.level === mainLevel ? { ...l, enabled: true } : l));
            };

            const unlockNextLevelIfReady = async (subject: SubjectKey, p: UserProfile) => {
                if (subject === 'math') {
                    if (p.mathMainLevel >= 20) return p;
                    if (p.mathMaxUnlocked !== p.mathMainLevel) return p;
                    const canUnlock = await checkLevelProgression(p.id, p.mathMainLevel);
                    if (!canUnlock) return p;
                    const nextLevel = Math.min(20, p.mathMaxUnlocked + 1);
                    const mathLevels = p.mathLevels
                        ? p.mathLevels.map(l => (l.level <= nextLevel ? { ...l, unlocked: true } : l))
                        : p.mathLevels;
                    return { ...p, mathMaxUnlocked: nextLevel, mathLevels };
                }

                if (p.vocabMainLevel >= 20) return p;
                if (p.vocabMaxUnlocked !== p.vocabMainLevel) return p;
                if (!checkVocabUnlockReadiness(p)) return p;
                const nextLevel = Math.min(20, p.vocabMaxUnlocked + 1);
                const vocabLevels = p.vocabLevels
                    ? p.vocabLevels.map(l => (l.level <= nextLevel ? { ...l, unlocked: true } : l))
                    : p.vocabLevels;
                return { ...p, vocabMaxUnlocked: nextLevel, vocabLevels };
            };

            const promoteMainLevelIfReady = async (subject: SubjectKey, p: UserProfile) => {
                if (subject === 'math') {
                    if (p.mathMaxUnlocked <= p.mathMainLevel) return p;
                    const canPromote = await checkMathMainPromotion(p, p.mathMaxUnlocked);
                    if (!canPromote) return p;
                    const nextMain = p.mathMaxUnlocked;
                    const mathLevels = p.mathLevels
                        ? ensureMainEnabled(
                            p.mathLevels.map(l =>
                                l.level === nextMain
                                    ? { ...l, enabled: true, recentAnswersNonReview: [] }
                                    : l
                            ),
                            nextMain
                        )
                        : p.mathLevels;
                    // レベルアップ通知を設定（ホーム画面でモーダル表示）
                    return {
                        ...p,
                        mathMainLevel: nextMain,
                        mathMainLevelStartedAt: new Date().toISOString(),
                        mathLevels,
                        pendingLevelUpNotification: {
                            subject: 'math' as const,
                            newLevel: nextMain,
                            achievedAt: new Date().toISOString()
                        }
                    };
                }

                const canPromote = await checkVocabMainPromotion(p);
                if (!canPromote) return p;
                const nextMain = p.vocabMaxUnlocked;
                const vocabLevels = p.vocabLevels
                    ? ensureMainEnabled(
                        p.vocabLevels.map(l =>
                            l.level === nextMain
                                ? { ...l, enabled: true, recentAnswersNonReview: [] }
                                : l
                        ),
                        nextMain
                    )
                    : p.vocabLevels;
                // レベルアップ通知を設定（ホーム画面でモーダル表示）
                return {
                    ...p,
                    vocabMainLevel: nextMain,
                    vocabMainLevelStartedAt: new Date().toISOString(),
                    vocabLevels,
                    pendingLevelUpNotification: {
                        subject: 'vocab' as const,
                        newLevel: nextMain,
                        achievedAt: new Date().toISOString()
                    }
                };
            };

            let updatedProfile = await unlockNextLevelIfReady(problem.subject, currentProfile);
            updatedProfile = await promoteMainLevelIfReady(problem.subject, updatedProfile);

            if (updatedProfile !== currentProfile) {
                await saveProfile(updatedProfile);
                updateProfile(updatedProfile);
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
            const subject: SubjectKey =
                options.focusSubject ||
                (currentProfile.subjectMode === "vocab" ? "vocab" : "math");
            const testSet = currentProfile.periodicTestSets?.[subject];
            const level = testSet?.level ?? (subject === "math" ? currentProfile.mathMainLevel : currentProfile.vocabMainLevel);

            // Saving Result
            const result: any = { // Use PeriodicTestResult type
                id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
                timestamp: Date.now(),
                subject,
                level,
                mode: 'auto', // defaulting to auto, but how do we know if manual?
                // We can check if it was pending.
                method: 'online',
                correctCount: sessionStats.correct,
                totalQuestions: sessionStats.total,
                score: Math.round((sessionStats.correct / sessionStats.total) * 100),
                durationSeconds: sessionStats.durationSeconds
            };

            // Check if it was pending to determine mode
            const isPending = currentProfile.periodicTestState?.[subject]?.isPending;
            result.mode = isPending ? 'auto' : 'manual';

            // Save to history
            const newHistory = [...(currentProfile.testHistory || []), result];

            // Update State (Clear Pending, Set Last Triggered)
            const newState = { ...(currentProfile.periodicTestState || { math: { isPending: false, lastTriggeredAt: null, reason: null }, vocab: { isPending: false, lastTriggeredAt: null, reason: null } }) };
            newState[subject] = {
                isPending: false,
                lastTriggeredAt: Date.now(),
                reason: null
            };

            const nextSets = { ...(currentProfile.periodicTestSets || {}) };
            delete nextSets[subject];

            await saveProfile({
                ...currentProfile,
                testHistory: newHistory,
                periodicTestState: newState,
                periodicTestSets: nextSets
            });
        }

        // 2. Handle Normal Session Completion (Trigger Check)
        else if (sessionKind === "normal" || sessionKind === "review") {
            // Run Trigger Check
            const mathTrigger = await checkPeriodTestTrigger(currentProfile, 'math');
            // const vocabTrigger = await checkPeriodTestTrigger(currentProfile, 'vocab'); // Future support

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
