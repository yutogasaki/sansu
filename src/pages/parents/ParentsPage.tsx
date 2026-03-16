import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getWeakMathSkillIds, getWeakVocabIds } from '../../domain/learningRepository';
import { ENGLISH_WORDS } from '../../domain/english/words';
import type { RecentAttempt, UserProfile } from '../../domain/types';
import { getActiveProfile } from '../../domain/user/repository';
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
                    onClose={() => navigate('/settings')}
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
                        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">連続学習</div>
                        <div className="text-3xl font-black tracking-[-0.04em] text-slate-800">{profile.streak || 0}</div>
                        <div className="text-xs text-slate-400">日</div>
                    </InsetPanel>
                    <InsetPanel className="space-y-1 py-4 text-center">
                        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">本日の学習</div>
                        <div className="text-3xl font-black tracking-[-0.04em] text-slate-800">{profile.todayCount || 0}</div>
                        <div className="text-xs text-slate-400">回</div>
                    </InsetPanel>
                </div>
                <div className="text-center text-xs leading-5 text-slate-400">
                    苦手候補: <span className="font-bold text-slate-600">{weakTotal}</span> 件
                </div>
            </SurfacePanel>

            <SurfacePanel>
                <SurfacePanelHeader
                    title="苦手なところ"
                    description="正答率が 60% 未満の項目を まとめています"
                />

                <div className="space-y-3">
                    <InsetPanel className="space-y-3">
                        <SectionLabel className="px-0">算数</SectionLabel>
                        {weakMathIds.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {weakMathIds.map(id => (
                                    <Badge key={id} variant="warning" className="text-sm">
                                        {id}
                                    </Badge>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500">現在のところ苦手な問題はありません。</div>
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
                                            {id}
                                            <span className="ml-1 text-[11px] text-amber-700/80">({word?.japanese || '?'})</span>
                                        </Badge>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500">現在のところ苦手な単語はありません。</div>
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
                            return (
                                <InsetPanel key={log.id}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-[11px] font-bold text-slate-400">
                                                {new Date(log.timestamp).toLocaleString('ja-JP')}
                                            </div>
                                            <div className="mt-1 font-bold text-slate-700">
                                                {log.subject === 'math' ? 'さんすう' : 'えいご'} / {log.skillId}
                                            </div>
                                        </div>
                                        <Badge variant={badge.variant} className={badge.className}>
                                            {badge.label}
                                        </Badge>
                                    </div>
                                </InsetPanel>
                            );
                        })}
                    </div>
                ) : (
                    <InsetPanel className="text-sm text-slate-500">履歴はありません。</InsetPanel>
                )}
            </SurfacePanel>

            <div className="pb-8 text-center">
                <Button variant="secondary" className="min-w-[180px]" onClick={() => navigate('/settings')}>
                    設定に戻る
                </Button>
            </div>
        </ScreenScaffold>
    );
};
