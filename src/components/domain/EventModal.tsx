import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EventType } from "../../domain/sessionManager";

interface EventModalProps {
    isOpen: boolean;
    eventType: EventType | null;
    onStartCheck: () => void;
    onDismiss: () => void;
}

const EVENT_CONFIG: Record<EventType, {
    title: string;
    message: string;
    emoji: string;
    color: string;
    actionLabel?: string; // カスタムボタンラベル
    dismissLabel?: string; // カスタムキャンセルラベル
}> = {
    streak_3: {
        title: "3にち れんぞく！",
        message: "すごい！まいにち がんばってるね。\nちからチェック してみよう！",
        emoji: "🔥",
        color: "from-orange-400 to-red-500"
    },
    streak_7: {
        title: "1しゅうかん れんぞく！",
        message: "すばらしい！1しゅうかん つづけたね。\nとくべつな ちからチェック だよ！",
        emoji: "🏆",
        color: "from-yellow-400 to-orange-500"
    },
    total_100: {
        title: "100もん たっせい！",
        message: "おめでとう！たくさん がんばったね。\nちからを ためしてみよう！",
        emoji: "🎉",
        color: "from-purple-400 to-pink-500"
    },
    level_up_near: {
        title: "レベルアップ まぢか！",
        message: "あと すこしで レベルアップ！\nちからチェック で しあげよう！",
        emoji: "⬆️",
        color: "from-green-400 to-emerald-500"
    },
    weak_decrease: {
        title: "にがてが へった！",
        message: "がんばりの せいかが でてるよ！\nいまの ちからを かくにんしよう！",
        emoji: "💪",
        color: "from-blue-400 to-cyan-500"
    },
    periodic_test: {
        title: "定期テスト の じかん！",
        message: "いまの ちからを しらべてみよう！\n20もん の テストだよ",
        emoji: "📝",
        color: "from-indigo-400 to-purple-500",
        actionLabel: "ちょうせん する！"
    },
    level_up: {
        title: "レベルアップ！",
        message: "おめでとう！\nつぎの レベルに すすんだよ！",
        emoji: "🎊",
        color: "from-yellow-400 to-amber-500",
        actionLabel: "やったね！",
        dismissLabel: undefined // 閉じるボタンのみ
    },
    paper_test_remind: {
        title: "テストの てんすう おしえて！",
        message: "かみの テストは できたかな？\nてんすうを いれてね",
        emoji: "📄",
        color: "from-slate-400 to-slate-600",
        actionLabel: "てんすうを いれる"
    }
};

export const EventModal: React.FC<EventModalProps> = ({
    isOpen,
    eventType,
    onStartCheck,
    onDismiss
}) => {
    if (!eventType) return null;

    const config = EVENT_CONFIG[eventType];

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
                        <div className={`bg-gradient-to-br ${config.color} p-8 text-center`}>
                            <motion.div
                                animate={{
                                    scale: [1, 1.2, 1],
                                    rotate: [0, 10, -10, 0]
                                }}
                                transition={{
                                    duration: 1.5,
                                    repeat: Infinity,
                                    repeatDelay: 1
                                }}
                                className="text-7xl mb-4"
                            >
                                {config.emoji}
                            </motion.div>
                            <h2 className="text-2xl font-extrabold text-white drop-shadow-md">
                                {config.title}
                            </h2>
                        </div>

                        {/* Content */}
                        <div className="p-6 text-center">
                            <p className="text-slate-600 font-medium text-lg leading-relaxed whitespace-pre-line mb-6">
                                {config.message}
                            </p>

                            {/* Buttons */}
                            <div className="flex flex-col gap-3">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={onStartCheck}
                                    className={`w-full py-4 rounded-2xl bg-gradient-to-r ${config.color} text-white font-bold text-lg shadow-lg`}
                                >
                                    {config.actionLabel || "ちからチェック スタート！"}
                                </motion.button>
                                {eventType !== "level_up" && (
                                    <button
                                        onClick={onDismiss}
                                        className="w-full py-3 rounded-2xl bg-slate-100 text-slate-500 font-medium hover:bg-slate-200 transition-colors"
                                    >
                                        {config.dismissLabel !== undefined ? config.dismissLabel : "あとで やる"}
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
