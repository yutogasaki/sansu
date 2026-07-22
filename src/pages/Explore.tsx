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
    createAndReserveExploreProblemPlan,
    createAttemptIdentityKey,
    createExploreAttemptRecordingTarget,
    createInitialExploreState,
    exploreReducer,
    finishExploreRunFromUi,
    MAKIMODON_DISCOVERY_PAGE,
    getDiscoveryPageDefinition,
    getDiscoveryPageProgress,
    getExploreEncounterDefinition,
    getExploreOpeningExperience,
    getRequestedExploreEncounterId,
    getAvailableExploreNodes,
    getExploreReplayTeaser,
    getExploreRunE2EOptions,
    getRemainingRapidLoopBudgetMs,
    isExploreOpeningCompletionDiscovery,
    isExploreOpeningStep,
    isExploreAnswerCorrect,
    isDiscoveryPageComplete,
    resolveExploreOpeningExperience,
    projectRapidLoopAfterCorrectCommit,
    RAPID_LOOP_AUTO_BRIDGE_PLAN,
    settleRapidLoopPrefetchWithin,
    selectExploreEncounterPhase,
    selectDeterministicRapidLoopNodeId,
    shouldAutoRouteExplorePath,
    startExploreRunFromUi,
    willCompleteExploreOpeningStep,
    type CommitExploreAttemptInput,
    type DiscoveryInstance,
    type ExploreBridgePlan,
    type ExploreEncounterId,
    type ExploreAttemptCommitReceipt,
    type ExploreLearningAssignment,
    type FinishExploreRunInput,
    type ExploreOpeningExperienceDefinition,
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

        return [{
            definition,
            discoveredFeatureIds: finds.flatMap((find) => (
                find.discoveryPageId === pageId && find.discoveryFeatureId
                    ? [find.discoveryFeatureId]
                    : []
            )),
        } satisfies ResearchPageSummaryState];
    });

    return pageSummaries.find(({ definition, discoveredFeatureIds }) => (
        isDiscoveryPageComplete(definition, discoveredFeatureIds)
    )) ?? pageSummaries[0];
};

type ExploreRunPersistenceState =
    | { status: "idle" | "starting" | "ready" }
    | { status: "finishing"; intent: ExploreRunFinishIntent }
    | { status: "error"; operation: "start" | ExploreRunFinishIntent };

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

interface ExploreWorldReaction {
    fromNodeId: string;
    nodeId: string;
    actionType: "dig" | "bridge";
    bridgePlan?: ExploreBridgePlan;
    encounterId?: ExploreEncounterId;
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
    const [openingExperience] = useState(resolveOpeningExperienceForUiSession);
    const [state, dispatch] = useReducer(exploreReducer, undefined, createFreshRun);
    const [phase, setPhase] = useState<ExploreScreenPhase>(INITIAL_EXPLORE_PHASE);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [profileResolved, setProfileResolved] = useState(false);
    const [isWideLayout, setIsWideLayout] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
    const [answer, setAnswer] = useState("");
    const [feedback, setFeedback] = useState<ExploreProblemFeedback>("idle");
    const [attemptSaveStatus, setAttemptSaveStatus] = useState<ExploreAttemptSaveStatus>("idle");
    const [problemPlanStatus, setProblemPlanStatus] = useState<"idle" | "loading" | "error">("idle");
    const [problemPlanRetryNonce, setProblemPlanRetryNonce] = useState(0);
    const [showAttemptSavingNotice, setShowAttemptSavingNotice] = useState(false);
    const [runPersistence, setRunPersistence] = useState<ExploreRunPersistenceState>({ status: "idle" });
    const [startRetryNonce, setStartRetryNonce] = useState(0);
    const [revealedDiscovery, setRevealedDiscovery] = useState<DiscoveryInstance | null>(null);
    const [worldReaction, setWorldReaction] = useState<ExploreWorldReaction | null>(null);
    const feedbackTimerRef = useRef<number | null>(null);
    const revealTimerRef = useRef<number | null>(null);
    const attemptSavingNoticeTimerRef = useRef<number | null>(null);
    const lastRevealIdRef = useRef<string | null>(null);
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
        if (state.profileId === profile.id) {
            setRunPersistence((current) => current.status === "ready"
                ? current
                : { status: "ready" });
            return;
        }

        let cancelled = false;
        setRunPersistence({ status: "starting" });
        const releasePwaUpdateHold = holdPwaUpdateForCriticalPersistence();
        void startExploreRunFromUi({
            runId: state.runId,
            profileId: profile.id,
            seed: state.seed,
            startedAt: state.startedAt,
        }).then((run) => {
            if (cancelled) return;
            if (run.status !== "active") {
                throw new Error(`Explore run ${run.runId} is not active`);
            }
            dispatch({ type: "APPLY_STARTED_RUN", run });
            setRunPersistence({ status: "ready" });
        }).catch(() => {
            if (!cancelled) setRunPersistence({ status: "error", operation: "start" });
        }).finally(() => {
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
    ]);

