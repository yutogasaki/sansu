import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";

interface TugOfWarRopeProps {
    position: number;   // -maxSteps to +maxSteps
    maxSteps: number;
    p1Emoji: string;
    p2Emoji: string;
}

export const TugOfWarRope: React.FC<TugOfWarRopeProps> = ({
    position,
    maxSteps,
    p1Emoji,
    p2Emoji,
}) => {
    // Map position to 0..100 percent (0 = P1 wins top, 100 = P2 wins bottom)
    const pct = ((position + maxSteps) / (2 * maxSteps)) * 100;
    const p1Intensity = Math.max(0, -position) / maxSteps;
    const p2Intensity = Math.max(0, position) / maxSteps;
    const totalMarkers = 2 * maxSteps + 1;

    return (
        <div className="flex flex-col items-center h-full w-16 relative select-none">
            {/* P1 emoji (top) - pulls upward */}
            <motion.div
                className="flex-none text-2xl z-10 mt-1"
                animate={{
                    scale: p1Intensity > 0.3 ? 1.15 : 1,
                    y: p1Intensity > 0 ? -2 * p1Intensity : 0,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
                {p1Emoji}
            </motion.div>

            {/* Rope area */}
            <div className="flex-1 relative w-full min-h-0 my-1">
                {/* Rope line */}
                <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1.5 rounded-full overflow-hidden">
                    {/* P1 side color (sky) */}
                    <div
                        className="absolute top-0 left-0 right-0 bg-gradient-to-b from-sky-400 to-sky-200 transition-opacity duration-300"
                        style={{ height: "50%", opacity: 0.4 + p1Intensity * 0.6 }}
                    />
                    {/* P2 side color (amber) */}
                    <div
                        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-400 to-amber-200 transition-opacity duration-300"
                        style={{ height: "50%", opacity: 0.4 + p2Intensity * 0.6 }}
                    />
                    {/* Base rope texture */}
                    <div className="absolute inset-0 bg-amber-800/20" />
                </div>

                {/* Step markers on rope */}
                {Array.from({ length: totalMarkers }, (_, i) => {
                    const markerPct = (i / (totalMarkers - 1)) * 100;
                    const isCenter = i === maxSteps;
                    return (
                        <div
                            key={i}
                            className={cn(
                                "absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                                isCenter
                                    ? "w-3 h-3 bg-slate-400 border-2 border-slate-300"
                                    : "w-1.5 h-1.5 bg-slate-300"
                            )}
                            style={{ top: `${markerPct}%` }}
                        />
                    );
                })}

                {/* Flag / Knot marker - the main indicator */}
                <motion.div
                    className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
                    animate={{ top: `${pct}%` }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                    {/* Flag ribbon */}
                    <div className="relative flex items-center justify-center">
                        {/* Left ribbon (P1 side - sky) */}
                        <motion.div
                            className="absolute right-full mr-0.5 h-0 border-y-[8px] border-y-transparent border-r-[12px] border-r-sky-400"
                            animate={{ opacity: 0.5 + p1Intensity * 0.5 }}
                        />
                        {/* Knot */}
                        <div className={cn(
                            "w-7 h-7 rounded-full border-3 shadow-lg flex items-center justify-center",
                            "bg-white border-slate-700"
                        )}>
                            <span className="text-[10px] font-black text-slate-600">🚩</span>
                        </div>
                        {/* Right ribbon (P2 side - amber) */}
                        <motion.div
                            className="absolute left-full ml-0.5 h-0 border-y-[8px] border-y-transparent border-l-[12px] border-l-amber-400"
                            animate={{ opacity: 0.5 + p2Intensity * 0.5 }}
                        />
                    </div>
                </motion.div>

                {/* Glow effects when close to winning */}
                {p1Intensity > 0.6 && (
                    <motion.div
                        className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-sky-400/30 to-transparent rounded-t-full pointer-events-none"
                        animate={{ opacity: [0.3, 0.7, 0.3] }}
                        transition={{ repeat: Infinity, duration: 1 }}
                    />
                )}
                {p2Intensity > 0.6 && (
                    <motion.div
                        className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-amber-400/30 to-transparent rounded-b-full pointer-events-none"
                        animate={{ opacity: [0.3, 0.7, 0.3] }}
                        transition={{ repeat: Infinity, duration: 1 }}
                    />
                )}
            </div>

            {/* P2 emoji (bottom) - pulls downward */}
            <motion.div
                className="flex-none text-2xl z-10 mb-1"
                animate={{
                    scale: p2Intensity > 0.3 ? 1.15 : 1,
                    y: p2Intensity > 0 ? 2 * p2Intensity : 0,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
                {p2Emoji}
            </motion.div>

            {/* Score dots - P1 side (top) */}
            <div className="absolute top-10 left-1/2 -translate-x-1/2 flex flex-col gap-1 items-center">
                {Array.from({ length: maxSteps }, (_, i) => (
                    <div
                        key={i}
                        className={cn(
                            "w-1.5 h-1.5 rounded-full transition-colors",
                            i < Math.max(0, -position) ? "bg-sky-500" : "bg-slate-200"
                        )}
                    />
                ))}
            </div>

            {/* Score dots - P2 side (bottom) */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col-reverse gap-1 items-center">
                {Array.from({ length: maxSteps }, (_, i) => (
                    <div
                        key={i}
                        className={cn(
                            "w-1.5 h-1.5 rounded-full transition-colors",
                            i < Math.max(0, position) ? "bg-amber-500" : "bg-slate-200"
                        )}
                    />
                ))}
            </div>
        </div>
    );
};
