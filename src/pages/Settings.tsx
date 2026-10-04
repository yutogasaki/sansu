import { BookOpen, ShieldCheck, UserRound, Volume2 } from "lucide-react";
import { islandEnabled } from "../domain/island/feature";
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
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useIslandNavigation } from '../components/island/useIslandNavigation';
import { UserProfile } from "../domain/types";
import { getActiveProfile, deleteProfile, getAllProfiles, updateProfileAtomically, setActiveProfileId } from "../domain/user/repository";
import { setSoundEnabled } from "../utils/audio";
import { ParentGateModal } from "../components/gate/ParentGateModal";
import { activateVocabNextLevel, needsVocabNextLevelActivation } from "../hooks/useStudySession.logic";
import { ScreenScaffold } from "../components/ScreenScaffold";
import storage from "../utils/storage";
import "./UtilityLayout.css";

export const Settings: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const navigation = useIslandNavigation();
    const learningOverlay = navigation?.learning ?? false;
    const [sound, setSound] = useState(true);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const switchingRef = useRef(false);
    const [switchingId, setSwitchingId] = useState<string | null>(null);
    const [switchError, setSwitchError] = useState(false);

    // 保護者ガードの状態
    const [showParentGuard, setShowParentGuard] = useState(false);
    const [guardCallback, setGuardCallback] = useState<(() => void) | null>(null);
    const profileIdRef = useRef<string | null>(null);
    const [activationError, setActivationError] = useState(false);
    const [isActivating, setIsActivating] = useState(false);

    // Modals State
    const [renameTarget, setRenameTarget] = useState<UserProfile | null>(null);
    const [newName, setNewName] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
    const [legacySection, setOpenSection] = useState<string | null>(null);
    const section = new URLSearchParams(location.search).get('section');
    const openSection = navigation ? ['profile', 'learning', 'display', 'parent'].includes(section ?? '') ? section : null : legacySection;
    const isEasy = profile?.uiTextMode === "easy";
    const t = (easy: string, standard: string) => (isEasy ? easy : standard);
    const toggleSection = (key: string) => {
        if (navigation) {
            if (openSection !== key) navigation.open(`/settings?section=${key}`);
        }
        else setOpenSection(prev => prev === key ? null : key);
    };

    const syncProfileState = useCallback((nextProfile: UserProfile | null) => {
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
        if (learningOverlay) return;
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
    }, [syncProfileState, learningOverlay]);

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
        if (switchingRef.current || id === profile?.id || navigation?.blocked || navigation?.learningBlocked) return;
        switchingRef.current = true;
        setSwitchingId(id);
        setSwitchError(false);
        try {
            await setActiveProfileId(id);
            navigate("/", { replace: true });
        } catch {
            setSwitchError(true);
        } finally {
            switchingRef.current = false;
            setSwitchingId(null);
        }
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

    const subjectLabel = profile?.subjectMode === "math" ? t("さんすう", "算数") : profile?.subjectMode === "vocab" ? t("えいご", "英語") : t("さんすう+えいご", "算数+英語");
    const hissanLabel = profile?.hissanModeEnabled !== false ? t("ひっさんON", "筆算ON") : t("ひっさんOFF", "筆算OFF");
    const soundLabel = sound ? t("おとON", "サウンドON") : t("おとOFF", "サウンドOFF");
    const textLabel = isEasy ? t("やさしい", "やさしい") : t("ふつう", "標準");
    const kanjiLabel = profile?.kanjiMode ? "漢字" : "ひらがな";

    const sectionIcons = { profile: UserRound, learning: BookOpen, display: Volume2, parent: ShieldCheck };
    const sectionButton = (key: keyof typeof sectionIcons, title: string, summary: string) => {
        const SectionIcon = sectionIcons[key];
        const sectionId = `settings-panel-${key}`;
        return (
        <button
            type="button"
            onClick={() => key === 'parent' ? withParentGuard(() => navigate('/parents', { state: { parentGatePassed: true } })) : toggleSection(key)}
            aria-expanded={openSection === key}
            aria-controls={navigation && key !== 'parent' ? sectionId : undefined}
            aria-current={navigation && openSection === key ? "page" : undefined}
            data-setting-section={key}
            className="pokomoko-setting-trigger flex w-full items-center justify-between gap-3 rounded-[20px] px-5 py-4 text-left transition-colors hover:bg-white/30 active:scale-[0.99]"
        >
            {islandEnabled() && <span className="pokomoko-setting-patch" aria-hidden="true"><SectionIcon size={23} strokeWidth={1.8} /></span>}
            <div className="min-w-0 flex-1">
                <div className="text-[15px] font-black text-slate-800">{title}</div>
                <div className="mt-0.5 truncate text-xs text-pokomoko-muted">{summary}</div>
            </div>
            <Icons.Back
                className={`h-5 w-5 shrink-0 text-pokomoko-muted transition-transform duration-200 ${openSection === key ? "-rotate-90" : "rotate-180"}`}
            />
        </button>
        );
    };

    if (section === 'parent') return <Navigate to="/parents" replace />;

    return (
        <ScreenScaffold
            title={navigation && openSection ? ({ profile: 'プロフィール', learning: t('がくしゅう', '学習'), display: t('ひょうじと おと', '表示とサウンド'), parent: t('ほごしゃ', '保護者') }[openSection] ?? t('せってい', '設定')) : t("せってい", "設定")}
            showBack={Boolean(navigation)}
            onBack={navigation?.back}
            containerClassName={navigation ? "utility-layout-screen" : undefined}
            contentClassName={navigation ? "utility-layout-scroll" : "px-6 pt-2"}
        >
            <ParentGateModal
                isOpen={showParentGuard}
                onClose={() => setShowParentGuard(false)}
                onSuccess={handleGuardSuccess}
            />
            <Modal
                isOpen={!!renameTarget}
                onClose={() => setRenameTarget(null)}
                title="なまえを かえる"
                footer={(
                    <div className="flex gap-2">
                        <Button variant="secondary" className="flex-1" onClick={() => setRenameTarget(null)}>やめる</Button>
                        <Button className="flex-1" onClick={handleRenameSubmit} disabled={!newName.trim()}>OK</Button>
                    </div>
                )}
            >
                <div className="space-y-4">
                    <p className="text-center text-sm text-pokomoko-muted">新しい なまえを 入力してください</p>
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full rounded-[18px] border border-white/85 bg-white/74 p-3 text-center text-xl font-bold text-slate-800 outline-none transition app-glass focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200/70"
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
                        <p className="mt-2 text-pokomoko-muted">本当に データを 消しますか？<br /><span className="text-xs font-bold text-red-500">※ 元には戻せません！</span></p>
                    </div>
                </div>
            </Modal>

            <div className={navigation ? `utility-layout-content settings-layout${openSection ? " has-selection" : ""}` : "island-utility-content mx-auto w-full max-w-[22rem] space-y-3 pb-2"}>
                {openSection && switchError && <p role="alert" className="settings-profile-switcher text-sm">きりかえが できなかったよ。もういちど おしてね。</p>}
                {!openSection && profile && <SurfacePanel className="settings-profile-switcher" aria-label="あそぶ人を えらぶ">
                    <div><h2 className="text-lg font-bold">だれが あそぶ？</h2><p className="mt-1 text-sm text-pokomoko-muted">なまえを おすと、その人の しまへ。</p></div>
                    <div className="settings-profile-choices">
                        {profiles.map(person => <button key={person.id} type="button"
                            className="settings-profile-choice" aria-label={`${person.name || 'ゲスト'}${person.id === profile.id ? '（いま あそんでいる）' : 'に きりかえる'}`}
                            aria-pressed={person.id === profile.id}
                            disabled={Boolean(switchingId) || Boolean(navigation?.blocked || navigation?.learningBlocked)}
                            onClick={() => { void handleSwitchProfile(person.id); }}>
                            <span className="settings-profile-avatar" aria-hidden="true">{Array.from(person.name || '?')[0]}</span>
                            <span className="settings-profile-name">{person.name || 'ゲスト'}</span>
                            <span className="settings-profile-state">{switchingId === person.id ? 'きりかえ中…' : person.id === profile.id ? '✓ いま あそんでいる' : 'この人で あそぶ'}</span>
                        </button>)}
                    </div>
                    <p role="status" className="text-sm text-pokomoko-muted">{switchError ? 'きりかえが できなかったよ。もういちど なまえを おしてね。' : switchingId ? 'しまを ひらいているよ…' : ''}</p>
                </SurfacePanel>}
                {navigation && <nav className="settings-category-list" aria-label={t("せっていの こうもく", "設定の項目")}>
                    {sectionButton("profile", "プロフィール", `${profile?.name || "ゲスト"} · ${GRADES[profile?.grade ?? 1] || "???"}`)}
                    {sectionButton("learning", t("べんきょう", "学習"), `${subjectLabel} · ${hissanLabel} · Lv.${profile?.mathMainLevel ?? 1}/${profile?.vocabMainLevel ?? 1}`)}
                    {sectionButton("display", t("みため と おと", "表示とサウンド"), `${soundLabel} · ${textLabel} · ${kanjiLabel}`)}
                    {sectionButton("parent", t("ほごしゃ", "保護者"), t("きろく · はんい · かくにん", "学習状況 · 範囲調整 · 理解度の確認"))}
                </nav>}
                <div className={navigation ? "settings-panels" : "space-y-3"}>
                {navigation && !openSection && <div className="settings-empty-selection">
                    <BookOpen size={28} strokeWidth={1.6} aria-hidden="true" />
                    <h2>{t("こうもくを えらぼう", "項目を選んでください")}</h2>
                    <p>{t("べんきょうや おとの せっていを かえられるよ。", "現在の設定を確認・変更できます。")}</p>
                </div>}
                {/* ── プロフィール ── */}
                <SurfacePanel id="settings-panel-profile" hidden={Boolean(navigation && openSection !== "profile")} className="overflow-hidden rounded-[28px] p-0">
                    {!navigation && sectionButton("profile", t("プロフィール", "プロフィール"), `${profile?.name || "ゲスト"} · ${GRADES[profile?.grade ?? 1] || "???"}`)}
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
                                                <button
                                                    type="button"
                                                    className="min-h-11 min-w-0 flex-1 rounded-lg text-left transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2BBAA0]/30 focus-visible:ring-offset-2"
                                                    aria-label={t("なまえを かえる", `${p.name || "ゲスト"}の名前を変更`)}
                                                    onClick={() => openRenameModal(p)}
                                                >
                                                    <div className="truncate font-bold text-slate-700">{p.name || "ゲスト"}</div>
                                                    <div className="text-xs text-pokomoko-muted">{GRADES[p.grade] || "???"}</div>
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-between gap-3 border-t border-white/70 pt-3">
                                                {profile?.id === p.id ? <Badge variant="primary">{t("つかってる", "使用中")}</Badge> : <Button size="sm" variant="secondary" className="px-3" disabled={Boolean(switchingId) || Boolean(navigation?.blocked || navigation?.learningBlocked)} onClick={() => { void handleSwitchProfile(p.id); }}>{switchingId === p.id ? 'きりかえ中…' : t("きりかえ", "切替")}</Button>}
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="app-pill h-11 w-11 min-w-11 p-0 text-pokomoko-muted hover:text-slate-700"
                                                        aria-label={t("なまえを かえる", `${p.name || "ゲスト"}の名前を変更`)}
                                                        onClick={() => openRenameModal(p)}
                                                    >✏️</Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-11 w-11 min-w-11 rounded-full border border-rose-100/90 bg-rose-50/72 p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                                                        aria-label={t("プロフィールを けす", `${p.name || "ゲスト"}のプロフィールを削除`)}
                                                        onClick={() => openDeleteModal(p)}
                                                    >🗑️</Button>
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
                <SurfacePanel id="settings-panel-learning" hidden={Boolean(navigation && openSection !== "learning")} className="overflow-hidden rounded-[28px] p-0">
                    {!navigation && sectionButton("learning", t("べんきょう", "学習"), `${subjectLabel} · ${hissanLabel} · Lv.${profile?.mathMainLevel ?? 1}/${profile?.vocabMainLevel ?? 1}`)}
                    <AnimatePresence>
                        {openSection === "learning" && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                <div className="space-y-5 px-5 pb-5">
                                    {profile && needsVocabNextLevelActivation(profile) && <InsetPanel className="space-y-3 p-4">
                                        <p className="text-sm text-slate-700">英語の次のレベルも、少しずつ練習できます。</p>
                                        <Button size="sm" className="min-h-11 w-full" disabled={isActivating} onClick={() => { void handleActivateVocab(); }}>英語 Lv.{profile.vocabMainLevel + 1}の練習を始める</Button>
                                        <p className="text-xs text-pokomoko-muted">今のレベルを続けながら、10問のうち最大3問を新しい単語にします。</p>
                                        {activationError && <p role="alert" className="text-sm text-slate-700">保存できませんでした。もう一度お試しください。</p>}
                                    </InsetPanel>}
                                    <SurfacePanelHeader title={t("べんきょう する もの", "学習する科目")} />
                                    <SegmentedControl
                                        aria-label={t("べんきょう する もの", "学習する科目")}
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
                                        action={<Button aria-label={t("ひっさん モード", "筆算モード")} aria-pressed={profile?.hissanModeEnabled !== false} size="sm" variant={profile?.hissanModeEnabled !== false ? "primary" : "secondary"} onClick={async () => { if (!profile) return; await persistProfileUpdate({ ...profile, hissanModeEnabled: !profile.hissanModeEnabled }); }} className="w-20">{profile?.hissanModeEnabled !== false ? "ON" : "OFF"}</Button>}
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
                                                <Button variant="secondary" size="sm" aria-label={`${item.label}のレベルを変更`} onClick={() => navigation ? navigation.open("/settings/curriculum") : navigate("/settings/curriculum")}>{t("かえる", "変更")}</Button>
                                            </InsetPanel>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </SurfacePanel>

                {/* ── 表示とサウンド ── */}
                <SurfacePanel id="settings-panel-display" hidden={Boolean(navigation && openSection !== "display")} className="overflow-hidden rounded-[28px] p-0">
                    {!navigation && sectionButton("display", t("みため と おと", "表示とサウンド"), `${soundLabel} · ${textLabel} · ${kanjiLabel}`)}
                    <AnimatePresence>
                        {openSection === "display" && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                <div className="space-y-4 px-5 pb-5">
                                    <SettingRow title={t("おと・BGM", "サウンド")} action={<Button aria-label={t("おと・BGM", "サウンド")} aria-pressed={sound} size="sm" variant={sound ? "primary" : "secondary"} onClick={handleSoundToggle} className="w-20">{sound ? "ON" : "OFF"}</Button>} />
                                    <PanelDivider />
                                    <SettingRow title={t("えいご よみあげ", "英語読み上げ")} action={<Button aria-label={t("えいご よみあげ", "英語読み上げ")} aria-pressed={Boolean(profile?.englishAutoRead)} size="sm" variant={profile?.englishAutoRead ? "primary" : "secondary"} onClick={async () => { if (!profile) return; await persistProfileUpdate({ ...profile, englishAutoRead: !profile.englishAutoRead }); }} className="w-20">{profile?.englishAutoRead ? "ON" : "OFF"}</Button>} />
                                    <PanelDivider />
                                    <SurfacePanelHeader title={t("ひょうじ テキスト", "表示テキスト")} />
                                    <SegmentedControl aria-label={t("ひょうじ テキスト", "表示テキスト")} value={profile?.uiTextMode ?? "standard"} onChange={handleTextModeChange} options={[{ value: "standard", label: t("ふつう", "標準") }, { value: "easy", label: t("やさしい", "やさしい") }]} />
                                    <PanelDivider />
                                    <SurfacePanelHeader title={t("にほんご モード", "日本語モード")} />
                                    <SegmentedControl aria-label="日本語モード" value={profile?.kanjiMode ? "kanji" : "hiragana"} onChange={async (value) => { if (!profile) return; await persistProfileUpdate({ ...profile, kanjiMode: value === "kanji" }); }} options={[{ value: "hiragana", label: "ひらがな" }, { value: "kanji", label: "漢字" }]} />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </SurfacePanel>

                {/* ── 保護者 ── */}

                </div>
                {!navigation && sectionButton("parent", t("ほごしゃ", "保護者"), t("きろく · はんい · かくにん", "学習状況 · 範囲調整 · 理解度の確認"))}
            </div>
        </ScreenScaffold>
    );
};
