import React from "react";
import { TugOfWarRope } from "./TugOfWarRope";
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
        <div className="h-full flex bg-slate-50">
            {/* P1 panel */}
            <div className="flex-1 min-w-0">
                <PlayerPanel
                    player="p1"
                    gameState={state.p1}
                    onSubmitAnswer={(ans) => onSubmitAnswer("p1", ans)}
                    onInputChange={(inp) => onInputChange("p1", inp)}
                    disabled={isOver}
                />
            </div>

            {/* Center tug-of-war rope visual */}
            <div className="flex-none">
                <TugOfWarRope
                    position={state.ropePosition}
                    maxSteps={state.maxSteps}
                    p1Emoji={state.p1.config.emoji}
                    p2Emoji={state.p2.config.emoji}
                />
            </div>

            {/* P2 panel */}
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
    );
};
