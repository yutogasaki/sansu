import React, { useState } from "react";
import { Button } from "../components/ui/Button";
import { Header } from "../components/Header";
import { createInitialProfile } from "../domain/user/profile";
import { saveProfile, setActiveProfileId } from "../domain/user/repository";
import { getAvailableSkills } from "../domain/math/curriculum";
import { getNextReviewDate } from "../domain/algorithms/srs";
import { db } from "../db";
import { useNavigate } from "react-router-dom";

type Step = "welcome" | "name" | "grade" | "subject" | "math-check" | "english-check" | "done";
type SubjectMode = "mix" | "math" | "vocab";
type EnglishExp = "beginner" | "some" | "confident";
type MathCheck = "q_count" | "q_add" | "q_sub" | "q_col" | "q_mul";

export const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>("welcome");
    const [name, setName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [grade, setGrade] = useState<number | null>(null);
    const [subjectMode, setSubjectMode] = useState<SubjectMode>("mix");
    const [mathCheck, setMathCheck] = useState<MathCheck | null>(null);
    const [englishExp, setEnglishExp] = useState<EnglishExp | null>(null);

    const goBack = () => {
        if (step === "name") setStep("welcome");
        if (step === "grade") setStep("name");
        if (step === "subject") setStep("grade");
        if (step === "math-check") setStep("subject");
        if (step === "english-check") {
            if (subjectMode === "math") {
                setStep("subject");
            } else if (subjectMode === "vocab") {
                setStep("subject");
            } else {
                setStep("math-check");
            }
        }
    };

    const handleGradeSelect = async (selectedGrade: number) => {
        setGrade(selectedGrade);
        setStep("subject");
    };

    const handleFinish = async () => {
        // 推定レベルロジック
        // 少し手前から始めて、自信をつけさせる
        const safeGrade = grade ?? 0;
        const baseMap: Record<number, number> = {
            [-2]: 0,
            [-1]: 1,
            0: 4,
            1: 6,
            2: 7,
            3: 9,
            4: 10,
            5: 11,
            6: 12
        };
        const baseLevel = baseMap[safeGrade] ?? 4;
        const adjMap: Record<MathCheck, number> = {
            q_count: -5,
            q_add: -3,
            q_sub: -1,
            q_col: 1,
            q_mul: 4
        };
        const adjustment = mathCheck ? adjMap[mathCheck] : 0;
        const mathStartLevel = Math.max(1, Math.min(20, baseLevel + adjustment));

        let vocabStartLevel = 1;
        if (englishExp) {
            if (englishExp === "beginner") vocabStartLevel = 1;
            if (englishExp === "some") vocabStartLevel = 4;
            if (englishExp === "confident") vocabStartLevel = 7;
        }

        // Create Profile (mix mode default)
        const profile = createInitialProfile(name, safeGrade, mathStartLevel, vocabStartLevel, subjectMode);

        // Save
        await saveProfile(profile);
        await seedRetiredMathSkills(profile.id, mathStartLevel);
        await setActiveProfileId(profile.id);

        navigate("/", { replace: true });

        // HashRouter fallback
        setTimeout(() => {
            if (window.location.hash === "" || window.location.hash === "#/onboarding") {
                window.location.hash = "#/";
            }
        }, 100);
    };

    const seedRetiredMathSkills = async (profileId: string, mathStartLevel: number) => {
        const skills = getAvailableSkills(mathStartLevel);
        if (skills.length === 0) return;

        const now = new Date().toISOString();
        const nextReview = getNextReviewDate(5).toISOString();

        await Promise.all(
            skills.map((id) =>
                db.memoryMath.put({
                    profileId,
                    id,
                    strength: 5,
                    nextReview,
                    totalAnswers: 0,
                    correctAnswers: 0,
                    incorrectAnswers: 0,
                    skippedAnswers: 0,
                    updatedAt: now,
                    status: "retired"
                })
            )
        );
    };

    const handleSubjectSelect = (mode: SubjectMode) => {
        setSubjectMode(mode);
        if (mode === "vocab") {
            setStep("english-check");
        } else {
            setStep("math-check");
        }
    };

    const handleMathCheckSelect = async (value: MathCheck) => {
        setMathCheck(value);
        if (subjectMode === "math") {
            setStep("done");
            setIsSubmitting(true);
            await new Promise(resolve => setTimeout(resolve, 500));
            await handleFinish();
        } else {
            setStep("english-check");
        }
    };

    const handleEnglishExpSelect = async (value: EnglishExp) => {
        setEnglishExp(value);
        setStep("done");
        setIsSubmitting(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        await handleFinish();
    };

    // --- Render Steps ---

    if (step === "welcome") {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-8 animate-in fade-in duration-500">
                <div className="space-y-4">
                    <h1 className="text-5xl font-black text-cyan-700 tracking-tight drop-shadow-sm">Sansu</h1>
                    <p className="text-slate-500 text-lg font-medium">やさしく、しずかに<br />つづくまなび</p>
                </div>
                <Button onClick={() => setStep("name")} size="xl" className="w-full max-w-xs shadow-xl shadow-cyan-500/20">
                    はじめる
                </Button>

                {/* Cancel/Back Button (Using standard anchor or button) */}
                <button
                    onClick={() => navigate(-1)}
                    className="text-slate-400 text-sm font-bold hover:text-slate-600 transition-colors"
                >
                    もどる
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            <Header
                title={
                    step === "name"
                        ? "おなまえ"
                        : step === "grade"
                            ? "なんねんせい？"
                            : step === "subject"
                                ? "べんきょう する もの"
                                : step === "math-check"
                                    ? "さんすう どこまで？"
                                    : step === "english-check"
                                        ? "えいご どれくらい？"
                                        : "かんりょう"
                }
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
                            className="w-full text-4xl text-center p-6 rounded-3xl border-2 border-white/80 focus:border-cyan-500 outline-none bg-white/70 backdrop-blur-sm shadow-sm font-bold text-slate-700"
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
                                { l: "年少さん", v: -2, icon: "🌷" },
                                { l: "年中さん", v: -1, icon: "🌻" },
                                { l: "年長さん", v: 0, icon: "📛" },
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
                                    className="group relative w-full p-4 bg-white/70 backdrop-blur-sm rounded-2xl border border-white/85 shadow-sm hover:border-cyan-300 hover:bg-cyan-50/60 hover:shadow-md transition-all active:scale-95 flex items-center gap-4 text-left"
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

                {step === "subject" && (
                    <div className="w-full space-y-4 animate-in slide-in-from-right duration-300 pb-12">
                        {[
                            { label: "さんすう と えいご", value: "mix" as SubjectMode, icon: "🌈" },
                            { label: "さんすう だけ", value: "math" as SubjectMode, icon: "🧮" },
                            { label: "えいご だけ", value: "vocab" as SubjectMode, icon: "🔤" }
                        ].map(item => (
                            <button
                                key={item.value}
                                onClick={() => !isSubmitting && handleSubjectSelect(item.value)}
                                disabled={isSubmitting}
                                className="group relative w-full p-4 bg-white/70 backdrop-blur-sm rounded-2xl border border-white/85 shadow-sm hover:border-cyan-300 hover:bg-cyan-50/60 hover:shadow-md transition-all active:scale-95 flex items-center gap-4 text-left"
                            >
                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-2xl group-hover:bg-white">
                                    {item.icon}
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold text-lg text-slate-700 group-hover:text-slate-900">{item.label}</div>
                                    <div className="text-xs text-slate-400">あとで かえられるよ</div>
                                </div>
                                <div className="text-slate-300 group-hover:text-primary">
                                    →
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {step === "math-check" && (
                    <div className="w-full space-y-4 animate-in slide-in-from-right duration-300 pb-12">
                        {[
                            { label: "🔢 数をかぞえる・くらべる", value: "q_count" as MathCheck },
                            { label: "➕ 足し算まで", value: "q_add" as MathCheck },
                            { label: "➖ 引き算まで", value: "q_sub" as MathCheck },
                            { label: "✏️ 筆算（2けたのたし算・ひき算）", value: "q_col" as MathCheck },
                            { label: "✖️ かけ算（九九）", value: "q_mul" as MathCheck }
                        ].map(item => (
                            <button
                                key={item.value}
                                onClick={() => !isSubmitting && handleMathCheckSelect(item.value)}
                                disabled={isSubmitting}
                                className="group relative w-full p-4 bg-white/70 backdrop-blur-sm rounded-2xl border border-white/85 shadow-sm hover:border-cyan-300 hover:bg-cyan-50/60 hover:shadow-md transition-all active:scale-95 flex items-center gap-4 text-left"
                            >
                                <div className="flex-1">
                                    <div className="font-bold text-lg text-slate-700 group-hover:text-slate-900">{item.label}</div>
                                </div>
                                <div className="text-slate-300 group-hover:text-primary">
                                    →
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {step === "english-check" && (
                    <div className="w-full space-y-4 animate-in slide-in-from-right duration-300 pb-12">
                        {[
                            { label: "はじめて", value: "beginner" as EnglishExp, sub: "これからスタート" },
                            { label: "すこし", value: "some" as EnglishExp, sub: "ちょっとだけやった" },
                            { label: "よくやってる", value: "confident" as EnglishExp, sub: "あるていど できる" }
                        ].map(item => (
                            <button
                                key={item.value}
                                onClick={() => !isSubmitting && handleEnglishExpSelect(item.value)}
                                disabled={isSubmitting}
                                className="group relative w-full p-4 bg-white/70 backdrop-blur-sm rounded-2xl border border-white/85 shadow-sm hover:border-cyan-300 hover:bg-cyan-50/60 hover:shadow-md transition-all active:scale-95 flex items-center gap-4 text-left"
                            >
                                <div className="flex-1">
                                    <div className="font-bold text-lg text-slate-700 group-hover:text-slate-900">{item.label}</div>
                                    <div className="text-xs text-slate-400">{item.sub}</div>
                                </div>
                                <div className="text-slate-300 group-hover:text-primary">
                                    →
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {step === "done" && (
                    <div className="w-full flex flex-col items-center justify-center space-y-6 animate-in zoom-in duration-300">
                        <div className="text-6xl">🎉</div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-slate-700">じゅんび できたよ</div>
                            <div className="text-slate-400 text-sm mt-2">すこし まってね</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
