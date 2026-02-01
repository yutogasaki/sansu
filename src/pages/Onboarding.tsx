import { useState } from "react";
import { Button } from "../components/ui/Button";
import { Header } from "../components/Header";
import { createInitialProfile } from "../domain/user/profile";
import { saveProfile, setActiveProfileId } from "../domain/user/repository";
import { useNavigate } from "react-router-dom";

type Step = "welcome" | "name" | "grade" | "mode" | "math_check" | "english_check" | "finish";

export const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>("welcome");

    const goBack = () => {
        if (step === "name") setStep("welcome");
        if (step === "grade") setStep("name");
        if (step === "mode") setStep("grade");
        if (step === "math_check") setStep("mode");
        if (step === "english_check") setStep("math_check");
    };

    // Form State
    const [name, setName] = useState("");
    const [grade, setGrade] = useState<number>(1); // 1=Grade1
    const [mode, setMode] = useState<"mix" | "math" | "vocab">("mix");
    const [mathCheck, setMathCheck] = useState<number>(0); // Adjustment value
    const [vocabStartLevel, setVocabStartLevel] = useState<number>(1);

    const handleFinish = async () => {
        // 1. Calculate Base Level from Grade
        // Spec 5.6: Base Level Table
        /*
          Year0(0): Base 4
          G1(1): Base 6
          G2(2): Base 7
          G3(3): Base 9
          G4(4): Base 10
          G5(5): Base 11
          G6(6): Base 12
        */
        const BASE_LEVELS: Record<number, number> = {
            0: 4, 1: 6, 2: 7, 3: 9, 4: 10, 5: 11, 6: 12
        };
        const base = BASE_LEVELS[grade] || 1;

        // 2. Adjust
        const startLevel = Math.max(1, Math.min(20, base + mathCheck));

        // 3. Create Profile
        const profile = createInitialProfile(name, grade, startLevel, vocabStartLevel, mode);

        // 4. Save to DB
        await saveProfile(profile);
        setActiveProfileId(profile.id);

        navigate("/", { replace: true });
        // HashRouter fallback for some environments
        setTimeout(() => {
            window.location.hash = "#/";
        }, 0);
    };

    // --- Render Steps ---

    if (step === "welcome") {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-8 animate-in fade-in duration-500">
                <div className="space-y-4">
                    <h1 className="text-4xl font-bold text-yellow-500 tracking-tight">Sansu</h1>
                    <p className="text-slate-500 text-lg">やさしく、しずかに<br />つづくまなび</p>
                </div>
                <Button onClick={() => setStep("name")} size="xl" className="w-full max-w-xs shadow-xl shadow-yellow-100">
                    はじめる
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <Header
                title={
                    step === "name" ? "おなまえ" :
                            step === "grade" ? "がくねん" :
                                step === "mode" ? "なにをする？" :
                                    step === "math_check" ? "どこまでやった？" :
                                        step === "english_check" ? "えいごは？" : ""
                }
                showBack={step !== "finish"}
                onBack={step === "name" || step === "grade" || step === "mode" || step === "math_check" || step === "english_check" ? goBack : undefined}
            />

            <div className="flex-1 p-6 flex flex-col items-center max-w-md mx-auto w-full land:max-w-2xl">

                {step === "name" && (
                    <div className="w-full space-y-6">
                        <p className="text-center text-slate-600">ニックネームをおしえてね</p>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full text-3xl text-center p-4 rounded-2xl border-2 border-slate-200 focus:border-yellow-400 outline-none bg-white"
                            placeholder="あだ名でOK"
                        />
                        <Button disabled={!name} onClick={() => setStep("grade")} size="lg" className="w-full">
                            次へ
                        </Button>
                    </div>
                )}

                {step === "grade" && (
                    <div className="w-full grid grid-cols-1 gap-3 land:grid-cols-2">
                        <p className="text-center text-slate-500 mb-4 land:col-span-2">目安につかうだけだよ</p>
                        {[
                            { l: "年長さん 以下", v: 0 },
                            { l: "小学1年生", v: 1 }, { l: "小学2年生", v: 2 }, { l: "小学3年生", v: 3 },
                            { l: "小学4年生", v: 4 }, { l: "小学5年生", v: 5 }, { l: "小学6年生", v: 6 }
                        ].map(g => (
                            <Button key={g.v} variant={grade === g.v ? "primary" : "secondary"} onClick={() => setGrade(g.v)} className="justify-between">
                                {g.l} {grade === g.v && <span className="text-yellow-600">●</span>}
                            </Button>
                        ))}
                        <div className="mt-6 land:col-span-2">
                            <Button onClick={() => setStep("mode")} size="lg" className="w-full">次へ</Button>
                        </div>
                    </div>
                )}

                {step === "mode" && (
                    <div className="w-full space-y-4">
                        <p className="text-center text-slate-600">なにをべんきょうする？</p>
                        <Button
                            variant={mode === "mix" ? "primary" : "secondary"}
                            onClick={() => setMode("mix")}
                            className="h-24 text-xl flex flex-col gap-1"
                        >
                            <span>🌈 さんすう と えいご</span>
                            <span className="text-xs opacity-70">おすすめ！</span>
                        </Button>
                        <div className="grid grid-cols-2 gap-4">
                            <Button variant={mode === "math" ? "primary" : "secondary"} onClick={() => setMode("math")} className="h-20">🧮 さんすう</Button>
                            <Button variant={mode === "vocab" ? "primary" : "secondary"} onClick={() => setMode("vocab")} className="h-20">🔤 えいご</Button>
                        </div>
                        <div className="mt-8">
                            <Button onClick={() => setStep(mode === "vocab" ? "english_check" : "math_check")} size="lg" className="w-full">
                                次へ
                            </Button>
                        </div>
                    </div>
                )}

                {step === "math_check" && (
                    <div className="w-full space-y-4">
                        <p className="text-center text-slate-600">学校や家で<br />どこまでやったことがある？</p>
                        <div className="grid grid-cols-1 gap-3 land:grid-cols-2">
                            {[
                            { l: "🔢 数をかぞえる", v: -5 }, // count_100 (Lv.3) -> Base-5? Wait, Base for G1 is 6. 6-5=1. OK.
                            { l: "➕ 足し算まで", v: -3 },
                            { l: "➖ 引き算まで", v: -1 },
                            { l: "✏️ 筆算 (2桁)", v: 1 },
                            { l: "✖️ 九九・かけ算", v: 4 },
                            ].filter(opt => {
                            if (grade <= 1) {
                                return opt.v <= 1;
                            }
                            if (grade <= 3) {
                                return opt.v <= 4;
                            }
                            return true;
                            }).map(opt => (
                            <Button key={opt.v} variant={mathCheck === opt.v ? "primary" : "secondary"} onClick={() => setMathCheck(opt.v)}>
                                {opt.l}
                            </Button>
                            ))}
                        </div>
                        <div className="mt-8">
                            <Button onClick={() => setStep(mode === "mix" ? "english_check" : "finish")} size="lg" className="w-full">
                                これでOK
                            </Button>
                        </div>
                    </div>
                )}

                {step === "english_check" && (
                    <div className="w-full space-y-4">
                        <p className="text-center text-slate-600">えいごは どれくらい？</p>
                        <div className="grid grid-cols-1 gap-3 land:grid-cols-2">
                            {[
                            { l: "🌱 はじめて", v: 1 },
                            { l: "🙂 すこし なら みたことある", v: 5 },
                            { l: "✨ けいけん あり", v: 10 }
                            ].map(opt => (
                            <Button key={opt.v} variant={vocabStartLevel === opt.v ? "primary" : "secondary"} onClick={() => setVocabStartLevel(opt.v)}>
                                {opt.l}
                            </Button>
                            ))}
                        </div>
                        <div className="mt-8">
                            <Button onClick={() => setStep("finish")} size="lg" className="w-full">
                                これでOK
                            </Button>
                        </div>
                    </div>
                )}

                {step === "finish" && (
                    <div className="flex flex-col items-center justify-center h-full space-y-8 animate-in zoom-in duration-300">
                        <div className="text-6xl">🎉</div>
                        <h2 className="text-2xl font-bold text-slate-700">準備かんりょう！</h2>
                        <p className="text-slate-500">毎日すこしずつ、やってみよう</p>
                        <Button onClick={handleFinish} size="xl" className="w-full shadow-lg shadow-yellow-200">
                            スタート！
                        </Button>
                    </div>
                )}

            </div>
        </div>
    );
};
