import { useId } from "react";
import { cn } from "../../utils/cn";
import "./AuthoredEncounterArt.css";

export type AuthoredEncounterArtKind = "light-bridge" | "root-tangle";
export type AuthoredEncounterArtStage = "idle" | "incorrect" | "correct" | "resolved";

interface AuthoredEncounterArtProps {
    kind: AuthoredEncounterArtKind;
    stage: AuthoredEncounterArtStage;
    reducedMotion?: boolean;
    decorative?: boolean;
    className?: string;
}

const DESCRIPTIONS: Record<
    AuthoredEncounterArtKind,
    Record<AuthoredEncounterArtStage, string>
> = {
    "light-bridge": {
        idle: "左右から伸びた二本の紙リボン橋が、中央の留め具の手前で離れている。",
        incorrect: "紙リボン橋は離れたまま一度だけたわみ、相棒が踏ん張っている。",
        correct: "左右の紙リボンが中央でかちりと合わさり、一枚の橋になった。",
        resolved: "一枚につながった紙リボン橋を、相棒が向こう岸へ渡っている。",
    },
    "root-tangle": {
        idle: "太い紙の根が大きな輪を重ね、道をふさいでいる。",
        incorrect: "根の輪はほどけず、相棒の前でやわらかく丸まっている。",
        correct: "根の輪がほどけ、小さな足のように立ち上がって道を空けた。",
        resolved: "足になった根が列になって歩き、相棒の前に花の道が開いている。",
    },
};

const CompanionFigure = ({ pose }: { pose: "watch" | "brace" | "cross" | "surprised" }) => {
    const transform = pose === "brace"
        ? "translate(38 240) rotate(-8 34 70)"
        : pose === "cross"
            ? "translate(215 205) rotate(8 34 70)"
            : pose === "surprised"
                ? "translate(34 218) rotate(10 34 70)"
                : "translate(32 232)";

    return (
        <g className={cn("authored-encounter-art__companion", `is-${pose}`)} transform={transform}>
            <path className="authored-encounter-art__companion-body" d="M31 5C14 19 6 48 10 79c4 25 14 39 29 40 17 1 27-16 23-43C58 42 45 13 31 5Z" />
            <path className="authored-encounter-art__line" d="M26 9C17-9 9-17-3-17M39 9C48-2 55-5 64-2" />
            <circle className="authored-encounter-art__ink" cx="28" cy="49" r="3" />
            <circle className="authored-encounter-art__ink" cx="43" cy="47" r="3" />
            <path className="authored-encounter-art__limb" d={pose === "cross"
                ? "M25 116c-13 4-22 14-27 28M49 115c15 4 28 13 36 26"
                : pose === "brace"
                    ? "M23 116c-14 8-23 19-26 32M49 116c16 6 28 16 35 30"
                    : "M27 117c-5 9-6 17-2 25M48 115c12 7 20 17 23 29"}
            />
            <path className="authored-encounter-art__bag" d="M8 70c-14 1-19 10-18 24l24 5V72Z" />
            <path className="authored-encounter-art__bag-detail" d="M-5 77v14M-2 70 9 59" />
            {pose === "surprised" ? (
                <path className="authored-encounter-art__reaction" d="M68 26l12-8M70 39l15 1M61 13l5-13" />
            ) : null}
        </g>
    );
};

const LightBridgeScene = ({ stage }: { stage: AuthoredEncounterArtStage }) => {
    const connected = stage === "correct" || stage === "resolved";
    const companionPose = stage === "resolved" ? "cross" : stage === "incorrect" ? "brace" : "watch";

    return (
        <>
            <path className="authored-encounter-art__bank authored-encounter-art__bank--left" d="M0 355 0 510h148l26-78-36-78Z" />
            <path className="authored-encounter-art__bank authored-encounter-art__bank--right" d="M390 348v162H260l-31-77 34-80Z" />
            <path className="authored-encounter-art__water-line" d="M0 414c44-18 73 18 116 0s73 18 116 0 76 18 158-2M0 454c42-17 78 17 122 0s73 18 116 0 75 16 152-2" />
            <g className={cn("authored-encounter-art__bridge", connected && "is-connected", stage === "incorrect" && "is-incorrect")}>
                <path className="authored-encounter-art__bridge-ribbon authored-encounter-art__bridge-ribbon--left" d="M117 360 145 344l25 17 25-17" />
                <path className="authored-encounter-art__bridge-ribbon authored-encounter-art__bridge-ribbon--right" d="M273 360 246 344l-25 17-25-17" />
                {connected ? (
                    <>
                        <path className="authored-encounter-art__bridge-lock" d="m183 328 24-8 18 18-9 26-27 3-17-20Z" />
                        <path className="authored-encounter-art__bridge-seam" d="m185 347 11-7 10 7 10-7" />
                    </>
                ) : (
                    <>
                        <circle className="authored-encounter-art__bridge-eye" cx="185" cy="346" r="4" />
                        <circle className="authored-encounter-art__bridge-eye" cx="207" cy="346" r="4" />
                        <path className="authored-encounter-art__gap-mark" d="M195 315v-18M179 319l-10-14M212 319l11-14" />
                    </>
                )}
            </g>
            <path className="authored-encounter-art__anchor" d="M100 378 121 358l17 21-19 22ZM291 376l-19-19-17 22 20 20Z" />
            <CompanionFigure pose={companionPose} />
            {connected ? <path className="authored-encounter-art__motion-dash" d="M120 303c36-18 75-17 108 2" /> : null}
        </>
    );
};

