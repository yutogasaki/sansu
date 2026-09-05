import { useEffect, useMemo, useRef } from "react";
import {
    G0_CHAIN_GOAL,
    getG0ChainShotTargets,
    type G0ChainShotState,
    type G0ChainShotTargetId,
} from "../../../domain/explore/g0ChainShot";
import {
    G0_NUMBER_VESSEL_CAPACITY,
    G0_NUMBER_VESSEL_SIGNATURE_RECIPE_KEY,
    getG0NumberVesselNextPreviewAmount,
    type G0NumberVesselState,
} from "../../../domain/explore/g0NumberVessel";
import type { G0MechanicPrototypeId } from "../../../domain/explore/g0MechanicRemix";

interface SharedStageProps {
    reducedMotion: boolean;
}

interface ChainShotStageProps extends SharedStageProps {
    state: G0ChainShotState;
    onTargetTap: (targetId: G0ChainShotTargetId) => void;
}

interface NumberVesselStageProps extends SharedStageProps {
    state: G0NumberVesselState;
    onTokenTap: (tokenId: string) => void;
    onSplitSelected: () => void;
}

export interface G0MechanicRemixStageProps extends SharedStageProps {
    prototypeId: G0MechanicPrototypeId;
    chainState: G0ChainShotState;
    numberState: G0NumberVesselState;
    onChainTargetTap: (targetId: G0ChainShotTargetId) => void;
    onNumberTokenTap: (tokenId: string) => void;
    onNumberSplitSelected: () => void;
}

const VisuallyHiddenStatus = ({ children }: { children: string }) => (
    <p
        className="g0v2-visually-hidden"
        role="status"
        aria-live="polite"
        aria-atomic="true"
    >
        {children}
    </p>
);

const getChainStatus = (state: G0ChainShotState): string => {
    if (state.phase === "payoff" && state.outcome) {
        return `${state.outcome.title} ${state.outcome.detail}`;
    }
    if (state.phase === "reacting" && state.pendingAction) {
        const target = getG0ChainShotTargets(state).find(
            (candidate) => candidate.id === state.pendingAction?.targetId,
        );
        return `${target?.cue ?? "ねらった場所"}が反応している。変化を見よう。`;
    }
    if (state.instability > 0) {
        return "ひびが跳ねている。コトコトを追うか、ぐるっとつなげられる。";
    }
    return "しずかなひびか、コトコトする土をねらえる。";
};

