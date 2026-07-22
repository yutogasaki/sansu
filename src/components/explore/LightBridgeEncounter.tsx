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

const LIGHT_BRIDGE_DEFINITION: ImmersiveEncounterDefinition = {
    scene: {
        idleSrc: "/assets/explore/light-bridge/scene-idle-flow-v3.webp",
        completeSrc: "/assets/explore/light-bridge/scene-complete-flow-v3.webp",
        resolvedSrc: "/assets/explore/light-bridge/scene-crossed-flow-v3.webp",
    },
    problem: {
        titleId: "explore-problem-title",
        kicker: "ひかりが あとすこし！",
        title: "あわせて 橋をつなごう",
        incompleteState: "あと ひといき",
        completeState: "ぱっと つながった！",
        equationTestId: "light-bridge-equation",
        hintAriaLabel: "たし算の まとまり ヒント",
        hintLabel: "ひかりの もよう",
        getStatusCopy: ({ phase, attemptCount, incorrectEnergyCost }) => (
            phase === "correct"
                ? "せいかい！ ひかりが ぱっと つながった！"
                : phase === "incorrect"
                    ? incorrectEnergyCost > 0
                        ? `橋が ぽよん。ひかりを ${incorrectEnergyCost}つ つかったよ`
                        : "橋が ぽよん。ひかりは そのままだよ"
                    : attemptCount > 0
                        ? "左右の ひかりの流れを見て、もういちど ためせるよ"
                        : "左右の ひかりの流れを つなごう"
        ),
    },
    completion: {
        titleId: "explore-light-bridge-complete-title",
        kicker: "こたえが 光のアーチになった",
        title: "つぎの道が ひらいた！",
        getSummary: (combo) => (
            combo > 1
                ? `${combo}れんさ！ 光のアーチの先へ、道が つづいてる`
                : "ひかりが ひとつになった。つぎの道が ひらいた！"
        ),
    },
    loadingCopy: "ひかりの もようを えらんでいるよ",
};

type LightBridgeEncounterProps = Omit<ImmersiveEncounterProps, "definition">;

export const LightBridgeEncounter: React.FC<LightBridgeEncounterProps> = (props) => {
    const reduceMotion = useReducedMotion();
    return (
        <ImmersiveEncounter
            definition={LIGHT_BRIDGE_DEFINITION}
            {...props}
            sceneArt={(
                <AuthoredEncounterArt
                    kind="light-bridge"
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

interface LightBridgeCompletionProps { combo: number }

export const LightBridgeCompletion: React.FC<LightBridgeCompletionProps> = ({ combo }) => {
    const reduceMotion = useReducedMotion();
    return (
        <ImmersiveEncounterCompletion
            definition={LIGHT_BRIDGE_DEFINITION}
            combo={combo}
            sceneArt={(
                <AuthoredEncounterArt
                    kind="light-bridge"
                    stage="resolved"
                    reducedMotion={Boolean(reduceMotion)}
                    className="explore-immersive-authored-art"
                />
            )}
        />
    );
};

export const LightBridgeLoading: React.FC = () => {
    const reduceMotion = useReducedMotion();
    return (
        <ImmersiveEncounterLoading
            definition={LIGHT_BRIDGE_DEFINITION}
            sceneArt={(
                <AuthoredEncounterArt
                    kind="light-bridge"
                    stage="idle"
                    reducedMotion={Boolean(reduceMotion)}
                    className="explore-immersive-authored-art"
                />
            )}
        />
    );
};
