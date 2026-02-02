import React, { useState, useEffect } from "react";
import { Header } from "../components/Header";

import { useNavigate } from "react-router-dom";
import { getActiveProfile, saveProfile } from "../domain/user/repository";
import { UserProfile } from "../domain/types";
import { ParentGuard } from "../components/domain/ParentGuard";
import { Icons } from "../components/icons";
import { cn } from "../utils/cn";

// レベル定義
const MATH_LEVELS: { level: number; title: string; desc: string }[] = [
    { level: 1, title: "数と順番", desc: "10までの数を数える" },
    { level: 2, title: "50までの数", desc: "大きな数を数える" },
    { level: 3, title: "数の大小", desc: "どっちが大きい？" },
    { level: 4, title: "たし算（１桁）", desc: "あわせていくつ" },
    { level: 5, title: "たし算（繰り上がり）", desc: "10より大きくなる" },
    { level: 6, title: "ひき算（１桁）", desc: "のこりはいくつ" },
    { level: 7, title: "２桁のたしひき", desc: "20+30, 45-5など" },
    { level: 8, title: "大きな計算", desc: "3桁・4桁の計算" },
    { level: 9, title: "かけ算（前半）", desc: "九九 1の段〜5の段" },
    { level: 10, title: "かけ算（後半）", desc: "九九 6の段〜9の段" },
    { level: 11, title: "かけ算（筆算）", desc: "2桁×1桁など" },
    { level: 12, title: "わり算（基本）", desc: "あまりのないわり算" },
    { level: 13, title: "わり算（あまり）", desc: "あまりのあるわり算" },
    { level: 14, title: "大きなかけわり", desc: "3桁×2桁など" },
    { level: 15, title: "小数（たしひき）", desc: "0.1 + 0.2 など" },
    { level: 16, title: "小数（かけわり）", desc: "小数×整数など" },
    { level: 17, title: "分数（たしひき1）", desc: "分母が同じ" },
    { level: 18, title: "分数（たしひき2）", desc: "通分・帯分数" },
    { level: 19, title: "分数（かけ算）", desc: "分数×整数・分数" },
    { level: 20, title: "分数（わり算）", desc: "分数÷整数・分数" },
];

const VOCAB_LEVELS: { level: number; title: string; desc: string }[] = [
    { level: 1, title: "Lv.1 超基本", desc: "おかし・どうぶつ・かず" },
    { level: 2, title: "Lv.2 からだ・かぞく", desc: "かお・いろ・ひと" },
    { level: 3, title: "Lv.3 みぢかなもの", desc: "がっこう・のりもの" },
    { level: 4, title: "Lv.4 しぜん・じかん", desc: "そら・うみ・あさ・よる" },
    { level: 5, title: "Lv.5 カレンダー", desc: "ようび・つき・きせつ" },
    { level: 6, title: "Lv.6 おしごと", desc: "いしゃ・たてもの・ごはん" },
    { level: 7, title: "Lv.7 まち・せいかつ", desc: "かいもの・りょこう" },
    { level: 8, title: "Lv.8 学校・きもち", desc: "かもく・行事・どうぐ" },
    { level: 9, title: "Lv.9 うごき・せいかく", desc: "どうさ・性格・ようす" },
    { level: 10, title: "Lv.10 くわしいようす", desc: "形容詞・副詞（発展）" },
    { level: 11, title: "Lv.11 社会・科学", desc: "しゃかい・かんきょう" },
    { level: 12, title: "Lv.12 考え・場面", desc: "がいねん・どう詞（思考）" },
    { level: 13, title: "Lv.13 政治・経済", desc: "せいじ・けいざい" },
    { level: 14, title: "Lv.14 文化・芸術", desc: "ぶんか・げいじゅつ" },
    { level: 15, title: "Lv.15 人体・医療", desc: "からだの仕組み・病気" },
    { level: 16, title: "Lv.16 自然・宇宙", desc: "しぜん現象・うちゅう" },
    { level: 17, title: "Lv.17 抽象概念 1", desc: "ちゅうしょう的なことば" },
    { level: 18, title: "Lv.18 抽象概念 2", desc: "より高度な概念" },
    { level: 19, title: "Lv.19 学術・専門 1", desc: "せんもん的な用語" },
    { level: 20, title: "Lv.20 学術・専門 2", desc: "さいごの難関単語" },
];

