import { useId, useState } from "react";
import { cn } from "../../utils/cn";
import {
    getRootPullStagePresentation,
    ROOT_PULL_CAMERA_KEY,
    ROOT_PULL_VIEW_BOX,
    type RootPullPayoffVariant,
    type RootPullOpeningStage,
} from "./rootPullPresentation";
import type { ExploreRootPullAssetSet } from "../../domain/explore/openingExperience";
import "./RootPullOpeningArt.css";

export type { RootPullOpeningStage } from "./rootPullPresentation";

export interface RootPullOpeningArtProps {
    stage: RootPullOpeningStage;
    assetSet?: ExploreRootPullAssetSet;
    payoffVariant?: RootPullPayoffVariant;
    /** Explicit escape hatch in addition to the OS reduced-motion preference. */
    reducedMotion?: boolean;
    /** Hides equivalent scene meaning when a labelled host already provides it. */
    decorative?: boolean;
    /** Optional accessible title. Stage-specific actor, subject, and action remain described. */
    ariaLabel?: string;
    className?: string;
}

/**
 * Same-camera, authored-image opening art for Root Pull.
 * Problem text, answer values, progress, and controls remain owned by the host DOM.
 */
export const RootPullOpeningArt = ({
    stage,
    assetSet = "v1",
    payoffVariant = "dirt-hat",
    reducedMotion = false,
    decorative = false,
    ariaLabel,
    className,
}: RootPullOpeningArtProps) => {
    const generatedId = useId();
    const titleId = `root-pull-title-${generatedId}`;
    const actorId = `root-pull-actor-${generatedId}`;
    const subjectId = `root-pull-subject-${generatedId}`;
    const actionId = `root-pull-action-${generatedId}`;
    const presentation = getRootPullStagePresentation(stage, assetSet, payoffVariant);
    const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);
    const imageFailed = failedImageSrc === presentation.imageSrc;

    return (
        <figure
            className={cn(
                "root-pull-opening-art",
                `root-pull-opening-art--${stage}`,
                reducedMotion && "root-pull-opening-art--reduced-motion",
                imageFailed && "root-pull-opening-art--image-failed",
                className,
            )}
            role={decorative ? undefined : "img"}
            aria-hidden={decorative || undefined}
            aria-labelledby={decorative ? undefined : titleId}
            aria-describedby={decorative ? undefined : `${actorId} ${subjectId} ${actionId}`}
            data-camera-key={ROOT_PULL_CAMERA_KEY}
            data-view-box={ROOT_PULL_VIEW_BOX}
            data-stage={stage}
            data-state-variant={stage}
            data-asset-set={assetSet}
            data-payoff-variant={stage === "comic-release" ? payoffVariant : undefined}
            data-actor-state={presentation.actorState}
            data-subject-state={presentation.subjectState}
            data-action-state={presentation.actionState}
            data-actor-anchor="left"
            data-subject-anchor="right"
            data-action-axis="shared-leaf-pull"
            data-reduced-motion={reducedMotion ? "true" : "false"}
            data-image-state={imageFailed ? "fallback" : "requested"}
        >
            {decorative ? null : (
                <figcaption className="root-pull-opening-art__semantics">
                    <span id={titleId}>{ariaLabel ?? presentation.title}</span>
                    <span id={actorId} data-semantic-role="actor">
                        {presentation.actorDescription}
                    </span>
                    <span id={subjectId} data-semantic-role="subject">
                        {presentation.subjectDescription}
                    </span>
                    <span id={actionId} data-semantic-role="action">
                        {presentation.actionDescription}
                    </span>
                </figcaption>
            )}

            <img
                key={presentation.imageSrc}
                className="root-pull-opening-art__image"
                src={presentation.imageSrc}
                alt=""
                aria-hidden="true"
                draggable={false}
                decoding="async"
                loading="eager"
                hidden={imageFailed}
                onError={() => setFailedImageSrc(presentation.imageSrc)}
            />

            <div
                className="root-pull-opening-art__fallback"
                data-fallback="image-error"
                aria-hidden="true"
                hidden={!imageFailed}
            >
                <p className="root-pull-opening-art__fallback-title">
                    {presentation.title}
                </p>
                <dl className="root-pull-opening-art__fallback-facts">
                    <div>
                        <dt>あいぼう</dt>
                        <dd>{presentation.actorDescription}</dd>
                    </div>
                    <div>
                        <dt>ねっこの子</dt>
                        <dd>{presentation.subjectDescription}</dd>
                    </div>
                    <div>
                        <dt>いま</dt>
                        <dd>{presentation.actionDescription}</dd>
                    </div>
                </dl>
            </div>
        </figure>
    );
};
