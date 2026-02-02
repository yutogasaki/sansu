import React, { useState, useEffect } from "react";
import { Header } from "../components/Header";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useNavigate } from "react-router-dom";
import { UserProfile } from "../domain/types";
import { getActiveProfile, deleteProfile, getAllProfiles, saveProfile, setActiveProfileId } from "../domain/user/repository";
import { setSoundEnabled } from "../utils/audio";
import { generateMathPDF } from "../utils/pdfGenerator";
import { getAvailableSkills } from "../domain/math/curriculum";
import { generateMathProblem } from "../domain/math";
import { Problem } from "../domain/types";

// 保護者ガード用：簡単な計算問題
const generateParentGuardQuestion = () => {
    const a = Math.floor(Math.random() * 5) + 3; // 3-7
    const b = Math.floor(Math.random() * 5) + 3; // 3-7
    return { question: `${a} + ${b} = ?`, answer: String(a + b) };
};

export const Settings: React.FC = () => {
    const navigate = useNavigate();
    const [sound, setSound] = useState(true);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [_mathUnlockLevel, setMathUnlockLevel] = useState<number>(1);

    // 保護者ガードの状態
    const [showParentGuard, setShowParentGuard] = useState(false);
    const [guardCallback, setGuardCallback] = useState<(() => void) | null>(null);
    const [guardQuestion, setGuardQuestion] = useState({ question: "", answer: "" });
    const [guardInput, setGuardInput] = useState("");

    useEffect(() => {
        const load = async () => {
            const p = await getActiveProfile();
            const list = await getAllProfiles();
            setProfiles(list);
            if (p) {
                setProfile(p);
                setSound(p.soundEnabled);
                setMathUnlockLevel(p.mathMaxUnlocked || 1);
            }
        };
        load();
    }, []);

    const handleSoundToggle = async () => {
        const newSound = !sound;
        setSound(newSound);
        setSoundEnabled(newSound);
        if (profile) {
            const updatedProfile = { ...profile, soundEnabled: newSound };
            await saveProfile(updatedProfile);
            setProfile(updatedProfile);
        }
    };

    const GRADES = ["年長以下", "小学1年生", "小学2年生", "小学3年生", "小学4年生", "小学5年生", "小学6年生"];

    const handleSwitchProfile = async (id: string) => {
        setActiveProfileId(id);
        const p = await getActiveProfile();
        if (p) {
            setProfile(p);
            setSound(p.soundEnabled);
            setMathUnlockLevel(p.mathMaxUnlocked || 1);
        }
        navigate("/");
    };

    const handleCreateProfile = () => {
        navigate("/onboarding");
    };

    const handleRename = async (target: UserProfile) => {
        const newName = prompt("あたらしい なまえ", target.name);
        if (!newName) return;
        const updated = { ...target, name: newName };
        await saveProfile(updated);
        if (profile?.id === updated.id) {
            setProfile(updated);
        }
        setProfiles(prev => prev.map(p => (p.id === updated.id ? updated : p)));
    };

    const handleSubjectModeChange = async (mode: "mix" | "math" | "vocab") => {
        if (!profile) return;
        const updated = { ...profile, subjectMode: mode };
        await saveProfile(updated);
        setProfile(updated);
    };

    // 保護者ガードを表示して、通過したらcallbackを実行
    const withParentGuard = (callback: () => void) => {
        const q = generateParentGuardQuestion();
        setGuardQuestion(q);
        setGuardInput("");
        setGuardCallback(() => callback);
        setShowParentGuard(true);
    };

    const handleGuardSubmit = () => {
        if (guardInput === guardQuestion.answer) {
            setShowParentGuard(false);
            guardCallback?.();
        } else {
            setGuardInput("");
            setGuardQuestion(generateParentGuardQuestion());
        }
    };



    const handleMathEasyChange = (value: number) => {
        if (!profile) return;
        withParentGuard(async () => {
            const main = Math.min(value + 1, 20);
            const updated = {
                ...profile,
                mathMaxUnlocked: main,
                mathMainLevel: main
            };
            await saveProfile(updated);
            setProfile(updated);
            setMathUnlockLevel(main);
        });
    };

    const handleVocabEasyChange = (value: number) => {
        if (!profile) return;
        withParentGuard(async () => {
            const updated = {
                ...profile,
                vocabMaxUnlocked: value,
                vocabMainLevel: value
            };
            await saveProfile(updated);
            setProfile(updated);
        });
    };

    const handleReset = async () => {
        if (confirm("ほんとうに 全部消しますか？")) {
            if (profile) await deleteProfile(profile.id);
            localStorage.clear();
            navigate("/onboarding");
        }
    };

    const handlePrintPDF = async () => {
        if (!profile) return;
        const level = profile.mathMainLevel || 1;
        const skills = getAvailableSkills(level);

        if (skills.length === 0) {
            alert("まだ もんだいが ありません");
            return;
        }

        const problems: Problem[] = [];
        for (let i = 0; i < 20; i++) {
            const skillId = skills[Math.floor(Math.random() * skills.length)];
            const p = generateMathProblem(skillId);
            // Assign dummy ID
            problems.push({ ...p, id: `pdf-${i}`, subject: 'math', categoryId: skillId, isReview: false });
        }

        await generateMathPDF(problems, `${profile.name}_Lv${level}_テスト`, profile.name);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* 保護者ガードモーダル */}
            {showParentGuard && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-xs space-y-4 shadow-xl">
                        <h3 className="text-lg font-bold text-center text-slate-700">ほごしゃ かくにん</h3>
                        <p className="text-center text-slate-500 text-sm">けいさん もんだい に こたえて ください</p>
                        <div className="text-center text-2xl font-bold text-slate-800">{guardQuestion.question}</div>
                        <input
                            type="number"
                            value={guardInput}
                            onChange={(e) => setGuardInput(e.target.value)}
                            className="w-full border-2 border-slate-200 rounded-xl p-3 text-center text-2xl font-bold"
                            autoFocus
                            onKeyDown={(e) => e.key === "Enter" && handleGuardSubmit()}
                        />
                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                className="flex-1"
                                onClick={() => setShowParentGuard(false)}
                            >
                                やめる
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={handleGuardSubmit}
                            >
                                OK
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <Header title="せってい" />

            <div className="flex-1 overflow-y-auto p-4 space-y-6 land:grid land:grid-cols-2 land:gap-6 land:space-y-0">

                {/* Profile */}
                <Card className="p-4 space-y-4 land:col-span-2">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-700">プロフィール</h3>
                        <Button size="sm" variant="secondary" onClick={handleCreateProfile}>
                            ついか
                        </Button>
                    </div>
                    {profiles.map(p => (
                        <div key={p.id} className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-yellow-200 flex items-center justify-center text-yellow-700 font-bold">
                                {p.name?.[0] || "?"}
                            </div>
                            <div className="flex-1">
                                <div className="font-bold text-slate-700">{p.name || "ゲスト"}</div>
                                <div className="text-xs text-slate-500">{GRADES[p.grade] || "???"}</div>
                            </div>
                            {profile?.id === p.id ? (
                                <span className="text-xs text-yellow-600 font-bold">つかってる</span>
                            ) : (
                                <Button size="sm" variant="secondary" onClick={() => handleSwitchProfile(p.id)}>
                                    きりかえ
                                </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => handleRename(p)}>
                                なまえ
                            </Button>
                        </div>
                    ))}
                </Card>

                {/* Sound */}
                <Card className="p-4 flex justify-between items-center">
                    <span className="font-bold text-slate-700">おと・BGM</span>
                    <Button
                        size="sm"
                        variant={sound ? "primary" : "secondary"}
                        onClick={handleSoundToggle}
                        className="w-20"
                    >
                        {sound ? "ON" : "OFF"}
                    </Button>
                </Card>

                {/* Subject Mode */}
                <Card className="p-4 space-y-3">
                    <h3 className="font-bold text-slate-700">べんきょう する もの</h3>
                    <div className="grid grid-cols-3 gap-2">
                        <Button
                            size="sm"
                            variant={profile?.subjectMode === "mix" ? "primary" : "secondary"}
                            onClick={() => handleSubjectModeChange("mix")}
                        >
                            さんすう+えいご
                        </Button>
                        <Button
                            size="sm"
                            variant={profile?.subjectMode === "math" ? "primary" : "secondary"}
                            onClick={() => handleSubjectModeChange("math")}
                        >
                            さんすう
                        </Button>
                        <Button
                            size="sm"
                            variant={profile?.subjectMode === "vocab" ? "primary" : "secondary"}
                            onClick={() => handleSubjectModeChange("vocab")}
                        >
                            えいご
                        </Button>
                    </div>
                </Card>

                {/* Math Unlock */}
                <Card className="p-4 space-y-3">
                    <h3 className="font-bold text-slate-700">さんすう どこまで？</h3>
                    <div className="grid grid-cols-1 gap-2">
                        <Button size="sm" variant="secondary" onClick={() => handleMathEasyChange(3)}>🔢 数をかぞえる</Button>
                        <Button size="sm" variant="secondary" onClick={() => handleMathEasyChange(5)}>➕ 足し算まで</Button>
                        <Button size="sm" variant="secondary" onClick={() => handleMathEasyChange(6)}>➖ 引き算まで</Button>
                        <Button size="sm" variant="secondary" onClick={() => handleMathEasyChange(7)}>✏️ 筆算 (2桁)</Button>
                        <Button size="sm" variant="secondary" onClick={() => handleMathEasyChange(10)}>✖️ 九九・かけ算</Button>
                    </div>
                    <div className="text-xs text-slate-400">こどもが さわらないように きいています</div>
                </Card>

                {/* Vocab Unlock */}
                <Card className="p-4 space-y-3">
                    <h3 className="font-bold text-slate-700">えいご どれくらい？</h3>
                    <div className="grid grid-cols-1 gap-2">
                        <Button size="sm" variant="secondary" onClick={() => handleVocabEasyChange(1)}>🌱 はじめて</Button>
                        <Button size="sm" variant="secondary" onClick={() => handleVocabEasyChange(5)}>🙂 すこし なら みたことある</Button>
                        <Button size="sm" variant="secondary" onClick={() => handleVocabEasyChange(10)}>✨ けいけん あり</Button>
                    </div>
                    <div className="text-xs text-slate-400">きょうの おすすめが かわるよ</div>
                </Card>

                {/* Event Check */}
                <Card className="p-4 flex justify-between items-center">
                    <div>
                        <div className="font-bold text-slate-700">とくべつ ちからチェック</div>
                        <div className="text-xs text-slate-400">きろくに あらわれます</div>
                    </div>
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => withParentGuard(() => {
                            localStorage.setItem("sansu_event_check_pending", "1");
                            alert("きろくに でます");
                        })}
                    >
                        だす
                    </Button>
                </Card>

                {/* PDF Print */}
                <Card className="p-4 flex justify-between items-center">
                    <div>
                        <div className="font-bold text-slate-700">かみの テスト</div>
                        <div className="text-xs text-slate-400">いまの レベルで 20もん</div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={handlePrintPDF}>
                        いんさつ
                    </Button>
                </Card>

                {/* Developer Mode */}
                <Card className="p-4 flex justify-between items-center">
                    <span className="font-bold text-slate-700">開発者モード</span>
                    <Button size="sm" variant="secondary" onClick={() => navigate("/dev")}>
                        ひらく
                    </Button>
                </Card>

                {/* Advanced / Data */}
                <div className="pt-8 land:col-span-2">
                    <Button variant="ghost" className="w-full text-red-500 text-sm" onClick={handleReset}>
                        データをすべてリセット
                    </Button>
                </div>

            </div>
        </div>
    );
};
