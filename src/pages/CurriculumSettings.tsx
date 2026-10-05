import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getActiveProfile, saveProfile, updateProfileAtomically } from "../domain/user/repository";
import { UserProfile } from "../domain/types";
import { syncLevelState, syncUnlockLevel } from "../domain/user/profile";
import { needsProgressionResume, resumeProgression } from "../domain/user/resumeProgression";
import { Modal } from "../components/ui/Modal";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import {
    InsetPanel,
    SegmentedControl,
    SurfacePanel,
    SurfacePanelHeader,
} from "../components/ui/SurfacePanel";
import { cn } from "../utils/cn";

// レベル定義
const MATH_LEVELS: { level: number; title: string; desc: string }[] = [
    { level: 0, title: "はじめてのかず", desc: "5まで かぞえよう" },
    { level: 1, title: "かたちといろ", desc: "かたち・いろ・パターン" },
    { level: 2, title: "かずのきもち", desc: "おおい・すくない・ならび" },
    { level: 3, title: "10までかぞえよう", desc: "10までの かず" },
    { level: 4, title: "くらべてみよう", desc: "ながさ・おもさ・おおきさ" },
    { level: 5, title: "ゼロとわける", desc: "ゼロ・わけっこ" },
    { level: 6, title: "50まで・まとまり", desc: "50までの かず・10のまとまり" },
    { level: 7, title: "100まで・大小", desc: "100までの数・大小比較" },
    { level: 8, title: "たし算（入門）", desc: "+1〜+3" },
    { level: 9, title: "たし算（基礎）", desc: "+4〜+10" },
    { level: 10, title: "ひき算（１桁）", desc: "のこりはいくつ" },
    { level: 11, title: "２桁のたしひき", desc: "20+30, 45-5など" },
    { level: 12, title: "大きな計算", desc: "3桁・4桁の計算" },
    { level: 13, title: "かけ算（前半）", desc: "九九 1の段〜5の段" },
    { level: 14, title: "かけ算（後半）", desc: "九九 6の段〜9の段" },
    { level: 15, title: "かけ算（筆算）", desc: "2桁×1桁など" },
    { level: 16, title: "わり算（基本）", desc: "あまりのないわり算" },
    { level: 17, title: "わり算（あまり）", desc: "あまりのあるわり算" },
    { level: 18, title: "大きなかけわり", desc: "3桁×2桁など" },
    { level: 19, title: "小数（たしひき）", desc: "0.1 + 0.2 など" },
    { level: 20, title: "小数（かけわり）", desc: "小数×整数など" },
    { level: 21, title: "分数（同分母）", desc: "分母が同じ" },
    { level: 22, title: "分数（異分母）", desc: "通分・帯分数" },
    { level: 23, title: "分数（かけ算）", desc: "分数×整数・分数" },
    { level: 24, title: "分数（わり算）", desc: "分数÷整数・分数" },
];

const VOCAB_LEVELS: { level: number; title: string; desc: string }[] = [
    { level: 1, title: "Lv.1 超基本", desc: "おかし・どうぶつ・かず" },
    { level: 2, title: "Lv.2 からだ・かぞく", desc: "かお・いろ・ひと" },
    { level: 3, title: "Lv.3 みぢかなもの", desc: "がっこう・のりもの" },
    { level: 4, title: "Lv.4 しぜん・じかん", desc: "そら・うみ・あさ・よる" },
    { level: 5, title: "Lv.5 カレンダー", desc: "ようび・つき・きせつ" },
    { level: 6, title: "Lv.6 おしごと", desc: "いしゃ・たてもの・ごはん" },
    { level: 7, title: "Lv.7 まち・せいかつ", desc: "かいもの・りょこう" },
    { level: 8, title: "Lv.8 学校・きもち", desc: "かもく・行事・どうぐ" },
    { level: 9, title: "Lv.9 うごき・せいかく", desc: "どうさ・性格・ようす" },
    { level: 10, title: "Lv.10 くわしいようす", desc: "形容詞・副詞（発展）" },
    { level: 11, title: "Lv.11 社会・科学", desc: "しゃかい・かんきょう" },
    { level: 12, title: "Lv.12 考え・場面", desc: "がいねん・どう詞（思考）" },
    { level: 13, title: "Lv.13 政治・経済", desc: "せいじ・けいざい" },
    { level: 14, title: "Lv.14 文化・芸術", desc: "ぶんか・げいじゅつ" },
    { level: 15, title: "Lv.15 人体・医療", desc: "からだの仕組み・病気" },
    { level: 16, title: "Lv.16 自然・宇宙", desc: "しぜん現象・うちゅう" },
    { level: 17, title: "Lv.17 抽象概念 1", desc: "ちゅうしょう的なことば" },
    { level: 18, title: "Lv.18 抽象概念 2", desc: "より高度な概念" },
    { level: 19, title: "Lv.19 学術・専門 1", desc: "せんもん的な用語" },
    { level: 20, title: "Lv.20 学術・専門 2", desc: "さいごの難関単語" },
];

