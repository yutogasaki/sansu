import React, { useEffect, useMemo, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BookOpen, Sparkles, Stamp } from "lucide-react";
import {
    getDiscoveryPageClueFeatureIds,
    getDiscoveryPageFeature,
    getDiscoveryPageProgress,
    isDiscoveryPageBigDiscovery,
    type DiscoveryPageDefinition,
    type DiscoveryPageFeatureId,
} from "../../domain/explore";
import { DiscoveryPageArt } from "./DiscoveryPageArt";

export interface DiscoveryResearchRevealItem {
    definition: DiscoveryPageDefinition;
    currentFeatureId: DiscoveryPageFeatureId;
    discoveredFeatureIds: readonly DiscoveryPageFeatureId[];
}

interface DiscoveryResearchRevealProps extends DiscoveryResearchRevealItem {
    forceBlocking?: boolean;
    onContinue: () => void;
}

export const DiscoveryResearchReveal: React.FC<DiscoveryResearchRevealProps> = ({
    definition,
    currentFeatureId,
    discoveredFeatureIds,
    forceBlocking = false,
    onContinue,
}) => {
    const reduceMotion = useReducedMotion();
    const continueButtonRef = useRef<HTMLButtonElement>(null);
    const currentFeature = getDiscoveryPageFeature(definition, currentFeatureId);
    const isBigDiscovery = isDiscoveryPageBigDiscovery(definition, currentFeatureId);
    const isBlockingReveal = forceBlocking || isBigDiscovery;
    const clueFeatureIds = useMemo(
        () => getDiscoveryPageClueFeatureIds(definition),
        [definition],
    );
    const progress = useMemo(
        () => getDiscoveryPageProgress(definition, discoveredFeatureIds),
        [definition, discoveredFeatureIds],
    );
    const slotGridStyle = {
        gridTemplateColumns: `repeat(${Math.max(1, Math.min(clueFeatureIds.length, 3))}, minmax(0, 1fr))`,
    };

    useEffect(() => {
        if (!currentFeature || !isBlockingReveal) return;
        const previouslyFocused = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        continueButtonRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
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
    }, [currentFeature, isBlockingReveal, onContinue]);

    if (!currentFeature) return null;

    if (!isBlockingReveal) {
        return (
            <div
                className="pointer-events-none absolute inset-x-3 top-[calc(var(--safe-area-top)+66px)] z-50 mx-auto max-w-md"
                role="status"
                aria-live="polite"
                aria-atomic="true"
            >
                <motion.section
                    className="explore-research-slip relative grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 overflow-hidden rounded-[22px] p-3 shadow-xl backdrop-blur-md"
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 34, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 48, y: -10, scale: 0.86 }}
                    transition={{ duration: reduceMotion ? 0.1 : 0.18, ease: "easeOut" }}
                >
                    <div className="explore-paper-diorama h-[68px] overflow-hidden rounded-[15px]" aria-hidden="true">
                        <DiscoveryPageArt
                            definition={definition}
                            discoveredFeatureIds={discoveredFeatureIds}
                            variant="thumbnail"
                        />
                    </div>
                    <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-[10px] font-black tracking-[0.08em] text-[var(--explore-mid)]">
                            <Stamp className="h-3.5 w-3.5" aria-hidden="true" />
                            てがかり {progress.discoveredClueCount}/{progress.clueTarget}
                        </p>
                        <h2 className="mt-0.5 truncate text-base font-black leading-5 text-[var(--explore-ink)]">
                            {currentFeature.title}
                        </h2>
                        <p className="line-clamp-1 text-xs font-bold leading-5 text-[var(--explore-muted)]">
                            {currentFeature.finding}
                        </p>
                    </div>
                </motion.section>
            </div>
        );
    }

    return (
        <div
            className="explore-research-overlay absolute inset-0 z-50 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="research-big-discovery-title"
            aria-describedby="research-big-discovery-description"
        >
            <div className="relative flex min-h-full items-center justify-center px-3 pb-[calc(var(--safe-area-bottom)+16px)] pt-[calc(var(--safe-area-top)+14px)] sm:px-6">
                <motion.section
                    className="w-full max-w-3xl"
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 22 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduceMotion ? 0.12 : 0.32, ease: "easeOut" }}
                >
                    <div className="relative mx-auto w-fit rounded-full border-2 border-[#f7e8bd]/70 bg-[#173f49] px-4 py-1.5 text-xs font-black tracking-[0.12em] text-[#fff4ce] shadow-lg">
                        <span className="inline-flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-[#f4c64f]" aria-hidden="true" />
                            {isBigDiscovery ? "てがかりが つながった" : "めずらしい てがかり"}
                        </span>
                    </div>

                    <div className="explore-paper-diorama relative mx-auto mt-3 aspect-[16/9] max-h-[38dvh] w-full max-w-2xl overflow-hidden rounded-[30px] sm:rounded-[38px]" aria-hidden="true">
                        <DiscoveryPageArt
                            definition={definition}
                            discoveredFeatureIds={discoveredFeatureIds}
                        />
                    </div>

                    <div className="explore-research-book relative mx-auto -mt-4 max-w-2xl rounded-[28px] px-4 pb-4 pt-6 text-center sm:px-7 sm:pb-6">
                        <span className="absolute left-1/2 top-0 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#173f49] bg-[#f4c64f] text-[#173f49]" aria-hidden="true">
                            <BookOpen className="h-4 w-4" />
                        </span>
                        <p className="text-xs font-black tracking-[0.12em] text-[var(--explore-mid)]">{definition.title}</p>
                        <h2 id="research-big-discovery-title" className="mt-1 text-balance text-[clamp(22px,5.5vw,36px)] font-black leading-tight tracking-[-0.035em] text-[var(--explore-ink)]">
                            {isBigDiscovery ? "大発見！" : "とくべつな発見！"} {currentFeature.title}
                        </h2>
                        <p id="research-big-discovery-description" className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-[var(--explore-muted)]">
                            {currentFeature.finding}
                        </p>

                        <ol
                            className="mt-4 grid gap-2"
                            style={slotGridStyle}
                            aria-label={`${clueFeatureIds.length}つの手掛かりを発見`}
                        >
                            {clueFeatureIds.map((featureId) => {
                                const feature = getDiscoveryPageFeature(definition, featureId);
                                return (
                                    <li key={featureId} className="explore-research-stamp is-found flex min-h-14 flex-col items-center justify-center rounded-[16px] px-2 py-2">
                                        <Stamp className="h-4 w-4 text-[#c95f4f]" aria-hidden="true" />
                                        <span className="mt-1 text-xs font-black leading-4">{feature?.title}</span>
                                    </li>
                                );
                            })}
                        </ol>

                        <button
                            ref={continueButtonRef}
                            type="button"
                            onClick={onContinue}
                            aria-keyshortcuts="Enter Escape"
                            className="explore-primary-action explore-focus-ring mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-[16px] text-sm font-black transition active:scale-[0.98]"
                        >
                            調査ノートを とじる
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>
                </motion.section>
            </div>
        </div>
    );
};
