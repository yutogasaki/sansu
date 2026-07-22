import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, Compass, Lightbulb, Sparkles } from "lucide-react";
import { ExploreGlyph } from "./ExploreGlyph";
import { useExploreStageFocus } from "./useExploreStageFocus";

interface ExploreIntroProps {
    energy: number;
    onStart: () => void;
    onExit: () => void;
}

export const ExploreIntro: React.FC<ExploreIntroProps> = ({ energy, onStart, onExit }) => {
    const reduceMotion = useReducedMotion();
    const headingRef = useExploreStageFocus<HTMLHeadingElement>();

    return (
        <div className="relative flex h-full flex-col overflow-y-auto px-3 pb-[calc(var(--safe-area-bottom)+16px)] pt-[calc(var(--safe-area-top)+10px)] sm:px-5">
            <button
                type="button"
                onClick={onExit}
                className="explore-focus-ring relative z-20 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/80 bg-white/76 text-slate-600 shadow-sm backdrop-blur-md"
                aria-label="あそびメニューへ もどる"
            >
                <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </button>

            <div className="flex flex-1 items-center justify-center py-3 sm:py-5">
                <motion.section
                    className="relative isolate w-full max-w-3xl"
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduceMotion ? 0.12 : 0.32, ease: "easeOut" }}
                    aria-labelledby="explore-intro-title"
                >
                    <div className="explore-map-frame relative mx-1 h-[clamp(228px,35dvh,310px)] overflow-hidden rounded-[38px] sm:mx-5">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_20%,rgba(103,232,249,0.34),transparent_25%),radial-gradient(circle_at_18%_44%,rgba(253,230,138,0.18),transparent_24%)]" aria-hidden="true" />
                        <div className="pointer-events-none absolute -left-20 -top-12 h-52 w-48 rotate-12 rounded-[48%] bg-cyan-950/18 shadow-[inset_-14px_-10px_0_rgba(255,255,255,0.04)]" aria-hidden="true" />
                        <div className="pointer-events-none absolute -right-20 -top-8 h-56 w-52 -rotate-12 rounded-[48%] bg-teal-950/16 shadow-[inset_14px_-10px_0_rgba(255,255,255,0.04)]" aria-hidden="true" />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[35%] rounded-[50%_50%_0_0/32%_32%_0_0] bg-emerald-300/24" aria-hidden="true" />

                        <svg
                            className="pointer-events-none absolute inset-0 h-full w-full"
                            viewBox="0 0 360 250"
                            preserveAspectRatio="none"
                            aria-hidden="true"
                        >
                            <path
                                d="M42 218 C86 202 87 166 135 166 C181 166 170 112 224 111 C276 110 268 64 318 44"
                                fill="none"
                                stroke="rgba(255,255,255,0.16)"
                                strokeWidth="8"
                                strokeLinecap="round"
                            />
                            <motion.path
                                d="M42 218 C86 202 87 166 135 166 C181 166 170 112 224 111 C276 110 268 64 318 44"
                                fill="none"
                                stroke="var(--explore-sand)"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeDasharray="4 9"
                                initial={reduceMotion ? false : { pathLength: 0, opacity: 0.35 }}
                                animate={{ pathLength: 1, opacity: 0.9 }}
                                transition={{ duration: reduceMotion ? 0 : 1.1, delay: 0.12, ease: "easeOut" }}
                            />
                        </svg>

                        <span className="absolute bottom-[9%] left-[5%] text-cyan-50 drop-shadow-[0_14px_20px_rgba(8,47,73,0.42)]" aria-hidden="true">
                            <ExploreGlyph kind="start" className="h-20 w-20 sm:h-24 sm:w-24" />
                        </span>
                        <span className="absolute bottom-[28%] left-[26%] text-emerald-50 opacity-90" aria-hidden="true">
                            <ExploreGlyph kind="root" className="h-14 w-14 sm:h-16 sm:w-16" />
                        </span>
                        <span className="absolute bottom-[35%] right-[27%] text-amber-50 opacity-90" aria-hidden="true">
                            <ExploreGlyph kind="flower" className="h-14 w-14 sm:h-16 sm:w-16" />
                        </span>
                        <motion.span
                            className="absolute right-[6%] top-[5%] text-cyan-50 drop-shadow-[0_0_28px_rgba(103,232,249,0.72)]"
                            animate={reduceMotion ? undefined : { y: [0, -5, 0], rotate: [0, 2, 0] }}
                            transition={reduceMotion ? undefined : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                            aria-hidden="true"
                        >
                            <ExploreGlyph kind="crystal" className="h-24 w-24 sm:h-28 sm:w-28" />
                        </motion.span>
                        <Sparkles className="absolute right-[28%] top-[18%] h-6 w-6 text-amber-200" aria-hidden="true" />

                        <p className="absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/30 bg-cyan-950/34 px-3 py-1 text-[10px] font-extrabold tracking-[0.12em] text-white shadow-sm backdrop-blur-sm">
                            水晶の森が ひかってる
                        </p>
                    </div>

                    <div className="explore-field-sheet relative -mt-8 rounded-[34px] px-5 pb-5 pt-7 text-center sm:px-8 sm:pb-7 sm:pt-8">
                        <div className="absolute left-1/2 top-0 h-3 w-24 -translate-x-1/2 rounded-b-full bg-amber-200/70" aria-hidden="true" />
                        <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-[0.14em] text-cyan-700">
                            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                            きょうの たんけん
                        </p>
                        <h1
                            id="explore-intro-title"
                            ref={headingRef}
                            tabIndex={-1}
                            className="mt-1 text-[clamp(27px,6vw,40px)] font-black leading-tight tracking-[-0.035em] text-slate-800 focus:outline-none"
                        >
                            ひかりの ちていたんけん
                        </h1>
                        <p className="mx-auto mt-2 max-w-lg text-sm font-semibold leading-6 text-slate-600 sm:text-base sm:leading-7">
                            さんすうの ひかりで岩をひらいて、<br className="sm:hidden" />
                            じぶんだけの道を みつけよう。
                        </p>

                        <div className="explore-specimen-card mx-auto mt-4 flex max-w-lg items-center justify-between gap-3 rounded-[20px] px-4 py-3 text-left">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-amber-100 text-amber-800" aria-hidden="true">
                                <Lightbulb className="h-6 w-6" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[10px] font-extrabold tracking-[0.12em] text-amber-700">ランタンの ひかり</span>
                                <span className="block text-sm font-extrabold text-slate-700">{energy}こを もって、どこまで行ける？</span>
                            </span>
                            <span className="text-2xl font-black text-amber-700" aria-hidden="true">{energy}</span>
                        </div>

                        <button
                            type="button"
                            onClick={onStart}
                            className="explore-primary-action explore-focus-ring mt-4 h-14 w-full max-w-lg rounded-[18px] text-lg font-black transition active:scale-[0.98]"
                        >
                            ひかりを もって しゅっぱつ
                        </button>
                    </div>
                </motion.section>
            </div>
        </div>
    );
};
