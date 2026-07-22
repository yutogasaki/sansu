import React from "react";
import { useReducedMotion } from "framer-motion";
import type { Problem } from "../../domain/types";
import {
    ImmersiveEncounter,
    type ImmersiveEncounterDefinition,
} from "./ImmersiveEncounter";
import type { ExploreGlyphKind } from "./ExploreGlyph";
import { FireflyFlowerEncounterArt } from "./FireflyFlowerEncounterArt";
import { MakimodonEncounterArt } from "./MakimodonEncounterArt";
import { RootPullOpeningArt } from "./RootPullOpeningArt";
import { SnapRootOpeningArt } from "./SnapRootOpeningArt";
import type { ExploreRootPullAssetSet } from "../../domain/explore/openingExperience";
import {
    getMakimodonArtStage,
    getMakimodonKickerCopy,
    getMakimodonStateLabel,
    getMakimodonStatusCopy,
    getMakimodonTitleCopy,
} from "./makimodonPresentation";
import {
    getRootPullKickerCopy,
    getRootPullOpeningStage,
    getRootPullStagePresentation,
    getRootPullStateLabel,
    getRootPullStatusCopy,
    type RootPullPayoffVariant,
} from "./rootPullPresentation";
import {
    getSnapRootKickerCopy,
    getSnapRootOpeningStage,
    getSnapRootStateLabel,
    getSnapRootStatusCopy,
    getSnapRootTitleCopy,
} from "./snapRootPresentation";
import {
    getRapidTrailArtStage,
    getRapidTrailProgressMarks,
    getRapidTrailStateLabel,
    getRapidTrailStatusCopy,
} from "./rapidTrailPresentation";

export type ExploreProblemFeedback = "idle" | "correct" | "incorrect";
export type ExploreProblemPresentation = "rapid-trail" | "makimodon" | "root-pull" | "snap-root";

interface ExploreProblemPanelProps {
    problem: Problem;
    answer: string;
    prompt: string;
    feedback: ExploreProblemFeedback;
    attemptCount: number;
    combo: number;
    targetKind: ExploreGlyphKind;
    incorrectEnergyCost: number;
    presentation?: ExploreProblemPresentation;
    completedSteps?: number;
    rootPullAssetSet?: ExploreRootPullAssetSet;
    rootPullPayoffVariant?: RootPullPayoffVariant;
    inputDisabled?: boolean;
    onAnswerChange: (answer: string) => void;
    onSubmit: () => void;
}

