import { useId } from "react";
import { cn } from "../../utils/cn";
import {
    RibbonAntennaCompanion,
    type RibbonAntennaCompanionPose,
} from "./RibbonAntennaCompanion";
import "./MakimodonEncounterArt.css";

export type MakimodonArtStage = "rolled" | "trip" | "path" | "payoff";

export interface MakimodonEncounterArtProps {
    /** Semantic ecology beat. The parent flow owns timing and answer logic. */
    stage: MakimodonArtStage;
    /** Set false when the host scene already renders its own companion. */
    companion?: boolean;
    /** Explicit escape hatch in addition to the OS reduced-motion preference. */
    reducedMotion?: boolean;
    /** Makes the SVG silent when equivalent scene meaning is already in the DOM. */
    decorative?: boolean;
    /** Optional accessible title. A stage-specific description is still provided. */
    ariaLabel?: string;
    className?: string;
}

interface StageDefinition {
    creatureTransform: string;
    bandReach: "tucked" | "self-step" | "companion-step" | "rewound-seat";
    bandTurns: number;
    companionPose: RibbonAntennaCompanionPose;
    companionTransform: string;
    companionState: "watching" | "startled" | "one-step" | "seated";
}

const STAGE_DEFINITIONS: Record<MakimodonArtStage, StageDefinition> = {
    rolled: {
        creatureTransform: "translate(0 0)",
        bandReach: "tucked",
        bandTurns: 3,
        companionPose: "ready",
        companionTransform: "translate(43 270) scale(0.8)",
        companionState: "watching",
    },
    trip: {
        creatureTransform: "translate(0 27) rotate(6 274 286)",
        bandReach: "self-step",
        bandTurns: 2,
        companionPose: "listen",
        companionTransform: "translate(43 269) scale(0.8)",
        companionState: "startled",
    },
    path: {
        creatureTransform: "translate(0 0)",
        bandReach: "companion-step",
        bandTurns: 1,
        companionPose: "trace",
        companionTransform: "translate(43 270) scale(0.8)",
        companionState: "one-step",
    },
    payoff: {
        creatureTransform: "translate(0 0)",
        bandReach: "rewound-seat",
        bandTurns: 3,
        companionPose: "ready",
        companionTransform: "translate(240 112) scale(0.8)",
        companionState: "seated",
    },
};

const STAGE_DESCRIPTIONS: Record<MakimodonArtStage, string> = {
    rolled: "体の三倍以上ある角ばった帯を何重にも外巻きし、帯の端を巻き胴へしまっている。",
    trip: "帯が一巻ほどけ、二本の針脚の片方で自分の帯を踏んで、ぺたんと伏せた。",
    path: "ほどけた帯が相棒の足元まで平たい道になり、相棒が片足を乗せている。",
    payoff: "帯が巻き戻り、相棒を背中のくぼみへ運んで安全に座らせた。",
};

const COIL_PATH = "M145 327 134 287 169 250 299 241 340 269 330 311 294 337 177 345 145 327 159 295 185 271 289 262 316 279 307 300 282 316 190 321";

const BandStroke = ({ path, className }: { path: string; className?: string }) => (
    <g className={className}>
        <path className="makimodon-art__band-outline" d={path} />
        <path className="makimodon-art__band-fill" d={path} />
    </g>
);

const BandExtension = ({ stage }: { stage: MakimodonArtStage }) => {
    if (stage === "rolled" || stage === "payoff") {
        return (
            <g className="makimodon-art__tucked-end" data-band-contact="tucked">
                <path className="makimodon-art__tucked-end-outline" d="m309 300 31 18-18 22" />
                <path className="makimodon-art__tucked-end-fill" d="m309 300 31 18-18 22" />
                <path className="makimodon-art__band-notch" d="m324 311-8 11 10 6" />
            </g>
        );
    }

    const path = stage === "trip"
        ? "M311 300 341 325 320 353 297 353"
        : "M311 300 343 328 320 385 247 390 168 386 80 390";

    return (
        <BandStroke
            path={path}
            className={cn(
                "makimodon-art__band-extension",
                `makimodon-art__band-extension--${stage}`,
            )}
        />
    );
};

