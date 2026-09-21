import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getWeakMathSkillIds, getWeakVocabIds } from '../../domain/learningRepository';
import { ENGLISH_WORDS } from '../../domain/english/words';
import type { RecentAttempt, UserProfile } from '../../domain/types';
import { getActiveProfile } from '../../domain/user/repository';
import { islandParentUrl } from '../../domain/island/navigation';
import { getParentAttemptLabel, getParentMathSkillLabel, getParentVocabWordLabel } from './parentAttemptLabel';
import { PARENT_REVIEW_COPY } from './parentReviewCopy';
import { ParentGateModal } from '../../components/gate/ParentGateModal';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { InsetPanel, SectionLabel, SurfacePanel, SurfacePanelHeader } from '../../components/ui/SurfacePanel';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import { logInDev } from '../../utils/debug';

type ParentsRouteState = {
    parentGatePassed?: boolean;
};

export const ParentsPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const settingsReturnUrl = islandParentUrl(location.pathname, location.search);
    const routeState = location.state as ParentsRouteState | null;
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [weakMathIds, setWeakMathIds] = useState<string[]>([]);
    const [weakVocabIds, setWeakVocabIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGatePassed, setIsGatePassed] = useState(Boolean(routeState?.parentGatePassed));
    const vocabWordMap = useMemo(
        () => new Map(ENGLISH_WORDS.map(word => [word.id, word])),
        []
    );

    useEffect(() => {
        if (!isGatePassed) {
            setIsLoading(false);
            return;
        }

        let cancelled = false;

        const loadData = async () => {
            try {
                if (!cancelled) {
                    setIsLoading(true);
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
    }, [isGatePassed]);

    if (!isGatePassed) {
        return (
            <ScreenScaffold title="保護者メニュー" footerSpacing="none" scroll={false}>
                <ParentGateModal
                    isOpen
                    onClose={() => navigate(settingsReturnUrl)}
                    onSuccess={() => setIsGatePassed(true)}
                />
            </ScreenScaffold>
        );
    }

    if (isLoading) {
        return (
            <ScreenScaffold title="保護者メニュー" footerSpacing="none" scroll={false}>
                <Spinner fullScreen />
            </ScreenScaffold>
        );
    }

    if (!profile) {
        return (
            <ScreenScaffold
                title="保護者メニュー"
                footerSpacing="base"
                contentClassName="px-[var(--screen-padding-x)]"
            >
                学習データが見つかりません。
            </ScreenScaffold>
        );
    }

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
            title="保護者メニュー"
            contentClassName="px-[var(--screen-padding-x)] pt-1 space-y-5"
        >
            <SurfacePanel>
                <SurfacePanelHeader
                    title={`${profile.name}さん の ようす`}
                    description="いまのペースと 気になるところを ひと目で見られます"
                />
                <div className="grid grid-cols-2 gap-3">
                    <InsetPanel className="space-y-1 py-4 text-center">
                        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-pokomoko-muted">連続学習</div>
                        <div className="text-3xl font-black tracking-[-0.04em] text-slate-800">{profile.streak || 0}</div>
                        <div className="text-xs text-pokomoko-muted">日</div>
                    </InsetPanel>
                    <InsetPanel className="space-y-1 py-4 text-center">
                        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-pokomoko-muted">本日の学習</div>
                        <div className="text-3xl font-black tracking-[-0.04em] text-slate-800">{profile.todayCount || 0}</div>
                        <div className="text-xs text-pokomoko-muted">回</div>
                    </InsetPanel>
                </div>
                <div className="text-center text-xs leading-5 text-pokomoko-muted">
                    {PARENT_REVIEW_COPY.summary(weakTotal)}
                </div>
            </SurfacePanel>

            <SurfacePanel>
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
            </SurfacePanel>

            <SurfacePanel>
                <SurfacePanelHeader
                    title="学習履歴"
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
            </SurfacePanel>

            <div className="pb-8 text-center">
                <Button variant="secondary" className="min-w-[180px]" onClick={() => navigate(settingsReturnUrl)}>
                    設定に戻る
                </Button>
            </div>
        </ScreenScaffold>
    );
};
