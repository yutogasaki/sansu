import React, { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import {
    InsetPanel,
    SectionLabel,
    SegmentedControl,
    SurfacePanel,
    SurfacePanelHeader,
} from "../ui/SurfacePanel";
import { cn } from "../../utils/cn";
import { BattleGameMode, BattleGrade, BattleSubject, PlayerConfig } from "../../domain/battle/types";

const AVATARS = ["🐱", "🐶", "🐰", "🐻", "🐼", "🦊", "🐸", "🐧"];
const GRADE_LABELS: Record<BattleGrade, string> = {
    [-2]: "ねんしょう",
    [-1]: "ねんちゅう",
    0: "ねんちょう",
    1: "1ねんせい",
    2: "2ねんせい",
    3: "3ねんせい",
    4: "4ねんせい",
    5: "5ねんせい",
    6: "6ねんせい",
};

const SUBJECT_OPTIONS: { value: BattleSubject; label: string; icon: string }[] = [
    { value: "math", label: "さんすう", icon: "🔢" },
    { value: "vocab", label: "えいたんご", icon: "🔤" },
];

const MODE_COPY: Record<BattleGameMode, { title: string; description: string; badge: string }> = {
    tug_of_war: {
        title: "つなひき たいせん",
        description: "さきに ひっぱりきったほうが かち",
        badge: "たいせん",
    },
    boss_coop: {
        title: "ボス きょうりょく",
        description: "ふたりで じかんないに ボスを たおそう",
        badge: "きょうりょく",
    },
};

interface BattleSetupProps {
    onStart: (p1: PlayerConfig, p2: PlayerConfig, mode: BattleGameMode) => void;
    onBack: () => void;
}

interface PlayerSetup {
    name: string;
    grade: BattleGrade | null;
    emoji: string;
    subject: BattleSubject;
}

interface PlayerSetupPanelProps {
    label: string;
    setup: PlayerSetup;
    onChange: (s: PlayerSetup) => void;
    defaultName: string;
    accent: "sky" | "amber";
}

const playerToneClassMap = {
    sky: {
        badge: "primary" as const,
        emoji: "bg-sky-100 text-sky-700",
        gradeSelected: "border-sky-200 bg-sky-600 text-white shadow-[0_12px_24px_-18px_rgba(2,132,199,0.7)]",
        avatarSelected: "border-sky-200 bg-sky-600/90 text-white shadow-[0_14px_24px_-18px_rgba(2,132,199,0.7)]",
        title: "text-sky-700",
    },
    amber: {
        badge: "warning" as const,
        emoji: "bg-amber-100 text-amber-700",
        gradeSelected: "border-amber-200 bg-amber-500 text-white shadow-[0_12px_24px_-18px_rgba(217,119,6,0.7)]",
        avatarSelected: "border-amber-200 bg-amber-500/90 text-white shadow-[0_14px_24px_-18px_rgba(217,119,6,0.7)]",
        title: "text-amber-700",
    },
};

const PlayerSetupPanel: React.FC<PlayerSetupPanelProps> = ({
    label,
    setup,
    onChange,
    defaultName,
    accent,
}) => {
    const tone = playerToneClassMap[accent];

    return (
        <SurfacePanel className="flex min-h-0 flex-col space-y-3 overflow-y-auto p-3">
            <div className="flex items-center justify-between gap-3">
                <Badge variant={tone.badge}>{label}</Badge>
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-full text-xl shadow-sm", tone.emoji)}>
                    {setup.emoji}
                </div>
            </div>

            <SurfacePanelHeader
                title={<span className={cn("text-base", tone.title)}>{setup.name || defaultName}</span>}
                description="なまえ と もんだいを えらぼう"
            />

            <input
                type="text"
                value={setup.name}
                onChange={(event) => onChange({ ...setup, name: event.target.value })}
                placeholder={defaultName}
                maxLength={8}
                className="w-full rounded-[16px] border border-white/85 bg-white/74 px-3 py-2.5 text-center text-base font-bold text-slate-700 outline-none transition focus:border-cyan-500"
            />

            <InsetPanel className="space-y-2">
                <SectionLabel className="px-0">アイコン</SectionLabel>
                <div className="grid grid-cols-4 gap-1.5">
                    {AVATARS.map((emoji) => {
                        const active = setup.emoji === emoji;

                        return (
                            <button
                                key={emoji}
                                type="button"
                                onClick={() => onChange({ ...setup, emoji })}
                                className={cn(
                                    "flex h-10 items-center justify-center rounded-[14px] border text-xl transition-all",
                                    active
                                        ? tone.avatarSelected
                                        : "border-white/80 bg-white/72 text-slate-700 hover:bg-white"
                                )}
                            >
                                {emoji}
                            </button>
                        );
                    })}
                </div>
            </InsetPanel>

            <InsetPanel className="space-y-2">
                <SectionLabel className="px-0">もんだい</SectionLabel>
                <SegmentedControl
                    value={setup.subject}
                    onChange={(subject) => onChange({ ...setup, subject })}
                    options={SUBJECT_OPTIONS.map((option) => ({
                        value: option.value,
                        label: (
                            <span className="inline-flex items-center gap-1.5">
                                <span>{option.icon}</span>
                                <span>{option.label}</span>
                            </span>
                        ),
                    }))}
                />
            </InsetPanel>

            <InsetPanel className="space-y-2">
                <SectionLabel className="px-0">がくねん</SectionLabel>
                <div className="grid grid-cols-3 gap-1.5">
                    {([-2, -1, 0, 1, 2, 3, 4, 5, 6] as BattleGrade[]).map((grade) => {
                        const active = setup.grade === grade;

                        return (
                            <button
                                key={grade}
                                type="button"
                                onClick={() => onChange({ ...setup, grade })}
                                className={cn(
                                    "rounded-[12px] border px-2 py-1.5 text-[11px] font-bold transition-all",
                                    active
                                        ? tone.gradeSelected
                                        : "border-white/80 bg-white/72 text-slate-600 hover:bg-white"
                                )}
                            >
                                {GRADE_LABELS[grade]}
                            </button>
                        );
                    })}
                </div>
            </InsetPanel>
        </SurfacePanel>
    );
};

export const BattleSetup: React.FC<BattleSetupProps> = ({ onStart, onBack }) => {
    const [p1, setP1] = useState<PlayerSetup>({ name: "", grade: null, emoji: "🐱", subject: "math" });
    const [p2, setP2] = useState<PlayerSetup>({ name: "", grade: null, emoji: "🐶", subject: "math" });
    const [mode, setMode] = useState<BattleGameMode>("tug_of_war");

    const canStart = p1.grade !== null && p2.grade !== null && p1.emoji && p2.emoji;
    const currentMode = MODE_COPY[mode];

    const handleStart = () => {
        if (!canStart) return;

        onStart(
            { name: p1.name || "プレイヤー1", grade: p1.grade!, emoji: p1.emoji, subject: p1.subject },
            { name: p2.name || "プレイヤー2", grade: p2.grade!, emoji: p2.emoji, subject: p2.subject },
            mode
        );
    };

    return (
        <div className="flex h-full min-h-0 flex-col bg-transparent px-6 py-5">
            <div className="flex items-center justify-between gap-4">
                <Button variant="secondary" size="md" onClick={onBack}>
                    もどる
                </Button>
                <div className="text-center">
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                        battle
                    </div>
                    <div className="text-[1.75rem] font-black tracking-[-0.03em] text-slate-800">
                        たいせん ゲーム
                    </div>
                </div>
                <div className="w-[92px]" />
            </div>

            <SurfacePanel variant="flat" className="mt-3 space-y-3">
                <div className="flex items-start justify-between gap-4">
                    <SurfacePanelHeader
                        title={currentMode.title}
                        description={currentMode.description}
                    />
                    <Badge variant={mode === "boss_coop" ? "warning" : "primary"}>
                        {currentMode.badge}
                    </Badge>
                </div>
                <SegmentedControl
                    value={mode}
                    onChange={setMode}
                    options={[
                        { value: "tug_of_war", label: "🪢 つなひき" },
                        { value: "boss_coop", label: "🐲 ボスきょうりょく" },
                    ]}
                />
            </SurfacePanel>

            <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 gap-3 pb-2">
                    <PlayerSetupPanel
                        label="プレイヤー 1"
                        setup={p1}
                        onChange={setP1}
                        defaultName="プレイヤー1"
                        accent="sky"
                    />
                    <PlayerSetupPanel
                        label="プレイヤー 2"
                        setup={p2}
                        onChange={setP2}
                        defaultName="プレイヤー2"
                        accent="amber"
                    />
                </div>
            </div>

            <motion.div
                className="mt-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <Button
                    onClick={handleStart}
                    disabled={!canStart}
                    size="xl"
                    className={cn(
                        "w-full text-lg shadow-[0_18px_34px_-22px_rgba(15,23,42,0.45)]",
                        canStart && "bg-[linear-gradient(135deg,#38bdf8,#f59e0b)]"
                    )}
                >
                    スタート！
                </Button>
            </motion.div>
        </div>
    );
};
