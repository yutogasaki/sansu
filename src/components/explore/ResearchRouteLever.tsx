import React from "react";
import { ArrowRight, Leaf } from "lucide-react";
import type { ExploreReplayTeaser } from "../../domain/explore";
import { ExploreGlyph } from "./ExploreGlyph";

interface ResearchRouteLeverProps {
    replayTeaser?: ExploreReplayTeaser;
    onRestart: () => void;
}

export const ResearchRouteLever: React.FC<ResearchRouteLeverProps> = ({
    replayTeaser,
    onRestart,
}) => {
    const actionLabel = replayTeaser ? "ちがう道を たんけん" : "もういっかい たんけん";
    const routeCopy = replayTeaser
        ? `${replayTeaser.title}の けはいがする`
        : "ページの先に、まだ道がある";

    return (
        <section className="research-route-stage" aria-labelledby="research-route-title">
            <svg
                className="research-route-paths"
                viewBox="0 0 360 150"
                preserveAspectRatio="none"
                aria-hidden="true"
            >
                <path d="M180 142C180 110 164 89 139 72C113 55 90 41 73 14" fill="none" stroke="var(--explore-outline)" strokeWidth="18" strokeLinecap="round" />
                <path d="M180 142C180 110 164 89 139 72C113 55 90 41 73 14" fill="none" stroke="var(--explore-cream)" strokeWidth="10" strokeLinecap="round" strokeDasharray="3 10" />
                <path d="M180 142C181 111 201 91 228 72C253 55 276 39 289 14" fill="none" stroke="var(--explore-outline)" strokeWidth="18" strokeLinecap="round" />
                <path d="M180 142C181 111 201 91 228 72C253 55 276 39 289 14" fill="none" stroke="var(--explore-amber)" strokeWidth="10" strokeLinecap="round" />
            </svg>

            <span className="research-route-mystery" aria-hidden="true">
                <ExploreGlyph kind="unknown" />
            </span>
            <span className="research-route-teaser" aria-hidden="true">
                <ExploreGlyph kind={replayTeaser?.kind ?? "mystery"} />
            </span>

            <p id="research-route-title" className="research-route-copy">{routeCopy}</p>

            <button
                type="button"
                onClick={onRestart}
                className="research-route-lever explore-physical-action explore-focus-ring"
                data-testid="research-library-primary-action"
            >
                <span className="research-route-lever-icon" aria-hidden="true">
                    <Leaf />
                </span>
                <span>{actionLabel}</span>
                <ArrowRight className="research-route-lever-arrow" aria-hidden="true" />
            </button>

            <span className="research-route-spring" aria-hidden="true">
                <span />
                <span />
                <span />
            </span>
        </section>
    );
};
