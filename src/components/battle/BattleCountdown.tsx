import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { playSound } from "../../utils/audio";

interface BattleCountdownProps {
    onComplete: () => void;
}

export const BattleCountdown: React.FC<BattleCountdownProps> = ({ onComplete }) => {
    const [count, setCount] = useState(3);

    useEffect(() => {
        if (count > 0) {
            const timer = setTimeout(() => setCount(count - 1), 800);
            return () => clearTimeout(timer);
        } else {
            playSound("start");
            const timer = setTimeout(onComplete, 600);
            return () => clearTimeout(timer);
        }
    }, [count, onComplete]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--app-overlay)] backdrop-blur-lg">
            <AnimatePresence mode="wait">
                <motion.div
                    key={count}
                    initial={{ scale: 0.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex h-40 w-40 items-center justify-center rounded-full border border-white/80 bg-white/18 text-7xl font-black text-white shadow-[0_28px_60px_-34px_rgba(15,23,42,0.48)]"
                >
                    {count > 0 ? count : "GO!"}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};
