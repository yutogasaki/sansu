import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDays } from "date-fns";
import { Header } from "../components/Header";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Icons } from "../components/icons";
import { getActiveProfile } from "../domain/user/repository";
import {
    DailyStats,
    TotalStats,
    WeakPoint,
    getTodayStats,
    getTotalStats,
    getWeakPoints,
} from "../domain/stats/repository";
import { getReviewItems } from "../domain/learningRepository";
import { MATH_SKILL_LABELS } from "../domain/math/labels";
import { MATH_CURRICULUM } from "../domain/math/curriculum";
import { getWord } from "../domain/english/words";
import { getLearningDayEnd, getLearningDayStart } from "../utils/learningDay";
import { db, AttemptLog } from "../db";
import { UserProfile } from "../domain/types";

type SubjectType = "math" | "vocab";

interface ReviewItem {
    id: string;
    subject: SubjectType;
    nextReview: string;
    lastCorrectAt?: string;
}

interface WeeklyDay {
    dateKey: string;
    label: string;
    count: number;
    correct: number;
    minutes: number;
}

interface StableSkill {
    id: string;
    subject: SubjectType;
    label: string;
    strength: number;
    totalAnswers: number;
    lastCorrectAt?: string;
}

type SectionKey =
    | "summary"
    | "calendar"
    | "growth"
    | "weak"
    | "review"
    | "progress"
    | "parent";

type SectionState = Record<SectionKey, boolean>;

const SECTION_STORAGE_KEY = "sansu_stats_sections_v1";

const DEFAULT_SECTIONS: SectionState = {
    summary: true,
    calendar: true,
    growth: true,
    weak: true,
    review: true,
    progress: true,
    parent: true,
};

const SECTION_LABELS: Record<SectionKey, string> = {
    summary: "今日",
    calendar: "週間",
    growth: "成長",
    weak: "苦手",
    review: "復習",
    progress: "レベル",
    parent: "保護者",
};

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

const toDateKeyLocal = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

const toLearningDateKey = (date: Date): string => {
    return toDateKeyLocal(getLearningDayStart(date));
};

const estimateSessionMinutes = (startMs: number, endMs: number, count: number): number => {
    const activeMs = Math.max(0, endMs - startMs);
    const countBaseMs = count * 25000;
    const withThinkingMs = activeMs + count * 10000;
    const sessionMs = Math.min(45 * 60 * 1000, Math.max(countBaseMs, withThinkingMs));
    return sessionMs / (1000 * 60);
};

const estimateMinutesFromLogs = (logs: AttemptLog[]): number => {
    if (logs.length === 0) return 0;

    const sorted = [...logs].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const maxGapMs = 20 * 60 * 1000;

    let minutes = 0;
    let sessionStart = new Date(sorted[0].timestamp).getTime();
    let sessionPrev = sessionStart;
    let sessionCount = 1;

    for (let i = 1; i < sorted.length; i++) {
        const currentMs = new Date(sorted[i].timestamp).getTime();
        const gapMs = currentMs - sessionPrev;

        if (gapMs <= maxGapMs) {
            sessionPrev = currentMs;
            sessionCount += 1;
        } else {
            minutes += estimateSessionMinutes(sessionStart, sessionPrev, sessionCount);
            sessionStart = currentMs;
            sessionPrev = currentMs;
            sessionCount = 1;
        }
    }

    minutes += estimateSessionMinutes(sessionStart, sessionPrev, sessionCount);
    return Math.round(minutes);
};

const buildGrowthMessage = (thisWeekCount: number, prevWeekCount: number): string => {
    if (thisWeekCount === 0) return "まずは きょう 1もん から はじめよう。";
    if (prevWeekCount === 0) return "こんしゅう は あたらしく スタート できてるよ。";

    const diff = thisWeekCount - prevWeekCount;
    if (diff > 0) return `せんしゅう より ${diff}もん ふえたよ。`;
    if (diff < 0) return `せんしゅう より ${Math.abs(diff)}もん すくない。ペースを とりもどそう。`;
    return "せんしゅう と おなじ ペースで がんばれてる。";
};

