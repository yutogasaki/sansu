import { integerFractionProblem } from '../domain/math/fractionInput';
import { useLearningSessionLease } from '../hooks/useLearningSessionLease';
import { allowsDecimalEntry, appendNumberField } from '../domain/math/numberEntry';
import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import { useStudySession } from "../hooks/useStudySession";
import { useHissanSession } from "../hooks/useHissanSession";
import { playSound, setSoundEnabled } from "../utils/audio";
import { getActiveProfile, updateProfileAtomically } from "../domain/user/repository";
import { StudyLayout } from "./StudyLayout";
import { useEnglishListening } from '../hooks/useEnglishListening';
import { EnglishListening, EnglishListeningEntry } from '../components/domain/EnglishListening';
import type { UserProfile } from '../domain/types';
import {
    isFixedSessionKind,
    shouldPrefetchNextBlock,
    checkAnswer,
    shouldShowEndlessBreak,
    isFixedSessionComplete,
    isInputLocked,
    resolveFixedSessionCompletionPresentation,
} from "../hooks/useStudySession.logic";
import { logInDev } from "../utils/debug";
import { speakEnglish, warmUpTTS } from "../utils/tts";
import { useTimeoutScheduler } from "../hooks/useTimeoutScheduler";
import { DevStudySwitcher } from "../components/dev/DevStudySwitcher";
import { getDevStudyAdjacentSelection, getDevStudySelectionSummary } from "../components/dev/devStudySelection";
import { reachPwaUpdateCheckpoint } from "../pwa";
import { COLD_OPEN_FIXED_TEN_ID } from "../domain/benchmark/coldOpenFixedTen";
import { studyLearningEvidence } from '../domain/learning/attemptContext';
import { canConfirmNumberFields, mathAnswerShape, appendAnswerDigit, removeAnswerDigit, isAnswerShapeComplete } from '../domain/math/answerCompletion';
import { acknowledgeAnswerConfirmation } from '../components/domain/answerConfirmGuidance';

type FixedSessionStats = {
    correct: number;
    total: number;
    durationSeconds: number;
    timeLimitSeconds?: number;
    timedOut?: boolean;
};

type FixedSessionCompletionState =
    | { status: "idle" }
    | { status: "saving" | "error" | "saved"; stats: FixedSessionStats };

export const Study: React.FC = () => {
    const [profileId, setProfileId] = useState<string | null>(null);
    const navigate = useNavigate();
    useEffect(() => { let live = true; void getActiveProfile().then(profile => { if (live) setProfileId(profile?.id ?? null); }); return () => { live = false; }; }, []);
    const lease = useLearningSessionLease(profileId);
    if (lease !== 'ready') return <main className="min-h-screen flex flex-col items-center justify-center gap-4" aria-live="polite">
        <p>{lease === 'blocked' ? 'ほかの がめんで まなんでいるよ' : 'じゅんび しているよ'}</p>
        <button onClick={() => navigate('/')}>もどる</button>
    </main>;
    return <StudyContent />;
};

