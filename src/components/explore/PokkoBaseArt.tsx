import { useId } from "react";
import { cn } from "../../utils/cn";
import { RibbonAntennaCompanion } from "./RibbonAntennaCompanion";

interface PokkoBaseArtProps {
    decorative?: boolean;
    className?: string;
}

/**
 * The base intentionally uses a simpler cut-paper map mode than painted
 * encounters, while keeping Pokko's canonical silhouette and palette.
 */
export const PokkoBaseArt = ({
    decorative = false,
    className,
}: PokkoBaseArtProps) => {
    const titleId = useId();
    const descriptionId = useId();

    return (
        <svg
            viewBox="0 0 390 510"
            preserveAspectRatio="xMidYMid slice"
            className={cn("pokko-base-art", className)}
            data-testid="pokko-base-art"
            data-visual-lineage-id="pokko-field-v1"
            data-visual-candidate-id="pokko-base-map-v1"
            data-visual-mode="base-map"
            role={decorative ? undefined : "img"}
            aria-hidden={decorative || undefined}
            aria-labelledby={decorative ? undefined : `${titleId} ${descriptionId}`}
        >
            {decorative ? null : <title id={titleId}>ポッコの探検基地</title>}
            {decorative ? null : (
                <desc id={descriptionId}>
                    葉帽子のポッコが、花と根っこの向こうへ続く地図を指さしている。
                </desc>
            )}
            <rect width="390" height="510" fill="#32bed1" />
            <path d="M0 0h116C97 40 62 70 0 88ZM390 0h-88c8 44 37 77 88 101Z" fill="#2f8c55" />
            <path d="M0 310C76 270 129 298 190 270c69-31 120-2 200-45v285H0Z" fill="#d99a27" />
            <path d="M116 510c14-91 53-158 118-201 48-31 94-65 156-132v333Z" fill="#fff4ce" opacity="0.95" />
            <path d="M236 260c26-53 48-78 67-75 17 2 25 23 15 42-11 23-38 23-48 5-11-19 1-42 26-53" fill="none" stroke="#e76f55" strokeWidth="22" strokeLinecap="round" />
            <g transform="translate(60 205) scale(1.55)">
                <RibbonAntennaCompanion pose="trace" />
            </g>
            <g transform="translate(302 132)">
                <circle r="40" fill="#fff4ce" stroke="#173f49" strokeWidth="5" />
                {[0, 60, 120, 180, 240, 300].map((rotation) => (
                    <ellipse
                        key={rotation}
                        cx="0"
                        cy="-49"
                        rx="19"
                        ry="35"
                        transform={`rotate(${rotation})`}
                        fill="#ef765f"
                        stroke="#173f49"
                        strokeWidth="4"
                    />
                ))}
                <circle r="18" fill="#f1c95c" stroke="#173f49" strokeWidth="4" />
            </g>
            <path d="M0 421c47-34 87-34 127-1L98 510H0ZM390 404c-49-24-91-10-132 29l22 77h110Z" fill="#227c50" />
            <path d="M9 447c34-24 62-23 92 0M292 454c30-25 58-29 91-9" fill="none" stroke="#61a84f" strokeWidth="25" strokeLinecap="round" />
        </svg>
    );
};
