import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDays } from "date-fns";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Spinner } from "../components/ui/Spinner";
import { ProgressBar } from "../components/ui/ProgressBar";
import {
    InsetPanel,
    PanelDivider,
    SectionLabel,
    SegmentedControl,
    SettingRow,
    SurfacePanel,
    SurfacePanelHeader,
} from "../components/ui/SurfacePanel";
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
import { getLearningDayEnd, getLearningDayStart, toLocaleDateKey } from "../utils/learningDay";
import { db, AttemptLog } from "../db";
import { UserProfile, PeriodicTestResult } from "../domain/types";
import { warmUpTTS } from "../utils/tts";
import { buildWeeklyTrend, buildRadarData, type RadarCategoryPoint, type WeeklyTrendPoint } from "../domain/stats/aggregation";
import { WeeklyTrendChart } from "../components/charts/WeeklyTrendChart";
import { SkillRadarChart } from "../components/charts/SkillRadarChart";
import { IkimonoGallery } from "../components/ikimono/IkimonoGallery";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { logInDev } from "../utils/debug";

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
    | "tests"
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
    tests: true,
    progress: true,
    parent: true,
};

const SECTION_LABELS: Record<SectionKey, string> = {
    summary: "今日",
    calendar: "週間",
    growth: "成長",
    weak: "苦手",
    review: "復習",
    tests: "テスト",
    progress: "レベル",
    parent: "保護者",
};

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

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
            tests: parsed.tests ?? DEFAULT_SECTIONS.tests,
            parent: parsed.parent ?? DEFAULT_SECTIONS.parent,
        };
    } catch {
        return DEFAULT_SECTIONS;
    }
};

interface MetricTileProps {
    label: string;
    value: React.ReactNode;
    tone?: "default" | "sky" | "mint" | "rose";
}

const metricToneClassMap: Record<NonNullable<MetricTileProps["tone"]>, string> = {
    default: "text-slate-800",
    sky: "text-sky-700",
    mint: "text-emerald-700",
    rose: "text-rose-700",
};

const MetricTile: React.FC<MetricTileProps> = ({ label, value, tone = "default" }) => (
    <InsetPanel className="space-y-1 py-3 text-center">
        <div className={`text-2xl font-black tracking-[-0.03em] ${metricToneClassMap[tone]}`}>{value}</div>
        <div className="text-[11px] font-bold tracking-[0.08em] text-slate-500">{label}</div>
    </InsetPanel>
);

interface SectionToggleButtonProps {
    active: boolean;
    children: React.ReactNode;
    onClick: () => void;
}

