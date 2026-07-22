import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, House, Lightbulb, MapPinned, Sparkles } from "lucide-react";
import {
    getDiscoveryPageFeature,
    getDiscoveryPageProgress,
    type DiscoveryKind,
    type ExploreReplayTeaser,
} from "../../domain/explore";
import { ExploreGlyph } from "./ExploreGlyph";
import { ResearchLibraryScene } from "./ResearchLibraryScene";
import type { ResearchPageSummaryState } from "./ResearchPageSummary";

export interface ReturnSummaryFind {
    id: string;
    name: string;
    kind: DiscoveryKind;
    rarity?: "common" | "rare";
}

interface ReturnSummaryProps {
    status: "returned" | "rescued";
    finds: ReturnSummaryFind[];
    steps: number;
    energy: number;
    replayTeaser?: ExploreReplayTeaser;
    researchPage?: ResearchPageSummaryState;
    onRestart: () => void;
    onExit: () => void;
}

export const ReturnSummary: React.FC<ReturnSummaryProps> = ({
    status,
    finds,
    steps,
    energy,
    replayTeaser,
    researchPage,
    onRestart,
    onExit,
}) => {
    const reduceMotion = useReducedMotion();
    const rareFind = finds.find((find) => find.rarity === "rare");
    const researchProgress = researchPage
        ? getDiscoveryPageProgress(researchPage.definition, researchPage.discoveredFeatureIds)
        : undefined;
    const completedResearchFinding = researchProgress?.isComplete && researchPage
        ? getDiscoveryPageFeature(
            researchPage.definition,
            researchPage.definition.chain.bigDiscoveryFeatureId,
        )?.finding
        : undefined;
    const storyLine = completedResearchFinding
        ? completedResearchFinding
        : rareFind
            ? `${rareFind.name}を みつけて、ぶじに もちかえった。`
            : status === "rescued"
                ? "気球と ぶじに かえった。見つけたものも いっしょだよ。"
                : "見つけたものを ぶじに もちかえった。";

    return (
        <div className="relative h-full overflow-y-auto px-3 pb-[calc(var(--safe-area-bottom)+18px)] pt-[calc(var(--safe-area-top)+12px)] sm:px-5">
            <div className="flex min-h-full items-start justify-center py-1 sm:py-4">
                <motion.section
                    className="relative w-full max-w-3xl"
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduceMotion ? 0.12 : 0.3, ease: "easeOut" }}
                    aria-labelledby="return-summary-title"
                >
                    <ResearchLibraryScene
                        status={status}
                        storyLine={storyLine}
                        researchPage={researchPage}
                        replayTeaser={replayTeaser}
                        onRestart={onRestart}
                    />

                    <div className="research-library-support explore-field-sheet rounded-[28px] px-4 pb-5 pt-4 sm:px-7 sm:pb-7 sm:pt-5">
                        <div className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-[18px] border border-cyan-100/90 bg-cyan-50/60 px-4 py-2.5 text-xs font-extrabold text-slate-600">
                            <span className="inline-flex items-center gap-1.5">
                                <MapPinned className="h-4 w-4 text-cyan-700" aria-hidden="true" />
                                {steps}みち
                            </span>
                            <span className="h-4 w-px bg-cyan-200" aria-hidden="true" />
                            <span className="inline-flex items-center gap-1.5">
                                <Sparkles className="h-4 w-4 text-amber-600" aria-hidden="true" />
                                {finds.length}はっけん
                            </span>
                            <span className="h-4 w-px bg-cyan-200" aria-hidden="true" />
                            <span className="inline-flex items-center gap-1.5">
                                <Lightbulb className="h-4 w-4 text-amber-600" aria-hidden="true" />
                                ひかり {energy}
                            </span>
                        </div>

                        <div className="mt-4">
                            <h2 className="text-xs font-extrabold tracking-[0.12em] text-slate-600">道で もちかえった ひょうほん</h2>
                            {finds.length > 0 ? (
                                <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
                                    {finds.map((find) => (
                                        <li key={find.id} className="explore-specimen-card flex min-w-[142px] flex-1 items-center gap-2.5 rounded-[18px] px-3 py-2.5">
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-dashed border-cyan-200 bg-cyan-50 text-cyan-900" aria-hidden="true">
                                                <ExploreGlyph kind={find.kind} className="h-9 w-9" />
                                            </span>
                                            <span className="min-w-0 text-xs font-extrabold leading-5 text-slate-700">{find.name}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="explore-specimen-card mt-2 rounded-[18px] border-dashed px-4 py-3 text-sm font-semibold text-slate-500">
                                    つぎの地図には、どんな ひょうほんが のこるかな？
                                </div>
                            )}
                        </div>

                        {replayTeaser ? (
                            <aside
                                className="mt-4 flex items-center gap-3 rounded-[20px] border border-dashed border-emerald-300/80 bg-emerald-50/72 px-3 py-3 text-left"
                                aria-label="つぎの たんけんの けはい"
                            >
                                <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-white/80 text-emerald-950 shadow-sm" aria-hidden="true">
                                    <ExploreGlyph kind={replayTeaser.kind} className="h-12 w-12 opacity-70 grayscale-[0.35]" />
                                    <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-cyan-900 text-xs font-black text-white">?</span>
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-xs font-black tracking-[0.1em] text-emerald-800">
                                        つぎの たんけんの けはい
                                    </span>
                                    <span className="mt-0.5 block text-sm font-black text-slate-800">
                                        {replayTeaser.title}
                                    </span>
                                    <span className="mt-0.5 block text-xs font-semibold leading-5 text-slate-600">
                                        {replayTeaser.hint}。ちがう道で 出会えるかも。
                                    </span>
                                </span>
                            </aside>
                        ) : null}

                        <button
                            type="button"
                            onClick={onExit}
                            className="explore-focus-ring group mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[16px] border border-white bg-white/72 font-extrabold text-slate-600 shadow-sm transition active:scale-[0.98]"
                        >
                            <House className="h-4 w-4 text-cyan-700" aria-hidden="true" />
                            あそびメニューへ
                            <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </button>
                    </div>
                </motion.section>
            </div>
        </div>
    );
};
