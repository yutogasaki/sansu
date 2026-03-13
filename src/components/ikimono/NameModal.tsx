import React, { useState } from "react";
import { motion } from "framer-motion";

interface NameModalProps {
    onSubmit: (name: string) => void;
}

export const NameModal: React.FC<NameModalProps> = ({ onSubmit }) => {
    const [name, setName] = useState("");
    const maxNameLength = 8;

    const handleSubmit = () => {
        const normalized = name.trim().slice(0, maxNameLength);
        onSubmit(normalized || "なまえなし");
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6"
        >
            <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
                className="w-full max-w-sm rounded-[2rem] border border-white/80 bg-white/95 p-8 text-center shadow-2xl"
            >
                <div className="mb-3 text-5xl">🫧</div>
                <div className="mb-2 text-2xl font-black text-slate-800">
                    ふわふわが きたよ
                </div>
                <div className="mb-6 text-sm text-slate-500">
                    なまえ を つけてあげよう
                </div>

                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="なまえ"
                    maxLength={maxNameLength}
                    autoFocus
                    className="w-full h-12 rounded-xl border-2 border-slate-200 px-4 text-center text-lg font-bold text-slate-800 bg-slate-50 focus:border-teal-400 focus:outline-none focus:bg-white transition-colors"
                />
                <div className="mt-2 text-right text-[11px] text-slate-400">
                    {name.length}/{maxNameLength}
                </div>

                <button
                    onClick={handleSubmit}
                    className="mt-5 w-full h-12 rounded-full bg-gradient-to-b from-teal-500 to-cyan-600 text-white font-black text-base shadow-lg active:scale-[0.98] transition-all"
                >
                    けってい
                </button>
            </motion.div>
        </motion.div>
    );
};
