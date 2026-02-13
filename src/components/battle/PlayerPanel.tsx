import React, { useCallback, useState } from "react";
import { cn } from "../../utils/cn";
import { BattleTenKey } from "./BattleTenKey";
import { PlayerGameState, PlayerId } from "../../domain/battle/types";

interface PlayerPanelProps {
    player: PlayerId;
    gameState: PlayerGameState;
    onSubmitAnswer: (answer: string) => void;
    onInputChange: (input: string) => void;
    disabled?: boolean;
}

type Feedback = "none" | "correct" | "incorrect";

export const PlayerPanel: React.FC<PlayerPanelProps> = ({
    player,
    gameState,
    onSubmitAnswer,
    onInputChange,
    disabled = false,
}) => {
    const [feedback, setFeedback] = useState<Feedback>("none");
    const isP1 = player === "p1";
    const problem = gameState.currentProblem;

    const flashFeedback = useCallback((type: Feedback) => {
        setFeedback(type);
        setTimeout(() => setFeedback("none"), 300);
    }, []);

    const handleInput = useCallback(
        (val: number | string) => {
            if (disabled || !problem) return;
            const next = gameState.userInput + String(val);
            onInputChange(next);
        },
        [disabled, problem, gameState.userInput, onInputChange]
    );

    const handleDelete = useCallback(() => {
        if (disabled || !problem) return;
        const next = gameState.userInput.slice(0, -1);
        onInputChange(next);
    }, [disabled, problem, gameState.userInput, onInputChange]);

    const handleEnter = useCallback(() => {
        if (disabled || !problem || gameState.userInput === "") return;
        const isCorrect = gameState.userInput === problem.correctAnswer;
        flashFeedback(isCorrect ? "correct" : "incorrect");
        onSubmitAnswer(gameState.userInput);
    }, [disabled, problem, gameState.userInput, onSubmitAnswer, flashFeedback]);

    const bgFlash = feedback === "correct"
        ? "bg-emerald-50"
        : feedback === "incorrect"
            ? "bg-red-50"
            : "bg-white/60";

    return (
        <div className={cn(
            "flex flex-col h-full transition-colors duration-200 rounded-2xl",
            bgFlash,
            isP1 ? "border-r border-slate-200" : ""
        )}>
            {/* Problem display */}
            <div className="flex-none px-3 pt-3 pb-1">
                <div className="text-xs font-bold text-slate-400 mb-1">
                    {gameState.config.emoji} {gameState.config.name}
                </div>
                <div className="text-center text-2xl font-black text-slate-800 min-h-[2.5rem] flex items-center justify-center">
                    {problem?.questionText || "..."}
                </div>
            </div>

            {/* Input preview */}
            <div className="flex-none px-3 pb-2">
                <div className={cn(
                    "h-10 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-colors",
                    feedback === "correct" ? "border-emerald-400 text-emerald-600 bg-emerald-50" :
                        feedback === "incorrect" ? "border-red-400 text-red-600 bg-red-50" :
                            "border-slate-200 text-slate-800 bg-white"
                )}>
                    {gameState.userInput || <span className="text-slate-300">?</span>}
                </div>
            </div>

            {/* Stats */}
            <div className="flex-none flex justify-center gap-3 px-3 pb-1 text-xs font-bold text-slate-400">
                <span className="text-emerald-500">○ {gameState.correctCount}</span>
                <span className="text-red-400">× {gameState.incorrectCount}</span>
            </div>

            {/* TenKey */}
            <div className="flex-1 min-h-0">
                <BattleTenKey
                    onInput={handleInput}
                    onDelete={handleDelete}
                    onEnter={handleEnter}
                    showDecimal={problem?.showDecimal}
                    disabled={disabled}
                />
            </div>
        </div>
    );
};
