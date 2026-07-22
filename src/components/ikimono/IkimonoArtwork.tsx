import { useState } from "react";
import { cn } from "../../utils/cn";

export type IkimonoImageSuffix = 1 | 2 | 3;

interface IkimonoArtworkProps {
    species: number;
    imageSuffix: IkimonoImageSuffix;
    alt?: string;
    className?: string;
    imageClassName?: string;
}

const FALLBACK_PALETTES = [
    { background: "#e4f6f1", body: "#63c8b4", accent: "#f2bc63", ink: "#20535a" },
    { background: "#e8f3fb", body: "#70b9d6", accent: "#f0a994", ink: "#244f62" },
    { background: "#f4f0df", body: "#a8c878", accent: "#efb75f", ink: "#405b46" },
    { background: "#f8ece7", body: "#df9f92", accent: "#79bcae", ink: "#604b50" },
    { background: "#e9f3ee", body: "#80bea0", accent: "#e6a86d", ink: "#31564c" },
    { background: "#eef0f8", body: "#9caed7", accent: "#edb966", ink: "#3e506a" },
    { background: "#f5eee4", body: "#d7aa78", accent: "#74b8b2", ink: "#604f43" },
    { background: "#e8f5f3", body: "#76c4c0", accent: "#e8a889", ink: "#28575c" },
    { background: "#f4edf4", body: "#c5a2c4", accent: "#e8b85f", ink: "#584b64" },
    { background: "#edf4e5", body: "#9dc278", accent: "#df9d78", ink: "#455943" },
] as const;

const normalizeSpecies = (species: number): number => {
    if (!Number.isFinite(species)) return 0;
    return Math.abs(Math.trunc(species)) % FALLBACK_PALETTES.length;
};

const IkimonoFallback: React.FC<{
    species: number;
    imageSuffix: IkimonoImageSuffix;
}> = ({ species, imageSuffix }) => {
    const normalizedSpecies = normalizeSpecies(species);
    const palette = FALLBACK_PALETTES[normalizedSpecies];
    const crownVariant = normalizedSpecies % 3;

    return (
        <svg
            viewBox="0 0 160 160"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
            focusable="false"
        >
            <circle cx="80" cy="80" r="80" fill={palette.background} />
            <path d="M0 124c28-18 52-17 78-4 27 13 53 13 82-5v45H0Z" fill={palette.body} opacity="0.14" />
            <circle cx="35" cy="43" r="5" fill={palette.accent} opacity="0.55" />
            <circle cx="128" cy="52" r="3" fill={palette.accent} opacity="0.72" />
            <path d="m126 29 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2-4.5-4.4 6.2-.9Z" fill={palette.accent} opacity="0.7" />

            {imageSuffix === 1 ? (
                <g>
                    <ellipse cx="80" cy="91" rx="43" ry="50" fill="#fffaf0" stroke={palette.ink} strokeWidth="5" />
                    <path d="M48 88c12-10 19-8 31 0 13 9 21 10 34-1" fill="none" stroke={palette.body} strokeWidth="7" strokeLinecap="round" />
                    <circle cx="65" cy="70" r="5" fill={palette.accent} opacity="0.68" />
                    <circle cx="97" cy="112" r="7" fill={palette.body} opacity="0.38" />
                    <path d="M72 48c4-8 12-11 19-8" fill="none" stroke={palette.accent} strokeWidth="6" strokeLinecap="round" />
                </g>
            ) : (
                <g>
                    {crownVariant === 0 ? (
                        <>
                            <ellipse cx="58" cy="46" rx="13" ry="24" transform="rotate(-28 58 46)" fill={palette.body} stroke={palette.ink} strokeWidth="5" />
                            <ellipse cx="102" cy="46" rx="13" ry="24" transform="rotate(28 102 46)" fill={palette.body} stroke={palette.ink} strokeWidth="5" />
                        </>
                    ) : crownVariant === 1 ? (
                        <>
                            <path d="M61 51c-8-15-9-25-2-31M99 51c8-15 9-25 2-31" fill="none" stroke={palette.ink} strokeWidth="5" strokeLinecap="round" />
                            <circle cx="58" cy="19" r="8" fill={palette.accent} stroke={palette.ink} strokeWidth="4" />
                            <circle cx="102" cy="19" r="8" fill={palette.accent} stroke={palette.ink} strokeWidth="4" />
                        </>
                    ) : (
                        <path d="M48 59c-11-21 5-34 19-19 5-20 27-20 31 0 15-15 31-2 19 19" fill={palette.body} stroke={palette.ink} strokeWidth="5" strokeLinejoin="round" />
                    )}

                    <ellipse cx="80" cy="91" rx={imageSuffix === 2 ? 42 : 49} ry={imageSuffix === 2 ? 43 : 49} fill={palette.body} stroke={palette.ink} strokeWidth="5" />
                    <ellipse cx="80" cy="104" rx="29" ry="24" fill="#fffaf0" opacity="0.62" />
                    <ellipse cx="63" cy="83" rx="5" ry="7" fill={palette.ink} />
                    <ellipse cx="97" cy="83" rx="5" ry="7" fill={palette.ink} />
                    <circle cx="61" cy="80" r="1.8" fill="#ffffff" />
                    <circle cx="95" cy="80" r="1.8" fill="#ffffff" />
                    <path d="M73 97c5 5 10 5 15 0" fill="none" stroke={palette.ink} strokeWidth="4" strokeLinecap="round" />
                    <circle cx="51" cy="99" r="7" fill={palette.accent} opacity="0.5" />
                    <circle cx="109" cy="99" r="7" fill={palette.accent} opacity="0.5" />

                    {imageSuffix === 2 ? (
                        <path d="M39 116c10-7 18-6 27 0 10 7 19 7 29 0 10-6 19-6 27 1l-7 24H46Z" fill="#fffaf0" stroke={palette.ink} strokeWidth="5" strokeLinejoin="round" />
                    ) : (
                        <>
                            <path d="M47 128c-7 4-11 10-9 16M113 128c7 4 11 10 9 16" fill="none" stroke={palette.ink} strokeWidth="6" strokeLinecap="round" />
                            <path d="M67 135c8 4 18 4 26 0" fill="none" stroke={palette.accent} strokeWidth="5" strokeLinecap="round" />
                        </>
                    )}
                </g>
            )}
        </svg>
    );
};

export const IkimonoArtwork: React.FC<IkimonoArtworkProps> = ({
    species,
    imageSuffix,
    alt = "",
    className,
    imageClassName,
}) => {
    const imageSource = `/ikimono/${normalizeSpecies(species)}-${imageSuffix}.webp`;
    const [loadedSource, setLoadedSource] = useState<string | null>(null);
    const isLoaded = loadedSource === imageSource;

    return (
        <div
            className={cn("relative block h-full w-full overflow-hidden bg-white", className)}
            role={alt ? "img" : undefined}
            aria-label={alt || undefined}
            aria-hidden={alt ? undefined : true}
        >
            <IkimonoFallback species={species} imageSuffix={imageSuffix} />
            <img
                src={imageSource}
                alt=""
                className={cn(
                    "pointer-events-none absolute left-1/2 top-1/2 z-10 h-full w-full -translate-x-1/2 -translate-y-1/2 object-cover transition-opacity duration-150",
                    isLoaded ? "opacity-100" : "opacity-0",
                    imageClassName,
                )}
                draggable={false}
                decoding="async"
                onLoad={() => setLoadedSource(imageSource)}
                onError={() => setLoadedSource((current) => current === imageSource ? null : current)}
            />
        </div>
    );
};
