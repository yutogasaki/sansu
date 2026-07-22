import React from "react";
import {
    FIREFLY_FLOWER_DISCOVERY_PAGE,
    type DiscoveryPageFeatureId,
} from "../../domain/explore";
import type { DiscoveryPageArtVariant } from "./DiscoveryPageArt";

export interface FireflyFlowerResearchArtProps {
    discoveredFeatureIds: readonly DiscoveryPageFeatureId[];
    variant?: DiscoveryPageArtVariant;
}

const SIDE_FLOWERS = [
    { x: 105, y: 159, scale: 0.62 },
    { x: 257, y: 154, scale: 0.58 },
] as const;

export const FireflyFlowerResearchArt: React.FC<FireflyFlowerResearchArtProps> = ({
    discoveredFeatureIds,
    variant = "reveal",
}) => {
    const [dewTrailFeatureId, warmBudFeatureId, petalsFeatureId, lightPathFeatureId] = (
        FIREFLY_FLOWER_DISCOVERY_PAGE.chain.featureIds
    );
    const showDewTrail = discoveredFeatureIds.includes(dewTrailFeatureId);
    const showWarmBud = discoveredFeatureIds.includes(warmBudFeatureId);
    const showPetals = discoveredFeatureIds.includes(petalsFeatureId);
    const showLightPath = discoveredFeatureIds.includes(lightPathFeatureId);

    return (
        <svg
            className={variant === "reveal" ? "h-auto w-full" : "h-full w-full"}
            viewBox="0 0 360 260"
            preserveAspectRatio={variant === "reveal" ? "xMidYMid meet" : "xMidYMid slice"}
            role="img"
            aria-label={`ほたる花の調査絵。${discoveredFeatureIds.length}件を発見`}
        >
            <path d="M0 0H360V260H0Z" fill="var(--explore-turquoise)" />
            <path d="M0 0H360V34L318 28 296 57 255 47 229 76 188 58 150 73 119 48 77 59 53 27 0 36Z" fill="var(--explore-outline)" />
            <path d="M0 0H50L72 76 48 116 64 168 32 209 0 219Z" fill="var(--explore-cave-mid)" />
            <path d="M360 0H310L291 69 315 112 300 170 334 209 360 220Z" fill="var(--explore-cave-mid)" />
            <path d="M0 211C74 183 110 224 176 202C244 180 286 218 360 194V260H0Z" fill="var(--explore-moss)" />
            <path d="M0 228C72 209 108 241 177 220C240 201 291 229 360 211" fill="none" stroke="var(--explore-parchment)" strokeOpacity="0.42" strokeWidth="4" strokeLinecap="round" />
            <path d="M9 247C83 221 116 255 185 231C248 209 298 244 351 222" fill="none" stroke="var(--explore-turquoise)" strokeWidth="9" strokeLinecap="round" />

            {showLightPath ? (
                <g>
                    <path
                        d="M169 191C153 211 136 232 123 260H238C225 232 208 211 190 191Z"
                        fill="var(--explore-outline)"
                        stroke="var(--explore-outline)"
                        strokeWidth="5"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M175 195C164 216 150 236 142 260H219C211 236 198 216 184 195Z"
                        fill="var(--explore-amber)"
                    />
                    <path
                        d="M180 202C179 220 180 238 181 258"
                        fill="none"
                        stroke="var(--explore-cream)"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray="2 11"
                    />
                </g>
            ) : null}

            <path d="M65 206C45 169 53 105 79 63" fill="none" stroke="var(--explore-outline)" strokeWidth="13" strokeLinecap="round" />
            <path d="M65 206C45 169 53 105 79 63" fill="none" stroke="var(--explore-moss)" strokeWidth="8" strokeLinecap="round" />
            <path d="M296 206C318 165 306 102 283 64" fill="none" stroke="var(--explore-outline)" strokeWidth="13" strokeLinecap="round" />
            <path d="M296 206C318 165 306 102 283 64" fill="none" stroke="var(--explore-moss)" strokeWidth="8" strokeLinecap="round" />

            {showDewTrail ? (
                <g>
                    {[{ cx: 63, cy: 151 }, { cx: 70, cy: 122 }, { cx: 83, cy: 93 }].map((drop) => (
                        <g key={`${drop.cx}-${drop.cy}`}>
                            <circle cx={drop.cx} cy={drop.cy} r="12" fill="var(--explore-outline)" />
                            <circle cx={drop.cx} cy={drop.cy} r="8" fill="var(--explore-amber)" />
                            <circle cx={drop.cx - 2} cy={drop.cy - 2} r="3" fill="var(--explore-cream)" />
                        </g>
                    ))}
                    {[{ cx: 298, cy: 143 }, { cx: 288, cy: 105 }].map((drop) => (
                        <g key={`${drop.cx}-${drop.cy}`}>
                            <circle cx={drop.cx} cy={drop.cy} r="12" fill="var(--explore-outline)" />
                            <circle cx={drop.cx} cy={drop.cy} r="8" fill="var(--explore-amber)" />
                            <circle cx={drop.cx - 2} cy={drop.cy - 2} r="3" fill="var(--explore-cream)" />
                        </g>
                    ))}
                </g>
            ) : null}

            {showLightPath ? (
                <g>
                    <path
                        d="M64 151C82 145 88 151 105 159C132 147 151 125 180 105C207 123 228 144 257 154C273 144 282 141 299 143"
                        fill="none"
                        stroke="var(--explore-outline)"
                        strokeWidth="13"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M64 151C82 145 88 151 105 159C132 147 151 125 180 105C207 123 228 144 257 154C273 144 282 141 299 143"
                        fill="none"
                        stroke="var(--explore-cream)"
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="3 13"
                    />
                    {SIDE_FLOWERS.map(({ x, y, scale }) => (
                        <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${scale})`}>
                            <path d="M0 13C-1 32 0 48 0 68" fill="none" stroke="var(--explore-outline)" strokeWidth="12" strokeLinecap="round" />
                            <path d="M0 13C-1 32 0 48 0 68" fill="none" stroke="var(--explore-moss)" strokeWidth="7" strokeLinecap="round" />
                            {[0, 72, 144, 216, 288].map((rotation) => (
                                <ellipse
                                    key={rotation}
                                    cx="0"
                                    cy="-12"
                                    rx="10"
                                    ry="18"
                                    fill="var(--explore-coral)"
                                    stroke="var(--explore-outline)"
                                    strokeWidth="4"
                                    transform={`rotate(${rotation} 0 0)`}
                                />
                            ))}
                            <circle r="10" fill="var(--explore-amber)" stroke="var(--explore-outline)" strokeWidth="4" />
                            <circle cx="-2" cy="-2" r="3" fill="var(--explore-cream)" />
                        </g>
                    ))}
                </g>
            ) : null}

            <path d="M181 213C177 185 179 150 180 119" fill="none" stroke="var(--explore-outline)" strokeWidth="14" strokeLinecap="round" />
            <path d="M181 213C177 185 179 150 180 119" fill="none" stroke="var(--explore-moss)" strokeWidth="8" strokeLinecap="round" />
            <path d="M177 177C149 157 132 166 126 189C148 193 166 188 177 177Z" fill="var(--explore-moss)" stroke="var(--explore-outline)" strokeWidth="5" strokeLinejoin="round" />
            <path d="M184 163C207 143 230 150 235 173C213 179 196 174 184 163Z" fill="var(--explore-moss)" stroke="var(--explore-outline)" strokeWidth="5" strokeLinejoin="round" />

            {showPetals ? (
                <g>
                    <circle cx="180" cy="104" r={showWarmBud ? 54 : 46} fill="var(--explore-amber)" fillOpacity={showWarmBud ? 0.2 : 0.08} />
                    {[0, 72, 144, 216, 288].map((rotation) => (
                        <ellipse
                            key={rotation}
                            cx="180"
                            cy="71"
                            rx="20"
                            ry="35"
                            fill="var(--explore-coral)"
                            stroke="var(--explore-outline)"
                            strokeWidth="5"
                            transform={`rotate(${rotation} 180 104)`}
                        />
                    ))}
                    <circle cx="180" cy="104" r="18" fill="var(--explore-amber)" stroke="var(--explore-outline)" strokeWidth="5" />
                    <circle cx="176" cy="100" r="5" fill="var(--explore-cream)" />
                    <path d="M128 81C116 65 110 54 112 43M235 78C249 63 254 51 253 39" fill="none" stroke="var(--explore-amber)" strokeWidth="4" strokeLinecap="round" />
                </g>
            ) : (
                <g>
                    <path d="M180 120C153 111 151 78 180 61C209 78 207 111 180 120Z" fill={showWarmBud ? "var(--explore-amber)" : "var(--explore-coral)"} stroke="var(--explore-outline)" strokeWidth="6" />
                    {showWarmBud ? <circle cx="180" cy="92" r="48" fill="var(--explore-amber)" fillOpacity="0.22" /> : null}
                </g>
            )}

            <g transform="translate(250 188)">
                <path d="M9 29C9 12 20 2 36 2C52 2 63 13 63 29C63 48 53 59 36 59C19 59 9 48 9 29Z" fill="var(--explore-parchment)" stroke="var(--explore-outline)" strokeWidth="5" />
                <path d="M18 9L9 -3L27 4M53 9L63 -2L45 4" fill="var(--explore-parchment)" stroke="var(--explore-outline)" strokeWidth="5" strokeLinejoin="round" />
                <circle cx="28" cy="28" r="3.5" fill="var(--explore-outline)" />
                <circle cx="45" cy="28" r="3.5" fill="var(--explore-outline)" />
                <path d={showLightPath ? "M30 38C34 46 41 46 45 38" : "M32 39C35 42 39 42 42 39"} fill="none" stroke="var(--explore-outline)" strokeWidth="3" strokeLinecap="round" />
                {showLightPath ? (
                    <path d="M13 38L1 27M59 38L70 25" fill="none" stroke="var(--explore-outline)" strokeWidth="5" strokeLinecap="round" />
                ) : null}
            </g>
        </svg>
    );
};