const SectionToggleButton: React.FC<SectionToggleButtonProps> = ({ active, children, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`app-pill rounded-full px-3 py-1.5 text-xs font-black tracking-[0.08em] transition-colors ${
            active
                ? "border-cyan-100/90 bg-cyan-50/88 text-cyan-700"
                : "border-white/80 bg-white/68 text-slate-500"
        }`}
    >
        {children}
    </button>
);

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
    const [radarData, setRadarData] = useState<RadarCategoryPoint[]>([]);
    const [trendData, setTrendData] = useState<WeeklyTrendPoint[]>([]);
    const [trendMode, setTrendMode] = useState<"count" | "accuracy">("count");
    const [sections, setSections] = useState<SectionState>(() => loadSectionState());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(sections));
    }, [sections]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const active = await getActiveProfile();
                if (!active || cancelled) {
                    return;
                }

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

                if (cancelled) {
                    return;
                }

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
                    const key = toLocaleDateKey(getLearningDayStart(new Date(log.timestamp)));
                    const current = logsByDay.get(key) || [];
                    current.push(log);
                    logsByDay.set(key, current);
                }

                const currentWeek: WeeklyDay[] = [];
                for (let offset = 6; offset >= 0; offset--) {
                    const day = addDays(todayStart, -offset);
                    const key = toLocaleDateKey(day);
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
                    const key = toLocaleDateKey(day);
                    previousWeekCount += logsByDay.get(key)?.length || 0;
                }
                const thisWeekCount = currentWeek.reduce((acc, day) => acc + day.count, 0);

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

                if (cancelled) {
                    return;
                }

                setProfile(active);
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
                setRadarData(buildRadarData(mathMemory, active.mathMaxUnlocked || active.mathMainLevel || 1));
                setTrendData(buildWeeklyTrend(logsForCalendar, todayStart, addDays));
                setEventCheckPending(
                    (active.periodicTestState?.math?.isPending ?? false) ||
                    (active.periodicTestState?.vocab?.isPending ?? false) ||
                    localStorage.getItem("sansu_event_check_pending") === "1"
                );
            } catch (error) {
                logInDev("Stats: failed to load stats", error);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
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
    const periodicTestHistory = useMemo<PeriodicTestResult[]>(() => {
        return [...(profile?.testHistory || [])]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 10);
    }, [profile?.testHistory]);

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
    const closeAction = (
        <Button variant="secondary" size="sm" onClick={() => navigate("/")}>
            <Icons.Close className="w-6 h-6" />
        </Button>
    );

    if (loading) {
        return <Spinner fullScreen />;
    }

    if (!profile) {
        return (
            <ScreenScaffold
                title={t("きろく", "記録")}
                rightAction={closeAction}
                footerSpacing="base"
                contentClassName="px-[var(--screen-padding-x)]"
            >
                プロフィールが見つかりません。
            </ScreenScaffold>
        );
    }

    return (
        <ScreenScaffold
            title={t("きろく", "記録")}
            rightAction={closeAction}
            contentClassName="px-[var(--screen-padding-x)] pt-1 space-y-6"
        >
            <SurfacePanel variant="flat" className="space-y-4 border-t-[3px] border-t-cyan-300/80">
                <SurfacePanelHeader
                    title={t("ひょうじ する ないよう", "表示する内容")}
                    description={t("みたい ぶぶん だけ えらべる", "見たいカードだけに絞れます")}
                />
                <div className="flex flex-wrap gap-2">
                    {(Object.keys(sections) as SectionKey[]).map(key => (
                        <SectionToggleButton
                            key={key}
                            active={sections[key]}
                            onClick={() => toggleSection(key)}
                        >
                            {SECTION_LABELS[key]}
                        </SectionToggleButton>
                    ))}
                </div>
            </SurfacePanel>

            {sections.summary && (
                <SurfacePanel className="border-t-[3px] border-t-cyan-300/75">
                    <SurfacePanelHeader
                        title="きょう の まとめ"
                        description={t("いちにち の まなび を 4つで ふりかえる", "今日の学習をざっくり振り返る")}
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <MetricTile label="かいとう" value={todayStats.count} tone="sky" />
                        <MetricTile label="せいかいりつ" value={`${todayAccuracy}%`} tone="mint" />
                        <MetricTile label="ふん" value={todayMinutes} />
                        <MetricTile label="れんぞくにち" value={profile.streak || 0} tone="rose" />
                    </div>
                </SurfacePanel>
            )}

            {sections.calendar && (
                <SurfacePanel className="border-t-[3px] border-t-sky-200/80">
                    <SurfacePanelHeader
                        title="1しゅうかん カレンダー"
                        description={t("ひび の ペース が ひとめで わかる", "1週間の学習量を色で確認")}
                    />
                    <div className="grid grid-cols-7 gap-2">
                        {weeklyDays.map(day => {
                            const tone =
                                day.count === 0 ? "border-white/80 bg-white/66 text-slate-400" :
                                    day.count < 10 ? "border-cyan-100/90 bg-cyan-50/82 text-cyan-700" :
                                        day.count < 25 ? "border-sky-100/90 bg-sky-100/84 text-sky-800" :
                                            "border-sky-200/90 bg-[linear-gradient(180deg,rgba(125,211,252,0.9),rgba(224,242,254,0.92))] text-sky-900 shadow-[0_16px_26px_-20px_rgba(14,165,233,0.45)]";

                            return (
                                <div key={day.dateKey} className="text-center">
                                    <div className="mb-1 text-[10px] font-bold text-slate-500">{day.label}</div>
                                    <div className={`flex h-10 items-center justify-center rounded-2xl border text-xs font-black ${tone}`}>
                                        {day.count}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </SurfacePanel>
            )}

            {sections.growth && (
                <SurfacePanel className="border-t-[3px] border-t-emerald-200/80">
                    <SurfacePanelHeader
                        title={t("せいちょう グラフ", "成長グラフ")}
                        description={growthMessage}
                    />
                    <WeeklyTrendChart data={trendData} mode={trendMode} />
                    <SegmentedControl
                        className="mx-auto max-w-xs"
                        value={trendMode}
                        onChange={setTrendMode}
                        options={[
                            { value: "count", label: "かいとう" },
                            { value: "accuracy", label: "せいかいりつ" },
                        ]}
                    />

                    {stableSkills.length > 0 && (
                        <>
                            <PanelDivider />
                            <SectionLabel className="px-0">{t("できるように なったこと", "できるようになったこと")}</SectionLabel>
                            <div className="space-y-2">
                                {stableSkills.slice(0, 3).map(skill => (
                                    <InsetPanel key={`${skill.subject}-${skill.id}`} className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Badge variant={skill.subject === "math" ? "primary" : "success"}>
                                                {skill.subject === "math" ? t("さんすう", "算数") : t("えいご", "英語")}
                                            </Badge>
                                            <div className="font-bold text-slate-800">{skill.label}</div>
                                        </div>
                                        <div className="text-[11px] text-slate-500">
                                            つよさ {skill.strength} / かいとう {skill.totalAnswers}かい
                                        </div>
                                    </InsetPanel>
                                ))}
                            </div>
                        </>
                    )}
                </SurfacePanel>
            )}

            {sections.weak && (
                <SurfacePanel className="border-t-[3px] border-t-amber-200/80">
                    <SurfacePanelHeader
                        title="まちがい ぶんせき"
                        description={weakPatternMessage}
                    />
                    <div className="space-y-2">
                        {weakTop3.length > 0 ? weakTop3.map((item, idx) => (
                            <InsetPanel key={`${item.id}-weak-${idx}`} className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-bold text-slate-700">{getLabel(item.id, item.subject)}</div>
                                    <div className="text-xs text-slate-500">
                                        せいかいりつ: {Math.round(item.accuracy * 100)}% ・ さいしゅう: {formatDate(item.lastCorrectAt)}
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-10 shrink-0 text-sm"
                                    onClick={() => { warmUpTTS(); navigate(`/study?session=weak&focus_subject=${item.subject}&focus_ids=${item.id}`); }}
                                >
                                    これだけ
                                </Button>
                            </InsetPanel>
                        )) : (
                            <InsetPanel className="text-xs text-slate-500">いまは とくに にがて なし。</InsetPanel>
                        )}
                    </div>
                </SurfacePanel>
            )}

            {sections.review && (
                <SurfacePanel className="border-t-[3px] border-t-cyan-200/80">
                    <SurfacePanelHeader
                        title="ふくしゅう キュー"
                        description={t(`きょう やるべき ふくしゅう: ${reviewCount}けん`, `今日やるべき復習: ${reviewCount}件`)}
                        action={(
                            <Button
                                size="sm"
                                className="h-10 text-sm"
                                onClick={() => { warmUpTTS(); navigate("/study?session=review&force_review=1"); }}
                            >
                                {t("まとめて やる", "まとめて学習")}
                            </Button>
                        )}
                    />

                    <InsetPanel className="flex items-center justify-between gap-3 border-cyan-100/90 bg-cyan-50/72">
                        <div>
                            <div className="font-bold text-cyan-800">{t("テストの じゅんび (10もん)", "テスト準備 (10問)")}</div>
                            <div className="mt-1 text-xs text-cyan-700">{t("にがてを さきに かためる", "苦手を先に固める")}</div>
                        </div>
                        <Button
                            size="sm"
                            className="h-10 text-sm border-cyan-100/90 bg-white/84 text-cyan-700 hover:bg-white"
                            onClick={() => { warmUpTTS(); navigate("/study?session=weak-review"); }}
                        >
                            {t("やる", "開始")}
                        </Button>
                    </InsetPanel>

                    {reviewItems.length > 0 && (
                        <div className="space-y-2">
                            {reviewItems.map((item, idx) => (
                                <InsetPanel key={`${item.id}-review-${idx}`} className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="font-bold text-slate-700">{getLabel(item.id, item.subject)}</div>
                                        <div className="text-xs text-slate-400">{t("さいしゅう", "最終")}: {formatDate(item.lastCorrectAt)}</div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-10 shrink-0 text-sm"
                                        onClick={() => { warmUpTTS(); navigate(`/study?session=review&focus_subject=${item.subject}&focus_ids=${item.id}&force_review=1`); }}
                                    >
                                        {t("やる", "開始")}
                                    </Button>
                                </InsetPanel>
                            ))}
                        </div>
                    )}

                    {eventCheckPending && (
                        <InsetPanel className="flex items-center justify-between gap-3 border-amber-100/90 bg-amber-50/72">
                            <div>
                                <div className="font-bold text-slate-700">{t("✨ ていき テスト (20もん)", "✨ 定期テスト (20問)")}</div>
                                <div className="text-xs text-amber-700">{t("がっこう テスト まえ の かくにん", "学校テスト前の確認")}</div>
                            </div>
                            <Button
                                size="sm"
                                variant="primary"
                                className="h-10 shrink-0 text-sm"
                                onClick={() => {
                                    localStorage.removeItem("sansu_event_check_pending");
                                    setEventCheckPending(false);
                                    warmUpTTS();
                                    navigate("/study?session=periodic-test");
                                }}
                            >
                                {t("ちょうせん", "挑戦")}
                            </Button>
                        </InsetPanel>
                    )}
                </SurfacePanel>
            )}

            {sections.progress && (
                <SurfacePanel className="border-t-[3px] border-t-emerald-200/80">
                    <SurfacePanelHeader
                        title={t("スキル マップ", "スキルマップ")}
                        description={t("できる はんい と つぎの レベル を みる", "現在地と次のレベルを確認")}
                    />

                    {radarData.some(d => d.skillCount > 0) ? (
                        <SkillRadarChart data={radarData} />
                    ) : (
                        <InsetPanel className="text-xs text-slate-500">
                            {t("さんすう を やると マップが みれるよ。", "算数を学習するとマップが表示されます。")}
                        </InsetPanel>
                    )}

                    <PanelDivider />
                    <SectionLabel className="px-0">{t("レベル しんちょく", "レベル進捗")}</SectionLabel>
                    <div className="space-y-3">
                        <InsetPanel>
                            <div className="text-sm font-bold text-slate-700">
                                さんすう Lv{profile.mathMainLevel} / かいほう Lv{profile.mathMaxUnlocked}
                            </div>
                            <ProgressBar
                                className="mt-2 h-2.5"
                                value={mathRecent.length}
                                max={20}
                                tone="success"
                            />
                            <div className="mt-1 text-[11px] text-slate-500">
                                さいきん: {mathRecentCorrect}/{mathRecent.length || 0}せいかい ・ つぎ Lv{Math.min(profile.mathMainLevel + 1, maxMathLevel)}
                            </div>
                        </InsetPanel>

                        <InsetPanel>
                            <div className="text-sm font-bold text-slate-700">
                                {t("えいたんご", "英単語")} Lv{profile.vocabMainLevel} / {t("かいほう", "解放")} Lv{profile.vocabMaxUnlocked}
                            </div>
                            <ProgressBar
                                className="mt-2 h-2.5"
                                value={vocabRecent.length}
                                max={20}
                                tone="primary"
                            />
                            <div className="mt-1 text-[11px] text-slate-500">
                                さいきん: {vocabRecentCorrect}/{vocabRecent.length || 0}せいかい ・ つぎ Lv{Math.min(profile.vocabMainLevel + 1, maxVocabLevel)}
                            </div>
                        </InsetPanel>
                    </div>
                </SurfacePanel>
            )}

            {sections.tests && (
                <SurfacePanel className="border-t-[3px] border-t-amber-200/80">
                    <SurfacePanelHeader
                        title={t("ていき テスト りれき", "定期テスト履歴")}
                        description={t("さいきん の テストけっか を のこしておく", "最近のテスト結果を確認")}
                    />
                    {periodicTestHistory.length === 0 ? (
                        <InsetPanel className="text-xs text-slate-500">{t("まだ きろく が ないよ", "まだ記録がありません")}</InsetPanel>
                    ) : (
                        <div className="space-y-2">
                            {periodicTestHistory.map((test) => (
                                <InsetPanel key={test.id} className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold text-slate-700">
                                            {test.subject === "math" ? t("さんすう", "算数") : t("えいご", "英語")} Lv.{test.level}
                                        </div>
                                        <div className="mt-0.5 text-[11px] text-slate-500">
                                            {new Date(test.timestamp).toLocaleString("ja-JP")} / {test.method === "paper" ? t("かみ", "紙") : t("アプリ", "アプリ")}
                                        </div>
                                        <div className="mt-0.5 text-[11px] text-slate-500">
                                            {t("じかん", "時間")}: {Math.floor(test.durationSeconds / 60)}:{String(test.durationSeconds % 60).padStart(2, "0")}
                                            {typeof test.timeLimitSeconds === "number" && (
                                                <> / {t("せいげん", "制限")}: {Math.floor(test.timeLimitSeconds / 60)}:{String(test.timeLimitSeconds % 60).padStart(2, "0")}</>
                                            )}
                                            {test.timedOut ? ` / ${t("じかんぎれ", "時間切れ")}` : ""}
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <div className="text-lg font-black text-indigo-600">{test.score}{t("てん", "点")}</div>
                                        <div className="text-[11px] text-slate-500">{test.correctCount}/{test.totalQuestions}</div>
                                    </div>
                                </InsetPanel>
                            ))}
                        </div>
                    )}
                </SurfacePanel>
            )}

            <SurfacePanel>
                <SurfacePanelHeader
                    title="ふわふわ アルバム"
                    description={t("いままで の ふわふわ を ふりかえる", "成長の記録を静かに見返せます")}
                />
                <IkimonoGallery profileId={profile.id} />
            </SurfacePanel>

            {sections.parent && (
                <SurfacePanel className="border-t-[3px] border-t-slate-200/90">
                    <SurfacePanelHeader
                        title={t("ほごしゃ むけ ミニレポート", "保護者向けミニレポート")}
                        description={t("おとな が みる とき の ざっくり まとめ", "大人向けの簡易な振り返り")}
                    />
                    <div className="space-y-3 text-sm text-slate-700">
                        <SettingRow
                            title="こんしゅう の がくしゅうじかん"
                            action={<span className="font-bold">{weekMinutes}ふん</span>}
                        />
                        <SettingRow
                            title="ぜんたい かいとうすう"
                            action={<span className="font-bold">{totalStats.count}かい</span>}
                        />
                        <InsetPanel className="space-y-2">
                            <div className="text-xs font-bold tracking-[0.12em] text-slate-500">にがて たんげん</div>
                            {weakTop3.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {weakTop3.slice(0, 2).map(item => (
                                        <Badge key={`parent-${item.subject}-${item.id}`} variant="warning">
                                            {getLabel(item.id, item.subject)}
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-xs text-slate-500">とくに なし</div>
                            )}
                        </InsetPanel>
                        <InsetPanel className="text-xs leading-6 text-slate-600">
                            こえかけ例: 「きょう は どこ が いちばん できるように なった？」
                        </InsetPanel>
                    </div>
                </SurfacePanel>
            )}
        </ScreenScaffold>
    );
};
