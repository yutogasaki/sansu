import React from "react";
import { useReducedMotion } from "framer-motion";
import {
    ImmersiveEncounter,
    ImmersiveEncounterCompletion,
    ImmersiveEncounterLoading,
    type ImmersiveEncounterDefinition,
    type ImmersiveEncounterProps,
} from "./ImmersiveEncounter";
import { AuthoredEncounterArt } from "./AuthoredEncounterArt";

const ROOT_TANGLE_DEFINITION: ImmersiveEncounterDefinition = {
    scene: {
        idleSrc: "/assets/explore/root-tangle/scene-tangled-dense-v3.webp",
        completeSrc: "/assets/explore/root-tangle/scene-open-dense-v3.webp",
        resolvedSrc: "/assets/explore/root-tangle/scene-crossed-dense-v3.webp",
    },
    problem: {
        titleId: "explore-problem-title",
        kicker: "ねっこが 先にいっちゃった！",
        title: "ひいて 道をひらこう",
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
                        : "いっちゃったぶんを ひいて、道をひらこう"
        ),
    },
    completion: {
        titleId: "explore-root-tangle-complete-title",
        kicker: "ほどけた根が ひかりの道になった",
        title: "花のみちが ひらいた！",
        getSummary: (combo) => (
            combo > 1
                ? `${combo}れんさ！ ひらいた道の先へ、道が つづいてる`
                : "ねっこが ほどけた。つぎの道が ひらいた！"
        ),
    },
    loadingCopy: "根っこの もようを えらんでいるよ",
};

type RootTangleEncounterProps = Omit<ImmersiveEncounterProps, "definition">;

export const RootTangleEncounter: React.FC<RootTangleEncounterProps> = (props) => {
    const reduceMotion = useReducedMotion();
    return (
        <ImmersiveEncounter
            definition={ROOT_TANGLE_DEFINITION}
            {...props}
            sceneArt={(
                <AuthoredEncounterArt
                    kind="root-tangle"
                    stage={props.phase === "correct"
                        ? "correct"
                        : props.phase === "incorrect" ? "incorrect" : "idle"}
                    reducedMotion={Boolean(reduceMotion)}
                    className="explore-immersive-authored-art"
                />
            )}
        />
    );
};

interface RootTangleCompletionProps { combo: number }

export const RootTangleCompletion: React.FC<RootTangleCompletionProps> = ({ combo }) => {
    const reduceMotion = useReducedMotion();
    return (
        <ImmersiveEncounterCompletion
            definition={ROOT_TANGLE_DEFINITION}
            combo={combo}
            sceneArt={(
                <AuthoredEncounterArt
                    kind="root-tangle"
                    stage="resolved"
                    reducedMotion={Boolean(reduceMotion)}
                    className="explore-immersive-authored-art"
                />
            )}
        />
    );
};

export const RootTangleLoading: React.FC = () => {
    const reduceMotion = useReducedMotion();
    return (
        <ImmersiveEncounterLoading
            definition={ROOT_TANGLE_DEFINITION}
            sceneArt={(
                <AuthoredEncounterArt
                    kind="root-tangle"
                    stage="idle"
                    reducedMotion={Boolean(reduceMotion)}
                    className="explore-immersive-authored-art"
                />
            )}
        />
    );
};
