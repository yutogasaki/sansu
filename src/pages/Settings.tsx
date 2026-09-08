import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Badge } from "../components/ui/Badge";
import {
    InsetPanel,
    PanelDivider,
    SegmentedControl,
    SettingRow,
    SurfacePanel,
    SurfacePanelHeader,
} from "../components/ui/SurfacePanel";
import { Icons } from "../components/icons";
import { PaperTestScoreModal } from "../components/domain/PaperTestScoreModal";
import { useNavigate } from "react-router-dom";
import { UserProfile } from "../domain/types";
import { getActiveProfile, deleteProfile, getAllProfiles, updateProfileAtomically, setActiveProfileId } from "../domain/user/repository";
import { setSoundEnabled } from "../utils/audio";
import { ParentGateModal } from "../components/gate/ParentGateModal";
import { preparePaperTest, savePaperTestScore, cancelPaperTest, type PendingPaperTest } from "../domain/test/paperTestRepository";
import { PrintableTestPreview } from "../components/domain/PrintableTestPreview";
import { holdPwaUpdateForCriticalPersistence } from "../pwa";
import { activateVocabNextLevel, needsVocabNextLevelActivation } from "../hooks/useStudySession.logic";
import { ScreenScaffold } from "../components/ScreenScaffold";
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
    const paperBusyRef = useRef(false);
    const profileIdRef = useRef<string | null>(null);
    const [paperError, setPaperError] = useState<string | null>(null);
    const [printPreview, setPrintPreview] = useState<{ paper: PendingPaperTest; profileName: string } | null>(null);
    const printTriggerRef = useRef<HTMLElement | null>(null);
    const [cancelTarget, setCancelTarget] = useState<PendingPaperTest | null>(null);
    const [activationError, setActivationError] = useState(false);
    const [isActivating, setIsActivating] = useState(false);

    // Modals State
    const [renameTarget, setRenameTarget] = useState<UserProfile | null>(null);
    const [newName, setNewName] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
    const [showPaperTestModal, setShowPaperTestModal] = useState(false);
    const [pendingPaperTest, setPendingPaperTest] = useState<{ id: string; subject: "math" | "vocab"; level: number } | null>(null);
    const [openSection, setOpenSection] = useState<string | null>(null);
    const isEasy = profile?.uiTextMode === "easy";
    const t = (easy: string, standard: string) => (isEasy ? easy : standard);
    const TEST_TIMER_OPTIONS = [0, 5, 10, 15, 20] as const;
    const toggleSection = (key: string) => setOpenSection(prev => prev === key ? null : key);

    const syncProfileState = useCallback((nextProfile: UserProfile | null) => {
        if (profileIdRef.current !== (nextProfile?.id ?? null)) {
            setPrintPreview(null);
            setPendingPaperTest(null);
            setShowPaperTestModal(false);
            setCancelTarget(null);
            setPaperError(null);
        }
        profileIdRef.current = nextProfile?.id ?? null;
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
        if (!profile || profile.id !== nextProfile.id) return;
        // Apply only this control's changed fields to the latest owned snapshot.
        // A paper reservation or learning write may finish while Settings is open.
        const changes = Object.fromEntries(Object.entries(nextProfile)
            .filter(([key, value]) => value !== profile[key as keyof UserProfile]));
        const updated = await updateProfileAtomically(nextProfile.id, current => ({ ...current, ...changes }));
        if (updated && profileIdRef.current === updated.id) syncProfileState(updated);
    }, [profile, syncProfileState]);

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
            profileIdRef.current = null;
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
        navigate("/onboarding?mode=add");
    };

    const openRenameModal = (target: UserProfile) => {
        setRenameTarget(target);
        setNewName(target.name);
    };

    const handleRenameSubmit = async () => {
        if (!renameTarget || !newName.trim()) return;

        const updated = await updateProfileAtomically(renameTarget.id, current => ({ ...current, name: newName.trim() }));
        if (!updated) return;

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
            const allProfiles = await getAllProfiles();
            for (const storedProfile of allProfiles) {
                await deleteProfile(storedProfile.id);
            }
            syncProfileState(null);
            storage.clearAll();
            navigate("/onboarding");
        }
    };

    const runPaperJob = async (job: (profileId: string) => Promise<void>) => {
        const ownerId = profileIdRef.current;
        if (!ownerId || paperBusyRef.current) return;
        paperBusyRef.current = true;
        setIsPrinting(true);
        setPaperError(null);
        const release = holdPwaUpdateForCriticalPersistence();
        try {
            await job(ownerId);
        } catch (error) {
            console.error("Paper test operation failed:", error);
            if (profileIdRef.current === ownerId) {
                setPaperError(error instanceof Error ? error.message : "保存できませんでした。もう一度お試しください。");
            }
        } finally {
            release();
            paperBusyRef.current = false;
            setIsPrinting(false);
        }
    };

    const handlePrint = (subject: "math" | "vocab") => runPaperJob(async ownerId => {
        const result = await preparePaperTest(ownerId, subject);
        if (profileIdRef.current !== ownerId) return;
        syncProfileState(result.profile);
        if (!result.paper.testSet || result.paper.testSet.problems.length !== 20) {
            setPaperError("以前の紙テストには問題が保存されていません。点数を入力するか、採点待ちを取り消して新しく作成してください。");
            return;
        }
        setPrintPreview({ paper: result.paper, profileName: result.profile.name });
    });

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
        if (!pendingPaperTest) return;
        await runPaperJob(async ownerId => {
            const updated = await savePaperTestScore(ownerId, pendingPaperTest, correctCount);
            if (!updated) throw new Error("プロフィールが見つかりません。設定を開き直してください。");
            if (profileIdRef.current !== ownerId) return;
            syncProfileState(updated);
            setShowPaperTestModal(false);
            setPendingPaperTest(null);
        });
    };

    const handlePaperTestDismiss = () => {
        if (paperBusyRef.current) return;
        setShowPaperTestModal(false);
        setPendingPaperTest(null);
        setPaperError(null);
    };

    const handleCancelPaperTest = () => {
        if (!cancelTarget) return;
        void runPaperJob(async ownerId => {
            const updated = await cancelPaperTest(ownerId, cancelTarget.id);
            if (!updated) throw new Error("プロフィールが見つかりません。設定を開き直してください。");
            if (profileIdRef.current !== ownerId) return;
            syncProfileState(updated);
            setCancelTarget(null);
        });
    };

    const handleTestTimerChange = async (minutes: number) => {
        if (!profile) return;
        const updated = {
            ...profile,
            periodicTestTimeLimitSeconds: minutes > 0 ? minutes * 60 : undefined,
        };
        await persistProfileUpdate(updated);
    };

    const handleActivateVocab = async () => {
        if (!profile || isActivating) return;
        const expected = { profileId: profile.id, mainLevel: profile.vocabMainLevel };
        setActivationError(false);
        setIsActivating(true);
        try {
            const updated = await updateProfileAtomically(profile.id, current => activateVocabNextLevel(current, expected));
            if (!updated) throw new Error("Profile missing");
            if (profileIdRef.current === updated.id) syncProfileState(updated);
        } catch {
            if (profileIdRef.current === expected.profileId) setActivationError(true);
        } finally {
            setIsActivating(false);
        }
    };

    const formatPendingPaperMeta = (createdAt: string) => {
        const createdMs = new Date(createdAt).getTime();
        const elapsedDays = Math.max(0, Math.floor((Date.now() - createdMs) / (1000 * 60 * 60 * 24)));
        const createdText = new Date(createdAt).toLocaleDateString("ja-JP");
        return t(`${createdText} / ${elapsedDays}にち けいか`, `${createdText} / ${elapsedDays}日経過`);
    };

    const subjectLabel = profile?.subjectMode === "math" ? t("さんすう", "算数") : profile?.subjectMode === "vocab" ? t("えいご", "英語") : t("さんすう+えいご", "算数+英語");
    const hissanLabel = profile?.hissanModeEnabled !== false ? t("ひっさんON", "筆算ON") : t("ひっさんOFF", "筆算OFF");
    const soundLabel = sound ? t("おとON", "サウンドON") : t("おとOFF", "サウンドOFF");
    const textLabel = isEasy ? t("やさしい", "やさしい") : t("ふつう", "標準");
    const kanjiLabel = profile?.kanjiMode ? "漢字" : "ひらがな";

    const accordionHeader = (key: string, title: string, summary: string) => (
        <button
            type="button"
            onClick={() => toggleSection(key)}
            className="flex w-full items-center justify-between gap-3 rounded-[20px] px-5 py-4 text-left transition-colors hover:bg-white/30 active:scale-[0.99]"
        >
            <div className="min-w-0 flex-1">
                <div className="text-[15px] font-black text-slate-800">{title}</div>
                <div className="mt-0.5 truncate text-xs text-slate-500">{summary}</div>
            </div>
            <Icons.Back
                className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${openSection === key ? "-rotate-90" : "rotate-180"}`}
            />
        </button>
    );

    return (
        <ScreenScaffold
            title={t("せってい", "設定")}
            contentClassName="px-6 pt-2"
        >
            <ParentGateModal
                isOpen={showParentGuard}
                onClose={() => setShowParentGuard(false)}
                onSuccess={handleGuardSuccess}
            />
            {printPreview?.paper.testSet && <PrintableTestPreview
                testSet={printPreview.paper.testSet}
                paperId={printPreview.paper.id}
                profileName={printPreview.profileName}
                onClose={() => setPrintPreview(null)}
                returnFocusTo={printTriggerRef.current}
            />}
            <Modal isOpen={!!cancelTarget} onClose={() => { if (!isPrinting) setCancelTarget(null); }} title="採点待ちを取り消しますか？"
                footer={<Button disabled={isPrinting} onClick={handleCancelPaperTest}>採点待ちを取り消す</Button>}>
                <p className="text-sm text-slate-600">この用紙の点数入力と再印刷を終了します。学習の記録やレベルは変わりません。</p>
                {paperError && <p role="alert" className="mt-3 text-sm">{paperError}</p>}
            </Modal>
            {pendingPaperTest && (
                <PaperTestScoreModal
                    isOpen={showPaperTestModal}
                    subject={pendingPaperTest.subject}
                    level={pendingPaperTest.level}
                    onSubmit={handlePaperTestSubmit}
                    onDismiss={handlePaperTestDismiss}
                    isSaving={isPrinting}
                    error={paperError}
                />
            )}
            <Modal
                isOpen={!!renameTarget}
                onClose={() => setRenameTarget(null)}
                title="なまえを かえる"
                footer={(
                    <div className="flex gap-2">
                        <Button variant="secondary" className="flex-1" onClick={() => setRenameTarget(null)}>やめる</Button>
                        <Button className="flex-1 bg-primary text-white" onClick={handleRenameSubmit} disabled={!newName.trim()}>OK</Button>
                    </div>
                )}
            >
                <div className="space-y-4">
                    <p className="text-center text-sm text-slate-500">新しい なまえを 入力してください</p>
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full rounded-[18px] border border-white/85 bg-white/74 p-3 text-center text-xl font-bold text-slate-800 outline-none transition app-glass focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200/70"
                        autoFocus
                    />
                </div>
            </Modal>
            <Modal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                title="データを けす"
                footer={(
                    <div className="flex gap-2">
                        <Button variant="secondary" className="flex-1" onClick={() => setDeleteTarget(null)}>やめる</Button>
                        <Button className="flex-1 bg-[linear-gradient(135deg,#fb7185,#f43f5e)] text-white shadow-[0_18px_30px_-22px_rgba(244,63,94,0.55)]" onClick={handleDeleteSubmit}>けす</Button>
                    </div>
                )}
            >
                <div className="space-y-4 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-rose-100/90 bg-rose-50/80 text-3xl">🗑️</div>
                    <div>
                        <div className="text-lg font-bold text-slate-800">「{deleteTarget?.name}」さん</div>
                        <p className="mt-2 text-slate-500">本当に データを 消しますか？<br /><span className="text-xs font-bold text-red-500">※ 元には戻せません！</span></p>
                    </div>
                </div>
            </Modal>

            <div className="island-utility-content mx-auto w-full max-w-[22rem] space-y-3 pb-2">
                {/* ── プロフィール ── */}
                <SurfacePanel className="overflow-hidden rounded-[28px] p-0">
                    {accordionHeader("profile", t("プロフィール", "プロフィール"), `${profile?.name || "ゲスト"} · ${GRADES[profile?.grade ?? 1] || "???"}`)}
                    <AnimatePresence>
                        {openSection === "profile" && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                <div className="space-y-4 px-5 pb-5">
                                    <div className="flex items-center justify-end">
                                        <Button size="sm" variant="secondary" onClick={handleCreateProfile}>{t("ついか", "追加")}</Button>
                                    </div>
                                    {profiles.map(p => (
                                        <InsetPanel key={p.id} className="space-y-3 px-4 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-slate-50/82 font-black text-slate-600">{p.name?.[0] || "?"}</div>
                                                <div className="min-w-0 flex-1 cursor-pointer transition-opacity hover:opacity-75" onClick={() => openRenameModal(p)}>
                                                    <div className="truncate font-bold text-slate-700">{p.name || "ゲスト"}</div>
                                                    <div className="text-xs text-slate-500">{GRADES[p.grade] || "???"}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between gap-3 border-t border-white/70 pt-3">
                                                {profile?.id === p.id ? <Badge variant="primary">{t("つかってる", "使用中")}</Badge> : <Button size="sm" variant="secondary" className="px-3" onClick={() => handleSwitchProfile(p.id)}>{t("きりかえ", "切替")}</Button>}
                                                <div className="flex items-center gap-1">
                                                    <Button size="sm" variant="ghost" className="app-pill h-10 w-10 p-0 text-slate-500 hover:text-slate-700" onClick={() => openRenameModal(p)}>✏️</Button>
                                                    <Button size="sm" variant="ghost" className="h-10 w-10 rounded-full border border-rose-100/90 bg-rose-50/72 p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-600" onClick={() => openDeleteModal(p)}>🗑️</Button>
                                                </div>
                                            </div>
                                        </InsetPanel>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </SurfacePanel>

                {/* ── 学習 ── */}
                <SurfacePanel className="overflow-hidden rounded-[28px] p-0">
                    {accordionHeader("learning", t("べんきょう", "学習"), `${subjectLabel} · ${hissanLabel} · Lv.${profile?.mathMainLevel ?? 1}/${profile?.vocabMainLevel ?? 1}`)}
                    <AnimatePresence>
                        {openSection === "learning" && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                <div className="space-y-5 px-5 pb-5">
                                    {profile && needsVocabNextLevelActivation(profile) && <InsetPanel className="space-y-3 p-4">
                                        <p className="text-sm text-slate-700">英語の次のレベルも、少しずつ練習できます。</p>
                                        <Button size="sm" className="min-h-11 w-full" disabled={isActivating} onClick={() => { void handleActivateVocab(); }}>英語 Lv.{profile.vocabMainLevel + 1}の練習を始める</Button>
                                        <p className="text-xs text-slate-500">今のレベルを続けながら、10問のうち最大3問を新しい単語にします。</p>
                                        {activationError && <p role="alert" className="text-sm text-slate-700">保存できませんでした。もう一度お試しください。</p>}
                                    </InsetPanel>}
                                    <SurfacePanelHeader title={t("べんきょう する もの", "学習する科目")} />
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
                                        action={<Button size="sm" variant={profile?.hissanModeEnabled !== false ? "primary" : "secondary"} onClick={async () => { if (!profile) return; await persistProfileUpdate({ ...profile, hissanModeEnabled: !profile.hissanModeEnabled }); }} className="w-20">{profile?.hissanModeEnabled !== false ? "ON" : "OFF"}</Button>}
                                    />
                                    <PanelDivider />
                                    <SurfacePanelHeader title={t("レベル", "レベル")} />
                                    <div className="grid gap-3">
                                        {[
                                            { label: t("さんすう", "算数"), level: profile?.mathMainLevel ?? 1 },
                                            { label: t("えいご", "英語"), level: profile?.vocabMainLevel ?? 1 },
                                        ].map((item) => (
                                            <InsetPanel key={item.label} className="flex items-center justify-between px-4 py-3">
                                                <div className="font-bold text-slate-600">{item.label} <span className="text-lg font-black text-slate-800">Lv.{item.level}</span></div>
                                                <Button variant="secondary" size="sm" onClick={() => navigate("/settings/curriculum")}>{t("かえる", "変更")}</Button>
                                            </InsetPanel>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </SurfacePanel>

                {/* ── 表示とサウンド ── */}
                <SurfacePanel className="overflow-hidden rounded-[28px] p-0">
                    {accordionHeader("display", t("みため と おと", "表示とサウンド"), `${soundLabel} · ${textLabel} · ${kanjiLabel}`)}
                    <AnimatePresence>
                        {openSection === "display" && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                <div className="space-y-4 px-5 pb-5">
                                    <SettingRow title={t("おと・BGM", "サウンド")} action={<Button size="sm" variant={sound ? "primary" : "secondary"} onClick={handleSoundToggle} className="w-20">{sound ? "ON" : "OFF"}</Button>} />
                                    <PanelDivider />
                                    <SettingRow title={t("えいご よみあげ", "英語読み上げ")} action={<Button size="sm" variant={profile?.englishAutoRead ? "primary" : "secondary"} onClick={async () => { if (!profile) return; await persistProfileUpdate({ ...profile, englishAutoRead: !profile.englishAutoRead }); }} className="w-20">{profile?.englishAutoRead ? "ON" : "OFF"}</Button>} />
                                    <PanelDivider />
                                    <SurfacePanelHeader title={t("ひょうじ テキスト", "表示テキスト")} />
                                    <SegmentedControl value={profile?.uiTextMode ?? "standard"} onChange={handleTextModeChange} options={[{ value: "standard", label: t("ふつう", "標準") }, { value: "easy", label: t("やさしい", "やさしい") }]} />
                                    <PanelDivider />
                                    <SurfacePanelHeader title={t("にほんご モード", "日本語モード")} />
                                    <SegmentedControl value={profile?.kanjiMode ? "kanji" : "hiragana"} onChange={async (value) => { if (!profile) return; await persistProfileUpdate({ ...profile, kanjiMode: value === "kanji" }); }} options={[{ value: "hiragana", label: "ひらがな" }, { value: "kanji", label: "漢字" }]} />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </SurfacePanel>

                {/* ── テスト・保護者 ── */}
                <SurfacePanel className="overflow-hidden rounded-[28px] p-0">
                    {accordionHeader("parent", t("テスト・おとなむけ", "テスト・保護者"), t("ていきテスト · ほごしゃメニュー", "定期テスト · 保護者メニュー"))}
                    <AnimatePresence>
                        {openSection === "parent" && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                <div className="space-y-4 px-5 pb-5">
                                    <SurfacePanelHeader title={t("ていき テスト", "定期テスト（20問）")} description={t("アプリ と かみ で テスト できるよ", "アプリ受験と紙テストをここから開始できます")} />
                                    {paperError && !showPaperTestModal && !cancelTarget && <p role="alert" className="text-sm text-slate-700">{paperError}</p>}
                                    {isPrinting && <p role="status" className="text-sm text-slate-600">テストを保存しています…</p>}
                                    <InsetPanel className="space-y-3 px-4 py-4">
                                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{t("せいげん じかん", "制限時間")}</div>
                                        <div className="flex flex-wrap gap-2">
                                            {TEST_TIMER_OPTIONS.map(minutes => {
                                                const selectedMinutes = profile?.periodicTestTimeLimitSeconds ? Math.floor(profile.periodicTestTimeLimitSeconds / 60) : 0;
                                                const isSelected = selectedMinutes === minutes;
                                                return (
                                                    <button key={minutes} type="button" onClick={() => handleTestTimerChange(minutes)} className={`app-pill rounded-full px-3 py-1 text-xs font-black tracking-[0.08em] transition-colors ${isSelected ? "border-slate-200/90 bg-slate-100/88 text-slate-700" : "border-white/80 bg-white/68 text-slate-500"}`}>
                                                        {minutes === 0 ? t("なし", "なし") : t(`${minutes}ふん`, `${minutes}分`)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </InsetPanel>
                                    <div className="grid grid-cols-1 gap-3 land:grid-cols-2">
                                        {([
                                            { subject: "math" as const, title: t("さんすう", "算数"), level: profile?.mathMainLevel ?? 1,  startPath: "/study?session=periodic-test&focus_subject=math" },
                                            { subject: "vocab" as const, title: t("えいご", "英語"), level: profile?.vocabMainLevel ?? 1,  startPath: "/study?session=periodic-test&focus_subject=vocab" },
                                        ]).map(item => {
                                            const status = getTestStatus(item.subject);
                                            const pendingPaper = getPendingPaperTest(item.subject);
                                            const hasPendingPaper = !!pendingPaper;
                                            return (
                                                <InsetPanel key={item.subject} className="space-y-3 px-4 py-4">
                                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                                        <div>
                                                            <div className="font-bold text-slate-700">{item.title} Lv.{pendingPaper?.level ?? item.level}</div>
                                                            {pendingPaper ? <div className="mt-1 text-[11px] text-slate-500">{formatPendingPaperMeta(pendingPaper.createdAt)}</div> : null}
                                                        </div>
                                                        <Badge variant={status.variant}>{status.label}</Badge>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-2">
                                                        <Button size="sm" className="h-10 w-full" onClick={() => withParentGuard(() => navigate(item.startPath))}>{t("アプリで うける", "アプリ受験")}</Button>
                                                        <Button size="sm" variant="secondary" className="min-h-11 w-full text-xs" disabled={isPrinting} onClick={event => { printTriggerRef.current = event.currentTarget; void handlePrint(item.subject); }}>{hasPendingPaper ? t("おなじ もんだいを いんさつ", "同じ問題を印刷") : t("いんさつ・PDF", "印刷・PDF")}</Button>
                                                        {hasPendingPaper && <>
                                                            <Button size="sm" variant="secondary" className="min-h-11 w-full" disabled={isPrinting} onClick={() => handleOpenPaperScoreModal(item.subject)}>{t("てんすう いれる", "点数入力")}</Button>
                                                            <button type="button" className="min-h-11 text-xs text-slate-600 underline" disabled={isPrinting} onClick={() => setCancelTarget(pendingPaper)}>{t("さいてん まちを とりけす", "採点待ちを取り消す")}</button>
                                                        </>}
                                                    </div>
                                                </InsetPanel>
                                            );
                                        })}
                                    </div>
                                    <PanelDivider />
                                    <SettingRow title={t("ほごしゃ メニュー", "保護者メニュー")} description={t("おとなの ひとが みる ページ", "大人向けページ")} action={<Button size="sm" variant="secondary" onClick={() => withParentGuard(() => navigate('/parents', { state: { parentGatePassed: true } }))}>{t("ひらく", "開く")}</Button>} />
                                    <PanelDivider />
                                    <SettingRow title="開発者モード" description="内部状態や検証用の画面を開く" action={<Button size="sm" variant="secondary" onClick={() => navigate("/dev")}>{t("ひらく", "開く")}</Button>} />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </SurfacePanel>

                {/* ── リセット ── */}
                <div className="pt-4">
                    <button
                        type="button"
                        onClick={handleReset}
                        className="w-full rounded-[20px] py-3 text-center text-sm font-bold text-rose-500 transition-colors hover:bg-rose-50/50"
                    >
                        {t("データをすべてリセット", "全データをリセット")}
                    </button>
                </div>
            </div>
        </ScreenScaffold>
    );
};
