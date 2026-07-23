import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BridgeChoicePanel } from "../components/explore/BridgeChoicePanel";
import {
    DiscoveryReveal,
    isBlockingDiscoveryReveal,
} from "../components/explore/DiscoveryReveal";
import { ExploreGlyph, type ExploreGlyphKind } from "../components/explore/ExploreGlyph";
import {
    ExploreMap,
    type ExploreMapEdgeView,
    type ExploreMapNodeView,
} from "../components/explore/ExploreMap";
import { ExplorePathChoice } from "../components/explore/ExplorePathChoice";
import { ExploreActionResult } from "../components/explore/ExploreActionResult";
import { ExploreEncounterStage } from "../components/explore/ExploreEncounterStage";
import { ExploreHud } from "../components/explore/ExploreHud";
import { MakimodonEncounterArt } from "../components/explore/MakimodonEncounterArt";
import {
    ExploreProblemPanel,
    type ExploreProblemFeedback,
} from "../components/explore/ExploreProblemPanel";
import {
    selectOpeningProblemPresentation,
    selectRootPullPayoffVariant,
    type RootPullPayoffVariant,
} from "../components/explore/rootPullPresentation";
import type { ResearchPageSummaryState } from "../components/explore/ResearchPageSummary";
import { ReturnSummary } from "../components/explore/ReturnSummary";
import { ExploreWorldBackdrop } from "../components/explore/ExploreWorldBackdrop";
import {
    appendExploreAnswerInput,
    deleteExploreAnswerInput,
} from "../components/explore/exploreAnswerInput";
import {
    commitExploreAttemptFromUi,
    createExploreActiveCheckpoint,
    createAndReserveExploreProblemPlan,
    createAttemptIdentityKey,
    createExploreAttemptRecordingTarget,
    createInitialExploreState,
    exploreReducer,
    finishExploreRunFromUi,
    FIREFLY_FLOWER_DISCOVERY_PAGE,
    getDiscoveryPageDefinition,
    getDiscoveryPageProgress,
    getExploreEncounterDefinition,
    getExploreObservationDefinition,
    getExploreOpeningExperience,
    getExploreLearningSegmentKey,
    getAvailableExploreNodes,
    getExploreReplayTeaser,
    getResumableExploreRunFromUi,
    getExploreBenchmarkE2EOptions,
    getExploreRunE2EOptions,
    getRemainingRapidLoopBudgetMs,
    ExplorePersistenceConflictError,
    isExploreOpeningCompletion,
    isExploreOpeningStep,
    isExploreAnswerCorrect,
    resolveExploreOpeningExperience,
    projectRapidLoopAfterCorrectCommit,
    RAPID_LOOP_AUTO_BRIDGE_PLAN,
    settleRapidLoopPrefetchWithin,
    selectExploreEncounterPhase,
    selectExploreObservation,
    selectExploreDiscoveryPresentation,
    selectDeterministicRapidLoopNodeId,
    saveExploreRunCheckpointFromUi,
    shouldAutoRouteExplorePath,
    startExploreRunFromUi,
    willCompleteExploreOpeningStep,
    type CommitExploreAttemptInput,
    type DiscoveryInstance,
    type ExploreBridgePlan,
    type ExploreAttemptCommitReceipt,
    type CommittedExploreWorldReactionIdentity,
    type ExploreActiveCheckpoint,
    type ExploreLearningAssignment,
    type FinishExploreRunInput,
    type ExploreOpeningExperienceDefinition,
    type ExploreRunState,
} from "../domain/explore";
import type { Problem, UserProfile } from "../domain/types";
import { getActiveProfile } from "../domain/user/repository";
import { playSound, setSoundEnabled } from "../utils/audio";
import { holdPwaUpdateForCriticalPersistence, reachPwaUpdateCheckpoint } from "../pwa";

type ExploreScreenPhase = "intro" | "run";
type ExploreAttemptSaveStatus = "idle" | "saving" | "error";
type ExploreRunFinishIntent = "returned" | "rescued" | "exit";

export const INITIAL_EXPLORE_PHASE: ExploreScreenPhase = "run";
const CLASSIC_OPENING_EXPERIENCE = getExploreOpeningExperience("classic-v1");
export const RAPID_LOOP_CORRECT_HOLD_MS = CLASSIC_OPENING_EXPERIENCE.timing.correctHoldMs;
export const RAPID_LOOP_PAYOFF_HOLD_MS = CLASSIC_OPENING_EXPERIENCE.timing.payoffHoldMs;
export const RAPID_LOOP_REVEAL_DELAY_MS = CLASSIC_OPENING_EXPERIENCE.timing.revealDelayMs;
export const RAPID_LOOP_INCORRECT_RETRY_TARGET_MS = 420;
export const RAPID_LOOP_INCORRECT_HARD_LIMIT_MS = 520;
export const RAPID_LOOP_INCORRECT_HOLD_MS = RAPID_LOOP_INCORRECT_HARD_LIMIT_MS;
export const RAPID_LOOP_CORRECT_OPERABLE_TARGET_MS = 620;
export const ATTEMPT_SAVING_NOTICE_DELAY_MS = 250;

// eslint-disable-next-line react-refresh/only-export-components -- timing policy is pure and directly unit tested.
export const getRapidLoopIncorrectRetryDelayMs = (elapsedMs: number): number => (
    Math.max(0, RAPID_LOOP_INCORRECT_RETRY_TARGET_MS - Math.max(0, elapsedMs))
);

const resolveOpeningExperienceForUiSession = (): ExploreOpeningExperienceDefinition => (
    resolveExploreOpeningExperience({
        envValue: import.meta.env.VITE_EXPLORE_EXPERIENCE,
        urlSearch: window.location.search,
        allowUrlOverride: import.meta.env.DEV || import.meta.env.MODE === "test",
    })
);

// eslint-disable-next-line react-refresh/only-export-components -- return-page selection is pure and directly unit tested.
export const selectConfirmedResearchPage = (
    finds: readonly DiscoveryInstance[],
): ResearchPageSummaryState | undefined => {
    const latestPageIds = [...finds].reverse().reduce<Array<NonNullable<
        DiscoveryInstance["discoveryPageId"]
    >>>((pageIds, find) => {
        if (find.discoveryPageId && !pageIds.includes(find.discoveryPageId)) {
            pageIds.push(find.discoveryPageId);
        }
        return pageIds;
    }, []);
    const pageSummaries = latestPageIds.flatMap((pageId) => {
        const definition = getDiscoveryPageDefinition(pageId);
        if (!definition) return [];
        const pageFinds = finds.filter((find) => find.discoveryPageId === pageId);
        const latestObservation = [...pageFinds].reverse().find((find) => find.observationId);

        return [{
            definition,
            discoveredFeatureIds: pageFinds.flatMap((find) => (
                find.discoveryFeatureId
                    ? [find.discoveryFeatureId]
                    : []
            )),
            observation: getExploreObservationDefinition(latestObservation?.observationId),
        } satisfies ResearchPageSummaryState];
    });

    return pageSummaries[0];
};

// eslint-disable-next-line react-refresh/only-export-components -- durable reveal selection is pure and unit tested.
export const selectNextUnacknowledgedDiscovery = (
    discoveries: readonly DiscoveryInstance[],
    acknowledgedDiscoveryId?: string,
): DiscoveryInstance | undefined => {
    const acknowledgedIndex = acknowledgedDiscoveryId
        ? discoveries.findIndex((find) => find.id === acknowledgedDiscoveryId)
        : -1;
    return discoveries[Math.max(0, acknowledgedIndex + 1)];
};

// eslint-disable-next-line react-refresh/only-export-components -- barrier selection is pure and unit tested.
export const selectUnacknowledgedBlockingDiscovery = (
    discoveries: readonly DiscoveryInstance[],
    acknowledgedDiscoveryId?: string,
): DiscoveryInstance | undefined => {
    const acknowledgedIndex = acknowledgedDiscoveryId
        ? discoveries.findIndex((find) => find.id === acknowledgedDiscoveryId)
        : -1;
    return discoveries
        .slice(Math.max(0, acknowledgedIndex + 1))
        .find(isBlockingDiscoveryReveal);
};

type ExploreRunPersistenceState =
    | { status: "idle" | "starting" }
    | { status: "ready"; runId: string; checkpointRevision: number }
    | { status: "checkpointing"; runId: string; checkpointRevision: number }
    | { status: "finishing"; intent: ExploreRunFinishIntent }
    | { status: "error"; operation: "start" | "checkpoint" | ExploreRunFinishIntent };

interface FrozenExploreAttempt {
    input: CommitExploreAttemptInput;
    problem: Problem;
    assignment: ExploreLearningAssignment;
    answer: string;
    expectedResult: "correct" | "incorrect";
}

interface FrozenExploreRunFinish {
    intent: ExploreRunFinishIntent;
    input: FinishExploreRunInput;
}

interface RapidLoopTransition {
    attemptKey: string;
    controller: AbortController;
}

interface ExploreWorldReaction extends CommittedExploreWorldReactionIdentity {
    fromNodeId: string;
    actionType: "dig" | "bridge";
    bridgePlan?: ExploreBridgePlan;
}

const createFreshRun = () => createInitialExploreState(getExploreRunE2EOptions());

const ExploreLoadingState: React.FC<{ message?: string }> = ({
    message = "もんだいを えらんでいるよ",
}) => (
    <div
        className="explore-panel flex h-full flex-col items-center justify-center gap-3 rounded-[28px] px-5 text-center"
        role="status"
        aria-live="polite"
    >
        <span className="flex h-14 w-14 items-center justify-center rounded-[19px] bg-cyan-100 text-cyan-900" aria-hidden="true">
            <ExploreGlyph kind="light" className="h-11 w-11" />
        </span>
        <p className="text-sm font-black text-cyan-900">{message}</p>
    </div>
);

