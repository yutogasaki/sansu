import { KokugoLevelSummary } from '../../components/progress/KokugoLevelSummary';
import { useKokugoOverview } from '../../components/progress/useKokugoOverview';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { summarizeActivity } from '../../domain/stats/activity';
import { getLearningDayStart } from '../../utils/learningDay';
import { addDays } from 'date-fns';
import { KokugoProgressCard } from '../../components/kokugo/KokugoProgress';
import { FoundationProgress } from '../../components/progress/FoundationProgress';
import { IslandMemorialRecovery } from './IslandMemorialRecovery';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWeakMathSkillIds, getWeakVocabIds } from '../../domain/learningRepository';
import { ENGLISH_WORDS } from '../../domain/english/words';
import type { RecentAttempt, UserProfile } from '../../domain/types';
import { getActiveProfile } from '../../domain/user/repository';
import { getParentAttemptLabel, getParentMathSkillLabel, getParentVocabWordLabel } from './parentAttemptLabel';
import { PARENT_REVIEW_COPY } from './parentReviewCopy';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { InsetPanel, SectionLabel, SurfacePanel, SurfacePanelHeader } from '../../components/ui/SurfacePanel';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import { Button } from '../../components/ui/Button';
import { logInDev } from '../../utils/debug';
import { ChevronDown, ArrowRight, ClipboardCheck, SlidersHorizontal } from 'lucide-react';
import { ParentAssessment } from './ParentAssessment';
import { ParentTools } from './ParentTools';
import { learningLevelTitle } from '../../domain/learning/progressView';
import './Parents.css';
import { useIslandNavigation } from '../../components/island/useIslandNavigation';

