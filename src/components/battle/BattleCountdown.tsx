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
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50">
            <AnimatePresence mode="wait">
                <motion.div
                    key={count}
                    initial={{ scale: 0.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-8xl font-black text-white drop-shadow-2xl"
                >
                    {count > 0 ? count : "GO!"}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};