const ChainShotStage = ({
    state,
    reducedMotion,
    onTargetTap,
}: ChainShotStageProps) => {
    const firstTargetRef = useRef<HTMLButtonElement | null>(null);
    const targets = useMemo(() => getG0ChainShotTargets(state), [state]);
    const latestAction = state.history[state.history.length - 1] ?? null;

    useEffect(() => {
        if (state.phase === "await-action" && state.actionCount > 0) {
            firstTargetRef.current?.focus({ preventScroll: true });
        }
    }, [state.actionCount, state.phase]);

    return (
        <section
            className={[
                "g0v2-stage",
                "g0v2-stage--chain-shot",
                reducedMotion ? "g0v2-stage--reduced-motion" : "",
            ].filter(Boolean).join(" ")}
            data-testid="g0v2-chain-stage"
            data-phase={state.phase}
            data-action-count={state.actionCount}
            data-route-progress={state.routeProgress}
            data-instability={state.instability}
            data-risk-state={state.riskState}
            data-equipped-carry={state.equippedCarryKey ?? "none"}
            data-banked-carry={state.bankedCarryKey ?? "none"}
            data-last-target={latestAction?.targetId ?? "none"}
            data-ending={state.outcome?.ending ?? "pending"}
            data-reduced-motion={reducedMotion ? "true" : "false"}
            aria-label="ねらい撃ち連鎖の白箱"
        >
            <VisuallyHiddenStatus>{getChainStatus(state)}</VisuallyHiddenStatus>

            <div className="g0v2-chain-hud" aria-label="今回の目標">
                <div className="g0v2-chain-route-meter">
                    <span>みち</span>
                    <span
                        className="g0v2-chain-route-meter__track"
                        aria-label={`道 ${state.routeProgress}/${G0_CHAIN_GOAL.routeProgress}`}
                    >
                        {Array.from(
                            { length: G0_CHAIN_GOAL.routeProgress },
                            (_, index) => (
                                <i
                                    key={index}
                                    data-filled={index < state.routeProgress}
                                />
                            ),
                        )}
                    </span>
                </div>
                <div
                    className="g0v2-chain-carry"
                    data-filled={state.bankedCarryKey !== null}
                >
                    <span aria-hidden="true" />
                    {state.bankedCarryKey ? "クセを つかまえた" : "もちかえり"}
                </div>
                {state.equippedCarryKey && (
                    <div className="g0v2-chain-equipped">
                        前のクセ +1
                    </div>
                )}
            </div>

            <div className="g0v2-chain-world" aria-hidden="true">
                <span className="g0v2-chain-ground" />
                <span className="g0v2-chain-route g0v2-chain-route--one" />
                <span className="g0v2-chain-route g0v2-chain-route--two" />
                <span className="g0v2-chain-projectile" />
                <span className="g0v2-chain-gate">
                    <i />
                    <i />
                </span>
                <span className="g0v2-chain-detour" />
                <span className="g0v2-chain-scout">
                    <i className="g0v2-chain-scout__head" />
                    <i className="g0v2-chain-scout__body" />
                    <i className="g0v2-chain-scout__foot" />
                </span>
                <span className="g0v2-chain-peg-field">
                    {Array.from({ length: 12 }, (_, index) => (
                        <i key={index} />
                    ))}
                </span>
            </div>

            <div className="g0v2-chain-targets">
                {targets.map((target, index) => (
                    <button
                        key={target.id}
                        ref={index === 0 ? firstTargetRef : undefined}
                        type="button"
                        className={`g0v2-chain-target g0v2-chain-target--${target.id}`}
                        data-target-id={target.id}
                        data-target-class={target.targetClass}
                        data-available={target.available}
                        data-preview-yield={target.previewYield}
                        disabled={!target.available}
                        aria-label={`${target.accessibleLabel}。つながり ${target.previewYield}`}
                        onClick={() => onTargetTap(target.id)}
                    >
                        <span className="g0v2-chain-target__shape" aria-hidden="true">
                            <i />
                            <i />
                            <i />
                        </span>
                        <span className="g0v2-chain-target__cue">{target.cue}</span>
                        <span className="g0v2-chain-target__yield">
                            +{target.previewYield}
                        </span>
                    </button>
                ))}
            </div>

            <div className="g0v2-chain-yield" aria-label={`連鎖 ${state.yieldCount}`}>
                <span>れんさ</span>
                <strong>{state.yieldCount}</strong>
            </div>
        </section>
    );
};

const renderAmountDots = (amount: number) => (
    <span className="g0v2-number-token__dots" aria-hidden="true">
        {Array.from({ length: Math.min(8, amount) }, (_, index) => (
            <i key={index} />
        ))}
    </span>
);

const getNumberStatus = (state: G0NumberVesselState): string => {
    if (state.phase === "payoff" && state.outcome) {
        return `${state.outcome.title} ${state.outcome.detail}`;
    }
    if (state.phase === "reacting" && state.pendingOperation) {
        const operation = state.pendingOperation;
        if (operation.kind === "compose") {
            return `${operation.sourceAmounts.join("と")}を合わせて、${operation.resultAmounts[0]}になった。`;
        }
        return `${operation.sourceAmounts[0]}を、${operation.resultAmounts.join("と")}に分けた。`;
    }
    if (state.overflowRecoveryPending) {
        return "うつわからあふれている。二つを合わせると場所を空けられる。";
    }
    if (state.selectedTokenId) {
        const selected = state.tokens.find(
            (token) => token.id === state.selectedTokenId,
        );
        return `${selected?.amount ?? "数"}を選んだ。合わせる相手を選ぶか、二つに分けられる。`;
    }
    return "一つの数を選び、次に合わせる相手を選ぶ。";
};

