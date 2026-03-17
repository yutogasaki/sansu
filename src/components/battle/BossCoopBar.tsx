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
        <div className="w-full rounded-[28px] border border-white/75 px-4 py-3 app-glass-strong shadow-[0_22px_44px_-32px_rgba(15,23,42,0.34)]">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">🐲</span>
                    <div>
                        <div className="text-sm font-black text-slate-800">ボス きょうりょくせん</div>
                        <div className="text-[11px] text-slate-500 font-bold">2にんでHPを0にしよう</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "app-pill px-2.5 py-1 text-xs font-black",
                        danger
                            ? "border-rose-100/90 bg-rose-50/90 text-rose-700"
                            : "border-cyan-100/90 bg-cyan-50/80 text-cyan-700"
                    )}>
                        ⏱ {mm}:{ss}
                    </div>
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="app-pill px-2.5 py-1 text-xs font-black text-slate-500 transition-colors hover:bg-white/84 hover:text-slate-700"
                        >
                            ✕ やめる
                        </button>
                    )}
                </div>
            </div>

            <div className="app-track relative h-12 overflow-hidden rounded-2xl">
                <motion.div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-rose-500 via-orange-400 to-amber-300"
                    animate={{ width: `${hpPct}%` }}
                    transition={{ type: "spring", stiffness: 180, damping: 20 }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-slate-800 drop-shadow-sm">
                    BOSS HP {bossHp} / {bossMaxHp}
                </div>
            </div>

            <div className="mt-1 text-center text-[11px] font-bold text-slate-500">
                チームダメージ: {totalDamage}
            </div>
        </div>
    );
};