export const ParentsPage: React.FC = () => {
    const navigate = useNavigate();
    const navigation = useIslandNavigation();
    const learningOverlay = navigation?.learning ?? false;
    const settingsReturnUrl = '/settings';
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const kokugo = useKokugoOverview(profile?.id);
    const ownerId = profile?.id;
    const activityLogs = useLiveQuery(async () => ownerId ? { ownerId, logs: await db.logs.where('[profileId+timestamp]').between(
        [ownerId, addDays(getLearningDayStart(), -29).toISOString()], [ownerId, addDays(getLearningDayStart(), 1).toISOString()], true, false).toArray() } : undefined, [ownerId]);
    const [weakMathIds, setWeakMathIds] = useState<string[]>([]);
    const [weakVocabIds, setWeakVocabIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [retry, setRetry] = useState(0);
    const vocabWordMap = useMemo(
        () => new Map(ENGLISH_WORDS.map(word => [word.id, word])),
        []
    );

    useEffect(() => {
        if (learningOverlay) return;
        let cancelled = false;

        const loadData = async () => {
            try {
                if (!cancelled) {
                    setIsLoading(true);
                    setLoadError(false);
                }
                const active = await getActiveProfile();
                if (cancelled) return;

                setProfile(active);

                if (active?.id) {
                    // Load Weak Points
                    const [weakMath, weakVocab] = await Promise.all([
                        getWeakMathSkillIds(active.id),
                        getWeakVocabIds(active.id),
                    ]);
                    if (cancelled) return;

                    setWeakMathIds(weakMath);
                    setWeakVocabIds(weakVocab);
                } else {
                    setWeakMathIds([]);
                    setWeakVocabIds([]);
                }
            } catch (e) {
                logInDev("ParentsPage: Error loading data", e);
                if (!cancelled) setLoadError(true);
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        void loadData();

        return () => {
            cancelled = true;
        };
    }, [retry, learningOverlay]);

    if (isLoading) {
        return (
            <ScreenScaffold title="保護者" footerSpacing="none" scroll={false}>
                <Spinner fullScreen />
            </ScreenScaffold>
        );
    }

    if (loadError || !profile) {
        return (
            <ScreenScaffold
                title="保護者"
                footerSpacing="base"
                contentClassName="px-[var(--screen-padding-x)]"
            >
                <p role="alert">{loadError ? '学習データを読み込めませんでした。' : '学習データが見つかりません。'}</p>
                <Button onClick={() => setRetry(value => value + 1)}>もう一度読み込む</Button>
            </ScreenScaffold>
        );
    }

    const activities = activityLogs?.ownerId === profile.id && kokugo && !kokugo.error
        ? summarizeActivity(activityLogs.logs, profile.id, '30', new Date(), kokugo.activities) : undefined;
    const today = activities?.daily[0];
    const recentAttempts = profile.recentAttempts?.slice(-5).reverse() ?? [];
    const weakTotal = weakMathIds.length + weakVocabIds.length;

    const getResultBadgeProps = (result: RecentAttempt["result"]) => {
        if (result === "correct") {
            return { variant: "success" as const, label: "正解", className: "" };
        }
        if (result === "skipped") {
            return { variant: "warning" as const, label: "スキップ", className: "" };
        }
        return {
            variant: "neutral" as const,
            label: "不正解",
            className: "border-rose-100 bg-rose-50/95 text-rose-700",
        };
    };

    return (
        <ScreenScaffold
            title="保護者"
            showBack onBack={() => navigate(settingsReturnUrl)}
            containerClassName="parents-screen"
            contentClassName="parents-ledger px-[var(--screen-padding-x)] pt-1 space-y-5"
        >
            <SurfacePanel className="parent-overview" data-parent-candidate="parent-learning-hub-v2">
                <SurfacePanelHeader
                    title={`${profile.name}さんの学び`}
                    description="今の出題範囲と、積み重ねた記録"
                />
                <div className="parent-current-ranges">
                    {(['math', 'vocab'] as const).map(subject => {
                        const level = subject === 'math' ? profile.mathMainLevel : profile.vocabMainLevel;
                        return <div key={subject}><span>{subject === 'math' ? '算数' : '英語'} · Lv{level}</span><strong>{learningLevelTitle(subject, level)}</strong></div>;
                    })}
                    <KokugoLevelSummary profileId={profile.id} compact />
                </div>
                <div className="parent-activity">
                    {activities ? <><span>今日の回答 <strong>{today?.answered ?? 0}問</strong></span><span>この30日の学習 <strong>{activities.activeDays}日</strong></span>
                        <span>今日の国語活動 <strong>読書の保存 {today?.books ?? 0}回・作品の保存 {today?.works ?? 0}回・手本で確認 {today?.practice ?? 0}回</strong></span></>
                        : <p role={kokugo?.error ? 'alert' : 'status'}>{kokugo?.error ? '国語の活動を読みこめませんでした。開き直してください。' : '学習の活動を読みこんでいます…'}</p>}
                </div>
                <p className="parent-purpose">算数・英単語 · {PARENT_REVIEW_COPY.summary(weakTotal)}</p>
            </SurfacePanel>

            <FoundationProgress profileId={profile.id} parent />
                    <KokugoProgressCard profileId={profile.id} parent />
            <SurfacePanel className="parent-actions">
                <details className="parent-details parent-check-entry">
                    <summary><span><ClipboardCheck size={22} aria-hidden="true" /><span><strong>確認テスト（20問）</strong><small>理解の確認に · レベルは変わりません</small></span></span><ChevronDown size={20} aria-hidden="true" /></summary>
                    <ParentAssessment key={profile.id} profile={profile} onUpdate={setProfile} />
                </details>
                <button className="parent-range-action" type="button" onClick={() => navigation ? navigation.open('/settings/curriculum') : navigate('/settings/curriculum')}>
                    <span><SlidersHorizontal size={22} aria-hidden="true" /><span><strong>学習範囲を変更</strong><small>算数・英語の出題内容・難しさを調整</small></span></span><ArrowRight size={20} aria-hidden="true" />
                </button>
            </SurfacePanel>

            <SurfacePanel>
                <details className="parent-details">
                <summary>復習の候補<ChevronDown size={18} aria-hidden="true" /></summary>
                <SurfacePanelHeader
                    title={PARENT_REVIEW_COPY.title}
                    description={PARENT_REVIEW_COPY.description}
                />

                <div className="space-y-3">
                    <InsetPanel className="space-y-3">
                        <SectionLabel className="px-0">算数</SectionLabel>
                        {weakMathIds.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {weakMathIds.map(id => (
                                    <Badge key={id} variant="warning" className="text-sm">
                                        {getParentMathSkillLabel(id)}
                                    </Badge>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-pokomoko-muted">{PARENT_REVIEW_COPY.empty}</div>
                        )}
                    </InsetPanel>

                    <InsetPanel className="space-y-3">
                        <SectionLabel className="px-0">英語</SectionLabel>
                        {weakVocabIds.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {weakVocabIds.map(id => {
                                    const word = vocabWordMap.get(id);
                                    return (
                                        <Badge key={id} variant="warning" className="text-sm">
                                            {getParentVocabWordLabel(id, vocabWordMap)}
                                            {word?.japanese && (
                                                <span className="ml-1 text-[11px] text-amber-700/80">({word.japanese})</span>
                                            )}
                                        </Badge>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-sm text-pokomoko-muted">{PARENT_REVIEW_COPY.empty}</div>
                        )}
                    </InsetPanel>
                </div>
                </details>
            </SurfacePanel>

            <SurfacePanel>
                <details className="parent-details">
                <summary>算数・英単語の学習・確認結果<ChevronDown size={18} aria-hidden="true" /></summary>
                <div className="parent-test-history">
                    <h3>確認テストの記録</h3>
                    {(profile.testHistory ?? []).filter(item => item.kind !== 'finish').slice(-3).reverse().map(item => <InsetPanel key={item.id}>
                        <p>{item.subject === 'math' ? '算数' : '英語'} Lv{item.level} · {item.correctCount} / {item.totalQuestions}問</p>
                        <p className="parent-purpose">{new Date(item.timestamp).toLocaleDateString('ja-JP')} · {item.method === 'paper' ? '紙' : 'アプリ'}</p>
                    </InsetPanel>)}
                    {!(profile.testHistory ?? []).some(item => item.kind !== 'finish') && <p className="parent-purpose">確認テストの記録はまだありません。</p>}
                </div>
                <SurfacePanelHeader
                    title="算数・英単語の学習履歴"
                    description="直近 5 件の回答を ふり返れます"
                />
                {recentAttempts.length > 0 ? (
                    <div className="space-y-2">
                        {recentAttempts.map((log: RecentAttempt) => {
                            const badge = getResultBadgeProps(log.result);
                            const skillLabel = getParentAttemptLabel(log.subject, log.skillId, vocabWordMap);
                            return (
                                <InsetPanel key={log.id}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-[11px] font-bold text-pokomoko-muted">
                                                {new Date(log.timestamp).toLocaleString('ja-JP')}
                                            </div>
                                            <div className="mt-1 font-bold text-slate-700">
                                                {log.subject === 'math' ? 'さんすう' : 'えいご'} / {skillLabel}
                                            </div>
                                        </div>
                                        <Badge
                                            variant={badge.variant}
                                            className={`shrink-0 whitespace-nowrap ${badge.className}`}
                                        >
                                            {badge.label}
                                        </Badge>
                                    </div>
                                </InsetPanel>
                            );
                        })}
                    </div>
                ) : (
                    <InsetPanel className="text-sm text-pokomoko-muted">履歴はありません。</InsetPanel>
                )}
                </details>
            </SurfacePanel>

            <IslandMemorialRecovery key={profile.id} profileId={profile.id} />
            <ParentTools />
        </ScreenScaffold>
    );
};
