import { useId, type CSSProperties } from "react";
import { cn } from "../../utils/cn";
import {
    RibbonAntennaCompanion,
    type RibbonAntennaCompanionPose,
} from "./RibbonAntennaCompanion";
import "./FireflyFlowerEncounterArt.css";

export type FireflyFlowerArtStage =
    | "waiting"
    | "dew-trail"
    | "warm-bud"
    | "ringing-petals";

export interface FireflyFlowerEncounterArtProps {
    stage: FireflyFlowerArtStage;
    companion?: boolean;
    reducedMotion?: boolean;
    decorative?: boolean;
    ariaLabel?: string;
    className?: string;
}

const STAGE_DESCRIPTIONS: Record<FireflyFlowerArtStage, string> = {
    waiting: "長い紙の花びらを閉じたつぼみが、曲がった茎の先で眠っている。",
    "dew-trail": "四つの丸いしずくが、相棒からつぼみへ一列に並んだ。",
    "warm-bud": "しずくの先でつぼみが起き上がり、折り目の内側をあたためている。",
    "ringing-petals": "五枚の長い花びらが鈴のように開き、足元に途中までの道を作った。",
};

const DEW_DROPS = [
    { x: 130, y: 350, delay: 0 },
    { x: 164, y: 331, delay: 1 },
    { x: 199, y: 311, delay: 2 },
    { x: 235, y: 286, delay: 3 },
] as const;

const PETALS = [
    { rotation: -76, length: 76 },
    { rotation: -36, length: 84 },
    { rotation: 2, length: 91 },
    { rotation: 42, length: 82 },
    { rotation: 79, length: 72 },
] as const;

const getCompanionPose = (stage: FireflyFlowerArtStage): RibbonAntennaCompanionPose => {
    if (stage === "ringing-petals") return "listen";
    if (stage === "dew-trail" || stage === "warm-bud") return "trace";
    return "ready";
};

const ClosedBud = ({ warm }: { warm: boolean }) => (
    <g
        className={cn(
            "firefly-flower-art__closed-bud",
            warm && "firefly-flower-art__closed-bud--warm",
        )}
        data-bud-temperature={warm ? "warm" : "cool"}
    >
        <path
            className="firefly-flower-art__bud-shell"
            d="M292 208C255 197 247 156 274 119L294 93 317 120c27 34 19 75-25 88Z"
        />
        <path
            className="firefly-flower-art__bud-fold"
            d="M293 103c-14 39-14 70-1 95m-2-67-25 27m30-22 29 25"
        />
        {warm ? (
            <>
                <path className="firefly-flower-art__warm-seam" d="M292 112c-9 31-9 57 0 80" />
                <path className="firefly-flower-art__warm-ticks" d="M252 126l-12-9m93 12 13-8m-97 46-14 4m100-2 14 5" />
            </>
        ) : null}
    </g>
);

const OpenPetals = () => (
    <g className="firefly-flower-art__open-bloom" data-bloom-state="open">
        {PETALS.map(({ rotation, length }, index) => (
            <g
                key={rotation}
                className="firefly-flower-art__petal"
                data-petal-state="open"
                style={{ "--petal-delay": `${index * 45}ms` } as CSSProperties}
                transform={`translate(292 173) rotate(${rotation})`}
            >
                <path
                    className="firefly-flower-art__petal-fill"
                    d={`M-10 2C-17 -20 -15 -${length - 15} 0 -${length}C15 -${length - 15} 17 -20 10 2Z`}
                />
                <path
                    className="firefly-flower-art__petal-crease"
                    d={`M0 -5V-${length - 13}`}
                />
                <path
                    className="firefly-flower-art__petal-clapper"
                    d={`M-6 -${length - 12}H6L4 -${length - 3}H-4Z`}
                />
            </g>
        ))}
        <path className="firefly-flower-art__bloom-collar" d="M272 170 292 153l22 18-8 27h-29Z" />
        <path className="firefly-flower-art__ring-marks" d="M230 105c-13-12-17-24-14-37m119 31c13-13 17-26 13-39M274 65c-5-15-3-28 5-40" />
    </g>
);

const getAccessibleDescription = (stage: FireflyFlowerArtStage, hasCompanion: boolean) => {
    const subjectDescription = STAGE_DESCRIPTIONS[stage];
    if (!hasCompanion) return subjectDescription;
    if (stage === "ringing-petals") {
        return `${subjectDescription} 葉帽子のポッコは足を広げ、花びらの音へ耳をすませている。`;
    }
    if (stage === "warm-bud") {
        return `${subjectDescription} 葉帽子のポッコはしずくの列を指でたどっている。`;
    }
    if (stage === "dew-trail") {
        return `${subjectDescription} 葉帽子のポッコは身を乗り出し、列の先を見ている。`;
    }
    return `${subjectDescription} 葉帽子のポッコが少し離れて様子を見ている。`;
};

/**
 * Authored, same-camera live art for the ordinary Firefly Flower trail.
 * Text, progress, problem content, and controls remain owned by the host DOM.
 */