const MakimodonPayoffHold: React.FC<{ reducedMotion: boolean }> = ({
    reducedMotion,
}) => (
    <section
        className="explore-immersive h-full min-h-0 overflow-hidden rounded-[28px]"
        data-state="complete"
        data-testid="makimodon-payoff-hold"
        role="status"
        aria-live="polite"
        aria-labelledby="makimodon-payoff-hold-title"
    >
        <div className="explore-immersive-art explore-immersive-art--layered">
            <MakimodonEncounterArt
                stage="payoff"
                reducedMotion={reducedMotion}
                decorative
                className="explore-immersive-authored-art"
            />
            <div className="explore-immersive-scrim" aria-hidden="true" />
        </div>
        <div className="explore-immersive-completion-stage">
            <div className="explore-immersive-completion-card">
                <p className="explore-immersive-kicker">●●● なぞが とけた</p>
                <h2 id="makimodon-payoff-hold-title" tabIndex={-1} className="focus:outline-none">
                    ぜんぶ まきもどった！
                </h2>
                <p>あいぼうが せなかへ どん。</p>
            </div>
        </div>
    </section>
);

interface ExplorePersistenceRecoveryProps {
    title: string;
    detail: string;
    buttonLabel?: string;
    secondaryLabel?: string;
    onSecondary?: () => void;
    onRetry: () => void;
}

const ExplorePersistenceRecovery: React.FC<ExplorePersistenceRecoveryProps> = ({
    title,
    detail,
    buttonLabel = "もういちど きろくする",
    secondaryLabel,
    onSecondary,
    onRetry,
}) => (
    <div className="explore-panel flex h-full flex-col items-center justify-center gap-3 rounded-[28px] px-5 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-[19px] bg-amber-100 text-amber-900" aria-hidden="true">
            <ExploreGlyph kind="map" className="h-11 w-11" />
        </span>
        <div role="alert" aria-atomic="true">
            <p className="text-base font-black text-[var(--explore-ink)]">{title}</p>
            <p className="mt-1 text-sm font-bold leading-6 text-[var(--explore-muted)]">{detail}</p>
        </div>
        <button
            type="button"
            onClick={onRetry}
            className="explore-primary-action explore-focus-ring min-h-12 rounded-[17px] px-6 text-sm font-black"
        >
            {buttonLabel}
        </button>
        {secondaryLabel && onSecondary ? (
            <button
                type="button"
                onClick={onSecondary}
                className="explore-focus-ring min-h-11 rounded-[15px] px-4 text-sm font-black text-[var(--explore-muted)] underline decoration-[rgba(24,63,73,0.24)] underline-offset-4"
            >
                {secondaryLabel}
            </button>
        ) : null}
    </div>
);

interface ExploreAttemptPersistenceNoticeProps {
    status: Exclude<ExploreAttemptSaveStatus, "idle">;
    onRetry: () => void;
}

const ExploreAttemptPersistenceNotice: React.FC<ExploreAttemptPersistenceNoticeProps> = ({
    status,
    onRetry,
}) => status === "saving" ? (
    <div
        className="explore-panel flex min-h-11 shrink-0 items-center justify-center rounded-[18px] px-3 text-center text-xs font-black text-cyan-900"
        role="status"
        aria-live="polite"
    >
        たんけんノートに かいているよ
    </div>
) : (
    <div className="explore-panel flex shrink-0 items-center gap-2 rounded-[18px] border border-amber-200/80 px-3 py-2">
        <p className="min-w-0 flex-1 text-xs font-bold leading-5 text-amber-950" role="alert">
            ノートに まだ かけなかったよ。こたえは そのままです。
        </p>
        <button
            type="button"
            onClick={onRetry}
            className="explore-focus-ring min-h-11 shrink-0 rounded-[14px] bg-amber-300 px-3 text-xs font-black text-amber-950 shadow-sm"
        >
            もういちど きろくする
        </button>
    </div>
);

const receiptMatchesFrozenAttempt = (
    receipt: ExploreAttemptCommitReceipt,
    frozen: FrozenExploreAttempt,
) => (
    receipt.attemptKey === createAttemptIdentityKey(receipt.identity)
    && receipt.attemptKey === createAttemptIdentityKey(frozen.input.identity)
    && receipt.identity.profileId === frozen.input.identity.profileId
    && receipt.identity.runId === frozen.input.identity.runId
    && receipt.identity.gateId === frozen.input.identity.gateId
    && receipt.identity.attemptNumber === frozen.input.identity.attemptNumber
    && receipt.recordedSkillId === frozen.problem.categoryId
    && receipt.result === frozen.expectedResult
    && receipt.affectsSrs === frozen.assignment.affectsSrs
    && receipt.assignmentKey === frozen.assignment.assignmentKey
    && receipt.learningSource === frozen.assignment.source
);

