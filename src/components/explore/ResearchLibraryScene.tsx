import React from "react";
import type { ExploreReplayTeaser } from "../../domain/explore";
import type { ResearchPageSummaryState } from "./ResearchPageSummary";
import { ResearchBookStage } from "./ResearchBookStage";
import { RibbonAntennaCompanion } from "./RibbonAntennaCompanion";
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
    <svg
        viewBox="-14 -16 112 168"
        aria-hidden="true"
        data-visual-lineage-id="pokko-field-v1"
        data-visual-candidate-id="research-library-pokko-v1"
        data-visual-mode="archive"
    >
        <RibbonAntennaCompanion pose={celebrating ? "listen" : "ready"} />
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
        <section
            className="research-library-scene"
            aria-labelledby="return-summary-title"
            data-testid="research-library-scene"
            data-visual-lineage-id="pokko-field-v1"
            data-visual-candidate-id="research-library-pokko-v1"
            data-visual-mode="archive"
        >
            <svg
                className="research-library-cave-layers"
                viewBox="0 0 390 610"
                preserveAspectRatio="none"
                aria-hidden="true"
            >
                <path d="M0 0H390V610H0Z" fill="#32bed1" />
                <path d="M0 0H86L112 48L83 89L105 138L67 187L81 247L36 292L0 281ZM390 0H307L282 48L307 91L286 139L321 187L306 245L354 291L390 277Z" fill="#d99a27" />
                <path d="M0 0H390V48L345 34L310 57L263 42L224 66L184 44L143 64L103 41L58 57L0 39Z" fill="#227c50" />
                <path d="M0 424C70 393 116 431 183 409C250 387 306 422 390 389V610H0Z" fill="#f1c95c" />
                <path d="M0 451C72 424 119 458 188 435C256 413 307 448 390 417" fill="none" stroke="#ef765f" strokeWidth="12" strokeLinecap="round" />
            </svg>

            <header className="research-library-heading">
                <p>きょうの ぼうけんきろく</p>
                <h1 id="return-summary-title" ref={headingRef} tabIndex={-1}>
                    {status === "rescued" ? "気球と ぶじに かえった！" : "はっけんを もちかえった！"}
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
