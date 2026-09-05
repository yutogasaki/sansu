import { hashRandomSeed } from "../../utils/random";

export const G0_ACTIONS_PER_RUN = 3;

export const G0_PROTOTYPE_IDS = [
    "chain-excavation",
    "creature-experiment",
    "droplet-ricochet",
    "underground-craft",
] as const;

export type G0PrototypeId = typeof G0_PROTOTYPE_IDS[number];
export type G0RunPhase = "await-action" | "reacting" | "payoff";

export type G0TargetId =
    | "lane-upper"
    | "lane-lower"
    | "tool-puff"
    | "tool-press"
    | "fixture-high"
    | "fixture-tunnel"
    | "inlet-top"
    | "inlet-bottom"
    | "bumper-wide"
    | "bumper-pin"
    | "part-beam"
    | "part-spring";

export type G0TargetClass = "safe" | "wild" | "recovery" | "neutral";

export interface G0TargetDefinition {
    id: G0TargetId;
    cue: string;
    accessibleLabel: string;
    targetClass: G0TargetClass;
}

export interface G0PrototypeDefinition {
    id: G0PrototypeId;
    shortLabel: string;
    title: string;
    hypothesis: string;
    promptByTurn: readonly [string, string, string];
}

export const G0_PROTOTYPES: Record<G0PrototypeId, G0PrototypeDefinition> = {
    "chain-excavation": {
        id: "chain-excavation",
        shortLabel: "くずす",
        title: "ねらって くずす",
        hypothesis: "三つの狙いが一本の連鎖になるか",
        promptByTurn: [
            "どちらの土から ひらく？",
            "ひびを追う？ きりかえる？",
            "さいごは どちらへ つなぐ？",
        ],
    },
    "creature-experiment": {
        id: "creature-experiment",
        shortLabel: "ためす",
        title: "クセを ためす",
        hypothesis: "試した行為から性質を予測できるか",
        promptByTurn: [
            "どちらを ためす？",
            "同じ？ ちがう方？",
            "どちらの仕掛けへ おくる？",
        ],
    },
    "droplet-ricochet": {
        id: "droplet-ricochet",
        shortLabel: "はじく",
        title: "しずくを はじく",
        hypothesis: "入口と出口の選択が反射を変えるか",
        promptByTurn: [
            "どちらから 一滴いれる？",
            "かさねる？ わける？",
            "どちらへ はじき出す？",
        ],
    },
    "underground-craft": {
        id: "underground-craft",
        shortLabel: "くむ",
        title: "みちを くむ",
        hypothesis: "三つの部品の順番が渡り方を変えるか",
        promptByTurn: [
            "一つ目は どちら？",
            "二つ目は どちら？",
            "さいごは どちら？",
        ],
    },
};

const BASE_TARGETS: Record<G0TargetId, G0TargetDefinition> = {
    "lane-upper": {
        id: "lane-upper",
        cue: "うえの土",
        accessibleLabel: "上の土をたたく",
        targetClass: "neutral",
    },
    "lane-lower": {
        id: "lane-lower",
        cue: "したの土",
        accessibleLabel: "下の土をたたく",
        targetClass: "neutral",
    },
    "tool-puff": {
        id: "tool-puff",
        cue: "ふうっ",
        accessibleLabel: "丸いいきものへ風を送る",
        targetClass: "wild",
    },
    "tool-press": {
        id: "tool-press",
        cue: "むにっ",
        accessibleLabel: "丸いいきものをそっと押す",
        targetClass: "safe",
    },
    "fixture-high": {
        id: "fixture-high",
        cue: "高い留め具",
        accessibleLabel: "いきものを高い留め具へ送る",
        targetClass: "wild",
    },
    "fixture-tunnel": {
        id: "fixture-tunnel",
        cue: "細いトンネル",
        accessibleLabel: "いきものを細いトンネルへ送る",
        targetClass: "safe",
    },
    "inlet-top": {
        id: "inlet-top",
        cue: "うえの入口",
        accessibleLabel: "上の入口へしずくを入れる",
        targetClass: "neutral",
    },
    "inlet-bottom": {
        id: "inlet-bottom",
        cue: "したの入口",
        accessibleLabel: "下の入口へしずくを入れる",
        targetClass: "neutral",
    },
    "bumper-wide": {
        id: "bumper-wide",
        cue: "ひろい板",
        accessibleLabel: "広い反射板へしずくを送る",
        targetClass: "recovery",
    },
    "bumper-pin": {
        id: "bumper-pin",
        cue: "ほそいピン",
        accessibleLabel: "細い反射ピンへしずくを送る",
        targetClass: "wild",
    },
    "part-beam": {
        id: "part-beam",
        cue: "まっすぐ",
        accessibleLabel: "まっすぐな部品を置く",
        targetClass: "safe",
    },
    "part-spring": {
        id: "part-spring",
        cue: "しなる",
        accessibleLabel: "しなる部品を置く",
        targetClass: "wild",
    },
};