export const Explore: React.FC = () => {
    const navigate = useNavigate();
    const reduceMotion = useReducedMotion();
    // Presentation is captured once and never persisted. Environment or URL
    // changes therefore cannot swap the visual rule in the middle of a run.
    const [openingExperience, setOpeningExperience] = useState(
        resolveOpeningExperienceForUiSession,
    );
    const benchmark = getExploreBenchmarkE2EOptions();
    const [state, dispatch] = useReducer(exploreReducer, undefined, createFreshRun);
    const [phase, setPhase] = useState<ExploreScreenPhase>(INITIAL_EXPLORE_PHASE);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [profileResolved, setProfileResolved] = useState(false);
    const [isWideLayout, setIsWideLayout] = useState(() => (
        window.matchMedia("(min-width: 1024px) and (orientation: landscape)").matches
    ));
    const [answer, setAnswer] = useState("");
    const [feedback, setFeedback] = useState<ExploreProblemFeedback>("idle");
    const [attemptSaveStatus, setAttemptSaveStatus] = useState<ExploreAttemptSaveStatus>("idle");
    const [problemPlanStatus, setProblemPlanStatus] = useState<"idle" | "loading" | "error">("idle");
    const [problemPlanRetryNonce, setProblemPlanRetryNonce] = useState(0);
    const [showAttemptSavingNotice, setShowAttemptSavingNotice] = useState(false);
    const [runPersistence, setRunPersistence] = useState<ExploreRunPersistenceState>({ status: "idle" });
    const runPersistenceRef = useRef(runPersistence);
    runPersistenceRef.current = runPersistence;
    const [startRetryNonce, setStartRetryNonce] = useState(0);
    const [revealedDiscovery, setRevealedDiscovery] = useState<DiscoveryInstance | null>(null);
    const [worldReaction, setWorldReaction] = useState<ExploreWorldReaction | null>(null);
    const feedbackTimerRef = useRef<number | null>(null);
    const revealTimerRef = useRef<number | null>(null);
    const attemptSavingNoticeTimerRef = useRef<number | null>(null);
    const lastRevealIdRef = useRef<string | null>(null);
    const acknowledgedDiscoveryIdRef = useRef<string | undefined>(undefined);
    const checkpointRef = useRef<ExploreActiveCheckpoint | null>(null);
    const checkpointStateRef = useRef<ExploreRunState | null>(null);
    const checkpointQueueRef = useRef<Promise<void>>(Promise.resolve());
    const checkpointOperationsRef = useRef(0);
    const checkpointEpochRef = useRef(0);
    const checkpointFailedEpochRef = useRef<number | null>(null);
    const checkpointTransitionInFlightRef = useRef(false);
    const runBootstrapInFlightRef = useRef(false);
    const revealPersistenceInFlightRef = useRef<string | null>(null);
    const attemptSaveInFlightRef = useRef(false);
    const frozenAttemptRef = useRef<FrozenExploreAttempt | null>(null);
    const runFinishInFlightRef = useRef(false);
    const frozenRunFinishRef = useRef<FrozenExploreRunFinish | null>(null);
    const rapidLoopTransitionRef = useRef<RapidLoopTransition | null>(null);
    const isExploreMountedRef = useRef(false);
    const activeExploreRunIdRef = useRef(state.runId);
    activeExploreRunIdRef.current = state.runId;
    const previousRootPullPayoffVariantRef = useRef<RootPullPayoffVariant | undefined>(undefined);
    const rootPullPayoffVariant = useMemo(
        () => selectRootPullPayoffVariant(
            state.runId,
            previousRootPullPayoffVariantRef.current,
        ),
        [state.runId],
    );
    useEffect(() => {
        previousRootPullPayoffVariantRef.current = rootPullPayoffVariant;
    }, [rootPullPayoffVariant]);

    const hideAttemptSavingNotice = useCallback(() => {
        if (attemptSavingNoticeTimerRef.current !== null) {
            window.clearTimeout(attemptSavingNoticeTimerRef.current);
            attemptSavingNoticeTimerRef.current = null;
        }
        setShowAttemptSavingNotice(false);
    }, []);

    const beginAttemptSavingNotice = useCallback(() => {
        hideAttemptSavingNotice();
        attemptSavingNoticeTimerRef.current = window.setTimeout(() => {
            setShowAttemptSavingNotice(true);
            attemptSavingNoticeTimerRef.current = null;
        }, ATTEMPT_SAVING_NOTICE_DELAY_MS);
    }, [hideAttemptSavingNotice]);

    useEffect(() => {
        let cancelled = false;
        setProfileResolved(false);

        void getActiveProfile()
            .then((activeProfile) => {
                if (cancelled) return;
                setProfile(activeProfile);
                if (activeProfile) setSoundEnabled(activeProfile.soundEnabled);
            })
            .catch(() => {
                if (!cancelled) setProfile(null);
            })
            .finally(() => {
                if (!cancelled) setProfileResolved(true);
            });

        return () => {
            cancelled = true;
        };
    }, [startRetryNonce]);

    useEffect(() => {
        isExploreMountedRef.current = true;
        return () => {
            isExploreMountedRef.current = false;
            if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
            if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
            if (attemptSavingNoticeTimerRef.current !== null) {
                window.clearTimeout(attemptSavingNoticeTimerRef.current);
            }
            attemptSaveInFlightRef.current = false;
            runFinishInFlightRef.current = false;
            rapidLoopTransitionRef.current?.controller.abort();
            rapidLoopTransitionRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (phase !== "run" || state.status !== "active" || !profileResolved) return;
        if (!profile) {
            setRunPersistence({ status: "error", operation: "start" });
            return;
        }
        const currentPersistence = runPersistenceRef.current;
        if (
            currentPersistence.status === "ready"
            && currentPersistence.runId === state.runId
            && state.profileId === profile.id
        ) return;
        if (runBootstrapInFlightRef.current) return;

        let cancelled = false;
        runBootstrapInFlightRef.current = true;
        setRunPersistence({ status: "starting" });
        const releasePwaUpdateHold = holdPwaUpdateForCriticalPersistence();
        void (async () => {
            const resumable = await getResumableExploreRunFromUi(profile.id);
            if (cancelled) return;

            const freshState = {
                ...createInitialExploreState({
                    seed: state.seed,
                    now: state.startedAt,
                    config: state.config,
                }),
                profileId: profile.id,
            };
            const checkpoint = resumable?.checkpoint ?? createExploreActiveCheckpoint({
                state: freshState,
                openingExperienceId: openingExperience.id,
                revision: 0,
                updatedAt: state.startedAt,
            });
            const run = resumable?.run ?? await startExploreRunFromUi({
                runId: state.runId,
                profileId: profile.id,
                seed: state.seed,
                startedAt: state.startedAt,
                activeCheckpoint: checkpoint,
            });
            if (cancelled) return;
            if (run.status !== "active") {
                throw new Error(`Explore run ${run.runId} is not active`);
            }

            const activeCheckpoint = resumable?.checkpoint ?? run.activeCheckpoint;
            if (!activeCheckpoint) {
                throw new Error(`Explore run ${run.runId} has no active checkpoint`);
            }
            const resumedGate = activeCheckpoint.state.pendingProblem;
            const resumedSegmentKey = getExploreLearningSegmentKey(
                activeCheckpoint.state.steps,
            );
            if (
                resumedGate?.problem
                && resumedGate.learningAssignment
                && resumedSegmentKey
                && !run.learningSegments?.[resumedSegmentKey]
            ) {
                // A checkpoint written by the pre-segment build already owns
                // its visible Problem. Freeze that exact slot and the rest of
                // the current segment before input is enabled.
                await createAndReserveExploreProblemPlan(
                    activeCheckpoint.state,
                    resumedGate,
                    profile,
                    { expectedCheckpointRevision: activeCheckpoint.revision },
                );
                if (cancelled) return;
            }
            checkpointRef.current = activeCheckpoint;
            checkpointStateRef.current = activeCheckpoint.state;
            acknowledgedDiscoveryIdRef.current = activeCheckpoint.acknowledgedDiscoveryId;
            lastRevealIdRef.current = activeCheckpoint.acknowledgedDiscoveryId ?? null;
            checkpointQueueRef.current = Promise.resolve();
            checkpointOperationsRef.current = 0;
            checkpointEpochRef.current += 1;
            checkpointFailedEpochRef.current = null;
            checkpointTransitionInFlightRef.current = false;
            setOpeningExperience(getExploreOpeningExperience(
                activeCheckpoint.openingExperienceId,
            ));
            setAnswer("");
            setFeedback("idle");
            setAttemptSaveStatus("idle");
            setProblemPlanStatus("idle");
            setRevealedDiscovery(null);
            setWorldReaction(null);
            dispatch({ type: "RESET", state: activeCheckpoint.state });
            setRunPersistence({
                status: "ready",
                runId: activeCheckpoint.state.runId,
                checkpointRevision: activeCheckpoint.revision,
            });
        })().catch(() => {
            if (!cancelled) setRunPersistence({ status: "error", operation: "start" });
        }).finally(() => {
            runBootstrapInFlightRef.current = false;
            releasePwaUpdateHold();
        });

        return () => {
            cancelled = true;
        };
    }, [
        phase,
        profile,
        profileResolved,
        startRetryNonce,
        state.profileId,
        state.runId,
        state.seed,
        state.startedAt,
        state.status,
        state.config,
        openingExperience.id,
    ]);

    const runPersistenceReady = runPersistence.status === "ready"
        && runPersistence.runId === state.runId
        && Boolean(profile)
        && state.profileId === profile?.id;

    const persistProjectedCheckpoint = useCallback((
        projectState: (current: ExploreRunState) => ExploreRunState,
        options: { acknowledgedDiscoveryId?: string } = {},
    ): Promise<ExploreActiveCheckpoint> => {
        if (attemptSaveInFlightRef.current) {
            return Promise.reject(new Error(
                "An answer commit is already moving the exploration checkpoint",
            ));
        }
        checkpointOperationsRef.current += 1;
        // Hold from enqueue through settlement. A deferred PWA reload must not
        // slip into the gap between two serialized checkpoint writes.
        const releasePwaUpdateHold = holdPwaUpdateForCriticalPersistence();
        const currentCheckpoint = checkpointRef.current;
        const operationEpoch = checkpointEpochRef.current;
        const operationRunId = currentCheckpoint?.state.runId;
        if (currentCheckpoint) {
            setRunPersistence({
                status: "checkpointing",
                runId: currentCheckpoint.state.runId,
                checkpointRevision: currentCheckpoint.revision,
            });
        }

        const task = checkpointQueueRef.current.then(async () => {
            if (
                checkpointEpochRef.current !== operationEpoch
                || checkpointFailedEpochRef.current === operationEpoch
            ) {
                throw new Error("Exploration checkpoint operation is no longer current");
            }
            const checkpoint = checkpointRef.current;
            const persistedState = checkpointStateRef.current;
            if (!profile || !checkpoint || !persistedState) {
                throw new Error("Active exploration checkpoint is not ready");
            }
            if (
                checkpoint.state.runId !== persistedState.runId
                || checkpoint.state.runId !== operationRunId
                || persistedState.profileId !== profile.id
            ) {
                throw new Error("Active exploration checkpoint changed ownership");
            }

            const nextState = projectState(persistedState);
            const acknowledgedDiscoveryId = options.acknowledgedDiscoveryId
                ?? acknowledgedDiscoveryIdRef.current;
            if (
                nextState === persistedState
                && acknowledgedDiscoveryId === checkpoint.acknowledgedDiscoveryId
            ) return checkpoint;

            const receipt = await saveExploreRunCheckpointFromUi({
                runId: persistedState.runId,
                profileId: profile.id,
                expectedRevision: checkpoint.revision,
                state: nextState,
                openingExperienceId: checkpoint.openingExperienceId,
                acknowledgedDiscoveryId,
                savedAt: Date.now(),
            });
            if (
                checkpointEpochRef.current !== operationEpoch
                || checkpointFailedEpochRef.current === operationEpoch
            ) {
                throw new Error("Exploration checkpoint operation was invalidated");
            }
            const savedCheckpoint = createExploreActiveCheckpoint({
                state: nextState,
                openingExperienceId: checkpoint.openingExperienceId,
                acknowledgedDiscoveryId,
                revision: receipt.checkpointRevision,
                updatedAt: receipt.savedAt,
            });
            checkpointRef.current = savedCheckpoint;
            checkpointStateRef.current = nextState;
            acknowledgedDiscoveryIdRef.current = acknowledgedDiscoveryId;
            return savedCheckpoint;
        });

        const heldTask = task.finally(releasePwaUpdateHold);
        checkpointQueueRef.current = heldTask.then(
            () => undefined,
            () => {
                if (checkpointEpochRef.current === operationEpoch) {
                    checkpointFailedEpochRef.current = operationEpoch;
                }
            },
        );
        return heldTask.then((checkpoint) => {
            checkpointOperationsRef.current = Math.max(
                0,
                checkpointOperationsRef.current - 1,
            );
            if (
                checkpointOperationsRef.current === 0
                && checkpointEpochRef.current === operationEpoch
            ) {
                setRunPersistence({
                    status: "ready",
                    runId: checkpoint.state.runId,
                    checkpointRevision: checkpoint.revision,
                });
            }
            return checkpoint;
        }).catch((error) => {
            checkpointOperationsRef.current = Math.max(
                0,
                checkpointOperationsRef.current - 1,
            );
            if (checkpointEpochRef.current === operationEpoch) {
                setRunPersistence({ status: "error", operation: "checkpoint" });
            }
            throw error;
        });
    }, [profile]);

    const applyCheckpointedActions = useCallback(async (
        actions: readonly Parameters<typeof exploreReducer>[1][],
    ): Promise<ExploreActiveCheckpoint | undefined> => {
        if (checkpointTransitionInFlightRef.current) return undefined;
        checkpointTransitionInFlightRef.current = true;
        try {
            const checkpoint = await persistProjectedCheckpoint(
                (current) => actions.reduce(exploreReducer, current),
            );
            if (
                !isExploreMountedRef.current
                || activeExploreRunIdRef.current !== checkpoint.state.runId
            ) return undefined;
            dispatch({ type: "RESET", state: checkpoint.state });
            return checkpoint;
        } finally {
            checkpointTransitionInFlightRef.current = false;
        }
    }, [persistProjectedCheckpoint]);

    useEffect(() => {
        const mediaQuery = window.matchMedia(
            "(min-width: 1024px) and (orientation: landscape)",
        );
        const handleChange = () => setIsWideLayout(mediaQuery.matches);
        handleChange();
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    const availableNodes = useMemo(() => getAvailableExploreNodes(state), [state]);
    const acknowledgedDiscoveryId = checkpointRef.current?.acknowledgedDiscoveryId;
    const nextUnacknowledgedDiscovery = useMemo(() => (
        selectNextUnacknowledgedDiscovery(
            state.temporaryFinds,
            acknowledgedDiscoveryId,
        )
    ), [acknowledgedDiscoveryId, state.temporaryFinds]);
    const unacknowledgedBlockingDiscovery = useMemo(() => (
        selectUnacknowledgedBlockingDiscovery(
            state.temporaryFinds,
            acknowledgedDiscoveryId,
        )
    ), [acknowledgedDiscoveryId, state.temporaryFinds]);
    const isBlockingDiscoveryOpen = Boolean(
        revealedDiscovery && isBlockingDiscoveryReveal(revealedDiscovery),
    );
    const isBlockingDiscoveryBarrier = Boolean(unacknowledgedBlockingDiscovery);
    const shouldAutoRoute = shouldAutoRouteExplorePath(state.steps, availableNodes.length);
    const currentNodeX = state.nodes.find((node) => node.id === state.currentNodeId)?.x ?? 0;
    const autoRouteNodeId = useMemo(() => (
        selectDeterministicRapidLoopNodeId(availableNodes, currentNodeX)
    ), [availableNodes, currentNodeX]);
    const availableNodeIds = useMemo(
        () => new Set(availableNodes.map((node) => node.id)),
        [availableNodes],
    );
    const openedNodeIds = useMemo(() => new Set(state.openedNodeIds), [state.openedNodeIds]);

    const mapNodes: ExploreMapNodeView[] = useMemo(() => state.nodes.map((node) => ({
        id: node.id,
        x: node.x,
        y: node.y,
        kind: node.kind,
        title: node.title,
        state: node.id === state.currentNodeId
            ? "current"
            : availableNodeIds.has(node.id)
                ? "available"
                : openedNodeIds.has(node.id)
                    ? "opened"
                    : "locked",
    })), [availableNodeIds, openedNodeIds, state.currentNodeId, state.nodes]);

    const mapEdges: ExploreMapEdgeView[] = useMemo(() => state.edges.map((edge) => ({
        ...edge,
        state: openedNodeIds.has(edge.from) && openedNodeIds.has(edge.to)
            ? "opened"
            : edge.from === state.currentNodeId && availableNodeIds.has(edge.to)
                ? "available"
                : "locked",
    })), [availableNodeIds, openedNodeIds, state.currentNodeId, state.edges]);

    const pendingGate = state.pendingProblem;
    const activeAttemptTarget = useMemo(() => {
        if (!profile || state.profileId !== profile.id || !pendingGate?.problem) return undefined;
        return createExploreAttemptRecordingTarget({
            profileId: profile.id,
            runId: state.runId,
            gateId: pendingGate.gateId,
            attemptNumber: pendingGate.attemptCount + 1,
        }, pendingGate.problem);
    }, [
        pendingGate?.attemptCount,
        pendingGate?.gateId,
        pendingGate?.problem,
        profile,
        state.profileId,
        state.runId,
    ]);

    useEffect(() => {
        if (
            phase !== "run"
            || state.status !== "active"
            || !runPersistenceReady
            || attemptSaveStatus !== "idle"
            || feedback !== "idle"
            || state.rescuePending
            || worldReaction
            || isBlockingDiscoveryBarrier
            || !shouldAutoRoute
        ) return;

        if (pendingGate) {
            if (pendingGate.actionType === "bridge" && !pendingGate.bridgePlan) {
                void applyCheckpointedActions([{
                    type: "CHOOSE_BRIDGE",
                    plan: RAPID_LOOP_AUTO_BRIDGE_PLAN,
                }]).catch(() => undefined);
            }
            return;
        }

        if (autoRouteNodeId) {
            void applyCheckpointedActions([{
                type: "SELECT_NODE",
                nodeId: autoRouteNodeId,
            }]).catch(() => undefined);
        }
    }, [
        applyCheckpointedActions,
        attemptSaveStatus,
        autoRouteNodeId,
        feedback,
        isBlockingDiscoveryBarrier,
        pendingGate,
        phase,
        runPersistenceReady,
        shouldAutoRoute,
        state.rescuePending,
        state.status,
        worldReaction,
    ]);

    useEffect(() => {
        if (
            !profileResolved
            || !runPersistenceReady
            || !checkpointRef.current
            || phase !== "run"
            || !pendingGate
            || pendingGate.problem
            || isBlockingDiscoveryBarrier
        ) return;
        if (pendingGate.actionType === "bridge" && !pendingGate.bridgePlan) return;

        let cancelled = false;
        setProblemPlanStatus("loading");
        void createAndReserveExploreProblemPlan(
            state,
            pendingGate,
            profile ?? undefined,
            { expectedCheckpointRevision: checkpointRef.current.revision },
        )
            .then(async (plan) => {
                if (cancelled) return;
                const checkpoint = await applyCheckpointedActions([{
                    type: "SET_PROBLEM",
                    problem: plan.problem,
                    assignment: plan.assignment,
                    encounterId: plan.encounterId,
                }]);
                if (cancelled || !checkpoint) return;
                setAnswer("");
                setProblemPlanStatus("idle");
            })
            .catch(() => {
                if (!cancelled) setProblemPlanStatus("error");
            });

        return () => {
            cancelled = true;
        };
    }, [
        applyCheckpointedActions,
        isBlockingDiscoveryBarrier,
        pendingGate,
        phase,
        problemPlanRetryNonce,
        profile,
        profileResolved,
        runPersistenceReady,
        state,
    ]);

    useEffect(() => {
        const discovery = nextUnacknowledgedDiscovery;
        if (
            !discovery
            || attemptSaveStatus !== "idle"
            || lastRevealIdRef.current === discovery.id
            || revealPersistenceInFlightRef.current === discovery.id
        ) return;
        const presentation = selectExploreDiscoveryPresentation({
            discovery,
            completedSteps: state.steps,
            hasAvailableNodes: availableNodes.length > 0,
            rescuePending: state.rescuePending,
        });
        if (presentation === "absorbed-opening" || presentation === "deferred-return") {
            revealPersistenceInFlightRef.current = discovery.id;
            void persistProjectedCheckpoint((current) => current, {
                acknowledgedDiscoveryId: discovery.id,
            }).then(() => {
                if (!isExploreMountedRef.current) return;
                lastRevealIdRef.current = discovery.id;
                setWorldReaction((current) => current?.nodeId === discovery.nodeId
                    ? null
                    : current);
            }).catch(() => undefined).finally(() => {
                if (revealPersistenceInFlightRef.current === discovery.id) {
                    revealPersistenceInFlightRef.current = null;
                }
            });
            return;
        }
        const revealDelay = worldReaction?.encounterId
            ? getExploreEncounterDefinition(worldReaction.encounterId)?.revealDelayMs
                ?? RAPID_LOOP_REVEAL_DELAY_MS
            : reduceMotion
                ? 70
                : RAPID_LOOP_REVEAL_DELAY_MS;
        revealTimerRef.current = window.setTimeout(() => {
            if (attemptSaveInFlightRef.current) {
                revealTimerRef.current = null;
                return;
            }
            const showDiscovery = () => {
                if (!isExploreMountedRef.current) return;
                lastRevealIdRef.current = discovery.id;
                setRevealedDiscovery(discovery);
                if (!isBlockingDiscoveryReveal(discovery)) {
                    setWorldReaction((current) => current?.nodeId === discovery.nodeId
                        ? null
                        : current);
                }
                playSound(presentation === "blocking" ? "level_up" : "clear");
            };

            if (presentation === "blocking") {
                showDiscovery();
                revealTimerRef.current = null;
                return;
            }

            revealPersistenceInFlightRef.current = discovery.id;
            void persistProjectedCheckpoint((current) => current, {
                acknowledgedDiscoveryId: discovery.id,
            }).then(showDiscovery).catch(() => undefined).finally(() => {
                if (revealPersistenceInFlightRef.current === discovery.id) {
                    revealPersistenceInFlightRef.current = null;
                }
                revealTimerRef.current = null;
            });
        }, revealDelay);

        return () => {
            if (revealTimerRef.current !== null) {
                window.clearTimeout(revealTimerRef.current);
                revealTimerRef.current = null;
            }
        };
    }, [
        availableNodes.length,
        attemptSaveStatus,
        reduceMotion,
        persistProjectedCheckpoint,
        state.rescuePending,
        state.steps,
        nextUnacknowledgedDiscovery,
        unacknowledgedBlockingDiscovery,
        worldReaction?.encounterId,
    ]);

    const selectNode = (nodeId: string) => {
        if (
            !runPersistenceReady
            || attemptSaveStatus !== "idle"
            || state.pendingProblem
            || state.rescuePending
            || isBlockingDiscoveryBarrier
            || worldReaction
            || feedback !== "idle"
        ) return;

        playSound("tap");
        void applyCheckpointedActions([{
            type: "SELECT_NODE",
            nodeId,
        }]).catch(() => undefined);
    };

    const submitAnswer = useCallback(async () => {
        const gate = state.pendingProblem;
        const problem = gate?.problem;
        const assignment = gate?.learningAssignment;
        if (
            !profile
            || !runPersistenceReady
            || !checkpointRef.current
            || checkpointOperationsRef.current !== 0
            || checkpointFailedEpochRef.current === checkpointEpochRef.current
            || !problem
            || !assignment
            || answer.length === 0
            || feedback !== "idle"
            || (attemptSaveStatus !== "idle" && attemptSaveStatus !== "error")
            || attemptSaveInFlightRef.current
        ) return;

        const submittedAt = performance.now();

        const existingFrozen = frozenAttemptRef.current;
        const frozen = attemptSaveStatus === "error" && existingFrozen
            ? existingFrozen
            : (() => {
                const expectedResult = isExploreAnswerCorrect(problem, answer)
                    ? "correct" as const
                    : "incorrect" as const;
                const target = createExploreAttemptRecordingTarget({
                    profileId: profile.id,
                    runId: state.runId,
                    gateId: gate.gateId,
                    attemptNumber: gate.attemptCount + 1,
                }, problem);
                return {
                    input: {
                        identity: target.identity,
                        problem: { id: problem.id, categoryId: target.skillId },
                        result: expectedResult,
                        committedAt: Date.now(),
                        expectedCheckpointRevision: checkpointRef.current?.revision,
                    },
                    problem,
                    assignment,
                    answer,
                    expectedResult,
                };
            })();

        if (
            frozen.input.identity.runId !== state.runId
            || frozen.input.identity.profileId !== profile.id
            || frozen.input.identity.gateId !== gate.gateId
            || frozen.input.identity.attemptNumber !== gate.attemptCount + 1
            || frozen.problem.id !== problem.id
            || frozen.problem.categoryId !== problem.categoryId
            || frozen.assignment.assignmentKey !== assignment.assignmentKey
            || frozen.answer !== answer
            || frozen.input.expectedCheckpointRevision !== checkpointRef.current.revision
        ) return;

        frozenAttemptRef.current = frozen;
        attemptSaveInFlightRef.current = true;
        const releasePwaUpdateHold = holdPwaUpdateForCriticalPersistence();
        setAttemptSaveStatus("saving");
        beginAttemptSavingNotice();
        if (frozen.expectedResult === "incorrect") {
            setFeedback("incorrect");
            playSound("incorrect");
        }

        try {
            const receipt = await commitExploreAttemptFromUi(frozen.input);
            if (
                !isExploreMountedRef.current
                || activeExploreRunIdRef.current !== frozen.input.identity.runId
            ) return;
            if (!receiptMatchesFrozenAttempt(receipt, frozen)) {
                throw new Error("Exploration commit receipt did not match its submission");
            }
            const expectedCheckpointRevision = frozen.input.expectedCheckpointRevision;
            if (
                expectedCheckpointRevision !== undefined
                && receipt.checkpointRevision !== expectedCheckpointRevision + 1
            ) {
                // The answer exists, but another client already moved the run
                // past this local boundary. Never project it onto stale state;
                // offer the durable checkpoint recovery path instead.
                setRunPersistence({ status: "error", operation: "checkpoint" });
                throw new Error("Exploration checkpoint advanced in another client");
            }
            const committedAction = {
                type: "APPLY_COMMITTED_ATTEMPT" as const,
                receipt,
                expectedResult: frozen.expectedResult,
            };
            const previousCheckpoint = checkpointRef.current;
            const previousCheckpointState = checkpointStateRef.current;
            if (
                !previousCheckpoint
                || !previousCheckpointState
                || receipt.checkpointRevision !== previousCheckpoint.revision + 1
            ) {
                throw new Error("Exploration checkpoint receipt is stale");
            }
            const committedState = exploreReducer(previousCheckpointState, committedAction);
            if (committedState === previousCheckpointState) {
                throw new Error("Exploration checkpoint did not accept its committed receipt");
            }
            const committedCheckpoint = createExploreActiveCheckpoint({
                state: committedState,
                openingExperienceId: previousCheckpoint.openingExperienceId,
                acknowledgedDiscoveryId: previousCheckpoint.acknowledgedDiscoveryId,
                revision: receipt.checkpointRevision,
                updatedAt: Math.max(previousCheckpoint.updatedAt, receipt.committedAt),
            });
            checkpointRef.current = committedCheckpoint;
            checkpointStateRef.current = committedState;
            setRunPersistence({
                status: "ready",
                runId: committedState.runId,
                checkpointRevision: committedCheckpoint.revision,
            });
            frozenAttemptRef.current = null;
            hideAttemptSavingNotice();
            setAttemptSaveStatus("idle");

            rapidLoopTransitionRef.current?.controller.abort();
            const transition: RapidLoopTransition = {
                attemptKey: receipt.attemptKey,
                controller: new AbortController(),
            };
            rapidLoopTransitionRef.current = transition;
            const isCurrentTransition = () => (
                rapidLoopTransitionRef.current === transition
                && !transition.controller.signal.aborted
            );

            if (frozen.expectedResult === "correct") {
                const isOpeningStep = isExploreOpeningStep(state.steps);
                const completesOpening = willCompleteExploreOpeningStep(state.steps);
                const correctProjectionCandidate = !(isOpeningStep && completesOpening)
                    ? projectRapidLoopAfterCorrectCommit(previousCheckpointState, committedAction)
                    : undefined;
                const projectedFinds = correctProjectionCandidate?.committedState.temporaryFinds;
                const projectedDiscovery = projectedFinds?.[projectedFinds.length - 1];
                const correctProjection = projectedDiscovery
                    && isBlockingDiscoveryReveal(projectedDiscovery)
                    ? undefined
                    : correctProjectionCandidate;
                const prefetchedCorrectPlan = correctProjection
                    ? createAndReserveExploreProblemPlan(
                        correctProjection.routedState,
                        correctProjection.nextGate,
                        profile,
                        {
                            signal: transition.controller.signal,
                            expectedCheckpointRevision: committedCheckpoint.revision,
                        },
                    )
                    : undefined;
                const prefetchedCorrectResult = settleRapidLoopPrefetchWithin(
                    prefetchedCorrectPlan,
                    getRemainingRapidLoopBudgetMs(
                        RAPID_LOOP_CORRECT_OPERABLE_TARGET_MS,
                        performance.now() - submittedAt,
                    ),
                );
                setWorldReaction({
                    fromNodeId: state.currentNodeId,
                    nodeId: gate.nodeId,
                    actionType: gate.actionType,
                    bridgePlan: gate.bridgePlan,
                    encounterId: gate.encounterId,
                    attemptKey: receipt.attemptKey,
                    gateId: receipt.identity.gateId,
                    attemptNumber: receipt.identity.attemptNumber,
                    recordedSkillId: receipt.recordedSkillId,
                    result: "correct",
                });
                setFeedback("correct");
                playSound("correct");
                const correctHoldMs = isOpeningStep
                    ? completesOpening
                        ? openingExperience.timing.payoffHoldMs
                        : reduceMotion
                            ? openingExperience.timing.reducedMotionCorrectHoldMs
                            : openingExperience.timing.correctHoldMs
                    : gate.encounterId
                    ? getExploreEncounterDefinition(gate.encounterId)?.correctHoldMs
                        ?? RAPID_LOOP_CORRECT_HOLD_MS
                    : reduceMotion
                        ? 90
                        : RAPID_LOOP_CORRECT_HOLD_MS;
                const correctFeedbackDelayMs = Math.min(
                    correctHoldMs,
                    getRemainingRapidLoopBudgetMs(
                        RAPID_LOOP_CORRECT_OPERABLE_TARGET_MS,
                        performance.now() - submittedAt,
                    ),
                );
                feedbackTimerRef.current = window.setTimeout(() => {
                    const finishCorrectFeedback = async () => {
                        const prefetched = await prefetchedCorrectResult;
                        if (!isCurrentTransition()) return;
                        if (prefetched.status === "timeout") {
                            transition.controller.abort();
                        }
                        if (rapidLoopTransitionRef.current !== transition) return;

                        let advancedWithCheckpoint = false;
                        if (
                            prefetched.status === "ready"
                            && correctProjection
                        ) {
                            try {
                                const checkpoint = await applyCheckpointedActions([
                                    ...correctProjection.routeActions,
                                    {
                                        type: "SET_PROBLEM",
                                        problem: prefetched.value.problem,
                                        assignment: prefetched.value.assignment,
                                        encounterId: prefetched.value.encounterId,
                                    },
                                ]);
                                advancedWithCheckpoint = Boolean(checkpoint);
                            } catch {
                                // The committed answer remains durable. Recovery
                                // resumes from that boundary without applying a
                                // speculative route or problem.
                            }
                        }
                        if (!advancedWithCheckpoint) dispatch(committedAction);
                        if (isOpeningStep && !completesOpening) {
                            setWorldReaction(null);
                        }
                        setAnswer("");
                        setFeedback("idle");
                        feedbackTimerRef.current = null;
                        rapidLoopTransitionRef.current = null;
                    };
                    void finishCorrectFeedback();
                }, correctFeedbackDelayMs);
                return;
            }

            const refreshState = committedState.pendingProblem?.problemRefreshPending
                && !committedState.rescuePending
                ? exploreReducer(committedState, { type: "ADVANCE_AFTER_INCORRECT" })
                : undefined;
            const refreshGate = refreshState?.pendingProblem;
            const prefetchedRetryPlan = refreshGate
                ? createAndReserveExploreProblemPlan(
                    refreshState,
                    refreshGate,
                    profile,
                    {
                        signal: transition.controller.signal,
                        expectedCheckpointRevision: committedCheckpoint.revision,
                    },
                )
                : undefined;
            dispatch(committedAction);
            const retryDelayMs = getRapidLoopIncorrectRetryDelayMs(
                performance.now() - submittedAt,
            );
            feedbackTimerRef.current = window.setTimeout(() => {
                const finishIncorrectFeedback = async () => {
                    const prefetched = await settleRapidLoopPrefetchWithin(
                        prefetchedRetryPlan,
                        getRemainingRapidLoopBudgetMs(
                            RAPID_LOOP_INCORRECT_HARD_LIMIT_MS,
                            performance.now() - submittedAt,
                        ),
                    );
                    if (!isCurrentTransition()) return;
                    if (prefetched.status === "timeout") {
                        transition.controller.abort();
                    }
                    if (rapidLoopTransitionRef.current !== transition) return;
                    if (prefetched.status === "ready") {
                        try {
                            await applyCheckpointedActions([
                                { type: "ADVANCE_AFTER_INCORRECT" },
                                {
                                    type: "SET_PROBLEM",
                                    problem: prefetched.value.problem,
                                    assignment: prefetched.value.assignment,
                                    encounterId: prefetched.value.encounterId,
                                },
                            ]);
                        } catch {
                            // Keep the already committed incorrect boundary.
                            // The recovery action reloads that exact checkpoint.
                        }
                    }
                    setAnswer("");
                    setFeedback("idle");
                    feedbackTimerRef.current = null;
                    rapidLoopTransitionRef.current = null;
                };
                void finishIncorrectFeedback();
            }, retryDelayMs);
        } catch (error) {
            if (
                !isExploreMountedRef.current
                || activeExploreRunIdRef.current !== frozen.input.identity.runId
            ) return;
            hideAttemptSavingNotice();
            if (frozen.expectedResult === "incorrect") setFeedback("idle");
            setAttemptSaveStatus("error");
            if (error instanceof ExplorePersistenceConflictError) {
                // A stale tab cannot safely rebase a frozen answer by itself.
                // The checkpoint recovery action reloads the one durable run
                // before accepting more input.
                setRunPersistence({ status: "error", operation: "checkpoint" });
            }
        } finally {
            releasePwaUpdateHold();
            attemptSaveInFlightRef.current = false;
        }
    }, [
        applyCheckpointedActions,
        answer,
        attemptSaveStatus,
        beginAttemptSavingNotice,
        feedback,
        hideAttemptSavingNotice,
        openingExperience,
        profile,
        reduceMotion,
        runPersistenceReady,
        state,
    ]);

    useEffect(() => {
        if (phase !== "run" || state.status !== "active") return;
        if (
            !runPersistenceReady
            || attemptSaveStatus !== "idle"
            || !state.pendingProblem?.problem
            || isBlockingDiscoveryBarrier
            || feedback !== "idle"
        ) return;
        const activeProblem = state.pendingProblem.problem;

        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target;
            const targetElement = target instanceof Element ? target : null;
            if (
                targetElement?.closest("input, textarea, select, [contenteditable='true']")
            ) return;
            if (
                (event.key === "Enter" || event.key === " ")
                && targetElement?.closest("button, a, [role='button']")
            ) return;

            if (/^[0-9]$/.test(event.key)) {
                event.preventDefault();
                setAnswer((current) => appendExploreAnswerInput(current, event.key, activeProblem));
                return;
            }
            if (event.key === ".") {
                event.preventDefault();
                setAnswer((current) => appendExploreAnswerInput(current, event.key, activeProblem));
                return;
            }
            if (event.key === "Backspace") {
                event.preventDefault();
                setAnswer(deleteExploreAnswerInput);
                return;
            }
            if (event.key === "Delete") {
                event.preventDefault();
                setAnswer("");
                return;
            }
            if (event.key === "Enter") {
                event.preventDefault();
                submitAnswer();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [
        attemptSaveStatus,
        feedback,
        isBlockingDiscoveryBarrier,
        phase,
        runPersistenceReady,
        state.pendingProblem?.problem,
        state.status,
        submitAnswer,
    ]);

    const finishActiveRun = useCallback(async (intent: ExploreRunFinishIntent) => {
        const frozenRetry = frozenRunFinishRef.current;
        const canRetryFrozenFinish = runPersistence.status === "error"
            && runPersistence.operation === intent
            && frozenRetry?.intent === intent
            && frozenRetry.input.runId === state.runId
            && frozenRetry.input.expectedCheckpointRevision === checkpointRef.current?.revision;
        if (
            !profile
            || (!runPersistenceReady && !canRetryFrozenFinish)
            || !state.profileId
            || state.profileId !== profile.id
            || state.status !== "active"
            || !checkpointRef.current
            || checkpointOperationsRef.current !== 0
            || checkpointFailedEpochRef.current === checkpointEpochRef.current
            || attemptSaveInFlightRef.current
            || runFinishInFlightRef.current
            || (intent !== "exit" && isBlockingDiscoveryBarrier)
            || (intent === "returned" && Boolean(state.pendingProblem || state.rescuePending))
            || (intent === "rescued" && (!state.rescuePending || state.energy !== 0))
        ) return;

        const status = intent === "exit" ? "abandoned" as const : intent;
        const existingFrozen = frozenRunFinishRef.current;
        const frozen = existingFrozen?.intent === intent
            && existingFrozen.input.runId === state.runId
            ? existingFrozen
            : {
                intent,
                input: {
                    runId: state.runId,
                    profileId: profile.id,
                    status,
                    endedAt: Date.now(),
                    energyUsed: state.maxEnergy - state.energy,
                    discoveries: [...state.temporaryFinds],
                    routeSummary: [...state.openedNodeIds],
                    expectedCheckpointRevision: checkpointRef.current.revision,
                },
            };

        frozenRunFinishRef.current = frozen;
        runFinishInFlightRef.current = true;
        const releasePwaUpdateHold = holdPwaUpdateForCriticalPersistence();
        setRunPersistence({ status: "finishing", intent });

        try {
            const receipt = await finishExploreRunFromUi(frozen.input);
            if (
                !isExploreMountedRef.current
                || activeExploreRunIdRef.current !== frozen.input.runId
            ) return;
            if (
                receipt.runId !== frozen.input.runId
                || receipt.profileId !== frozen.input.profileId
                || receipt.status !== frozen.input.status
            ) throw new Error("Exploration finish receipt did not match its request");
            if (
                frozen.input.expectedCheckpointRevision !== undefined
                && receipt.checkpointRevision !== frozen.input.expectedCheckpointRevision
            ) {
                throw new ExplorePersistenceConflictError(
                    "Exploration finish checkpoint receipt is stale",
                );
            }

            frozenRunFinishRef.current = null;
            setRunPersistence({
                status: "ready",
                runId: receipt.runId,
                checkpointRevision: receipt.checkpointRevision
                    ?? frozen.input.expectedCheckpointRevision
                    ?? 0,
            });
            if (intent === "exit") {
                navigate("/battle", { replace: true });
                return;
            }
            dispatch({ type: "APPLY_FINISHED_RUN", receipt });
            if (intent === "returned") playSound("clear");
        } catch (error) {
            if (
                !isExploreMountedRef.current
                || activeExploreRunIdRef.current !== frozen.input.runId
            ) return;
            setRunPersistence({
                status: "error",
                operation: error instanceof ExplorePersistenceConflictError
                    ? "checkpoint"
                    : intent,
            });
        } finally {
            releasePwaUpdateHold();
            runFinishInFlightRef.current = false;
        }
    }, [
        navigate,
        profile,
        isBlockingDiscoveryBarrier,
        runPersistence,
        runPersistenceReady,
        state.energy,
        state.maxEnergy,
        state.openedNodeIds,
        state.pendingProblem,
        state.profileId,
        state.rescuePending,
        state.runId,
        state.status,
        state.temporaryFinds,
    ]);

    const exitExplore = useCallback(() => {
        if (phase === "intro" || state.status !== "active" || !state.profileId) {
            navigate("/battle", { replace: true });
            return;
        }
        void finishActiveRun("exit");
    }, [finishActiveRun, navigate, phase, state.profileId, state.status]);

    const restart = () => {
        // Keep the completed summary visible. A deferred update may take over
        // only after the child explicitly chooses to start the next run.
        if (reachPwaUpdateCheckpoint(
            `explore-replay:${state.runId}:${state.status}`,
            { protectNextSession: true },
        )) return;
        if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
        if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
        rapidLoopTransitionRef.current?.controller.abort();
        rapidLoopTransitionRef.current = null;
        hideAttemptSavingNotice();
        frozenAttemptRef.current = null;
        frozenRunFinishRef.current = null;
        checkpointRef.current = null;
        checkpointStateRef.current = null;
        checkpointQueueRef.current = Promise.resolve();
        checkpointOperationsRef.current = 0;
        checkpointEpochRef.current += 1;
        checkpointFailedEpochRef.current = null;
        checkpointTransitionInFlightRef.current = false;
        revealPersistenceInFlightRef.current = null;
        acknowledgedDiscoveryIdRef.current = undefined;
        runBootstrapInFlightRef.current = false;
        dispatch({ type: "RESET", state: createFreshRun() });
        setOpeningExperience(resolveOpeningExperienceForUiSession());
        setAnswer("");
        setFeedback("idle");
        setAttemptSaveStatus("idle");
        setProblemPlanStatus("idle");
        setRunPersistence({ status: "idle" });
        setRevealedDiscovery(null);
        setWorldReaction(null);
        lastRevealIdRef.current = null;
        setPhase("run");
        playSound("start");
    };

    const returnToBase = () => {
        if (
            !runPersistenceReady
            || state.pendingProblem
            || state.rescuePending
            || isBlockingDiscoveryBarrier
        ) return;
        if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
        if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
        setFeedback("idle");
        setRevealedDiscovery(null);
        setWorldReaction(null);
        void finishActiveRun("returned");
    };

    const leaveExploreFromHud = () => {
        if (state.pendingProblem || state.steps === 0) {
            exitExplore();
            return;
        }
        returnToBase();
    };

    const activeRevealId = revealedDiscovery?.id;
    const finishDiscoveryReveal = useCallback(() => {
        if (!activeRevealId) return;
        if (isBlockingDiscoveryOpen) {
            if (revealPersistenceInFlightRef.current === activeRevealId) return;
            revealPersistenceInFlightRef.current = activeRevealId;
            void persistProjectedCheckpoint((current) => current, {
                acknowledgedDiscoveryId: activeRevealId,
            }).then(() => {
                if (!isExploreMountedRef.current) return;
                lastRevealIdRef.current = activeRevealId;
                setRevealedDiscovery((current) => (
                    current?.id === activeRevealId ? null : current
                ));
                setWorldReaction(null);
            }).catch(() => undefined).finally(() => {
                if (revealPersistenceInFlightRef.current === activeRevealId) {
                    revealPersistenceInFlightRef.current = null;
                }
            });
            return;
        }
        setRevealedDiscovery((current) => current?.id === activeRevealId ? null : current);
    }, [activeRevealId, isBlockingDiscoveryOpen, persistProjectedCheckpoint]);

    useEffect(() => {
        if (
            phase !== "run"
            || !state.rescuePending
            || state.status !== "active"
            || !runPersistenceReady
            || feedback !== "idle"
            || isBlockingDiscoveryBarrier
            || worldReaction
        ) return;
        void finishActiveRun("rescued");
    }, [
        feedback,
        finishActiveRun,
        isBlockingDiscoveryBarrier,
        phase,
        runPersistenceReady,
        state.rescuePending,
        state.status,
        worldReaction,
    ]);

    const retryRunPersistence = () => {
        if (runPersistence.status !== "error") return;
        if (
            runPersistence.operation === "start"
            || runPersistence.operation === "checkpoint"
        ) {
            if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
            if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
            rapidLoopTransitionRef.current?.controller.abort();
            rapidLoopTransitionRef.current = null;
            checkpointRef.current = null;
            checkpointStateRef.current = null;
            checkpointQueueRef.current = Promise.resolve();
            checkpointOperationsRef.current = 0;
            checkpointEpochRef.current += 1;
            checkpointFailedEpochRef.current = null;
            checkpointTransitionInFlightRef.current = false;
            revealPersistenceInFlightRef.current = null;
            acknowledgedDiscoveryIdRef.current = undefined;
            lastRevealIdRef.current = null;
            runBootstrapInFlightRef.current = false;
            frozenAttemptRef.current = null;
            setAnswer("");
            setFeedback("idle");
            setAttemptSaveStatus("idle");
            setProblemPlanStatus("idle");
            setRevealedDiscovery(null);
            setWorldReaction(null);
            dispatch({ type: "RESET", state: createFreshRun() });
            setRunPersistence({ status: "idle" });
            setProfileResolved(false);
            setStartRetryNonce((current) => current + 1);
            return;
        }
        void finishActiveRun(runPersistence.operation);
    };

    const actionNodeId = pendingGate?.nodeId ?? worldReaction?.nodeId;
    const actionNode = actionNodeId
        ? state.nodes.find((node) => node.id === actionNodeId)
        : undefined;
    const isActionPhase = Boolean(actionNodeId);
    const mapReaction = worldReaction
        ? "opening"
        : pendingGate && pendingGate.attemptCount > 0
            ? "hint"
            : "ready";
    const targetKind: ExploreGlyphKind = pendingGate?.bridgePlan ?? actionNode?.kind ?? "soil";
    const activeResearchDefinition = useMemo(() => {
        const pageId = [...state.temporaryFinds]
            .reverse()
            .find((find) => find.discoveryPageId)
            ?.discoveryPageId;
        return pageId
            ? getDiscoveryPageDefinition(pageId) ?? FIREFLY_FLOWER_DISCOVERY_PAGE
            : FIREFLY_FLOWER_DISCOVERY_PAGE;
    }, [state.temporaryFinds]);
    const activeResearchFeatureIds = useMemo(() => state.temporaryFinds.flatMap((find) => (
        find.discoveryPageId === activeResearchDefinition.id && find.discoveryFeatureId
            ? [find.discoveryFeatureId]
            : []
    )), [activeResearchDefinition.id, state.temporaryFinds]);
    const activeResearchProgress = useMemo(() => (
        getDiscoveryPageProgress(activeResearchDefinition, activeResearchFeatureIds)
    ), [activeResearchDefinition, activeResearchFeatureIds]);
    const revealedObservation = useMemo(() => selectExploreObservation({
        state,
        reaction: worldReaction,
        revealedDiscoveryId: revealedDiscovery?.id,
        getDefinition: getExploreObservationDefinition,
    }), [revealedDiscovery?.id, state, worldReaction]);
    const researchReveal = useMemo(() => {
        if (!revealedDiscovery?.discoveryPageId || !revealedDiscovery.discoveryFeatureId) return undefined;
        const definition = getDiscoveryPageDefinition(revealedDiscovery.discoveryPageId);
        if (!definition) return undefined;
        const pageId = definition.id;
        const currentFeatureId = revealedDiscovery.discoveryFeatureId;
        const discoveredFeatureIds = state.temporaryFinds.flatMap((find) => (
            find.discoveryPageId === pageId && find.discoveryFeatureId
                ? [find.discoveryFeatureId]
                : []
        ));

        return {
            definition,
            currentFeatureId,
            discoveredFeatureIds,
            observation: revealedObservation,
        };
    }, [revealedDiscovery, revealedObservation, state.temporaryFinds]);
    const confirmedResearchPage = useMemo(
        () => selectConfirmedResearchPage(state.confirmedFinds),
        [state.confirmedFinds],
    );
    const activeEncounterId = worldReaction?.encounterId
        ?? pendingGate?.encounterId;
    const encounterPhase = selectExploreEncounterPhase({
        encounterId: activeEncounterId,
        hasProblem: Boolean(pendingGate?.problem),
        feedback,
        hasWorldReaction: Boolean(worldReaction),
    });
    const encounterProblemPhase = encounterPhase === "ready"
        || encounterPhase === "incorrect"
        || encounterPhase === "correct"
        ? encounterPhase
        : undefined;
    const isOpeningProblem = Boolean(
        pendingGate?.problem
        && isExploreOpeningStep(state.steps)
    );
    const isOpeningResolution = Boolean(
        worldReaction
        && !pendingGate
        && state.lastEvent.type === "discovery"
        && isExploreOpeningCompletion(state.steps)
    );
    const openingProblemPresentation = selectOpeningProblemPresentation(
        openingExperience.presentationKey,
    );
    const usesClassicOpeningPresentation = openingProblemPresentation === "makimodon";
    const isImmersiveEncounter = Boolean(activeEncounterId);
    const isRapidProblemView = Boolean(
        isImmersiveEncounter || pendingGate?.problem || isOpeningResolution,
    );
    const actionPanelMode = isImmersiveEncounter || isOpeningResolution
        ? "encounter"
        : runPersistenceReady
        && pendingGate?.actionType === "bridge"
        && !pendingGate.bridgePlan
        && !shouldAutoRoute
        ? "bridge-choice"
        : runPersistenceReady && !pendingGate && !worldReaction && !shouldAutoRoute
            ? "path-choice"
            : "action";

    return (
        <div
            className="explore-world relative h-full overflow-hidden"
            data-run-id={state.runId}
            data-run-status={state.status}
            data-run-steps={state.steps}
            data-confirmed-find-count={state.confirmedFinds.length}
            data-opening-experience={openingExperience.id}
            data-opening-presentation={openingExperience.presentationKey}
            data-benchmark-id={benchmark.fixtureId}
            data-run-attempt-count={state.attempts.length}
            data-run-committed-attempt-count={state.committedAttemptKeys.length}
            data-checkpoint-revision={checkpointRef.current?.revision}
            data-acknowledged-discovery-id={checkpointRef.current?.acknowledgedDiscoveryId}
            data-run-persistence={runPersistence.status}
            data-suppress-nonblocking-discovery={pendingGate?.problem ? true : undefined}
        >
            <ExploreWorldBackdrop />

            <div className="relative z-10 h-full">
            {state.status !== "active" ? (
                <ReturnSummary
                    status={state.status}
                    finds={state.confirmedFinds}
                    steps={state.steps}
                    energy={state.energy}
                    replayTeaser={getExploreReplayTeaser(state)}
                    researchPage={confirmedResearchPage}
                    onRestart={restart}
                    onExit={exitExplore}
                />
            ) : (
                <div className="relative flex h-full min-h-0 flex-col">
                    <div
                        className="relative flex min-h-0 flex-1 flex-col"
                        aria-hidden={isBlockingDiscoveryBarrier || undefined}
                        inert={isBlockingDiscoveryBarrier || undefined}
                    >
                        <ExploreHud
                            energy={state.energy}
                            maxEnergy={state.maxEnergy}
                            researchClueCount={activeResearchProgress.discoveredClueCount}
                            researchClueTarget={activeResearchProgress.clueTarget}
                            researchComplete={activeResearchProgress.isComplete}
                            showResearch={state.steps >= 3}
                            steps={state.steps}
                            variant={isRapidProblemView && !isWideLayout ? "encounter" : "default"}
                            disabled={Boolean(
                                isBlockingDiscoveryBarrier
                                || worldReaction
                                || !runPersistenceReady
                                || attemptSaveStatus !== "idle"
                                || state.rescuePending
                                || feedback !== "idle"
                            )}
                            onBack={leaveExploreFromHud}
                        />

                        <main
                            className={isRapidProblemView && !isWideLayout
                                ? "explore-run-grid grid min-h-0 flex-1 gap-0 px-0 pb-0"
                                : "explore-run-grid grid min-h-0 flex-1 gap-0 px-3 pb-[calc(var(--safe-area-bottom)+10px)] sm:px-5"}
                            data-phase={isActionPhase ? "action" : "choice"}
                            data-encounter={activeEncounterId}
                            data-rapid-problem={pendingGate?.problem ? true : undefined}
                        >
                            {!isRapidProblemView || isWideLayout ? (
                                <ExploreMap
                                    nodes={mapNodes}
                                    edges={mapEdges}
                                    mode={isActionPhase && !isWideLayout ? "compact" : "full"}
                                    focusNodeId={actionNodeId}
                                    fromNodeId={worldReaction?.fromNodeId ?? state.currentNodeId}
                                    reaction={mapReaction}
                                />
                            ) : null}

                            <div
                                className="explore-action-region relative z-10 -mt-5 min-h-0"
                                data-panel={actionPanelMode}
                                data-testid={pendingGate?.problem ? "explore-attempt" : undefined}
                                data-run-id={activeAttemptTarget?.identity.runId}
                                data-gate-id={activeAttemptTarget?.identity.gateId}
                                data-attempt-number={activeAttemptTarget?.identity.attemptNumber}
                                data-attempt-key={activeAttemptTarget
                                    ? createAttemptIdentityKey(activeAttemptTarget.identity)
                                    : undefined}
                                data-problem-id={pendingGate?.problem?.id}
                                data-benchmark-index={pendingGate?.problem
                                    && benchmark.startIndex !== undefined
                                    ? benchmark.startIndex + state.steps
                                    : undefined}
                                data-save-state={pendingGate?.problem ? attemptSaveStatus : undefined}
                            >
                                {!profileResolved ? (
                                    <ExploreLoadingState message="プロフィールを よんでいるよ" />
                                ) : runPersistence.status === "idle" || runPersistence.status === "starting" ? (
                                    <ExploreLoadingState message="たんけんノートを じゅんびしているよ" />
                                ) : runPersistence.status === "finishing" ? (
                                    <ExploreLoadingState message={runPersistence.intent === "rescued"
                                        ? "見つけたものを ノートに かいているよ"
                                        : runPersistence.intent === "returned"
                                            ? "基地へ もどる じゅんびをしているよ"
                                            : "たんけんを しまっているよ"}
                                    />
                                ) : runPersistence.status === "error" ? (
                                    <ExplorePersistenceRecovery
                                        title={runPersistence.operation === "start"
                                            ? "たんけんノートを じゅんびできなかったよ"
                                            : runPersistence.operation === "checkpoint"
                                                ? "たんけんの しおりを はさめなかったよ"
                                                : "ノートに まだ かけなかったよ"}
                                        detail={runPersistence.operation === "start"
                                            ? "ここで まっているよ。もういちど じゅんびしよう。"
                                            : "いまの たんけんは そのままです。"}
                                        buttonLabel={runPersistence.operation === "start"
                                            ? "もういちど じゅんびする"
                                            : runPersistence.operation === "checkpoint"
                                                ? "保存したところへ もどる"
                                                : undefined}
                                        secondaryLabel={runPersistence.operation === "start"
                                            ? "あそびメニューへ もどる"
                                            : undefined}
                                        onSecondary={runPersistence.operation === "start"
                                            ? exitExplore
                                            : undefined}
                                        onRetry={retryRunPersistence}
                                    />
                                ) : worldReaction && !pendingGate && actionNode ? (
                                    isOpeningResolution && usesClassicOpeningPresentation ? (
                                        <MakimodonPayoffHold reducedMotion={Boolean(reduceMotion)} />
                                    ) : worldReaction.encounterId && encounterPhase === "resolved" ? (
                                        <ExploreEncounterStage
                                            encounterId={worldReaction.encounterId}
                                            phase={encounterPhase}
                                            combo={state.combo}
                                        />
                                    ) : (
                                        <ExploreActionResult
                                            nodeTitle="ほたる花の 道"
                                            nodeKind={actionNode.kind}
                                            combo={state.combo}
                                            researchPage={{
                                                definition: activeResearchDefinition,
                                                discoveredFeatureIds: activeResearchFeatureIds,
                                            }}
                                        />
                                    )
                                ) : pendingGate?.actionType === "bridge" && !pendingGate.bridgePlan ? (
                                    shouldAutoRoute ? (
                                        <ExploreLoadingState message="ひかりの橋へ すすんでいるよ" />
                                    ) : (
                                        <BridgeChoicePanel
                                            baseEnergyCost={state.config.correctEnergyCost}
                                            onChoose={(plan) => {
                                                playSound("tap");
                                                void applyCheckpointedActions([{
                                                    type: "CHOOSE_BRIDGE",
                                                    plan,
                                                }]).catch(() => undefined);
                                            }}
                                        />
                                    )
                                ) : pendingGate && !pendingGate.problem && problemPlanStatus === "error" ? (
                                    <ExplorePersistenceRecovery
                                        title="もんだいを じゅんびできなかったよ"
                                        detail="いまの たんけんは そのままです。"
                                        buttonLabel="もういちど じゅんびする"
                                        onRetry={() => {
                                            setProblemPlanStatus("idle");
                                            setProblemPlanRetryNonce((current) => current + 1);
                                        }}
                                    />
                                ) : pendingGate && !pendingGate.problem ? (
                                    <ExploreLoadingState />
                                ) : pendingGate?.problem ? (
                                    <div className="flex h-full min-h-0 flex-col gap-2">
                                        {attemptSaveStatus === "error"
                                            || (attemptSaveStatus === "saving" && showAttemptSavingNotice) ? (
                                            <div className={isRapidProblemView && !isWideLayout
                                                ? "absolute inset-x-2 top-[calc(var(--safe-area-top)+52px)] z-40"
                                                : undefined}
                                            >
                                                <ExploreAttemptPersistenceNotice
                                                    status={attemptSaveStatus}
                                                    onRetry={() => void submitAnswer()}
                                                />
                                            </div>
                                        ) : null}
                                        <div className="min-h-0 flex-1">
                                            {isOpeningProblem ? (
                                                <ExploreProblemPanel
                                                    problem={pendingGate.problem}
                                                    answer={answer}
                                                    prompt={usesClassicOpeningPresentation
                                                        ? "まきものの はしっこを みよう"
                                                        : "はっぱを いっしょに ひっぱろう"}
                                                    feedback={feedback}
                                                    attemptCount={pendingGate.attemptCount}
                                                    combo={state.combo}
                                                    targetKind={targetKind}
                                                    incorrectEnergyCost={state.config.incorrectEnergyCost}
                                                    presentation={openingProblemPresentation}
                                                    completedSteps={state.steps}
                                                    rootPullAssetSet={openingExperience.rootPullAssetSet}
                                                    rootPullPayoffVariant={rootPullPayoffVariant}
                                                    inputDisabled={
                                                        attemptSaveStatus !== "idle"
                                                        || !runPersistenceReady
                                                    }
                                                    onAnswerChange={(nextAnswer) => {
                                                        if (
                                                            attemptSaveStatus === "idle"
                                                            && runPersistenceReady
                                                        ) setAnswer(nextAnswer);
                                                    }}
                                                    onSubmit={submitAnswer}
                                                />
                                            ) : pendingGate.encounterId && encounterProblemPhase ? (
                                                <ExploreEncounterStage
                                                    encounterId={pendingGate.encounterId}
                                                    phase={encounterProblemPhase}
                                                    combo={state.combo}
                                                    problem={pendingGate.problem}
                                                    answer={answer}
                                                    attemptCount={pendingGate.attemptCount}
                                                    incorrectEnergyCost={state.config.incorrectEnergyCost}
                                                    inputDisabled={
                                                        attemptSaveStatus !== "idle"
                                                        || !runPersistenceReady
                                                    }
                                                    onAnswerChange={(nextAnswer) => {
                                                        if (
                                                            attemptSaveStatus === "idle"
                                                            && runPersistenceReady
                                                        ) setAnswer(nextAnswer);
                                                    }}
                                                    onSubmit={submitAnswer}
                                                />
                                            ) : (
                                                <ExploreProblemPanel
                                                    problem={pendingGate.problem}
                                                    answer={answer}
                                                    prompt="ほたる花の けはいを たしかめよう"
                                                    feedback={feedback}
                                                    attemptCount={pendingGate.attemptCount}
                                                    combo={state.combo}
                                                    targetKind={targetKind}
                                                    incorrectEnergyCost={state.config.incorrectEnergyCost}
                                                    completedSteps={state.steps}
                                                    inputDisabled={
                                                        attemptSaveStatus !== "idle"
                                                        || !runPersistenceReady
                                                    }
                                                    onAnswerChange={(nextAnswer) => {
                                                        if (
                                                            attemptSaveStatus === "idle"
                                                            && runPersistenceReady
                                                        ) setAnswer(nextAnswer);
                                                    }}
                                                    onSubmit={submitAnswer}
                                                />
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    state.rescuePending ? (
                                        <ExploreLoadingState message="見つけたものを ノートに かいているよ" />
                                    ) : shouldAutoRoute ? (
                                        <ExploreLoadingState message="つぎの しかけへ すすんでいるよ" />
                                    ) : (
                                        <ExplorePathChoice
                                            nodes={availableNodes}
                                            steps={state.steps}
                                            researchPage={{
                                                definition: activeResearchDefinition,
                                                discoveredFeatureIds: activeResearchFeatureIds,
                                            }}
                                            onSelect={selectNode}
                                            onReturn={returnToBase}
                                        />
                                    )
                                )}
                            </div>
                        </main>
                    </div>

                    <AnimatePresence>
                        {revealedDiscovery ? (
                            <DiscoveryReveal
                                key={revealedDiscovery.id}
                                discovery={revealedDiscovery}
                                researchPage={researchReveal}
                                suppressNonBlocking={Boolean(pendingGate?.problem)}
                                onContinue={finishDiscoveryReveal}
                            />
                        ) : null}
                    </AnimatePresence>
                </div>
            )}
            </div>
        </div>
    );
};