const buildWeakPatternMessage = (logs: AttemptLog[]): string => {
    const recent = [...logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 100);
    const mistakes = recent.filter(l => l.result !== "correct");
    if (mistakes.length === 0) return "さいきん は ミスが ほとんど ないよ。";

    const skipped = mistakes.filter(l => l.skipped === true || l.result === "skipped").length;
    const reviewMistakes = mistakes.filter(l => l.isReview && l.result !== "correct").length;
    const firstTryMistakes = mistakes.filter(l => !l.isReview && l.result !== "correct").length;

    if (skipped >= reviewMistakes && skipped >= firstTryMistakes) {
        return "とばした もんだい が おおめ。むずかしい とき は 1だん かんたんに。";
    }
    if (reviewMistakes >= firstTryMistakes) {
        return "ふくしゅう での ミスが おおい。まず ふくしゅう を さきに やろう。";
    }
    return "あたらしい もんだい での ミスが おおい。ていねい に 1もんずつ。";
};

const formatDate = (iso?: string) => {
    if (!iso) return "ー";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "ー";
    return d.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
};

const getLabel = (id: string, subject: SubjectType): string => {
    if (subject === "math") return MATH_SKILL_LABELS[id] || id;
    const word = getWord(id);
    return word?.id || id;
};

const loadSectionState = (): SectionState => {
    try {
        const raw = localStorage.getItem(SECTION_STORAGE_KEY);
        if (!raw) return DEFAULT_SECTIONS;
        const parsed = JSON.parse(raw) as Partial<SectionState>;
        return {
            summary: parsed.summary ?? DEFAULT_SECTIONS.summary,
            calendar: parsed.calendar ?? DEFAULT_SECTIONS.calendar,
            growth: parsed.growth ?? DEFAULT_SECTIONS.growth,
            weak: parsed.weak ?? DEFAULT_SECTIONS.weak,
            review: parsed.review ?? DEFAULT_SECTIONS.review,
            progress: parsed.progress ?? DEFAULT_SECTIONS.progress,
            parent: parsed.parent ?? DEFAULT_SECTIONS.parent,
        };
    } catch {
        return DEFAULT_SECTIONS;
    }
};