export const CurriculumSettings: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [activeTab, setActiveTab] = useState<"math" | "vocab">(searchParams.get('subject') === 'vocab' ? 'vocab' : 'math');
    const [showGuard, setShowGuard] = useState(false);
    const [pendingLevel, setPendingLevel] = useState<number | null>(null);
    const [pendingAction, setPendingAction] = useState<"main" | "unlock" | "resume" | null>(null);
    const [resumeTarget, setResumeTarget] = useState<{ profileId: string; mainLevel: number; subject: 'math' | 'vocab' } | null>(null);
    const [resumeError, setResumeError] = useState(false);

    const persistProfileUpdate = useCallback(async (nextProfile: UserProfile) => {
        await saveProfile(nextProfile);
        setProfile(nextProfile);
    }, []);

    const closeGuard = useCallback(() => {
        setShowGuard(false);
        setPendingLevel(null);
        setPendingAction(null);
        setResumeTarget(null);
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadProfile = async () => {
            const activeProfile = await getActiveProfile();
            if (!cancelled && activeProfile) {
                setProfile(activeProfile);
            }
        };

        void loadProfile();

        return () => {
            cancelled = true;
        };
    }, []);

    const handleLevelSelect = (level: number) => {
        setPendingLevel(level);
        setPendingAction("main");
        setShowGuard(true);
    };

    const handleUnlockSelect = (level: number) => {
        setPendingLevel(level);
        setPendingAction("unlock");
        setShowGuard(true);
    };

    const handleConfirmLevel = async () => {
        if (!profile || pendingLevel === null || !pendingAction) return;

        if (pendingAction === 'resume' && resumeTarget) {
            try {
                const updated = await updateProfileAtomically(resumeTarget.profileId, current => resumeProgression(current, resumeTarget.subject, resumeTarget));
                if (updated) setProfile(updated);
                else setResumeError(true);
            } catch { setResumeError(true); }
            closeGuard();
            return;
        }

        let updated: UserProfile;
        if (pendingAction === "main") {
            updated = activeTab === "math"
                ? syncLevelState(profile, 'math', pendingLevel)
                : syncLevelState(profile, 'vocab', pendingLevel);
        } else {
            updated = activeTab === "math"
                ? syncUnlockLevel(profile, 'math', pendingLevel)
                : syncUnlockLevel(profile, 'vocab', pendingLevel);
        }

        await persistProfileUpdate(updated);
        closeGuard();
    };

    const currentLevel = activeTab === "math"
        ? (profile?.mathMainLevel ?? 1)
        : (profile?.vocabMainLevel ?? 1);
    const currentMaxUnlocked = activeTab === "math"
        ? (profile?.mathMaxUnlocked ?? currentLevel)
        : (profile?.vocabMaxUnlocked ?? currentLevel);
    const currentSubjectLabel = activeTab === "math" ? "さんすう" : "えいご";
    const levels = activeTab === "math" ? MATH_LEVELS : VOCAB_LEVELS;

    const tabs = (
        <div className="px-[var(--screen-padding-x)] pt-1">
            <SurfacePanel variant="flat" className="space-y-3">
                <SurfacePanelHeader
                    title="科目"
                    description="出題する内容・難しさを調整する科目を選びます"
                />
                <SegmentedControl
                    aria-label="表示する教科"
                    value={activeTab}
                    onChange={setActiveTab}
                    options={[
                        { value: "math", label: "さんすう" },
                        { value: "vocab", label: "えいご" },
                    ]}
                />
            </SurfacePanel>
        </div>
    );

    return (
        <ScreenScaffold
            title="学習範囲を変更"
            containerClassName="curriculum-screen"
            showBack
            onBack={() => navigate("/parents")}
            topSlot={tabs}
            contentClassName="px-[var(--screen-padding-x)] pt-4 space-y-5"
        >
            <Modal isOpen={showGuard} onClose={closeGuard} title="学習範囲の変更を確認"
                footer={<div className="flex gap-2"><Button variant="secondary" onClick={closeGuard}>やめる</Button><Button onClick={handleConfirmLevel}>変更する</Button></div>}>
                <p>{activeTab === 'math' ? '算数' : '英語'}の{pendingAction === 'resume' ? '進級を再開' : pendingAction === 'unlock' ? '解放上限を変更' : '練習の中心を変更'}：Lv.{pendingLevel}</p>
                <p className="mt-3 text-sm text-pokomoko-muted">{pendingAction === 'main' ? '出題の中心が変わり、上のレベルはオフになります。学習記録は残ります。' : pendingAction === 'unlock' ? '練習できる範囲が変わります。現在のレベルより下には設定できません。' : '次の範囲を有効にします。レベルアップの条件と学習記録はそのままです。'}</p>
            </Modal>
            {profile && needsProgressionResume(profile, activeTab) && <SurfacePanel className="space-y-3" aria-label="進級の再開">
                <SurfacePanelHeader title={`Lv.${currentLevel + 1}への進級`} />
                <p className="text-sm text-pokomoko-muted">次のレベルは現在オフです。レベルを選び直すと、上のレベルがオフになることがあります。</p>
                <Button className="w-full" onClick={() => {
                    setResumeError(false);
                    setResumeTarget({ profileId: profile.id, mainLevel: currentLevel, subject: activeTab });
                    setPendingLevel(currentLevel + 1);
                    setPendingAction('resume');
                    setShowGuard(true);
                }}>Lv.{currentLevel + 1}への進級を再開</Button>
                <p className="text-xs text-pokomoko-muted">今のレベルと記録はそのまま。レベルアップをクリアすると、次へ進みます。</p>
            </SurfacePanel>}
            {resumeError && <p role="alert">保存できませんでした。もう一度お試しください。</p>}
            <SurfacePanel>
                <SurfacePanelHeader
                    title={`${currentSubjectLabel} の いま`}
                    description="普段は練習に合わせて進みます。難しさが合わないときだけ調整してください。"
                />
                <div className="grid grid-cols-2 gap-3">
                    <InsetPanel className="space-y-1 py-4 text-center">
                        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                            メイン
                        </div>
                        <div className="text-3xl font-black tracking-[-0.04em] text-slate-800">
                            Lv.{currentLevel}
                        </div>
                    </InsetPanel>
                    <InsetPanel className="space-y-1 py-4 text-center">
                        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                            解放上限
                        </div>
                        <div className="text-3xl font-black tracking-[-0.04em] text-slate-800">
                            Lv.{currentMaxUnlocked}
                        </div>
                    </InsetPanel>
                </div>
                <p className="text-center text-xs leading-5 text-slate-400">
                    「メイン」は練習の中心。「解放上限」は練習できる範囲の上限です。確認テストは保護者画面から行えます。
                </p>
            </SurfacePanel>

            <SurfacePanel>
                <SurfacePanelHeader
                    title="レベル いちらん"
                    description="カードごとに メイン と 解放上限を えらべるよ"
                />
                <div className="space-y-3">
                    {levels.map((item) => {
                        const isSelected = item.level === currentLevel;
                        const isUnlocked = item.level <= currentMaxUnlocked;
                        const statusLabel =
                            item.level < currentLevel
                                ? "完了"
                                : item.level === currentLevel
                                    ? "メイン"
                                    : isUnlocked
                                        ? "解放済"
                                        : "未解放";

                        return (
                            <InsetPanel
                                key={item.level}
                                className={cn(
                                    "space-y-3 transition-all",
                                    isSelected && "border-cyan-200 bg-cyan-50/55"
                                )}
                            >
                                <div className="flex items-start gap-4">
                                    <div
                                        className={cn(
                                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-black",
                                            isSelected
                                                ? "bg-cyan-600 text-white"
                                                : isUnlocked
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : "bg-slate-100 text-slate-400"
                                        )}
                                    >
                                        {item.level}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="text-base font-black text-slate-800">{item.title}</div>
                                            <Badge
                                                variant={
                                                    isSelected
                                                        ? "primary"
                                                        : item.level < currentLevel
                                                            ? "success"
                                                            : isUnlocked
                                                                ? "neutral"
                                                                : "warning"
                                                }
                                            >
                                                {statusLabel}
                                            </Badge>
                                            {activeTab === "math" && item.level === currentMaxUnlocked ? (
                                                <Badge variant="success">上限</Badge>
                                            ) : null}
                                        </div>
                                        <div className="mt-1 text-xs leading-5 text-slate-500">
                                            {item.desc}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        onClick={() => handleLevelSelect(item.level)}
                                        disabled={isSelected}
                                        variant={isSelected ? "secondary" : "primary"}
                                        className="min-w-[152px] flex-1"
                                    >
                                        {isSelected ? "メイン中" : "メインにする"}
                                    </Button>
                                    {activeTab === "math" && (
                                        <Button
                                            type="button"
                                            onClick={() => handleUnlockSelect(item.level)}
                                            variant={item.level === currentMaxUnlocked ? "secondary" : "ghost"}
                                            className="min-w-[140px]"
                                        >
                                            {item.level === currentMaxUnlocked ? "いまの上限" : "解放上限にする"}
                                        </Button>
                                    )}
                                </div>
                            </InsetPanel>
                        );
                    })}
                </div>
            </SurfacePanel>
        </ScreenScaffold>
    );
};
