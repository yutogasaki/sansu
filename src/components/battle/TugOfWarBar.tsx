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
        <div className="w-full px-4 py-2 bg-gradient-to-b from-slate-100 to-slate-50 border-b border-slate-200">
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
                        className="px-2.5 py-1 rounded-full text-xs font-bold text-slate-400 bg-white/80 border border-slate-200 hover:bg-slate-100 hover:text-slate-600 transition-colors"
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
            <div className="relative h-12 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-300 shadow-inner">
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
                                isCenter ? "w-1.5 h-7 bg-slate-400" : "w-1 h-4 bg-slate-300/70"
                            )}
                            style={{ left: `${stepPct}%` }}
                        />
                    );
                })}

                {/* Rope knot (marker) - bigger */}
                <motion.div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white border-[3px] border-slate-700 shadow-xl flex items-center justify-center"
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
                                    : "bg-slate-200 border-slate-300"
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
                                    : "bg-slate-200 border-slate-300"
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