const NumberVesselStage = ({
    state,
    reducedMotion,
    onTokenTap,
    onSplitSelected,
}: NumberVesselStageProps) => {
    const firstTokenRef = useRef<HTMLButtonElement | null>(null);
    const selectedToken = state.tokens.find(
        (token) => token.id === state.selectedTokenId,
    ) ?? null;
    const previewAmount = getG0NumberVesselNextPreviewAmount(state);
    const splitAvailable = (
        state.phase === "await-action"
        && !state.overflowRecoveryPending
        && selectedToken !== null
        && selectedToken.amount >= 2
    );
    const pressure = Math.min(
        state.tokens.length,
        G0_NUMBER_VESSEL_CAPACITY + 1,
    );

    useEffect(() => {
        if (state.phase === "await-action" && state.actionCount > 0) {
            firstTokenRef.current?.focus({ preventScroll: true });
        }
    }, [state.actionCount, state.phase]);

    return (
        <section
            className={[
                "g0v2-stage",
                "g0v2-stage--number-vessel",
                reducedMotion ? "g0v2-stage--reduced-motion" : "",
            ].filter(Boolean).join(" ")}
            data-testid="g0v2-number-stage"
            data-phase={state.phase}
            data-action-count={state.actionCount}
            data-token-count={state.tokens.length}
            data-pressure={pressure}
            data-overflow={state.tokens.length > G0_NUMBER_VESSEL_CAPACITY}
            data-recovery-pending={state.overflowRecoveryPending}
            data-recovery-succeeded={state.recoverySucceeded}
            data-end-reason={state.endReason ?? "pending"}
            data-reduced-motion={reducedMotion ? "true" : "false"}
            aria-label="数のうつわの白箱"
        >
            <VisuallyHiddenStatus>{getNumberStatus(state)}</VisuallyHiddenStatus>

            <div className="g0v2-number-hud">
                <div className="g0v2-number-recipe" aria-label="見つける組み合わせ 1と4">
                    <span>みつける</span>
                    <strong>{G0_NUMBER_VESSEL_SIGNATURE_RECIPE_KEY}</strong>
                </div>
                <div className="g0v2-number-pressure">
                    <span>うつわ</span>
                    <span aria-label={`${state.tokens.length}/${G0_NUMBER_VESSEL_CAPACITY}`}>
                        {Array.from(
                            { length: G0_NUMBER_VESSEL_CAPACITY },
                            (_, index) => (
                                <i
                                    key={index}
                                    data-filled={index < state.tokens.length}
                                />
                            ),
                        )}
                    </span>
                </div>
                <div className="g0v2-number-discoveries">
                    レシピ {state.discoveredRecipeKeys.length}
                </div>
            </div>

            <div className="g0v2-number-workbench">
                <div
                    className="g0v2-number-vessel"
                    data-overflow={state.tokens.length > G0_NUMBER_VESSEL_CAPACITY}
                >
                    <div className="g0v2-number-token-grid">
                        {state.tokens.map((token, index) => (
                            <button
                                key={token.id}
                                ref={index === 0 ? firstTokenRef : undefined}
                                type="button"
                                className="g0v2-number-token"
                                data-token-id={token.id}
                                data-token-amount={token.amount}
                                data-token-origin={token.origin}
                                aria-pressed={token.id === state.selectedTokenId}
                                aria-label={
                                    token.id === state.selectedTokenId
                                        ? `${token.amount}。選択中。もう一度押すと選択をやめる`
                                        : `${token.amount}。合わせる数として選ぶ`
                                }
                                disabled={state.phase !== "await-action"}
                                onClick={() => onTokenTap(token.id)}
                            >
                                <strong>{token.amount}</strong>
                                {renderAmountDots(token.amount)}
                            </button>
                        ))}
                    </div>
                    <span className="g0v2-number-vessel__rim" aria-hidden="true" />
                    <span className="g0v2-number-vessel__spill" aria-hidden="true" />
                </div>

                <aside className="g0v2-number-preview" aria-label="次に入る数">
                    <span>つぎ</span>
                    {previewAmount === null ? (
                        <strong>—</strong>
                    ) : (
                        <strong>
                            {previewAmount}
                            {renderAmountDots(previewAmount)}
                        </strong>
                    )}
                    <small>あわせた後</small>
                </aside>
            </div>

            <div className="g0v2-number-operation">
                <p>
                    {state.overflowRecoveryPending
                        ? "二つを あわせて ばしょをあける"
                        : selectedToken
                            ? `${selectedToken.amount} と あわせる相手をえらぶ`
                            : "はじめの数を えらぶ"}
                </p>
                <button
                    type="button"
                    className="g0v2-number-split"
                    disabled={!splitAvailable}
                    onClick={onSplitSelected}
                >
                    <span aria-hidden="true">
                        {selectedToken?.amount ?? "?"} → ◯ + ◯
                    </span>
                    <span>えらんだ数を わける</span>
                </button>
            </div>
        </section>
    );
};

export const G0MechanicRemixStage = ({
    prototypeId,
    chainState,
    numberState,
    reducedMotion,
    onChainTargetTap,
    onNumberTokenTap,
    onNumberSplitSelected,
}: G0MechanicRemixStageProps) => (
    prototypeId === "chain-shot"
        ? (
            <ChainShotStage
                state={chainState}
                reducedMotion={reducedMotion}
                onTargetTap={onChainTargetTap}
            />
        )
        : (
            <NumberVesselStage
                state={numberState}
                reducedMotion={reducedMotion}
                onTokenTap={onNumberTokenTap}
                onSplitSelected={onNumberSplitSelected}
            />
        )
);

export default G0MechanicRemixStage;
