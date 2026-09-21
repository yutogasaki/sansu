import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../utils/cn";
import { TenKey } from "../domain/TenKey";
import { ChoiceGroup } from "../domain/ChoiceGroup";
import { MathProblemPrompt } from "../domain/MathProblemPrompt";
import { PlayerGameState, PlayerId } from "../../domain/battle/types";
import { useTimeoutScheduler } from "../../hooks/useTimeoutScheduler";

interface PlayerPanelProps {
    player: PlayerId;
    gameState: PlayerGameState;
    onSubmitAnswer: (answer: string) => void;
    onInputChange: (input: string) => void;
    onSkip: () => void;
    showCombo?: boolean;
    disabled?: boolean;
}

type Feedback = "none" | "correct" | "incorrect";
type QuestionScrollDirection = "down" | "up" | "both" | null;

interface QuestionScrollState {
    scrollable: boolean;
    direction: QuestionScrollDirection;
}

const EMPTY_QUESTION_SCROLL_STATE: QuestionScrollState = {
    scrollable: false,
    direction: null,
};

export const PlayerPanel: React.FC<PlayerPanelProps> = ({
    gameState,
    onSubmitAnswer,
    onInputChange,
    onSkip,
    showCombo = false,
    disabled = false,
}) => {
    const [feedback, setFeedback] = useState<Feedback>("none");
    const questionScrollAreaRef = useRef<HTMLDivElement>(null);
    const [questionScroll, setQuestionScroll] = useState<QuestionScrollState>(EMPTY_QUESTION_SCROLL_STATE);
    const problem = gameState.currentProblem;
    const isChoice = problem?.inputType === "choice";
    const isMathProblem = gameState.config.subject === "math";
    const isLocked = gameState.lockSeconds > 0;
    const { scheduleTimeout, clearScheduledTimeouts } = useTimeoutScheduler();

    useEffect(() => {
        const scrollArea = questionScrollAreaRef.current;
        if (!isMathProblem || !scrollArea) {
            setQuestionScroll(EMPTY_QUESTION_SCROLL_STATE);
            return;
        }

        // A new question always starts at the top, even if the previous diagram
        // was scrolled to reveal its lower rows.
        scrollArea.scrollTop = 0;

        const updateScrollState = () => {
            const maxScrollTop = Math.max(0, scrollArea.scrollHeight - scrollArea.clientHeight);
            const scrollable = maxScrollTop > 1;
            const direction: QuestionScrollDirection = !scrollable
                ? null
                : scrollArea.scrollTop <= 1
                    ? "down"
                    : scrollArea.scrollTop >= maxScrollTop - 1
                        ? "up"
                        : "both";

            setQuestionScroll(current => current.scrollable === scrollable && current.direction === direction
                ? current
                : { scrollable, direction });
        };

        updateScrollState();
        scrollArea.addEventListener("scroll", updateScrollState, { passive: true });
        window.addEventListener("resize", updateScrollState);

        const resizeObserver = typeof ResizeObserver === "undefined"
            ? undefined
            : new ResizeObserver(updateScrollState);
        resizeObserver?.observe(scrollArea);
        for (const child of Array.from(scrollArea.children)) resizeObserver?.observe(child);

        return () => {
            scrollArea.removeEventListener("scroll", updateScrollState);
            window.removeEventListener("resize", updateScrollState);
            resizeObserver?.disconnect();
        };
    }, [isMathProblem, problem?.id]);

    const flashFeedback = useCallback((type: Feedback) => {
        clearScheduledTimeouts();
        setFeedback(type);
        scheduleTimeout(() => setFeedback("none"), 300);
    }, [clearScheduledTimeouts, scheduleTimeout]);

    const handleInput = useCallback(
        (val: number | string) => {
            if (disabled || isLocked || !problem) return;
            const next = gameState.userInput + String(val);
            onInputChange(next);
        },
        [disabled, isLocked, problem, gameState.userInput, onInputChange]
    );

    const handleDelete = useCallback(() => {
        if (disabled || isLocked || !problem) return;
        const next = gameState.userInput.slice(0, -1);
        onInputChange(next);
    }, [disabled, isLocked, problem, gameState.userInput, onInputChange]);

    const handleClear = useCallback(() => {
        if (disabled || isLocked || !problem) return;
        onInputChange("");
    }, [disabled, isLocked, problem, onInputChange]);

    const handleEnter = useCallback(() => {
        if (disabled || isLocked || !problem || gameState.userInput === "") return;
        const isCorrect = gameState.userInput === problem.correctAnswer;
        flashFeedback(isCorrect ? "correct" : "incorrect");
        onSubmitAnswer(gameState.userInput);
    }, [disabled, isLocked, problem, gameState.userInput, onSubmitAnswer, flashFeedback]);

    const handleChoiceSelect = useCallback((value: string) => {
        if (disabled || isLocked || !problem) return;
        const isCorrect = value === problem.correctAnswer;
        flashFeedback(isCorrect ? "correct" : "incorrect");
        onSubmitAnswer(value);
    }, [disabled, isLocked, problem, onSubmitAnswer, flashFeedback]);

    const bgFlash = feedback === "correct"
        ? "bg-[linear-gradient(180deg,rgba(220,252,231,0.82),rgba(240,253,250,0.76))]"
        : feedback === "incorrect"
            ? "bg-[linear-gradient(180deg,rgba(255,241,242,0.82),rgba(255,250,240,0.76))]"
            : "bg-[linear-gradient(180deg,rgba(255,255,255,0.66),rgba(255,255,255,0.48))]";

    return (
        <div className={cn(
            "battle-player-panel relative flex h-full flex-col overflow-hidden rounded-[28px] border border-white/75 shadow-[0_24px_50px_-34px_rgba(15,23,42,0.36)] transition-colors duration-200 app-glass-strong",
            bgFlash
        )}>
            {/* Problem display + skip */}
            <div className="battle-panel-heading flex-none px-4 pt-4 pb-2">
                <div className="battle-panel-heading-row flex items-center justify-between mb-1">
                    <div className="app-pill px-3 py-1 text-xs font-black text-slate-500">
                        {gameState.config.emoji} {gameState.config.name}
                        <span className="ml-1 text-slate-300">
                            {gameState.config.subject === "vocab" ? "🔤" : "🔢"}
                        </span>
                    </div>
                    {!isChoice && (
                        <output className="battle-mobile-answer" aria-label="入力中の答え">
                            {gameState.userInput || "?"}
                        </output>
                    )}
                    <div className="battle-stats flex flex-none justify-center gap-2 px-4 text-xs font-black">
                        <span className="app-pill px-2.5 py-1 text-emerald-600">○ {gameState.correctCount}</span>
                        <span className="app-pill px-2.5 py-1 text-rose-500">× {gameState.incorrectCount}</span>
                        {showCombo && (
                            <span className="app-pill px-2.5 py-1 text-cyan-700">🔥 {gameState.combo} コンボ</span>
                        )}
                        {showCombo && isLocked && (
                            <span className="app-pill px-2.5 py-1 text-rose-600">⏳ {gameState.lockSeconds}びょう まって</span>
                        )}
                    </div>
                    <button
                        onClick={onSkip}
                        disabled={disabled || isLocked || !problem}
                        className="app-pill min-h-11 px-2.5 py-1 text-[10px] font-black text-slate-500 transition-colors hover:bg-white/84 hover:text-slate-700 disabled:opacity-30"
                    >
                        スキップ ▶
                    </button>
                </div>
            </div>

            <div
                className={cn(
                    "battle-question-frame mx-4 mb-2 rounded-[22px] border border-white/75 bg-white/52 px-4 py-3 text-center text-2xl font-black text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]",
                    isMathProblem && "battle-math-question",
                    isMathProblem
                        ? "max-h-[15rem] overflow-hidden"
                        : "flex min-h-[4.25rem] items-center justify-center"
                )}
            >
                {isMathProblem ? (
                    <div
                        ref={questionScrollAreaRef}
                        data-battle-question-scroll-area
                        data-battle-question-scrollable={questionScroll.scrollable ? "true" : "false"}
                        role={questionScroll.scrollable ? "region" : undefined}
                        aria-label={questionScroll.scrollable
                            ? `${gameState.config.name}の もんだい。スクロールして つづきを見られます`
                            : undefined}
                        tabIndex={questionScroll.scrollable ? 0 : undefined}
                        className="battle-question-scroll-area"
                    >
                        {problem ? (
                            <MathProblemPrompt
                                problem={{
                                    questionText: problem.questionText,
                                    questionVisual: problem.questionVisual,
                                    categoryId: problem.skillId,
                                }}
                                className="battle-math-prompt gap-3"
                            />
                        ) : "..."}
                    </div>
                ) : problem ? (
                    problem.questionText
                ) : "..."}
                {isMathProblem && questionScroll.scrollable && (
                    <span
                        data-battle-question-scroll-cue={questionScroll.direction ?? undefined}
                        aria-hidden="true"
                        className="battle-question-scroll-cue"
                    >
                        {questionScroll.direction === "down"
                            ? "↓ つづき"
                            : questionScroll.direction === "up"
                                ? "↑ もどる"
                                : "↕ うごかしてね"}
                    </span>
                )}
            </div>

            {/* Number input preview (only for math) */}
            {!isChoice && (
                <div className="battle-answer flex-none px-4 pb-2">
                    <div className={cn(
                        "battle-answer-value flex h-11 items-center justify-center rounded-[18px] border text-xl font-black transition-colors app-glass",
                        feedback === "correct" ? "border-emerald-200 text-emerald-600 bg-emerald-50/82" :
                            feedback === "incorrect" ? "border-rose-200 text-rose-600 bg-rose-50/82" :
                                "border-white/80 text-slate-800 bg-white/76"
                    )}>
                        {gameState.userInput || <span className="text-slate-300">?</span>}
                    </div>
                </div>
            )}

            {/* Input area */}
            <div className={cn("battle-keypad-wrap flex-1 min-h-0 px-2 pb-2", isChoice && "battle-choice-wrap")}>
                {isChoice && problem?.choices ? (
                    <ChoiceGroup
                        choices={problem.choices}
                        onSelect={handleChoiceSelect}
                        disabled={disabled}
                    />
                ) : (
                    <TenKey
                        onInput={handleInput}
                        onDelete={handleDelete}
                        onClear={handleClear}
                        onEnter={handleEnter}
                        showDecimal={problem?.showDecimal}
                        compact={isMathProblem && Boolean(problem?.questionVisual)}
                        minRowHeight={44}
                        className="battle-ten-key"
                    />
                )}
            </div>
        </div>
    );
};
