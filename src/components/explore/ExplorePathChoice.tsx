import React from "react";
import { ChevronRight, House, Route } from "lucide-react";
import type { ExploreNode } from "../../domain/explore";
import { ExploreGlyph, type ExploreGlyphKind } from "./ExploreGlyph";
import { useExploreStageFocus } from "./useExploreStageFocus";

interface ExplorePathChoiceProps {
    nodes: ExploreNode[];
    steps: number;
    onSelect: (nodeId: string) => void;
    onReturn: () => void;
}

const choiceHeading = (count: number) => {
    if (count === 0) return "いちばん おくまで きた";
    if (count >= 3) return "どの道へ いく？";
    return "どっちへ いく？";
};

export const ExplorePathChoice: React.FC<ExplorePathChoiceProps> = ({ nodes, steps, onSelect, onReturn }) => {
    const headingRef = useExploreStageFocus<HTMLHeadingElement>();

    return (
        <section className="explore-field-sheet explore-path-choice flex h-full min-h-0 flex-col overflow-y-auto rounded-[24px] px-3.5 pb-3.5 pt-3 sm:px-5 sm:pb-5">

        <div className="flex items-start gap-3">
            <span className="explore-path-choice-mark flex h-10 w-10 shrink-0 -rotate-3 items-center justify-center rounded-[13px] text-[var(--explore-ink)]" aria-hidden="true">
                <Route className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="explore-kicker">つぎの道</p>
                <h2
                    id="explore-path-choice-title"
                    ref={headingRef}
                    tabIndex={-1}
                    className="mt-0.5 text-[1.35rem] font-black tracking-[-0.025em] text-[var(--explore-ink)] focus:outline-none"
                >
                    {choiceHeading(nodes.length)}
                </h2>
                {nodes.length === 0 ? (
                    <p className="mt-0.5 text-xs font-semibold leading-5 text-[var(--explore-muted)]">
                        見つけたものを バッグに入れて、基地へ かえろう
                    </p>
                ) : null}
            </div>
        </div>

        <div className="explore-choice-grid mt-3 grid flex-1 content-start gap-2.5">
            {nodes.map((node) => (
                <button
                    key={node.id}
                    type="button"
                    data-tone={node.kind}
                    aria-label={`${node.title}へ すすむ`}
                    onClick={() => onSelect(node.id)}
                    className="explore-route-card explore-focus-ring group flex min-h-[86px] items-center gap-3 rounded-[20px] p-3 text-left transition-[transform,filter] duration-150 hover:brightness-[1.015] active:translate-y-0.5 active:scale-[0.99]"
                >
                    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center" aria-hidden="true">
                        <span className="explore-route-glyph-plate absolute inset-1 -rotate-2 rounded-[20px]" />
                        <ExploreGlyph kind={node.kind as ExploreGlyphKind} className="relative h-12 w-12" />
                    </span>
                    <span className="min-w-0 flex-1 pr-1">
                        <span className="block text-[1.05rem] font-black tracking-[-0.015em] text-[var(--explore-ink)]">{node.title}</span>
                        <span className="explore-route-hint mt-1 block text-xs font-bold leading-5">{node.hint}</span>
                    </span>
                    <span className="explore-route-arrow flex h-8 w-8 shrink-0 rotate-2 items-center justify-center rounded-[10px] text-[var(--explore-ink)] transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true">
                        <ChevronRight className="h-4 w-4" />
                    </span>
                </button>
            ))}
        </div>

        {steps > 0 ? (
            <button
                type="button"
                onClick={onReturn}
                className="explore-path-return explore-focus-ring mt-2.5 flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[16px] px-4 text-sm font-bold text-[var(--explore-muted)] transition active:scale-[0.99]"
            >
                <House className="h-4 w-4 text-[var(--explore-deep)]" aria-hidden="true" />
                ここまでを ノートに のこす
            </button>
        ) : null}
        </section>
    );
};