const StudyContent: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const devSkill = searchParams.get("dev_skill") || undefined;
    const focusSubject = searchParams.get("focus_subject") as "math" | "vocab" | null;
    const focusIdsParam = searchParams.get("focus_ids");
    const backTo = searchParams.get("back_to");
    const forceReview = searchParams.get("force_review") === "1";
    const sessionKindParam = searchParams.get("session") as
        | "normal"
        | "review"
        | "weak"
        | "check-normal"
        | "check-event"
        | "weak-review"
        | "periodic-test"
        | "dev"
        | null;
    const isDevSession = sessionKindParam === "dev";
    const benchmarkId = import.meta.env.DEV
        && isDevSession
        && searchParams.get("benchmark") === COLD_OPEN_FIXED_TEN_ID
        ? COLD_OPEN_FIXED_TEN_ID
        : undefined;
    const backPath = backTo || "/";
    const focusIds = focusIdsParam ? focusIdsParam.split(",").filter(Boolean) : undefined;
    const selectedFocusId = focusIds?.[0] || undefined;
    const sessionResetKey = useMemo(
        () => [
            sessionKindParam || "normal",
            devSkill || "",
            focusSubject || "",
            focusIdsParam || "",
            forceReview ? "1" : "0",
            benchmarkId || "",
        ].join("|"),
        [benchmarkId, devSkill, focusIdsParam, focusSubject, forceReview, sessionKindParam]
    );

    const { queue, initSession, nextBlock, handleResult, completeSession, loading, generationError, blockSize } = useStudySession({
        devSkill,
        focusSubject: focusSubject || undefined,
        focusIds,
        forceReview,
        sessionKind: sessionKindParam || "normal",
        sessionKey: sessionResetKey,
        benchmarkId,
    });

    // State
    const [currentIndex, setCurrentIndex] = useState(0);                    // 0-4
    const [userInput, setUserInput] = useState("");                         // Single input
    const numberDraft = React.useRef(userInput);
    useLayoutEffect(() => { numberDraft.current = userInput; }, [userInput]);
    const [userInputs, setUserInputs] = useState<string[]>([]);             // Multi input
    const [activeFieldIndex, setActiveFieldIndex] = useState(0);            // Focus for multi
    const [replaceFieldIndex, setReplaceFieldIndex] = useState<number | undefined>();
    const fieldDraft = React.useRef<{ values: string[]; active: number; lastEdited?: number; replaceOnInput?: boolean }>({ values: userInputs, active: activeFieldIndex });
    useLayoutEffect(() => { fieldDraft.current = { ...fieldDraft.current, values: userInputs, active: activeFieldIndex }; }, [userInputs, activeFieldIndex]);

    const [feedback, setFeedback] = useState<"none" | "correct" | "incorrect" | "skipped">("none");
    const [showCorrection, setShowCorrection] = useState(false);
    const [saveError, setSaveError] = useState(false);


    // Processing Lock (Ref) to Prevent Double Submission / Spamming
    const isProcessingRef = React.useRef(false);
    const automaticBoundaryRef = React.useRef(false);

    // 問題表示時刻を記録（回答時間計測用）
    const problemShownAtRef = React.useRef<number>(Date.now());
    const learningAssistanceRef = React.useRef<'independent' | 'assisted'>('independent');
    const learningRepresentationChangedRef = React.useRef(false);
    // UI State for Block Transition
    const [isFinished, setIsFinished] = useState(false);

    // ちからチェック用：正答数トラッキング
    const [correctCount, setCorrectCount] = useState(0);
    const [sessionResult, setSessionResult] = useState<{ correct: number; total: number; durationSeconds: number } | null>(null);
    const [testTimeLimitSeconds, setTestTimeLimitSeconds] = useState<number | undefined>(undefined);
    const [testRemainingSeconds, setTestRemainingSeconds] = useState<number | undefined>(undefined);
    const [fixedSessionCompletion, setFixedSessionCompletion] = useState<FixedSessionCompletionState>({
        status: "idle",
    });
    const fixedSessionCompletionInFlightRef = React.useRef(false);
    const fixedSessionCompletionAttemptRef = React.useRef(0);
    const activeSessionKeyRef = React.useRef(sessionResetKey);
    const isStudyMountedRef = React.useRef(false);
    activeSessionKeyRef.current = sessionResetKey;

    const [englishAutoRead, setEnglishAutoRead] = useState(false);
    const [isEasyText, setIsEasyText] = useState(false);
    const [hissanModeEnabled, setHissanModeEnabled] = useState(false);
    const [profileSettingsStatus, setProfileSettingsStatus] = useState<"loading" | "ready" | "error">("loading");
    const [listeningProfile, setListeningProfile] = useState<UserProfile>();
    const listening = useEnglishListening(`${listeningProfile?.id}:${sessionResetKey}`, listeningProfile?.subjectMode !== 'math' && (!sessionKindParam || sessionKindParam === 'normal'), listeningProfile?.vocabLevels ?? [], queue[currentIndex]);
    const recordListeningAnswer = listening.record;
    const [isDevSwitcherOpen, setIsDevSwitcherOpen] = useState(false);

    const storedProblem = queue[currentIndex];
    const currentProblem = useMemo(() => integerFractionProblem(storedProblem), [storedProblem]);
    useLayoutEffect(() => { fieldDraft.current.lastEdited = undefined; fieldDraft.current.replaceOnInput = false; setReplaceFieldIndex(undefined); }, [currentProblem]);

    useEffect(() => {
        learningAssistanceRef.current = 'independent';
        learningRepresentationChangedRef.current = false;
    }, [currentProblem?.id]);

    // Hissan Session
    const hissan = useHissanSession();
    const resetHissan = hissan.resetHissan;
    const { scheduleTimeout: scheduleUiTimeout, clearScheduledTimeouts: clearPendingUiTimeouts } = useTimeoutScheduler();
    const devSelectionSummary = isDevSession && focusSubject
        ? getDevStudySelectionSummary(focusSubject, selectedFocusId)
        : null;
    const devSkillDownTarget = focusSubject && selectedFocusId
        ? getDevStudyAdjacentSelection(focusSubject, selectedFocusId, "prev-item")
        : null;
    const devSkillUpTarget = focusSubject && selectedFocusId
        ? getDevStudyAdjacentSelection(focusSubject, selectedFocusId, "next-item")
        : null;

    // Warm up TTS on mount (uses the user interaction context from navigation tap)
    useEffect(() => {
        warmUpTTS();
    }, []);

    useEffect(() => {
        isStudyMountedRef.current = true;
        return () => {
            isStudyMountedRef.current = false;
        };
    }, []);

    // Sync Audio Settings & Profile ID
    useEffect(() => {
        let active = true;
        getActiveProfile().then(profile => {
            if (!active) return;
            if (profile) {
                setListeningProfile(profile);
                setSoundEnabled(profile.soundEnabled);
                setEnglishAutoRead(profile.englishAutoRead || false);
                setIsEasyText(profile.uiTextMode === "easy");
                setHissanModeEnabled(profile.hissanModeEnabled ?? true);
                setTestTimeLimitSeconds(profile.periodicTestTimeLimitSeconds);
                setProfileSettingsStatus("ready");
            } else {
                setProfileSettingsStatus("error");
            }
        }).catch(error => {
            if (!active) return;
            logInDev("[Study] error fetching input settings:", error);
            setProfileSettingsStatus("error");
        });
        return () => { active = false; };
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
            await updateProfileAtomically(profile.id, currentProfile => ({
                ...currentProfile,
                englishAutoRead: newValue,
            }));
        }
    };

    // Reset inputs when problem changes
    useLayoutEffect(() => {
        // Settings and the queue load independently. Initialize the chosen input
        // form before its first operable paint, never after a child has typed.
        if (!currentProblem || profileSettingsStatus !== "ready") return;
        clearPendingUiTimeouts();
        fieldDraft.current.replaceOnInput = false;
        setReplaceFieldIndex(undefined);
        setUserInput("");
        if (currentProblem.inputType === 'multi-number' && currentProblem.inputConfig?.fields) {
            setUserInputs(new Array(currentProblem.inputConfig.fields.length).fill(""));
            setActiveFieldIndex(0);
        } else {
            setUserInputs([]);
        }
        setFeedback("none");
        setShowCorrection(false);
        setSaveError(false);
        isProcessingRef.current = false;

        // 筆算モードリセット
        resetHissan(currentProblem, hissanModeEnabled);
    }, [currentProblem, hissanModeEnabled, profileSettingsStatus, resetHissan, clearPendingUiTimeouts]);

    useEffect(() => {
        clearPendingUiTimeouts();
        setCurrentIndex(0);
        setUserInput("");
        setUserInputs([]);
        setActiveFieldIndex(0);
        setFeedback("none");
        setShowCorrection(false);
        setSaveError(false);
        isProcessingRef.current = false;
        problemShownAtRef.current = Date.now();
        setIsFinished(false);
        setCorrectCount(0);
        setSessionResult(null);
        setTestRemainingSeconds(undefined);
        setFixedSessionCompletion({ status: "idle" });
        fixedSessionCompletionAttemptRef.current += 1;
        fixedSessionCompletionInFlightRef.current = false;
        startTimeRef.current = Date.now();
        setIsDevSwitcherOpen(false);
    }, [sessionResetKey, clearPendingUiTimeouts]);

    // Check for pause (every 100 questions) or pre-fetch
    useEffect(() => {
        if (!queue.length) return;
        const sessionKind = sessionKindParam || "normal";
        const isFixedSession = isFixedSessionKind(sessionKind);

        // 1. Pre-fetch when running low (less than 3 items remaining)
        if (
            !benchmarkId
            && shouldPrefetchNextBlock({ sessionKind, currentIndex, loading, queueLength: queue.length })
        ) {
            logInDev("Pre-fetching next block...");
            nextBlock();
        }

        if (isFixedSession) {
            return;
        }

        if (shouldShowEndlessBreak(currentIndex, isFinished, sessionKind)) {
            setIsFinished(true);
        } else if (isFinished && currentIndex % 100 !== 0) {
            setIsFinished(false);
        }

    }, [benchmarkId, currentIndex, queue.length, loading, nextBlock, isFinished, sessionKindParam]);

    // Session Start Time Tracking
    const startTimeRef = React.useRef(0);
    useEffect(() => {
        startTimeRef.current = Date.now();
    }, []);

    const finalizeFixedSession = useCallback(async (timedOut = false) => {
        const isFixedSession = isFixedSessionKind(sessionKindParam);
        if (
            !isFixedSession
            || loading
            || fixedSessionCompletion.status === "saving"
            || fixedSessionCompletion.status === "saved"
            || fixedSessionCompletionInFlightRef.current
        ) return;

        const stats = fixedSessionCompletion.status === "error"
            ? fixedSessionCompletion.stats
            : {
                correct: correctCount,
                total: blockSize,
                durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000),
                timeLimitSeconds: sessionKindParam === "periodic-test" ? testTimeLimitSeconds : undefined,
                timedOut: sessionKindParam === "periodic-test" ? timedOut : undefined,
            };
        const completionSessionKey = sessionResetKey;
        const completionAttempt = fixedSessionCompletionAttemptRef.current + 1;
        fixedSessionCompletionAttemptRef.current = completionAttempt;
        fixedSessionCompletionInFlightRef.current = true;
        setFixedSessionCompletion({ status: "saving", stats });

        try {
            const persisted = await completeSession(stats);
            if (!persisted) {
                throw new Error("Fixed session completion could not be persisted");
            }
            if (
                !isStudyMountedRef.current
                || activeSessionKeyRef.current !== completionSessionKey
                || fixedSessionCompletionAttemptRef.current !== completionAttempt
            ) {
                return;
            }

            setFixedSessionCompletion({ status: "saved", stats });
            if (sessionKindParam === "periodic-test") {
                setSessionResult({
                    correct: stats.correct,
                    total: stats.total,
                    durationSeconds: stats.durationSeconds,
                });
                // Only a persisted result can become a PWA update checkpoint.
                setIsFinished(true);
            } else {
                navigate('/stats');
            }
        } catch {
            if (
                isStudyMountedRef.current
                && activeSessionKeyRef.current === completionSessionKey
                && fixedSessionCompletionAttemptRef.current === completionAttempt
            ) {
                setFixedSessionCompletion({ status: "error", stats });
            }
        } finally {
            if (fixedSessionCompletionAttemptRef.current === completionAttempt) {
                fixedSessionCompletionInFlightRef.current = false;
            }
        }
    }, [
        sessionKindParam,
        loading,
        fixedSessionCompletion,
        correctCount,
        blockSize,
        testTimeLimitSeconds,
        completeSession,
        navigate,
        sessionResetKey,
    ]);

    const fixedSessionCompletionDue = isFixedSessionComplete(
        currentIndex,
        blockSize,
        sessionKindParam,
        loading,
    );
    const completionPresentation = resolveFixedSessionCompletionPresentation(
        fixedSessionCompletion.status,
        fixedSessionCompletionDue,
        isFinished,
    );

    useEffect(() => {
        if (
            sessionKindParam !== "periodic-test"
            || typeof testTimeLimitSeconds !== "number"
            || fixedSessionCompletion.status !== "idle"
        ) {
            setTestRemainingSeconds(undefined);
            return;
        }

        const tick = () => {
            const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
            const remaining = Math.max(0, testTimeLimitSeconds - elapsed);
            setTestRemainingSeconds(remaining);
            // Let an answer already being persisted finish before freezing the
            // result. completeSession also waits for the result queue, but the
            // score state must be allowed to commit before stats are captured.
            if (remaining <= 0 && !isProcessingRef.current) {
                void finalizeFixedSession(true);
            }
        };

        tick();
        const timerId = window.setInterval(tick, 1000);
        return () => window.clearInterval(timerId);
    }, [
        sessionKindParam,
        testTimeLimitSeconds,
        fixedSessionCompletion.status,
        finalizeFixedSession,
    ]);

    // Check for Fixed Session Completion (Periodic Test / Weak Review / Check Event)
    useEffect(() => {
        if (fixedSessionCompletion.status === "idle" && fixedSessionCompletionDue) {
            logInDev("Fixed Session Complete!", { correctCount, blockSize });
            void finalizeFixedSession(false);
        }
    }, [
        blockSize,
        correctCount,
        finalizeFixedSession,
        fixedSessionCompletion.status,
        fixedSessionCompletionDue,
    ]);

    const handleBackspace = useCallback(() => {
        if (
            completionPresentation !== "none"
            || fixedSessionCompletionInFlightRef.current
            || isInputLocked(feedback, isProcessingRef.current)
        ) return;
        playSound("tap");
        const replaceSelection = fieldDraft.current.replaceOnInput;
        setReplaceFieldIndex(undefined);
        fieldDraft.current.replaceOnInput = false;

        if (hissan.isHissanActive) {
            hissan.handleHissanBackspace();
            return;
        }

        if (currentProblem?.inputType === 'multi-number') {
            const current = fieldDraft.current;
            const active = !current.values[current.active] ? current.lastEdited ?? Math.max(0, current.active - 1) : current.active;
            const values = current.values.map((value, index) => index === active ? (replaceSelection ? '' : mathAnswerShape(currentProblem) ? removeAnswerDigit(value) : value.slice(0, -1)) : value);
            fieldDraft.current = { values, active };
            setUserInputs(values);
            setActiveFieldIndex(active);
        } else {
            numberDraft.current = replaceSelection ? '' : mathAnswerShape(currentProblem) ? removeAnswerDigit(numberDraft.current) : numberDraft.current.slice(0, -1);
            setUserInput(numberDraft.current);
        }
    }, [completionPresentation, feedback, currentProblem, hissan]);

    const handleClear = useCallback(() => {
        if (
            completionPresentation !== "none"
            || fixedSessionCompletionInFlightRef.current
            || isInputLocked(feedback, isProcessingRef.current)
        ) return;
        if (hissan.isHissanActive) {
            hissan.handleHissanClear();
            return;
        }
        if (currentProblem?.inputType === 'multi-number') {
            const values = fieldDraft.current.values.map(() => '');
            fieldDraft.current = { values, active: 0 };
            setReplaceFieldIndex(undefined);
            setActiveFieldIndex(0);
            setUserInputs(values);
        } else {
            setReplaceFieldIndex(undefined);
            fieldDraft.current.replaceOnInput = false;
            numberDraft.current = '';
            setUserInput('');
        }
    }, [completionPresentation, feedback, currentProblem, hissan]);

    const handleCursorMove = useCallback((direction: "left" | "right", separator = false) => {
        if (
            completionPresentation !== "none"
            || fixedSessionCompletionInFlightRef.current
            || isInputLocked(feedback, isProcessingRef.current)
        ) return;
        if (hissan.isHissanActive) {
            hissan.handleHissanCursorMove(direction);
            return;
        }
        if (currentProblem?.inputType === 'multi-number' && currentProblem.inputConfig?.fields) {
            const current = fieldDraft.current;
            const shape = mathAnswerShape(currentProblem);
            if (separator && shape && !isAnswerShapeComplete([current.values[current.active]], [shape[current.active]])) return;
            const maxIndex = currentProblem.inputConfig.fields.length - 1;
            const active = Math.max(0, Math.min(maxIndex, current.active + (direction === 'right' ? 1 : -1)));
            if (active === current.active) return;
            fieldDraft.current = { ...current, active, replaceOnInput: false, lastEdited: undefined };
            setReplaceFieldIndex(undefined);
            setActiveFieldIndex(active);
        }
    }, [completionPresentation, feedback, currentProblem, hissan]);

    const nextProblem = useCallback(() => {
        if (
            completionPresentation !== "none"
            || fixedSessionCompletionInFlightRef.current
            || isProcessingRef.current
        ) return;
        // Latch synchronously so a double tap cannot skip a question before
        // React commits the next render. The problem-change effect unlocks it.
        isProcessingRef.current = true;
        if (currentProblem && feedback !== 'skipped') recordListeningAnswer(currentProblem, (currentIndex + 1) % blockSize === 0);
        setFeedback("none");
        setShowCorrection(false);
        setSaveError(false);
        setUserInput("");
        setCurrentIndex(prev => prev + 1);
        problemShownAtRef.current = Date.now();
        // Note: isProcessingRef reset is handled in the effect when currentProblem changes
    }, [completionPresentation, currentProblem, currentIndex, blockSize, feedback, recordListeningAnswer]);

    // Submitting - useEffectより前に定義
    const handleSubmit = useCallback(async (choiceValue?: string, numericValue?: string, automatic = false, numericFields?: string[]) => {
        if (
            completionPresentation !== "none"
            || fixedSessionCompletionInFlightRef.current
            || isInputLocked(feedback, isProcessingRef.current)
            || !currentProblem
        ) return;
        const shape = mathAnswerShape(currentProblem);
        if (!automatic && (hissan.isHissanActive || shape) && !saveError) return;
        const submittedValues = currentProblem.inputType === 'multi-number' ? (numericFields ?? userInputs) : [numericValue ?? userInput];
        if (!hissan.isHissanActive && currentProblem.inputType !== 'choice'
            && !(shape ? isAnswerShapeComplete(submittedValues, shape) : canConfirmNumberFields(submittedValues))) return;
        if (!automatic && currentProblem.inputType !== 'choice') acknowledgeAnswerConfirmation();
        setSaveError(false);

        // 筆算モードの場合はhissanEnterを使う
        if (hissan.isHissanActive && hissan.gridData) {
            const result = hissan.handleHissanEnter();
            if (result === 'all-correct') {
                // 全ステップ正解 → 通常の正解処理
                isProcessingRef.current = true;
                const timeMs = Date.now() - problemShownAtRef.current;
                setFeedback("correct");
                playSound("correct");
                let saved = false;
                try {
                    saved = await handleResult(storedProblem, 'correct', timeMs,
                        studyLearningEvidence(currentProblem, learningAssistanceRef.current, true, learningRepresentationChangedRef.current));
                    if (saved) {
                        setCorrectCount(prev => prev + 1);
                    } else {
                        hissan.retryHissanSave();
                        setFeedback("none");
                        setSaveError(true);
                    }
                } finally {
                    isProcessingRef.current = false;
                }
                if (saved) scheduleUiTimeout(nextProblem, 500);
            } else if (result === 'step-correct') {
                playSound("correct");
            } else if (result === 'incorrect') {
                learningAssistanceRef.current = 'assisted';
                playSound("incorrect");
            }
            return;
        }

        isProcessingRef.current = true;
        const isCorrect = checkAnswer(
            currentProblem.inputType as "number" | "choice" | "multi-number",
            currentProblem.correctAnswer,
            numericValue ?? userInput,
            numericFields ?? userInputs,
            choiceValue,
        );

        const timeMs = Date.now() - problemShownAtRef.current;

        if (isCorrect) {
            setFeedback("correct");
            playSound("correct");
            let saved = false;
            try {
                saved = await handleResult(storedProblem, 'correct', timeMs,
                    studyLearningEvidence(currentProblem, learningAssistanceRef.current, false, learningRepresentationChangedRef.current));
                if (saved) {
                    setCorrectCount(prev => prev + 1);
                } else {
                    setFeedback("none");
                    setSaveError(true);
                }
            } finally {
                isProcessingRef.current = false;
            }

            if (saved && !(benchmarkId && currentIndex === queue.length - 1)) {
                scheduleUiTimeout(nextProblem, 500);
            }
        } else {
            setFeedback("incorrect");
            playSound("incorrect");
            try {
                const evidence = studyLearningEvidence(currentProblem, learningAssistanceRef.current, false, learningRepresentationChangedRef.current);
                learningAssistanceRef.current = 'assisted';
                const saved = await handleResult(storedProblem, 'incorrect', timeMs, evidence);
                if (saved) {
                    setShowCorrection(true);
                } else {
                    setFeedback("none");
                    setSaveError(true);
                }
            } finally {
                isProcessingRef.current = false;
            }
            // Auto-advance removed. User must click Next.
        }
    }, [
        completionPresentation,
        feedback,
        currentProblem,
        storedProblem,
        userInput,
        userInputs,
        handleResult,
        nextProblem,
        hissan,
        scheduleUiTimeout,
        benchmarkId,
        currentIndex,
        queue.length,
        saveError,
    ]);

    // Release an automatic row boundary only after the new controls commit.
    useLayoutEffect(() => { automaticBoundaryRef.current = false; }, [currentProblem, hissan.currentStepIndex, hissan.stepFeedback, hissan.userValues, feedback, saveError]);

    // Handlers - 全てのフックより前に定義
    const handleTenKeyInput = useCallback((val: string | number) => {
        const valStr = val.toString();
        if (!/^[0-9.]$/.test(valStr) || automaticBoundaryRef.current) return;
        if (valStr === '.' && !(hissan.isHissanActive ? hissan.canInputDecimal : allowsDecimalEntry(currentProblem))) return;
        if (
            completionPresentation !== "none"
            || fixedSessionCompletionInFlightRef.current
            || isInputLocked(feedback, isProcessingRef.current)
        ) return;
        playSound("tap");
        if (hissan.isHissanActive) {
            if (hissan.handleHissanInput(valStr)) {
                automaticBoundaryRef.current = true;
                void handleSubmit(undefined, undefined, true);
            }
            return;
        }

        const shape = mathAnswerShape(currentProblem);
        if (shape) {
            const multi = currentProblem.inputType === 'multi-number';
            const draft = multi ? fieldDraft.current : { values: [numberDraft.current], active: 0, replaceOnInput: fieldDraft.current.replaceOnInput };
            const values = draft.replaceOnInput ? draft.values.map((value, i) => i === draft.active ? '' : value) : draft.values;
            const next = appendAnswerDigit(values, draft.active, valStr, shape);
            if (draft.replaceOnInput && !next.values[draft.active]) return;
            fieldDraft.current.replaceOnInput = false;
            setReplaceFieldIndex(undefined);
            if (multi) {
                fieldDraft.current = { ...next, lastEdited: draft.active };
                setUserInputs(next.values);
                setActiveFieldIndex(next.active);
            } else {
                numberDraft.current = next.values[0];
                setUserInput(next.values[0]);
            }
            if (next.values.some((value, i) => value !== draft.values[i]) && isAnswerShapeComplete(next.values, shape)) {
                automaticBoundaryRef.current = true;
                void handleSubmit(undefined, next.values[0], true, next.values);
            }
            return;
        }

        if (currentProblem?.inputType === 'multi-number' && currentProblem.inputConfig?.fields) {
            const next = appendNumberField(fieldDraft.current.values, fieldDraft.current.active, valStr, currentProblem.inputConfig.fields.map(field => field.length));
            fieldDraft.current = next;
            setUserInputs(next.values);
            setActiveFieldIndex(next.active);
        } else {
            setUserInput(prev => prev.length >= 8 || (valStr === '.' && prev.includes('.')) ? prev : prev + valStr);
        }
    }, [
        completionPresentation,
        feedback,
        currentProblem,
        hissan,
        handleSubmit,
    ]);

    // スキップ処理（仕様 4.7）
    const handleSkip = useCallback(async () => {
        if (
            completionPresentation !== "none"
            || fixedSessionCompletionInFlightRef.current
            || isInputLocked(feedback, isProcessingRef.current)
            || !currentProblem
        ) return;

        isProcessingRef.current = true;

        setSaveError(false);
        setFeedback("skipped");
        playSound("incorrect");

        try {
            const evidence = hissan.isHissanActive ? undefined
                : studyLearningEvidence(currentProblem, learningAssistanceRef.current, false, learningRepresentationChangedRef.current);
            learningAssistanceRef.current = 'assisted';
            const saved = await handleResult(storedProblem, 'skipped', undefined, evidence);
            if (saved) {
                setShowCorrection(true);
            } else {
                setFeedback("none");
                setSaveError(true);
            }
        } finally {
            isProcessingRef.current = false;
        }

        // Auto-advance removed. User must click Next.
    }, [completionPresentation, feedback, currentProblem, storedProblem, handleResult, hissan.isHissanActive]);

    // 左スワイプでスキップ
    const swipeHandlers = useSwipeable({
        onSwipedLeft: () => handleSkip(),
        trackMouse: false,
        preventScrollOnSwipe: true,
    });

    // PCキーボード操作（仕様 4.2）
    useLayoutEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
            if (e.repeat && (/^[0-9.]$/.test(e.key) || e.key === 'Enter')) { e.preventDefault(); return; }
            if (profileSettingsStatus !== "ready" || loading) return;
            if (completionPresentation !== "none") return;
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
            else if (e.key === '/' && currentProblem?.inputType === 'multi-number') {
                handleCursorMove('right', true);
                e.preventDefault();
            }
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                handleCursorMove(e.key === 'ArrowLeft' ? 'left' : 'right');
                e.preventDefault();
            }
            // Enter (決定)
            else if (e.key === 'Enter') {
                if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.getAttribute?.('role') === 'button') return;
                handleSubmit();
                e.preventDefault();
            }
            // Explicit skip shortcut. Escape must never record a skipped answer.
            else if (e.key === 's' || e.key === 'S') {
                handleSkip();
                e.preventDefault();
            }
            // 小数点
            else if (e.key === '.' && (hissan.isHissanActive ? hissan.canInputDecimal : allowsDecimalEntry(currentProblem))) {
                handleTenKeyInput('.');
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        completionPresentation,
        profileSettingsStatus,
        hissan.isHissanActive,
        hissan.canInputDecimal,
        loading,
        feedback,
        currentProblem,
        storedProblem,
        handleTenKeyInput,
        handleBackspace,
        handleClear,
        handleCursorMove,
        handleSkip,
        handleSubmit,
    ]);

    const handleRetryFixedSessionCompletion = useCallback(() => {
        void finalizeFixedSession();
    }, [finalizeFixedSession]);

    const handleContinue = useCallback(() => {
        // Do not erase the break/result screen as soon as it appears. Apply a
        // deferred update only after the child asks to continue.
        if (reachPwaUpdateCheckpoint(
            `study-continue:${sessionResetKey}:${currentIndex}`,
            { protectNextSession: true },
        )) return;
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
    }, [currentIndex, sessionResetKey]);

    const buildDevStudyPath = useCallback((subject: "math" | "vocab", id: string) => {
        const nextParams = new URLSearchParams({
            session: "dev",
            focus_subject: subject,
            focus_ids: id,
        });

        if (backTo) {
            nextParams.set("back_to", backTo);
        }

        return `/study?${nextParams.toString()}`;
    }, [backTo]);

    const handleApplyDevSelection = useCallback((next: { subject: "math" | "vocab"; id: string }) => {
        clearPendingUiTimeouts();
        setIsDevSwitcherOpen(false);
        navigate(buildDevStudyPath(next.subject, next.id), { replace: true });
    }, [buildDevStudyPath, clearPendingUiTimeouts, navigate]);

    const handleQuickDevSelection = useCallback((next: { subject: "math" | "vocab"; id: string } | null) => {
        if (!next) {
            return;
        }

        handleApplyDevSelection(next);
    }, [handleApplyDevSelection]);

    const handleNavigate = useCallback((path: string) => {
        if (isDevSession && path === "/") {
            navigate(backPath);
            return;
        }
        navigate(path);
    }, [isDevSession, backPath, navigate]);

    return (
        <>
            <StudyLayout
                emptyReview={!loading && !generationError && profileSettingsStatus === "ready" && sessionKindParam === "weak-review" && queue.length === 0}
                loading={loading || profileSettingsStatus === "loading"}
                isFinished={isFinished}
                completionPresentation={completionPresentation}
                currentProblem={profileSettingsStatus === "error" ? undefined : currentProblem}
                benchmarkId={benchmarkId}
                currentIndex={currentIndex}
                blockSize={blockSize}
                userInput={userInput}
                userInputs={userInputs}
                activeFieldIndex={activeFieldIndex}
                feedback={feedback}
                showCorrection={showCorrection}
                saveError={saveError}
                sessionKind={sessionKindParam || "normal"}
                correctCount={correctCount}
                sessionResult={sessionResult || undefined}
                testTimeLimitSeconds={testTimeLimitSeconds}
                testRemainingSeconds={testRemainingSeconds}
                onNavigate={handleNavigate}
                onNext={nextProblem}
                onContinue={generationError ? () => { void initSession(); } : handleContinue}
                onRetryCompletion={handleRetryFixedSessionCompletion}
                onSkip={handleSkip}
                onTenKeyInput={handleTenKeyInput}
                onBackspace={handleBackspace}
                onClear={handleClear}
                onEnter={() => handleSubmit()}
                onCursorMove={handleCursorMove}
                onSubmitChoice={(val) => handleSubmit(val)}
                replaceFieldIndex={replaceFieldIndex}
                onFocusField={index => {
                    if (isProcessingRef.current || feedback !== 'none') return;
                    const value = currentProblem?.inputType === 'multi-number' ? fieldDraft.current.values[index] : numberDraft.current;
                    fieldDraft.current = { ...fieldDraft.current, active: index, replaceOnInput: Boolean(value), lastEdited: undefined };
                    setReplaceFieldIndex(value ? index : undefined);
                    setActiveFieldIndex(index);
                }}
                swipeHandlers={swipeHandlers}
                englishAutoRead={englishAutoRead && !listening.isOpen}
                listeningEntry={listening.sentence ? <EnglishListeningEntry disabled={loading || feedback !== 'none' || listening.isOpen} onOpen={listening.open} /> : undefined}
                isEasyText={isEasyText}
                onToggleTTS={handleToggleTTS}
                devSessionSummary={devSelectionSummary}
                onOpenDevSwitcher={devSelectionSummary ? () => setIsDevSwitcherOpen(true) : undefined}
                onDevSkillDown={devSkillDownTarget ? () => handleQuickDevSelection(devSkillDownTarget) : undefined}
                onDevSkillUp={devSkillUpTarget ? () => handleQuickDevSelection(devSkillUpTarget) : undefined}
                canDevSkillDown={!!devSkillDownTarget}
                canDevSkillUp={!!devSkillUpTarget}
                // 筆算モード props
                hissanActive={hissan.isHissanActive}
                hissanEligible={hissan.isHissanEligibleSkill}
                hissanGridData={hissan.gridData}
                hissanStepIndex={hissan.currentStepIndex}
                hissanActiveCellPos={hissan.activeCellPos}
                hissanUserValues={hissan.userValues}
                hissanStepFeedback={hissan.stepFeedback}
                hissanCorrecting={hissan.correcting}
                hissanCanInputDecimal={hissan.canInputDecimal}
                onHissanCellClick={hissan.handleCellClick}
                onHissanToggle={hissan.canToggleHissanMode ? () => {
                    learningRepresentationChangedRef.current = true;
                    hissan.toggleHissanMode();
                } : undefined}
            />
            {listening.isOpen && listening.sentence && <EnglishListening sentence={listening.sentence} easy={isEasyText} onClose={listening.close} />}
            {isDevSession && focusSubject && (
                <DevStudySwitcher
                    isOpen={isDevSwitcherOpen}
                    onClose={() => setIsDevSwitcherOpen(false)}
                    subject={focusSubject}
                    selectedId={selectedFocusId}
                    onApply={handleApplyDevSelection}
                />
            )}
        </>
    );
};
