import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/Header';
import { getWeakMathSkillIds } from '../../domain/learningRepository';
import { getActiveProfileId } from '../../domain/user/repository';
import { db } from '../../db';

export const ParentsPage: React.FC = () => {
    const navigate = useNavigate();
    const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
    const [profile, setProfile] = useState<any>(null);
    const [weakMathIds, setWeakMathIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            console.log("ParentsPage: Start loading data");
            try {
                setIsLoading(true);
                const currentProfileId = getActiveProfileId();
                console.log("ParentsPage: currentProfileId", currentProfileId);
                setActiveProfileId(currentProfileId);

                if (currentProfileId) {
                    // Load Profile
                    const p = await db.profiles.get(currentProfileId);
                    console.log("ParentsPage: profile", p);
                    setProfile(p);

                    // Load Weak Points
                    const weakMath = await getWeakMathSkillIds(currentProfileId);
                    console.log("ParentsPage: weakMath", weakMath);
                    setWeakMathIds(weakMath);
                }
            } catch (e) {
                console.error("ParentsPage: Error loading data", e);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    if (isLoading) {
        return (
            <div className="flex flex-col h-full bg-slate-50">
                <Header title="保護者メニュー" />
                <div className="p-4">読み込み中...</div>
            </div>
        );
    }

    if (!activeProfileId || !profile) {
        return (
            <div className="flex flex-col h-full bg-slate-50">
                <Header title="保護者メニュー" />
                <div className="p-4">学習データが見つかりません。</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background">
            <Header title="保護者メニュー" />
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">

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
                        <h3 className="text-sm font-bold text-text-sub mb-2">英語</h3>
                        <div className="text-text-sub text-sm bg-slate-50 p-3 rounded-xl">準備中...</div>
                    </div>
                </div>

                {/* 3. History Section */}
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
                    <h2 className="text-lg font-bold mb-4 text-text-main">学習履歴 (直近)</h2>
                    <div className="text-sm">
                        {profile.recentAttempts && profile.recentAttempts.length > 0 ? (
                            <ul className="space-y-4">
                                {[...profile.recentAttempts].reverse().slice(0, 5).map((log: any, idx: number) => (
                                    <li key={idx} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                                        <div className="flex flex-col">
                                            <span className="text-xs text-text-sub font-bold">{new Date(log.timestamp).toLocaleString('ja-JP')}</span>
                                            <span className="text-text-main font-medium mt-1">{log.subject} / {log.skillId}</span>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${log.result === 'correct' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {log.result === 'correct' ? '正解' : '不正解'}
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
            </div>
        </div>
    );
};