export const CurriculumSettings: React.FC = () => {
    const navigate = useNavigate();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [activeTab, setActiveTab] = useState<"math" | "vocab">("math");
    const [showGuard, setShowGuard] = useState(false);
    const [pendingLevel, setPendingLevel] = useState<number | null>(null);

    useEffect(() => {
        getActiveProfile().then(p => {
            if (p) setProfile(p);
        });
    }, []);

    const handleLevelSelect = (level: number) => {
        setPendingLevel(level);
        setShowGuard(true);
    };

    const handleConfirmLevel = async () => {
        if (!profile || pendingLevel === null) return;

        let updated: UserProfile;

        if (activeTab === "math") {
            updated = {
                ...profile,
                mathMaxUnlocked: pendingLevel,
                mathMainLevel: pendingLevel
            };
        } else {
            updated = {
                ...profile,
                vocabMaxUnlocked: pendingLevel,
                vocabMainLevel: pendingLevel
            };
        }

        await saveProfile(updated);
        setProfile(updated);
        setShowGuard(false);
        setPendingLevel(null);
    };

    const currentLevel = activeTab === "math"
        ? (profile?.mathMainLevel || 1)
        : (profile?.vocabMainLevel || 1);

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <ParentGuard
                isOpen={showGuard}
                onSuccess={handleConfirmLevel}
                onCancel={() => setShowGuard(false)}
            />

            <Header
                title="がくしゅう せってい"
                showBack={true}
                onBack={() => navigate("/settings")}
            />

            <div className="flex-1 overflow-hidden flex flex-col">
                {/* Tabs */}
                <div className="flex p-4 gap-4 bg-white shadow-sm z-10">
                    <button
                        onClick={() => setActiveTab("math")}
                        className={cn(
                            "flex-1 py-3 rounded-xl font-bold text-lg transition-all border-b-4",
                            activeTab === "math"
                                ? "bg-blue-50 text-blue-600 border-blue-200"
                                : "bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100"
                        )}
                    >
                        さんすう
                    </button>
                    <button
                        onClick={() => setActiveTab("vocab")}
                        className={cn(
                            "flex-1 py-3 rounded-xl font-bold text-lg transition-all border-b-4",
                            activeTab === "vocab"
                                ? "bg-green-50 text-green-600 border-green-200"
                                : "bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100"
                        )}
                    >
                        えいご
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
                    <p className="text-center text-slate-500 text-sm mb-4">
                        いまの レベル: <span className="font-bold text-xl ml-2">{currentLevel}</span>
                    </p>

                    {(activeTab === "math" ? MATH_LEVELS : VOCAB_LEVELS).map((item) => {
                        const isSelected = item.level === currentLevel;

                        return (
                            <button
                                key={item.level}
                                onClick={() => handleLevelSelect(item.level)}
                                className={cn(
                                    "w-full text-left p-4 rounded-xl border-2 transition-all relative overflow-hidden",
                                    isSelected
                                        ? "bg-white border-yellow-400 shadow-md ring-2 ring-yellow-200 ring-offset-2"
                                        : "bg-white border-slate-100 hover:border-slate-300 shadow-sm"
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center font-black text-lg",
                                        isSelected ? "bg-yellow-400 text-white" : "bg-slate-100 text-slate-400"
                                    )}>
                                        {item.level}
                                    </div>
                                    <div className="flex-1">
                                        <div className={cn(
                                            "font-bold text-lg",
                                            isSelected ? "text-slate-800" : "text-slate-600"
                                        )}>
                                            {item.title}
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            {item.desc}
                                        </div>
                                    </div>
                                    {isSelected && (
                                        <div className="text-yellow-500">
                                            <Icons.Check className="w-6 h-6" />
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    })}

                    <div className="text-center text-xs text-slate-300 pt-8">
                        ここを かえると もんだいの レベルが かわります
                    </div>
                </div>
            </div>
        </div>
    );
};