const NeedleLegs = ({ stage }: { stage: MakimodonArtStage }) => {
    const isTrip = stage === "trip";

    return (
        <g className="makimodon-art__needle-legs" data-needle-legs="2">
            <g data-needle-leg="rear">
                <path
                    className="makimodon-art__needle-leg"
                    d={isTrip ? "M266 262 277 315 264 349" : "M266 262 262 329 268 389"}
                />
                <path
                    className="makimodon-art__needle-tip"
                    d={isTrip ? "m264 349-9 12 16-4Z" : "m268 389-8 13 17-5Z"}
                />
            </g>
            <g data-needle-leg="front">
                <path
                    className="makimodon-art__needle-leg"
                    d={isTrip ? "M302 261 318 315 298 352" : "M302 261 309 328 306 389"}
                />
                <path
                    className="makimodon-art__needle-tip"
                    d={isTrip ? "m298 352-8 12 17-4Z" : "m306 389-8 13 17-5Z"}
                />
            </g>
        </g>
    );
};

const CoreBody = ({ stage }: { stage: MakimodonArtStage }) => (
    <g className="makimodon-art__core" data-head-shape="wedge">
        <path
            className="makimodon-art__core-body"
            d="M244 257 250 232 262 219 272 235 286 218 301 228 313 246 306 268 288 261 271 272 253 264Z"
        />
        <path className="makimodon-art__back-hollow" d="m256 230 7-6 9 12 14-13 10 5" />
        <path className="makimodon-art__wedge-head" d="M305 238 350 245 337 264 307 260Z" />
        <circle className="makimodon-art__pin-eye" cx="334" cy="251" r="2.4" />
        <path className="makimodon-art__head-fold" d="m343 247-8 8 5 5" />
        <path className="makimodon-art__front-wrap-outline" d="M238 258 267 269 304 255" />
        <path className="makimodon-art__front-wrap-fill" d="M238 258 267 269 304 255" />
        {stage === "trip" ? <path className="makimodon-art__flat-mark" d="m344 269 16 6-15 7" /> : null}
    </g>
);

const Creature = ({ stage }: { stage: MakimodonArtStage }) => {
    const definition = STAGE_DEFINITIONS[stage];

    return (
        <g
            className="makimodon-art__creature"
            transform={definition.creatureTransform}
            data-band-reach={definition.bandReach}
            data-band-turns={definition.bandTurns}
            data-band-to-body-ratio="3.2"
        >
            <BandStroke path={COIL_PATH} className="makimodon-art__coil" />
            <BandExtension stage={stage} />
            <NeedleLegs stage={stage} />
            <CoreBody stage={stage} />
        </g>
    );
};

const Companion = ({ stage }: { stage: MakimodonArtStage }) => {
    const definition = STAGE_DEFINITIONS[stage];

    return (
        <g
            className={cn(
                "makimodon-art__companion-motion",
                `makimodon-art__companion-motion--${definition.companionState}`,
            )}
            transform={definition.companionTransform}
            data-companion-state={definition.companionState}
        >
            <RibbonAntennaCompanion pose={definition.companionPose} />
        </g>
    );
};

const getAccessibleDescription = (stage: MakimodonArtStage, hasCompanion: boolean) => {
    const creatureDescription = STAGE_DESCRIPTIONS[stage];
    if (!hasCompanion) return creatureDescription;

    if (stage === "rolled") return `${creatureDescription} 相棒は帯端から離れて観察している。`;
    if (stage === "trip") return `${creatureDescription} 相棒は両腕を上げて見守っている。`;
    if (stage === "path") return `${creatureDescription} 帯は相棒を支える幅を保っている。`;
    return `${creatureDescription} 相棒の両足はくぼみに着き、帯が手前で支えている。`;
};

