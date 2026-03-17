import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";

interface TugOfWarBarProps {
    position: number;   // -maxSteps to +maxSteps
    maxSteps: number;
    p1Emoji: string;
    p2Emoji: string;
    p1Name: string;
    p2Name: string;
    onCancel?: () => void;
}

export const TugOfWarBar: React.FC<TugOfWarBarProps> = ({
    position,
    maxSteps,
    p1Emoji,
    p2Emoji,
    p1Name,
    p2Name,
    onCancel,
}) => {
    // Map -maxSteps..+maxSteps to 0..100 percent
    const pct = ((position + maxSteps) / (2 * maxSteps)) * 100;

    // Intensity for glow effects
    const p1Intensity = Math.max(0, -position) / maxSteps;
    const p2Intensity = Math.max(0, position) / maxSteps;

    return (
        <div className="w-full rounded-[28px] border border-white/75 px-4 py-3 app-glass-strong shadow-[0_22px_44px_-32px_rgba(15,23,42,0.34)]">
            {/* Names row with cancel button */}
            <div className="flex justify-between items-center mb-1.5 px-1">
                <div className="flex items-center gap-2">
                    <motion.span
                        className="text-2xl"
                        animate={{
                            scale: p1Intensity > 0.3 ? [1, 1.2, 1] : 1,
                        }}
                        transition={{ repeat: p1Intensity > 0.3 ? Infinity : 0, duration: 0.6 }}
                    >
                        {p1Emoji}
                    </motion.span>
                    <span className={cn(
                        "text-base font-black transition-colors",
                        p1Intensity > 0.3 ? "text-sky-600" : "text-slate-600"
                    )}>
                        {p1Name}
                    </span>
                </div>

                {onCancel && (
                    <button
                        onClick={onCancel}
                        className="app-pill px-2.5 py-1 text-xs font-black text-slate-500 transition-colors hover:bg-white/84 hover:text-slate-700"
                    >
                        ✕ やめる
                    </button>
                )}

                <div className="flex items-center gap-2">
                    <span className={cn(
                        "text-base font-black transition-colors",
                        p2Intensity > 0.3 ? "text-amber-600" : "text-slate-600"
                    )}>
                        {p2Name}
                    </span>
                    <motion.span
                        className="text-2xl"
                        animate={{
                            scale: p2Intensity > 0.3 ? [1, 1.2, 1] : 1,
                        }}
                        transition={{ repeat: p2Intensity > 0.3 ? Infinity : 0, duration: 0.6 }}
                    >
                        {p2Emoji}
                    </motion.span>
                </div>
            </div>

            {/* Track - bigger and more visible */}
            <div className="app-track relative h-12 overflow-hidden rounded-full">
                {/* P1 side gradient (blue) */}
                <motion.div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-500 to-sky-300"
                    animate={{ opacity: 0.3 + p1Intensity * 0.7 }}
                    style={{ width: "50%" }}
                />
                {/* P2 side gradient (amber) */}
                <motion.div
                    className="absolute inset-y-0 right-0 bg-gradient-to-l from-amber-500 to-amber-300"
                    animate={{ opacity: 0.3 + p2Intensity * 0.7 }}
                    style={{ width: "50%" }}
                />

                {/* Rope texture line */}
                <div className="absolute inset-y-0 left-[10%] right-[10%] flex items-center">
                    <div className="w-full h-1 bg-amber-800/20 rounded-full" />
                </div>

                {/* Step markers */}
                {Array.from({ length: 2 * maxSteps - 1 }, (_, i) => {
                    const stepPct = ((i + 1) / (2 * maxSteps)) * 100;
                    const isCenter = i + 1 === maxSteps;
                    return (
                        <div
                            key={i}
                            className={cn(
                                "absolute top-1/2 -translate-y-1/2 rounded-full",
                                isCenter ? "w-1.5 h-7 bg-slate-400/80" : "w-1 h-4 bg-slate-300/60"
                            )}
                            style={{ left: `${stepPct}%` }}
                        />
                    );
                })}

                {/* Rope knot (marker) - bigger */}
                <motion.div
                    className="absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/85 bg-white/84 shadow-[0_18px_32px_-24px_rgba(15,23,42,0.42)]"
                    animate={{ left: `${pct}%` }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                    <span className="text-lg">🚩</span>
                </motion.div>

                {/* Glow near win */}
                {p1Intensity > 0.6 && (
                    <motion.div
                        className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-sky-400/40 to-transparent pointer-events-none"
                        animate={{ opacity: [0.4, 0.8, 0.4] }}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                    />
                )}
                {p2Intensity > 0.6 && (
                    <motion.div
                        className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-amber-400/40 to-transparent pointer-events-none"
                        animate={{ opacity: [0.4, 0.8, 0.4] }}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                    />
                )}
            </div>

            {/* Score dots - bigger */}
            <div className="flex justify-between items-center mt-1.5 px-2">
                <div className="flex gap-1.5">
                    {Array.from({ length: maxSteps }, (_, i) => (
                        <motion.div
                            key={i}
                            className={cn(
                                "w-3.5 h-3.5 rounded-full transition-colors border",
                                i < Math.max(0, -position)
                                    ? "bg-sky-500 border-sky-600"
                                    : "bg-white/70 border-white/80"
                            )}
                            animate={i === Math.max(0, -position) - 1 ? { scale: [1, 1.3, 1] } : {}}
                            transition={{ duration: 0.3 }}
                        />
                    ))}
                </div>
                <div className="flex gap-1.5">
                    {Array.from({ length: maxSteps }, (_, i) => (
                        <motion.div
                            key={i}
                            className={cn(
                                "w-3.5 h-3.5 rounded-full transition-colors border",
                                i < Math.max(0, position)
                                    ? "bg-amber-500 border-amber-600"
                                    : "bg-white/70 border-white/80"
                            )}
                            animate={i === Math.max(0, position) - 1 ? { scale: [1, 1.3, 1] } : {}}
                            transition={{ duration: 0.3 }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
