import type { RadarCategoryPoint } from "../../domain/stats/aggregation";

export interface SkillRadarShapePoint {
    x: number;
    y: number;
    payload?: Pick<RadarCategoryPoint, "skillCount" | "value">;
}

export interface SkillRadarShapeSegment {
    points: SkillRadarShapePoint[];
    closed: boolean;
}

const isPlottable = (point: SkillRadarShapePoint) =>
    point.payload?.skillCount !== 0 && Number.isFinite(point.x) && Number.isFinite(point.y);

export const getSkillRadarShapeSegments = (
    points: readonly SkillRadarShapePoint[]
): SkillRadarShapeSegment[] => {
    if (points.length === 0) return [];

    const firstGapIndex = points.findIndex(point => !isPlottable(point));

    if (firstGapIndex === -1) {
        return [{ points: [...points], closed: true }];
    }

    // Start after a gap so the first and last axes cannot reconnect across a missing category.
    const orderedPoints = Array.from({ length: points.length }, (_, offset) =>
        points[(firstGapIndex + offset + 1) % points.length]!
    );
    const segments: SkillRadarShapeSegment[] = [];
    let currentSegment: SkillRadarShapePoint[] = [];

    for (const point of orderedPoints) {
        if (isPlottable(point)) {
            currentSegment.push(point);
        } else if (currentSegment.length > 0) {
            segments.push({ points: currentSegment, closed: false });
            currentSegment = [];
        }
    }

    if (currentSegment.length > 0) {
        segments.push({ points: currentSegment, closed: false });
    }

    return segments;
};

export const getSkillRadarSegmentPath = (segment: SkillRadarShapeSegment): string =>
    `${segment.points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join("")}${segment.closed ? "Z" : ""}`;

export const getSkillRadarMarkerPoints = (
    points: readonly SkillRadarShapePoint[],
    segments: readonly SkillRadarShapeSegment[]
): SkillRadarShapePoint[] => {
    const incomplete = points.some(point => !isPlottable(point));
    return incomplete
        ? segments.flatMap(segment => segment.points)
        : points.filter(point => point.payload?.skillCount !== 0 && point.payload?.value === 0);
};
