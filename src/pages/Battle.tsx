import React, { useCallback, useEffect, useReducer } from "react";
import { useNavigate } from "react-router-dom";
import { OrientationGate } from "../components/battle/OrientationGate";
import { BattleSetup } from "../components/battle/BattleSetup";
import { BattleCountdown } from "../components/battle/BattleCountdown";
import { BattleArena } from "../components/battle/BattleArena";
import { BattleResult } from "../components/battle/BattleResult";
import {
    battleReducer,
    createInitialBattleState,
    generateBattleProblem,
} from "../domain/battle/engine";
import { PlayerId, PlayerConfig, BattleGameMode } from "../domain/battle/types";
import { playSound } from "../utils/audio";

export const Battle: React.FC = () => {
    const navigate = useNavigate();
    const [state, dispatch] = useReducer(battleReducer, undefined, createInitialBattleState);

    const handleStart = useCallback((p1: PlayerConfig, p2: PlayerConfig, mode: BattleGameMode) => {
        dispatch({ type: "START_GAME", p1Config: p1, p2Config: p2, mode });
    }, []);

    const handleCountdownDone = useCallback(() => {
        dispatch({ type: "COUNTDOWN_DONE" });

        // Generate initial problems based on each player's subject
        const p1Problem = generateBattleProblem(
            state.p1.config.grade || 1,
            state.p1.config.subject
        );
        const p2Problem = generateBattleProblem(
            state.p2.config.grade || 1,
            state.p2.config.subject
        );
        dispatch({ type: "SET_PROBLEM", player: "p1", problem: p1Problem });
        dispatch({ type: "SET_PROBLEM", player: "p2", problem: p2Problem });
    }, [state.p1.config.grade, state.p1.config.subject, state.p2.config.grade, state.p2.config.subject]);

    const handleSubmitAnswer = useCallback(
        (player: PlayerId, answer: string) => {
            const playerState = player === "p1" ? state.p1 : state.p2;
            const problem = playerState.currentProblem;
            if (!problem) return;
            if (state.gameMode === "boss_coop" && playerState.lockSeconds > 0) return;

            const isCorrect = answer === problem.correctAnswer;

            if (isCorrect) {
                playSound("correct");
                dispatch({ type: "CORRECT_ANSWER", player });

                // Generate next problem
                const grade = playerState.config.grade || 1;
                const newProblem = generateBattleProblem(grade, playerState.config.subject);
                dispatch({ type: "SET_PROBLEM", player, problem: newProblem });
            } else {
                playSound("incorrect");
                dispatch({ type: "INCORRECT_ANSWER", player });
            }
        },
        [state.gameMode, state.p1, state.p2]
    );

    const handleInputChange = useCallback(
        (player: PlayerId, input: string) => {
            dispatch({ type: "SET_INPUT", player, input });
        },
        []
    );

    const handleSkip = useCallback(
        (player: PlayerId) => {
            const playerState = player === "p1" ? state.p1 : state.p2;
            const grade = playerState.config.grade || 1;
            const newProblem = generateBattleProblem(grade, playerState.config.subject);
            dispatch({ type: "SET_PROBLEM", player, problem: newProblem });
        },
        [state.p1, state.p2]
    );

    const handleCancel = useCallback(() => {
        dispatch({ type: "RESET" });
    }, []);

    const handlePlayAgain = useCallback(() => {
        dispatch({ type: "RESET" });
    }, []);

    const handleBackToHome = useCallback(() => {
        navigate("/");
    }, [navigate]);

    useEffect(() => {
        if (state.phase !== "playing" || state.gameMode !== "boss_coop") return;
        const id = window.setInterval(() => {
            dispatch({ type: "TICK" });
        }, 1000);
        return () => window.clearInterval(id);
    }, [state.phase, state.gameMode]);

    return (
        <OrientationGate>
            <div className="h-screen w-screen overflow-hidden">
                {state.phase === "setup" && (
                    <BattleSetup
                        onStart={handleStart}
                        onBack={() => navigate("/")}
                    />
                )}

                {state.phase === "countdown" && (
                    <>
                        <BattleArena
                            state={state}
                            onSubmitAnswer={handleSubmitAnswer}
                            onInputChange={handleInputChange}
                            onSkip={handleSkip}
                            onCancel={handleCancel}
                        />
                        <BattleCountdown onComplete={handleCountdownDone} />
                    </>
                )}

                {state.phase === "playing" && (
                    <BattleArena
                        state={state}
                        onSubmitAnswer={handleSubmitAnswer}
                        onInputChange={handleInputChange}
                        onSkip={handleSkip}
                        onCancel={handleCancel}
                    />
                )}

                {state.phase === "result" && (
                    <BattleResult
                        state={state}
                        onPlayAgain={handlePlayAgain}
                        onBackToHome={handleBackToHome}
                    />
                )}
            </div>
        </OrientationGate>
    );
};
