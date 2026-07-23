import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, RotateCcw, Sparkles } from "lucide-react";
import type { ExploreEncounterProblemPhase } from "../../domain/explore";
import type { Problem } from "../../domain/types";
import { cn } from "../../utils/cn";
import { MathProblemPrompt } from "../domain/MathProblemPrompt";
import { ExploreAnswerPad } from "./ExploreAnswerPad";
import { useExploreStageFocus } from "./useExploreStageFocus";
import type { ExploreVisualIdentity } from "../../domain/explore";

type ImmersiveEncounterScenePhase = "idle" | "complete" | "resolved";

export interface ImmersiveEncounterVisualIdentity extends ExploreVisualIdentity {
    sceneIds: Record<ImmersiveEncounterScenePhase, string>;
}

export interface ImmersiveEncounterCopyContext {
    phase: ExploreEncounterProblemPhase;
    attemptCount: number;
    incorrectEnergyCost: number;
}

export interface ImmersiveEncounterDefinition {
    scene: {
        idleSrc: string;
        completeSrc: string;
        resolvedSrc: string;
        completeActionProp?: string;
        resolvedActionProp?: string;
    };
    visualIdentity?: ImmersiveEncounterVisualIdentity;
    problem: {
        titleId: string;
        kicker: string;
        title: string;
        incompleteState: string;
        completeState: string;
        equationTestId: string;
        hintAriaLabel: string;
        hintLabel: string;
        getStatusCopy: (context: ImmersiveEncounterCopyContext) => string;
    };
    completion: {
        titleId: string;
        kicker: string;
        title: string;
        getSummary: (combo: number) => string;
    };
    loadingCopy: string;
}

export interface ImmersiveEncounterProps {
    definition: ImmersiveEncounterDefinition;
    phase: ExploreEncounterProblemPhase;
    problem: Problem;
    answer: string;
    attemptCount: number;
    combo: number;
    incorrectEnergyCost: number;
    sceneArt?: React.ReactNode;
    inputDisabled?: boolean;
    onAnswerChange: (answer: string) => void;
    onSubmit: () => void;
}

export interface ImmersiveEncounterCompletionProps {
    definition: ImmersiveEncounterDefinition;
    combo: number;
    sceneArt?: React.ReactNode;
}

export interface ImmersiveEncounterLoadingProps {
    definition: ImmersiveEncounterDefinition;
    sceneArt?: React.ReactNode;
}

interface ImmersiveEncounterSceneArtProps {
    definition: ImmersiveEncounterDefinition;
    phase: ImmersiveEncounterScenePhase;
}

/**
 * These class names intentionally retain the first encounter's CSS contract.
 * All immersive encounters share the same layout and state grammar; encounter
 * wrappers only provide art, copy, and stable accessibility/test identifiers.
 */
const ImmersiveEncounterSceneArt: React.FC<ImmersiveEncounterSceneArtProps> = ({
    definition,
    phase,
}) => {
    const visualIdentity = definition.visualIdentity;
    const hasDistinctCompleteScene = definition.scene.completeSrc !== definition.scene.idleSrc;
    const hasDistinctResolvedScene = definition.scene.resolvedSrc !== definition.scene.idleSrc
        && definition.scene.resolvedSrc !== definition.scene.completeSrc;

    return (
        <div
            className="explore-immersive-art"
            data-visual-lineage-id={visualIdentity?.lineageId}
            data-visual-candidate-id={visualIdentity?.candidateId}
            data-visual-mode={visualIdentity?.mode}
            data-visual-surface-id={visualIdentity?.surfaceId}
            data-visual-scene-id={visualIdentity?.sceneIds[phase]}
            data-camera-key={visualIdentity?.cameraKey}
            aria-hidden="true"
        >
            <img
                src={definition.scene.idleSrc}
                alt=""
                decoding="async"
                fetchPriority="high"
                className="explore-immersive-scene explore-immersive-scene-idle"
            />
            {hasDistinctCompleteScene ? (
                <img
                    src={definition.scene.completeSrc}
                    alt=""
                    decoding="async"
                    data-action-prop={phase === "complete"
                        ? definition.scene.completeActionProp
                        : undefined}
                    className={cn(
                        "explore-immersive-scene explore-immersive-scene-complete",
                        phase !== "idle" && "is-visible",
                    )}
                />
            ) : null}
            {hasDistinctResolvedScene ? (
                <img
                    src={definition.scene.resolvedSrc}
                    alt=""
                    decoding="async"
                    data-action-prop={phase === "resolved"
                        ? definition.scene.resolvedActionProp
                        : undefined}
                    className={cn(
                        "explore-immersive-scene explore-immersive-scene-crossed",
                        phase === "resolved" && "is-visible",
                    )}
                />
            ) : null}
            <div className="explore-immersive-scrim" />
        </div>
    );
};

