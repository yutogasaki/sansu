import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Icons } from "../components/icons";
import { getActiveProfile } from "../domain/user/repository";
import { getTodayStats, getTotalStats } from "../domain/stats/repository";
import { checkEventCondition, EventCheckParams } from "../domain/sessionManager";
import { getWeakPoints } from "../domain/stats/repository";

export const Home: React.FC = () => {
    const navigate = useNavigate();
    const [userName, setUserName] = useState("");
    const [todayCount, setTodayCount] = useState(0);
    const [streak, setStreak] = useState(0);

    // 今日の日付を取得
    const today = new Date();
    const dateStr = `${today.getMonth() + 1}月${today.getDate()}日`;

    useEffect(() => {
        getActiveProfile().then(profile => {
            if (profile) {
                setUserName(profile.name);
                setStreak(profile.streak || 0);

                // 今日の統計を取得
                getTodayStats(profile.id).then(stats => {
                    setTodayCount(stats.count);
                });

                // イベント条件チェック（仕様 4.3.1）
                Promise.all([
                    getTotalStats(profile.id),
                    getWeakPoints(profile.id)
                ]).then(([total, weakPoints]) => {
                    // 前回の苦手数を取得（localStorage）
                    const prevWeakCountStr = localStorage.getItem("sansu_prev_weak_count");
                    const prevWeakCount = prevWeakCountStr ? parseInt(prevWeakCountStr, 10) : undefined;
                    const currentWeakCount = weakPoints.length;

                    const params: EventCheckParams = {
                        profile,
                        totalCount: total.count,
                        prevWeakCount,
                        currentWeakCount
                    };

                    const eventType = checkEventCondition(params);
                    if (eventType) {
                        if (!localStorage.getItem("sansu_event_check_pending")) {
                            localStorage.setItem("sansu_event_check_pending", "1");
                        }
                    }

                    // 苦手数を保存（次回比較用）
                    localStorage.setItem("sansu_prev_weak_count", currentWeakCount.toString());
                });
            }
        });
    }, []);

    // 進捗のひとこと（仕様 06 §2.3）
    const getMessage = () => {
        // 未学習
        if (todayCount === 0) {
            const msgs = [
                "🌱 きょうの いっぽんめ、やってみよ",
                "🌱 1もんだけでも だいじょうぶ"
            ];
            return msgs[Math.floor(Math.random() * msgs.length)];
        }
        // 連続学習（3日以上）
        if (streak >= 3) {
            return `🔥 ${streak}にち つづいてるよ。すごいね`;
        }
        // 学習中
        if (todayCount > 0) {
            const msgs = [
                `✨ きょうは ${todayCount}もん がんばったね`,
                "✨ もう すこし すすめたよ"
            ];
            return msgs[Math.floor(Math.random() * msgs.length)];
        }
        return "🌱 さあ、きょうも はじめよう";
    };
    const message = getMessage();

    return (
        <div className="relative h-full overflow-hidden bg-slate-50">
            {/* Dynamic Background */}
            <div className="absolute inset-0 z-0 overflow-hidden">
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        rotate: [0, 90, 0],
                    }}
                    transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                    className="absolute -top-[20%] -right-[20%] w-[500px] h-[500px] bg-yellow-200/40 rounded-full blur-3xl"
                />
                <motion.div
                    animate={{
                        x: [0, 50, 0],
                        y: [0, 30, 0],
                    }}
                    transition={{
                        duration: 15,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="absolute top-[40%] -left-[10%] w-[300px] h-[300px] bg-blue-200/30 rounded-full blur-3xl"
                />
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col h-full px-6 pt-12 pb-8 land:px-10 land:pt-8 land:pb-6">

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="flex justify-between items-start"
                >
                    <div>
                        <p className="text-slate-500 font-medium mb-1">おかえりなさい</p>
                        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
                            {userName} さん
                        </h1>
                    </div>
                    {/* Date pill */}
                    <div className="bg-white/60 backdrop-blur-md border border-white/50 px-4 py-2 rounded-full shadow-sm text-slate-600 font-bold text-sm">
                        {dateStr}
                    </div>
                </motion.div>

                {/* Main Action - Center Stage */}
                <div className="flex-1 flex flex-col justify-center items-center relative space-y-12 land:flex-row land:items-center land:justify-center land:space-y-0 land:gap-12">

                    {/* Big pulsing start button */}
                    <div className="relative group">
                        {/* Outer Glow */}
                        <motion.div
                            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
                            transition={{ duration: 3, repeat: Infinity }}
                            className="absolute inset-0 bg-gradient-to-tr from-yellow-300 to-orange-300 rounded-full blur-xl opacity-60"
                        />

                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate("/study")}
                            className="relative w-64 h-64 rounded-full bg-gradient-to-br from-yellow-300 via-yellow-400 to-orange-400 border-[6px] border-white shadow-[0_10px_40px_-10px_rgba(251,191,36,0.5)] flex flex-col items-center justify-center text-white land:w-52 land:h-52"
                        >
                            <Icons.Play className="w-16 h-16 fill-white drop-shadow-md ml-2 mb-2" />
                            <span className="text-3xl font-bold tracking-widest drop-shadow-md">スタート</span>
                        </motion.button>
                    </div>

                    {/* Motivational Message */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white/70 backdrop-blur-lg border border-white/60 px-8 py-6 rounded-3xl shadow-lg shadow-slate-200/50 max-w-sm text-center land:max-w-md"
                    >
                        <p className="text-slate-700 font-bold text-lg leading-relaxed">
                            {message}
                        </p>
                    </motion.div>
                </div>

                {/* Footer Stats Preview */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="grid grid-cols-2 gap-4 land:gap-6"
                >
                    <div className="bg-white/60 backdrop-blur p-4 rounded-2xl border border-white/50 text-center">
                        <p className="text-xs text-slate-400 font-bold mb-1">きょうのもんだい</p>
                        <p className="text-xl font-black text-slate-700">{todayCount} もん</p>
                    </div>
                    <div className="bg-white/60 backdrop-blur p-4 rounded-2xl border border-white/50 text-center">
                        <p className="text-xs text-slate-400 font-bold mb-1">つづけたひ</p>
                        <p className="text-xl font-black text-slate-700">{streak}日</p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};
