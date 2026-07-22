import React from "react";
import {
    FIREFLY_FLOWER_DISCOVERY_PAGE,
    MAKIMODON_DISCOVERY_PAGE,
    getDiscoveryPageClueFeatureIds,
    type DiscoveryPageDefinition,
    type DiscoveryPageFeatureId,
    type DiscoveryPageId,
} from "../../domain/explore";
import { FireflyFlowerResearchArt } from "./FireflyFlowerResearchArt";
import { MakimodonResearchArt } from "./MakimodonResearchArt";

export type DiscoveryPageArtVariant = "reveal" | "book" | "thumbnail";

export interface DiscoveryPageArtRendererProps {
    discoveredFeatureIds: readonly DiscoveryPageFeatureId[];
    variant?: DiscoveryPageArtVariant;
}

interface DiscoveryPageArtProps extends DiscoveryPageArtRendererProps {
    definition: DiscoveryPageDefinition;
}

const DISCOVERY_PAGE_ART_RENDERERS: Partial<Record<
    DiscoveryPageId,
    React.ComponentType<DiscoveryPageArtRendererProps>
>> = {
    [FIREFLY_FLOWER_DISCOVERY_PAGE.id]: FireflyFlowerResearchArt,
    [MAKIMODON_DISCOVERY_PAGE.id]: MakimodonResearchArt,
};

const GenericDiscoveryPageArt: React.FC<DiscoveryPageArtProps> = ({
    definition,
    discoveredFeatureIds,
    variant = "reveal",
}) => {
    const clueFeatureIds = getDiscoveryPageClueFeatureIds(definition).slice(0, 5);
    const found = new Set(discoveredFeatureIds);
    const spacing = 260 / (clueFeatureIds.length + 1);

    return (
        <svg
            className={variant === "reveal" ? "h-auto w-full" : "h-full w-full"}
            viewBox="0 0 360 260"
            preserveAspectRatio={variant === "reveal" ? "xMidYMid meet" : "xMidYMid slice"}
            role="img"
            aria-label={`${definition.subjectName}の調査絵。${discoveredFeatureIds.length}件を発見`}
        >
            <path d="M0 0H360V260H0Z" fill="var(--explore-turquoise)" />
            <path d="M0 0H360V48L304 34 254 58 196 39 143 61 84 36 0 53Z" fill="var(--explore-outline)" />
            <path d="M0 210C82 181 124 225 190 202C257 179 300 222 360 196V260H0Z" fill="var(--explore-moss)" />
            <path d="M78 76H282V204H78Z" fill="var(--explore-parchment)" stroke="var(--explore-outline)" strokeWidth="7" strokeLinejoin="round" />
            <path d="M180 78V202" stroke="var(--explore-outline)" strokeWidth="4" strokeDasharray="4 8" />
            {clueFeatureIds.map((featureId, index) => {
                const x = 50 + spacing * (index + 1);
                const isFound = found.has(featureId);
                return (
                    <g key={featureId} transform={`translate(${x} 142)`}>
                        <circle r="18" fill={isFound ? "var(--explore-amber)" : "var(--explore-cream)"} stroke="var(--explore-outline)" strokeWidth="5" />
                        {isFound ? <path d="M-7 0L-2 6L9 -8" fill="none" stroke="var(--explore-outline)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /> : null}
                    </g>
                );
            })}
        </svg>
    );
};

const getDiscoveryPageArtRenderer = (
    pageId: DiscoveryPageId,
): React.ComponentType<DiscoveryPageArtRendererProps> | undefined => (
    DISCOVERY_PAGE_ART_RENDERERS[pageId]
);

export const DiscoveryPageArt: React.FC<DiscoveryPageArtProps> = ({
    definition,
    discoveredFeatureIds,
    variant = "reveal",
}) => {
    const Renderer = getDiscoveryPageArtRenderer(definition.id);
    if (!Renderer) {
        return (
            <GenericDiscoveryPageArt
                definition={definition}
                discoveredFeatureIds={discoveredFeatureIds}
                variant={variant}
            />
        );
    }

    return React.createElement(Renderer, { discoveredFeatureIds, variant });
};
