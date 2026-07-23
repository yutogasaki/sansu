import React from "react";
import {
    ImmersiveEncounter,
    ImmersiveEncounterCompletion,
    ImmersiveEncounterLoading,
    type ImmersiveEncounterDefinition,
    type ImmersiveEncounterProps,
} from "./ImmersiveEncounter";

const LIGHT_BRIDGE_DEFINITION: ImmersiveEncounterDefinition = {
    scene: {
        idleSrc: "/assets/explore/light-bridge/scene-idle-pokko-v4.jpg",
        completeSrc: "/assets/explore/light-bridge/scene-complete-pokko-v4.jpg",
        resolvedSrc: "/assets/explore/light-bridge/scene-crossed-pokko-v4.jpg",
    },
    visualIdentity: {
        lineageId: "pokko-field-v1",
        candidateId: "pokko-painted-encounters-v4",
        mode: "world-painted",
        surfaceId: "explore-encounter-light-bridge",
        cameraKey: "light-bridge-camera-v1",
        sceneIds: {
            idle: "light-bridge-idle",
            complete: "light-bridge-complete",
            resolved: "light-bridge-crossed",
        },
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
    return (
        <ImmersiveEncounter
            definition={LIGHT_BRIDGE_DEFINITION}
            {...props}
        />
    );
};

interface LightBridgeCompletionProps { combo: number }

export const LightBridgeCompletion: React.FC<LightBridgeCompletionProps> = ({ combo }) => (
    <ImmersiveEncounterCompletion
        definition={LIGHT_BRIDGE_DEFINITION}
        combo={combo}
    />
);

export const LightBridgeLoading: React.FC = () => (
    <ImmersiveEncounterLoading definition={LIGHT_BRIDGE_DEFINITION} />
);