export const ImmersiveEncounter: React.FC<ImmersiveEncounterProps> = ({
    definition,
    phase,
    problem,
    answer,
    attemptCount,
    combo,
    incorrectEnergyCost,
    sceneArt,
    inputDisabled = false,
    onAnswerChange,
    onSubmit,
}) => {
    const reduceMotion = useReducedMotion();
    const headingRef = useExploreStageFocus<HTMLHeadingElement>();
    const inputLocked = phase !== "ready" || inputDisabled;
    const showVisualSupport = phase !== "correct"
        && Boolean(problem.questionVisual);
    const equationProblem = { ...problem, questionVisual: undefined };
    const complete = phase === "correct";
    const scenePhase: ImmersiveEncounterScenePhase = complete ? "complete" : "idle";
    const visualIdentity = definition.visualIdentity;
    const statusCopy = definition.problem.getStatusCopy({
        phase,
        attemptCount,
        incorrectEnergyCost,
    });

    return (
        <motion.section
            className="explore-immersive h-full min-h-0 overflow-hidden rounded-[28px]"
            data-state={complete ? "complete" : phase === "incorrect" ? "incorrect" : "idle"}
            data-reduced-motion={reduceMotion || undefined}
            data-question-text={problem.questionText}
            data-skill-id={problem.categoryId}
            data-visual-lineage-id={visualIdentity?.lineageId}
            data-visual-candidate-id={visualIdentity?.candidateId}
            data-visual-mode={visualIdentity?.mode}
            data-visual-surface-id={visualIdentity?.surfaceId}
            data-visual-scene-id={visualIdentity?.sceneIds[scenePhase]}
            data-camera-key={visualIdentity?.cameraKey}
            aria-labelledby={definition.problem.titleId}
            animate={reduceMotion
                ? undefined
                : phase === "incorrect"
                    ? { x: [0, -4, 4, -2, 0] }
                    : undefined}
            transition={{ duration: 0.3, ease: "easeOut" }}
        >
            {sceneArt ? (
                <div
                    className="explore-immersive-art explore-immersive-art--layered"
                    data-visual-lineage-id={visualIdentity?.lineageId}
                    data-visual-candidate-id={visualIdentity?.candidateId}
                    data-visual-mode={visualIdentity?.mode}
                    data-visual-surface-id={visualIdentity?.surfaceId}
                    data-visual-scene-id={visualIdentity?.sceneIds[scenePhase]}
                    data-camera-key={visualIdentity?.cameraKey}
                >
                    {sceneArt}
                    <div className="explore-immersive-scrim" aria-hidden="true" />
                </div>
            ) : (
                <ImmersiveEncounterSceneArt
                    definition={definition}
                    phase={scenePhase}
                />
            )}

            <div className="explore-immersive-stage">
                <div className="explore-immersive-brief">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="explore-immersive-kicker">{definition.problem.kicker}</p>
                            <h2
                                id={definition.problem.titleId}
                                ref={headingRef}
                                tabIndex={-1}
                                className="explore-immersive-title focus:outline-none"
                            >
                                {definition.problem.title}
                            </h2>
                        </div>
                        <div className="explore-immersive-status-cluster">
                            <span className="explore-immersive-state">
                                {complete
                                    ? definition.problem.completeState
                                    : definition.problem.incompleteState}
                            </span>
                            {combo > 1 ? (
                                <span className="explore-immersive-combo">
                                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                                    {combo} れんさ
                                </span>
                            ) : null}
                        </div>
                    </div>

                    <div
                        className="explore-immersive-equation"
                        data-testid={definition.problem.equationTestId}
                    >
                        <MathProblemPrompt
                            problem={equationProblem}
                            className="text-[clamp(32px,9vw,52px)] font-black leading-none text-[#173f49]"
                        />
                        <output
                            aria-label={`こたえ ${answer || "未入力"}`}
                            aria-live="polite"
                            aria-atomic="true"
                            className={cn(
                                "explore-immersive-answer",
                                phase === "correct" && "is-correct",
                                phase === "incorrect" && "is-incorrect",
                            )}
                        >
                            {answer || "?"}
                        </output>
                    </div>

                    <div
                        className={cn(
                            "explore-immersive-message",
                            phase === "correct" && "is-correct",
                            phase === "incorrect" && "is-incorrect",
                        )}
                        role={phase === "incorrect" ? "alert" : "status"}
                        aria-live={phase === "incorrect" ? "assertive" : "polite"}
                        aria-atomic="true"
                    >
                        {phase === "correct" ? (
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        ) : null}
                        {phase === "incorrect" ? (
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        ) : null}
                        {phase === "ready" ? (
                            <Sparkles className="h-4 w-4" aria-hidden="true" />
                        ) : null}
                        <span>{statusCopy}</span>
                    </div>
                </div>

                {showVisualSupport ? (
                    <div
                        className="explore-immersive-hint"
                        role="status"
                        aria-label={definition.problem.hintAriaLabel}
                    >
                        <span className="explore-immersive-hint-label">
                            {definition.problem.hintLabel}
                        </span>
                        <div className="explore-immersive-hint-visual">
                            <MathProblemPrompt problem={problem} />
                        </div>
                    </div>
                ) : null}

                <div className="explore-immersive-spacer" aria-hidden="true" />

                <div
                    className={cn("explore-immersive-keypad-shell", inputLocked && "is-locked")}
                    aria-disabled={inputLocked}
                >
                    <ExploreAnswerPad
                        problem={problem}
                        answer={answer}
                        disabled={inputLocked}
                        className="explore-immersive-keypad !rounded-[20px] !border-0 !bg-transparent !p-1 !shadow-none"
                        onAnswerChange={onAnswerChange}
                        onSubmit={onSubmit}
                    />
                </div>
            </div>
        </motion.section>
    );
};

