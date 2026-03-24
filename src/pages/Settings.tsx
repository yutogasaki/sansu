import React, { useCallback, useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Badge } from "../components/ui/Badge";
import {
    InsetPanel,
    PanelDivider,
    SectionLabel,
    SegmentedControl,
    SettingRow,
    SurfacePanel,
    SurfacePanelHeader,
} from "../components/ui/SurfacePanel";
import { PaperTestScoreModal } from "../components/domain/PaperTestScoreModal";
import { useNavigate } from "react-router-dom";
import { UserProfile } from "../domain/types";
import { getActiveProfile, deleteProfile, getAllProfiles, saveProfile, setActiveProfileId } from "../domain/user/repository";
import { setSoundEnabled } from "../utils/audio";
import { Problem } from "../domain/types";
import { ParentGateModal } from "../components/gate/ParentGateModal";
import { ensurePeriodicTestSet } from "../domain/test/testSet";
import { getWord } from "../domain/english/words";
import { recordPaperTestScore, upsertPendingPaperTest } from "../domain/test/paperTest";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { logInDev } from "../utils/debug";
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
    const [showPaperTestModal, setShowPaperTestModal] = useState(false);
    const [pendingPaperTest, setPendingPaperTest] = useState<{ id: string; subject: "math" | "vocab"; level: number } | null>(null);
    const isEasy = profile?.uiTextMode === "easy";
    const t = (easy: string, standard: string) => (isEasy ? easy : standard);
    const TEST_TIMER_OPTIONS = [0, 5, 10, 15, 20] as const;

    const syncProfileState = useCallback((nextProfile: UserProfile | null) => {
        setProfile(nextProfile);

        if (!nextProfile) {
            setSound(true);
            setSoundEnabled(true);
            return;
        }

        setSound(nextProfile.soundEnabled);
        setSoundEnabled(nextProfile.soundEnabled);
        setProfiles(previous => previous.map(item => (
            item.id === nextProfile.id ? nextProfile : item
        )));
    }, []);

    const persistProfileUpdate = useCallback(async (nextProfile: UserProfile) => {
        await saveProfile(nextProfile);
        syncProfileState(nextProfile);
    }, [syncProfileState]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            const p = await getActiveProfile();
            const list = await getAllProfiles();
            if (cancelled) {
                return;
            }

            setProfiles(list);
            if (p) {
                syncProfileState(p);
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [syncProfileState]);

    const handleSoundToggle = async () => {
        if (!profile) return;

        const updatedProfile = { ...profile, soundEnabled: !sound };
        await persistProfileUpdate(updatedProfile);
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
            syncProfileState(p);
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
            syncProfileState(updated);
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
                syncProfileState(list[0]);
                navigate("/");
            } else {
                syncProfileState(null);
                storage.clearAll();
                navigate("/onboarding");
            }
        }
        setDeleteTarget(null);
    };

    const handleSubjectModeChange = async (mode: "mix" | "math" | "vocab") => {
        if (!profile) return;
        const updated = { ...profile, subjectMode: mode };
        await persistProfileUpdate(updated);
    };

    const handleTextModeChange = async (mode: "easy" | "standard") => {
        if (!profile) return;
        const updated = { ...profile, uiTextMode: mode };
        await persistProfileUpdate(updated);
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
            syncProfileState(null);
            storage.clearAll();
            navigate("/onboarding");
        }
    };

    const handlePrintError = (error: unknown) => {
        console.error("[PDF] Error:", error);
        alert(`PDFの作成に失敗しました。\n\nエラー: ${error instanceof Error ? error.message : String(error)}`);
    };

    const runPrintJob = async (job: () => Promise<void>) => {
        if (!profile || isPrinting) return;

        setIsPrinting(true);

        try {
            await job();
        } catch (error) {
            handlePrintError(error);
        } finally {
            setIsPrinting(false);
        }
    };

    const handlePrintPDF = async () => {
        if (!profile) return;
        const activeProfile = profile;

        await runPrintJob(async () => {
            logInDev("[PDF] Starting Math PDF generation...");

            const set = await ensurePeriodicTestSet(activeProfile, "math");
            const problems: Problem[] = set.problems.map((p, i) => ({
                ...p,
                id: `pdf-math-${i}`,
                subject: "math",
                isReview: false
            }));
            logInDev("[PDF] Using test set", set.level, problems.length);
            if (problems.length === 0) {
                alert("このレベルには まだ もんだいが ありません");
                return;
            }

            const { generateMathPDF } = await import("../utils/pdfGenerator");
            await generateMathPDF(problems, `さんすう レベル Lv.${set.level}`, activeProfile.name);
            logInDev("[PDF] Math PDF generation completed!");

            const updated = upsertPendingPaperTest(activeProfile, "math", set.level);
            await persistProfileUpdate(updated);
        });
    };

    const handlePrintVocabPDF = async () => {
        if (!profile) return;
        const activeProfile = profile;

        await runPrintJob(async () => {
            logInDev("[PDF] Starting Vocab PDF generation...");

            const set = await ensurePeriodicTestSet(activeProfile, "vocab");
            const selected = set.problems
                .map(p => getWord(p.categoryId))
                .filter((w): w is NonNullable<typeof w> => !!w);
            logInDev("[PDF] Using test set", set.level, "words:", selected.length);
            if (selected.length === 0) {
                alert("まだ 単語が ありません");
                return;
            }

            const { generateVocabPDF } = await import("../utils/pdfGenerator");
            await generateVocabPDF(selected, `えいご レベル Lv.${set.level}`);
            logInDev("[PDF] Vocab PDF generation completed!");

            const updated = upsertPendingPaperTest(activeProfile, "vocab", set.level);
            await persistProfileUpdate(updated);
        });
    };

    const getTestStatus = (subject: "math" | "vocab") => {
        const pendingOnline = profile?.periodicTestState?.[subject]?.isPending;
        const pendingPaper = (profile?.pendingPaperTests || []).some(t => t.subject === subject);
        if (pendingPaper) return { label: isEasy ? "さいてん まち" : "採点待ち", variant: "warning" as const };
        if (pendingOnline) return { label: isEasy ? "じゅんび OK" : "受験可能", variant: "success" as const };
        return { label: isEasy ? "つうじょう" : "通常", variant: "neutral" as const };
    };

    const getPendingPaperTest = (subject: "math" | "vocab") => {
        const pending = (profile?.pendingPaperTests || [])
            .filter(t => t.subject === subject)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return pending[0] || null;
    };

    const handleOpenPaperScoreModal = (subject: "math" | "vocab") => {
        const target = getPendingPaperTest(subject);
        if (!target) return;
        setPendingPaperTest({ id: target.id, subject: target.subject, level: target.level });
        setShowPaperTestModal(true);
    };

    const handlePaperTestSubmit = async (correctCount: number) => {
        if (!profile || !pendingPaperTest) return;
        const updatedProfile = recordPaperTestScore(profile, pendingPaperTest, correctCount);
        await persistProfileUpdate(updatedProfile);
        setShowPaperTestModal(false);
        setPendingPaperTest(null);
    };

    const handlePaperTestDismiss = () => {
        setShowPaperTestModal(false);
        setPendingPaperTest(null);
    };

    const handleTestTimerChange = async (minutes: number) => {
        if (!profile) return;
        const updated = {
            ...profile,
            periodicTestTimeLimitSeconds: minutes > 0 ? minutes * 60 : undefined,
        };
        await persistProfileUpdate(updated);
    };

    const formatPendingPaperMeta = (createdAt: string) => {
        const createdMs = new Date(createdAt).getTime();
        const elapsedDays = Math.max(0, Math.floor((Date.now() - createdMs) / (1000 * 60 * 60 * 24)));
        const createdText = new Date(createdAt).toLocaleDateString("ja-JP");
        return t(`${createdText} / ${elapsedDays}にち けいか`, `${createdText} / ${elapsedDays}日経過`);
    };

    return (
        <ScreenScaffold
            title={t("せってい", "設定")}
            contentClassName="px-6 pt-2"
        >
            {/* 保護者ガードモーダル */}
            <ParentGateModal
                isOpen={showParentGuard}
                onClose={() => setShowParentGuard(false)}
                onSuccess={handleGuardSuccess}
            />
            {pendingPaperTest && (
                <PaperTestScoreModal
                    isOpen={showPaperTestModal}
                    subject={pendingPaperTest.subject}
                    level={pendingPaperTest.level}
                    onSubmit={handlePaperTestSubmit}
                    onDismiss={handlePaperTestDismiss}
                />
            )}

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
                        className="w-full rounded-[18px] border border-white/85 bg-white/74 p-3 text-center text-xl font-bold text-slate-800 outline-none transition app-glass focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200/70"
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
                            className="flex-1 bg-[linear-gradient(135deg,#fb7185,#f43f5e)] text-white shadow-[0_18px_30px_-22px_rgba(244,63,94,0.55)]"
                            onClick={handleDeleteSubmit}
                        >
                            けす
                        </Button>
                    </div>
                )}
            >
                <div className="space-y-4 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-rose-100/90 bg-rose-50/80 text-3xl shadow-[0_20px_32px_-26px_rgba(244,63,94,0.5)]">
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

            <div className="mx-auto w-full max-w-[22rem] space-y-6 pb-2">
                <SurfacePanel className="space-y-4 rounded-[28px] p-5">
                    <SurfacePanelHeader
                        title="プロフィール"
                        description={t("つかう ひと と レベルを ここで みなおせる", "使うプロフィールと学年をここで見直せます")}
                        action={(
                            <Button size="sm" variant="secondary" onClick={handleCreateProfile}>
                                {t("ついか", "追加")}
                            </Button>
                        )}
                    />
                    {profiles.map(p => (
                        <InsetPanel key={p.id} className="space-y-4 px-4 py-4">
                            <div className="flex items-center gap-4">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-slate-50/82 font-black text-slate-600">
                                    {p.name?.[0] || "?"}
                                </div>
                                <div
                                    className="min-w-0 flex-1 cursor-pointer transition-opacity hover:opacity-75"
                                    onClick={() => openRenameModal(p)}
                                >
                                    <div className="truncate font-bold text-slate-700">{p.name || "ゲスト"}</div>
                                    <div className="text-xs text-slate-500">{GRADES[p.grade] || "???"}</div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-3 border-t border-white/70 pt-3">
                                {profile?.id === p.id ? (
                                    <Badge variant="primary">
                                        {t("つかってる", "使用中")}
                                    </Badge>
                                ) : (
                                    <Button size="sm" variant="secondary" className="px-3" onClick={() => handleSwitchProfile(p.id)}>
                                        {t("きりかえ", "切替")}
                                    </Button>
                                )}

                                <div className="flex items-center gap-1">
                                    <Button size="sm" variant="ghost" className="app-pill h-10 w-10 p-0 text-slate-500 hover:text-slate-700" onClick={() => openRenameModal(p)}>
                                        ✏️
                                    </Button>

                                    <Button size="sm" variant="ghost" className="h-10 w-10 rounded-full border border-rose-100/90 bg-rose-50/72 p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-600" onClick={() => openDeleteModal(p)}>
                                        🗑️
                                    </Button>
                                </div>
                            </div>
                        </InsetPanel>
                    ))}
                </SurfacePanel>

                <SectionLabel className="inline-flex w-fit rounded-full bg-slate-100/90 px-3 py-1.5 text-[12px] font-black tracking-[0.08em] text-slate-600">
                    {t("べんきょう の せってい", "学習の設定")}
                </SectionLabel>

                <SurfacePanel className="space-y-5 rounded-[28px] p-5">
                    <SurfacePanelHeader
                        title={t("べんきょう する もの", "学習する科目")}
                        description={t("つねに みる もんだい の くみあわせ", "日々の学習で出す科目の組み合わせ")}
                    />
                    <SegmentedControl
                        value={profile?.subjectMode ?? "mix"}
                        onChange={handleSubjectModeChange}
                        options={[
                            { value: "mix", label: t("さんすう+えいご", "算数+英語") },
                            { value: "math", label: t("さんすう", "算数") },
                            { value: "vocab", label: t("えいご", "英語") },
                        ]}
                    />
                    <PanelDivider />
                    <SettingRow
                        title={t("ひっさん モード", "筆算モード")}
                        description={t("おおきい すうじ の とき ひっさん で とける", "大きい数の計算で筆算UIを表示")}
                        action={(
                            <Button
                                size="sm"
                                variant={profile?.hissanModeEnabled !== false ? "primary" : "secondary"}
                                onClick={async () => {
                                    if (!profile) return;
                                    const updated = { ...profile, hissanModeEnabled: !profile.hissanModeEnabled };
                                    await persistProfileUpdate(updated);
                                }}
                                className="w-20"
                            >
                                {profile?.hissanModeEnabled !== false ? "ON" : "OFF"}
                            </Button>
                        )}
                    />
                </SurfacePanel>

                <SurfacePanel className="space-y-4 rounded-[28px] p-5">
                    <SurfacePanelHeader
                        title={t("レベル", "レベル")}
                        description={t("いまの すすみぐあい を かんたんに みる", "今の進み具合を一覧で確認")}
                    />
                    <div className="grid gap-3">
                        {[
                            { label: t("さんすう", "算数"), level: profile?.mathMainLevel || 1 },
                            { label: t("えいご", "英語"), level: profile?.vocabMainLevel || 1 },
                        ].map((item) => (
                            <InsetPanel key={item.label} className="flex flex-col gap-3 px-4 py-4 land:flex-row land:items-center land:justify-between">
                                <div>
                                    <div className="font-bold text-slate-600">{item.label}</div>
                                    <div className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-800">Lv.{item.level}</div>
                                </div>
                                <Button variant="secondary" className="w-full land:w-auto" onClick={() => navigate("/settings/curriculum")}>
                                    {t("かえる", "変更")}
                                </Button>
                            </InsetPanel>
                        ))}
                    </div>
                </SurfacePanel>

                <SectionLabel className="inline-flex w-fit rounded-full bg-slate-100/90 px-3 py-1.5 text-[12px] font-black tracking-[0.08em] text-slate-600">
                    {t("みため と おと", "表示とサウンド")}
                </SectionLabel>

                <SurfacePanel className="space-y-4 rounded-[28px] p-5">
                    <SettingRow
                        title={t("おと・BGM", "サウンド")}
                        description={t("おん と BGM の きりかえ", "効果音やBGMのオンオフ")}
                        action={(
                            <Button size="sm" variant={sound ? "primary" : "secondary"} onClick={handleSoundToggle} className="w-20">
                                {sound ? "ON" : "OFF"}
                            </Button>
                        )}
                    />
                    <PanelDivider />
                    <SettingRow
                        title={t("えいご よみあげ", "英語読み上げ")}
                        description={t("えいご の こえを じどうで ならす", "英語問題で読み上げを自動再生")}
                        action={(
                            <Button
                                size="sm"
                                variant={profile?.englishAutoRead ? "primary" : "secondary"}
                                onClick={async () => {
                                    if (!profile) return;
                                    const updated = { ...profile, englishAutoRead: !profile.englishAutoRead };
                                    await persistProfileUpdate(updated);
                                }}
                                className="w-20"
                            >
                                {profile?.englishAutoRead ? "ON" : "OFF"}
                            </Button>
                        )}
                    />
                    <PanelDivider />
                    <SurfacePanelHeader
                        title={t("ひょうじ テキスト", "表示テキスト")}
                        description={t("よみやすさ を ここで きりかえる", "表示密度と言葉のやさしさを調整")}
                    />
                    <SegmentedControl
                        value={profile?.uiTextMode ?? "standard"}
                        onChange={handleTextModeChange}
                        options={[
                            { value: "standard", label: t("ふつう", "標準") },
                            { value: "easy", label: t("やさしい", "やさしい") },
                        ]}
                    />
                    <PanelDivider />
                    <SurfacePanelHeader
                        title={t("にほんご モード", "日本語モード")}
                        description={t("かな と かんじ の ひょうじ を えらべる", "ふりがな寄りか漢字寄りかを選択")}
                    />
                    <SegmentedControl
                        value={profile?.kanjiMode ? "kanji" : "hiragana"}
                        onChange={async (value) => {
                            if (!profile) return;
                            const updated = { ...profile, kanjiMode: value === "kanji" };
                            await persistProfileUpdate(updated);
                        }}
                        options={[
                            { value: "hiragana", label: "ひらがな" },
                            { value: "kanji", label: "漢字" },
                        ]}
                    />
                    <p className="text-center text-xs leading-5 text-slate-400">
                        {t("えいごの こたえが かわります", "英語の答え表示が変わります")}
                    </p>
                </SurfacePanel>

                <SectionLabel className="inline-flex w-fit rounded-full bg-slate-100/90 px-3 py-1.5 text-[12px] font-black tracking-[0.08em] text-slate-600">
                    {t("おとなの ひと むけ", "保護者向け")}
                </SectionLabel>

                <SurfacePanel className="space-y-4 rounded-[28px] p-5">
                    <SurfacePanelHeader
                        title={t("ていき テスト", "定期テスト（20問）")}
                        description={t("アプリ と かみ で テスト できるよ", "アプリ受験と紙テストをここから開始できます")}
                    />
                    <InsetPanel className="space-y-3 px-4 py-4">
                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                            {t("せいげん じかん", "制限時間")}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {TEST_TIMER_OPTIONS.map(minutes => {
                                const selectedMinutes = profile?.periodicTestTimeLimitSeconds
                                    ? Math.floor(profile.periodicTestTimeLimitSeconds / 60)
                                    : 0;
                                const isSelected = selectedMinutes === minutes;
                                return (
                                    <button
                                        key={minutes}
                                        type="button"
                                        onClick={() => handleTestTimerChange(minutes)}
                                        className={`app-pill rounded-full px-3 py-1 text-xs font-black tracking-[0.08em] transition-colors ${
                                            isSelected
                                                ? "border-slate-200/90 bg-slate-100/88 text-slate-700"
                                                : "border-white/80 bg-white/68 text-slate-500"
                                        }`}
                                    >
                                        {minutes === 0 ? t("なし", "なし") : t(`${minutes}ふん`, `${minutes}分`)}
                                    </button>
                                );
                            })}
                        </div>
                    </InsetPanel>
                    <div className="grid grid-cols-1 gap-3 land:grid-cols-2">
                        {([
                            { subject: "math" as const, title: t("さんすう", "算数"), level: profile?.mathMainLevel || 1, print: handlePrintPDF, startPath: "/study?session=periodic-test&focus_subject=math" },
                            { subject: "vocab" as const, title: t("えいご", "英語"), level: profile?.vocabMainLevel || 1, print: handlePrintVocabPDF, startPath: "/study?session=periodic-test&focus_subject=vocab" },
                        ]).map(item => {
                            const status = getTestStatus(item.subject);
                            const pendingPaper = getPendingPaperTest(item.subject);
                            const hasPendingPaper = !!pendingPaper;
                            return (
                                <InsetPanel
                                    key={item.subject}
                                    className="space-y-3 px-4 py-4"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <div className="font-bold text-slate-700">{item.title} Lv.{item.level}</div>
                                            <div className="mt-1 text-xs text-slate-500">20問 / 目安 8〜12分</div>
                                            {pendingPaper ? (
                                                <div className="mt-2 text-[11px] text-slate-500">
                                                    {formatPendingPaperMeta(pendingPaper.createdAt)}
                                                </div>
                                            ) : null}
                                        </div>
                                        <Badge variant={status.variant}>{status.label}</Badge>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 land:grid-cols-2">
                                        <Button
                                            size="sm"
                                            className="h-10 w-full"
                                            onClick={() => withParentGuard(() => navigate(item.startPath))}
                                        >
                                            {t("アプリで うける", "アプリ受験")}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="h-10 w-full text-xs"
                                            onClick={() => {
                                                if (hasPendingPaper) {
                                                    handleOpenPaperScoreModal(item.subject);
                                                    return;
                                                }
                                                item.print();
                                            }}
                                        >
                                            {hasPendingPaper ? t("てんすう いれる", "点数入力") : t("かみで うける", "紙テストPDF")}
                                        </Button>
                                    </div>
                                </InsetPanel>
                            );
                        })}
                    </div>
                </SurfacePanel>

                <SurfacePanel className="space-y-4 rounded-[28px] p-5">
                    <SettingRow
                        title={t("ほごしゃ メニュー", "保護者メニュー")}
                        description={t("おとなの ひとが みる ページ", "大人向けページ")}
                        action={(
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => withParentGuard(() => navigate('/parents', { state: { parentGatePassed: true } }))}
                            >
                                {t("ひらく", "開く")}
                            </Button>
                        )}
                    />
                    <PanelDivider />
                    <SettingRow
                        title="開発者モード"
                        description="内部状態や検証用の画面を開く"
                        action={(
                            <Button size="sm" variant="secondary" onClick={() => navigate("/dev")}>
                                {t("ひらく", "開く")}
                            </Button>
                        )}
                    />
                </SurfacePanel>

                <SurfacePanel variant="flat" className="space-y-4 rounded-[28px] p-5">
                    <SurfacePanelHeader
                        title={t("リセット", "リセット")}
                        description={t("どうしても ひつような ときだけ つかう", "すべてのデータを削除します")}
                    />
                    <Button variant="ghost" className="w-full text-rose-600 text-sm hover:bg-rose-50/70" onClick={handleReset}>
                        {t("データをすべてリセット", "全データをリセット")}
                    </Button>
                </SurfacePanel>
            </div>

        </ScreenScaffold>
    );
};
