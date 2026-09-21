import React from "react";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";
import type { WeeklyTrendPoint } from "../../domain/stats/aggregation";
import {
    getWeeklyTrendChartA11y,
    getWeeklyTrendChartData,
    type WeeklyTrendMode,
} from "./statsChartAccessibility";

interface Props {
    data: WeeklyTrendPoint[];
    mode: WeeklyTrendMode;
}

const CustomTooltip: React.FC<{
    active?: boolean;
    payload?: { value: number | null; payload?: WeeklyTrendPoint }[];
    label?: string;
    mode: "count" | "accuracy";
}> = ({ active, payload, label, mode }) => {
    if (!active) return null;
    const point = payload?.[0]?.payload;
    if (mode === "accuracy" && point?.count === 0) {
        return (
            <div className="bg-white rounded-xl px-3 py-1.5 shadow-lg border border-slate-100 text-xs font-bold text-slate-700">
                {label}: 学習なし（正答率は未計測）
            </div>
        );
    }
    if (!payload?.length || payload[0].value == null) return null;
    const val = payload[0].value;
    return (
        <div className="bg-white rounded-xl px-3 py-1.5 shadow-lg border border-slate-100 text-xs font-bold text-slate-700">
            {label}: {val}{mode === "accuracy" ? "%" : "もん"}
        </div>
    );
};

export const WeeklyTrendChart: React.FC<Props> = ({ data, mode }) => {
    const dataKey = mode === "count" ? "count" : "accuracy";
    const color = mode === "count" ? "#38bdf8" : "#34d399";
    const maxVal = mode === "accuracy" ? 100 : Math.max(10, ...data.map(d => d.count));
    const chartA11y = getWeeklyTrendChartA11y(data, mode);

    return (
        <ResponsiveContainer width="100%" height={160}>
            <LineChart
                data={getWeeklyTrendChartData(data, mode)}
                title={chartA11y.title}
                desc={chartA11y.desc}
                margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={6}
                />
                <YAxis
                    domain={[0, maxVal]}
                    tick={{ fontSize: 10, fill: "#cbd5e1" }}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={6}
                    width={20}
                />
                <Tooltip content={<CustomTooltip mode={mode} />} />
                <Line
                    type="monotone"
                    dataKey={dataKey}
                    stroke={color}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#fff", stroke: color, strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: color }}
                    connectNulls={false}
                    animationDuration={600}
                />
            </LineChart>
        </ResponsiveContainer>
    );
};