const TARGET_IDS_BY_PROTOTYPE: Record<
    G0PrototypeId,
    readonly [
        readonly [G0TargetId, G0TargetId],
        readonly [G0TargetId, G0TargetId],
        readonly [G0TargetId, G0TargetId],
    ]
> = {
    "chain-excavation": [
        ["lane-upper", "lane-lower"],
        ["lane-upper", "lane-lower"],
        ["lane-upper", "lane-lower"],
    ],
    "creature-experiment": [
        ["tool-puff", "tool-press"],
        ["tool-puff", "tool-press"],
        ["fixture-high", "fixture-tunnel"],
    ],
    "droplet-ricochet": [
        ["inlet-top", "inlet-bottom"],
        ["inlet-top", "inlet-bottom"],
        ["bumper-wide", "bumper-pin"],
    ],
    "underground-craft": [
        ["part-beam", "part-spring"],
        ["part-beam", "part-spring"],
        ["part-beam", "part-spring"],
    ],
};

export interface G0AcceptedAction {
    turn: 1 | 2 | 3;
    targetId: G0TargetId;
    acceptedAtMs: number;
}

export interface G0QueuedAction {
    targetId: G0TargetId;
    clientActionId: string;
    atMs: number;
}

export interface G0Outcome {
    id: string;
    title: string;
    detail: string;
    riskTaken: boolean;
    riskRecovered: boolean;
}

export interface G0CompletedRun {
    targetIds: G0TargetId[];
    durationMs: number;
    outcome: G0Outcome;
}

export interface G0PrototypeState {
    runOrdinal: number;
    runId: string;
    phase: G0RunPhase;
    turn: 0 | 1 | 2 | 3;
    history: G0AcceptedAction[];
    queuedAction: G0QueuedAction | null;
    activeReactionId: string | null;
    acceptedClientActionIds: string[];
    startedAtMs: number | null;
    outcome: G0Outcome | null;
    completedRuns: G0CompletedRun[];
    replayStarts: number;
}

export interface G0LabState {
    sessionSeed: string;
    activePrototypeId: G0PrototypeId;
    prototypes: Record<G0PrototypeId, G0PrototypeState>;
}

export type G0LabAction =
    | {
        type: "SWITCH_PROTOTYPE";
        prototypeId: G0PrototypeId;
    }
    | {
        type: "WORLD_TARGET_TAPPED";
        prototypeId: G0PrototypeId;
        targetId: G0TargetId;
        clientActionId: string;
        atMs: number;
    }
    | {
        type: "REACTION_FINISHED";
        prototypeId: G0PrototypeId;
        reactionId: string;
        atMs: number;
    }
    | {
        type: "REPLAY";
        prototypeId: G0PrototypeId;
    }
    | {
        type: "RESET_PROTOTYPE";
        prototypeId: G0PrototypeId;
    }
    | {
        type: "RESET_ALL";
    };

const getRunId = (
    prototypeId: G0PrototypeId,
    runOrdinal: number,
): string => `${prototypeId}:run-${runOrdinal}`;

const createInitialPrototypeState = (
    prototypeId: G0PrototypeId,
    runOrdinal = 0,
): G0PrototypeState => ({
    runOrdinal,
    runId: getRunId(prototypeId, runOrdinal),
    phase: "await-action",
    turn: 0,
    history: [],
    queuedAction: null,
    activeReactionId: null,
    acceptedClientActionIds: [],
    startedAtMs: null,
    outcome: null,
    completedRuns: [],
    replayStarts: 0,
});

const createPrototypeStateRecord = (): Record<G0PrototypeId, G0PrototypeState> => ({
    "chain-excavation": createInitialPrototypeState("chain-excavation"),
    "creature-experiment": createInitialPrototypeState("creature-experiment"),
    "droplet-ricochet": createInitialPrototypeState("droplet-ricochet"),
    "underground-craft": createInitialPrototypeState("underground-craft"),
});

