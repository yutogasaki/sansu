import React from "react";
import type { ExploreReplayTeaser } from "../../domain/explore";
import type { ResearchPageSummaryState } from "./ResearchPageSummary";
import { ResearchBookStage } from "./ResearchBookStage";
import { ResearchRouteLever } from "./ResearchRouteLever";
import { useExploreStageFocus } from "./useExploreStageFocus";

interface ResearchLibrarySceneProps {
    status: "returned" | "rescued";
    storyLine: string;
    researchPage?: ResearchPageSummaryState;
    replayTeaser?: ExploreReplayTeaser;
    onRestart: () => void;
}

const ResearchCompanionArt: React.FC<{ celebrating: boolean }> = ({ celebrating }) => (
    <svg viewBox="0 0 88 96" aria-hidden="true">
        <path d="M18 61C18 37 28 20 44 20C61 20 71 38 70 61C70 81 61 90 44 90C28 90 18 80 18 61Z" fill="var(--explore-cream)" stroke="var(--explore-outline)" strokeWidth="5" />
        <path d="M27 29L14 17L34 22M60 29L74 16L55 22" fill="var(--explore-cream)" stroke="var(--explore-outline)" strokeWidth="5" strokeLinejoin="round" />
        <circle cx="36" cy="54" r="4" fill="var(--explore-outline)" />
        <circle cx="53" cy="54" r="4" fill="var(--explore-outline)" />
        <path d={celebrating ? "M36 65C40 74 49 74 53 65" : "M38 66C41 69 47 69 50 66"} fill="none" stroke="var(--explore-outline)" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M20 69L5 58M68 69L82 55" fill="none" stroke="var(--explore-outline)" strokeWidth="5" strokeLinecap="round" />
        <path d="M7 47H43L38 72H12Z" fill="var(--explore-coral)" stroke="var(--explore-outline)" strokeWidth="4" strokeLinejoin="round" />
        <circle cx="23" cy="58" r="7" fill="var(--explore-amber)" stroke="var(--explore-outline)" strokeWidth="3" />
    </svg>
);

export const ResearchLibraryScene: React.FC<ResearchLibrarySceneProps> = ({
    status,
    storyLine,
    researchPage,
    replayTeaser,
    onRestart,
}) => {
    const headingRef = useExploreStageFocus<HTMLHeadingElement>();
    const isComplete = Boolean(
        researchPage?.discoveredFeatureIds.includes(researchPage.definition.chain.bigDiscoveryFeatureId),
    );

    return (
        <section className="research-library-scene" aria-labelledby="return-summary-title" data-testid="research-library-scene">
            <svg
                className="research-library-cave-layers"
                viewBox="0 0 390 610"
                preserveAspectRatio="none"
                aria-hidden="true"
            >
                <path d="M0 0H390V610H0Z" fill="var(--explore-cave-deep)" />
                <path d="M0 0H86L112 48L83 89L105 138L67 187L81 247L36 292L0 281ZM390 0H307L282 48L307 91L286 139L321 187L306 245L354 291L390 277Z" fill="var(--explore-cave-mid)" />
                <path d="M0 0H390V48L345 34L310 57L263 42L224 66L184 44L143 64L103 41L58 57L0 39Z" fill="var(--explore-outline)" />
                <path d="M0 424C70 393 116 431 183 409C250 387 306 422 390 389V610H0Z" fill="var(--explore-moss)" />
                <path d="M0 451C72 424 119 458 188 435C256 413 307 448 390 417" fill="none" stroke="var(--explore-turquoise)" strokeWidth="12" strokeLinecap="round" />
            </svg>

            <header className="research-library-heading">
                <p>きょうの ぼうけんきろく</p>
                <h1 id="return-summary-title" ref={headingRef} tabIndex={-1}>
                    {status === "rescued" ? "気球と いっしょに ぶじ帰還" : "じぶんで 帰ると きめた"}
                </h1>
            </header>

            <ResearchBookStage researchPage={researchPage} storyLine={storyLine} />
            <ResearchRouteLever replayTeaser={replayTeaser} onRestart={onRestart} />

            <span className="research-library-companion" aria-hidden="true">
                <ResearchCompanionArt celebrating={isComplete} />
            </span>
            <span className="research-library-lantern" aria-hidden="true">
                <span />
            </span>
        </section>
    );
};
