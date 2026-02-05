import React, { useState } from "react";
import { UserProfile, RecentAttempt, PeriodicTestResult } from "../../domain/types";

interface DevHistoryTabProps {
    profile: UserProfile;
}

export const DevHistoryTab: React.FC<DevHistoryTabProps> = ({ profile }) => {
    const [showCount, setShowCount] = useState(10);

    const recentAttempts = profile.recentAttempts || [];
    const testHistory = profile.testHistory || [];

    const displayedAttempts = recentAttempts.slice(-showCount).reverse();

    const getResultColor = (result: string) => {
        switch (result) {
            case 'correct': return 'text-green-600';
            case 'incorrect': return 'text-red-600';
            case 'skipped': return 'text-slate-400';
            default: return 'text-slate-600';
        }
    };

    return (
        <div className="p-4 space-y-4">
            <h3 className="font-bold text-slate-700">直近回答履歴</h3>
            <p className="text-xs text-slate-500">
                <code>recentAttempts</code> - 最大300件保持
            </p>

            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {displayedAttempts.length === 0 ? (
                    <div className="p-4 text-slate-500 text-sm">履歴がありません</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {displayedAttempts.map((attempt, idx) => (
                            <div key={idx} className="p-2 flex items-center justify-between text-sm">
                                <div className="flex items-center space-x-2">
                                    <span className="text-xs text-slate-400 w-20">
                                        {new Date(attempt.timestamp).toLocaleString('ja-JP', {
                                            month: 'numeric',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded text-xs ${attempt.subject === 'math' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                                        }`}>
                                        {attempt.subject === 'math' ? '算' : '英'}
                                    </span>
                                    <span className="text-slate-700">{attempt.skillId}</span>
                                </div>
                                <span className={`font-medium ${getResultColor(attempt.result)}`}>
                                    {attempt.result === 'correct' ? '○' : attempt.result === 'incorrect' ? '×' : '−'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {recentAttempts.length > showCount && (
                    <button
                        onClick={() => setShowCount(prev => prev + 20)}
                        className="w-full p-2 text-sm text-violet-600 hover:bg-violet-50 border-t border-slate-100"
                    >
                        もっと見る ({recentAttempts.length - showCount}件残り)
                    </button>
                )}
            </div>

            <h3 className="font-bold text-slate-700 pt-4">定期テスト履歴</h3>
            <p className="text-xs text-slate-500">
                <code>testHistory</code>
            </p>

            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {testHistory.length === 0 ? (
                    <div className="p-4 text-slate-500 text-sm">履歴がありません</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {[...testHistory].reverse().map((test, idx) => (
                            <div key={idx} className="p-3 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-slate-700">
                                        {test.subject === 'math' ? '算数' : '英語'} Lv.{test.level}
                                    </span>
                                    <span className="text-lg font-bold text-violet-600">{test.score}点</span>
                                </div>
                                <div className="text-xs text-slate-500 flex justify-between">
                                    <span>
                                        {new Date(test.timestamp).toLocaleDateString('ja-JP')} |
                                        {test.correctCount}/{test.totalQuestions}問正解 |
                                        {Math.floor(test.durationSeconds / 60)}分{test.durationSeconds % 60}秒
                                    </span>
                                    <span className="text-slate-400">{test.mode}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
