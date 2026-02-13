import React from "react";
import {
    ResponsiveContainer,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    Tooltip,
} from "recharts";
import type { RadarCategoryPoint } from "../../domain/stats/aggregation";

interface Props {
    data: RadarCategoryPoint[];
}

const CustomTooltip: React.FC<{
    active?: boolean;
    payload?: { payload: RadarCategoryPoint }[];
}> = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div className="bg-white rounded-xl px-3 py-1.5 shadow-lg border border-slate-100 text-xs font-bold text-slate-700">
            <div>{d.category}</div>
            <div className="text-slate-500 font-normal">
                {d.value}% ({d.skillCount}/{d.totalSkills})
            </div>
        </div>
    );
};

export const SkillRadarChart: React.FC<Props> = ({ data }) => {
    return (
        <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="#e2e8f0" gridType="polygon" />
                <PolarAngleAxis
                    dataKey="category"
                    tick={{ fontSize: 11, fill: "#475569" }}
                />
                <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={false}
                    axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Radar
                    dataKey="value"
                    stroke="#0ea5e9"
                    fill="#38bdf8"
                    fillOpacity={0.25}
                    strokeWidth={2}
                    animationDuration={600}
                />
            </RadarChart>
        </ResponsiveContainer>
    );
};
