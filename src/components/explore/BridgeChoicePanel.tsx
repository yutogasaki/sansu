import React from "react";
import { ChevronRight, Lightbulb, Waves } from "lucide-react";
import type { ExploreBridgePlan } from "../../domain/explore";
import { ExploreGlyph, type ExploreGlyphKind } from "./ExploreGlyph";
import { useExploreStageFocus } from "./useExploreStageFocus";

const BRIDGE_PLANS: Array<{
    id: ExploreBridgePlan;
    glyph: ExploreGlyphKind;
    title: string;
    description: string;
    signal: string;
    tone: "fossil" | "crystal" | "root";
}> = [
    { id: "wood", glyph: "wood", title: "木の橋", description: "まっすぐ しっかり つなぐ", signal: "地図の けはい", tone: "fossil" },
    { id: "stones", glyph: "stones", title: "ひかりの橋", description: "2つの ひかりを あわせて つなぐ", signal: "水晶の けはい", tone: "crystal" },
    { id: "detour", glyph: "detour", title: "根っこの道", description: "くるっと まわって すすむ", signal: "花の けはい", tone: "root" },
];

interface BridgeChoicePanelProps {
    baseEnergyCost: number;
    onChoose: (plan: ExploreBridgePlan) => void;
}

export const BridgeChoicePanel: React.FC<BridgeChoicePanelProps> = ({ baseEnergyCost, onChoose }) => {
    const headingRef = useExploreStageFocus<HTMLHeadingElement>();

    return (
        <section className="explore-field-sheet explore-bridge-choice flex h-full min-h-0 flex-col overflow-y-auto rounded-[28px] px-3.5 pb-3.5 pt-2 sm:px-5 sm:pb-5">
        <div className="mx-auto mb-2 h-1 w-12 shrink-0 rounded-full bg-[rgba(24,63,73,0.13)]" aria-hidden="true" />
        <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-[var(--explore-deep)] text-white shadow-[0_14px_26px_-20px_rgba(8,47,73,0.8)]" aria-hidden="true">
                <Waves className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="explore-kicker">地底湖の わたり方</p>
                <h2
                    id="explore-bridge-choice-title"
                    ref={headingRef}
                    tabIndex={-1}
                    className="mt-0.5 text-xl font-extrabold tracking-[-0.025em] text-[var(--explore-ink)] focus:outline-none"
                >
                    どの道を つくる？
                </h2>
                <p className="mt-0.5 text-xs font-semibold leading-5 text-[var(--explore-muted)]">水面のけはいと、つかう ひかりを見くらべよう</p>
            </div>
        </div>

        <div className="relative mt-2.5 h-12 shrink-0 overflow-hidden rounded-[17px] border border-white/80 bg-[linear-gradient(180deg,rgba(185,238,237,0.56),rgba(88,193,208,0.28))]" aria-hidden="true">
            <span className="absolute inset-x-0 bottom-2 h-px bg-white/65" />
            <span className="absolute bottom-4 left-[8%] right-[8%] h-px -rotate-1 bg-cyan-700/16" />
            <ExploreGlyph kind="bridge" className="absolute -bottom-2 left-1/2 h-16 w-16 -translate-x-1/2 drop-shadow-[0_12px_16px_rgba(8,47,73,0.18)]" />
        </div>

        <div className="explore-choice-grid explore-choice-grid-three mt-2.5 grid flex-1 content-start gap-2.5">
            {BRIDGE_PLANS.map((plan) => {
                const energyCost = baseEnergyCost + (plan.id === "stones" ? 1 : 0);
                return (
                    <button
                        key={plan.id}
                        type="button"
                        onClick={() => onChoose(plan.id)}
                        data-tone={plan.tone}
                        aria-label={`${plan.title}。ひかり ${energyCost}。${plan.signal}`}
                        className="explore-route-card explore-focus-ring group flex min-h-[88px] items-center gap-2.5 rounded-[20px] p-2.5 text-left transition-[transform,filter] duration-150 hover:brightness-[1.015] active:translate-y-0.5 active:scale-[0.99]"
                    >
                        <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-[17px] bg-white/68" aria-hidden="true">
                            <ExploreGlyph kind={plan.glyph} className="h-10 w-10" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="font-extrabold text-[var(--explore-ink)]">{plan.title}</span>
                            <span className="block text-xs font-semibold leading-5 text-[var(--explore-muted)]">{plan.description}</span>
                            <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-extrabold text-[var(--explore-muted)]">
                                <span className="inline-flex items-center gap-1 rounded-full border border-white/80 bg-white/66 px-2 py-0.5 text-amber-800">
                                    <Lightbulb className="h-3 w-3" aria-hidden="true" />
                                    ひかり {energyCost}
                                </span>
                                <span>{plan.signal}</span>
                            </span>
                        </span>
                        <ChevronRight className="h-5 w-5 shrink-0 text-[var(--explore-muted)] transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                    </button>
                );
            })}
        </div>
        </section>
    );
};
