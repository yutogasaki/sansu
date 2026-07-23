import React from "react";
import { BookOpen, Sparkles } from "lucide-react";
import {
    FIREFLY_FLOWER_DISCOVERY_PAGE,
    getDiscoveryPageProgress,
} from "../../domain/explore";
import type { ResearchPageSummaryState } from "./ResearchPageSummary";
import { DiscoveryPageArt } from "./DiscoveryPageArt";
import { ResearchClueStampRail } from "./ResearchClueStampRail";
import {
    FIREFLY_FLOWER_CAMERA_KEY,
    FIREFLY_FLOWER_FIELD_BOOK_CANDIDATE_ID,
    FIREFLY_FLOWER_SCENES,
} from "./fireflyFlowerSceneCatalog";

interface ResearchBookStageProps {
    researchPage?: ResearchPageSummaryState;
    storyLine: string;
}

const FIREFLY_ARCHIVE_SCENES = [
    {
        src: FIREFLY_FLOWER_SCENES.waiting.src,
        sceneId: "firefly-archive-waiting",
        alt: FIREFLY_FLOWER_SCENES.waiting.description,
    },
    {
        src: FIREFLY_FLOWER_SCENES["dew-trail"].src,
        sceneId: "firefly-archive-dew-trail",
        alt: FIREFLY_FLOWER_SCENES["dew-trail"].description,
    },
    {
        src: FIREFLY_FLOWER_SCENES["warm-bud"].src,
        sceneId: "firefly-archive-warm-bud",
        alt: FIREFLY_FLOWER_SCENES["warm-bud"].description,
    },
    {
        src: FIREFLY_FLOWER_SCENES["ringing-petals"].src,
        sceneId: "firefly-archive-ringing-petals",
        alt: FIREFLY_FLOWER_SCENES["ringing-petals"].description,
    },
    {
        src: FIREFLY_FLOWER_SCENES["light-path"].src,
        sceneId: "firefly-archive-light-path",
        alt: FIREFLY_FLOWER_SCENES["light-path"].description,
    },
] as const;

const getFireflyArchiveScene = (
    researchPage: ResearchPageSummaryState,
) => {
    if (researchPage.observation) {
        return {
            src: researchPage.observation.visual.sceneSrc,
            sceneId: researchPage.observation.visual.sceneId,
            alt: researchPage.observation.copy.finding,
            candidateId: researchPage.observation.visual.candidateId,
            cameraKey: researchPage.observation.camera.key,
            objectPosition: researchPage.observation.camera.objectPosition,
            objectFit: "contain" as const,
        };
    }

    const discovered = new Set(researchPage.discoveredFeatureIds);
    const discoveredCount = researchPage.definition.features.filter((feature) => (
        discovered.has(feature.id)
    )).length;
    const scene = FIREFLY_ARCHIVE_SCENES[
        Math.min(discoveredCount, FIREFLY_ARCHIVE_SCENES.length - 1)
    ];

    return {
        ...scene,
        candidateId: FIREFLY_FLOWER_FIELD_BOOK_CANDIDATE_ID,
        cameraKey: FIREFLY_FLOWER_CAMERA_KEY,
        objectPosition: "50% 50%",
        objectFit: "contain" as const,
    };
};

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
    const isFireflyPage = researchPage?.definition.id === FIREFLY_FLOWER_DISCOVERY_PAGE.id;
    const fireflyArchiveScene = researchPage && isFireflyPage
        ? getFireflyArchiveScene(researchPage)
        : undefined;

    return (
        <article className="research-library-book-stage" aria-labelledby="research-library-book-title">
            <span className="research-library-page-edge research-library-page-edge-back" aria-hidden="true" />
            <span className="research-library-page-edge research-library-page-edge-middle" aria-hidden="true" />

            <div className="research-library-book explore-parchment-surface">
                <span className="research-library-book-tab" aria-hidden="true">
                    <BookOpen />
                </span>

                <div className="research-library-book-spread">
                    <div
                        className={`research-library-book-art explore-cut-paper${fireflyArchiveScene
                            ? " research-library-book-art--painted"
                            : ""}`}
                        data-visual-lineage-id={fireflyArchiveScene ? "pokko-field-v1" : undefined}
                        data-visual-candidate-id={fireflyArchiveScene?.candidateId}
                        data-visual-mode={fireflyArchiveScene ? "field-book" : undefined}
                        data-visual-scene-id={fireflyArchiveScene?.sceneId}
                        data-camera-key={fireflyArchiveScene?.cameraKey}
                    >
                        {fireflyArchiveScene ? (
                            <img
                                className="research-library-book-painted-image"
                                src={fireflyArchiveScene.src}
                                alt={fireflyArchiveScene.alt}
                                style={{
                                    objectFit: fireflyArchiveScene.objectFit,
                                    objectPosition: fireflyArchiveScene.objectPosition,
                                }}
                                data-character-id="pokko"
                                draggable={false}
                                decoding="async"
                            />
                        ) : researchPage ? (
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
