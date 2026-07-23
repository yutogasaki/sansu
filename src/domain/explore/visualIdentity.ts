export const EXPLORE_VISUAL_LINEAGE_IDS = {
    pokko: "pokko-field-v1",
    legacyMixed: "legacy-mixed-v0",
} as const;

export type ExploreVisualLineageId = typeof EXPLORE_VISUAL_LINEAGE_IDS[keyof typeof EXPLORE_VISUAL_LINEAGE_IDS];

export type ExploreVisualMode =
    | "world-painted"
    | "world-live"
    | "observation"
    | "field-book"
    | "archive"
    | "route-map"
    | "base-map"
    | "legacy";

export interface ExploreVisualIdentity {
    readonly lineageId: ExploreVisualLineageId;
    readonly candidateId: string;
    readonly mode: ExploreVisualMode;
    readonly surfaceId: string;
    readonly cameraKey?: string;
}