export const ImmersiveEncounterCompletion: React.FC<ImmersiveEncounterCompletionProps> = ({
    definition,
    combo,
    sceneArt,
}) => {
    const headingRef = useExploreStageFocus<HTMLHeadingElement>();
    const visualIdentity = definition.visualIdentity;

    return (
        <section
            className="explore-immersive h-full min-h-0 overflow-hidden rounded-[28px]"
            data-state="complete"
            data-visual-lineage-id={visualIdentity?.lineageId}
            data-visual-candidate-id={visualIdentity?.candidateId}
            data-visual-mode={visualIdentity?.mode}
            data-visual-surface-id={visualIdentity?.surfaceId}
            data-visual-scene-id={visualIdentity?.sceneIds.resolved}
            data-camera-key={visualIdentity?.cameraKey}
            role="status"
            aria-live="polite"
            aria-labelledby={definition.completion.titleId}
        >
            {sceneArt ? (
                <div
                    className="explore-immersive-art explore-immersive-art--layered"
                    data-visual-lineage-id={visualIdentity?.lineageId}
                    data-visual-candidate-id={visualIdentity?.candidateId}
                    data-visual-mode={visualIdentity?.mode}
                    data-visual-surface-id={visualIdentity?.surfaceId}
                    data-visual-scene-id={visualIdentity?.sceneIds.resolved}
                    data-camera-key={visualIdentity?.cameraKey}
                >
                    {sceneArt}
                    <div className="explore-immersive-scrim" aria-hidden="true" />
                </div>
            ) : (
                <ImmersiveEncounterSceneArt definition={definition} phase="resolved" />
            )}
            <div className="explore-immersive-completion-stage">
                <div className="explore-immersive-completion-card">
                    <p className="explore-immersive-kicker">{definition.completion.kicker}</p>
                    <h2
                        id={definition.completion.titleId}
                        ref={headingRef}
                        tabIndex={-1}
                        className="focus:outline-none"
                    >
                        {definition.completion.title}
                    </h2>
                    <p>{definition.completion.getSummary(combo)}</p>
                </div>
            </div>
        </section>
    );
};

export const ImmersiveEncounterLoading: React.FC<ImmersiveEncounterLoadingProps> = ({
    definition,
    sceneArt,
}) => {
    const visualIdentity = definition.visualIdentity;

    return (
        <section
            className="explore-immersive h-full min-h-0 overflow-hidden rounded-[28px]"
            data-visual-lineage-id={visualIdentity?.lineageId}
            data-visual-candidate-id={visualIdentity?.candidateId}
            data-visual-mode={visualIdentity?.mode}
            data-visual-surface-id={visualIdentity?.surfaceId}
            data-visual-scene-id={visualIdentity?.sceneIds.idle}
            data-camera-key={visualIdentity?.cameraKey}
            role="status"
            aria-live="polite"
        >
            {sceneArt ? (
                <div
                    className="explore-immersive-art explore-immersive-art--layered"
                    data-visual-lineage-id={visualIdentity?.lineageId}
                    data-visual-candidate-id={visualIdentity?.candidateId}
                    data-visual-mode={visualIdentity?.mode}
                    data-visual-surface-id={visualIdentity?.surfaceId}
                    data-visual-scene-id={visualIdentity?.sceneIds.idle}
                    data-camera-key={visualIdentity?.cameraKey}
                >
                    {sceneArt}
                    <div className="explore-immersive-scrim" aria-hidden="true" />
                </div>
            ) : (
                <ImmersiveEncounterSceneArt definition={definition} phase="idle" />
            )}
            <div className="explore-immersive-loading-card">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
                <span>{definition.loadingCopy}</span>
            </div>
        </section>
    );
};
