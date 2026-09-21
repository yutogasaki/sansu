import type { RadarCategoryPoint, WeeklyTrendPoint } from "../../domain/stats/aggregation";

export type WeeklyTrendMode = "count" | "accuracy";

type WeeklyTrendChartPoint = Omit<WeeklyTrendPoint, "accuracy"> & {
    accuracy: number | null;
};

export const getWeeklyTrendChartData = (
    data: WeeklyTrendPoint[],
    mode: WeeklyTrendMode
): WeeklyTrendChartPoint[] => data.map(point => ({
    ...point,
    accuracy: mode === "accuracy" && point.count === 0 ? null : point.accuracy,
}));

export const getWeeklyTrendChartA11y = (
    data: WeeklyTrendPoint[],
    mode: WeeklyTrendMode
): { title: string; desc: string } => ({
    title: mode === "count" ? "直近7日の回答数" : "直近7日の正答率",
    desc: data.map(point => {
        const day = `${point.label}曜日`;
        if (mode === "count") return `${day}: ${point.count}問`;
        if (point.count === 0) return `${day}: 学習なし、正答率は未計測`;
        return `${day}: ${point.accuracy}%（${point.correct}/${point.count}問）`;
    }).join("。"),
});

export const getSkillRadarTooltipText = (point: RadarCategoryPoint): string =>
    point.skillCount === 0
        ? `まだ練習記録がないよ（0/${point.totalSkills}スキル）`
        : `${point.value}%（記録あり ${point.skillCount}/${point.totalSkills}スキル）`;

export const getUnpracticedSkillCategories = (data: RadarCategoryPoint[]): string[] =>
    data.filter(point => point.skillCount === 0).map(point => point.category);

export const getSkillRadarChartA11y = (
    data: RadarCategoryPoint[]
): { title: string; desc: string } => ({
    title: "スキルマップ",
    desc: `カテゴリごとの平均正答率。${data.map(point => point.skillCount === 0
        ? `${point.category}: まだ練習記録がありません`
        : `${point.category}: ${point.value}%、${point.skillCount}/${point.totalSkills}スキルに練習記録あり`
    ).join("。")}`,
});
