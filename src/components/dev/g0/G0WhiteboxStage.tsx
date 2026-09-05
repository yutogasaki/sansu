import {
    G0_ACTIONS_PER_RUN,
    G0_PROTOTYPES,
    type G0AcceptedAction,
    type G0Outcome,
    type G0PrototypeId,
    type G0PrototypeState,
    type G0RunPhase,
    type G0TargetDefinition,
    type G0TargetId,
} from "../../../domain/explore/g0Whitebox";

export interface G0WhiteboxStageProps {
    prototypeId: G0PrototypeId;
    phase: G0RunPhase;
    turn: G0PrototypeState["turn"];
    history: readonly G0AcceptedAction[];
    targets: readonly G0TargetDefinition[];
    outcome: G0Outcome | null;
    queuedTargetId: G0TargetId | null;
    activeReactionId: string | null;
    reducedMotion: boolean;
    onTargetTap: (targetId: G0TargetId) => void;
}

interface WorldTargetProps {
    target: G0TargetDefinition;
    phase: G0RunPhase;
    history: readonly G0AcceptedAction[];
    queuedTargetId: G0TargetId | null;
    onTargetTap: (targetId: G0TargetId) => void;
}

const countTargetHits = (
    history: readonly G0AcceptedAction[],
    targetId: G0TargetId,
) => history.filter((entry) => entry.targetId === targetId).length;

const WorldTarget = ({
    target,
    phase,
    history,
    queuedTargetId,
    onTargetTap,
}: WorldTargetProps) => {
    const hitCount = countTargetHits(history, target.id);
    const isQueued = queuedTargetId === target.id;
    const isUnavailable = phase === "payoff" || queuedTargetId !== null;

    return (
        <button
            type="button"
            className={`g0-lab-world-target g0-lab-world-target--${target.id}`}
            data-target-id={target.id}
            data-target-class={target.targetClass}
            data-hit-count={hitCount}
            data-queued={isQueued ? "true" : "false"}
            aria-label={target.accessibleLabel}
            disabled={isUnavailable}
            onClick={() => onTargetTap(target.id)}
        >
            <span className="g0-lab-world-target__shape" aria-hidden="true">
                <span className="g0-lab-world-target__shape-part g0-lab-world-target__shape-part--one" />
                <span className="g0-lab-world-target__shape-part g0-lab-world-target__shape-part--two" />
                <span className="g0-lab-world-target__shape-part g0-lab-world-target__shape-part--three" />
            </span>
            <span className="g0-lab-world-target__cue">{target.cue}</span>
        </button>
    );
};

const WhiteboxScout = ({ variant }: { variant: string }) => (
    <span
        className={`g0-lab-scout g0-lab-scout--${variant}`}
        aria-hidden="true"
    >
        <span className="g0-lab-scout__hat" />
        <span className="g0-lab-scout__body">
            <span className="g0-lab-scout__eye g0-lab-scout__eye--left" />
            <span className="g0-lab-scout__eye g0-lab-scout__eye--right" />
        </span>
        <span className="g0-lab-scout__foot g0-lab-scout__foot--left" />
        <span className="g0-lab-scout__foot g0-lab-scout__foot--right" />
    </span>
);

const ChainExcavationScene = ({
    targets,
    phase,
    history,
    queuedTargetId,
    onTargetTap,
}: Pick<
    G0WhiteboxStageProps,
    "targets" | "phase" | "history" | "queuedTargetId" | "onTargetTap"
>) => (
    <>
        <span className="g0-lab-chain__quiet-shape" aria-hidden="true" />
        <div className="g0-lab-chain__terrain" aria-hidden="true">
            <span className="g0-lab-chain__lane g0-lab-chain__lane--upper">
                <span className="g0-lab-chain__crack g0-lab-chain__crack--upper-one" />
                <span className="g0-lab-chain__crack g0-lab-chain__crack--upper-two" />
                <span className="g0-lab-chain__crack g0-lab-chain__crack--upper-three" />
            </span>
            <span className="g0-lab-chain__lane g0-lab-chain__lane--lower">
                <span className="g0-lab-chain__crack g0-lab-chain__crack--lower-one" />
                <span className="g0-lab-chain__crack g0-lab-chain__crack--lower-two" />
                <span className="g0-lab-chain__crack g0-lab-chain__crack--lower-three" />
            </span>
            <span className="g0-lab-chain__junction" />
            <span className="g0-lab-chain__loose-clod" />
            <span className="g0-lab-chain__opened-path" />
        </div>
        <div className="g0-lab-stage__target-layer g0-lab-chain__target-layer">
            {targets.map((target, index) => (
                <WorldTarget
                    key={`world-target-${index}`}
                    target={target}
                    phase={phase}
                    history={history}
                    queuedTargetId={queuedTargetId}
                    onTargetTap={onTargetTap}
                />
            ))}
        </div>
        <WhiteboxScout variant="chain" />
    </>
);

