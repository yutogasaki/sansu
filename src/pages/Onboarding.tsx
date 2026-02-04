import React, { useState } from "react";
import { Button } from "../components/ui/Button";
import { Header } from "../components/Header";
import { createInitialProfile } from "../domain/user/profile";
import { saveProfile, setActiveProfileId } from "../domain/user/repository";
import { useNavigate } from "react-router-dom";

type Step = "welcome" | "name" | "grade";

export const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>("welcome");
    const [name, setName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const goBack = () => {
        if (step === "name") setStep("welcome");
        if (step === "grade") setStep("name");
    };

    const handleGradeSelect = async (selectedGrade: number) => {
        setIsSubmitting(true);

        // 少し遅延させて、選択した感触を残す
        await new Promise(resolve => setTimeout(resolve, 500));

        await handleFinish(selectedGrade);
    };

    const handleFinish = async (grade: number) => {
        // 推定レベルロジック
        // 少し手前から始めて、自信をつけさせる
        let mathLevel = 1;
        let vocabLevel = 1;

        switch (grade) {
            case 0: // 年長以下
                mathLevel = 1;  // 数と順番
                vocabLevel = 1; // 超基本
                break;
            case 1: // 小1
                mathLevel = 4;  // たし算（１桁）
                vocabLevel = 1; // 超基本
                break;
            case 2: // 小2
                mathLevel = 7;  // 2桁のたしひき
                vocabLevel = 2; // 基本の単語
                break;
            case 3: // 小3
                mathLevel = 9;  // 九九
                vocabLevel = 3; // 日常の単語
                break;
            case 4: // 小4
                mathLevel = 14; // 大きなかけわり
                vocabLevel = 4; // 少し長い単語
                break;
            case 5: // 小5
                mathLevel = 16; // 小数かけわり
                vocabLevel = 5; // 文章単語
                break;
            case 6: // 小6
                mathLevel = 18; // 分数
                vocabLevel = 6; // 仕事・生活
                break;
            default:
                mathLevel = 1;
                vocabLevel = 1;
        }

        // Create Profile (mix mode default)
        const profile = createInitialProfile(name, grade, mathLevel, vocabLevel, "mix");

        // Save
        await saveProfile(profile);
        setActiveProfileId(profile.id);

        navigate("/", { replace: true });

        // HashRouter fallback
        setTimeout(() => {
            if (window.location.hash !== "#/") {
                window.location.hash = "#/";
            }
        }, 100);
    };

    // --- Render Steps ---

    if (step === "welcome") {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-8 animate-in fade-in duration-500 bg-slate-50">
                <div className="space-y-4">
                    <h1 className="text-5xl font-black text-primary tracking-tight drop-shadow-sm">Sansu</h1>
                    <p className="text-slate-500 text-lg font-medium">やさしく、しずかに<br />つづくまなび</p>
                </div>
                <Button onClick={() => setStep("name")} size="xl" className="w-full max-w-xs shadow-xl shadow-primary/30">
                    はじめる
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <Header
                title={step === "name" ? "おなまえ" : "なんねんせい？"}
                showBack={!isSubmitting}
                onBack={goBack}
            />

            <div className="flex-1 p-6 flex flex-col items-center max-w-md mx-auto w-full land:max-w-4xl justify-center">

                {step === "name" && (
                    <div className="w-full space-y-8 animate-in slide-in-from-right duration-300">
                        <div className="text-center space-y-2">
                            <p className="text-slate-600 font-bold text-lg">ニックネームをおしえてね</p>
                            <p className="text-slate-400 text-sm">あとで かえられるよ</p>
                        </div>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full text-4xl text-center p-6 rounded-3xl border-4 border-slate-100 focus:border-primary outline-none bg-white shadow-sm font-bold text-slate-700"
                            placeholder="あだ名でOK"
                            autoFocus
                        />
                        <Button disabled={!name} onClick={() => setStep("grade")} size="xl" className="w-full shadow-lg">
                            次へ
                        </Button>
                    </div>
                )}

                {step === "grade" && (
                    <div className="w-full animate-in slide-in-from-right duration-300 pb-12">
                        <div className="grid grid-cols-1 gap-3 land:grid-cols-2">
                            {[
                                { l: "年長さん 以下", v: 0, icon: "📛" },
                                { l: "小学 1 年生", v: 1, icon: "🎒" },
                                { l: "小学 2 年生", v: 2, icon: "re" },
                                { l: "小学 3 年生", v: 3, icon: "🚲" },
                                { l: "小学 4 年生", v: 4, icon: "🎵" },
                                { l: "小学 5 年生", v: 5, icon: "⚽" },
                                { l: "小学 6 年生", v: 6, icon: "🏫" }
                            ].map(g => (
                                <button
                                    key={g.v}
                                    onClick={() => !isSubmitting && handleGradeSelect(g.v)}
                                    disabled={isSubmitting}
                                    className="group relative w-full p-4 bg-white rounded-2xl border-2 border-slate-100 shadow-sm hover:border-primary hover:bg-primary/5 hover:shadow-md transition-all active:scale-95 flex items-center gap-4 text-left"
                                >
                                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-2xl group-hover:bg-white">
                                        {g.icon === "re" ? <span className="text-xl font-bold text-slate-400 group-hover:text-primary">2</span> : g.icon}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-lg text-slate-700 group-hover:text-slate-900">{g.l}</div>
                                    </div>
                                    <div className="text-slate-300 group-hover:text-primary">
                                        →
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
