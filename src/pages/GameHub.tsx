import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { Icons } from "../components/icons";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { InsetPanel, SectionLabel, SelectionCard, SurfacePanel, SurfacePanelHeader } from "../components/ui/SurfacePanel";

const GAME_OPTIONS = [
    {
        id: "tug_of_war",
        emoji: "🪢",
        title: "つなひき たいせん",
        description: "さきに つなを ひっぱりきった ほうが かち",
        badge: { label: "たいせん", variant: "primary" as const },
        to: "/battle/play?mode=tug_of_war",
    },
    {
        id: "boss_coop",
        emoji: "🐲",
        title: "ボス きょうりょく",
        description: "ふたりで ちからを あわせて ボスを たおそう",
        badge: { label: "きょうりょく", variant: "warning" as const },
        to: "/battle/play?mode=boss_coop",
    },
];

export const GameHub: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="relative h-full overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.18),transparent_28%)]" />

            <ScreenScaffold
                title="Game"
                subtitle="あそびかたを えらぼう"
                contentClassName="px-[var(--screen-padding-x)]"
            >
                <div className="space-y-4 pb-4">
                    <SurfacePanel className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                            <SurfacePanelHeader
                                title="ふたりで あそぶ"
                                description="あそびたい ゲームを えらんで すぐに はじめよう"
                            />
                            <Badge variant="primary">2 GAME</Badge>
                        </div>

                        <div className="space-y-3">
                            {GAME_OPTIONS.map((option, index) => (
                                <motion.div
                                    key={option.id}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.24, delay: index * 0.06 }}
                                >
                                    <SelectionCard
                                        leading={<span aria-hidden="true">{option.emoji}</span>}
                                        label={
                                            <span className="flex items-center gap-2">
                                                <span>{option.title}</span>
                                                <Badge variant={option.badge.variant}>{option.badge.label}</Badge>
                                            </span>
                                        }
                                        description={option.description}
                                        trailing={<Icons.ArrowRight className="h-5 w-5" />}
                                        onClick={() => navigate(option.to)}
                                    />
                                </motion.div>
                            ))}
                        </div>
                    </SurfacePanel>

                    <SurfacePanel variant="flat" className="space-y-3">
                        <SurfacePanelHeader
                            title="じゅんびから はじめる"
                            description="プレイヤー名や がくねんは このあと えらべるよ"
                        />
                        <Button size="xl" onClick={() => navigate("/battle/play")}>
                            セットアップを ひらく
                        </Button>
                    </SurfacePanel>

                    <InsetPanel className="space-y-2">
                        <SectionLabel className="px-0">Game Menu</SectionLabel>
                        <p className="text-sm font-medium leading-6 text-slate-600">
                            これから ゲームを ふやしても、ここから えらべるように してあります。
                        </p>
                    </InsetPanel>
                </div>
            </ScreenScaffold>
        </div>
    );
};
