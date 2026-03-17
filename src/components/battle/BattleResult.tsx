import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { playSound } from "../../utils/audio";
import { BattleGameState } from "../../domain/battle/types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { InsetPanel, SurfacePanel, SurfacePanelHeader } from "../ui/SurfacePanel";

interface BattleResultProps {
    state: BattleGameState;
    onPlayAgain: () => void;
    onBackToHome: () => void;
}

interface ResultMetricProps {
    label: string;
    value: React.ReactNode;
    tone?: "default" | "sky" | "mint" | "amber";
}

const metricToneClassMap: Record<NonNullable<ResultMetricProps["tone"]>, string> = {
    default: "text-slate-800",
    sky: "text-sky-700",
    mint: "text-emerald-700",
    amber: "text-amber-700",
};

const ResultMetric: React.FC<ResultMetricProps> = ({ label, value, tone = "default" }) => (
    <InsetPanel className="space-y-1 py-4 text-center">
        <div className={`text-2xl font-black tracking-[-0.04em] ${metricToneClassMap[tone]}`}>{value}</div>
        <div className="text-[11px] font-bold tracking-[0.12em] text-slate-500">{label}</div>
    </InsetPanel>
);

export const BattleResult: React.FC<BattleResultProps> = ({
    state,
    onPlayAgain,
    onBackToHome,
}) => {
    const isBossCoop = state.gameMode === "boss_coop";
    const winner = state.winner === "p1" ? state.p1 : state.p2;
    const loser = state.winner === "p1" ? state.p2 : state.p1;
    const duration = state.finishedAt && state.startedAt
        ? Math.round((state.finishedAt - state.startedAt) / 1000)
        : 0;
    const totalDamage = state.p1.damageDealt + state.p2.damageDealt;
    const cleared = state.bossCleared;

    useEffect(() => {
        playSound("clear");
    }, []);

    if (isBossCoop) {
        return (
            <div className="flex h-full items-center justify-center bg-transparent px-6 py-5">
                <SurfacePanel className="w-full max-w-4xl space-y-5">
                    <div className="flex items-start justify-between gap-4">
                        <SurfacePanelHeader
                            title={cleared ? "ボス げきは！" : "じかんぎれ..."}
                            description={cleared ? "ふたりで ちからを あわせて クリア！" : "もういちど ちょうせんしよう"}
                        />
                        <Badge variant={cleared ? "success" : "warning"}>
                            {cleared ? "きょうりょく せいこう" : "もういちど"}
                        </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <ResultMetric
                            label="ボスHP"
                            value={`${state.bossHp}/${state.bossMaxHp}`}
                            tone={cleared ? "mint" : "amber"}
                        />
                        <ResultMetric label="チームダメージ" value={totalDamage} tone="sky" />
                        <ResultMetric
                            label="のこりじかん"
                            value={`${Math.floor(state.remainingSec / 60)}:${String(state.remainingSec % 60).padStart(2, "0")}`}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <InsetPanel className="space-y-2 text-center">
                            <div className="text-3xl">{state.p1.config.emoji}</div>
                            <div className="font-black text-slate-800">{state.p1.config.name}</div>
                            <div className="text-2xl font-black text-sky-700">{state.p1.damageDealt}</div>
                            <div className="text-xs font-bold text-slate-400">ダメージ</div>
                        </InsetPanel>
                        <InsetPanel className="space-y-2 text-center">
                            <div className="text-3xl">{state.p2.config.emoji}</div>
                            <div className="font-black text-slate-800">{state.p2.config.name}</div>
                            <div className="text-2xl font-black text-amber-700">{state.p2.damageDealt}</div>
                            <div className="text-xs font-bold text-slate-400">ダメージ</div>
                        </InsetPanel>
                    </div>

                    <div className="flex gap-3">
                        <Button onClick={onPlayAgain} size="xl" className="flex-1 bg-[linear-gradient(135deg,#2BBAA0,#38bdf8)]">
                            もう いっかい！
                        </Button>
                        <Button onClick={onBackToHome} variant="secondary" size="xl" className="flex-1">
                            おわる
                        </Button>
                    </div>
                </SurfacePanel>
            </div>
        );
    }

    return (
        <div className="relative flex h-full items-center justify-center bg-transparent px-6 py-5">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {Array.from({ length: 12 }, (_, index) => (
                    <motion.div
                        key={index}
                        className="absolute text-2xl"
                        initial={{
                            x: `${26 + Math.random() * 48}%`,
                            y: "-10%",
                            rotate: 0,
                            opacity: 1,
                        }}
                        animate={{
                            y: "110%",
                            rotate: 360 + Math.random() * 360,
                            opacity: 0,
                        }}
                        transition={{
                            duration: 2 + Math.random() * 2,
                            delay: Math.random() * 1.5,
                            ease: "easeIn",
                        }}
                    >
                        {["•", "✦", "·", "✧"][index % 4]}
                    </motion.div>
                ))}
            </div>

            <SurfacePanel className="relative z-10 w-full max-w-4xl space-y-5">
                <div className="flex items-start justify-between gap-4">
                    <SurfacePanelHeader
                        title={`${winner.config.name} の かち！`}
                        description="けっかを みて つぎの しょうぶへ いこう"
                    />
                    <Badge variant="success">しょうり</Badge>
                </div>

                <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-4">
                    <InsetPanel className="flex items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-700">
                            {winner.config.emoji}
                        </div>
                        <div>
                            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                                winner
                            </div>
                            <div className="text-2xl font-black tracking-[-0.03em] text-slate-800">
                                {winner.config.name}
                            </div>
                        </div>
                    </InsetPanel>
                    <ResultMetric label="しょうぶじかん" value={`${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`} />
                    <ResultMetric label="せいかいさ" value={winner.correctCount - loser.correctCount} tone="mint" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <InsetPanel className="space-y-2 text-center">
                        <div className="text-3xl">{winner.config.emoji}</div>
                        <div className="font-black text-slate-800">{winner.config.name}</div>
                        <div className="text-2xl font-black text-emerald-700">{winner.correctCount}</div>
                        <div className="text-xs font-bold text-slate-400">せいかい</div>
                    </InsetPanel>
                    <InsetPanel className="space-y-2 text-center">
                        <div className="text-3xl">{loser.config.emoji}</div>
                        <div className="font-black text-slate-800">{loser.config.name}</div>
                        <div className="text-2xl font-black text-sky-700">{loser.correctCount}</div>
                        <div className="text-xs font-bold text-slate-400">せいかい</div>
                    </InsetPanel>
                </div>

                <div className="flex gap-3">
                    <Button onClick={onPlayAgain} size="xl" className="flex-1 bg-[linear-gradient(135deg,#2BBAA0,#38bdf8)]">
                        もう いっかい！
                    </Button>
                    <Button onClick={onBackToHome} variant="secondary" size="xl" className="flex-1">
                        おわる
                    </Button>
                </div>
            </SurfacePanel>
        </div>
    );
};