const RootTangleScene = ({ stage }: { stage: AuthoredEncounterArtStage }) => {
    const opened = stage === "correct" || stage === "resolved";
    const companionPose = opened ? "surprised" : stage === "incorrect" ? "brace" : "watch";

    return (
        <>
            <path className="authored-encounter-art__root-ground" d="M0 363c71-40 119 4 181-8 64-12 116-53 209-3v158H0Z" />
            <path className="authored-encounter-art__root-path" d="M137 510c12-71 45-104 96-121 53-18 91-20 157-13" />
            <CompanionFigure pose={companionPose} />
            {!opened ? (
                <g className={cn("authored-encounter-art__root-knot", stage === "incorrect" && "is-incorrect")}>
                    <path className="authored-encounter-art__root-outline" d="M173 382c-9-64 59-96 87-48 21 37-34 69-62 39-28-30 4-87 52-78 51 9 59 84 12 108-38 20-82-17-65-56 18-41 83-44 111-7 28 38-6 91-49 82" />
                    <path className="authored-encounter-art__root-ribbon" d="M173 382c-9-64 59-96 87-48 21 37-34 69-62 39-28-30 4-87 52-78 51 9 59 84 12 108-38 20-82-17-65-56 18-41 83-44 111-7 28 38-6 91-49 82" />
                    <path className="authored-encounter-art__root-tip" d="m170 384-18 15 25 8ZM260 422l18 18 12-28Z" />
                </g>
            ) : (
                <g className="authored-encounter-art__root-walkers">
                    {[
                        { x: 173, y: 367, r: -10 },
                        { x: 220, y: 342, r: 7 },
                        { x: 269, y: 327, r: -5 },
                        { x: 315, y: 323, r: 9 },
                    ].map(({ x, y, r }, index) => (
                        <g key={x} transform={`translate(${x} ${y}) rotate(${r})`}>
                            <path className="authored-encounter-art__root-loop" d="M0 21C-3 4 12-7 26 1c13 8 12 26-1 34C12 43 2 36 0 21Z" />
                            <path className="authored-encounter-art__root-feet" d="M8 36 2 53M19 37l7 16" />
                            {index === 3 ? <circle className="authored-encounter-art__root-eye" cx="25" cy="16" r="2.8" /> : null}
                        </g>
                    ))}
                    <path className="authored-encounter-art__motion-dash" d="M167 422c42 20 101 4 151-44" />
                </g>
            )}
            <g className="authored-encounter-art__flower" transform="translate(318 255)">
                <path className="authored-encounter-art__flower-stem" d="M15 73c-5-31 2-54 17-71" />
                <path className="authored-encounter-art__flower-petal" d="M30 10C8-5-7 12 6 29c-20 3-18 27 2 29 1 20 27 21 33 3 17 11 34-10 20-25 19-14 1-38-18-27-2-19-26-19-28 1Z" />
                <circle className="authored-encounter-art__flower-center" cx="29" cy="31" r="10" />
            </g>
        </>
    );
};

export const AuthoredEncounterArt = ({
    kind,
    stage,
    reducedMotion = false,
    decorative = false,
    className,
}: AuthoredEncounterArtProps) => {
    const titleId = useId();
    const descriptionId = useId();
    const title = kind === "light-bridge" ? "かみリボンの橋" : "歩きだす根っこ";

    return (
        <svg
            viewBox="0 0 390 510"
            preserveAspectRatio="xMidYMid slice"
            className={cn(
                "authored-encounter-art",
                `authored-encounter-art--${kind}`,
                reducedMotion && "authored-encounter-art--reduced-motion",
                className,
            )}
            data-testid={`authored-${kind}-art`}
            data-kind={kind}
            data-stage={stage}
            data-reduced-motion={reducedMotion || undefined}
            role={decorative ? undefined : "img"}
            aria-hidden={decorative || undefined}
            aria-labelledby={decorative ? undefined : `${titleId} ${descriptionId}`}
        >
            {decorative ? null : <title id={titleId}>{title}</title>}
            {decorative ? null : <desc id={descriptionId}>{DESCRIPTIONS[kind][stage]}</desc>}
            <rect className="authored-encounter-art__sky" width="390" height="510" />
            <path className="authored-encounter-art__sky-patch is-cream" d="M0 0h158c-13 37-39 55-74 58C49 61 22 78 0 101Z" />
            <path className="authored-encounter-art__sky-patch is-leaf" d="M390 0h-86c2 28 17 51 45 69 20 13 32 33 41 60Z" />
            <path className="authored-encounter-art__sky-patch is-amber" d="M214 0h72l-16 30-44 10Z" />
            <path className="authored-encounter-art__horizon" d="M0 225c48-22 95 1 142-10 51-12 90-39 148-18 34 13 66 12 100-2v149H0Z" />
            {kind === "light-bridge"
                ? <LightBridgeScene stage={stage} />
                : <RootTangleScene stage={stage} />}
        </svg>
    );
};