    const runPersistenceReady = runPersistence.status === "ready"
        && Boolean(profile)
        && state.profileId === profile?.id;

    useEffect(() => {
        const mediaQuery = window.matchMedia("(min-width: 1024px)");
        const handleChange = () => setIsWideLayout(mediaQuery.matches);
        handleChange();
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    const availableNodes = useMemo(() => getAvailableExploreNodes(state), [state]);
    const isBlockingDiscoveryOpen = Boolean(
        revealedDiscovery && isBlockingDiscoveryReveal(revealedDiscovery),
    );
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
    const pendingNode = pendingGate
        ? state.nodes.find((node) => node.id === pendingGate.nodeId)
        : undefined;
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
            || isBlockingDiscoveryOpen
            || !shouldAutoRoute
        ) return;

        if (pendingGate) {
            if (pendingGate.actionType === "bridge" && !pendingGate.bridgePlan) {
                dispatch({ type: "CHOOSE_BRIDGE", plan: RAPID_LOOP_AUTO_BRIDGE_PLAN });
            }
            return;
        }

        if (autoRouteNodeId) {
            dispatch({ type: "SELECT_NODE", nodeId: autoRouteNodeId });
        }
    }, [
        attemptSaveStatus,
        autoRouteNodeId,
        feedback,
        isBlockingDiscoveryOpen,
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
            || phase !== "run"
            || !pendingGate
            || pendingGate.problem
        ) return;
        if (pendingGate.actionType === "bridge" && !pendingGate.bridgePlan) return;

        let cancelled = false;
        setProblemPlanStatus("loading");
        void createAndReserveExploreProblemPlan(state, pendingGate, profile ?? undefined)
            .then((plan) => {
                if (cancelled) return;
                dispatch({
                    type: "SET_PROBLEM",
                    problem: plan.problem,
                    assignment: plan.assignment,
                    encounterId: plan.encounterId,
                });
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
        pendingGate,
        phase,
        problemPlanRetryNonce,
        profile,
        profileResolved,
        runPersistenceReady,
        state,
    ]);

    useEffect(() => {
        const discovery = state.temporaryFinds[state.temporaryFinds.length - 1];
        if (!discovery || lastRevealIdRef.current === discovery.id) return;
        const isOpeningCompletion = isExploreOpeningCompletionDiscovery(
            openingExperience,
            discovery,
        );
        const isOpeningProgressDiscovery = !isOpeningCompletion
            && discovery.discoveryPageId === openingExperience.legacyProgress.pageId
            && state.steps > 0
            && state.steps < openingExperience.answerCount;
        if (isOpeningProgressDiscovery) {
            lastRevealIdRef.current = discovery.id;
            setWorldReaction((current) => current?.nodeId === discovery.nodeId
                ? null
                : current);
            return;
        }
        if (
            isOpeningCompletion
            && openingExperience.completionRevealMode === "inline"
        ) {
            lastRevealIdRef.current = discovery.id;
            setWorldReaction((current) => current?.nodeId === discovery.nodeId
                ? null
                : current);
            return;
        }
        const revealDelay = worldReaction?.encounterId
            ? getExploreEncounterDefinition(worldReaction.encounterId)?.revealDelayMs
                ?? RAPID_LOOP_REVEAL_DELAY_MS
            : isOpeningCompletion
                ? reduceMotion
                    ? openingExperience.timing.reducedMotionRevealDelayMs
                    : openingExperience.timing.revealDelayMs
                : reduceMotion
                    ? 70
                    : RAPID_LOOP_REVEAL_DELAY_MS;
        revealTimerRef.current = window.setTimeout(() => {
            lastRevealIdRef.current = discovery.id;
            setRevealedDiscovery(discovery);
            if (!isBlockingDiscoveryReveal(discovery)) {
                setWorldReaction((current) => current?.nodeId === discovery.nodeId
                    ? null
                    : current);
            }
            playSound(discovery.rarity === "rare" ? "level_up" : "clear");
            revealTimerRef.current = null;
        }, revealDelay);

        return () => {
            if (revealTimerRef.current !== null) {
                window.clearTimeout(revealTimerRef.current);
                revealTimerRef.current = null;
            }
        };
    }, [
        openingExperience,
        reduceMotion,
        state.steps,
        state.temporaryFinds,
        worldReaction?.encounterId,
    ]);

    const selectNode = (nodeId: string) => {
        if (
            !runPersistenceReady
            || attemptSaveStatus !== "idle"
            || state.pendingProblem
            || state.rescuePending
            || isBlockingDiscoveryOpen
            || worldReaction
            || feedback !== "idle"
        ) return;

        playSound("tap");
        dispatch({ type: "SELECT_NODE", nodeId });
    };

