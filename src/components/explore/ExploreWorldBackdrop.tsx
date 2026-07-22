import React from "react";

/**
 * Static paper-cut scenery shared by the exploration flow.
 * The world stays legible with motion and sound disabled; action components
 * provide the short, earned peaks on top of this calm backdrop.
 */
export const ExploreWorldBackdrop: React.FC = () => (
    <div className="explore-world-layer pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 430 844"
            preserveAspectRatio="none"
            fill="none"
        >
            <defs>
                <linearGradient id="explore-cave-ceiling" x1="30" y1="0" x2="370" y2="250" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#0B5262" stopOpacity="0.28" />
                    <stop offset="1" stopColor="#2D8B7D" stopOpacity="0.08" />
                </linearGradient>
                <linearGradient id="explore-cave-floor" x1="215" y1="650" x2="215" y2="844" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#65B985" stopOpacity="0" />
                    <stop offset="1" stopColor="#2B8177" stopOpacity="0.22" />
                </linearGradient>
                <radialGradient id="explore-lantern-haze" cx="0" cy="0" r="1" gradientTransform="translate(215 360) rotate(90) scale(330 260)" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FFF3A8" stopOpacity="0.22" />
                    <stop offset="1" stopColor="#FFF3A8" stopOpacity="0" />
                </radialGradient>
            </defs>

            <path
                d="M0 0H430V56C387 42 351 70 319 91C283 114 252 88 220 70C173 44 132 77 94 96C59 114 28 88 0 73V0Z"
                fill="url(#explore-cave-ceiling)"
            />
            <path
                d="M0 126C55 94 88 126 128 144C168 162 199 127 240 118C286 108 315 151 354 153C384 154 407 137 430 120"
                stroke="#FFFFFF"
                strokeOpacity="0.28"
                strokeWidth="1.4"
            />
            <path
                d="M0 163C51 141 89 171 129 185C171 201 204 163 244 159C288 155 322 194 360 192C389 190 410 173 430 159"
                stroke="#155F70"
                strokeOpacity="0.08"
                strokeWidth="1.2"
            />

            <ellipse cx="215" cy="360" rx="260" ry="330" fill="url(#explore-lantern-haze)" />

            <path
                d="M0 694C46 673 77 701 115 714C153 727 189 704 225 694C273 681 310 723 352 722C383 721 407 704 430 689V844H0V694Z"
                fill="url(#explore-cave-floor)"
            />
            <path
                d="M0 748C47 718 82 754 124 764C169 776 196 738 240 742C284 746 317 780 358 778C389 777 410 757 430 742"
                stroke="#FFFFFF"
                strokeOpacity="0.32"
                strokeWidth="1.3"
            />
            <path d="M30 810C48 776 66 763 88 754C88 781 72 802 42 820Z" fill="#76C795" fillOpacity="0.16" />
            <path d="M400 805C383 773 365 760 342 751C343 781 360 801 391 818Z" fill="#70D2C2" fillOpacity="0.13" />
        </svg>

        <span className="absolute left-[8%] top-[18%] h-1.5 w-1.5 rounded-full bg-white/70 shadow-[0_0_16px_5px_rgba(255,255,255,0.34)]" />
        <span className="absolute right-[13%] top-[29%] h-2 w-2 rounded-full bg-cyan-100/75 shadow-[0_0_20px_6px_rgba(103,232,249,0.28)]" />
        <span className="absolute left-[19%] top-[56%] h-1 w-1 rounded-full bg-amber-100/85 shadow-[0_0_14px_4px_rgba(253,230,138,0.3)]" />
        <span className="absolute right-[22%] top-[68%] h-1.5 w-1.5 rounded-full bg-white/65 shadow-[0_0_16px_5px_rgba(255,255,255,0.24)]" />
    </div>
);
