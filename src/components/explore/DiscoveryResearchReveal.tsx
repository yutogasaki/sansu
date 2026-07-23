import React, { useEffect, useMemo, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BookOpen, Sparkles, Stamp } from "lucide-react";
import {
    FIREFLY_FLOWER_DISCOVERY_PAGE,
    getDiscoveryPageClueFeatureIds,
    getDiscoveryPageFeature,
    getDiscoveryPageProgress,
    isDiscoveryPageBigDiscovery,
    type DiscoveryPageDefinition,
    type DiscoveryPageFeatureId,
    type ExploreObservationDefinition,
    type ExploreVisualIdentity,
} from "../../domain/explore";
import { cn } from "../../utils/cn";
import { DiscoveryPageArt } from "./DiscoveryPageArt";

export interface DiscoveryResearchRevealItem {
    definition: DiscoveryPageDefinition;
    currentFeatureId: DiscoveryPageFeatureId;
    discoveredFeatureIds: readonly DiscoveryPageFeatureId[];
    observation?: ExploreObservationDefinition;
}

interface DiscoveryResearchRevealProps extends DiscoveryResearchRevealItem {
    forceBlocking?: boolean;
    onContinue: () => void;
}

export const DiscoveryResearchReveal: React.FC<DiscoveryResearchRevealProps> = ({
    definition,
    currentFeatureId,
    discoveredFeatureIds,
    observation,
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
    const fieldBookIdentity: ExploreVisualIdentity = definition.id === FIREFLY_FLOWER_DISCOVERY_PAGE.id
        ? {
            lineageId: "pokko-field-v1",
            candidateId: "firefly-field-book-v1",
            mode: "field-book",
            surfaceId: "explore-field-book-firefly",
        }
        : {
            lineageId: "legacy-mixed-v0",
            candidateId: "legacy-discovery-page-v0",
            mode: "legacy",
            surfaceId: "explore-field-book-legacy",
        };
    const revealIdentity = observation?.visual ?? fieldBookIdentity;

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
                    data-visual-lineage-id={fieldBookIdentity.lineageId}
                    data-visual-candidate-id={fieldBookIdentity.candidateId}
                    data-visual-mode={fieldBookIdentity.mode}
                    data-visual-surface-id={fieldBookIdentity.surfaceId}
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
            data-visual-lineage-id={revealIdentity.lineageId}
            data-visual-candidate-id={revealIdentity.candidateId}
            data-visual-mode={revealIdentity.mode}
            data-visual-surface-id={revealIdentity.surfaceId}
            data-camera-key={observation?.camera.key}
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

                    <div
                        className={cn(
                            "explore-paper-diorama relative mx-auto mt-3 w-full max-w-2xl overflow-hidden rounded-[30px] sm:rounded-[38px]",
                            observation ? "aspect-[4/5] max-h-[45dvh] sm:max-h-[52dvh]" : "aspect-[16/9] max-h-[38dvh]",
                        )}
                        data-visual-lineage-id={revealIdentity.lineageId}
                        data-visual-candidate-id={revealIdentity.candidateId}
                        data-visual-mode={revealIdentity.mode}
                        data-visual-surface-id={revealIdentity.surfaceId}
                        data-visual-scene-id={observation?.visual.sceneId}
                        data-camera-key={observation?.camera.key}
                        data-observation-id={observation?.id}
                        data-source-encounter-id={observation?.encounterId}
                        aria-hidden="true"
                    >
                        {observation ? (
                            <img
                                src={observation.visual.sceneSrc}
                                alt=""
                                decoding="async"
                                className="explore-observation-scene h-full w-full object-cover"
                                style={{
                                    "--explore-observation-object-position": observation.camera.objectPosition,
                                } as React.CSSProperties}
                                data-testid="explore-observation-scene"
                            />
                        ) : (
                            <DiscoveryPageArt
                                definition={definition}
                                discoveredFeatureIds={discoveredFeatureIds}
                            />
                        )}
                    </div>

                    {observation ? (
                        <div
                            className="relative mx-auto -mt-3 max-w-xl rounded-[22px] border-2 border-[#173f49] bg-[#fff4ce] px-3 py-2 text-left shadow-lg sm:px-4 sm:py-3"
                            data-testid="explore-observation-copy"
                        >
                            <p className="text-xs font-black tracking-[0.12em] text-[#b43f35]">{observation.copy.kicker}</p>
                            <p className="mt-1 text-[15px] font-black leading-5 text-[#173f49] sm:text-base">{observation.copy.title}</p>
                            <p className="mt-1 text-xs font-bold leading-5 text-[#315d5f]">
                                {observation.copy.action}。{observation.copy.reaction}。
                            </p>
                        </div>
                    ) : null}

                    <div className={cn(
                        "explore-research-book relative mx-auto max-w-2xl rounded-[24px] px-3 pb-3 pt-5 text-center sm:rounded-[28px] sm:px-7 sm:pb-6 sm:pt-6",
                        observation ? "mt-3" : "-mt-4",
                    )}
                        data-visual-lineage-id={fieldBookIdentity.lineageId}
                        data-visual-candidate-id={fieldBookIdentity.candidateId}
                        data-visual-mode={fieldBookIdentity.mode}
                        data-visual-surface-id={fieldBookIdentity.surfaceId}
                    >
                        <span className="absolute left-1/2 top-0 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#173f49] bg-[#f4c64f] text-[#173f49]" aria-hidden="true">
                            <BookOpen className="h-4 w-4" />
                        </span>
                        <p className="text-xs font-black tracking-[0.12em] text-[var(--explore-mid)]">{definition.title}</p>
                        <h2 id="research-big-discovery-title" className="mt-1 text-balance text-[20px] font-black leading-tight tracking-[-0.035em] text-[var(--explore-ink)] sm:text-[clamp(22px,5.5vw,36px)]">
                            {isBigDiscovery ? "大発見！" : "とくべつな発見！"} {currentFeature.title}
                        </h2>
                        <p id="research-big-discovery-description" className="mx-auto mt-1 max-w-xl text-xs font-semibold leading-5 text-[var(--explore-muted)] sm:mt-2 sm:text-sm sm:leading-6">
                            {currentFeature.finding}
                        </p>

                        <ol
                            className="mt-2 grid gap-1.5 sm:mt-4 sm:gap-2"
                            style={slotGridStyle}
                            aria-label={`${clueFeatureIds.length}つの手掛かりを発見`}
                        >
                            {clueFeatureIds.map((featureId) => {
                                const feature = getDiscoveryPageFeature(definition, featureId);
                                return (
                                    <li key={featureId} className="explore-research-stamp is-found flex min-h-12 flex-col items-center justify-center rounded-[14px] px-1 py-1.5 sm:min-h-14 sm:rounded-[16px] sm:px-2 sm:py-2">
                                        <Stamp className="h-4 w-4 text-[#c95f4f]" aria-hidden="true" />
                                        <span className="mt-0.5 text-xs font-black leading-4 sm:mt-1">{feature?.title}</span>
                                    </li>
                                );
                            })}
                        </ol>

                        <button
                            ref={continueButtonRef}
                            type="button"
                            onClick={onContinue}
                            aria-keyshortcuts="Enter Escape"
                            className="explore-primary-action explore-focus-ring mt-2 flex min-h-14 w-full items-center justify-center gap-2 rounded-[16px] text-sm font-black transition active:scale-[0.98] sm:mt-4"
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
