import React from "react";
import { Check, HelpCircle } from "lucide-react";
import {
    getDiscoveryPageClueFeatureIds,
    getDiscoveryPageFeature,
    type DiscoveryPageDefinition,
    type DiscoveryPageFeatureId,
} from "../../domain/explore";

interface ResearchClueStampRailProps {
    definition: DiscoveryPageDefinition;
    discoveredFeatureIds: readonly DiscoveryPageFeatureId[];
    variant?: "book" | "summary";
}

export const ResearchClueStampRail: React.FC<ResearchClueStampRailProps> = ({
    definition,
    discoveredFeatureIds,
    variant = "summary",
}) => {
    const clueFeatureIds = getDiscoveryPageClueFeatureIds(definition);
    const discovered = new Set(discoveredFeatureIds);
    const style = {
        "--research-clue-count": Math.max(1, Math.min(clueFeatureIds.length, 3)),
    } as React.CSSProperties;

    return (
        <ol
            className="research-clue-stamp-rail"
            data-variant={variant}
            style={style}
            aria-label={`${definition.subjectName}の手掛かり`}
        >
            {clueFeatureIds.map((featureId, index) => {
                const feature = getDiscoveryPageFeature(definition, featureId);
                const isFound = discovered.has(featureId);
                const label = isFound
                    ? `${feature?.title ?? `手掛かり ${index + 1}`}、見つけた`
                    : `手掛かり ${index + 1}、まだ謎`;

                return (
                    <li
                        key={featureId}
                        className="research-clue-stamp"
                        data-found={isFound || undefined}
                        aria-label={label}
                    >
                        <span className="research-clue-stamp-mark" aria-hidden="true">
                            {isFound ? <Check /> : <HelpCircle />}
                        </span>
                        <span className="research-clue-stamp-label">
                            {isFound ? feature?.title : "まだ なぞ"}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
};
