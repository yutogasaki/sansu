import React, { useEffect, useId, useState } from "react";
import { cn } from "../../utils/cn";
import {
    getSnapRootAccessibleDescription,
    SNAP_ROOT_CAMERA_KEY,
    type SnapRootOpeningStage,
} from "./snapRootPresentation";
import "./SnapRootOpeningArt.css";

const PAINTED_ASSET_BASE = "/assets/explore/opening-snap-root-painted";
const TABLET_MEDIA_QUERY = "(min-width: 600px)";

interface PaintedStageAsset {
    mobile: string;
    tablet: string;
}

const PAINTED_BY_STAGE: Readonly<Record<SnapRootOpeningStage, PaintedStageAsset>> = {
    ready: {
        mobile: `${PAINTED_ASSET_BASE}/scene-ready.jpg`,
        tablet: `${PAINTED_ASSET_BASE}/scene-ready-tablet.jpg`,
    },
    "dig-one": {
        mobile: `${PAINTED_ASSET_BASE}/scene-dig-one.jpg`,
        tablet: `${PAINTED_ASSET_BASE}/scene-dig-one-tablet.jpg`,
    },
    "dig-two": {
        mobile: `${PAINTED_ASSET_BASE}/scene-dig-two.jpg`,
        tablet: `${PAINTED_ASSET_BASE}/scene-dig-two-tablet.jpg`,
    },
    popped: {
        mobile: `${PAINTED_ASSET_BASE}/scene-popped.jpg`,
        tablet: `${PAINTED_ASSET_BASE}/scene-popped-tablet.jpg`,
    },
};

const ACTOR_STATE_BY_STAGE: Readonly<Record<SnapRootOpeningStage, string>> = {
    ready: "ready",
    "dig-one": "digging",
    "dig-two": "digging",
    popped: "safe-seated",
};

const SUBJECT_STATE_BY_STAGE: Readonly<Record<SnapRootOpeningStage, string>> = {
    ready: "planted",
    "dig-one": "rising",
    "dig-two": "feet-visible",
    popped: "free-standing",
};

const ACTION_STATE_BY_STAGE: Readonly<Record<SnapRootOpeningStage, string>> = {
    ready: "ready",
    "dig-one": "dig-one",
    "dig-two": "dig-two",
    popped: "pop",
};

type PaintedAssetVariant = keyof PaintedStageAsset;

const getAssetPath = (currentSrc: string): string => {
    try {
        return new URL(currentSrc, window.location.href).pathname;
    } catch {
        return currentSrc;
    }
};

interface SnapRootOpeningArtProps {
    stage: SnapRootOpeningStage;
    reducedMotion?: boolean;
    className?: string;
}

export const SnapRootOpeningArt: React.FC<SnapRootOpeningArtProps> = ({
    stage,
    reducedMotion = false,
    className,
}) => {
    const descriptionId = `snap-root-description-${useId().replace(/:/g, "")}`;
    const [assetVariant, setAssetVariant] = useState<PaintedAssetVariant>("mobile");
    const [readyAssets, setReadyAssets] = useState<ReadonlySet<string>>(
        () => new Set(),
    );
    const [assetFailed, setAssetFailed] = useState(false);
    useEffect(() => {
        const media = window.matchMedia(TABLET_MEDIA_QUERY);
        const updateVariant = () => setAssetVariant(media.matches ? "tablet" : "mobile");
        updateVariant();
        media.addEventListener("change", updateVariant);
        return () => media.removeEventListener("change", updateVariant);
    }, []);

    const selectedAssets = Object.values(PAINTED_BY_STAGE)
        .map((asset) => asset[assetVariant]);
    const assetsReady = selectedAssets.every((asset) => readyAssets.has(asset));
    const assetState = assetFailed
        ? "fallback"
        : assetsReady
            ? "ready"
            : "loading";
    const paintedAsset = PAINTED_BY_STAGE[stage];

    return (
        <figure
            className={cn(
                "snap-root-opening-art",
                `snap-root-opening-art--${stage}`,
                reducedMotion && "snap-root-opening-art--reduced-motion",
                className,
            )}
            role="img"
            aria-describedby={descriptionId}
            data-opening-art="snap-root"
            data-delivery-id="snap-root-v1"
            data-visual-lineage-id="pokko-field-v1"
            data-visual-candidate-id="dig-pop-painted-v2"
            data-visual-mode="world-painted"
            data-camera-key={SNAP_ROOT_CAMERA_KEY}
            data-stage={stage}
            data-actor-state={ACTOR_STATE_BY_STAGE[stage]}
            data-subject-state={SUBJECT_STATE_BY_STAGE[stage]}
            data-action-state={ACTION_STATE_BY_STAGE[stage]}
            data-contact-state="none"
            data-subject-contact="none"
            data-lift-contact="none"
            data-reduced-motion={reducedMotion ? "true" : "false"}
            data-asset-state={assetState}
            data-asset-variant={assetVariant}
        >
            <figcaption id={descriptionId} className="sr-only">
                {getSnapRootAccessibleDescription(stage)}
            </figcaption>

            {Object.entries(PAINTED_BY_STAGE).map(([assetStage, asset]) => (
                <picture
                    key={assetStage}
                    className="snap-root-opening-art__preload"
                    aria-hidden="true"
                >
                    <source media={TABLET_MEDIA_QUERY} srcSet={asset.tablet} />
                    <img
                        src={asset.mobile}
                        alt=""
                        decoding="async"
                        fetchPriority={assetStage === "ready" ? "high" : "auto"}
                        onLoad={(event) => {
                            const loadedAsset = getAssetPath(event.currentTarget.currentSrc);
                            setReadyAssets((current) => {
                                if (current.has(loadedAsset)) return current;
                                return new Set([...current, loadedAsset]);
                            });
                        }}
                        onError={() => setAssetFailed(true)}
                    />
                </picture>
            ))}

            <div className="snap-root-opening-art__scene" aria-hidden="true">
                <picture>
                    <source media={TABLET_MEDIA_QUERY} srcSet={paintedAsset.tablet} />
                    <img
                        className="snap-root-opening-art__painted"
                        src={paintedAsset.mobile}
                        alt=""
                        decoding="async"
                    />
                </picture>
            </div>
        </figure>
    );
};
