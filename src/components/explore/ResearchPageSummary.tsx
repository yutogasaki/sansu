import React from "react";
import { BookOpen, Search, Sparkles } from "lucide-react";
import {
    getDiscoveryPageProgress,
    getNextDiscoveryPageClue,
    type DiscoveryPageDefinition,
    type DiscoveryPageFeatureId,
    type ExploreObservationDefinition,
} from "../../domain/explore";
import { ResearchClueStampRail } from "./ResearchClueStampRail";

export interface ResearchPageSummaryState {
    definition: DiscoveryPageDefinition;
    discoveredFeatureIds: readonly DiscoveryPageFeatureId[];
    observation?: ExploreObservationDefinition;
}

export const ResearchPageSummary: React.FC<ResearchPageSummaryState> = ({
    definition,
    discoveredFeatureIds,
}) => {
    const nextClue = getNextDiscoveryPageClue(definition, discoveredFeatureIds);
    const progress = getDiscoveryPageProgress(definition, discoveredFeatureIds);

    return (
        <section className="explore-research-book mt-4 rounded-[22px] px-3 pb-3 pt-4 text-left sm:px-4" aria-labelledby="research-summary-title">
            <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border-2 border-[var(--explore-outline)] bg-[var(--explore-amber)] text-[var(--explore-outline)]" aria-hidden="true">
                    <BookOpen className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-xs font-black tracking-[0.1em] text-[var(--explore-mid)]">きょうの ちょうさページ</span>
                    <h2 id="research-summary-title" className="mt-0.5 text-base font-black text-[var(--explore-ink)]">{definition.title}</h2>
                    <span className="mt-0.5 block text-xs font-semibold leading-5 text-[var(--explore-muted)]">
                        {progress.isComplete
                            ? `${progress.clueTarget}つの てがかりが つながって、大発見になった。`
                            : "見つけた順に、ページへ しるしを のこした。"}
                    </span>
                </span>
                {progress.isComplete ? <Sparkles className="h-5 w-5 shrink-0 text-amber-600" aria-label="大発見" /> : null}
            </div>

            <ResearchClueStampRail
                definition={definition}
                discoveredFeatureIds={discoveredFeatureIds}
                variant="summary"
            />

            {!progress.isComplete && nextClue ? (
                <p className="mt-2 flex items-start gap-2 rounded-[14px] bg-[color-mix(in_srgb,var(--explore-amber)_15%,transparent)] px-3 py-2 text-xs font-bold leading-5 text-[var(--explore-ink)]">
                    <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
                    <span><strong>つぎの けはい：</strong>{nextClue.copy}</span>
                </p>
            ) : null}
        </section>
    );
};