const CreatureExperimentScene = ({
    targets,
    phase,
    history,
    queuedTargetId,
    onTargetTap,
}: Pick<
    G0WhiteboxStageProps,
    "targets" | "phase" | "history" | "queuedTargetId" | "onTargetTap"
>) => (
    <>
        <span className="g0-lab-creature__quiet-shape" aria-hidden="true" />
        <div className="g0-lab-creature__terrain" aria-hidden="true">
            <span className="g0-lab-creature__high-fixture">
                <span />
            </span>
            <span className="g0-lab-creature__tunnel" />
            <span className="g0-lab-creature__opened-route" />
        </div>
        <div className="g0-lab-creature__subject" aria-hidden="true">
            <span className="g0-lab-creature__subject-body">
                <span className="g0-lab-creature__subject-eye g0-lab-creature__subject-eye--left" />
                <span className="g0-lab-creature__subject-eye g0-lab-creature__subject-eye--right" />
            </span>
            <span className="g0-lab-creature__subject-foot g0-lab-creature__subject-foot--left" />
            <span className="g0-lab-creature__subject-foot g0-lab-creature__subject-foot--right" />
            <span className="g0-lab-creature__motion-mark g0-lab-creature__motion-mark--one" />
            <span className="g0-lab-creature__motion-mark g0-lab-creature__motion-mark--two" />
        </div>
        <div className="g0-lab-stage__target-layer g0-lab-creature__target-layer">
            {targets.map((target, index) => (
                <WorldTarget
                    key={`world-target-${index}`}
                    target={target}
                    phase={phase}
                    history={history}
                    queuedTargetId={queuedTargetId}
                    onTargetTap={onTargetTap}
                />
            ))}
        </div>
        <WhiteboxScout variant="creature" />
    </>
);

const DropletRicochetScene = ({
    targets,
    phase,
    history,
    queuedTargetId,
    onTargetTap,
}: Pick<
    G0WhiteboxStageProps,
    "targets" | "phase" | "history" | "queuedTargetId" | "onTargetTap"
>) => (
    <>
        <span className="g0-lab-droplet__quiet-shape" aria-hidden="true" />
        <div className="g0-lab-droplet__machine" aria-hidden="true">
            <span className="g0-lab-droplet__rail g0-lab-droplet__rail--top" />
            <span className="g0-lab-droplet__rail g0-lab-droplet__rail--bottom" />
            <span className="g0-lab-droplet__wide-bumper" />
            <span className="g0-lab-droplet__pin-bumper" />
            <span className="g0-lab-droplet__drop g0-lab-droplet__drop--one" />
            <span className="g0-lab-droplet__drop g0-lab-droplet__drop--two" />
            <span className="g0-lab-droplet__drop g0-lab-droplet__drop--three" />
            <span className="g0-lab-droplet__drop g0-lab-droplet__drop--echo" />
            <span className="g0-lab-droplet__receiver">
                <span />
            </span>
            <span className="g0-lab-droplet__result-path" />
        </div>
        <div className="g0-lab-stage__target-layer g0-lab-droplet__target-layer">
            {targets.map((target, index) => (
                <WorldTarget
                    key={`world-target-${index}`}
                    target={target}
                    phase={phase}
                    history={history}
                    queuedTargetId={queuedTargetId}
                    onTargetTap={onTargetTap}
                />
            ))}
        </div>
        <WhiteboxScout variant="droplet" />
    </>
);

