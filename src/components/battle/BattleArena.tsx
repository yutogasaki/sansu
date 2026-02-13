import React from "react";
import { TugOfWarBar } from "./TugOfWarBar";
import { PlayerPanel } from "./PlayerPanel";
import { BattleGameState, PlayerId } from "../../domain/battle/types";

interface BattleArenaProps {
    state: BattleGameState;
    onSubmitAnswer: (player: PlayerId, answer: string) => void;
    onInputChange: (player: PlayerId, input: string) => void;
}

export const BattleArena: React.FC<BattleArenaProps> = ({
    state,
    onSubmitAnswer,
    onInputChange,
}) => {
    const isOver = state.winner !== null;

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* Tug of War Bar */}
            <div className="flex-none">
                <TugOfWarBar
                    position={state.ropePosition}
                    maxSteps={state.maxSteps}
                    p1Emoji={state.p1.config.emoji}
                    p2Emoji={state.p2.config.emoji}
                    p1Name={state.p1.config.name}
                    p2Name={state.p2.config.name}
                />
            </div>

            {/* Player panels */}
            <div className="flex-1 flex min-h-0">
                <div className="flex-1 min-w-0">
                    <PlayerPanel
                        player="p1"
                        gameState={state.p1}
                        onSubmitAnswer={(ans) => onSubmitAnswer("p1", ans)}
                        onInputChange={(inp) => onInputChange("p1", inp)}
                        disabled={isOver}
                    />
                </div>
                <div className="w-px bg-slate-300" />
                <div className="flex-1 min-w-0">
                    <PlayerPanel
                        player="p2"
                        gameState={state.p2}
                        onSubmitAnswer={(ans) => onSubmitAnswer("p2", ans)}
                        onInputChange={(inp) => onInputChange("p2", inp)}
                        disabled={isOver}
                    />
                </div>
            </div>
        </div>
    );
};