export const ExploreProblemPanel: React.FC<ExploreProblemPanelProps> = ({
    problem,
    answer,
    prompt,
    feedback,
    attemptCount,
    combo,
    incorrectEnergyCost,
    presentation = "rapid-trail",
    completedSteps = 0,
    rootPullAssetSet = "v1",
    rootPullPayoffVariant = "dirt-hat",
    inputDisabled = false,
    onAnswerChange,
    onSubmit,
}) => {
    const reduceMotion = useReducedMotion();
    const isMakimodon = presentation === "makimodon";
    const isRootPull = presentation === "root-pull";
    const isSnapRoot = presentation === "snap-root";
    const makimodonStage = getMakimodonArtStage(completedSteps, feedback);
    const makimodonStateLabel = getMakimodonStateLabel(makimodonStage);
    const rootPullStage = getRootPullOpeningStage(completedSteps, feedback);
    const rootPullPresentation = getRootPullStagePresentation(
        rootPullStage,
        rootPullAssetSet,
        rootPullPayoffVariant,
    );
    const rootPullStateLabel = getRootPullStateLabel(rootPullStage);
    const snapRootStage = getSnapRootOpeningStage(completedSteps, feedback);
    const snapRootStateLabel = getSnapRootStateLabel(snapRootStage);
    const rapidTrailStage = getRapidTrailArtStage(completedSteps, feedback);
    const rapidTrailStateLabel = getRapidTrailStateLabel(rapidTrailStage);
    const definition: ImmersiveEncounterDefinition = {
        scene: {
            idleSrc: "",
            completeSrc: "",
            resolvedSrc: "",
        },
        problem: {
            titleId: "explore-problem-title",
            kicker: isSnapRoot
                ? getSnapRootKickerCopy(snapRootStage)
                : isRootPull
                ? getRootPullKickerCopy(rootPullStage)
                : isMakimodon
                    ? getMakimodonKickerCopy(makimodonStage)
                    : `${getRapidTrailProgressMarks(rapidTrailStage)} ほたる花`,
            title: isSnapRoot
                ? getSnapRootTitleCopy(snapRootStage)
                : isRootPull
                ? rootPullPresentation.title
                : isMakimodon
                    ? getMakimodonTitleCopy(makimodonStage)
                    : prompt,
            incompleteState: isSnapRoot
                ? snapRootStateLabel
                : isRootPull
                ? rootPullStateLabel
                : isMakimodon
                    ? makimodonStateLabel
                    : rapidTrailStateLabel,
            completeState: isSnapRoot
                ? `${snapRootStateLabel}！`
                : isRootPull
                ? `${rootPullStateLabel}！`
                : isMakimodon
                    ? `${makimodonStateLabel}！`
                    : `${rapidTrailStateLabel}！`,
            equationTestId: "rapid-loop-equation",
            hintAriaLabel: "この問題の 数のヒント",
            hintLabel: "この問題の もよう",
            getStatusCopy: ({ phase }) => (
                isSnapRoot
                    ? getSnapRootStatusCopy(
                        snapRootStage,
                        phase === "ready" ? "idle" : phase,
                    )
                    : isRootPull
                    ? getRootPullStatusCopy(
                        rootPullStage,
                        phase === "ready" ? "idle" : phase,
                        rootPullAssetSet,
                        rootPullPayoffVariant,
                    )
                    : isMakimodon
                        ? getMakimodonStatusCopy(
                            makimodonStage,
                            phase === "ready" ? "idle" : phase,
                        )
                        : getRapidTrailStatusCopy(
                            rapidTrailStage,
                            phase === "ready" ? "idle" : phase,
                        )
            ),
        },
        completion: {
            titleId: "explore-rapid-loop-complete-title",
            kicker: "道が ひらいた",
            title: "つぎの道が ひらいた！",
            getSummary: () => "光の先へ、道が つづいてる",
        },
        loadingCopy: "つぎの しかけへ 走っているよ",
    };

    return (
        <ImmersiveEncounter
            definition={definition}
            phase={feedback === "idle" ? "ready" : feedback}
            problem={problem}
            answer={answer}
            attemptCount={attemptCount}
            combo={combo}
            incorrectEnergyCost={incorrectEnergyCost}
            sceneArt={isSnapRoot ? (
                <SnapRootOpeningArt
                    stage={snapRootStage}
                    reducedMotion={Boolean(reduceMotion)}
                    className="explore-immersive-snap-root-art"
                />
            ) : isRootPull ? (
                <RootPullOpeningArt
                    stage={rootPullStage}
                    assetSet={rootPullAssetSet}
                    payoffVariant={rootPullPayoffVariant}
                    reducedMotion={Boolean(reduceMotion)}
                    className="explore-immersive-root-pull-art"
                />
            ) : isMakimodon ? (
                <MakimodonEncounterArt
                    stage={makimodonStage}
                    reducedMotion={Boolean(reduceMotion)}
                    className="explore-immersive-authored-art"
                />
            ) : (
                <FireflyFlowerEncounterArt
                    stage={rapidTrailStage}
                    reducedMotion={Boolean(reduceMotion)}
                    className="explore-immersive-firefly-art"
                />
            )}
            inputDisabled={inputDisabled}
            onAnswerChange={onAnswerChange}
            onSubmit={onSubmit}
        />
    );
};