export const createInitialG0LabState = (
    activePrototypeId: G0PrototypeId = "chain-excavation",
    sessionSeed = "g0-whitebox-v1",
): G0LabState => ({
    sessionSeed,
    activePrototypeId,
    prototypes: createPrototypeStateRecord(),
});

const updatePrototype = (
    state: G0LabState,
    prototypeId: G0PrototypeId,
    update: (prototype: G0PrototypeState) => G0PrototypeState,
): G0LabState => ({
    ...state,
    prototypes: {
        ...state.prototypes,
        [prototypeId]: update(state.prototypes[prototypeId]),
    },
});

const getSeededBinary = (
    sessionSeed: string,
    prototypeId: G0PrototypeId,
    key: string,
): 0 | 1 => (
    hashRandomSeed(`${sessionSeed}:${prototypeId}:${key}`) % 2
) as 0 | 1;

export const getG0Targets = (
    state: G0LabState,
    prototypeId = state.activePrototypeId,
): G0TargetDefinition[] => {
    const prototype = state.prototypes[prototypeId];
    if (prototype.phase === "payoff" || prototype.turn >= G0_ACTIONS_PER_RUN) {
        return [];
    }

    const turnIndex = prototype.turn as 0 | 1 | 2;
    const ids = TARGET_IDS_BY_PROTOTYPE[prototypeId][turnIndex];
    const springLane = getSeededBinary(
        state.sessionSeed,
        "chain-excavation",
        "spring-lane",
    ) === 0
        ? "lane-upper"
        : "lane-lower";

    return ids.map((id) => {
        const base = BASE_TARGETS[id];
        if (prototypeId !== "chain-excavation") {
            return base;
        }

        const isSpringLane = id === springLane;
        return {
            ...base,
            cue: isSpringLane ? `${base.cue}・コトコト` : `${base.cue}・しずか`,
            accessibleLabel: isSpringLane
                ? `${base.accessibleLabel}。中で何かがコトコトしている`
                : `${base.accessibleLabel}。しずかな土`,
            targetClass: isSpringLane ? "wild" : "safe",
        };
    });
};

const countSwitches = (ids: readonly G0TargetId[]): number => ids.reduce(
    (count, id, index) => (
        index > 0 && id !== ids[index - 1] ? count + 1 : count
    ),
    0,
);

