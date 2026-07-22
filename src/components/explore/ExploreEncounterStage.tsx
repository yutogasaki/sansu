import React from "react";
import type { Problem } from "../../domain/types";
import type {
    ExploreEncounterId,
    ExploreEncounterProblemPhase,
} from "../../domain/explore";
import {
    LightBridgeCompletion,
    LightBridgeEncounter,
    LightBridgeLoading,
} from "./LightBridgeEncounter";
import {
    RootTangleCompletion,
    RootTangleEncounter,
    RootTangleLoading,
} from "./RootTangleEncounter";

type ExploreEncounterStageProps = {
    encounterId: ExploreEncounterId;
    combo: number;
} & (
    | { phase: "loading" }
    | { phase: "resolved" }
    | {
        phase: ExploreEncounterProblemPhase;
        problem: Problem;
        answer: string;
        attemptCount: number;
        incorrectEnergyCost: number;
        inputDisabled?: boolean;
        onAnswerChange: (answer: string) => void;
        onSubmit: () => void;
    }
);

type ExploreEncounterRenderer = (props: ExploreEncounterStageProps) => React.ReactElement;

const renderLightBridge: ExploreEncounterRenderer = (props) => {
    if (props.phase === "loading") return <LightBridgeLoading />;
    if (props.phase === "resolved") return <LightBridgeCompletion combo={props.combo} />;

    return (
        <LightBridgeEncounter
            phase={props.phase}
            problem={props.problem}
            answer={props.answer}
            attemptCount={props.attemptCount}
            combo={props.combo}
            incorrectEnergyCost={props.incorrectEnergyCost}
            inputDisabled={props.inputDisabled}
            onAnswerChange={props.onAnswerChange}
            onSubmit={props.onSubmit}
        />
    );
};

const renderRootTangle: ExploreEncounterRenderer = (props) => {
    if (props.phase === "loading") return <RootTangleLoading />;
    if (props.phase === "resolved") return <RootTangleCompletion combo={props.combo} />;

    return (
        <RootTangleEncounter
            phase={props.phase}
            problem={props.problem}
            answer={props.answer}
            attemptCount={props.attemptCount}
            combo={props.combo}
            incorrectEnergyCost={props.incorrectEnergyCost}
            inputDisabled={props.inputDisabled}
            onAnswerChange={props.onAnswerChange}
            onSubmit={props.onSubmit}
        />
    );
};

const ENCOUNTER_RENDERERS: Record<ExploreEncounterId, ExploreEncounterRenderer> = {
    "light-bridge": renderLightBridge,
    "root-tangle": renderRootTangle,
};

export const ExploreEncounterStage: React.FC<ExploreEncounterStageProps> = (props) => (
    ENCOUNTER_RENDERERS[props.encounterId](props)
);
