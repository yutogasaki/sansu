import { cn } from "../../utils/cn";

export type RibbonAntennaCompanionPose = "ready" | "trace" | "listen";

interface RibbonAntennaCompanionProps {
    pose?: RibbonAntennaCompanionPose;
    className?: string;
}

/**
 * Canonical Pokko companion used by the cut-paper live encounters.
 *
 * The legacy export name is kept so encounter APIs and pose choreography remain
 * stable. Pokko's broad leaf hat, golden seed body, tiny black limbs, and field
 * bag stay fixed across poses. The host SVG owns accessibility copy.
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
        data-character-id="pokko"
        data-visual-lineage-id="pokko-field-v1"
        data-visual-candidate-id="pokko-cut-paper-v1"
        data-visual-mode="world-live"
    >
        <path
            className="ribbon-antenna-companion__bag"
            d="M13 69C1 67-7 74-8 88l20 7 9-21Z"
            fill="var(--explore-turquoise)"
            stroke="var(--explore-outline)"
            strokeWidth="4"
            strokeLinejoin="round"
        />
        <path
            className="ribbon-antenna-companion__bag-detail"
            d="M-3 78 12 82M5 70 21 51"
            fill="none"
            stroke="var(--explore-outline)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
        />

        <path
            className="ribbon-antenna-companion__body"
            d="M38 23C20 23 9 42 10 70c1 30 13 49 32 49 20 0 32-18 31-47-1-30-15-49-35-49Z"
            fill="var(--explore-amber)"
            stroke="var(--explore-outline)"
            strokeWidth="4"
            strokeLinejoin="round"
        />
        <path
            className="ribbon-antenna-companion__body-texture"
            d="M20 48c9-7 18-8 27-6M17 82c12 8 28 10 43 4M29 103c7-3 14-3 22 0"
            fill="none"
            stroke="var(--explore-coral)"
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.2"
        />
        <path
            className="ribbon-antenna-companion__body-grain"
            d="m23 65 3-2m29 7 4-2m-30 24 4-1m22-39 3-1"
            fill="none"
            stroke="var(--explore-cream)"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.48"
        />

        <path
            className="ribbon-antenna-companion__hat"
            d="M-10 29C7 4 38-12 78-2 68 17 49 32 22 39 8 43-4 38-10 29Z"
            fill="var(--explore-moss)"
            stroke="var(--explore-outline)"
            strokeWidth="4"
            strokeLinejoin="round"
        />
        <path
            className="ribbon-antenna-companion__hat-fold"
            d="M-2 31C20 25 43 14 69 2M20 26c-1-10 2-20 9-29M44 16c2-7 7-13 14-18"
            fill="none"
            stroke="var(--explore-cave-mid)"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.7"
        />
        <path
            className="ribbon-antenna-companion__hat-highlight"
            d="M5 20C21 7 37 1 56 0M5 33c10 1 20 0 29-3"
            fill="none"
            stroke="var(--explore-turquoise)"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.38"
        />

        <ellipse
            className="ribbon-antenna-companion__eye"
            cx="31"
            cy="59"
            rx="2.8"
            ry="3.8"
            fill="var(--explore-outline)"
        />
        <ellipse
            className="ribbon-antenna-companion__eye"
            cx="48"
            cy="59"
            rx="2.8"
            ry="3.8"
            fill="var(--explore-outline)"
        />
        <path
            className="ribbon-antenna-companion__mouth"
            d={pose === "listen" ? "M35 70c4 5 8 5 12 0" : "M36 70c3 3 7 3 10 0"}
            fill="none"
            stroke="var(--explore-outline)"
            strokeWidth="2.8"
            strokeLinecap="round"
        />

        {pose === "trace" ? (
            <>
                <path
                    className="ribbon-antenna-companion__limb"
                    d="M64 72c11-6 21-5 29 2M19 75 4 82M29 115c-7 8-10 17-8 26M51 115c8 7 13 16 13 26"
                    fill="none"
                    stroke="var(--explore-outline)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    className="ribbon-antenna-companion__foot"
                    d="M13 142c5-5 11-5 16 0-3 5-12 6-16 0ZM57 142c5-5 12-4 16 1-4 5-12 5-16-1Z"
                    fill="var(--explore-outline)"
                />
            </>
        ) : pose === "listen" ? (
            <>
                <path
                    className="ribbon-antenna-companion__limb"
                    d="M18 74C7 65 2 56 3 46M64 71c11-8 18-17 21-27M28 115c-10 8-16 17-17 28M52 115c10 7 17 16 20 27"
                    fill="none"
                    stroke="var(--explore-outline)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    className="ribbon-antenna-companion__foot"
                    d="M3 144c5-5 12-5 17 0-4 5-13 6-17 0ZM65 143c5-5 12-4 17 1-4 5-13 5-17-1Z"
                    fill="var(--explore-outline)"
                />
            </>
        ) : (
            <>
                <path
                    className="ribbon-antenna-companion__limb"
                    d="M18 75 4 70M64 73l13-8M29 115c-5 8-6 17-4 26M51 115c7 7 11 16 11 26"
                    fill="none"
                    stroke="var(--explore-outline)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    className="ribbon-antenna-companion__foot"
                    d="M17 142c5-5 11-5 16 0-3 5-12 6-16 0ZM55 142c5-5 12-4 16 1-4 5-12 5-16-1Z"
                    fill="var(--explore-outline)"
                />
            </>
        )}
    </g>
);
