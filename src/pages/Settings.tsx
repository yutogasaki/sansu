import React, { useState, useEffect } from "react";
import { Header } from "../components/Header";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { useNavigate } from "react-router-dom";
import { UserProfile } from "../domain/types";
import { getActiveProfile, deleteProfile, getAllProfiles, saveProfile, setActiveProfileId } from "../domain/user/repository";
import { setSoundEnabled } from "../utils/audio";
import { Problem } from "../domain/types";
import { ParentGateModal } from "../components/gate/ParentGateModal";
import { ensurePeriodicTestSet } from "../domain/test/testSet";
import { getWord } from "../domain/english/words";
import storage from "../utils/storage";



export const Settings: React.FC = () => {
    const navigate = useNavigate();
    const [sound, setSound] = useState(true);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [profiles, setProfiles] = useState<UserProfile[]>([]);

    // 保護者ガードの状態
    const [showParentGuard, setShowParentGuard] = useState(false);
    const [guardCallback, setGuardCallback] = useState<(() => void) | null>(null);
    const [isPrinting, setIsPrinting] = useState(false);

    // Modals State
    const [renameTarget, setRenameTarget] = useState<UserProfile | null>(null);
    const [newName, setNewName] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
    const isEasy = profile?.uiTextMode === "easy";
    const t = (easy: string, standard: string) => (isEasy ? easy : standard);

    useEffect(() => {
        const load = async () => {
            const p = await getActiveProfile();
            const list = await getAllProfiles();
            setProfiles(list);
            if (p) {
                setProfile(p);
                setSound(p.soundEnabled);
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

    const GRADES: Record<number, string> = {
        [-2]: "年少",
        [-1]: "年中",
        0: "年長",
        1: "小学1年生",
        2: "小学2年生",
        3: "小学3年生",
        4: "小学4年生",
        5: "小学5年生",
        6: "小学6年生",
    };

    const handleSwitchProfile = async (id: string) => {
        await setActiveProfileId(id);
        const p = await getActiveProfile();
        if (p) {
            setProfile(p);
            setSound(p.soundEnabled);
        }
        navigate("/");
    };

    const handleCreateProfile = () => {
        navigate("/onboarding");
    };

    const openRenameModal = (target: UserProfile) => {
        setRenameTarget(target);
        setNewName(target.name);
    };

    const handleRenameSubmit = async () => {
        if (!renameTarget || !newName.trim()) return;

        const updated = { ...renameTarget, name: newName.trim() };
        await saveProfile(updated);

        if (profile?.id === updated.id) {
            setProfile(updated);
        }
        setProfiles(prev => prev.map(p => (p.id === updated.id ? updated : p)));
        setRenameTarget(null);
    };

    const openDeleteModal = (target: UserProfile) => {
        setDeleteTarget(target);
    };

    const handleDeleteSubmit = async () => {
        if (!deleteTarget) return;

        await deleteProfile(deleteTarget.id);

        // Refresh logic
        const list = await getAllProfiles();
        setProfiles(list);
        if (profile?.id === deleteTarget.id) {
            // If deleted active profile, determine next action
            if (list.length > 0) {
                await setActiveProfileId(list[0].id);
                setProfile(list[0]);
                navigate("/");
            } else {
                storage.clearAll();
                navigate("/onboarding");
            }
        }
        setDeleteTarget(null);
    };

    const handleSubjectModeChange = async (mode: "mix" | "math" | "vocab") => {
        if (!profile) return;
        const updated = { ...profile, subjectMode: mode };
        await saveProfile(updated);
        setProfile(updated);
    };

    const handleTextModeChange = async (mode: "easy" | "standard") => {
        if (!profile) return;
        const updated = { ...profile, uiTextMode: mode };
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
            storage.clearAll();
            navigate("/onboarding");
        }
    };

    const handlePrintPDF = async () => {
        if (!profile) return;
        if (isPrinting) return;

        setIsPrinting(true);
        console.log("[PDF] Starting Math PDF generation...");

        const set = await ensurePeriodicTestSet(profile, "math");
        const problems: Problem[] = set.problems.map((p, i) => ({
            ...p,
            id: `pdf-math-${i}`,
            subject: "math",
            isReview: false
        }));
        console.log("[PDF] Using test set", set.level, problems.length);
        if (problems.length === 0) {
            alert("このレベルには まだ もんだいが ありません");
            setIsPrinting(false);
            return;
        }

        try {
            const { generateMathPDF } = await import("../utils/pdfGenerator");
            await generateMathPDF(problems, `さんすう レベル Lv.${set.level}`, profile.name);
            console.log("[PDF] Math PDF generation completed!");

            // 紙テストリマインド用に pendingPaperTests に追加
            const newPaperTest = {
                id: crypto.randomUUID(),
                subject: 'math' as const,
                level: set.level,
                createdAt: new Date().toISOString()
            };
            const updated = {
                ...profile,
                pendingPaperTests: [...(profile.pendingPaperTests || []), newPaperTest]
            };
            await saveProfile(updated);
            setProfile(updated);
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

        const set = await ensurePeriodicTestSet(profile, "vocab");
        const selected = set.problems
            .map(p => getWord(p.categoryId))
            .filter((w): w is NonNullable<typeof w> => !!w);
        console.log("[PDF] Using test set", set.level, "words:", selected.length);
        if (selected.length === 0) {
            alert("まだ 単語が ありません");
            setIsPrinting(false);
            return;
        }

        try {
            const { generateVocabPDF } = await import("../utils/pdfGenerator");
            await generateVocabPDF(selected, `えいご レベル Lv.${set.level}`);
            console.log("[PDF] Vocab PDF generation completed!");

            // 紙テストリマインド用に pendingPaperTests に追加
            const newPaperTest = {
                id: crypto.randomUUID(),
                subject: 'vocab' as const,
                level: set.level,
                createdAt: new Date().toISOString()
            };
            const updated = {
                ...profile,
                pendingPaperTests: [...(profile.pendingPaperTests || []), newPaperTest]
            };
            await saveProfile(updated);
            setProfile(updated);
        } catch (e) {
            console.error("[PDF] Error:", e);
            alert(`PDFの作成に失敗しました。\n\nエラー: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setIsPrinting(false);
        }
    };

    const getTestStatus = (subject: "math" | "vocab") => {
        const pendingOnline = profile?.periodicTestState?.[subject]?.isPending;
        const pendingPaper = (profile?.pendingPaperTests || []).some(t => t.subject === subject);
        if (pendingPaper) return { label: isEasy ? "さいてん まち" : "採点待ち", tone: "bg-amber-100 text-amber-700" };
        if (pendingOnline) return { label: isEasy ? "じゅんび OK" : "受験可能", tone: "bg-emerald-100 text-emerald-700" };
        return { label: isEasy ? "つうじょう" : "通常", tone: "bg-slate-100 text-slate-600" };
    };

    return (
        <div className="flex flex-col h-full bg-background">
            {/* 保護者ガードモーダル */}
            <ParentGateModal
                isOpen={showParentGuard}
                onClose={() => setShowParentGuard(false)}
                onSuccess={handleGuardSuccess}
            />

            {/* Rename Modal */}
            <Modal
                isOpen={!!renameTarget}
                onClose={() => setRenameTarget(null)}
                title="なまえを かえる"
                footer={(
                    <div className="flex gap-2">
                        <Button variant="secondary" className="flex-1" onClick={() => setRenameTarget(null)}>
                            やめる
                        </Button>
                        <Button className="flex-1 bg-primary text-white" onClick={handleRenameSubmit} disabled={!newName.trim()}>
                            OK
                        </Button>
                    </div>
                )}
            >
                <div className="space-y-4">
                    <p className="text-center text-slate-500 text-sm">新しい なまえを 入力してください</p>
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full border-2 border-slate-200 rounded-xl p-3 text-center text-xl font-bold focus:outline-none focus:border-primary text-slate-800"
                        autoFocus
                    />
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                title="データを けす"
                footer={(
                    <div className="flex gap-2">
                        <Button variant="secondary" className="flex-1" onClick={() => setDeleteTarget(null)}>
                            やめる
                        </Button>
                        <Button
                            className="flex-1 bg-red-500 hover:bg-red-600 shadow-red-200 text-white"
                            onClick={handleDeleteSubmit}
                        >
                            けす
                        </Button>
                    </div>
                )}
            >
                <div className="space-y-4 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-3xl">
                        🗑️
                    </div>
                    <div>
                        <div className="font-bold text-lg text-slate-800">
                            「{deleteTarget?.name}」さん
                        </div>
                        <p className="text-slate-500 mt-2">
                            本当に データを 消しますか？<br />
                            <span className="text-red-500 font-bold text-xs">※ 元には戻せません！</span>
                        </p>
                    </div>
                </div>
            </Modal>

            <Header title={t("せってい", "設定")} />

            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">

                {/* ===== Section: Profile ===== */}
                <Card className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-700">プロフィール</h3>
                        <Button size="sm" variant="secondary" onClick={handleCreateProfile}>
                            {t("ついか", "追加")}
                        </Button>
                    </div>
                    {profiles.map(p => (
                        <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50/50">
                            <div className="w-10 h-10 rounded-full bg-[#483D8B]/20 flex items-center justify-center text-[#483D8B] font-bold shrink-0">
                                {p.name?.[0] || "?"}
                            </div>
                            <div
                                className="flex-1 cursor-pointer hover:opacity-70 transition-opacity min-w-0"
                                onClick={() => openRenameModal(p)}
                            >
                                <div className="font-bold text-slate-700 truncate">{p.name || "ゲスト"}</div>
                                <div className="text-xs text-slate-500">{GRADES[p.grade] || "???"}</div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                                {profile?.id === p.id ? (
                                    <span className="text-xs text-[#483D8B] font-bold mr-2">{t("つかってる", "使用中")}</span>
                                ) : (
                                    <Button size="sm" variant="secondary" className="px-3" onClick={() => handleSwitchProfile(p.id)}>
                                        {t("きりかえ", "切替")}
                                    </Button>
                                )}

                                <Button size="sm" variant="ghost" className="w-10 h-10 p-0 text-slate-400 hover:text-[#483D8B]" onClick={() => openRenameModal(p)}>
                                    ✏️
                                </Button>

                                <Button size="sm" variant="ghost" className="w-10 h-10 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => openDeleteModal(p)}>
                                    🗑️
                                </Button>
                            </div>
                        </div>
                    ))}
                </Card>

                {/* ===== Section: Learning Settings ===== */}
                <div className="space-y-3">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                        {t("べんきょう の せってい", "学習の設定")}
                    </h2>

                    {/* Subject Mode */}
                    <Card className="p-4 space-y-3">
                        <h3 className="font-bold text-slate-700">{t("べんきょう する もの", "学習する科目")}</h3>
                        <div className="grid grid-cols-3 gap-2">
                            <Button size="sm" variant={profile?.subjectMode === "mix" ? "primary" : "secondary"} onClick={() => handleSubjectModeChange("mix")}>
                                {t("さんすう+えいご", "算数+英語")}
                            </Button>
                            <Button size="sm" variant={profile?.subjectMode === "math" ? "primary" : "secondary"} onClick={() => handleSubjectModeChange("math")}>
                                {t("さんすう", "算数")}
                            </Button>
                            <Button size="sm" variant={profile?.subjectMode === "vocab" ? "primary" : "secondary"} onClick={() => handleSubjectModeChange("vocab")}>
                                {t("えいご", "英語")}
                            </Button>
                        </div>
                    </Card>

                    {/* Hissan Mode */}
                    <Card className="p-4 space-y-3">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-slate-700">{t("ひっさん モード", "筆算モード")}</h3>
                                <p className="text-xs text-slate-400 mt-0.5">{t("おおきい すうじ の とき ひっさん で とける", "大きい数の計算で筆算UIを表示")}</p>
                            </div>
                            <Button
                                size="sm"
                                variant={profile?.hissanModeEnabled !== false ? "primary" : "secondary"}
                                onClick={async () => {
                                    if (!profile) return;
                                    const updated = { ...profile, hissanModeEnabled: !profile.hissanModeEnabled };
                                    await saveProfile(updated);
                                    setProfile(updated);
                                }}
                                className="w-20"
                            >
                                {profile?.hissanModeEnabled !== false ? "ON" : "OFF"}
                            </Button>
                        </div>
                    </Card>

                    {/* Level Settings */}
                    <Card className="p-4 space-y-3">
                        <h3 className="font-bold text-slate-700">{t("レベル", "レベル")}</h3>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                <div>
                                    <div className="font-bold text-slate-600">{t("さんすう", "算数")}</div>
                                    <div className="text-2xl font-black text-slate-800">Lv.{profile?.mathMainLevel || 1}</div>
                                </div>
                                <Button variant="secondary" onClick={() => navigate("/settings/curriculum")}>
                                    {t("かえる", "変更")}
                                </Button>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                <div>
                                    <div className="font-bold text-slate-600">{t("えいご", "英語")}</div>
                                    <div className="text-2xl font-black text-slate-800">Lv.{profile?.vocabMainLevel || 1}</div>
                                </div>
                                <Button variant="secondary" onClick={() => navigate("/settings/curriculum")}>
                                    {t("かえる", "変更")}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* ===== Section: Display & Sound ===== */}
                <div className="space-y-3">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                        {t("みため と おと", "表示とサウンド")}
                    </h2>

                    {/* Sound + TTS in one card */}
                    <Card className="p-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-700">{t("おと・BGM", "サウンド")}</span>
                            <Button size="sm" variant={sound ? "primary" : "secondary"} onClick={handleSoundToggle} className="w-20">
                                {sound ? "ON" : "OFF"}
                            </Button>
                        </div>
                        <div className="border-t border-slate-100" />
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-700">{t("えいご よみあげ", "英語読み上げ")}</span>
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
                        </div>
                    </Card>

                    {/* Text display settings in one card */}
                    <Card className="p-4 space-y-4">
                        <div className="space-y-3">
                            <h3 className="font-bold text-slate-700">{t("ひょうじ テキスト", "表示テキスト")}</h3>
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                <button
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${profile?.uiTextMode !== "easy" ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
                                    onClick={() => handleTextModeChange("standard")}
                                >
                                    {t("ふつう", "標準")}
                                </button>
                                <button
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${profile?.uiTextMode === "easy" ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
                                    onClick={() => handleTextModeChange("easy")}
                                >
                                    {t("やさしい", "やさしい")}
                                </button>
                            </div>
                        </div>
                        <div className="border-t border-slate-100" />
                        <div className="space-y-3">
                            <h3 className="font-bold text-slate-700">{t("にほんご モード", "日本語モード")}</h3>
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
                            <p className="text-xs text-slate-400 text-center">{t("えいごの こたえが かわります", "英語の答え表示が変わります")}</p>
                        </div>
                    </Card>
                </div>

                {/* ===== Section: For Parents ===== */}
                <div className="space-y-3">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                        {t("おとなの ひと むけ", "保護者向け")}
                    </h2>

                    {/* Periodic Test */}
                    <Card className="p-4 space-y-4">
                        <div>
                            <h3 className="font-bold text-slate-700">{t("ていき テスト", "定期テスト（20問）")}</h3>
                            <p className="text-xs text-slate-500 mt-1">{t("アプリ と かみ で テスト できるよ", "アプリ受験と紙テストをここから開始できます")}</p>
                        </div>
                        <div className="grid grid-cols-1 land:grid-cols-2 gap-3">
                            {([
                                { subject: "math" as const, title: t("さんすう", "算数"), level: profile?.mathMainLevel || 1, print: handlePrintPDF, startPath: "/study?session=periodic-test&focus_subject=math" },
                                { subject: "vocab" as const, title: t("えいご", "英語"), level: profile?.vocabMainLevel || 1, print: handlePrintVocabPDF, startPath: "/study?session=periodic-test&focus_subject=vocab" },
                            ]).map(item => {
                                const status = getTestStatus(item.subject);
                                return (
                                    <div key={item.subject} className="rounded-2xl border border-slate-200 bg-white p-3 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-bold text-slate-700">{item.title} Lv.{item.level}</div>
                                                <div className="text-xs text-slate-500">20問 / 目安 8〜12分</div>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${status.tone}`}>
                                                {status.label}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                size="sm"
                                                className="w-full h-10"
                                                onClick={() => withParentGuard(() => navigate(item.startPath))}
                                            >
                                                {t("アプリで うける", "アプリ受験")}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="w-full h-10 text-xs"
                                                onClick={item.print}
                                            >
                                                {t("かみで うける", "紙テストPDF")}
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>

                    {/* Parent Menu */}
                    <Card className="p-4 flex justify-between items-center">
                        <div>
                            <div className="font-bold text-slate-700">{t("ほごしゃ メニュー", "保護者メニュー")}</div>
                            <div className="text-xs text-slate-400">{t("おとなの ひとが みる ページ", "大人向けページ")}</div>
                        </div>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => withParentGuard(() => navigate('/parents', { state: { parentGatePassed: true } }))}
                        >
                            {t("ひらく", "開く")}
                        </Button>
                    </Card>

                    {/* Developer Mode */}
                    <Card className="p-4 flex justify-between items-center">
                        <span className="font-bold text-slate-700">開発者モード</span>
                        <Button size="sm" variant="secondary" onClick={() => navigate("/dev")}>
                            {t("ひらく", "開く")}
                        </Button>
                    </Card>

                    {/* Data Reset */}
                    <div className="pt-4">
                        <Button variant="ghost" className="w-full text-red-500 text-sm" onClick={handleReset}>
                            {t("データをすべてリセット", "全データをリセット")}
                        </Button>
                    </div>
                </div>

            </div>
        </div >
    );
};
