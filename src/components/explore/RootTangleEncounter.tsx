import React from "react";
import {
    ImmersiveEncounter,
    ImmersiveEncounterCompletion,
    ImmersiveEncounterLoading,
    type ImmersiveEncounterDefinition,
    type ImmersiveEncounterProps,
} from "./ImmersiveEncounter";

const ROOT_TANGLE_DEFINITION: ImmersiveEncounterDefinition = {
    scene: {
        idleSrc: "/assets/explore/root-tangle/scene-tangled-pokko-v4.jpg",
        completeSrc: "/assets/explore/root-tangle/scene-open-pokko-v4.jpg",
        resolvedSrc: "/assets/explore/root-tangle/scene-crossed-light-path-pokko-v5.jpg",
    },
    visualIdentity: {
        lineageId: "pokko-field-v1",
        candidateId: "pokko-painted-encounters-v5",
        mode: "world-painted",
        surfaceId: "explore-encounter-root-tangle",
        cameraKey: "root-tangle-camera-v1",
        sceneIds: {
            idle: "root-tangle-tangled",
            complete: "root-tangle-open",
            resolved: "root-tangle-crossed",
        },
    },
    problem: {
        titleId: "explore-problem-title",
        kicker: "ねっこの からまり！",
        title: "ひき算で 道をひらこう",
        incompleteState: "道が ぎゅうぎゅう",
        completeState: "ぱっと ほどけた！",
        equationTestId: "root-tangle-equation",
        hintAriaLabel: "ひき算の のこりかた ヒント",
        hintLabel: "ねっこの もよう",
        getStatusCopy: ({ phase, attemptCount, incorrectEnergyCost }) => (
            phase === "correct"
                ? "せいかい！ ねっこが ぱっと ほどけた！"
                : phase === "incorrect"
                    ? incorrectEnergyCost > 0
                        ? `根っこが くるん。ひかりを ${incorrectEnergyCost}つ つかったよ`
                        : "根っこが くるん。ひかりは そのままだよ"
                    : attemptCount > 0
                        ? "しきで のこりを見て、もういちど ためせるよ"
                        : "のこりの数を見つけて、道をひらこう"
        ),
    },
    completion: {
        titleId: "explore-root-tangle-complete-title",
        kicker: "ほどけた根が ひかりの道になった",
        title: "花の ひかり道が ひらいた！",
        getSummary: (combo) => (
            combo > 1
                ? `${combo}れんさ！ ほどけた根の先で、花の光が つながった`
                : "ねっこが ほどけて、花の ひかり道が みえた！"
        ),
    },
    loadingCopy: "根っこの もようを えらんでいるよ",
};

type RootTangleEncounterProps = Omit<ImmersiveEncounterProps, "definition">;

export const RootTangleEncounter: React.FC<RootTangleEncounterProps> = (props) => {
    return (
        <ImmersiveEncounter
            definition={ROOT_TANGLE_DEFINITION}
            {...props}
        />
    );
};

interface RootTangleCompletionProps { combo: number }

export const RootTangleCompletion: React.FC<RootTangleCompletionProps> = ({ combo }) => (
    <ImmersiveEncounterCompletion
        definition={ROOT_TANGLE_DEFINITION}
        combo={combo}
    />
);

export const RootTangleLoading: React.FC = () => (
    <ImmersiveEncounterLoading definition={ROOT_TANGLE_DEFINITION} />
);
