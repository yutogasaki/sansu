import React, { useState, useEffect } from "react";
import { Header } from "../components/Header";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useNavigate } from "react-router-dom";
import { UserProfile } from "../domain/types";
import { getActiveProfile, deleteProfile, getAllProfiles, saveProfile, setActiveProfileId } from "../domain/user/repository";
import { setSoundEnabled } from "../utils/audio";
import { generateMathPDF, generateVocabPDF } from "../utils/pdfGenerator";
import { getSkillsForLevel } from "../domain/math/curriculum";
import { generateMathProblem } from "../domain/math";
import { ENGLISH_WORDS } from "../domain/english/words";
import { Problem } from "../domain/types";
import { ParentGateModal } from "../components/gate/ParentGateModal";



export const Settings: React.FC = () => {
    const navigate = useNavigate();
    const [sound, setSound] = useState(true);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [_mathUnlockLevel, setMathUnlockLevel] = useState<number>(1);

    // 保護者ガードの状態
    const [showParentGuard, setShowParentGuard] = useState(false);
    const [guardCallback, setGuardCallback] = useState<(() => void) | null>(null);
    const [isPrinting, setIsPrinting] = useState(false);

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
        setGuardCallback(() => callback);
        setShowParentGuard(true);
    };

    const handleGuardSuccess = () => {
        setShowParentGuard(false);
        guardCallback?.();
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
        if (isPrinting) return;

        setIsPrinting(true);
        console.log("[PDF] Starting Math PDF generation...");

        const level = profile.mathMainLevel || 1;
        // Use getSkillsForLevel to strictly test the current level
        const skills = getSkillsForLevel(level);
        console.log("[PDF] Level:", level, "Skills:", skills);

        if (skills.length === 0) {
            alert("このレベルには まだ もんだいが ありません");
            setIsPrinting(false);
            return;
        }

        const problems: Problem[] = [];
        for (let i = 0; i < 20; i++) {
            const skillId = skills[Math.floor(Math.random() * skills.length)];
            const p = generateMathProblem(skillId);
            problems.push({ ...p, id: `pdf-${i}`, subject: 'math', categoryId: skillId, isReview: false });
        }
        console.log("[PDF] Generated", problems.length, "problems");

        try {
            await generateMathPDF(problems, `さんすう レベル Lv.${level}`, profile.name);
            console.log("[PDF] Math PDF generation completed!");
        } catch (e) {
            console.error("[PDF] Error:", e);
            alert(`PDFの作成に失敗しました。\n\nエラー: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setIsPrinting(false);
        }
    };

    const handlePrintVocabPDF = async () => {
        if (!profile) return;
        if (isPrinting) return;

        setIsPrinting(true);
        console.log("[PDF] Starting Vocab PDF generation...");

        const level = profile.vocabMainLevel || 1;
        let candidates = ENGLISH_WORDS.filter(w => w.level <= level);
        console.log("[PDF] Level:", level, "Candidates:", candidates.length);

        if (candidates.length === 0) {
            alert("まだ 単語が ありません");
            setIsPrinting(false);
            return;
        }

        const shuffled = [...candidates].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 20);
        console.log("[PDF] Selected", selected.length, "words");

        try {
            await generateVocabPDF(selected, `えいご レベル Lv.${level}`);
            console.log("[PDF] Vocab PDF generation completed!");
        } catch (e) {
            console.error("[PDF] Error:", e);
            alert(`PDFの作成に失敗しました。\n\nエラー: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setIsPrinting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background">
            {/* 保護者ガードモーダル */}
            {/* 保護者ガードモーダル */}
            <ParentGateModal
                isOpen={showParentGuard}
                onClose={() => setShowParentGuard(false)}
                onSuccess={handleGuardSuccess}
            />

            <Header title="せってい" />

            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 land:grid land:grid-cols-2 land:gap-6 land:space-y-0">

                {/* Profile */}
                <Card className="p-4 space-y-4 land:col-span-2">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-700">プロフィール</h3>
                        <Button size="sm" variant="secondary" onClick={handleCreateProfile}>
                            ついか
                        </Button>
                    </div>
                    {profiles.map(p => (
                        <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50/50">
                            <div className="w-10 h-10 rounded-full bg-[#483D8B]/20 flex items-center justify-center text-[#483D8B] font-bold shrink-0">
                                {p.name?.[0] || "?"}
                            </div>
                            <div
                                className="flex-1 cursor-pointer hover:opacity-70 transition-opacity min-w-0"
                                onClick={() => handleRename(p)}
                            >
                                <div className="font-bold text-slate-700 truncate">{p.name || "ゲスト"}</div>
                                <div className="text-xs text-slate-500">{GRADES[p.grade] || "???"}</div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                                {profile?.id === p.id ? (
                                    <span className="text-xs text-[#483D8B] font-bold mr-2">つかってる</span>
                                ) : (
                                    <Button size="sm" variant="secondary" className="px-3" onClick={() => handleSwitchProfile(p.id)}>
                                        きりかえ
                                    </Button>
                                )}

                                <Button size="sm" variant="ghost" className="w-10 h-10 p-0 text-slate-400 hover:text-[#483D8B]" onClick={() => handleRename(p)}>
                                    ✏️
                                </Button>

                                <Button size="sm" variant="ghost" className="w-10 h-10 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={async () => {
                                    if (confirm(`「${p.name}」さんの データを けしますか？\n(もとには もどせません)`)) {
                                        await deleteProfile(p.id);
                                        // Refresh logic
                                        const list = await getAllProfiles();
                                        setProfiles(list);
                                        if (profile?.id === p.id) {
                                            if (list.length > 0) {
                                                setActiveProfileId(list[0].id);
                                                setProfile(list[0]);
                                                navigate("/");
                                            } else {
                                                localStorage.clear();
                                                navigate("/onboarding");
                                            }
                                        }
                                    }
                                }}>
                                    🗑️
                                </Button>
                            </div>
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

                {/* English Auto-TTS */}
                <Card className="p-4 flex justify-between items-center">
                    <span className="font-bold text-slate-700">えいご よみあげ (自動)</span>
                    <Button
                        size="sm"
                        variant={profile?.englishAutoRead ? "primary" : "secondary"}
                        onClick={async () => {
                            if (!profile) return;
                            const updated = { ...profile, englishAutoRead: !profile.englishAutoRead };
                            await saveProfile(updated);
                            setProfile(updated);
                        }}
                        className="w-20"
                    >
                        {profile?.englishAutoRead ? "ON" : "OFF"}
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

                {/* Kanji Mode (Japanese Mode) */}
                <Card className="p-4 space-y-3">
                    <h3 className="font-bold text-slate-700">にほんご モード</h3>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${!profile?.kanjiMode ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
                            onClick={async () => {
                                if (!profile) return;
                                const updated = { ...profile, kanjiMode: false };
                                await saveProfile(updated);
                                setProfile(updated);
                            }}
                        >
                            ひらがな
                        </button>
                        <button
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${profile?.kanjiMode ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
                            onClick={async () => {
                                if (!profile) return;
                                const updated = { ...profile, kanjiMode: true };
                                await saveProfile(updated);
                                setProfile(updated);
                            }}
                        >
                            漢字
                        </button>
                    </div>
                    <p className="text-xs text-slate-400 text-center">えいごの こたえが かわります</p>
                </Card>

                {/* Math & Vocab Settings Link */}
                <Card className="p-4 space-y-4">
                    <h3 className="font-bold text-slate-700">がくしゅう の なかみ</h3>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                            <div>
                                <div className="font-bold text-slate-600">さんすう レベル</div>
                                <div className="text-2xl font-black text-slate-800">Lv.{profile?.mathMainLevel || 1}</div>
                            </div>
                            <Button variant="secondary" onClick={() => navigate("/settings/curriculum")}>
                                かえる
                            </Button>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                            <div>
                                <div className="font-bold text-slate-600">えいご レベル</div>
                                <div className="text-2xl font-black text-slate-800">Lv.{profile?.vocabMainLevel || 1}</div>
                            </div>
                            <Button variant="secondary" onClick={() => navigate("/settings/curriculum")}>
                                かえる
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* Periodic Test Settings (Direct Start & PDF) */}
                <Card className="p-4 space-y-4">
                    <h3 className="font-bold text-slate-700">定期テスト (20もん)</h3>
                    <div className="text-xs text-slate-400 -mt-2 mb-2">
                        今すぐ アプリで テストを します
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Math */}
                        <div className="space-y-2">
                            <div className="font-bold text-slate-600 text-center">さんすう</div>
                            <Button
                                size="lg"
                                variant="primary"
                                className="w-full bg-[#483D8B] hover:bg-[#483D8B]/90"
                                onClick={() => withParentGuard(() => {
                                    // Direct Start
                                    navigate(`/study?session=periodic-test&focus_subject=math`);
                                })}
                            >
                                スタート
                            </Button>
                            <Button
                                size="sm"
                                variant="secondary"
                                className="w-full text-xs"
                                onClick={handlePrintPDF}
                            >
                                PDF (印刷)
                            </Button>
                        </div>

                        {/* Vocab */}
                        <div className="space-y-2">
                            <div className="font-bold text-slate-600 text-center">えいご</div>
                            <Button
                                size="lg"
                                variant="primary"
                                className="w-full bg-[#483D8B] hover:bg-[#483D8B]/90"
                                onClick={() => withParentGuard(() => {
                                    // Direct Start
                                    navigate(`/study?session=periodic-test&focus_subject=vocab`);
                                })}
                            >
                                スタート
                            </Button>
                            <Button
                                size="sm"
                                variant="secondary"
                                className="w-full text-xs"
                                onClick={handlePrintVocabPDF}
                            >
                                PDF (印刷)
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* Parent Menu */}
                <Card className="p-4 flex justify-between items-center">
                    <div>
                        <div className="font-bold text-slate-700">ほごしゃ メニュー</div>
                        <div className="text-xs text-slate-400">おとなの ひとが みる ページ</div>
                    </div>
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => withParentGuard(() => navigate('/parents'))}
                    >
                        ひらく
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

            </div >
        </div >
    );
};
