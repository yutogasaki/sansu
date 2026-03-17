import React, { useCallback, useState } from "react";
import { cn } from "../../utils/cn";
import { TenKey } from "../domain/TenKey";
import { ChoiceGroup } from "../domain/ChoiceGroup";
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

export const PlayerPanel: React.FC<PlayerPanelProps> = ({
    gameState,
    onSubmitAnswer,
    onInputChange,
    onSkip,
    showCombo = false,
    disabled = false,
}) => {
    const [feedback, setFeedback] = useState<Feedback>("none");
    const problem = gameState.currentProblem;
    const isChoice = problem?.inputType === "choice";
    const isLocked = gameState.lockSeconds > 0;
    const { scheduleTimeout, clearScheduledTimeouts } = useTimeoutScheduler();

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
            "flex h-full flex-col overflow-hidden rounded-[28px] border border-white/75 shadow-[0_24px_50px_-34px_rgba(15,23,42,0.36)] transition-colors duration-200 app-glass-strong",
            bgFlash
        )}>
            {/* Problem display + skip */}
            <div className="flex-none px-4 pt-4 pb-2">
                <div className="flex items-center justify-between mb-1">
                    <div className="app-pill px-3 py-1 text-xs font-black text-slate-500">
                        {gameState.config.emoji} {gameState.config.name}
                        <span className="ml-1 text-slate-300">
                            {gameState.config.subject === "vocab" ? "🔤" : "🔢"}
                        </span>
                    </div>
                    <button
                        onClick={onSkip}
                        disabled={disabled || isLocked || !problem}
                        className="app-pill px-2.5 py-1 text-[10px] font-black text-slate-500 transition-colors hover:bg-white/84 hover:text-slate-700 disabled:opacity-30"
                    >
                        スキップ ▶
                    </button>
                </div>
                <div className="flex min-h-[4.25rem] items-center justify-center rounded-[22px] border border-white/75 bg-white/52 px-4 text-center text-2xl font-black text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]">
                    {problem?.questionText || "..."}
                </div>
            </div>

            {/* Number input preview (only for math) */}
            {!isChoice && (
                <div className="flex-none px-4 pb-2">
                    <div className={cn(
                        "flex h-11 items-center justify-center rounded-[18px] border text-xl font-black transition-colors app-glass",
                        feedback === "correct" ? "border-emerald-200 text-emerald-600 bg-emerald-50/82" :
                            feedback === "incorrect" ? "border-rose-200 text-rose-600 bg-rose-50/82" :
                                "border-white/80 text-slate-800 bg-white/76"
                    )}>
                        {gameState.userInput || <span className="text-slate-300">?</span>}
                    </div>
                </div>
            )}

            {/* Stats */}
            <div className="flex flex-none justify-center gap-2 px-4 pb-3 text-xs font-black">
                <span className="app-pill px-2.5 py-1 text-emerald-600">○ {gameState.correctCount}</span>
                <span className="app-pill px-2.5 py-1 text-rose-500">× {gameState.incorrectCount}</span>
                {showCombo && (
                    <span className="app-pill px-2.5 py-1 text-cyan-700">🔥 {gameState.combo} コンボ</span>
                )}
                {showCombo && isLocked && (
                    <span className="app-pill px-2.5 py-1 text-rose-600">⏳ {gameState.lockSeconds}びょう まって</span>
                )}
            </div>

            {/* Input area */}
            <div className="flex-1 min-h-0 px-2 pb-2">
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
                    />
                )}
            </div>
        </div>
    );
};
