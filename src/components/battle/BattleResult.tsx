import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { playSound } from "../../utils/audio";
import { BattleGameState } from "../../domain/battle/types";

interface BattleResultProps {
    state: BattleGameState;
    onPlayAgain: () => void;
    onBackToHome: () => void;
}

export const BattleResult: React.FC<BattleResultProps> = ({
    state,
    onPlayAgain,
    onBackToHome,
}) => {
    const winner = state.winner === "p1" ? state.p1 : state.p2;
    const loser = state.winner === "p1" ? state.p2 : state.p1;
    const duration = state.finishedAt && state.startedAt
        ? Math.round((state.finishedAt - state.startedAt) / 1000)
        : 0;

    useEffect(() => {
        playSound("clear");
    }, []);

    return (
        <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-white p-6 gap-4">
            {/* Confetti-like decorations */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {Array.from({ length: 12 }, (_, i) => (
                    <motion.div
                        key={i}
                        className="absolute text-2xl"
                        initial={{
                            x: `${30 + Math.random() * 40}%`,
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
                        {["🎉", "⭐", "🎊", "✨"][i % 4]}
                    </motion.div>
                ))}
            </div>

            {/* Winner announcement */}
            <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="text-7xl"
            >
                {winner.config.emoji}
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center"
            >
                <div className="text-3xl font-black text-slate-800">
                    {winner.config.name} の かち！
                </div>
            </motion.div>

            {/* Stats */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex gap-6 text-center"
            >
                <div className="bg-white/80 rounded-2xl p-4 border border-slate-200 min-w-[140px]">
                    <div className="text-xs font-bold text-slate-400 mb-1">
                        {winner.config.emoji} {winner.config.name}
                    </div>
                    <div className="text-2xl font-black text-emerald-600">{winner.correctCount}</div>
                    <div className="text-xs text-slate-400">せいかい</div>
                </div>
                <div className="bg-white/80 rounded-2xl p-4 border border-slate-200 min-w-[140px]">
                    <div className="text-xs font-bold text-slate-400 mb-1">
                        {loser.config.emoji} {loser.config.name}
                    </div>
                    <div className="text-2xl font-black text-sky-600">{loser.correctCount}</div>
                    <div className="text-xs text-slate-400">せいかい</div>
                </div>
            </motion.div>

            {duration > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.9 }}
                    className="text-sm text-slate-500 font-bold"
                >
                    たいせん じかん: {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}
                </motion.div>
            )}

            {/* Action buttons */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 }}
                className="flex gap-3 mt-2"
            >
                <button
                    onClick={onPlayAgain}
                    className="px-8 py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-amber-500 text-white font-black text-lg shadow-lg hover:shadow-xl active:scale-[0.98] transition-all"
                >
                    もう いっかい！
                </button>
                <button
                    onClick={onBackToHome}
                    className="px-6 py-3 rounded-2xl bg-white border-2 border-slate-200 text-slate-600 font-bold text-lg hover:bg-slate-50 active:scale-[0.98] transition-all"
                >
                    おわる
                </button>
            </motion.div>
        </div>
    );
};
