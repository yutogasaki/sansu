import React, { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Backpack, Sparkles } from "lucide-react";
import {
    getDiscoveryPageDefinition,
    isDiscoveryPageBigDiscovery,
    type DiscoveryKind,
    type DiscoveryPageFeatureId,
    type DiscoveryPageId,
} from "../../domain/explore";
import {
    DiscoveryResearchReveal,
    type DiscoveryResearchRevealItem,
} from "./DiscoveryResearchReveal";
import { ExploreGlyph } from "./ExploreGlyph";

export interface DiscoveryRevealItem {
    name: string;
    kind: DiscoveryKind;
    rarity: "common" | "rare";
    discoveryPageId?: DiscoveryPageId;
    discoveryFeatureId?: DiscoveryPageFeatureId;
}

export const NON_BLOCKING_DISCOVERY_DURATION_MS = 900;

// eslint-disable-next-line react-refresh/only-export-components -- the page uses this as its shared interaction lock contract.
export const isBlockingDiscoveryReveal = (discovery: DiscoveryRevealItem): boolean => {
    if (discovery.discoveryPageId && discovery.discoveryFeatureId) {
        const definition = getDiscoveryPageDefinition(discovery.discoveryPageId);
        return Boolean(
            definition
            && isDiscoveryPageBigDiscovery(definition, discovery.discoveryFeatureId),
        );
    }

    return false;
};

interface DiscoveryRevealProps {
    discovery: DiscoveryRevealItem;
    researchPage?: DiscoveryResearchRevealItem;
    onContinue: () => void;
}

