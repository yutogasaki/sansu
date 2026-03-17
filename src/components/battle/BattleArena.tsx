import React from "react";
import { TugOfWarBar } from "./TugOfWarBar";
import { BossCoopBar } from "./BossCoopBar";
import { PlayerPanel } from "./PlayerPanel";
import { BattleGameState, PlayerId } from "../../domain/battle/types";

interface BattleArenaProps {
    state: BattleGameState;
    onSubmitAnswer: (player: PlayerId, answer: string) => void;
    onInputChange: (player: PlayerId, input: string) => void;
    onSkip: (player: PlayerId) => void;
    onCancel: () => void;
}

export const BattleArena: React.FC<BattleArenaProps> = ({
    state,
    onSubmitAnswer,
    onInputChange,
    onSkip,
    onCancel,
}) => {
    const isOver = state.winner !== null;
    const showBossCoop = state.gameMode === "boss_coop";
    const totalDamage = state.p1.damageDealt + state.p2.damageDealt;

    return (
        <div className="flex h-full flex-col bg-transparent px-4 py-4">
            {/* Top game bar */}
            <div className="flex-none">
                {showBossCoop ? (
                    <BossCoopBar
                        bossHp={state.bossHp}
                        bossMaxHp={state.bossMaxHp}
                        remainingSec={state.remainingSec}
                        totalDamage={totalDamage}
                        onCancel={onCancel}
                    />
                ) : (
                    <TugOfWarBar
                        position={state.ropePosition}
                        maxSteps={state.maxSteps}
                        p1Emoji={state.p1.config.emoji}
                        p2Emoji={state.p2.config.emoji}
                        p1Name={state.p1.config.name}
                        p2Name={state.p2.config.name}
                        onCancel={onCancel}
                    />
                )}
            </div>

            {/* Player panels */}
            <div className="mt-3 flex min-h-0 flex-1 gap-3">
                <div className="min-w-0 flex-1">
                    <PlayerPanel
                        player="p1"
                        gameState={state.p1}
                        onSubmitAnswer={(ans) => onSubmitAnswer("p1", ans)}
                        onInputChange={(inp) => onInputChange("p1", inp)}
                        onSkip={() => onSkip("p1")}
                        showCombo={showBossCoop}
                        disabled={isOver}
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <PlayerPanel
                        player="p2"
                        gameState={state.p2}
                        onSubmitAnswer={(ans) => onSubmitAnswer("p2", ans)}
                        onInputChange={(inp) => onInputChange("p2", inp)}
                        onSkip={() => onSkip("p2")}
                        showCombo={showBossCoop}
                        disabled={isOver}
                    />
                </div>
            </div>
        </div>
    );
};
