import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import { useStudySession } from "../hooks/useStudySession";
import { useHissanSession } from "../hooks/useHissanSession";
import { playSound, setSoundEnabled } from "../utils/audio";
import { getActiveProfile, saveProfile } from "../domain/user/repository";
import { logAttempt } from "../domain/learningRepository";
import { StudyLayout } from "./StudyLayout";
import { speakEnglish, warmUpTTS } from "../utils/tts";

const IS_DEV = import.meta.env.DEV;

export const Study: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const devSkill = searchParams.get("dev_skill") || undefined;
    const focusSubject = searchParams.get("focus_subject") as "math" | "vocab" | null;
    const focusIdsParam = searchParams.get("focus_ids");
    const forceReview = searchParams.get("force_review") === "1";
    const sessionKindParam = searchParams.get("session") as
        | "normal"
        | "review"
        | "weak"
        | "check-normal"
        | "check-event"
        | "weak-review"
        | "periodic-test"
        | null;

    const focusIds = focusIdsParam ? focusIdsParam.split(",").filter(Boolean) : undefined;

    const { queue, nextBlock, handleResult, completeSession, loading, blockSize } = useStudySession({
        devSkill,
        focusSubject: focusSubject || undefined,
        focusIds,
        forceReview,
        sessionKind: sessionKindParam || "normal"
    });

    // State
    const [currentIndex, setCurrentIndex] = useState(0);                    // 0-4
    const [userInput, setUserInput] = useState("");                         // Single input
    const [userInputs, setUserInputs] = useState<string[]>([]);             // Multi input
    const [activeFieldIndex, setActiveFieldIndex] = useState(0);            // Focus for multi

    const [feedback, setFeedback] = useState<"none" | "correct" | "incorrect" | "skipped">("none");
    const [showCorrection, setShowCorrection] = useState(false);


    // Processing Lock (Ref) to Prevent Double Submission / Spamming
    const isProcessingRef = React.useRef(false);

    // 問題表示時刻を記録（回答時間計測用）
    const problemShownAtRef = React.useRef<number>(Date.now());

    // UI State for Block Transition
    const [isFinished, setIsFinished] = useState(false);

    // ちからチェック用：正答数トラッキング
    const [correctCount, setCorrectCount] = useState(0);
    const [sessionResult, setSessionResult] = useState<{ correct: number; total: number; durationSeconds: number } | null>(null);
    const [testTimeLimitSeconds, setTestTimeLimitSeconds] = useState<number | undefined>(undefined);
    const [testRemainingSeconds, setTestRemainingSeconds] = useState<number | undefined>(undefined);
    const hasCompletedFixedSessionRef = React.useRef(false);

    // Profile ID for skip logging
    const [profileId, setProfileId] = useState<string | null>(null);
    const [englishAutoRead, setEnglishAutoRead] = useState(false);
    const [isEasyText, setIsEasyText] = useState(false);
    const [hissanModeEnabled, setHissanModeEnabled] = useState(false);

    const currentProblem = queue[currentIndex];

    // Hissan Session
    const hissan = useHissanSession();

    // Warm up TTS on mount (uses the user interaction context from navigation tap)
    useEffect(() => {
        warmUpTTS();
    }, []);

    // Sync Audio Settings & Profile ID
    useEffect(() => {
        getActiveProfile().then(profile => {
            if (profile) {
                setSoundEnabled(profile.soundEnabled);
                setProfileId(profile.id);
                setEnglishAutoRead(profile.englishAutoRead || false);
                setIsEasyText(profile.uiTextMode === "easy");
                setHissanModeEnabled(profile.hissanModeEnabled ?? true);
                setTestTimeLimitSeconds(profile.periodicTestTimeLimitSeconds);
            }
        });
    }, []);

    // Toggle TTS and persist to profile
    const handleToggleTTS = async () => {
        const newValue = !englishAutoRead;
        setEnglishAutoRead(newValue);
        if (newValue && currentProblem?.subject === "vocab" && currentProblem.questionText) {
            speakEnglish(currentProblem.questionText);
        }
        const profile = await getActiveProfile();
        if (profile) {
            await saveProfile({ ...profile, englishAutoRead: newValue });
        }
    };

    // Reset inputs when problem changes
    useEffect(() => {
        if (!currentProblem) return;
        setUserInput("");
        if (currentProblem.inputType === 'multi-number' && currentProblem.inputConfig?.fields) {
            setUserInputs(new Array(currentProblem.inputConfig.fields.length).fill(""));
            setActiveFieldIndex(0);
        } else {
            setUserInputs([]);
        }
        setFeedback("none");
        setShowCorrection(false);
        isProcessingRef.current = false;

        // 筆算モードリセット
        hissan.resetHissan(currentProblem, hissanModeEnabled);
    }, [currentProblem, hissanModeEnabled]);

    // Check for pause (every 100 questions) or pre-fetch
    useEffect(() => {
        if (!queue.length) return;

        // 1. Pre-fetch when running low (less than 3 items remaining)
        if (!loading && queue.length - currentIndex < 3) {
            if (IS_DEV) console.log("Pre-fetching next block...");
            nextBlock();
        }

        // 2. Pause every 100 questions (Endless Mode Break)
        // Check if we just completed a multiple of 100
        // Trigger condition: currentIndex > 0 and currentIndex % 100 === 0
        // We use isFinished state to show the "Break" screen
        // But we need to distinguish "Break" from "Done"
        // Actually, let's use isFinished=true to show the interstitial, but customize message based on count?
        // Or simply pause.

        // For this implementation, we will ONLY pause at 100 questions.
        // We do NOT stop at block end anymore.

        if (currentIndex > 0 && currentIndex % 100 === 0 && !isFinished) {
            setIsFinished(true); // Show break screen
        } else if (isFinished && currentIndex % 100 !== 0) {
            setIsFinished(false); // Resume if we moved past (e.g. user clicked continue)
        }

    }, [currentIndex, queue.length, loading, nextBlock, isFinished]);

    // Session Start Time Tracking
    const startTimeRef = React.useRef(0);
    useEffect(() => {
        startTimeRef.current = Date.now();
        hasCompletedFixedSessionRef.current = false;
    }, []);

    const finalizeFixedSession = useCallback(async (timedOut = false) => {
        const isFixedSession = sessionKindParam === "periodic-test" || sessionKindParam === "weak-review" || sessionKindParam === "check-event";
        if (!isFixedSession || loading || hasCompletedFixedSessionRef.current) return;
        hasCompletedFixedSessionRef.current = true;

        const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
        const stats = {
            correct: correctCount,
            total: blockSize,
            durationSeconds,
            timeLimitSeconds: sessionKindParam === "periodic-test" ? testTimeLimitSeconds : undefined,
            timedOut: sessionKindParam === "periodic-test" ? timedOut : undefined,
        };

        if (sessionKindParam === "periodic-test") {
            setSessionResult({ correct: correctCount, total: blockSize, durationSeconds });
            setIsFinished(true);
        }

        if (completeSession) {
            await completeSession(stats);
        }

        if (sessionKindParam !== "periodic-test") {
            navigate('/stats');
        }
    }, [sessionKindParam, loading, correctCount, blockSize, testTimeLimitSeconds, completeSession, navigate]);

    useEffect(() => {
        if (sessionKindParam !== "periodic-test" || typeof testTimeLimitSeconds !== "number") {
            setTestRemainingSeconds(undefined);
            return;
        }

        const tick = () => {
            const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
            const remaining = Math.max(0, testTimeLimitSeconds - elapsed);
            setTestRemainingSeconds(remaining);
            if (remaining <= 0) {
                void finalizeFixedSession(true);
            }
        };

        tick();
        const timerId = window.setInterval(tick, 1000);
        return () => window.clearInterval(timerId);
    }, [sessionKindParam, testTimeLimitSeconds, finalizeFixedSession]);

    // Check for Fixed Session Completion (Periodic Test / Weak Review / Check Event)
    useEffect(() => {
        const isFixedSession = sessionKindParam === "periodic-test" || sessionKindParam === "weak-review" || sessionKindParam === "check-event";

        if (isFixedSession && currentIndex >= blockSize && blockSize > 0 && !loading) {
            if (IS_DEV) console.log("Fixed Session Complete!", { correctCount, blockSize });
            void finalizeFixedSession(false);
        }
    }, [currentIndex, blockSize, sessionKindParam, loading, correctCount, finalizeFixedSession]);

    // Handlers - 全てのフックより前に定義
    const handleTenKeyInput = useCallback((val: string | number) => {
        const valStr = val.toString();
        if (feedback !== "none" || isProcessingRef.current) return;
        playSound("tap");

        if (currentProblem?.inputType === 'multi-number' && currentProblem.inputConfig?.fields) {
            const fields = currentProblem.inputConfig.fields;
            const currentFieldLength = fields[activeFieldIndex]?.length || 3;

            setUserInputs(prev => {
                const newInputs = [...prev];
                if (newInputs[activeFieldIndex].length < currentFieldLength) {
                    newInputs[activeFieldIndex] += valStr;

                    if (newInputs[activeFieldIndex].length >= currentFieldLength) {
                        if (activeFieldIndex < fields.length - 1) {
                            setTimeout(() => setActiveFieldIndex(activeFieldIndex + 1), 50);
                        }
                    }
                }
                return newInputs;
            });
        } else {
            if (userInput.length < 8) {
                setUserInput(prev => prev + valStr);
            }
        }
    }, [feedback, currentProblem, activeFieldIndex, userInput.length]);

    const handleBackspace = useCallback(() => {
        if (feedback !== "none" || isProcessingRef.current) return;
        playSound("tap");

        if (currentProblem?.inputType === 'multi-number') {
            setUserInputs(prev => {
                const newInputs = [...prev];
                newInputs[activeFieldIndex] = newInputs[activeFieldIndex].slice(0, -1);
                return newInputs;
            });
        } else {
            setUserInput(prev => prev.slice(0, -1));
        }
    }, [feedback, currentProblem, activeFieldIndex]);

    const handleClear = useCallback(() => {
        if (feedback !== "none" || isProcessingRef.current) return;
        if (currentProblem?.inputType === 'multi-number') {
            setUserInputs(prev => {
                const newInputs = [...prev];
                newInputs[activeFieldIndex] = "";
                return newInputs;
            });
        } else {
            setUserInput("");
        }
    }, [feedback, currentProblem, activeFieldIndex]);

    const handleCursorMove = useCallback((direction: "left" | "right") => {
        if (feedback !== "none") return;
        if (currentProblem?.inputType === 'multi-number' && currentProblem.inputConfig?.fields) {
            const maxIndex = currentProblem.inputConfig.fields.length - 1;
            if (direction === "right") {
                setActiveFieldIndex(prev => Math.min(prev + 1, maxIndex));
            } else {
                setActiveFieldIndex(prev => Math.max(prev - 1, 0));
            }
        }
    }, [feedback, currentProblem]);

    const nextProblem = useCallback(() => {
        setFeedback("none");
        setShowCorrection(false);
        setUserInput("");
        setCurrentIndex(prev => prev + 1);
        problemShownAtRef.current = Date.now();
        // Note: isProcessingRef reset is handled in the effect when currentProblem changes
    }, []);

    // Submitting - useEffectより前に定義
    const handleSubmit = useCallback(async (choiceValue?: string) => {
        if (feedback !== "none" || !currentProblem) return;

        // 筆算モードの場合はhissanEnterを使う
        if (hissan.isHissanActive && hissan.gridData) {
            const result = hissan.handleHissanEnter();
            if (result === 'all-correct') {
                // 全ステップ正解 → 通常の正解処理
                isProcessingRef.current = true;
                const timeMs = Date.now() - problemShownAtRef.current;
                setFeedback("correct");
                playSound("correct");
                handleResult(currentProblem, 'correct', timeMs);
                setCorrectCount(prev => prev + 1);
                setTimeout(() => { nextProblem(); }, 500);
            } else if (result === 'step-correct') {
                playSound("correct");
            } else {
                playSound("incorrect");
            }
            return;
        }

        isProcessingRef.current = true;
        let isCorrect = false;

        if (currentProblem.inputType === "choice") {
            isCorrect = choiceValue === currentProblem.correctAnswer;
        } else if (currentProblem.inputType === "multi-number") {
            const correctArr = currentProblem.correctAnswer as string[];
            if (correctArr.length !== userInputs.length) {
                isCorrect = false;
            } else {
                isCorrect = userInputs.every((val, idx) => val === correctArr[idx]);
            }
        } else {
            isCorrect = userInput === currentProblem.correctAnswer;
        }

        const timeMs = Date.now() - problemShownAtRef.current;

        if (isCorrect) {
            setFeedback("correct");
            playSound("correct");
            handleResult(currentProblem, 'correct', timeMs);
            setCorrectCount(prev => prev + 1);

            setTimeout(() => {
                nextProblem();
            }, 500);
        } else {
            setFeedback("incorrect");
            playSound("incorrect");
            handleResult(currentProblem, 'incorrect', timeMs);

            setShowCorrection(true);
            // Auto-advance removed. User must click Next.
        }
    }, [feedback, currentProblem, userInput, userInputs, handleResult, nextProblem, hissan]);

    // スキップ処理（仕様 4.7）
    const handleSkip = useCallback(async () => {
        if (feedback !== "none" || !currentProblem || !profileId || isProcessingRef.current) return;

        isProcessingRef.current = true;

        setFeedback("skipped");
        setShowCorrection(true);
        playSound("incorrect");

        // スキップをログ（strength=1にリセット、不正解扱い）
        await logAttempt(profileId, currentProblem.subject, currentProblem.categoryId, 'incorrect', true, currentProblem.isReview);

        // Auto-advance removed. User must click Next.
    }, [feedback, currentProblem, profileId]);

    // 左スワイプでスキップ
    const swipeHandlers = useSwipeable({
        onSwipedLeft: () => handleSkip(),
        trackMouse: false,
        preventScrollOnSwipe: true,
    });

    // PCキーボード操作（仕様 4.2）
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (feedback !== "none") return;
            if (!currentProblem) return;

            // 4択の場合 1-4 を優先して処理
            if (currentProblem.inputType === "choice" && e.key >= '1' && e.key <= '4') {
                const choices = currentProblem.inputConfig?.choices;
                if (choices) {
                    const idx = parseInt(e.key) - 1;
                    if (idx < choices.length) {
                        handleSubmit(choices[idx].value);
                    }
                }
                e.preventDefault();
            }
            // 数字キー 0-9
            else if (e.key >= '0' && e.key <= '9') {
                handleTenKeyInput(e.key);
                e.preventDefault();
            }
            // Backspace
            else if (e.key === 'Backspace') {
                handleBackspace();
                e.preventDefault();
            }
            // Delete (クリア)
            else if (e.key === 'Delete') {
                handleClear();
                e.preventDefault();
            }
            // Enter (決定)
            else if (e.key === 'Enter') {
                handleSubmit();
                e.preventDefault();
            }
            // S or Escape (スキップ)
            else if (e.key === 's' || e.key === 'S' || e.key === 'Escape') {
                handleSkip();
                e.preventDefault();
            }
            // 小数点
            else if (e.key === '.' && currentProblem.categoryId.startsWith("dec_")) {
                handleTenKeyInput('.');
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [feedback, currentProblem, handleTenKeyInput, handleBackspace, handleClear, handleSkip, handleSubmit]);

    const handleContinue = useCallback(() => {
        // If we are flagged as finished (Break time), just resume.
        // We don't strictly need to generate more blocks here because pre-fetch handles it,
        // but calling nextBlock is safe (just appends).
        // However, to exit the "Break" screen (isFinished=true), we must flip the flag.
        // The effect "currentIndex % 100 === 0" might re-trigger if we don't advance?
        // Ah, the effect logic:
        // if (currentIndex > 0 && currentIndex % 100 === 0 && !isFinished) { setIsFinished(true); }
        // So once we set isFinished(true), it won't trigger again for THIS index.
        // But if we set isFinished(false), it MIGHT trigger again if the effect runs?
        // No, dependencies are [currentIndex, ...]. If currentIndex doesn't change, effect likely won't re-run 
        // OR we need a state "hasTakenBreakAt" ?

        // Simpler approach: To "Continue", we should just let the user see the next problem.
        // But we are at currentIndex. And we pause AFTER completing it?
        // Usually wait 800ms -> nextProblem() -> increments index.
        // If we pause at 100, we are at index 100? No, 0-indexed.
        // Let's say we answered 99th question (index 99) -> nextProblem() -> index 100.
        // Then effect sees index 100 -> Pause.
        // User clicks Continue. We just hide the screen. 
        // But if we hide screen, we render <StudyLayout> which shows CurrentProblem [100].
        // So we need to ensure isFinished stays false.

        setIsFinished(false);
        // We might want to ensure we have questions, but pre-fetch checks that.
    }, []);

    return (
        <StudyLayout
            loading={loading}
            isFinished={isFinished}
            currentProblem={currentProblem}
            currentIndex={currentIndex}
            blockSize={blockSize}
            userInput={userInput}
            userInputs={userInputs}
            activeFieldIndex={activeFieldIndex}
            feedback={feedback}
            showCorrection={showCorrection}
            sessionKind={sessionKindParam || "normal"}
            correctCount={correctCount}
            sessionResult={sessionResult || undefined}
            testTimeLimitSeconds={testTimeLimitSeconds}
            testRemainingSeconds={testRemainingSeconds}
            onNavigate={(path) => navigate(path)}
            onNext={nextProblem}
            onContinue={handleContinue}
            onSkip={handleSkip}
            onTenKeyInput={hissan.isHissanActive ? (val) => hissan.handleHissanInput(typeof val === 'string' ? parseInt(val) || 0 : val) : handleTenKeyInput}
            onBackspace={hissan.isHissanActive ? hissan.handleHissanBackspace : handleBackspace}
            onClear={hissan.isHissanActive ? hissan.handleHissanClear : handleClear}
            onEnter={() => handleSubmit()}
            onCursorMove={handleCursorMove}
            onSubmitChoice={(val) => handleSubmit(val)}
            onFocusField={setActiveFieldIndex}
            swipeHandlers={swipeHandlers}
            englishAutoRead={englishAutoRead}
            isEasyText={isEasyText}
            onToggleTTS={handleToggleTTS}
            // 筆算モード props
            hissanActive={hissan.isHissanActive}
            hissanEligible={hissan.isHissanEligibleSkill}
            hissanGridData={hissan.gridData}
            hissanStepIndex={hissan.currentStepIndex}
            hissanActiveCellPos={hissan.activeCellPos}
            hissanUserValues={hissan.userValues}
            hissanStepFeedback={hissan.stepFeedback}
            onHissanCellClick={hissan.handleCellClick}
            onHissanToggle={hissan.toggleHissanMode}
        />
    );
};
