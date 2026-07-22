import React from "react";

export type ExploreGlyphKind =
    | "start"
    | "soil"
    | "crystal"
    | "fossil"
    | "root"
    | "mystery"
    | "unknown"
    | "bridge"
    | "flower"
    | "map"
    | "wood"
    | "stones"
    | "detour"
    | "balloon"
    | "rescued"
    | "light"
    | "spark";

export interface ExploreGlyphProps {
    kind: ExploreGlyphKind;
    className?: string;
    title?: string;
}

const ExploreGlyphArtwork: React.FC<{ kind: ExploreGlyphKind }> = ({ kind }) => {
    switch (kind) {
        case "start":
            return (
                <>
                    <circle cx="32" cy="32" r="27" fill="#E3F8F1" />
                    <path d="M8 49c7-5 15-7 24-7s17 2 24 7" fill="#A9E3CE" stroke="#185B69" strokeWidth="2.5" />
                    <path d="M15 44 28 21l15 23Z" fill="#FFD979" stroke="#185B69" strokeWidth="2.8" />
                    <path d="m28 21 15 23H31Z" fill="#6DD6C1" stroke="#185B69" strokeWidth="2.8" />
                    <path d="M31 44V32l7 12" fill="#245D70" stroke="#185B69" strokeWidth="2.5" />
                    <path d="M28 21v-7m0 0 10 3-10 3" fill="#FF8C78" stroke="#185B69" strokeWidth="2.5" />
                    <path d="m48 17 1.3 3.2 3.2 1.3-3.2 1.3L48 26l-1.3-3.2-3.2-1.3 3.2-1.3Z" fill="#FFF2A9" stroke="#185B69" strokeWidth="1.8" />
                </>
            );
        case "soil":
            return (
                <>
                    <circle cx="32" cy="32" r="27" fill="#F2FAE9" />
                    <path d="M9 45c1-8 6-13 13-15 3-8 10-12 17-9 5 2 7 6 8 11 5 2 8 7 8 13Z" fill="#D9B47B" stroke="#185B69" strokeWidth="2.8" />
                    <path d="M17 38c5 2 10 2 15-1m5-8c3 1 5 3 6 6m-24 9h10m7-2h10" stroke="#A87355" strokeWidth="2.6" />
                    <circle cx="20" cy="32" r="2.5" fill="#FFE99A" stroke="#185B69" strokeWidth="1.8" />
                    <path d="M29 21c-1-5 2-8 7-9-1 5-3 8-7 9Z" fill="#6FD09D" stroke="#185B69" strokeWidth="2" />
                </>
            );
        case "crystal":
            return (
                <>
                    <circle cx="32" cy="32" r="27" fill="#E0FAF8" />
                    <path d="m18 48-5-18 8-9 8 11-2 16Z" fill="#87E4D1" stroke="#185B69" strokeWidth="2.7" />
                    <path d="m27 48-3-25 9-13 9 14-4 24Z" fill="#69D6F0" stroke="#185B69" strokeWidth="2.8" />
                    <path d="m38 48-2-17 8-9 8 11-6 15Z" fill="#B9A7F4" stroke="#185B69" strokeWidth="2.7" />
                    <path d="m33 10-2 24 7 14m6-26 1 16m-24-17 2 18" stroke="#F7FFFF" strokeWidth="2.4" />
                    <path d="M12 49h41" stroke="#185B69" strokeWidth="2.8" />
                    <path d="m49 10 1.5 3.5L54 15l-3.5 1.5L49 20l-1.5-3.5L44 15l3.5-1.5Z" fill="#FFF0A6" stroke="#185B69" strokeWidth="1.7" />
                </>
            );
        case "fossil":
            return (
                <>
                    <circle cx="32" cy="32" r="27" fill="#FFF6DE" />
                    <path d="M10 34c0-14 10-23 24-23 13 0 21 8 21 20 0 14-10 23-25 23-13 0-20-8-20-20Z" fill="#F2D391" stroke="#185B69" strokeWidth="2.8" />
                    <path d="M21 41c-3-4-3-10 0-15 4-7 14-10 20-5 5 4 4 12-1 16-4 3-10 3-13-1-2-3 0-7 3-9 3-1 6 1 6 4 0 2-2 4-4 3" stroke="#A66F54" strokeWidth="3" />
                    <path d="m18 44 5-3m20-21 4-3" stroke="#FFF4C7" strokeWidth="2.6" />
                    <circle cx="45" cy="43" r="2.3" fill="#FFD979" stroke="#185B69" strokeWidth="1.8" />
                </>
            );
        case "root":
            return (
                <>
                    <circle cx="32" cy="32" r="27" fill="#E8F8E8" />
                    <path d="M11 50c4-15 8-22 16-27 7-4 13-7 16-15 4 8 2 15-4 20-6 6-13 9-15 22Z" fill="#BDE18B" stroke="#185B69" strokeWidth="2.8" />
                    <path d="M39 25c5-1 9-4 12-9M31 32c-5-2-9-5-11-10m7 17c-6 1-11 5-14 10m20-16c4 4 7 9 8 17" stroke="#7B9F65" strokeWidth="3" />
                    <path d="M48 15c-3-4-2-8 2-10 3 4 2 8-2 10Zm-30 7c-4-1-6-4-5-8 4 1 6 4 5 8Z" fill="#6CD09A" stroke="#185B69" strokeWidth="2" />
                </>
            );
        case "mystery":
            return (
                <>
                    <circle cx="32" cy="32" r="27" fill="#E7F8F5" />
                    <path d="M13 49c0-20 7-35 19-35s19 15 19 35Z" fill="#78CBBB" stroke="#185B69" strokeWidth="2.8" />
                    <path d="M21 49c0-13 4-23 11-23s11 10 11 23Z" fill="#245F70" stroke="#185B69" strokeWidth="2.5" />
                    <path d="M27 34c0-3 2-5 5-5 4 0 6 2 6 5 0 4-5 4-5 8" stroke="#FFF09E" strokeWidth="3.4" />
                    <circle cx="33" cy="46" r="2" fill="#FFF09E" />
                    <path d="m48 10 1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2Zm-34 9 .9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9Z" fill="#FFD979" stroke="#185B69" strokeWidth="1.5" />
                </>
            );
        case "unknown":
            return (
                <>
                    <circle cx="32" cy="32" r="27" fill="#E8F3F1" />
                    <path d="M13 48c0-18 7-32 19-32s19 14 19 32Z" fill="#9BBAB5" stroke="#185B69" strokeWidth="2.8" />
                    <path d="M22 48c0-11 4-20 10-20s10 9 10 20Z" fill="#527C82" stroke="#185B69" strokeWidth="2.5" />
                    <path d="M27 35c0-3 2-5 5-5 4 0 6 2 6 5 0 4-5 4-5 8" stroke="#F3F7F6" strokeWidth="3.4" />
                    <circle cx="33" cy="47" r="2" fill="#F3F7F6" />
                </>
            );
        case "bridge":
            return (
                <>
                    <circle cx="32" cy="32" r="27" fill="#E4F8F2" />
                    <path d="M7 48c7-5 12 5 19 0s12 5 19 0 10 0 12 1" stroke="#5CCBE2" strokeWidth="3" />
                    <path d="M12 41c8-14 32-14 40 0" stroke="#185B69" strokeWidth="3" />
                    <path d="M13 34v13m38-13v13" stroke="#185B69" strokeWidth="3" />
                    <path d="m15 38 6-2.5 5.5-1.5 5.5-.5 5.5.5 5.5 1.5 6 2.5-2 7-6-2-6-1-6 1-6 2Z" fill="#E9B96E" stroke="#185B69" strokeWidth="2.6" />
                    <path d="m23 35.5 1 8m8-10 .5 8m9.5-6-1 8" stroke="#A76F51" strokeWidth="2" />
                    <path d="M13 24c5-4 10-4 15 0m8 0c5-4 10-4 15 0" stroke="#83D5B7" strokeWidth="2.8" />
                </>
            );
        case "flower":
            return (
                <>
                    <circle cx="32" cy="32" r="27" fill="#EFF9E4" />
                    <path d="M32 35v19m0-7c-5-1-9-4-11-9 6 0 10 3 11 9Zm0 2c5-1 9-4 11-9-6 0-10 3-11 9Z" fill="#6FD09D" stroke="#185B69" strokeWidth="2.6" />
                    <ellipse cx="32" cy="19" rx="7" ry="10" fill="#FF9AA1" stroke="#185B69" strokeWidth="2.4" />
                    <ellipse cx="32" cy="31" rx="7" ry="10" fill="#B9A7F4" stroke="#185B69" strokeWidth="2.4" />
                    <ellipse cx="25" cy="25" rx="7" ry="10" transform="rotate(-60 25 25)" fill="#FFD979" stroke="#185B69" strokeWidth="2.4" />
                    <ellipse cx="39" cy="25" rx="7" ry="10" transform="rotate(60 39 25)" fill="#73D9E8" stroke="#185B69" strokeWidth="2.4" />
                    <circle cx="32" cy="25" r="6" fill="#FFF1A8" stroke="#185B69" strokeWidth="2.6" />
                </>
            );
        case "map":
            return (
                <>
                    <circle cx="32" cy="32" r="27" fill="#E5F8F3" />
                    <path d="m10 17 14-5 16 5 14-5v35l-14 5-16-5-14 5Z" fill="#FFF0B5" stroke="#185B69" strokeWidth="2.8" />
                    <path d="M24 12v35m16-30v35" stroke="#D09D63" strokeWidth="2.4" />
                    <path d="M17 40c3-7 8-10 14-9 5 1 7 7 12 7 3 0 5-2 6-5" stroke="#59BFA8" strokeWidth="2.8" strokeDasharray="2.5 4" />
                    <circle cx="17" cy="40" r="2.5" fill="#FF8C78" stroke="#185B69" strokeWidth="1.7" />
                    <path d="m47 23 1.4 3.4 3.4 1.4-3.4 1.4-1.4 3.4-1.4-3.4-3.4-1.4 3.4-1.4Z" fill="#6FD7EE" stroke="#185B69" strokeWidth="1.7" />
                </>
            );
        case "wood":
            return (
                <>
                    <circle cx="32" cy="32" r="27" fill="#F1F8E8" />
                    <g transform="rotate(-8 32 32)">
                        <rect x="10" y="18" width="44" height="12" rx="6" fill="#E8B670" stroke="#185B69" strokeWidth="2.7" />
                        <rect x="10" y="34" width="44" height="12" rx="6" fill="#CF935D" stroke="#185B69" strokeWidth="2.7" />
                        <ellipse cx="48" cy="24" rx="5" ry="4" fill="#F8D38F" stroke="#A66E50" strokeWidth="1.8" />
                        <ellipse cx="16" cy="40" rx="5" ry="4" fill="#E8B670" stroke="#A66E50" strokeWidth="1.8" />
                        <path d="M21 22h18m-11 6h11m-6 10h12m-26 5h8" stroke="#A66E50" strokeWidth="2.2" />
                    </g>
                    <path d="m47 11 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z" fill="#FFF09E" stroke="#185B69" strokeWidth="1.5" />
                </>
            );
        case "stones":
            return (
                <>
                    <circle cx="32" cy="32" r="27" fill="#E1F8F6" />
                    <path d="M7 46c7-5 12 5 19 0s12 5 19 0 10 0 12 1M8 53c7-4 12 4 19 0s12 4 19 0 9 0 11 1" stroke="#58C9E1" strokeWidth="2.7" />
                    <path d="M10 40c0-5 4-8 9-8s9 3 9 8Z" fill="#A9C5BF" stroke="#185B69" strokeWidth="2.7" />
                    <path d="M25 31c0-6 4-10 10-10s10 4 10 10Z" fill="#D5D7BE" stroke="#185B69" strokeWidth="2.7" />
                    <path d="M42 39c0-5 3-8 8-8 4 0 7 3 7 8Z" fill="#94CDB8" stroke="#185B69" strokeWidth="2.7" />
                    <path d="M15 36h7m9-9h8m8 8h5" stroke="#F8FFFF" strokeWidth="2" />
                </>
            );
        case "detour":
            return (
                <>
                    <circle cx="32" cy="32" r="27" fill="#ECF8E8" />
                    <path d="M25 47c-7-3-11-9-10-16 1-9 8-15 18-15h8" stroke="#E4B66F" strokeWidth="8" />
                    <path d="M25 47c-7-3-11-9-10-16 1-9 8-15 18-15h8" stroke="#185B69" strokeWidth="2.7" strokeDasharray="3 4" />
                    <path d="m38 10 8 6-8 6" fill="#FFD979" stroke="#185B69" strokeWidth="2.7" />
                    <path d="M28 52c4-13 9-18 17-22 2 9-3 18-17 22Z" fill="#79D29D" stroke="#185B69" strokeWidth="2.6" />
                    <path d="M32 48c4-4 7-8 10-13" stroke="#4A9A78" strokeWidth="2.2" />
                    <circle cx="16" cy="31" r="3" fill="#73D9E8" stroke="#185B69" strokeWidth="1.8" />
                </>
            );
        case "balloon":
        case "rescued":
            return (
                <>
                    <circle cx="32" cy="32" r="27" fill="#E2F8F4" />
                    <path d="M16 24c0-10 7-17 16-17s16 7 16 17c0 11-8 18-13 23h-6c-5-5-13-12-13-23Z" fill="#FF9A8A" stroke="#185B69" strokeWidth="2.8" />
                    <path d="M25 9c-3 10-2 26 6 38m8-38c3 10 2 26-6 38" fill="#FFD979" stroke="#185B69" strokeWidth="2.4" />
                    <path d="M20 29h24" stroke="#FFF4C0" strokeWidth="2.4" />
                    <path d="m28 47-2 6m10-6 2 6" stroke="#185B69" strokeWidth="2.4" />
                    <path d="M25 52h14l-2 7H27Z" fill="#D59A62" stroke="#185B69" strokeWidth="2.6" />
                    <path d="m51 13 .9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9Z" fill="#FFF09E" stroke="#185B69" strokeWidth="1.5" />
                </>
            );
        case "light":
            return (
                <>
                    <circle cx="32" cy="32" r="27" fill="#F1FAE6" />
                    <circle cx="32" cy="30" r="18" fill="#FFF2A4" opacity="0.55" />
                    <path d="M23 25c0-6 4-10 9-10s9 4 9 10v19H23Z" fill="#FFF0A1" stroke="#185B69" strokeWidth="2.8" />
                    <path d="M27 16c0-4 2-7 5-7s5 3 5 7M20 44h24m-19 0-3 9m17-9 3 9" stroke="#185B69" strokeWidth="2.7" />
                    <path d="M28 33c0-4 2-7 4-10 3 3 5 6 4 10 0 3-2 5-4 5s-4-2-4-5Z" fill="#FF9A78" stroke="#185B69" strokeWidth="2" />
                    <path d="m49 20 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z" fill="#6ED9E9" stroke="#185B69" strokeWidth="1.5" />
                </>
            );
        case "spark":
            return (
                <>
                    <circle cx="32" cy="32" r="27" fill="#E7F9F4" />
                    <path d="m32 8 5.7 15.3L53 29l-15.3 5.7L32 50l-5.7-15.3L11 29l15.3-5.7Z" fill="#FFD979" stroke="#185B69" strokeWidth="2.8" />
                    <path d="m48 43 2 5 5 2-5 2-2 5-2-5-5-2 5-2Zm-32-32 1.4 3.6L21 16l-3.6 1.4L16 21l-1.4-3.6L11 16l3.6-1.4Z" fill="#73D9E8" stroke="#185B69" strokeWidth="1.8" />
                    <circle cx="32" cy="29" r="4" fill="#FFF8D5" />
                </>
            );
    }
};

export const ExploreGlyph: React.FC<ExploreGlyphProps> = ({ kind, className, title }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
        width="1em"
        height="1em"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        role={title ? "img" : undefined}
        aria-label={title}
        aria-hidden={title ? undefined : true}
        focusable="false"
    >
        <ExploreGlyphArtwork kind={kind} />
    </svg>
);
