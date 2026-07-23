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
        idleSrc: "/assets/explore/light-bridge/scene-idle-leaf-carry-bloom-pokko-v7.jpg",
        completeSrc: "/assets/explore/light-bridge/scene-complete-leaf-carry-bloom-pokko-v7.jpg",
        resolvedSrc: "/assets/explore/light-bridge/scene-crossed-leaf-carry-bloom-pokko-v7.jpg",
        completeActionProp: "bridge-leaf-clasp",
        resolvedActionProp: "bridge-leaf-clasp",
    },
    visualIdentity: {
        lineageId: "pokko-field-v1",
        candidateId: "light-bridge-carry-bloom-v4",
        mode: "world-painted",
        surfaceId: "explore-encounter-light-bridge",
        cameraKey: "light-bridge-side-v4",
        sceneIds: {
            idle: "light-bridge-idle",
            complete: "light-bridge-complete",
            resolved: "light-bridge-crossed",
        },
    },
    problem: {
        titleId: "explore-problem-title",
        kicker: "葉っぱが あとすこし！",
        title: "あわせて 橋をつなごう",
        incompleteState: "あと ひといき",
        completeState: "葉っぱが ぱちん！",
        equationTestId: "light-bridge-equation",
        hintAriaLabel: "たし算の まとまり ヒント",
        hintLabel: "葉っぱの すじ",
        getStatusCopy: ({ phase, attemptCount, incorrectEnergyCost }) => (
            phase === "correct"
                ? "せいかい！ 葉っぱが ぱちんと つながった！"
                : phase === "incorrect"
                    ? incorrectEnergyCost > 0
                        ? `橋が ぽよん。ひかりを ${incorrectEnergyCost}つ つかったよ`
                        : "橋が ぽよん。ひかりは そのままだよ"
                    : attemptCount > 0
                        ? "左右の 葉っぱを見て、もういちど ためせるよ"
                        : "左右の 葉っぱを つなごう"
        ),
    },
    completion: {
        titleId: "explore-light-bridge-complete-title",
        kicker: "こたえで 葉っぱが ぱちん！",
        title: "わたれる橋に なった！",
        getSummary: (combo) => (
            combo > 1
                ? `${combo}れんさ！ 四つのしずくが 葉っぱの橋を わたった`
                : "葉っぱが ひとつになって、四つのしずくが わたった！"
        ),
    },
    loadingCopy: "葉っぱの もようを えらんでいるよ",
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
