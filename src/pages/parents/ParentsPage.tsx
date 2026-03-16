import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getWeakMathSkillIds, getWeakVocabIds } from '../../domain/learningRepository';
import { ENGLISH_WORDS } from '../../domain/english/words';
import type { RecentAttempt, UserProfile } from '../../domain/types';
import { getActiveProfile } from '../../domain/user/repository';
import { ParentGateModal } from '../../components/gate/ParentGateModal';
import { Spinner } from '../../components/ui/Spinner';
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

    return (
        <ScreenScaffold
            title="保護者メニュー"
            contentClassName="px-[var(--screen-padding-x)] pt-1 space-y-6"
        >

                {/* 1. Summary Section */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-slate-50 flex flex-col items-center justify-center">
                        <div className="text-xs text-text-sub font-bold mb-1">連続学習</div>
                        <div className="text-2xl font-black text-primary">{profile.streak || 0}<span className="text-sm font-bold text-text-sub ml-1">日</span></div>
                    </div>
                    <div className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-slate-50 flex flex-col items-center justify-center">
                        <div className="text-xs text-text-sub font-bold mb-1">本日の学習</div>
                        <div className="text-2xl font-black text-primary">{profile.todayCount || 0}<span className="text-sm font-bold text-text-sub ml-1">回</span></div>
                    </div>
                </div>

                {/* 2. Weak Points Section */}
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
                    <h2 className="text-lg font-bold mb-4 text-text-main">苦手な問題</h2>

                    <div className="mb-4">
                        <h3 className="text-sm font-bold text-text-sub mb-2">算数 (正答率60%未満)</h3>
                        {weakMathIds.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {weakMathIds.map(id => (
                                    <span key={id} className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-sm font-bold border border-red-100">
                                        {id}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <div className="text-text-sub text-sm bg-slate-50 p-3 rounded-xl">現在のところ苦手な問題はありません。</div>
                        )}
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-text-sub mb-2">英語 (正答率60%未満)</h3>
                        {weakVocabIds.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {weakVocabIds.map(id => {
                                    const word = vocabWordMap.get(id);
                                    return (
                                        <span key={id} className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-sm font-bold border border-red-100 flex items-center gap-2">
                                            <span>{id}</span>
                                            <span className="text-xs text-red-400">({word?.japanese || '?'})</span>
                                        </span>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-text-sub text-sm bg-slate-50 p-3 rounded-xl">現在のところ苦手な単語はありません。</div>
                        )}
                    </div>
                </div>

                {/* 3. History Section */}
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
                    <h2 className="text-lg font-bold mb-4 text-text-main">学習履歴 (直近)</h2>
                    <div className="text-sm">
                        {recentAttempts.length > 0 ? (
                            <ul className="space-y-4">
                                {recentAttempts.map((log: RecentAttempt) => (
                                    <li key={log.id} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                                        <div className="flex flex-col">
                                            <span className="text-xs text-text-sub font-bold">{new Date(log.timestamp).toLocaleString('ja-JP')}</span>
                                            <span className="text-text-main font-medium mt-1">{log.subject} / {log.skillId}</span>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                            log.result === 'correct'
                                                ? 'bg-green-100 text-green-700'
                                                : log.result === 'skipped'
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-red-100 text-red-700'
                                        }`}>
                                            {log.result === 'correct' ? '正解' : log.result === 'skipped' ? 'スキップ' : '不正解'}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-text-sub">履歴はありません。</div>
                        )}
                    </div>
                </div>

                <div className="mt-8 text-center pb-8">
                    <button
                        onClick={() => navigate('/settings')}
                        className="px-8 py-3 bg-white text-text-sub border-2 border-slate-100 rounded-full font-bold hover:bg-slate-50 transition-colors"
                    >
                        設定に戻る
                    </button>
                </div>
        </ScreenScaffold>
    );
};
