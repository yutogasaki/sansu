import { cn } from "../../utils/cn";
import {
    FIREFLY_FLOWER_CAMERA_KEY,
    FIREFLY_FLOWER_SCENES,
    FIREFLY_FLOWER_WORLD_CANDIDATE_ID,
    type FireflyFlowerSceneStage,
} from "./fireflyFlowerSceneCatalog";
import "./FireflyFlowerEncounterArt.css";

export type FireflyFlowerArtStage = FireflyFlowerSceneStage;

export interface FireflyFlowerEncounterArtProps {
    stage: FireflyFlowerArtStage;
    reducedMotion?: boolean;
    decorative?: boolean;
    ariaLabel?: string;
    className?: string;
}

const STAGE_DESCRIPTIONS: Record<FireflyFlowerArtStage, string> = {
    waiting: FIREFLY_FLOWER_SCENES.waiting.description,
    "dew-trail": FIREFLY_FLOWER_SCENES["dew-trail"].description,
    "warm-bud": FIREFLY_FLOWER_SCENES["warm-bud"].description,
    "ringing-petals": FIREFLY_FLOWER_SCENES["ringing-petals"].description,
    "light-path": FIREFLY_FLOWER_SCENES["light-path"].description,
};

const getClueCount = (stage: FireflyFlowerArtStage) => (
    stage === "waiting" ? 0 : stage === "dew-trail" ? 1 : stage === "warm-bud" ? 2 : 3
);

/**
 * Same-camera painted plates for the ordinary Firefly Flower trail.
 * All five states stay mounted so the next painted plate is decoded before a
 * rapid correct-answer transition asks for it. The host owns text and input.
 */
export const FireflyFlowerEncounterArt = ({
    stage,
    reducedMotion = false,
    decorative = false,
    ariaLabel = "ほたる花のしずく道",
    className,
}: FireflyFlowerEncounterArtProps) => (
    <figure
        className={cn(
            "firefly-flower-art",
            `firefly-flower-art--${stage}`,
            reducedMotion && "firefly-flower-art--reduced-motion",
            className,
        )}
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : `${ariaLabel}。${STAGE_DESCRIPTIONS[stage]}`}
        aria-hidden={decorative || undefined}
        data-camera-key={FIREFLY_FLOWER_CAMERA_KEY}
        data-visual-lineage-id="pokko-field-v1"
        data-visual-candidate-id={FIREFLY_FLOWER_WORLD_CANDIDATE_ID}
        data-visual-mode="world-painted"
        data-stage={stage}
        data-clue-count={getClueCount(stage)}
        data-light-path={stage === "light-path"
            ? "complete"
            : stage === "ringing-petals"
                ? "setup"
                : "hidden"}
        data-reduced-motion={reducedMotion ? "true" : "false"}
        data-character-id="pokko"
    >
        {(Object.entries(FIREFLY_FLOWER_SCENES) as [
            FireflyFlowerArtStage,
            (typeof FIREFLY_FLOWER_SCENES)[FireflyFlowerArtStage],
        ][])
            .map(([assetStage, scene]) => (
                <img
                    key={assetStage}
                    src={scene.src}
                    alt=""
                    className="firefly-flower-art__scene"
                    data-painted-stage={assetStage}
                    data-active={assetStage === stage ? "true" : "false"}
                    decoding="async"
                    draggable={false}
                    fetchPriority={assetStage === stage ? "high" : "auto"}
                />
            ))}
    </figure>
);