export const DiscoveryReveal: React.FC<DiscoveryRevealProps> = ({
    discovery,
    researchPage,
    onContinue,
}) => {
    const reduceMotion = useReducedMotion();
    const continueButtonRef = useRef<HTMLButtonElement>(null);
    const isBlockingReveal = isBlockingDiscoveryReveal(discovery);

    useEffect(() => {
        if (isBlockingReveal) return;
        const timer = window.setTimeout(onContinue, NON_BLOCKING_DISCOVERY_DURATION_MS);
        return () => window.clearTimeout(timer);
    }, [isBlockingReveal, onContinue]);

    useEffect(() => {
        if (researchPage || !isBlockingReveal) return;
        const previouslyFocused = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        continueButtonRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" || event.key === "Enter") {
                event.preventDefault();
                if (!event.repeat) onContinue();
                return;
            }
            if (event.key === "Tab") {
                event.preventDefault();
                continueButtonRef.current?.focus();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            if (previouslyFocused?.isConnected) previouslyFocused.focus();
        };
    }, [isBlockingReveal, onContinue, researchPage]);

    if (researchPage) {
        return (
            <DiscoveryResearchReveal
                {...researchPage}
                onContinue={onContinue}
            />
        );
    }

    if (!isBlockingReveal) {
        return (
            <div className="pointer-events-none absolute inset-x-3 top-[calc(var(--safe-area-top)+66px)] z-50 mx-auto max-w-sm" role="status" aria-live="polite">
                <motion.div
                    className="explore-specimen-card relative flex items-center gap-3 overflow-hidden rounded-[22px] p-3 backdrop-blur-md"
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 54, scale: 0.84 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 62, y: -16, scale: 0.78 }}
                    transition={{ duration: reduceMotion ? 0.1 : 0.24, ease: "easeOut" }}
                >
                    <div className="absolute inset-y-0 left-0 w-1.5 bg-[linear-gradient(180deg,var(--explore-crystal),var(--explore-sand))]" aria-hidden="true" />
                    <span className="relative ml-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-dashed border-cyan-200 bg-cyan-50 text-cyan-900" aria-hidden="true">
                        <ExploreGlyph kind={discovery.kind} className="h-12 w-12" />
                        <Sparkles className="absolute -right-2 -top-2 h-5 w-5 text-amber-400" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-extrabold tracking-[0.14em] text-cyan-700">
                            {discovery.rarity === "rare" ? "めずらしい ひょうほん" : "ちていの ひょうほん"}
                        </span>
                        <span className="mt-0.5 block text-base font-black leading-5 tracking-[-0.02em] text-slate-800">
                            {discovery.name}
                        </span>
                        <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-slate-500">
                            <Backpack className="h-3.5 w-3.5 text-violet-600" aria-hidden="true" />
                            バッグに しまったよ
                        </span>
                    </span>
                </motion.div>
            </div>
        );
    }

    return (
        <div
            className="absolute inset-0 z-40 overflow-y-auto bg-[radial-gradient(circle_at_50%_42%,rgba(236,254,255,0.98)_0%,rgba(153,246,228,0.78)_38%,rgba(21,95,112,0.96)_100%)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="discovery-title"
        >
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <div className="absolute -left-32 -top-20 h-[82%] w-64 rotate-6 rounded-[48%] bg-cyan-950/20 shadow-[inset_-18px_0_0_rgba(255,255,255,0.04)]" />
                <div className="absolute -right-32 -top-16 h-[86%] w-64 -rotate-6 rounded-[48%] bg-teal-950/22 shadow-[inset_18px_0_0_rgba(255,255,255,0.04)]" />
                <div className="absolute inset-x-0 bottom-0 h-[28%] rounded-[52%_52%_0_0/38%_38%_0_0] bg-emerald-300/22" />
                <div className="absolute left-1/2 top-[38%] h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/45 shadow-[0_0_80px_28px_rgba(103,232,249,0.38)]" />
                {[14, 31, 68, 85].map((left, index) => (
                    <motion.span
                        key={left}
                        className="absolute top-[16%] text-2xl text-amber-200"
                        style={{ left: `${left}%` }}
                        initial={reduceMotion ? undefined : { opacity: 0, scale: 0.45, y: 18 }}
                        animate={reduceMotion ? { opacity: 0.78 } : { opacity: [0, 1, 0.55], scale: [0.45, 1.15, 0.92], y: [18, -10, 0] }}
                        transition={reduceMotion ? undefined : { duration: 0.85, delay: index * 0.08 }}
                    >
                        ✦
                    </motion.span>
                ))}
            </div>

            <div className="relative flex min-h-full items-center justify-center px-4 pb-[calc(var(--safe-area-bottom)+18px)] pt-[calc(var(--safe-area-top)+18px)] sm:px-6">
                <motion.section
                    className="flex w-full max-w-lg flex-col items-center text-center"
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduceMotion ? 0.12 : 0.3, ease: "easeOut" }}
                >
                    <p className="inline-flex items-center gap-1.5 rounded-full border border-amber-100/80 bg-[#fff8d8]/92 px-4 py-1.5 text-[11px] font-black tracking-[0.14em] text-amber-800 shadow-sm">
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        めずらしい はっけん
                    </p>

                    <motion.div
                        className="relative my-5 flex h-[clamp(168px,29dvh,226px)] w-[clamp(168px,29dvh,226px)] items-center justify-center rounded-[44%] border border-white/70 bg-[radial-gradient(circle_at_36%_28%,rgba(255,255,255,0.98),rgba(207,250,254,0.88)_44%,rgba(167,139,250,0.28))] text-cyan-900 shadow-[0_30px_90px_-34px_rgba(8,47,73,0.86),0_0_70px_rgba(103,232,249,0.45)]"
                        initial={reduceMotion ? false : { scale: 0.72, rotate: -4 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 220, damping: 18, delay: 0.08 }}
                        aria-hidden="true"
                    >
                        <div className="absolute inset-3 rounded-[42%] border border-dashed border-cyan-200/80" />
                        <ExploreGlyph kind={discovery.kind} className="h-[78%] w-[78%]" />
                        <Sparkles className="absolute -right-2 top-[12%] h-8 w-8 text-amber-300 drop-shadow" />
                    </motion.div>

                    <div className="explore-field-sheet relative w-full rounded-[30px] px-5 pb-5 pt-6 sm:px-7">
                        <span className="absolute left-1/2 top-0 h-2.5 w-20 -translate-x-1/2 rounded-b-full bg-amber-200/75" aria-hidden="true" />
                        <p className="text-[10px] font-extrabold tracking-[0.16em] text-cyan-700">きょうの とくべつな ひょうほん</p>
                        <h2 id="discovery-title" className="mt-1 text-[clamp(25px,6vw,34px)] font-black leading-tight tracking-[-0.035em] text-slate-800">
                            {discovery.name}を みつけた！
                        </h2>
                        <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-slate-600">
                            岩の奥から、見たことのない ひかりが ほどけたよ。
                        </p>
                        <button
                            ref={continueButtonRef}
                            type="button"
                            onClick={onContinue}
                            className="explore-primary-action explore-focus-ring mt-5 h-12 w-full rounded-[16px] font-black transition active:scale-[0.98]"
                        >
                            ひょうほんを バッグへ
                        </button>
                    </div>
                </motion.section>
            </div>
        </div>
    );
};
