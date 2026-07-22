import { cn } from "../../utils/cn";

export type RibbonAntennaCompanionPose = "ready" | "trace" | "listen";

interface RibbonAntennaCompanionProps {
    pose?: RibbonAntennaCompanionPose;
    className?: string;
}

/**
 * Authored companion model used by the cut-paper live encounters.
 *
 * The paths intentionally keep the same pear body, uneven ribbon antennae,
 * long feet, and field bag across poses. The host SVG owns accessibility copy.
 */
export const RibbonAntennaCompanion = ({
    pose = "ready",
    className,
}: RibbonAntennaCompanionProps) => (
    <g
        className={cn(
            "ribbon-antenna-companion",
            `ribbon-antenna-companion--${pose}`,
            className,
        )}
        data-companion-pose={pose}
    >
        <path
            className="ribbon-antenna-companion__body"
            d="M29 5C13 18 4 47 9 77c4 24 12 38 25 41 8 2 19-2 25-10 10-14 10-34 4-53C55 30 43 12 29 5Z"
        />
        <path
            className="ribbon-antenna-companion__antennae"
            d="M25 8C18-10 11-20 0-23M35 9C43-2 49-7 57-7"
        />
        <circle className="ribbon-antenna-companion__eye" cx="25" cy="48" r="2.8" />
        <circle className="ribbon-antenna-companion__eye" cx="39" cy="45" r="2.8" />

        {pose === "trace" ? (
            <>
                <path className="ribbon-antenna-companion__limb" d="M48 68c15-5 27-2 39 8" />
                <path className="ribbon-antenna-companion__limb" d="M26 117c-8 9-12 19-10 29M44 115c10 7 16 17 18 29" />
            </>
        ) : pose === "listen" ? (
            <>
                <path className="ribbon-antenna-companion__limb" d="M17 67C5 57 0 47 2 36M49 65c13-8 22-18 26-31" />
                <path className="ribbon-antenna-companion__limb" d="M22 117c-13 8-21 18-23 30M47 116c15 7 25 17 31 29" />
            </>
        ) : (
            <>
                <path className="ribbon-antenna-companion__limb" d="M16 69 1 61M49 68l13-9" />
                <path className="ribbon-antenna-companion__limb" d="M27 118c-4 8-5 14-2 20M43 113c12 5 20 15 23 31" />
            </>
        )}

        <path className="ribbon-antenna-companion__bag" d="M1 69c-14 1-19 10-18 25L8 98V72Z" />
        <path className="ribbon-antenna-companion__bag-detail" d="M-12 76v14m3-20 10-10" />
    </g>
);