export const resolveG0Outcome = (
    prototypeId: G0PrototypeId,
    targetIds: readonly G0TargetId[],
    sessionSeed: string,
): G0Outcome => {
    if (targetIds.length !== G0_ACTIONS_PER_RUN) {
        throw new Error("G0 outcome requires exactly three accepted targets");
    }

    switch (prototypeId) {
        case "chain-excavation": {
            const switches = countSwitches(targetIds);
            const springLane = getSeededBinary(
                sessionSeed,
                prototypeId,
                "spring-lane",
            ) === 0
                ? "lane-upper"
                : "lane-lower";
            const touchedSpring = targetIds.includes(springLane);
            const firstSpringIndex = targetIds.findIndex(
                (targetId) => targetId === springLane,
            );
            const followedRedirect = (
                firstSpringIndex >= 0
                && firstSpringIndex < targetIds.length - 1
                && targetIds[firstSpringIndex + 1] !== springLane
            );

            if (switches === 0) {
                return {
                    id: "straight-burst",
                    title: "まっすぐ どーん！",
                    detail: "同じ段のひびが、太い一本の道になった。",
                    riskTaken: touchedSpring,
                    riskRecovered: false,
                };
            }
            if (switches === 1) {
                return {
                    id: followedRedirect ? "spring-zigzag" : "zigzag-burst",
                    title: "くるっと つながった！",
                    detail: "跳ねたひびを追い、斜めの近道を開いた。",
                    riskTaken: touchedSpring,
                    riskRecovered: followedRedirect,
                };
            }
            return {
                id: "cross-burst",
                title: "二つの道が いっぺんに！",
                detail: "上下を切り替えたひびが、交差して二口を開いた。",
                riskTaken: touchedSpring,
                riskRecovered: followedRedirect,
            };
        }
        case "creature-experiment": {
            const tools = targetIds.slice(0, 2);
            const fixture = targetIds[2];
            const puffCount = tools.filter((id) => id === "tool-puff").length;
            const form = puffCount === 2
                ? "roll"
                : puffCount === 0
                    ? "spring"
                    : "hybrid";
            const fixtureMatches = (
                (form === "roll" && fixture === "fixture-tunnel")
                || (form === "spring" && fixture === "fixture-high")
                || form === "hybrid"
            );

            return {
                id: `${form}:${fixture}`,
                title: fixtureMatches
                    ? "クセが ぴったり！"
                    : "あれっ、べつの口が ひらいた！",
                detail: fixtureMatches
                    ? "試して見つけた性質で、ねらった仕掛けを動かした。"
                    : "合わない形が安全にぽんと戻り、下の抜け道を開いた。",
                riskTaken: !fixtureMatches,
                riskRecovered: !fixtureMatches,
            };
        }
        case "droplet-ricochet": {
            const inlets = targetIds.slice(0, 2);
            const split = inlets[0] !== inlets[1];
            const pin = targetIds[2] === "bumper-pin";
            const outcomeId = split
                ? pin ? "cross-pinball" : "cross-catch"
                : pin ? "split-loop" : "merge-catch";

            return {
                id: outcomeId,
                title: pin ? "カン、コン、ぽよん！" : "しずくを キャッチ！",
                detail: split
                    ? "二つの入口から来たしずくが交差し、最後に同じ受け皿へ入った。"
                    : "重なったしずくが大きな一滴になり、短い道を開いた。",
                riskTaken: split || pin,
                riskRecovered: split && !pin,
            };
        }
        case "underground-craft": {
            const springCount = targetIds.filter(
                (id) => id === "part-spring",
            ).length;
            const outcome = [
                {
                    id: "steady-cross",
                    title: "するっと わたれた！",
                    detail: "三つの直線部品が支え合い、静かな橋になった。",
                },
                {
                    id: "single-vault",
                    title: "一か所だけ ぽよん！",
                    detail: "しなる部品の場所で一度跳ね、向こう岸へ着いた。",
                },
                {
                    id: "fold-slide",
                    title: "Vの字 すべりだい！",
                    detail: "二つのしなりが橋を折り、下の道へつながった。",
                },
                {
                    id: "accordion-launch",
                    title: "橋が まとめて ぽーん！",
                    detail: "三つのしなりが縮んで戻り、安全に向こうへ送った。",
                },
            ][springCount];

            return {
                ...outcome,
                riskTaken: springCount >= 2,
                riskRecovered: springCount === 2 && targetIds[2] === "part-beam",
            };
        }
    }
};

const isValidTarget = (
    state: G0LabState,
    prototypeId: G0PrototypeId,
    targetId: G0TargetId,
): boolean => getG0Targets(state, prototypeId).some(
    (target) => target.id === targetId,
);

const acceptTarget = (
    state: G0LabState,
    prototypeId: G0PrototypeId,
    targetId: G0TargetId,
    clientActionId: string,
    atMs: number,
): G0LabState => updatePrototype(state, prototypeId, (prototype) => {
    const nextTurn = (prototype.turn + 1) as 1 | 2 | 3;
    const reactionId = `${prototype.runId}:reaction-${nextTurn}`;

    return {
        ...prototype,
        phase: "reacting",
        turn: nextTurn,
        history: [
            ...prototype.history,
            {
                turn: nextTurn,
                targetId,
                acceptedAtMs: atMs,
            },
        ],
        queuedAction: null,
        activeReactionId: reactionId,
        acceptedClientActionIds: [
            ...prototype.acceptedClientActionIds,
            clientActionId,
        ],
        startedAtMs: prototype.startedAtMs ?? atMs,
    };
});