    const submitAnswer = useCallback(async () => {
        const gate = state.pendingProblem;
        const problem = gate?.problem;
        const assignment = gate?.learningAssignment;
        if (
            !profile
            || !runPersistenceReady
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
            const committedAction = {
                type: "APPLY_COMMITTED_ATTEMPT" as const,
                receipt,
                expectedResult: frozen.expectedResult,
            };
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
                const isOpeningStep = isExploreOpeningStep(openingExperience, state.steps);
                const completesOpening = willCompleteExploreOpeningStep(
                    openingExperience,
                    state.steps,
                );
                const correctProjectionCandidate = !(isOpeningStep && completesOpening)
                    ? projectRapidLoopAfterCorrectCommit(state, committedAction)
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
                        { signal: transition.controller.signal },
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

                        dispatch(committedAction);
                        if (
                            prefetched.status === "ready"
                            && correctProjection
                        ) {
                            correctProjection.routeActions.forEach(dispatch);
                            dispatch({
                                type: "SET_PROBLEM",
                                problem: prefetched.value.problem,
                                assignment: prefetched.value.assignment,
                                encounterId: prefetched.value.encounterId,
                            });
                        }
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

            const committedState = exploreReducer(state, committedAction);
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
                    { signal: transition.controller.signal },
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
                        dispatch({ type: "ADVANCE_AFTER_INCORRECT" });
                        dispatch({
                            type: "SET_PROBLEM",
                            problem: prefetched.value.problem,
                            assignment: prefetched.value.assignment,
                            encounterId: prefetched.value.encounterId,
                        });
                    }
                    setAnswer("");
                    setFeedback("idle");
                    feedbackTimerRef.current = null;
                    rapidLoopTransitionRef.current = null;
                };
                void finishIncorrectFeedback();
            }, retryDelayMs);
        } catch {
            if (
                !isExploreMountedRef.current
                || activeExploreRunIdRef.current !== frozen.input.identity.runId
            ) return;
            hideAttemptSavingNotice();
            if (frozen.expectedResult === "incorrect") setFeedback("idle");
            setAttemptSaveStatus("error");
        } finally {
            releasePwaUpdateHold();
            attemptSaveInFlightRef.current = false;
        }
    }, [
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
            || isBlockingDiscoveryOpen
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
        isBlockingDiscoveryOpen,
        phase,
        runPersistenceReady,
        state.pendingProblem?.problem,
        state.status,
        submitAnswer,
    ]);

    const finishActiveRun = useCallback(async (intent: ExploreRunFinishIntent) => {
        if (
            !profile
            || !state.profileId
            || state.profileId !== profile.id
            || state.status !== "active"
            || runFinishInFlightRef.current
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

            frozenRunFinishRef.current = null;
            setRunPersistence({ status: "ready" });
            if (intent === "exit") {
                navigate("/battle", { replace: true });
                return;
            }
            dispatch({ type: "APPLY_FINISHED_RUN", receipt });
            if (intent === "returned") playSound("clear");
        } catch {
            if (
                !isExploreMountedRef.current
                || activeExploreRunIdRef.current !== frozen.input.runId
            ) return;
            setRunPersistence({ status: "error", operation: intent });
        } finally {
            releasePwaUpdateHold();
            runFinishInFlightRef.current = false;
        }
    }, [
        navigate,
        profile,
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
        dispatch({ type: "RESET", state: createFreshRun() });
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
        if (!runPersistenceReady || state.pendingProblem || state.rescuePending) return;
        if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
        if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
        setFeedback("idle");
        setRevealedDiscovery(null);
        setWorldReaction(null);
        void finishActiveRun("returned");
    };

    const activeRevealId = revealedDiscovery?.id;
    const finishDiscoveryReveal = useCallback(() => {
        if (!activeRevealId) return;
        setRevealedDiscovery((current) => current?.id === activeRevealId ? null : current);
        if (isBlockingDiscoveryOpen) setWorldReaction(null);
    }, [activeRevealId, isBlockingDiscoveryOpen]);

    useEffect(() => {
        if (
            phase !== "run"
            || !state.rescuePending
            || state.status !== "active"
            || !runPersistenceReady
            || feedback !== "idle"
            || isBlockingDiscoveryOpen
            || worldReaction
        ) return;
        void finishActiveRun("rescued");
    }, [
        feedback,
        finishActiveRun,
        isBlockingDiscoveryOpen,
        phase,
        runPersistenceReady,
        state.rescuePending,
        state.status,
        worldReaction,
    ]);

    const retryRunPersistence = () => {
        if (runPersistence.status !== "error") return;
        if (runPersistence.operation === "start") {
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
            ? getDiscoveryPageDefinition(pageId) ?? MAKIMODON_DISCOVERY_PAGE
            : MAKIMODON_DISCOVERY_PAGE;
    }, [state.temporaryFinds]);
    const activeResearchFeatureIds = useMemo(() => state.temporaryFinds.flatMap((find) => (
        find.discoveryPageId === activeResearchDefinition.id && find.discoveryFeatureId
            ? [find.discoveryFeatureId]
            : []
    )), [activeResearchDefinition.id, state.temporaryFinds]);
    const activeResearchProgress = useMemo(() => (
        getDiscoveryPageProgress(activeResearchDefinition, activeResearchFeatureIds)
    ), [activeResearchDefinition, activeResearchFeatureIds]);
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
        };
    }, [revealedDiscovery, state.temporaryFinds]);
    const openingDiscoveryPresentation = revealedDiscovery
        && isExploreOpeningCompletionDiscovery(openingExperience, revealedDiscovery)
        ? openingExperience.presentationKey
        : undefined;
    const confirmedResearchPage = useMemo(
        () => selectConfirmedResearchPage(state.confirmedFinds),
        [state.confirmedFinds],
    );
    const requestedEncounterId = pendingGate
        ? getRequestedExploreEncounterId(state, pendingGate)
        : undefined;
    const activeEncounterId = worldReaction?.encounterId
        ?? (pendingGate?.problem ? pendingGate.encounterId : requestedEncounterId);
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
        && isExploreOpeningStep(openingExperience, state.steps)
    );
    const isOpeningResolution = Boolean(
        worldReaction
        && !pendingGate
        && state.lastEvent.type === "discovery"
        && isExploreOpeningCompletionDiscovery(openingExperience, state.lastEvent.discovery)
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
                        aria-hidden={isBlockingDiscoveryOpen || undefined}
                        inert={isBlockingDiscoveryOpen || undefined}
                    >
                        <ExploreHud
                            energy={state.energy}
                            maxEnergy={state.maxEnergy}
                            researchClueCount={activeResearchProgress.discoveredClueCount}
                            researchClueTarget={activeResearchProgress.clueTarget}
                            researchComplete={activeResearchProgress.isComplete}
                            steps={state.steps}
                            variant={isRapidProblemView && !isWideLayout ? "encounter" : "default"}
                            disabled={Boolean(
                                isBlockingDiscoveryOpen
                                || worldReaction
                                || !runPersistenceReady
                                || attemptSaveStatus !== "idle"
                                || Boolean(pendingGate)
                                || state.rescuePending
                                || feedback !== "idle"
                            )}
                            onBack={() => state.steps > 0 ? returnToBase() : exitExplore()}
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
                                            : "ノートに まだ かけなかったよ"}
                                        detail={runPersistence.operation === "start"
                                            ? "ここで まっているよ。もういちど じゅんびしよう。"
                                            : "いまの たんけんは そのままです。"}
                                        buttonLabel={runPersistence.operation === "start"
                                            ? "もういちど じゅんびする"
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
                                            nodeTitle={actionNode.title}
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
                                                dispatch({ type: "CHOOSE_BRIDGE", plan });
                                                playSound("tap");
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
                                    requestedEncounterId && encounterPhase === "loading" ? (
                                        <ExploreEncounterStage
                                            encounterId={requestedEncounterId}
                                            phase={encounterPhase}
                                            combo={state.combo}
                                        />
                                    ) : (
                                        <ExploreLoadingState />
                                    )
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
                                                    inputDisabled={attemptSaveStatus !== "idle"}
                                                    onAnswerChange={(nextAnswer) => {
                                                        if (attemptSaveStatus === "idle") setAnswer(nextAnswer);
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
                                                    inputDisabled={attemptSaveStatus !== "idle"}
                                                    onAnswerChange={(nextAnswer) => {
                                                        if (attemptSaveStatus === "idle") setAnswer(nextAnswer);
                                                    }}
                                                    onSubmit={submitAnswer}
                                                />
                                            ) : (
                                                <ExploreProblemPanel
                                                    problem={pendingGate.problem}
                                                    answer={answer}
                                                    prompt={pendingNode?.kind === "bridge"
                                                        ? "橋の しかけを うごかそう"
                                                        : `${pendingNode?.title ?? "岩"}を ひらこう`}
                                                    feedback={feedback}
                                                    attemptCount={pendingGate.attemptCount}
                                                    combo={state.combo}
                                                    targetKind={targetKind}
                                                    incorrectEnergyCost={state.config.incorrectEnergyCost}
                                                    completedSteps={state.steps}
                                                    inputDisabled={attemptSaveStatus !== "idle"}
                                                    onAnswerChange={(nextAnswer) => {
                                                        if (attemptSaveStatus === "idle") setAnswer(nextAnswer);
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
                                openingPresentation={openingDiscoveryPresentation}
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
