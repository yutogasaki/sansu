import React from "react";
import {
    ResponsiveContainer,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    Dot,
    Tooltip,
} from "recharts";
import type { ActiveDotProps } from "recharts";
import type { RadarCategoryPoint } from "../../domain/stats/aggregation";
import { Badge } from "../ui/Badge";
import {
    getSkillRadarMarkerPoints,
    getSkillRadarSegmentPath,
    getSkillRadarShapeSegments,
    type SkillRadarShapePoint,
} from "./skillRadarGeometry";
import {
    getSkillRadarChartA11y,
    getSkillRadarTooltipText,
    getUnpracticedSkillCategories,
} from "./statsChartAccessibility";

type SkillRadarPolygonProps = Pick<
    React.SVGProps<SVGGElement>,
    "className" | "fill" | "fillOpacity" | "stroke" | "strokeWidth"
> & { points?: readonly SkillRadarShapePoint[] };

const SkillRadarPolygon = ({
    points = [], className, fill, fillOpacity, stroke, strokeWidth,
}: SkillRadarPolygonProps): React.ReactElement<SVGElement> => {
    const segments = getSkillRadarShapeSegments(points);
    const markerPoints = getSkillRadarMarkerPoints(points, segments);

    return (
        <g
            className={className}
        >
            {segments.map((segment, index) => (
                <path
                    key={index}
                    d={getSkillRadarSegmentPath(segment)}
                    fill={segment.closed ? fill : "none"}
                    fillOpacity={segment.closed ? fillOpacity : undefined}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            ))}
            {markerPoints.map((point, index) => (
                <circle
                    key={`measured-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={3}
                    fill={fill ?? stroke ?? "#0ea5e9"}
                    stroke="white"
                    strokeWidth={1.5}
                />
            ))}
        </g>
    );
};

const SkillRadarActiveDot = (props: ActiveDotProps) => {
    const point = props.payload as RadarCategoryPoint | undefined;
    if (point?.skillCount === 0) return null;

    return (
        <Dot
            cx={props.cx}
            cy={props.cy}
            r={props.r}
            fill={props.fill}
            stroke={props.stroke}
            strokeWidth={props.strokeWidth}
        />
    );
};

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
                {getSkillRadarTooltipText(d)}
            </div>
        </div>
    );
};

export const SkillRadarChart: React.FC<Props> = ({ data }) => {
    const chartA11y = getSkillRadarChartA11y(data);
    const unpracticedCategories = getUnpracticedSkillCategories(data);

    return (
        <div className="space-y-1">
            <ResponsiveContainer width="100%" height={220}>
                <RadarChart
                    data={data}
                    title={chartA11y.title}
                    desc={chartA11y.desc}
                    cx="50%"
                    cy="50%"
                    outerRadius="70%"
                >
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
                        shape={SkillRadarPolygon}
                        activeDot={SkillRadarActiveDot}
                        stroke="#0ea5e9"
                        fill="#38bdf8"
                        fillOpacity={0.25}
                        strokeWidth={2}
                        animationDuration={600}
                    />
                </RadarChart>
            </ResponsiveContainer>
            {unpracticedCategories.length > 0 && (
                <div className="space-y-1 px-2 text-center">
                    <p id="skill-radar-unpracticed-label" className="text-xs font-semibold leading-5 text-slate-600">
                        まだ練習記録がないカテゴリ
                    </p>
                    <ul aria-labelledby="skill-radar-unpracticed-label" className="flex flex-wrap items-center justify-center gap-1.5">
                        {unpracticedCategories.map(category => (
                            <li key={category} className="list-none">
                                <Badge variant="neutral" className="whitespace-nowrap border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold tracking-normal text-slate-700">
                                    {category}
                                </Badge>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
