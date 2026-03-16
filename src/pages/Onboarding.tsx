import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import {
    SelectionCard,
    SurfacePanel,
    SurfacePanelHeader,
} from "../components/ui/SurfacePanel";
import { Header } from "../components/Header";
import { createInitialProfile } from "../domain/user/profile";
import { saveProfile, setActiveProfileId } from "../domain/user/repository";
import { getAvailableSkills } from "../domain/math/curriculum";
import { getNextReviewDate } from "../domain/algorithms/srs";
import { db } from "../db";
import { useNavigate } from "react-router-dom";
import { useTimeoutScheduler } from "../hooks/useTimeoutScheduler";
import { logInDev } from "../utils/debug";

type Step = "welcome" | "name" | "grade" | "subject" | "math-check" | "english-check" | "done";
type SubjectMode = "mix" | "math" | "vocab";
type EnglishExp = "beginner" | "some" | "confident";
type MathCheck = "q_count" | "q_add" | "q_sub" | "q_col" | "q_mul";
type OnboardingSelections = {
    mathCheck: MathCheck | null;
    englishExp: EnglishExp | null;
};

export const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>("welcome");
    const [name, setName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [grade, setGrade] = useState<number | null>(null);
    const [subjectMode, setSubjectMode] = useState<SubjectMode>("mix");
    const [mathCheck, setMathCheck] = useState<MathCheck | null>(null);
    const [englishExp, setEnglishExp] = useState<EnglishExp | null>(null);
    const isSubmittingRef = useRef(false);
    const isMountedRef = useRef(true);
    const trimmedName = name.trim();
    const { scheduleTimeout, clearScheduledTimeouts } = useTimeoutScheduler();

    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
            clearScheduledTimeouts();
        };
    }, [clearScheduledTimeouts]);

    const waitMs = useCallback((ms: number) => new Promise<void>(resolve => {
        scheduleTimeout(resolve, ms);
    }), [scheduleTimeout]);

    const goBack = useCallback(() => {
        switch (step) {
            case "name":
                setStep("welcome");
                break;
            case "grade":
                setStep("name");
                break;
            case "subject":
                setStep("grade");
                break;
            case "math-check":
                setStep("subject");
                break;
            case "english-check":
                setStep(subjectMode === "mix" ? "math-check" : "subject");
                break;
            default:
                break;
        }
    }, [step, subjectMode]);

    const handleGradeSelect = (selectedGrade: number) => {
        setGrade(selectedGrade);
        setStep("subject");
    };

    const handleFinish = useCallback(async ({ mathCheck: selectedMathCheck, englishExp: selectedEnglishExp }: OnboardingSelections) => {
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
        const adjustment = selectedMathCheck ? adjMap[selectedMathCheck] : 0;
        const mathStartLevel = Math.max(1, Math.min(20, baseLevel + adjustment));

        let vocabStartLevel = 1;
        if (selectedEnglishExp) {
            if (selectedEnglishExp === "beginner") vocabStartLevel = 1;
            if (selectedEnglishExp === "some") vocabStartLevel = 4;
            if (selectedEnglishExp === "confident") vocabStartLevel = 7;
        }

        // Create Profile (mix mode default)
        if (!trimmedName) {
            throw new Error("Profile name is required");
        }

        const profile = createInitialProfile(trimmedName, safeGrade, mathStartLevel, vocabStartLevel, subjectMode);

        // Save
        await saveProfile(profile);
        await seedRetiredMathSkills(profile.id, mathStartLevel);
        await setActiveProfileId(profile.id);

        navigate("/", { replace: true });

        // Let the hash fallback survive route unmount so HashRouter still recovers.
        window.setTimeout(() => {
            if (window.location.hash === "" || window.location.hash === "#/onboarding") {
                window.location.hash = "#/";
            }
        }, 100);
    }, [grade, navigate, subjectMode, trimmedName]);

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
        if (isSubmittingRef.current) return;
        setSubjectMode(mode);
        if (mode === "vocab") {
            setStep("english-check");
        } else {
            setStep("math-check");
        }
    };

    const completeOnboarding = useCallback(async (fallbackStep: Step, selections: OnboardingSelections) => {
        if (isSubmittingRef.current) return;

        isSubmittingRef.current = true;
        setStep("done");
        setIsSubmitting(true);

        try {
            await waitMs(500);
            if (!isMountedRef.current) {
                return;
            }
            await handleFinish(selections);
        } catch (error) {
            logInDev("[Onboarding] failed to complete onboarding:", error);
            if (!isMountedRef.current) {
                return;
            }
            isSubmittingRef.current = false;
            setIsSubmitting(false);
            setStep(fallbackStep);
        }
    }, [handleFinish, waitMs]);

    const handleMathCheckSelect = (value: MathCheck) => {
        if (isSubmittingRef.current) return;
        setMathCheck(value);
        if (subjectMode === "math") {
            void completeOnboarding("math-check", {
                mathCheck: value,
                englishExp,
            });
        } else {
            setStep("english-check");
        }
    };

    const handleEnglishExpSelect = (value: EnglishExp) => {
        if (isSubmittingRef.current) return;
        setEnglishExp(value);
        void completeOnboarding("english-check", {
            mathCheck,
            englishExp: value,
        });
    };

    const gradeOptions = [
        { label: "年少さん", value: -2, leading: "🌷" },
        { label: "年中さん", value: -1, leading: "🌻" },
        { label: "年長さん", value: 0, leading: "📛" },
        { label: "小学 1 年生", value: 1, leading: "🎒" },
        { label: "小学 2 年生", value: 2, leading: <span className="text-xl font-bold text-slate-400">2</span> },
        { label: "小学 3 年生", value: 3, leading: "🚲" },
        { label: "小学 4 年生", value: 4, leading: "🎵" },
        { label: "小学 5 年生", value: 5, leading: "⚽" },
        { label: "小学 6 年生", value: 6, leading: "🏫" },
    ];

    const stepTitle =
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
                            : "かんりょう";

    if (step === "welcome") {
        return (
            <div className="flex h-full min-h-0 flex-col items-center justify-center px-[var(--screen-padding-x)] animate-in fade-in duration-500">
                <SurfacePanel className="w-full max-w-md space-y-6 text-center">
                    <Badge variant="primary" className="mx-auto">
                        やさしく つづく
                    </Badge>
                    <div className="space-y-3">
                        <h1
                            className="text-5xl font-black tracking-[-0.04em] text-slate-800"
                            style={{ fontFamily: "var(--font-heading)" }}
                        >
                            Sansu
                        </h1>
                        <p className="text-sm font-medium leading-7 text-slate-400">
                            やさしく、しずかに
                            <br />
                            つづくまなび
                        </p>
                    </div>
                    <Button onClick={() => setStep("name")} size="xl" className="mx-auto w-full max-w-[220px]">
                        はじめる
                    </Button>
                    <button
                        onClick={() => navigate(-1)}
                        className="text-sm font-bold text-slate-400 transition-colors hover:text-slate-600"
                    >
                        もどる
                    </button>
                </SurfacePanel>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <Header
                title={stepTitle}
                showBack={!isSubmitting}
                onBack={goBack}
            />

            <div className="flex flex-1 items-center justify-center px-[var(--screen-padding-x)] pb-[var(--screen-bottom-padding)]">
                {step === "name" && (
                    <SurfacePanel className="w-full max-w-lg space-y-5 animate-in slide-in-from-right duration-300">
                        <SurfacePanelHeader
                            title="ニックネームをおしえてね"
                            description="あとで かえられるよ"
                        />
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-[22px] border border-white/85 bg-white/72 p-6 text-center text-4xl font-bold text-slate-700 outline-none backdrop-blur-sm transition focus:border-cyan-500"
                            placeholder="あだ名でOK"
                            autoFocus
                        />
                        <Button disabled={!trimmedName} onClick={() => setStep("grade")} size="xl" className="w-full shadow-lg">
                            次へ
                        </Button>
                    </SurfacePanel>
                )}

                {step === "grade" && (
                    <SurfacePanel className="w-full max-w-2xl space-y-4 animate-in slide-in-from-right duration-300">
                        <SurfacePanelHeader
                            title="いまの がくねんに ちかい ところ"
                            description="ぴったりじゃなくて だいじょうぶ"
                        />
                        <div className="grid grid-cols-1 gap-3 land:grid-cols-2">
                            {gradeOptions.map((option) => (
                                <SelectionCard
                                    key={option.value}
                                    label={option.label}
                                    leading={option.leading}
                                    trailing="→"
                                    disabled={isSubmitting}
                                    onClick={() => !isSubmitting && handleGradeSelect(option.value)}
                                />
                            ))}
                        </div>
                    </SurfacePanel>
                )}

                {step === "subject" && (
                    <SurfacePanel className="w-full max-w-lg space-y-4 animate-in slide-in-from-right duration-300">
                        <SurfacePanelHeader
                            title="どれを べんきょう する？"
                            description="あとで せってい から かえられるよ"
                        />
                        <div className="space-y-3">
                            {[
                                { label: "さんすう と えいご", value: "mix" as SubjectMode, leading: "🌈", description: "まいにち すこしずつ バランスよく" },
                                { label: "さんすう だけ", value: "math" as SubjectMode, leading: "🧮", description: "まずは すうじ に しぼって すすむ" },
                                { label: "えいご だけ", value: "vocab" as SubjectMode, leading: "🔤", description: "ことば と おと から はじめる" },
                            ].map((item) => (
                                <SelectionCard
                                    key={item.value}
                                    label={item.label}
                                    description={item.description}
                                    leading={item.leading}
                                    trailing="→"
                                    disabled={isSubmitting}
                                    onClick={() => !isSubmitting && handleSubjectSelect(item.value)}
                                />
                            ))}
                        </div>
                    </SurfacePanel>
                )}

                {step === "math-check" && (
                    <SurfacePanel className="w-full max-w-xl space-y-4 animate-in slide-in-from-right duration-300">
                        <SurfacePanelHeader
                            title="いちばん ちかい ところを えらんでね"
                            description="やりやすい ところ から はじめるための しつもん"
                        />
                        <div className="space-y-3">
                            {[
                                { label: "数をかぞえる・くらべる", value: "q_count" as MathCheck, leading: "🔢" },
                                { label: "足し算まで", value: "q_add" as MathCheck, leading: "➕" },
                                { label: "引き算まで", value: "q_sub" as MathCheck, leading: "➖" },
                                { label: "筆算（2けたのたし算・ひき算）", value: "q_col" as MathCheck, leading: "✏️" },
                                { label: "かけ算（九九）", value: "q_mul" as MathCheck, leading: "✖️" },
                            ].map((item) => (
                                <SelectionCard
                                    key={item.value}
                                    label={item.label}
                                    leading={item.leading}
                                    trailing="→"
                                    disabled={isSubmitting}
                                    onClick={() => !isSubmitting && handleMathCheckSelect(item.value)}
                                />
                            ))}
                        </div>
                    </SurfacePanel>
                )}

                {step === "english-check" && (
                    <SurfacePanel className="w-full max-w-lg space-y-4 animate-in slide-in-from-right duration-300">
                        <SurfacePanelHeader
                            title="えいごは どれくらい？"
                            description="いまの かんじ に ちかい ものを えらんでね"
                        />
                        <div className="space-y-3">
                            {[
                                { label: "はじめて", value: "beginner" as EnglishExp, description: "これから スタート", leading: "🌱" },
                                { label: "すこし", value: "some" as EnglishExp, description: "ちょっとだけ やった", leading: "📘" },
                                { label: "よくやってる", value: "confident" as EnglishExp, description: "あるていど できる", leading: "✨" },
                            ].map((item) => (
                                <SelectionCard
                                    key={item.value}
                                    label={item.label}
                                    description={item.description}
                                    leading={item.leading}
                                    trailing="→"
                                    disabled={isSubmitting}
                                    onClick={() => !isSubmitting && handleEnglishExpSelect(item.value)}
                                />
                            ))}
                        </div>
                    </SurfacePanel>
                )}

                {step === "done" && (
                    <SurfacePanel className="w-full max-w-md space-y-6 text-center animate-in zoom-in duration-300">
                        <div className="text-6xl">🎉</div>
                        <div>
                            <div className="text-2xl font-bold text-slate-700">じゅんび できたよ</div>
                            <div className="mt-2 text-sm text-slate-400">すこし まってね</div>
                        </div>
                    </SurfacePanel>
                )}
            </div>
        </div>
    );
};
