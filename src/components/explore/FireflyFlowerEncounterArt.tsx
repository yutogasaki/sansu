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
    waiting: "閉じたほたる花のつぼみを、葉帽子のポッコが少し離れて見ている。",
    "dew-trail": "四つのひかるしずくがつぼみへ並び、ポッコが指で行き先を示している。",
    "warm-bud": "しずくの先でつぼみが起き上がってあたたまり、ポッコがよろこんでいる。",
    "ringing-petals": "五枚の花びらが鈴のように開き、ポッコが両手を上げて音を聞いている。",
};

const STAGE_ASSETS: Record<FireflyFlowerArtStage, string> = {
    waiting: "/assets/explore/firefly-flower/scene-waiting-pokko-v2.jpg",
    "dew-trail": "/assets/explore/firefly-flower/scene-dew-trail-pokko-v2.jpg",
    "warm-bud": "/assets/explore/firefly-flower/scene-warm-bud-pokko-v2.jpg",
    "ringing-petals": "/assets/explore/firefly-flower/scene-ringing-petals-pokko-v2.jpg",
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
        data-camera-key="firefly-flower-side-v2"
        data-visual-lineage-id="pokko-field-v1"
        data-visual-candidate-id="firefly-painted-pokko-v2"
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
