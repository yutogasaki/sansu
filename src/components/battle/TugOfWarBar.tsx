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
}

export const TugOfWarBar: React.FC<TugOfWarBarProps> = ({
    position,
    maxSteps,
    p1Emoji,
    p2Emoji,
    p1Name,
    p2Name,
}) => {
    // Map -maxSteps..+maxSteps to 0..100 percent
    const pct = ((position + maxSteps) / (2 * maxSteps)) * 100;

    // Intensity for glow effects
    const p1Intensity = Math.max(0, -position) / maxSteps;
    const p2Intensity = Math.max(0, position) / maxSteps;

    return (
        <div className="w-full px-4 py-2">
            {/* Names */}
            <div className="flex justify-between items-center mb-1 px-1">
                <span className={cn(
                    "text-sm font-bold transition-colors",
                    p1Intensity > 0.5 ? "text-sky-600" : "text-slate-600"
                )}>
                    {p1Emoji} {p1Name}
                </span>
                <span className={cn(
                    "text-sm font-bold transition-colors",
                    p2Intensity > 0.5 ? "text-amber-600" : "text-slate-600"
                )}>
                    {p2Name} {p2Emoji}
                </span>
            </div>

            {/* Track */}
            <div className="relative h-10 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-200 shadow-inner">
                {/* P1 side gradient (blue) */}
                <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-400 to-sky-200 transition-opacity duration-300"
                    style={{ width: "50%", opacity: 0.3 + p1Intensity * 0.7 }}
                />
                {/* P2 side gradient (amber) */}
                <div
                    className="absolute inset-y-0 right-0 bg-gradient-to-l from-amber-400 to-amber-200 transition-opacity duration-300"
                    style={{ width: "50%", opacity: 0.3 + p2Intensity * 0.7 }}
                />

                {/* Step markers */}
                {Array.from({ length: 2 * maxSteps - 1 }, (_, i) => {
                    const stepPct = ((i + 1) / (2 * maxSteps)) * 100;
                    const isCenter = i + 1 === maxSteps;
                    return (
                        <div
                            key={i}
                            className={cn(
                                "absolute top-1/2 -translate-y-1/2 rounded-full",
                                isCenter ? "w-1 h-5 bg-slate-400" : "w-0.5 h-3 bg-slate-300"
                            )}
                            style={{ left: `${stepPct}%` }}
                        />
                    );
                })}

                {/* Rope knot (marker) */}
                <motion.div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white border-3 border-slate-700 shadow-lg flex items-center justify-center text-sm font-black"
                    animate={{ left: `${pct}%` }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                    ●
                </motion.div>
            </div>

            {/* Score indicators */}
            <div className="flex justify-between items-center mt-1 px-1">
                <div className="flex gap-1">
                    {Array.from({ length: maxSteps }, (_, i) => (
                        <div
                            key={i}
                            className={cn(
                                "w-2.5 h-2.5 rounded-full transition-colors",
                                i < Math.max(0, -position) ? "bg-sky-500" : "bg-slate-200"
                            )}
                        />
                    ))}
                </div>
                <div className="flex gap-1">
                    {Array.from({ length: maxSteps }, (_, i) => (
                        <div
                            key={i}
                            className={cn(
                                "w-2.5 h-2.5 rounded-full transition-colors",
                                i < Math.max(0, position) ? "bg-amber-500" : "bg-slate-200"
                            )}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