export const FireflyFlowerEncounterArt = ({
    stage,
    companion = true,
    reducedMotion = false,
    decorative = false,
    ariaLabel = "ほたる花のしずく道",
    className,
}: FireflyFlowerEncounterArtProps) => {
    const generatedId = useId();
    const titleId = `firefly-flower-title-${generatedId}`;
    const descriptionId = `firefly-flower-description-${generatedId}`;
    const showDewTrail = stage !== "waiting";
    const showWarmBud = stage === "warm-bud";
    const showRingingPetals = stage === "ringing-petals";
    const clueCount = stage === "waiting" ? 0 : stage === "dew-trail" ? 1 : stage === "warm-bud" ? 2 : 3;

    return (
        <svg
            className={cn(
                "firefly-flower-art",
                `firefly-flower-art--${stage}`,
                reducedMotion && "firefly-flower-art--reduced-motion",
                className,
            )}
            viewBox="0 0 390 500"
            preserveAspectRatio="xMidYMid meet"
            role={decorative ? undefined : "img"}
            aria-labelledby={decorative ? undefined : `${titleId} ${descriptionId}`}
            aria-hidden={decorative || undefined}
            focusable="false"
            data-camera-key="firefly-flower-side-v1"
            data-visual-lineage-id="pokko-field-v1"
            data-visual-candidate-id="firefly-live-pokko-v1"
            data-visual-mode="world-live"
            data-stage={stage}
            data-clue-count={clueCount}
            data-light-path={showRingingPetals ? "setup" : "hidden"}
            data-reduced-motion={reducedMotion ? "true" : "false"}
        >
            {decorative ? null : <title id={titleId}>{ariaLabel}</title>}
            {decorative ? null : (
                <desc id={descriptionId}>{getAccessibleDescription(stage, companion)}</desc>
            )}

            <g data-layer="habitat" aria-hidden="true">
                <rect className="firefly-flower-art__sky" width="390" height="500" />
                <path className="firefly-flower-art__far-bank" d="M0 126c57-28 115-25 173 8 47 27 91 27 132 1 31-20 59-22 85-8V0H0Z" />
                <path className="firefly-flower-art__left-leaf" d="M-32 219C9 154 61 139 119 171L54 185Z" />
                <path className="firefly-flower-art__left-leaf firefly-flower-art__left-leaf--small" d="M-20 244c36-43 73-50 111-20l-54 7Z" />
                <path className="firefly-flower-art__right-rock" d="M350 310c8-42 25-66 52-73v151h-58Z" />
                <path className="firefly-flower-art__ground" d="M0 412c50-18 94-15 133 8 43 25 87 25 132 1 44-24 86-22 125 6v73H0Z" />
                <path className="firefly-flower-art__ground-seam" d="M0 446c53-18 99-14 140 8 40 21 81 20 124-1 44-22 86-18 126 9" />
            </g>

            <g data-layer="shadows" aria-hidden="true">
                {companion ? <ellipse className="firefly-flower-art__shadow" cx="79" cy="404" rx="47" ry="9" /> : null}
                <ellipse className="firefly-flower-art__shadow" cx="297" cy="425" rx="77" ry="11" />
            </g>

            {showDewTrail ? (
                <g className="firefly-flower-art__dew-trail" data-layer="dew-trail" aria-hidden="true">
                    <path className="firefly-flower-art__dew-guide" d="M113 365c48-25 93-48 138-86" />
                    {DEW_DROPS.map(({ x, y, delay }) => (
                        <g
                            key={`${x}-${y}`}
                            className="firefly-flower-art__dew-drop"
                            data-dew-drop={delay + 1}
                            style={{ "--dew-delay": `${delay * 55}ms` } as CSSProperties}
                            transform={`translate(${x} ${y})`}
                        >
                            <path className="firefly-flower-art__dew-fill" d="M0-12C9-3 12 3 12 9c0 8-5 13-12 13S-12 17-12 9C-12 3-9-3 0-12Z" />
                            <path className="firefly-flower-art__dew-cut" d="M-3 2c-4 3-4 7-2 10" />
                        </g>
                    ))}
                </g>
            ) : (
                <path className="firefly-flower-art__action-corridor" d="M121 347c33-17 66-32 98-47" data-layer="action-corridor" aria-hidden="true" />
            )}

            {showRingingPetals ? (
                <g
                    className="firefly-flower-art__path-setup"
                    data-layer="light-path-setup"
                    transform="translate(0 -24)"
                    aria-hidden="true"
                >
                    <path className="firefly-flower-art__path-edge" d="M306 398c-29-18-59-17-89 2-19 12-35 18-49 18" />
                    <path className="firefly-flower-art__path-dashes" d="M306 398c-29-18-59-17-89 2-19 12-35 18-49 18" />
                    <path className="firefly-flower-art__path-stop" d="m162 407-10 12 12 9" />
                </g>
            ) : null}

            <g data-layer="subject" aria-hidden="true">
                <path className="firefly-flower-art__stem-outline" d="M300 423c-7-78-8-149-7-219" />
                <path className="firefly-flower-art__stem" d="M300 423c-7-78-8-149-7-219" />
                <path className="firefly-flower-art__leaf" d="M292 337c-42-28-70-13-77 20 33 9 59 3 77-20Z" />
                <path className="firefly-flower-art__leaf firefly-flower-art__leaf--right" d="M298 307c35-33 67-27 80 3-30 15-57 14-80-3Z" />
                <path className="firefly-flower-art__collar" d="m276 218 17-21 19 21-7 21h-24Z" />
                {showRingingPetals ? <OpenPetals /> : <ClosedBud warm={showWarmBud} />}
            </g>

            {companion ? (
                <g
                    className="firefly-flower-art__companion-motion"
                    data-layer="companion"
                    aria-hidden="true"
                    transform="translate(49 239)"
                >
                    <RibbonAntennaCompanion pose={getCompanionPose(stage)} />
                </g>
            ) : null}
        </svg>
    );
};
