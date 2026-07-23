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
        idleSrc: "/assets/explore/root-tangle/scene-tangled-dew-path-pokko-v6.jpg",
        completeSrc: "/assets/explore/root-tangle/scene-open-dew-path-pokko-v6.jpg",
        resolvedSrc: "/assets/explore/root-tangle/scene-crossed-dew-path-pokko-v6.jpg",
    },
    visualIdentity: {
        lineageId: "pokko-field-v1",
        candidateId: "root-tangle-dew-path-v3",
        mode: "world-painted",
        surfaceId: "explore-encounter-root-tangle",
        cameraKey: "root-tangle-side-v3",
        sceneIds: {
            idle: "root-tangle-dew-blocked",
            complete: "root-tangle-dew-open",
            resolved: "root-tangle-dew-gag",
        },
    },
    problem: {
        titleId: "explore-problem-title",
        kicker: "ねっこの わっか！",
        title: "ひき算で しずく道をひらこう",
        incompleteState: "しずくが せき止められた",
        completeState: "するんと ほどけた！",
        equationTestId: "root-tangle-equation",
        hintAriaLabel: "ひき算の のこりかた ヒント",
        hintLabel: "しずくの のこり",
        getStatusCopy: ({ phase, attemptCount, incorrectEnergyCost }) => (
            phase === "correct"
                ? "せいかい！ ねっこが ほどけて、しずくが ころころ！"
                : phase === "incorrect"
                    ? incorrectEnergyCost > 0
                        ? `ねっこは まだ くるん。ひかりを ${incorrectEnergyCost}つ つかったよ`
                        : "ねっこは まだ くるん。ひかりは そのままだよ"
                    : attemptCount > 0
                        ? "しきで のこりを見て、もういちど ためせるよ"
                        : "のこりの数を見つけて、しずく道をひらこう"
        ),
    },
    completion: {
        titleId: "explore-root-tangle-complete-title",
        kicker: "ほどけた根の むこうへ ころころ",
        title: "さいごの一滴が 葉帽子へ ぽとん！",
        getSummary: (combo) => (
            combo > 1
                ? `${combo}れんさ！ ねっこが ほどけて、しずくが 葉帽子まで走った`
                : "ねっこが ほどけて、しずくが 葉帽子まで走った！"
        ),
    },
    loadingCopy: "しずくの のこりを えらんでいるよ",
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
