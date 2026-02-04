import React, { useState, useEffect } from "react";
import { Header } from "../components/Header";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useNavigate } from "react-router-dom";
import { UserProfile } from "../domain/types";
import { getActiveProfile, deleteProfile, getAllProfiles, saveProfile, setActiveProfileId } from "../domain/user/repository";
import { setSoundEnabled } from "../utils/audio";
import { generateMathPDF, generateVocabPDF } from "../utils/pdfGenerator";
import { getAvailableSkills } from "../domain/math/curriculum";
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

    const handlePrintVocabPDF = async () => {
        if (!profile) return;
        const level = profile.vocabMainLevel || 1;



        // If not enough words, maybe take from previous levels too? Or just all up to level?
        // Spec says "Current Level". If level has few words (e.g. 10), fill with previous?
        // Let's stick to "Current Level" for now, or "Up to Current Level" if we want more volume.
        // Let's use "Up to Current Level" but prioritize Current Level? 
        // Wait, specification usually implies practicing current content.
        // Let's use "Current Level and below" to ensure we have 20 words.

        let candidates = ENGLISH_WORDS.filter(w => w.level <= level);

        // Prioritize current level (add them to list, then fill rest)
        // Actually random pick from all known words is good for review.

        if (candidates.length === 0) {
            alert("まだ 単語が ありません");
            return;
        }

        // Shuffle and pick 20
        const shuffled = [...candidates].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 20);

        await generateVocabPDF(selected, `${profile.name}_English_Lv${level}`);
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
                        <div key={p.id} className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                                {p.name?.[0] || "?"}
                            </div>
                            <div className="flex-1">
                                <div className="font-bold text-slate-700">{p.name || "ゲスト"}</div>
                                <div className="text-xs text-slate-500">{GRADES[p.grade] || "???"}</div>
                            </div>
                            {profile?.id === p.id ? (
                                <span className="text-xs text-primary font-bold">つかってる</span>
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
                    <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={handlePrintPDF}>
                            さんすう
                        </Button>
                        <Button size="sm" variant="secondary" onClick={handlePrintVocabPDF}>
                            えいご
                        </Button>
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
