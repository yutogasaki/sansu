import React from "react";
import { BookOpen, Sparkles } from "lucide-react";
import { getDiscoveryPageProgress } from "../../domain/explore";
import type { ResearchPageSummaryState } from "./ResearchPageSummary";
import { DiscoveryPageArt } from "./DiscoveryPageArt";
import { ResearchClueStampRail } from "./ResearchClueStampRail";

interface ResearchBookStageProps {
    researchPage?: ResearchPageSummaryState;
    storyLine: string;
}

const EmptyResearchPageArt: React.FC = () => (
    <svg
        className="h-full w-full"
        viewBox="0 0 260 190"
        role="img"
        aria-label="まだ調査のしるしがない空白のページ"
    >
        <path d="M0 0H260V190H0Z" fill="var(--explore-turquoise)" />
        <path d="M0 0H260V36L220 27 185 44 145 31 108 47 67 28 0 42Z" fill="var(--explore-outline)" />
        <path d="M0 155C54 133 93 169 139 149C184 130 215 157 260 140V190H0Z" fill="var(--explore-moss)" />
        <path d="M78 54H182V157H78Z" fill="var(--explore-parchment)" stroke="var(--explore-outline)" strokeWidth="6" strokeLinejoin="round" />
        <path d="M130 57V154" stroke="var(--explore-outline)" strokeOpacity="0.28" strokeWidth="3" strokeDasharray="3 7" />
        <path d="M116 94C116 84 122 78 131 78C141 78 147 84 147 93C147 106 132 104 132 117" fill="none" stroke="var(--explore-cave-mid)" strokeWidth="8" strokeLinecap="round" />
        <circle cx="132" cy="133" r="5" fill="var(--explore-cave-mid)" />
    </svg>
);

export const ResearchBookStage: React.FC<ResearchBookStageProps> = ({
    researchPage,
    storyLine,
}) => {
    const progress = researchPage
        ? getDiscoveryPageProgress(researchPage.definition, researchPage.discoveredFeatureIds)
        : undefined;
    const title = researchPage?.definition.title ?? "まだ なぞのまま";
    const progressCopy = progress?.isComplete
        ? `${progress.clueTarget}つの てがかりが つながった`
        : progress
            ? `${progress.discoveredClueCount}/${progress.clueTarget} の てがかりを のこした`
            : "道の先に、まだ見ぬ けはいが ある";

    return (
        <article className="research-library-book-stage" aria-labelledby="research-library-book-title">
            <span className="research-library-page-edge research-library-page-edge-back" aria-hidden="true" />
            <span className="research-library-page-edge research-library-page-edge-middle" aria-hidden="true" />

            <div className="research-library-book explore-parchment-surface">
                <span className="research-library-book-tab" aria-hidden="true">
                    <BookOpen />
                </span>

                <div className="research-library-book-spread">
                    <div className="research-library-book-art explore-cut-paper">
                        {researchPage ? (
                            <DiscoveryPageArt
                                definition={researchPage.definition}
                                discoveredFeatureIds={researchPage.discoveredFeatureIds}
                                variant="book"
                            />
                        ) : (
                            <EmptyResearchPageArt />
                        )}
                    </div>

                    <div className="research-library-book-notes">
                        <span className="research-library-book-kicker">きょうの 1ページ</span>
                        <h2 id="research-library-book-title">{title}</h2>
                        <p className="research-library-book-progress">
                            {progress?.isComplete ? <Sparkles aria-hidden="true" /> : null}
                            <span>{progressCopy}</span>
                        </p>
                        <p className="research-library-book-story">{storyLine}</p>
                    </div>
                </div>

                {researchPage ? (
                    <ResearchClueStampRail
                        definition={researchPage.definition}
                        discoveredFeatureIds={researchPage.discoveredFeatureIds}
                        variant="book"
                    />
                ) : (
                    <p className="research-library-empty-clue">まだ しるしは ない。つぎは 何が見つかるかな？</p>
                )}
            </div>
        </article>
    );
};
