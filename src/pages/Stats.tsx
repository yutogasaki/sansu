import React, { useState, useEffect } from "react";
import { Header } from "../components/Header";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Icons } from "../components/icons";
import { getActiveProfile } from "../domain/user/repository";
import { getTodayStats, getTotalStats, getWeakPoints, DailyStats, WeakPoint } from "../domain/stats/repository";
import { getReviewItems } from "../domain/learningRepository";
import { MATH_SKILL_LABELS } from "../domain/math/labels";
import { getWord } from "../domain/english/words";
import { useNavigate } from "react-router-dom";

export const Stats: React.FC = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<DailyStats>({ count: 0, correct: 0 });
    // const [totalStats, setTotalStats] = useState<TotalStats>({ count: 0, correct: 0 });
    const [weakPoints, setWeakPoints] = useState<WeakPoint[]>([]);
    const [reviewItems, setReviewItems] = useState<{ id: string; subject: 'math' | 'vocab'; nextReview: string; lastCorrectAt?: string }[]>([]);
    const [badgeMessage, setBadgeMessage] = useState<string | null>(null);
    const [eventCheckPending, setEventCheckPending] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const profile = await getActiveProfile();
            if (!profile) return;

            const s = await getTodayStats(profile.id);
            const t = await getTotalStats(profile.id);
            const w = await getWeakPoints(profile.id);
            const mathReviews = await getReviewItems(profile.id, 'math');
            const vocabReviews = await getReviewItems(profile.id, 'vocab');

            const combined = [
                ...mathReviews.map(item => ({ id: item.id, subject: 'math' as const, nextReview: item.nextReview, lastCorrectAt: item.lastCorrectAt })),
                ...vocabReviews.map(item => ({ id: item.id, subject: 'vocab' as const, nextReview: item.nextReview, lastCorrectAt: item.lastCorrectAt }))
            ].slice(0, 3);

            setStats(s);
            // setTotalStats(t);
            setWeakPoints(w);
            setReviewItems(combined);

            const badges: string[] = [];
            if ((profile.streak || 0) >= 3) badges.push(`✨ ${profile.streak}にち つづいたよ`);
            if (t.count >= 100) badges.push("✨ 100もん こたえたよ");
            if (t.count >= 300) badges.push("✨ ここまで これたね");
            setBadgeMessage(badges[0] || null);

            setEventCheckPending(
                (profile.periodicTestState?.math?.isPending ?? false) ||
                (profile.periodicTestState?.vocab?.isPending ?? false) ||
                localStorage.getItem("sansu_event_check_pending") === "1"
            );
            setLoading(false);
        };
        load();
    }, []);

    if (loading) {
        return <div className="p-4">Loading...</div>;
    }

    const formatDate = (iso?: string) => {
        if (!iso) return "ー";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "ー";
        return d.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
    };

    const getWeakLabel = (item: WeakPoint) => {
        if (item.subject === "math") {
            return MATH_SKILL_LABELS[item.id] || item.id;
        }
        const word = getWord(item.id);
        return word?.japanese || item.id;
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Header title="きろく"
                rightAction={
                    <Button variant="icon" size="sm" onClick={() => navigate("/")}>
                        <Icons.Close className="w-6 h-6" />
                    </Button>
                }
            />

            <div className="flex-1 overflow-y-auto p-4 space-y-6 land:grid land:grid-cols-2 land:gap-6 land:space-y-0">

                {/* 1. Summary */}
                <Card className="p-4 space-y-2 land:col-span-2">
                    <h3 className="font-bold text-slate-700">きょう の がんばり</h3>
                    <div className="flex justify-around items-center pt-2">
                        <div className="text-center">
                            <div className="text-3xl font-bold text-slate-800">{stats.count}</div>
                            <div className="text-xs text-slate-400">かい</div>
                        </div>
                        <div className="text-slate-300">|</div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-slate-800">{stats.correct}</div>
                            <div className="text-xs text-slate-400">まる</div>
                        </div>
                    </div>
                </Card>

                {/* 2. Weak Points (Uses new weak-review) */}
                {weakPoints.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="font-bold text-slate-700 ml-2">にがて を なおそう</h3>
                        {weakPoints.map((item, idx) => (
                            <Card key={`${item.id}-weak-${idx}`} className="p-4 flex justify-between items-center bg-yellow-50 border-yellow-100" variant="flat">
                                <div>
                                    <div className="font-bold text-slate-700">{getWeakLabel(item)}</div>
                                    <div className="text-xs text-slate-500">
                                        せいかいりつ: {Math.round(item.accuracy * 100)}% ・ さいしゅう: {formatDate(item.lastCorrectAt)}
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="primary"
                                    className="h-10 text-sm"
                                    onClick={() => navigate(`/study?session=weak&focus_subject=${item.subject}&focus_ids=${item.id}`)}
                                >
                                    これだけ やる
                                </Button>
                            </Card>
                        ))}
                    </div>
                )}

                {/* 3. Review */}
                {reviewItems.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="font-bold text-slate-700 ml-2">ふくしゅう</h3>
                        {reviewItems.map((item, idx) => (
                            <Card key={`${item.id}-review-${idx}`} className="p-4 flex justify-between items-center" variant="flat">
                                <div>
                                    <div className="font-bold text-slate-700">
                                        {item.subject === "math"
                                            ? (MATH_SKILL_LABELS[item.id] || item.id)
                                            : (getWord(item.id)?.japanese || item.id)}
                                    </div>
                                    <div className="text-xs text-slate-400">さいしゅう: {formatDate(item.lastCorrectAt)}</div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-10 text-sm"
                                    onClick={() => navigate(`/study?session=review&focus_subject=${item.subject}&focus_ids=${item.id}&force_review=1`)}
                                >
                                    やってみる
                                </Button>
                            </Card>
                        ))}
                    </div>
                )}

                {/* 4. Periodic Test (Event only) */}
                {eventCheckPending && (
                    <div className="space-y-2 land:col-span-2">
                        <h3 className="font-bold text-slate-700 ml-2">✨ 定期テスト</h3>
                        <Card className="p-4 flex justify-between items-center border border-indigo-200 bg-indigo-50/50">
                            <div>
                                <div className="font-bold text-slate-700">✨ 定期テスト (20もん)</div>
                                <div className="text-xs text-slate-500">学校のテストと おなじだよ</div>
                            </div>
                            <Button
                                size="sm"
                                variant="primary"
                                className="h-10 text-sm"
                                onClick={() => {
                                    // Start session. Completion logic will clear the pending state.
                                    localStorage.removeItem("sansu_event_check_pending"); // Clear legacy flag immediately
                                    setEventCheckPending(false); // Optimistic UI update
                                    navigate(`/study?session=periodic-test`);
                                }}
                            >
                                ちょうせん
                            </Button>
                        </Card>
                    </div>
                )}

                {/* 5. Badge */}
                {badgeMessage && (
                    <div className="p-6 text-center text-slate-500 text-sm land:col-span-2">
                        {badgeMessage}
                    </div>
                )}
            </div>
        </div>
    );
};
