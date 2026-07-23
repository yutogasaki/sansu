import { cn } from "../../utils/cn";
import "./FireflyFlowerEncounterArt.css";

export type FireflyFlowerArtStage =
    | "waiting"
    | "dew-trail"
    | "warm-bud"
    | "ringing-petals";

export interface FireflyFlowerEncounterArtProps {
    stage: FireflyFlowerArtStage;
    reducedMotion?: boolean;
    decorative?: boolean;
    ariaLabel?: string;
    className?: string;
}

const STAGE_DESCRIPTIONS: Record<FireflyFlowerArtStage, string> = {
    waiting: "閉じたほたる花のつぼみまで、一本の乾いた溝が続いている。葉帽子のポッコは、四つのしずくを見ている。",
    "dew-trail": "ポッコが先頭のしずくを押し、四つのしずくが一本の溝をころがりはじめる。",
    "warm-bud": "四つのしずくが溝の半分まで進み、ポッコが腰を落として見送る。つぼみの先が少しひらく。",
    "ringing-petals": "四つのしずくが花まで届き、五枚の花びらがひらく。ポッコは一本になった水の道を見ている。",
};

const STAGE_ASSETS: Record<FireflyFlowerArtStage, string> = {
    waiting: "/assets/explore/firefly-flower/scene-waiting-dew-path-pokko-v3.jpg",
    "dew-trail": "/assets/explore/firefly-flower/scene-dew-trail-dew-path-pokko-v3.jpg",
    "warm-bud": "/assets/explore/firefly-flower/scene-warm-bud-dew-path-pokko-v3.jpg",
    "ringing-petals": "/assets/explore/firefly-flower/scene-ringing-petals-dew-path-pokko-v3.jpg",
};

const getClueCount = (stage: FireflyFlowerArtStage) => (
    stage === "waiting" ? 0 : stage === "dew-trail" ? 1 : stage === "warm-bud" ? 2 : 3
);

/**
 * Same-camera painted plates for the ordinary Firefly Flower trail.
 * All four states stay mounted so the next 280KB plate is decoded before a
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
        data-camera-key="firefly-flower-side-v3"
        data-visual-lineage-id="pokko-field-v1"
        data-visual-candidate-id="firefly-dew-path-painted-v3"
        data-visual-mode="world-painted"
        data-stage={stage}
        data-clue-count={getClueCount(stage)}
        data-light-path={stage === "ringing-petals" ? "setup" : "hidden"}
        data-reduced-motion={reducedMotion ? "true" : "false"}
        data-character-id="pokko"
    >
        {(Object.entries(STAGE_ASSETS) as [FireflyFlowerArtStage, string][])
            .map(([assetStage, src]) => (
                <img
                    key={assetStage}
                    src={src}
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
