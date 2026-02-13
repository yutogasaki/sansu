import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";

interface BossCoopBarProps {
    bossHp: number;
    bossMaxHp: number;
    remainingSec: number;
    totalDamage: number;
    onCancel?: () => void;
}

export const BossCoopBar: React.FC<BossCoopBarProps> = ({
    bossHp,
    bossMaxHp,
    remainingSec,
    totalDamage,
    onCancel,
}) => {
    const hpPct = Math.max(0, Math.min(100, (bossHp / bossMaxHp) * 100));
    const mm = Math.floor(remainingSec / 60);
    const ss = String(remainingSec % 60).padStart(2, "0");
    const danger = remainingSec <= 10;

    return (
        <div className="w-full px-4 py-2 bg-gradient-to-b from-violet-100 via-fuchsia-50 to-white border-b border-violet-200">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">🐲</span>
                    <div>
                        <div className="text-sm font-black text-violet-700">ボス きょうりょくせん</div>
                        <div className="text-[11px] text-violet-500 font-bold">2にんでHPを0にしよう</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-black border",
                        danger
                            ? "bg-red-100 text-red-600 border-red-300"
                            : "bg-white text-violet-600 border-violet-200"
                    )}>
                        ⏱ {mm}:{ss}
                    </div>
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="px-2.5 py-1 rounded-full text-xs font-bold text-slate-400 bg-white/90 border border-slate-200 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                        >
                            ✕ やめる
                        </button>
                    )}
                </div>
            </div>

            <div className="h-12 rounded-2xl bg-white border-2 border-violet-200 overflow-hidden relative shadow-inner">
                <motion.div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-rose-500 via-orange-400 to-amber-300"
                    animate={{ width: `${hpPct}%` }}
                    transition={{ type: "spring", stiffness: 180, damping: 20 }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-violet-900 drop-shadow-sm">
                    BOSS HP {bossHp} / {bossMaxHp}
                </div>
            </div>

            <div className="mt-1 text-[11px] font-bold text-violet-500 text-center">
                チームダメージ: {totalDamage}
            </div>
        </div>
    );
};
