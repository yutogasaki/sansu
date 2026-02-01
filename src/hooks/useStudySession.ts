import { useState, useEffect, useRef } from "react";
import { getActiveProfile, saveProfile } from "../domain/user/repository";
import { getMaintenanceMathSkillIds, getRecentAttempts, getReviewItems, getWeakMathSkillIds, logAttempt } from "../domain/learningRepository";
import { generateMathProblem } from "../domain/math";
import { generateVocabProblem } from "../domain/english/generator";
import { Problem, SubjectKey, UserProfile } from "../domain/types";
import { getAvailableSkills, getSkillsForLevel } from "../domain/math/curriculum";
import { checkLevelProgression } from "../domain/math/service";
import { getWordsByLevel } from "../domain/english/words";

const BLOCK_SIZE = 5;
const COOLDOWN_WINDOW = 5;
const SAME_ID_LIMIT = 2;
const REVIEW_BLOCK_CHECK_WINDOW = 40;
const MIX_WINDOW = 20;
const REVIEW_BLOCK_THRESHOLD = 0.5;
const SESSION_REVIEW_CAP = 0.6;
const WEAK_INJECTION_CAP = 0.3;
const MAINTENANCE_RATE = 0.01;

type SessionKind = "normal" | "review" | "weak" | "check-normal" | "check-event";

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

    // We need the active profile
    const [profileId, setProfileId] = useState<string | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);

    const sessionHistoryRef = useRef<{ id: string; subject: SubjectKey; isReview: boolean }[]>([]);

    useEffect(() => {
        console.log("[useStudySession] fetching profile...");
        getActiveProfile().then(p => {
            console.log("[useStudySession] profile:", p);
            if (p) {
                setProfileId(p.id);
                setProfile(p);
            } else {
                // プロファイルがない場合もloadingを解除
                console.log("[useStudySession] no profile found");
                setLoading(false);
            }
        }).catch(err => {
            console.error("[useStudySession] error fetching profile:", err);
            setLoading(false);
        });
    }, []);

    const generateBlock = async (pid: string, activeProfile: UserProfile) => {
        const blockSize = options.sessionKind === "check-event" ? 8 : BLOCK_SIZE;
        const recentAttempts = await getRecentAttempts(pid, REVIEW_BLOCK_CHECK_WINDOW);

        const buildVocabCooldownIds = (pendingIds: string[] = []) => {
            const ids: string[] = [];
            const seen = new Set<string>();

            const push = (id: string) => {
                if (!seen.has(id)) {
                    seen.add(id);
                    ids.push(id);
                }
            };

            recentAttempts
                .filter(r => r.subject === 'vocab' && r.result !== 'skipped')
                .slice(0, 10)
                .forEach(r => push(r.itemId));

            sessionHistoryRef.current
                .filter(h => h.subject === 'vocab')
                .slice(-10)
                .forEach(h => push(h.id));

            pendingIds.forEach(id => push(id));

            return ids;
        };

        const recentReviewRatio = () => {
            if (recentAttempts.length === 0) return 0;
            const reviewCount = recentAttempts.filter(r => r.isReview).length;
            return reviewCount / recentAttempts.length;
        };

        const getMixSubject = (): SubjectKey => {
            const recent = recentAttempts.slice(0, MIX_WINDOW);
            const nonReview = recent.filter(r => !r.isReview);
            if (nonReview.length < 5) {
                return Math.random() > 0.5 ? 'math' : 'vocab';
            }
            const mathCount = nonReview.filter(r => r.subject === 'math').length;
            const ratio = mathCount / nonReview.length;
            if (ratio > 0.7) return 'vocab';
            if (ratio < 0.3) return 'math';
            return Math.random() > 0.5 ? 'math' : 'vocab';
        };

        const canAddSessionReview = (pending: { isReview: boolean }[]) => {
            const history = sessionHistoryRef.current;
            const total = history.length + pending.length;
            if (total === 0) return true;
            const reviewCount = history.filter(h => h.isReview).length + pending.filter(p => p.isReview).length;
            return reviewCount / total < SESSION_REVIEW_CAP;
        };

        const vocabLevel = activeProfile.vocabMainLevel || 1;

        const vocabLevelWeights: { level: number; weight: number }[] = [
            { level: vocabLevel, weight: 0.5 },
            { level: vocabLevel - 1, weight: 0.25 },
            { level: vocabLevel - 2, weight: 0.15 },
            { level: vocabLevel - 3, weight: 0.1 }
        ].filter(w => w.level >= 1);

        const pickWeightedLevel = () => {
            const totalWeight = vocabLevelWeights.reduce((sum, w) => sum + w.weight, 0);
            let r = Math.random() * totalWeight;
            for (const w of vocabLevelWeights) {
                r -= w.weight;
                if (r <= 0) return w.level;
            }
            return vocabLevelWeights[0]?.level || vocabLevel;
        };

        // 開発者モード: 指定されたスキルのみで問題を生成
        if (options.devSkill) {
            const q: Problem[] = [];
            for (let i = 0; i < blockSize; i++) {
                try {
                    const partialProblem = generateMathProblem(options.devSkill);
                    q.push({
                        ...partialProblem,
                        id: `dev-${i}-${Date.now()}`,
                        subject: 'math',
                        isReview: false
                    });
                } catch (e) {
                    console.error("Dev mode generation error:", e);
                }
            }
            return q;
        }

        const q: Problem[] = [];
        const sessionKind = options.sessionKind || "normal";

        if (options.focusSubject && options.focusIds && options.focusIds.length > 0) {
            const subject = options.focusSubject;
            const focusIds = options.focusIds;
            for (let i = 0; i < blockSize; i++) {
                const id = focusIds[Math.floor(Math.random() * focusIds.length)];
                const isReviewItem = options.forceReview === true || sessionKind === "review";
                try {
                    const partialProblem =
                        subject === 'math'
                            ? generateMathProblem(id)
                            : generateVocabProblem(id, {
                                cooldownIds: buildVocabCooldownIds([])
                            });
                    q.push({
                        ...partialProblem,
                        id: `${blockCount}-focus-${i}-${Date.now()}`,
                        subject,
                        isReview: isReviewItem
                    });
                } catch (e) {
                    console.error(e);
                }
            }
            sessionHistoryRef.current = [
                ...sessionHistoryRef.current,
                ...q.map(item => ({ id: item.categoryId, subject: item.subject, isReview: item.isReview }))
            ];
            return q;
        }

        if (sessionKind.startsWith("check")) {
            let checkSubject: SubjectKey;
            if (activeProfile.subjectMode === "math") {
                checkSubject = "math";
            } else if (activeProfile.subjectMode === "vocab") {
                checkSubject = "vocab";
            } else {
                checkSubject = getMixSubject();
            }

            const recentPool = recentAttempts
                .filter(r => r.subject === checkSubject && r.result !== "skipped")
                .map(r => r.itemId);
            const uniquePool = Array.from(new Set(recentPool));

            if (uniquePool.length > 0) {
                for (let i = 0; i < blockSize; i++) {
                    const id = uniquePool[Math.floor(Math.random() * uniquePool.length)];
                    try {
                        const partialProblem =
                            checkSubject === "math"
                                ? generateMathProblem(id)
                                : generateVocabProblem(id, { cooldownIds: buildVocabCooldownIds([]) });
                        q.push({
                            ...partialProblem,
                            id: `${blockCount}-check-${i}-${Date.now()}`,
                            subject: checkSubject,
                            isReview: false
                        });
                    } catch (e) {
                        console.error(e);
                    }
                }
                sessionHistoryRef.current = [
                    ...sessionHistoryRef.current,
                    ...q.map(item => ({ id: item.categoryId, subject: item.subject, isReview: item.isReview }))
                ];
                return q;
            }
            // Fallback: no recent items, continue to normal generation
        }

        const blockCounts = new Map<string, number>();
        const recentIds = sessionHistoryRef.current.slice(-COOLDOWN_WINDOW).map(h => h.id);

        const pickId = (candidates: string[]) => {
            const notOverused = candidates.filter(id => (blockCounts.get(id) || 0) < SAME_ID_LIMIT);
            if (notOverused.length === 0) return undefined;
            const cooled = notOverused.filter(id => !recentIds.includes(id));
            const pool = cooled.length > 0 ? cooled : notOverused;
            return pool[Math.floor(Math.random() * pool.length)];
        };

        const markPicked = (id: string) => {
            blockCounts.set(id, (blockCounts.get(id) || 0) + 1);
        };

        const vocabDue = await getReviewItems(pid, 'vocab');
        let forceVocabReviewBlock = false;

        if (activeProfile.subjectMode === 'mix' && vocabDue.length > 0) {
            const ratio = recentReviewRatio();
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
            subject = getMixSubject();
        }

        const mathLevel = activeProfile.mathMainLevel || 1;
        const nextMathLevel = activeProfile.mathMaxUnlocked >= mathLevel + 1 ? mathLevel + 1 : mathLevel;

        const pendingMeta: { isReview: boolean }[] = [];
        const pendingVocabIds: string[] = [];
        const mathDue = subject === 'math' ? await getReviewItems(pid, 'math') : [];
        const weakMathIds = subject === 'math' ? await getWeakMathSkillIds(pid) : [];
        const maintenanceMathIds = subject === 'math' ? await getMaintenanceMathSkillIds(pid) : [];
        const availableMathSkills = subject === 'math' ? getAvailableSkills(activeProfile.mathMaxUnlocked || mathLevel) : [];
        const weakMathPool = subject === 'math'
            ? weakMathIds.filter(id => availableMathSkills.includes(id))
            : [];

        let plusCount = 0;
        const plusLimit = Math.max(1, Math.floor(BLOCK_SIZE * 0.3));

        for (let i = 0; i < blockSize; i++) {
            let partialProblem: Omit<Problem, 'id' | 'subject' | 'isReview'> | undefined;
            let isReviewItem = false;

            if (subject === 'vocab') {
                if (forceVocabReviewBlock && vocabDue.length > 0 && canAddSessionReview(pendingMeta)) {
                    const dueId = pickId(vocabDue.map(v => v.id));
                    if (dueId) {
                        isReviewItem = true;
                        try {
                            partialProblem = generateVocabProblem(dueId, {
                                cooldownIds: buildVocabCooldownIds(pendingVocabIds)
                            });
                        } catch (e) {
                            console.error("Vocab Generation Error", e);
                            partialProblem = generateVocabProblem(vocabDue[0].id, {
                                cooldownIds: buildVocabCooldownIds(pendingVocabIds)
                            });
                        }
                    } else {
                        // Fallback to normal vocab generation
                        const level = pickWeightedLevel();
                        const words = getWordsByLevel(level);
                        const wordId = pickId(words.map(w => w.id)) || words[0]?.id;
                        if (!wordId) {
                            partialProblem = {
                                categoryId: "error",
                                questionText: "Error",
                                inputType: "choice",
                                inputConfig: { choices: [{ label: "Error", value: "error" }] },
                                correctAnswer: "error"
                            } as any;
                        } else {
                            partialProblem = generateVocabProblem(wordId, {
                                cooldownIds: buildVocabCooldownIds(pendingVocabIds)
                            });
                        }
                    }
                } else {
                    const level = pickWeightedLevel();
                    const words = getWordsByLevel(level);
                    const wordId = pickId(words.map(w => w.id)) || words[0]?.id;
                    if (!wordId) {
                        partialProblem = {
                            categoryId: "error",
                            questionText: "Error",
                            inputType: "choice",
                            inputConfig: { choices: [{ label: "Error", value: "error" }] },
                            correctAnswer: "error"
                        } as any;
                    } else {
                        partialProblem = generateVocabProblem(wordId, {
                            cooldownIds: buildVocabCooldownIds(pendingVocabIds)
                        });
                    }
                }
            } else {
                if (mathDue.length > 0 && canAddSessionReview(pendingMeta)) {
                    const dueId = pickId(mathDue.map(v => v.id));
                    if (dueId) {
                        isReviewItem = true;
                        try {
                            partialProblem = generateMathProblem(dueId);
                        } catch (e) {
                            console.error(e);
                            partialProblem = generateMathProblem("count_10");
                        }
                    }
                }

                if (!isReviewItem) {
                    const weakLimit = Math.max(1, Math.floor(BLOCK_SIZE * WEAK_INJECTION_CAP));
                    const weakCount = q.filter(item => item.subject === 'math' && !item.isReview && weakMathPool.includes(item.categoryId)).length;
                    const canUseWeak = weakMathPool.length > 0 && weakCount < weakLimit;
                    const useWeak = canUseWeak && Math.random() < WEAK_INJECTION_CAP;
                    const useMaintenance = maintenanceMathIds.length > 0 && Math.random() < MAINTENANCE_RATE;

                    if (useMaintenance) {
                        const maintenanceId = pickId(maintenanceMathIds);
                        if (maintenanceId) {
                            try {
                                partialProblem = generateMathProblem(maintenanceId);
                            } catch (e) {
                                console.error(e);
                                partialProblem = generateMathProblem("count_10");
                            }
                        }
                    }

                    if (!partialProblem && useWeak) {
                        const weakId = pickId(weakMathPool);
                        if (weakId) {
                            try {
                                partialProblem = generateMathProblem(weakId);
                            } catch (e) {
                                console.error(e);
                                partialProblem = generateMathProblem("count_10");
                            }
                        }
                    }

                    if (!partialProblem) {
                        const usePlus = nextMathLevel !== mathLevel && plusCount < plusLimit && Math.random() < 0.3;
                        const targetLevel = usePlus ? nextMathLevel : mathLevel;
                        const levelSkills = getSkillsForLevel(targetLevel);
                        const skills = levelSkills.length > 0 ? levelSkills : getSkillsForLevel(1);
                        const skillId = pickId(skills) || skills[0];
                        if (skillId) {
                            try {
                                partialProblem = generateMathProblem(skillId);
                            } catch (e) {
                                console.error(e);
                                partialProblem = generateMathProblem("count_10");
                            }
                            if (usePlus) plusCount += 1;
                        } else {
                            partialProblem = generateMathProblem("count_10");
                        }
                    }
                }
            }

            // Ensure partialProblem is not undefined
            if (!partialProblem) {
                // Should not happen, but as a safe fallback
                partialProblem = {
                    categoryId: "error",
                    questionText: "Error",
                    inputType: "choice",
                    inputConfig: { choices: [{ label: "Error", value: "error" }] },
                    correctAnswer: "error"
                } as any;
            }

            q.push({
                ...partialProblem!,
                id: `${blockCount}-${i}-${Date.now()}`,
                subject,
                isReview: isReviewItem
            });

            markPicked(q[q.length - 1].categoryId);
            if (subject === 'vocab') {
                pendingVocabIds.push(q[q.length - 1].categoryId);
            }
            pendingMeta.push({ isReview: isReviewItem });
        }

        sessionHistoryRef.current = [
            ...sessionHistoryRef.current,
            ...q.map(item => ({ id: item.categoryId, subject: item.subject, isReview: item.isReview }))
        ];

        return q;
    };

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
        }
        setLoading(false);
    };

    const nextBlock = async () => {
        if (!profileId || !profile) return;
        setLoading(true);
        setBlockCount(prev => prev + 1);
        const q = await generateBlock(profileId, profile);
        setQueue(prev => [...prev, ...q]);
        setLoading(false);
    };

    // Wrapper for logging
    const handleResult = async (problem: Problem, result: 'correct' | 'incorrect') => {
        if (!profileId) return;

        // Log to DB
        await logAttempt(profileId, problem.subject, problem.categoryId, result, false, problem.isReview);

        // Check Level Up (only for Math Correct answers)
        if (problem.subject === 'math') {
            const profile = await getActiveProfile();
            if (profile && profile.mathMainLevel < 20) {
                const canLevelUp = await checkLevelProgression(profile.id, profile.mathMainLevel);
                if (canLevelUp) {
                    console.log("LEVEL UP!", profile.mathMainLevel + 1);
                    // Update Profile
                    const newLevel = profile.mathMainLevel + 1;
                    await saveProfile({
                        ...profile,
                        mathMainLevel: newLevel,
                        mathMaxUnlocked: Math.max(profile.mathMaxUnlocked, newLevel)
                    });
                    setProfile({
                        ...profile,
                        mathMainLevel: newLevel,
                        mathMaxUnlocked: Math.max(profile.mathMaxUnlocked, newLevel)
                    });
                    // Ideally notify user via specific UI state/toast
                    // For now, next block will use new level logic
                }
            }
        }
    };

    // Auto init when profile loads
    useEffect(() => {
        if (profileId && queue.length === 0) {
            initSession();
        }
    }, [profileId]);

    const blockSize = options.sessionKind === "check-event" ? 8 : BLOCK_SIZE;

    return { queue, initSession, nextBlock, handleResult, loading, blockSize };
};
