export const G0_MECHANIC_EXPERIMENT_ID = "g0-mechanic-remix-v2";

export const G0_MECHANIC_PROTOTYPE_IDS = [
    "chain-shot",
    "number-vessel",
] as const;

export type G0MechanicPrototypeId = typeof G0_MECHANIC_PROTOTYPE_IDS[number];

export interface G0MechanicPrototypeDefinition {
    id: G0MechanicPrototypeId;
    candidateLabel: "A" | "B";
    shortLabel: string;
    title: string;
    hypothesis: string;
    evaluatorPrompt: string;
    evaluatorHint: string;
    reactionDurationMs: number;
}

export const G0_MECHANIC_PROTOTYPES: Record<
    G0MechanicPrototypeId,
    G0MechanicPrototypeDefinition
> = {
    "chain-shot": {
        id: "chain-shot",
        candidateLabel: "A",
        shortLabel: "ねらう",
        title: "ねらい撃ち連鎖",
        hypothesis: "一打の予告・連鎖・回復・次runの持ち越しが再挑戦を生むか",
        evaluatorPrompt: "形と揺れを見て、次に触る対象を一つ決める",
        evaluatorHint: "反応が落ち着くまで次入力は受け付けない",
        reactionDurationMs: 420,
    },
    "number-vessel": {
        id: "number-vessel",
        candidateLabel: "B",
        shortLabel: "あわせる",
        title: "数のうつわ",
        hypothesis: "合成・分解そのものと容器圧・recipe発見が遊びになるか",
        evaluatorPrompt: "一つの数を選び、合わせ先を選ぶ。選んだ数は分けられる",
        evaluatorHint: "合成後だけ予告の数が入り、あふれても一度回復できる",
        reactionDurationMs: 320,
    },
};

export const isG0MechanicPrototypeId = (
    value: string | null,
): value is G0MechanicPrototypeId => (
    value !== null
    && G0_MECHANIC_PROTOTYPE_IDS.some((prototypeId) => prototypeId === value)
);

export const getNextG0MechanicPrototypeId = (
    prototypeId: G0MechanicPrototypeId,
): G0MechanicPrototypeId => {
    const index = G0_MECHANIC_PROTOTYPE_IDS.indexOf(prototypeId);
    return G0_MECHANIC_PROTOTYPE_IDS[
        (index + 1) % G0_MECHANIC_PROTOTYPE_IDS.length
    ];
};