/**
 * Same-camera encounter art for Makimodon's visible wind-release-rewind rule.
 * The SVG owns no problem text, progress UI, answer values, or input controls.
 */
export const MakimodonEncounterArt = ({
    stage,
    companion = true,
    reducedMotion = false,
    decorative = false,
    ariaLabel = "角ばった帯を巻いた赤い生き物",
    className,
}: MakimodonEncounterArtProps) => {
    const generatedId = useId();
    const titleId = `makimodon-title-${generatedId}`;
    const descriptionId = `makimodon-description-${generatedId}`;
    const isPayoff = stage === "payoff";

    return (
        <svg
            className={cn(
                "makimodon-art",
                `makimodon-art--${stage}`,
                reducedMotion && "makimodon-art--reduced-motion",
                className,
            )}
            viewBox="0 0 390 500"
            preserveAspectRatio="xMidYMid meet"
            role={decorative ? undefined : "img"}
            aria-labelledby={decorative ? undefined : `${titleId} ${descriptionId}`}
            aria-hidden={decorative || undefined}
            focusable="false"
            data-camera-key="makimodon-side-v1"
            data-stage={stage}
            data-band-reach={STAGE_DEFINITIONS[stage].bandReach}
            data-reduced-motion={reducedMotion ? "true" : "false"}
        >
            {decorative ? null : <title id={titleId}>{ariaLabel}</title>}
            {decorative ? null : <desc id={descriptionId}>{getAccessibleDescription(stage, companion)}</desc>}

            <g data-layer="habitat" aria-hidden="true">
                <rect className="makimodon-art__sky" width="390" height="500" />
                <path className="makimodon-art__far-bank" d="M-31 219c59-91 133-111 221-62L91 176Z" />
                <path className="makimodon-art__left-leaf" d="M-14 163c42-54 83-65 123-35l-63 25Z" />
                <path className="makimodon-art__right-leaf" d="M359 86c30 23 38 56 23 98-28-26-35-59-23-98Z" />
                <path className="makimodon-art__cream-leaf" d="M273 82c13-22 29-31 48-26-8 24-24 33-48 26Z" />
                <path className="makimodon-art__ground" d="M0 411c58-19 105-13 145 17 38 28 82 27 132-2 39-23 77-22 113 3v71H0Z" />
                <path className="makimodon-art__ground-seam" d="M0 453c52-20 100-17 144 8 42 24 88 21 137-6 41-23 77-20 109 5" />
            </g>

            <g data-layer="shadows" aria-hidden="true">
                {companion && !isPayoff ? <ellipse className="makimodon-art__shadow" cx="76" cy="403" rx="40" ry="8" /> : null}
                <ellipse className="makimodon-art__shadow" cx={stage === "trip" ? 274 : 277} cy={stage === "trip" ? 424 : 410} rx={stage === "trip" ? 111 : 102} ry="10" />
            </g>

            <g data-layer="subject" aria-hidden="true">
                <Creature stage={stage} />
            </g>

            {isPayoff ? (
                <g className="makimodon-art__rewind-trace" data-layer="rewind-trace" aria-hidden="true">
                    <path d="M86 387c63 1 118-25 160-80" />
                    <path d="m232 310 18-8-2 19" />
                </g>
            ) : null}

            {companion ? (
                <g data-layer="companion" aria-hidden="true">
                    <Companion stage={stage} />
                </g>
            ) : null}

            {isPayoff && companion ? (
                <g className="makimodon-art__seat-rim" data-layer="seat-rim" aria-hidden="true">
                    <path className="makimodon-art__seat-rim-outline" d="M245 236c19 16 42 17 65 1" />
                    <path className="makimodon-art__seat-rim-fill" d="M245 236c19 16 42 17 65 1" />
                </g>
            ) : null}
        </svg>
    );
};