export const Stats: React.FC = () => {
    const navigate = useNavigate();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [todayStats, setTodayStats] = useState<DailyStats>({ count: 0, correct: 0 });
    const [totalStats, setTotalStats] = useState<TotalStats>({ count: 0, correct: 0 });
    const [weakPoints, setWeakPoints] = useState<WeakPoint[]>([]);
    const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
    const [reviewCount, setReviewCount] = useState(0);
    const [eventCheckPending, setEventCheckPending] = useState(false);
    const [weeklyDays, setWeeklyDays] = useState<WeeklyDay[]>([]);
    const [todayMinutes, setTodayMinutes] = useState(0);
    const [growthMessage, setGrowthMessage] = useState("");
    const [weakPatternMessage, setWeakPatternMessage] = useState("");
    const [stableSkills, setStableSkills] = useState<StableSkill[]>([]);
    const [sections, setSections] = useState<SectionState>(() => loadSectionState());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(sections));
    }, [sections]);

    useEffect(() => {
        const load = async () => {
            const active = await getActiveProfile();
            if (!active) {
                setLoading(false);
                return;
            }
            setProfile(active);
            const todayStart = getLearningDayStart();
            const twoWeeksAgoStartIso = addDays(todayStart, -13).toISOString();
            const todayEndIso = getLearningDayEnd(todayStart).toISOString();

            const [daily, total, weak, mathReviews, vocabReviews, logsForCalendar, recentLogs, mathMemory, vocabMemory] = await Promise.all([
                getTodayStats(active.id),
                getTotalStats(active.id),
                getWeakPoints(active.id),
                getReviewItems(active.id, "math"),
                getReviewItems(active.id, "vocab"),
                db.logs.where("[profileId+timestamp]").between([active.id, twoWeeksAgoStartIso], [active.id, todayEndIso]).toArray(),
                db.logs.where("profileId").equals(active.id).reverse().limit(100).toArray(),
                db.memoryMath.where("profileId").equals(active.id).toArray(),
                db.memoryVocab.where("profileId").equals(active.id).toArray(),
            ]);

            const allReviews = [
                ...mathReviews.map(item => ({
                    id: item.id,
                    subject: "math" as const,
                    nextReview: item.nextReview,
                    lastCorrectAt: item.lastCorrectAt,
                })),
                ...vocabReviews.map(item => ({
                    id: item.id,
                    subject: "vocab" as const,
                    nextReview: item.nextReview,
                    lastCorrectAt: item.lastCorrectAt,
                })),
            ]
                .sort((a, b) => a.nextReview.localeCompare(b.nextReview))
                .slice(0, 3);

            const logsByDay = new Map<string, AttemptLog[]>();
            for (const log of logsForCalendar) {
                const key = toLearningDateKey(new Date(log.timestamp));
                const current = logsByDay.get(key) || [];
                current.push(log);
                logsByDay.set(key, current);
            }

            const currentWeek: WeeklyDay[] = [];
            for (let offset = 6; offset >= 0; offset--) {
                const day = addDays(todayStart, -offset);
                const key = toDateKeyLocal(day);
                const dayLogs = logsByDay.get(key) || [];
                currentWeek.push({
                    dateKey: key,
                    label: WEEKDAY_JA[day.getDay()],
                    count: dayLogs.length,
                    correct: dayLogs.filter(l => l.result === "correct").length,
                    minutes: estimateMinutesFromLogs(dayLogs),
                });
            }

            let previousWeekCount = 0;
            for (let idx = 0; idx < 7; idx++) {
                const day = addDays(todayStart, -(idx + 7));
                const key = toDateKeyLocal(day);
                previousWeekCount += logsByDay.get(key)?.length || 0;
            }
            const thisWeekCount = currentWeek.reduce((acc, d) => acc + d.count, 0);

            const fourteenDaysAgo = addDays(todayStart, -14).getTime();
            const stableMath = mathMemory
                .filter(item => item.strength >= 4 && item.totalAnswers >= 10)
                .filter(item => (item.lastCorrectAt ? new Date(item.lastCorrectAt).getTime() >= fourteenDaysAgo : false))
                .map(item => ({
                    id: item.id,
                    subject: "math" as const,
                    label: getLabel(item.id, "math"),
                    strength: item.strength,
                    totalAnswers: item.totalAnswers,
                    lastCorrectAt: item.lastCorrectAt,
                }));
            const stableVocab = vocabMemory
                .filter(item => item.strength >= 4 && item.totalAnswers >= 10)
                .filter(item => (item.lastCorrectAt ? new Date(item.lastCorrectAt).getTime() >= fourteenDaysAgo : false))
                .map(item => ({
                    id: item.id,
                    subject: "vocab" as const,
                    label: getLabel(item.id, "vocab"),
                    strength: item.strength,
                    totalAnswers: item.totalAnswers,
                    lastCorrectAt: item.lastCorrectAt,
                }));

            const stableCombined = [...stableMath, ...stableVocab]
                .sort((a, b) => (b.lastCorrectAt || "").localeCompare(a.lastCorrectAt || ""))
                .slice(0, 5);

            setTodayStats(daily);
            setTotalStats(total);
            setWeakPoints(weak);
            setReviewItems(allReviews);
            setReviewCount(mathReviews.length + vocabReviews.length);
            setWeeklyDays(currentWeek);
            setTodayMinutes(currentWeek[currentWeek.length - 1]?.minutes || 0);
            setGrowthMessage(buildGrowthMessage(thisWeekCount, previousWeekCount));
            setWeakPatternMessage(buildWeakPatternMessage(recentLogs));
            setStableSkills(stableCombined);
            setEventCheckPending(
                (active.periodicTestState?.math?.isPending ?? false) ||
                (active.periodicTestState?.vocab?.isPending ?? false) ||
                localStorage.getItem("sansu_event_check_pending") === "1"
            );
            setLoading(false);
        };

        load();
    }, []);

    const toggleSection = (key: SectionKey) => {
        setSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const todayAccuracy = todayStats.count > 0 ? Math.round((todayStats.correct / todayStats.count) * 100) : 0;
    const weekMinutes = weeklyDays.reduce((acc, day) => acc + day.minutes, 0);
    const weakTop3 = useMemo(
        () => [...weakPoints].sort((a, b) => a.accuracy - b.accuracy).slice(0, 3),
        [weakPoints]
    );

    const maxMathLevel = Object.keys(MATH_CURRICULUM).length;
    const maxVocabLevel = 20;
    const isEasy = profile?.uiTextMode === "easy";
    const t = (easy: string, standard: string) => (isEasy ? easy : standard);
    const mathLevelState = profile?.mathLevels?.find(l => l.level === profile.mathMainLevel);
    const vocabLevelState = profile?.vocabLevels?.find(l => l.level === profile.vocabMainLevel);
    const mathRecent = mathLevelState?.recentAnswersNonReview || [];
    const vocabRecent = vocabLevelState?.recentAnswersNonReview || [];
    const mathRecentCorrect = mathRecent.filter(Boolean).length;
    const vocabRecentCorrect = vocabRecent.filter(Boolean).length;

    if (loading) {
        return <div className="p-4">Loading...</div>;
    }

    if (!profile) {
        return (
            <div className="flex flex-col h-full bg-slate-50">
                <Header
                    title={t("きろく", "記録")}
                    rightAction={
                        <Button variant="icon" size="sm" onClick={() => navigate("/")}>
                            <Icons.Close className="w-6 h-6" />
                        </Button>
                    }
                />
                <div className="p-4">プロフィールが見つかりません。</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Header
                title={t("きろく", "記録")}
                rightAction={
                    <Button variant="icon" size="sm" onClick={() => navigate("/")}>
                        <Icons.Close className="w-6 h-6" />
                    </Button>
                }
            />

            <div className="flex-1 overflow-y-auto p-4 space-y-4 land:grid land:grid-cols-2 land:gap-4 land:space-y-0">
                <Card className="p-4 land:col-span-2" variant="flat">
                    <div className="text-xs font-bold text-slate-500 mb-3">ひょうじ する ないよう</div>
                    <div className="flex flex-wrap gap-2">
                        {(Object.keys(sections) as SectionKey[]).map(key => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => toggleSection(key)}
                                className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${sections[key]
                                        ? "bg-slate-800 text-white border-slate-800"
                                        : "bg-white text-slate-500 border-slate-200"
                                    }`}
                            >
                                {SECTION_LABELS[key]}
                            </button>
                        ))}
                    </div>
                </Card>

                {sections.summary && (
                    <Card className="p-4 land:col-span-2">
                        <h3 className="font-bold text-slate-700">きょう の まとめ</h3>
                        <div className="grid grid-cols-4 gap-2 mt-3">
                            <div className="text-center bg-slate-100 rounded-2xl p-3">
                                <div className="text-2xl font-black text-slate-800">{todayStats.count}</div>
                                <div className="text-[11px] text-slate-500">かいとう</div>
                            </div>
                            <div className="text-center bg-slate-100 rounded-2xl p-3">
                                <div className="text-2xl font-black text-slate-800">{todayAccuracy}%</div>
                                <div className="text-[11px] text-slate-500">せいかいりつ</div>
                            </div>
                            <div className="text-center bg-slate-100 rounded-2xl p-3">
                                <div className="text-2xl font-black text-slate-800">{todayMinutes}</div>
                                <div className="text-[11px] text-slate-500">ふん</div>
                            </div>
                            <div className="text-center bg-slate-100 rounded-2xl p-3">
                                <div className="text-2xl font-black text-slate-800">{profile.streak || 0}</div>
                                <div className="text-[11px] text-slate-500">れんぞくにち</div>
                            </div>
                        </div>
                    </Card>
                )}

                {sections.calendar && (
                    <Card className="p-4">
                        <h3 className="font-bold text-slate-700">1しゅうかん カレンダー</h3>
                        <div className="grid grid-cols-7 gap-2 mt-3">
                            {weeklyDays.map(day => {
                                const tone =
                                    day.count === 0 ? "bg-slate-100 text-slate-400" :
                                        day.count < 10 ? "bg-sky-100 text-sky-700" :
                                            day.count < 25 ? "bg-sky-300 text-sky-900" :
                                                "bg-sky-500 text-white";
                                return (
                                    <div key={day.dateKey} className="text-center">
                                        <div className="text-[10px] text-slate-500 mb-1">{day.label}</div>
                                        <div className={`h-8 rounded-xl flex items-center justify-center text-xs font-bold ${tone}`}>
                                            {day.count}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                )}

                {sections.growth && (
                    <Card className="p-4">
                        <h3 className="font-bold text-slate-700">できるように なったこと</h3>
                        <p className="text-xs text-slate-500 mt-2">{growthMessage}</p>
                        {stableSkills.length > 0 ? (
                            <div className="mt-3 space-y-2">
                                {stableSkills.slice(0, 3).map(skill => (
                                    <div key={`${skill.subject}-${skill.id}`} className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3">
                                        <div className="font-bold text-emerald-800 text-sm">{skill.label}</div>
                                        <div className="text-[11px] text-emerald-600 mt-1">
                                            つよさ {skill.strength} / かいとう {skill.totalAnswers}かい
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="mt-3 text-xs text-slate-500">まだ こうほ が ないよ。きょうの がくしゅうで ふやそう。</div>
                        )}
                    </Card>
                )}

                {sections.weak && (
                    <Card className="p-4 land:col-span-2">
                        <h3 className="font-bold text-slate-700">まちがい ぶんせき</h3>
                        <p className="text-xs text-slate-500 mt-2">{weakPatternMessage}</p>

                        <div className="mt-3 space-y-2">
                            {weakTop3.length > 0 ? weakTop3.map((item, idx) => (
                                <div key={`${item.id}-weak-${idx}`} className="p-3 rounded-2xl bg-yellow-50 border border-yellow-100 flex justify-between items-center">
                                    <div>
                                        <div className="font-bold text-slate-700">{getLabel(item.id, item.subject)}</div>
                                        <div className="text-xs text-slate-500">
                                            せいかいりつ: {Math.round(item.accuracy * 100)}% ・ さいしゅう: {formatDate(item.lastCorrectAt)}
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-10 text-sm"
                                        onClick={() => navigate(`/study?session=weak&focus_subject=${item.subject}&focus_ids=${item.id}`)}
                                    >
                                        これだけ
                                    </Button>
                                </div>
                            )) : (
                                <div className="text-xs text-slate-500">いまは とくに にがて なし。</div>
                            )}
                        </div>
                    </Card>
                )}

                {sections.review && (
                    <Card className="p-4 land:col-span-2">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-slate-700">ふくしゅう キュー</h3>
                                <div className="text-xs text-slate-500 mt-1">
                                    {t(`きょう やるべき ふくしゅう: ${reviewCount}けん`, `今日やるべき復習: ${reviewCount}件`)}
                                </div>
                            </div>
                            <Button
                                size="sm"
                                className="h-10 text-sm"
                                onClick={() => navigate("/study?session=review&force_review=1")}
                            >
                                {t("まとめて やる", "まとめて学習")}
                            </Button>
                        </div>

                        <Card className="p-3 mt-3 flex justify-between items-center border border-sky-100 bg-sky-50 shadow-sm" variant="flat">
                                <div>
                                <div className="font-bold text-sky-800">{t("テストの じゅんび (10もん)", "テスト準備 (10問)")}</div>
                                <div className="text-xs text-sky-600 mt-1">{t("にがてを さきに かためる", "苦手を先に固める")}</div>
                            </div>
                            <Button
                                size="sm"
                                className="h-10 text-sm bg-white text-sky-700 border border-sky-200 hover:bg-sky-100"
                                onClick={() => navigate("/study?session=weak-review")}
                            >
                                {t("やる", "開始")}
                            </Button>
                        </Card>

                        {reviewItems.length > 0 && (
                            <div className="mt-3 space-y-2">
                                {reviewItems.map((item, idx) => (
                                    <Card key={`${item.id}-review-${idx}`} className="p-3 flex justify-between items-center" variant="flat">
                                        <div>
                                            <div className="font-bold text-slate-700">{getLabel(item.id, item.subject)}</div>
                                            <div className="text-xs text-slate-400">{t("さいしゅう", "最終")}: {formatDate(item.lastCorrectAt)}</div>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="h-10 text-sm"
                                            onClick={() => navigate(`/study?session=review&focus_subject=${item.subject}&focus_ids=${item.id}&force_review=1`)}
                                        >
                                            {t("やる", "開始")}
                                        </Button>
                                    </Card>
                                ))}
                            </div>
                        )}

                        {eventCheckPending && (
                            <Card className="p-3 mt-3 flex justify-between items-center border border-indigo-200 bg-indigo-50/50" variant="flat">
                                <div>
                                    <div className="font-bold text-slate-700">{t("✨ ていき テスト (20もん)", "✨ 定期テスト (20問)")}</div>
                                    <div className="text-xs text-slate-500">{t("がっこう テスト まえ の かくにん", "学校テスト前の確認")}</div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="primary"
                                    className="h-10 text-sm"
                                    onClick={() => {
                                        localStorage.removeItem("sansu_event_check_pending");
                                        setEventCheckPending(false);
                                        navigate("/study?session=periodic-test");
                                    }}
                                >
                                    {t("ちょうせん", "挑戦")}
                                </Button>
                            </Card>
                        )}
                    </Card>
                )}

                {sections.progress && (
                    <Card className="p-4">
                        <h3 className="font-bold text-slate-700">{t("レベル しんちょく", "レベル進捗")}</h3>

                        <div className="mt-3 p-3 rounded-2xl bg-slate-100">
                            <div className="text-sm font-bold text-slate-700">
                                さんすう Lv{profile.mathMainLevel} / かいほう Lv{profile.mathMaxUnlocked}
                            </div>
                            <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                                <div className="h-full bg-emerald-500" style={{ width: `${Math.min((mathRecent.length / 20) * 100, 100)}%` }} />
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                                さいきん: {mathRecentCorrect}/{mathRecent.length || 0}せいかい ・ つぎ Lv{Math.min(profile.mathMainLevel + 1, maxMathLevel)}
                            </div>
                        </div>

                        <div className="mt-3 p-3 rounded-2xl bg-slate-100">
                            <div className="text-sm font-bold text-slate-700">
                                {t("えいたんご", "英単語")} Lv{profile.vocabMainLevel} / {t("かいほう", "解放")} Lv{profile.vocabMaxUnlocked}
                            </div>
                            <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                                <div className="h-full bg-sky-500" style={{ width: `${Math.min((vocabRecent.length / 20) * 100, 100)}%` }} />
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                                さいきん: {vocabRecentCorrect}/{vocabRecent.length || 0}せいかい ・ つぎ Lv{Math.min(profile.vocabMainLevel + 1, maxVocabLevel)}
                            </div>
                        </div>
                    </Card>
                )}

                {sections.parent && (
                    <Card className="p-4">
                        <h3 className="font-bold text-slate-700">{t("ほごしゃ むけ ミニレポート", "保護者向けミニレポート")}</h3>
                        <div className="mt-3 space-y-2 text-sm text-slate-700">
                            <div className="flex justify-between">
                                <span className="text-slate-500">こんしゅう の がくしゅうじかん</span>
                                <span className="font-bold">{weekMinutes}ふん</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">ぜんたい かいとうすう</span>
                                <span className="font-bold">{totalStats.count}かい</span>
                            </div>
                            <div>
                                <div className="text-slate-500 text-xs mb-1">にがて たんげん</div>
                                {weakTop3.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {weakTop3.slice(0, 2).map(item => (
                                            <span key={`parent-${item.subject}-${item.id}`} className="px-2 py-1 rounded-full text-xs bg-rose-100 text-rose-700">
                                                {getLabel(item.id, item.subject)}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-500">とくに なし</div>
                                )}
                            </div>
                            <div className="rounded-2xl bg-slate-100 p-3 text-xs text-slate-600">
                                こえかけ例: 「きょう は どこ が いちばん できるように なった？」
                            </div>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
};
