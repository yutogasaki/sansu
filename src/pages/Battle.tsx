import React, { useCallback, useReducer } from "react";
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
import { PlayerId, PlayerConfig } from "../domain/battle/types";
import { playSound } from "../utils/audio";

export const Battle: React.FC = () => {
    const navigate = useNavigate();
    const [state, dispatch] = useReducer(battleReducer, undefined, createInitialBattleState);

    const handleStart = useCallback((p1: PlayerConfig, p2: PlayerConfig) => {
        dispatch({ type: "START_GAME", p1Config: p1, p2Config: p2 });
    }, []);

    const handleCountdownDone = useCallback(() => {
        dispatch({ type: "COUNTDOWN_DONE" });

        // Generate initial problems
        const p1Problem = generateBattleProblem(state.p1.config.grade || 1);
        const p2Problem = generateBattleProblem(state.p2.config.grade || 1);
        dispatch({ type: "SET_PROBLEM", player: "p1", problem: p1Problem });
        dispatch({ type: "SET_PROBLEM", player: "p2", problem: p2Problem });
    }, [state.p1.config.grade, state.p2.config.grade]);

    const handleSubmitAnswer = useCallback(
        (player: PlayerId, answer: string) => {
            const playerState = player === "p1" ? state.p1 : state.p2;
            const problem = playerState.currentProblem;
            if (!problem) return;

            const isCorrect = answer === problem.correctAnswer;

            if (isCorrect) {
                playSound("correct");
                dispatch({ type: "CORRECT_ANSWER", player });

                // Generate next problem
                const grade = playerState.config.grade || 1;
                const newProblem = generateBattleProblem(grade);
                dispatch({ type: "SET_PROBLEM", player, problem: newProblem });
            } else {
                playSound("incorrect");
                dispatch({ type: "INCORRECT_ANSWER", player });
            }
        },
        [state.p1, state.p2]
    );

    const handleInputChange = useCallback(
        (player: PlayerId, input: string) => {
            dispatch({ type: "SET_INPUT", player, input });
        },
        []
    );

    const handlePlayAgain = useCallback(() => {
        dispatch({ type: "RESET" });
    }, []);

    const handleBackToHome = useCallback(() => {
        navigate("/");
    }, [navigate]);

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
                        />
                        <BattleCountdown onComplete={handleCountdownDone} />
                    </>
                )}

                {state.phase === "playing" && (
                    <BattleArena
                        state={state}
                        onSubmitAnswer={handleSubmitAnswer}
                        onInputChange={handleInputChange}
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
