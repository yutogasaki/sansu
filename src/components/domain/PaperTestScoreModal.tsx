import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PaperTestScoreModalProps {
    isOpen: boolean;
    subject: 'math' | 'vocab';
    level: number;
    onSubmit: (correctCount: number) => void;
    onDismiss: () => void;
}

const SCORE_OPTIONS = Array.from({ length: 21 }, (_, i) => i);

export const PaperTestScoreModal: React.FC<PaperTestScoreModalProps> = ({
    isOpen,
    subject,
    level,
    onSubmit,
    onDismiss
}) => {
    const [selectedScore, setSelectedScore] = useState<number | null>(null);

    const handleSubmit = () => {
        if (selectedScore !== null) {
            onSubmit(selectedScore);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                    onClick={onDismiss}
                >
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: 20 }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header with gradient */}
                        <div className="bg-gradient-to-br from-slate-400 to-slate-600 p-8 text-center">
                            <motion.div
                                animate={{
                                    scale: [1, 1.1, 1],
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    repeatDelay: 1
                                }}
                                className="text-7xl mb-4"
                            >
                                📄
                            </motion.div>
                            <h2 className="text-2xl font-extrabold text-white drop-shadow-md">
                                テストの てんすう おしえて！
                            </h2>
                        </div>

                        {/* Content */}
                        <div className="p-6 text-center">
                            <p className="text-slate-500 text-sm mb-2">
                                {subject === 'math' ? 'さんすう' : 'えいご'} レベル {level}
                            </p>
                            <p className="text-slate-600 font-medium text-lg leading-relaxed mb-6">
                                かみの テストで なんもん せいかい した？
                            </p>

                            {/* Score Selection */}
                            <div className="grid grid-cols-7 gap-2 mb-6">
                                {SCORE_OPTIONS.map((score) => (
                                    <button
                                        key={score}
                                        onClick={() => setSelectedScore(score)}
                                        className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${selectedScore === score
                                                ? 'bg-indigo-500 text-white scale-110 shadow-lg'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        {score}
                                    </button>
                                ))}
                            </div>

                            <p className="text-slate-400 text-sm mb-6">
                                / 20もん
                            </p>

                            {/* Buttons */}
                            <div className="flex flex-col gap-3">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleSubmit}
                                    disabled={selectedScore === null}
                                    className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all ${selectedScore !== null
                                            ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'
                                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                >
                                    とうろく する
                                </motion.button>
                                <button
                                    onClick={onDismiss}
                                    className="w-full py-3 rounded-2xl bg-slate-100 text-slate-500 font-medium hover:bg-slate-200 transition-colors"
                                >
                                    あとで やる
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