export const reduceG0LabState = (
    state: G0LabState,
    action: G0LabAction,
): G0LabState => {
    switch (action.type) {
        case "SWITCH_PROTOTYPE":
            return {
                ...state,
                activePrototypeId: action.prototypeId,
            };
        case "WORLD_TARGET_TAPPED": {
            if (action.prototypeId !== state.activePrototypeId) {
                return state;
            }

            const prototype = state.prototypes[action.prototypeId];
            if (
                prototype.phase === "payoff"
                || prototype.acceptedClientActionIds.includes(action.clientActionId)
                || prototype.queuedAction?.clientActionId === action.clientActionId
                || !isValidTarget(state, action.prototypeId, action.targetId)
            ) {
                return state;
            }

            if (prototype.phase === "reacting") {
                if (prototype.queuedAction !== null) {
                    return state;
                }
                return updatePrototype(state, action.prototypeId, (current) => ({
                    ...current,
                    queuedAction: {
                        targetId: action.targetId,
                        clientActionId: action.clientActionId,
                        atMs: action.atMs,
                    },
                }));
            }

            return acceptTarget(
                state,
                action.prototypeId,
                action.targetId,
                action.clientActionId,
                action.atMs,
            );
        }
        case "REACTION_FINISHED": {
            const prototype = state.prototypes[action.prototypeId];
            if (
                prototype.phase !== "reacting"
                || prototype.activeReactionId !== action.reactionId
            ) {
                return state;
            }

            if (prototype.turn === G0_ACTIONS_PER_RUN) {
                const targetIds = prototype.history.map((entry) => entry.targetId);
                const outcome = resolveG0Outcome(
                    action.prototypeId,
                    targetIds,
                    state.sessionSeed,
                );

                return updatePrototype(state, action.prototypeId, (current) => ({
                    ...current,
                    phase: "payoff",
                    activeReactionId: null,
                    queuedAction: null,
                    outcome,
                    completedRuns: [
                        ...current.completedRuns,
                        {
                            targetIds,
                            durationMs: Math.max(
                                0,
                                action.atMs - (current.startedAtMs ?? action.atMs),
                            ),
                            outcome,
                        },
                    ],
                }));
            }

            if (prototype.queuedAction) {
                const queued = prototype.queuedAction;
                const readyState = updatePrototype(
                    state,
                    action.prototypeId,
                    (current) => ({
                        ...current,
                        phase: "await-action",
                        activeReactionId: null,
                        queuedAction: null,
                    }),
                );
                return acceptTarget(
                    readyState,
                    action.prototypeId,
                    queued.targetId,
                    queued.clientActionId,
                    queued.atMs,
                );
            }

            return updatePrototype(state, action.prototypeId, (current) => ({
                ...current,
                phase: "await-action",
                activeReactionId: null,
            }));
        }
        case "REPLAY": {
            const prototype = state.prototypes[action.prototypeId];
            if (prototype.phase !== "payoff") {
                return state;
            }

            const fresh = createInitialPrototypeState(
                action.prototypeId,
                prototype.runOrdinal + 1,
            );
            return updatePrototype(state, action.prototypeId, () => ({
                ...fresh,
                completedRuns: prototype.completedRuns,
                replayStarts: prototype.replayStarts + 1,
            }));
        }
        case "RESET_PROTOTYPE":
            return updatePrototype(state, action.prototypeId, (prototype) => (
                createInitialPrototypeState(
                    action.prototypeId,
                    prototype.runOrdinal + 1,
                )
            ));
        case "RESET_ALL": {
            const prototypes = Object.fromEntries(
                G0_PROTOTYPE_IDS.map((prototypeId) => [
                    prototypeId,
                    createInitialPrototypeState(
                        prototypeId,
                        state.prototypes[prototypeId].runOrdinal + 1,
                    ),
                ]),
            ) as Record<G0PrototypeId, G0PrototypeState>;

            return {
                sessionSeed: state.sessionSeed,
                activePrototypeId: state.activePrototypeId,
                prototypes,
            };
        }
    }
};

export interface G0PrototypeMetrics {
    completedRuns: number;
    replayStarts: number;
    triedDifferentFirstTargets: boolean;
    averageDurationMs: number | null;
}

export const getG0PrototypeMetrics = (
    prototype: G0PrototypeState,
): G0PrototypeMetrics => {
    const firstTargets = new Set(
        prototype.completedRuns.map((run) => run.targetIds[0]),
    );
    const totalDuration = prototype.completedRuns.reduce(
        (sum, run) => sum + run.durationMs,
        0,
    );

    return {
        completedRuns: prototype.completedRuns.length,
        replayStarts: prototype.replayStarts,
        triedDifferentFirstTargets: firstTargets.size >= 2,
        averageDurationMs: prototype.completedRuns.length > 0
            ? totalDuration / prototype.completedRuns.length
            : null,
    };
};

export const getNextG0PrototypeId = (
    prototypeId: G0PrototypeId,
): G0PrototypeId => {
    const index = G0_PROTOTYPE_IDS.indexOf(prototypeId);
    return G0_PROTOTYPE_IDS[(index + 1) % G0_PROTOTYPE_IDS.length];
};