const UndergroundCraftScene = ({
    targets,
    phase,
    history,
    queuedTargetId,
    onTargetTap,
}: Pick<
    G0WhiteboxStageProps,
    "targets" | "phase" | "history" | "queuedTargetId" | "onTargetTap"
>) => (
    <>
        <span className="g0-lab-craft__quiet-shape" aria-hidden="true" />
        <div className="g0-lab-craft__terrain" aria-hidden="true">
            <span className="g0-lab-craft__bank g0-lab-craft__bank--left" />
            <span className="g0-lab-craft__bank g0-lab-craft__bank--right" />
            <span className="g0-lab-craft__gap" />
            <span className="g0-lab-craft__placed-part g0-lab-craft__placed-part--one" />
            <span className="g0-lab-craft__placed-part g0-lab-craft__placed-part--two" />
            <span className="g0-lab-craft__placed-part g0-lab-craft__placed-part--three" />
            <span className="g0-lab-craft__lower-route" />
        </div>
        <div className="g0-lab-stage__target-layer g0-lab-craft__target-layer">
            {targets.map((target, index) => (
                <WorldTarget
                    key={`world-target-${index}`}
                    target={target}
                    phase={phase}
                    history={history}
                    queuedTargetId={queuedTargetId}
                    onTargetTap={onTargetTap}
                />
            ))}
        </div>
        <WhiteboxScout variant="craft" />
    </>
);

const getStatusText = ({
    prototypeId,
    phase,
    turn,
    outcome,
    queuedTargetId,
}: Pick<
    G0WhiteboxStageProps,
    "prototypeId" | "phase" | "turn" | "outcome" | "queuedTargetId"
>): string => {
    if (phase === "payoff" && outcome) {
        return `${outcome.title} ${outcome.detail}`;
    }

    if (phase === "reacting") {
        return queuedTargetId
            ? `${turn}手目が反応中。次のねらいも受け付けた。`
            : `${turn}手目が反応している。舞台の変化を見よう。`;
    }

    const promptIndex = Math.min(
        G0_ACTIONS_PER_RUN - 1,
        Math.max(0, turn),
    );
    return G0_PROTOTYPES[prototypeId].promptByTurn[promptIndex];
};

export const G0WhiteboxStage = ({
    prototypeId,
    phase,
    turn,
    history,
    targets,
    outcome,
    queuedTargetId,
    activeReactionId,
    reducedMotion,
    onTargetTap,
}: G0WhiteboxStageProps) => {
    const firstTargetId = history[0]?.targetId ?? "none";
    const lastTargetId = history[history.length - 1]?.targetId ?? "none";
    const turnOneTargetId = history.find((entry) => entry.turn === 1)?.targetId ?? "none";
    const turnTwoTargetId = history.find((entry) => entry.turn === 2)?.targetId ?? "none";
    const turnThreeTargetId = history.find((entry) => entry.turn === 3)?.targetId ?? "none";
    const historyIds = history.map((entry) => entry.targetId).join("|") || "none";
    const sceneProps = {
        targets,
        phase,
        history,
        queuedTargetId,
        onTargetTap,
    };

    return (
        <section
            className={[
                "g0-lab-stage",
                `g0-lab-stage--${prototypeId}`,
                reducedMotion ? "g0-lab-stage--reduced-motion" : "",
            ].filter(Boolean).join(" ")}
            data-prototype-id={prototypeId}
            data-phase={phase}
            data-turn={turn}
            data-history={historyIds}
            data-first-target-id={firstTargetId}
            data-last-target-id={lastTargetId}
            data-turn-one-target-id={turnOneTargetId}
            data-turn-two-target-id={turnTwoTargetId}
            data-turn-three-target-id={turnThreeTargetId}
            data-outcome-id={outcome?.id ?? "pending"}
            data-risk-taken={outcome?.riskTaken ? "true" : "false"}
            data-risk-recovered={outcome?.riskRecovered ? "true" : "false"}
            data-queued-target-id={queuedTargetId ?? "none"}
            data-active-reaction-id={activeReactionId ?? "none"}
            data-reduced-motion={reducedMotion ? "true" : "false"}
            aria-label={`${G0_PROTOTYPES[prototypeId].title}の しさくぶたい`}
        >
            <p
                className="g0-lab-visually-hidden"
                role="status"
                aria-live="polite"
                aria-atomic="true"
            >
                {getStatusText({
                    prototypeId,
                    phase,
                    turn,
                    outcome,
                    queuedTargetId,
                })}
            </p>

            {prototypeId === "chain-excavation" ? (
                <ChainExcavationScene {...sceneProps} />
            ) : null}
            {prototypeId === "creature-experiment" ? (
                <CreatureExperimentScene {...sceneProps} />
            ) : null}
            {prototypeId === "droplet-ricochet" ? (
                <DropletRicochetScene {...sceneProps} />
            ) : null}
            {prototypeId === "underground-craft" ? (
                <UndergroundCraftScene {...sceneProps} />
            ) : null}
        </section>
    );
};

export default G0WhiteboxStage;
