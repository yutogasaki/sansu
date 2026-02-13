import React, { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";
import { BattleGrade, BattleSubject, PlayerConfig } from "../../domain/battle/types";

const AVATARS = ["🐱", "🐶", "🐰", "🐻", "🐼", "🦊", "🐸", "🐧"];
const GRADE_LABELS: Record<BattleGrade, string> = {
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

interface BattleSetupProps {
    onStart: (p1: PlayerConfig, p2: PlayerConfig) => void;
    onBack: () => void;
}

interface PlayerSetup {
    name: string;
    grade: BattleGrade | null;
    emoji: string;
    subject: BattleSubject;
}

const PlayerSetupPanel: React.FC<{
    label: string;
    setup: PlayerSetup;
    onChange: (s: PlayerSetup) => void;
    defaultName: string;
    color: string;
}> = ({ label, setup, onChange, defaultName, color }) => (
    <div className="flex flex-col items-center gap-2 p-4 flex-1 overflow-y-auto">
        <div className={cn("text-lg font-black", color)}>{label}</div>

        {/* Name */}
        <input
            type="text"
            value={setup.name}
            onChange={(e) => onChange({ ...setup, name: e.target.value })}
            placeholder={defaultName}
            maxLength={8}
            className="w-full max-w-[200px] h-10 rounded-xl border-2 border-slate-200 px-3 text-center text-base font-bold text-slate-800 bg-white focus:border-slate-400 focus:outline-none"
        />

        {/* Avatar */}
        <div className="grid grid-cols-4 gap-1.5">
            {AVATARS.map((e) => (
                <button
                    key={e}
                    onClick={() => onChange({ ...setup, emoji: e })}
                    className={cn(
                        "w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all",
                        setup.emoji === e
                            ? "bg-slate-800 scale-110 shadow-md"
                            : "bg-white border border-slate-200 hover:bg-slate-50"
                    )}
                >
                    {e}
                </button>
            ))}
        </div>

        {/* Subject */}
        <div className="text-xs font-bold text-slate-400 mt-1">もんだい</div>
        <div className="flex gap-2">
            {SUBJECT_OPTIONS.map((opt) => (
                <button
                    key={opt.value}
                    onClick={() => onChange({ ...setup, subject: opt.value })}
                    className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                        setup.subject === opt.value
                            ? "bg-slate-800 text-white shadow-md"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                >
                    {opt.icon} {opt.label}
                </button>
            ))}
        </div>

        {/* Grade */}
        <div className="text-xs font-bold text-slate-400 mt-1">がくねん</div>
        <div className="grid grid-cols-3 gap-1.5">
            {([1, 2, 3, 4, 5, 6] as BattleGrade[]).map((g) => (
                <button
                    key={g}
                    onClick={() => onChange({ ...setup, grade: g })}
                    className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                        setup.grade === g
                            ? "bg-slate-800 text-white shadow-md"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                >
                    {GRADE_LABELS[g]}
                </button>
            ))}
        </div>
    </div>
);

export const BattleSetup: React.FC<BattleSetupProps> = ({ onStart, onBack }) => {
    const [p1, setP1] = useState<PlayerSetup>({ name: "", grade: null, emoji: "🐱", subject: "math" });
    const [p2, setP2] = useState<PlayerSetup>({ name: "", grade: null, emoji: "🐶", subject: "math" });

    const canStart = p1.grade !== null && p2.grade !== null && p1.emoji && p2.emoji;

    const handleStart = () => {
        if (!canStart) return;
        onStart(
            { name: p1.name || "プレイヤー1", grade: p1.grade!, emoji: p1.emoji, subject: p1.subject },
            { name: p2.name || "プレイヤー2", grade: p2.grade!, emoji: p2.emoji, subject: p2.subject }
        );
    };

    return (
        <div className="h-full flex flex-col bg-gradient-to-b from-slate-50 to-white">
            {/* Header */}
            <div className="flex-none flex items-center justify-between px-4 pt-3 pb-2">
                <button
                    onClick={onBack}
                    className="px-3 py-1.5 rounded-full text-sm font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-50"
                >
                    ← もどる
                </button>
                <div className="text-xl font-black text-slate-800">つなひき たいせん</div>
                <div className="w-20" />
            </div>

            {/* Player setup panels */}
            <div className="flex-1 flex min-h-0">
                <PlayerSetupPanel
                    label="プレイヤー 1"
                    setup={p1}
                    onChange={setP1}
                    defaultName="プレイヤー1"
                    color="text-sky-600"
                />
                <div className="w-px bg-slate-200 self-stretch my-4" />
                <PlayerSetupPanel
                    label="プレイヤー 2"
                    setup={p2}
                    onChange={setP2}
                    defaultName="プレイヤー2"
                    color="text-amber-600"
                />
            </div>

            {/* Start button */}
            <motion.div
                className="flex-none p-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <button
                    onClick={handleStart}
                    disabled={!canStart}
                    className={cn(
                        "w-full h-14 rounded-2xl text-lg font-black transition-all",
                        canStart
                            ? "bg-gradient-to-r from-sky-500 to-amber-500 text-white shadow-lg hover:shadow-xl active:scale-[0.98]"
                            : "bg-slate-200 text-slate-400 cursor-not-allowed"
                    )}
                >
                    スタート！
                </button>
            </motion.div>
        </div>
    );
};
