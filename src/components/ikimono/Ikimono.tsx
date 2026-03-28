import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { PencilLine } from "lucide-react";
import { IkimonoSvg } from "./IkimonoSvg";
import { NameModal } from "./NameModal";
import { FuwafuwaSpeechBubble } from "./FuwafuwaSpeechBubble";
import { FuwafuwaTransitionModal, type FuwafuwaTransitionModalState } from "./FuwafuwaTransitionModal";
import { calculateStage, createNewIkimonoState, ensureSpecies } from "./lifecycle";
import { getOpenHitokoto, shouldShowHitokotoOnOpen, getTapHitokoto, getEggOpenHitokoto, getEggTapHitokoto } from "./hitokoto";
import {
    getDefaultReactionStyleForStage,
    getStageSway,
    pickIdleMotionVariant,
    playIdleMotion,
    playTapReaction,
    shouldShowBonusTapHitokoto,
    shouldShowTapHitokoto,
} from "./ikimonoMotion";
import { getAuraVisualState, getReactionEmojis, type EmotionParticle, type RippleState } from "./fuwafuwaVisuals";
import { FuwafuwaSpeech, getHitokotoSpeech, type FuwafuwaReactionStyle } from "./fuwafuwaSpeech";
import { getNextTransitionState } from "./fuwafuwaMilestones";
import { stageText } from "./sceneText";
import { ikimonoStorage, ikimonoGalleryStorage, ikimonoTransitionStorage } from "../../utils/storage";
import { IkimonoState, IkimonoStage } from "./types";

interface IkimonoProps {
    profileId: string;
    kanjiMode?: boolean;
    speech?: FuwafuwaSpeech | null;
    onSpeechAdvance?: () => void;
}

const DAY_IN_MS = 1000 * 60 * 60 * 24;

const FIREFLY_POSITIONS = [
    { left: "24%", top: "30%", duration: 3.4, delay: 0.2 },
    { left: "68%", top: "22%", duration: 2.8, delay: 0.8 },
    { left: "74%", top: "58%", duration: 3.2, delay: 1.2 },
    { left: "36%", top: "70%", duration: 3.6, delay: 1.6 },
];

function pickParticleBatch(
    reactionStyle: FuwafuwaReactionStyle,
    stage: IkimonoStage,
    count: number,
    lastEmoji: string | null,
): { particles: Omit<EmotionParticle, "id">[]; lastEmoji: string | null } {
    const palette = getReactionEmojis(reactionStyle, stage);
    const particles: Omit<EmotionParticle, "id">[] = [];
    let previousEmoji = lastEmoji;

    for (let index = 0; index < count; index += 1) {
        const pool = palette.filter((emoji) => emoji !== previousEmoji);
        const nextEmoji = (pool.length > 0 ? pool : palette)[Math.floor(Math.random() * (pool.length > 0 ? pool.length : palette.length))];
        particles.push({
            x: (Math.random() - 0.5) * 92,
            y: (Math.random() - 0.5) * 70,
            emoji: nextEmoji,
        });
        previousEmoji = nextEmoji;
    }

    return {
        particles,
        lastEmoji: previousEmoji,
    };
}

export const Ikimono: React.FC<IkimonoProps> = ({
    profileId,
    kanjiMode = false,
    speech = null,
    onSpeechAdvance,
}) => {
    const [hitokoto, setHitokoto] = useState<string | null>(null);
    const [hitokotoReason, setHitokotoReason] = useState<"open" | "tap" | null>(null);
    const [showNameModal, setShowNameModal] = useState(false);
    const [currentState, setCurrentState] = useState<IkimonoState | null>(null);
    const [transitionModal, setTransitionModal] = useState<FuwafuwaTransitionModalState>(null);
    const [particles, setParticles] = useState<EmotionParticle[]>([]);
    const [ripple, setRipple] = useState<RippleState | null>(null);
    const controls = useAnimationControls();
    const orbRef = useRef<HTMLDivElement | null>(null);
    const openHitokotoShown = useRef(false);
    const hitokotoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const idleTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const particleTimers = useRef<number[]>([]);
    const particleSeedRef = useRef(0);
    const rippleIdRef = useRef(0);
    const isReacting = useRef(false);
    const lastIdleVariantRef = useRef<number | null>(null);
    const lastTapVariantRef = useRef<Record<FuwafuwaReactionStyle, number | null>>({
        cozy: null,
        growing: null,
        sharing: null,
        celebrating: null,
        guiding: null,
    });
    const lastParticleEmojiRef = useRef<string | null>(null);
    const pendingFarewellRef = useRef<Extract<FuwafuwaTransitionModalState, { kind: "farewell" }> | null>(null);
    const pendingWelcomeSpeciesRef = useRef<number | null>(null);
    const scriptMode = kanjiMode ? "kanji" : "kana";

    useEffect(() => {
        if (hitokotoTimer.current) {
            clearTimeout(hitokotoTimer.current);
            hitokotoTimer.current = null;
        }
        if (idleTimer.current) {
            clearInterval(idleTimer.current);
            idleTimer.current = null;
        }
        particleTimers.current.forEach((timerId) => window.clearTimeout(timerId));
        particleTimers.current = [];

        setCurrentState(null);
        setTransitionModal(null);
        setShowNameModal(false);
        setHitokoto(null);
        setHitokotoReason(null);
        setParticles([]);
        setRipple(null);
        openHitokotoShown.current = false;
        pendingFarewellRef.current = null;
        pendingWelcomeSpeciesRef.current = null;
        isReacting.current = false;
        lastIdleVariantRef.current = null;
        lastTapVariantRef.current = {
            cozy: null,
            growing: null,
            sharing: null,
            celebrating: null,
            guiding: null,
        };
        lastParticleEmojiRef.current = null;
    }, [profileId]);

    const getOrCreateState = useCallback((): IkimonoState => {
        const stored = ikimonoStorage.getState();
        if (stored && stored.profileId === profileId) {
            const withSpecies = ensureSpecies(stored);
            if (withSpecies !== stored) ikimonoStorage.setState(withSpecies);

            const { stage } = calculateStage(withSpecies.birthDate);
            if (stage === "gone") {
                const daysAlive = Math.max(1, Math.floor((Date.now() - new Date(withSpecies.birthDate).getTime()) / DAY_IN_MS) + 1);
                pendingFarewellRef.current = {
                    kind: "farewell",
                    species: withSpecies.species,
                    stage: "fading",
                    name: withSpecies.name,
                    daysAlive,
                };
                ikimonoGalleryStorage.add({
                    profileId: withSpecies.profileId,
                    generation: withSpecies.generation,
                    name: withSpecies.name || "なまえなし",
                    birthDate: withSpecies.birthDate,
                    departedDate: new Date().toISOString(),
                    species: withSpecies.species,
                });
                const newState = createNewIkimonoState(profileId, withSpecies.generation + 1, withSpecies.species);
                ikimonoStorage.setState(newState);
                ikimonoTransitionStorage.setState({
                    profileId,
                    generation: newState.generation,
                    lastSeenStage: "egg",
                });
                pendingWelcomeSpeciesRef.current = newState.species;
                return newState;
            }
            return withSpecies;
        }

        const newState = createNewIkimonoState(profileId);
        ikimonoStorage.setState(newState);
        return newState;
    }, [profileId]);

    const activeCurrentState = currentState?.profileId === profileId ? currentState : null;
    const state = activeCurrentState || getOrCreateState();
    const { stage, fadeOpacity } = calculateStage(state.birthDate);
    const sway = getStageSway(stage);
    const daysAlive = Math.max(1, Math.floor((Date.now() - new Date(state.birthDate).getTime()) / DAY_IN_MS) + 1);

    useEffect(() => {
        if (!transitionModal && !state.name && stage !== "egg" && stage !== "gone") {
            setShowNameModal(true);
        }
    }, [state.name, stage, transitionModal]);

    useEffect(() => {
        if (transitionModal) {
            setShowNameModal(false);
        }
    }, [transitionModal]);

    const handleNameSubmit = (name: string) => {
        const updated = { ...state, name };
        ikimonoStorage.setState(updated);
        setCurrentState(updated);
        setShowNameModal(false);
    };

    const playIdle = useCallback(() => {
        const nextVariant = pickIdleMotionVariant(lastIdleVariantRef.current);
        lastIdleVariantRef.current = nextVariant;
        return playIdleMotion(controls, sway, nextVariant);
    }, [controls, sway]);

    useEffect(() => {
        if (stage === "gone") return;
        playIdle();
        if (idleTimer.current) clearInterval(idleTimer.current);
        idleTimer.current = setInterval(() => {
            if (!isReacting.current) {
                void playIdle();
            }
        }, 4200 + Math.floor(Math.random() * 2200));

        return () => {
            if (idleTimer.current) clearInterval(idleTimer.current);
        };
    }, [stage, playIdle]);

    useEffect(() => {
        if (openHitokotoShown.current) return;
        openHitokotoShown.current = true;

        if (stage === "egg") {
            const timer = setTimeout(() => {
                showHitokoto(getEggOpenHitokoto(scriptMode), 4200, "open");
            }, 1300);
            return () => clearTimeout(timer);
        }

        if (shouldShowHitokotoOnOpen()) {
            const timer = setTimeout(() => {
                showHitokoto(getOpenHitokoto(scriptMode), 3400, "open");
            }, 1100);
            return () => clearTimeout(timer);
        }
    }, [stage, scriptMode]);

    const showHitokoto = (text: string, duration = 3000, reason: "open" | "tap" = "tap") => {
        if (hitokotoTimer.current) clearTimeout(hitokotoTimer.current);
        setHitokoto(text);
        setHitokotoReason(reason);
        hitokotoTimer.current = setTimeout(() => {
            setHitokoto(null);
            setHitokotoReason(null);
            hitokotoTimer.current = null;
        }, duration);
    };

    const clearHitokoto = useCallback(() => {
        setHitokoto(null);
        setHitokotoReason(null);
        if (hitokotoTimer.current) {
            clearTimeout(hitokotoTimer.current);
            hitokotoTimer.current = null;
        }
    }, []);

    const handleTap = async (event: React.MouseEvent<HTMLDivElement>) => {
        if (transitionModal) return;
        if (hitokoto) {
            clearHitokoto();
            return;
        }

        if (isReacting.current) return;
        isReacting.current = true;
        const reactionStyle = speech?.reactionStyle ?? getDefaultReactionStyleForStage(stage);

        if (orbRef.current) {
            const rect = orbRef.current.getBoundingClientRect();
            setRipple({
                id: rippleIdRef.current++,
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
            });
        }

        const particleCount = reactionStyle === "celebrating" ? 7 : 5;
        const particleBatch = pickParticleBatch(
            reactionStyle,
            stage,
            particleCount,
            lastParticleEmojiRef.current,
        );
        lastParticleEmojiRef.current = particleBatch.lastEmoji;
        const seededParticles = particleBatch.particles.map((particle) => ({
            ...particle,
            id: particleSeedRef.current++,
        }));
        const seededIds = new Set(seededParticles.map((particle) => particle.id));
        setParticles((previous) => [...previous, ...seededParticles]);

        const timerId = window.setTimeout(() => {
            setParticles((previous) => previous.filter((particle) => !seededIds.has(particle.id)));
            particleTimers.current = particleTimers.current.filter((id) => id !== timerId);
        }, 1400);
        particleTimers.current.push(timerId);

        try {
            const shouldShowPrimaryHitokoto = shouldShowTapHitokoto(stage);
            if (shouldShowPrimaryHitokoto) {
                showHitokoto(stage === "egg" ? getEggTapHitokoto(scriptMode) : getTapHitokoto(scriptMode), 2600, "tap");
            }

            const nextVariantIndex = await playTapReaction(
                controls,
                reactionStyle,
                lastTapVariantRef.current[reactionStyle],
            );
            lastTapVariantRef.current[reactionStyle] = nextVariantIndex;

            if (!shouldShowPrimaryHitokoto && shouldShowBonusTapHitokoto(stage)) {
                showHitokoto(stage === "egg" ? getEggTapHitokoto(scriptMode) : getTapHitokoto(scriptMode), 2200, "tap");
            }

            await playIdle();
        } finally {
            isReacting.current = false;
        }
    };

    useEffect(() => {
        if (transitionModal) return;

        const pendingFarewell = pendingFarewellRef.current;
        if (pendingFarewell) {
            pendingFarewellRef.current = null;
            setTransitionModal(pendingFarewell);
            return;
        }

        if (stage === "gone") return;

        const previous = ikimonoTransitionStorage.getState();
        const { nextState, milestone } = getNextTransitionState(previous, profileId, state.generation, stage);

        if (
            !previous ||
            previous.profileId !== nextState.profileId ||
            previous.generation !== nextState.generation ||
            previous.lastSeenStage !== nextState.lastSeenStage
        ) {
            ikimonoTransitionStorage.setState(nextState);
        }

        if (!milestone) return;

        setTransitionModal({
            kind: "milestone",
            milestone,
            species: state.species,
            stage,
            name: state.name,
            daysAlive,
        });
    }, [transitionModal, profileId, state.generation, state.name, state.species, stage, daysAlive]);

    useEffect(() => {
        const currentParticleTimers = particleTimers.current;

        return () => {
            if (hitokotoTimer.current) clearTimeout(hitokotoTimer.current);
            if (idleTimer.current) clearInterval(idleTimer.current);
            currentParticleTimers.forEach((timerId) => window.clearTimeout(timerId));
        };
    }, []);

    if (stage === "gone") return null;

    const stageLabel = kanjiMode ? stageText[stage].kanji : stageText[stage].kana;
    const auraVisual = getAuraVisualState(stage, daysAlive);
    const activeSpeech = hitokoto
        ? getHitokotoSpeech(hitokoto, stage, hitokotoReason ?? "tap")
        : speech;
    const handleSpeechBubbleTap = hitokoto ? clearHitokoto : onSpeechAdvance;

    return (
        <div className="flex h-full w-full max-w-[20rem] flex-col items-center justify-center select-none">
            {showNameModal && !transitionModal && <NameModal onSubmit={handleNameSubmit} />}
            <FuwafuwaTransitionModal
                modal={transitionModal}
                onClose={() => setTransitionModal(null)}
                onFarewellContinue={() => {
                    const nextSpecies = pendingWelcomeSpeciesRef.current;
                    if (nextSpecies == null) {
                        setTransitionModal(null);
                        return;
                    }
                    pendingWelcomeSpeciesRef.current = null;
                    setTransitionModal({
                        kind: "welcome",
                        species: nextSpecies,
                    });
                }}
            />

            <div className="relative z-20 flex min-h-[clamp(4.75rem,18vw,6.75rem)] w-full items-end justify-center px-2 sm:px-4">
                <AnimatePresence>
                    {activeSpeech && (
                        <FuwafuwaSpeechBubble
                            key={`${activeSpeech.accent}-${activeSpeech.reactionStyle}-${activeSpeech.lines.join("|")}`}
                            lines={activeSpeech.lines}
                            accent={activeSpeech.accent}
                            reactionStyle={activeSpeech.reactionStyle}
                            onTap={handleSpeechBubbleTap}
                        />
                    )}
                </AnimatePresence>
            </div>

            <div
                ref={orbRef}
                onClick={handleTap}
                className="relative mt-1 flex h-[clamp(13rem,48vw,17rem)] w-[clamp(13rem,48vw,17rem)] cursor-pointer items-center justify-center [WebkitTapHighlightColor:transparent]"
            >
                <motion.div
                    animate={{ scale: [1, 1.1, 1], opacity: [0.52, 0.92, 0.52] }}
                    transition={{ duration: auraVisual.pulseDuration, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-[0.7rem] rounded-full sm:inset-3"
                    style={{
                        background: `radial-gradient(circle, ${auraVisual.auraColor} 0%, rgba(255,255,255,0) 72%)`,
                    }}
                />

                <div className="absolute inset-[1rem] rounded-full border border-white/80 bg-white/74 shadow-[0_24px_46px_-30px_rgba(13,148,136,0.46)] backdrop-blur-xl sm:inset-5" />

                {auraVisual.showFireflies && (
                    <div className="absolute inset-0 pointer-events-none">
                        {FIREFLY_POSITIONS.map((firefly, index) => (
                            <motion.span
                                key={`${state.species}-${index}`}
                                animate={{ y: [14, -16, 14], opacity: [0, 0.9, 0] }}
                                transition={{
                                    duration: firefly.duration,
                                    repeat: Infinity,
                                    delay: firefly.delay,
                                    ease: "easeInOut",
                                }}
                                className="absolute h-1.5 w-1.5 rounded-full bg-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.95)]"
                                style={{ left: firefly.left, top: firefly.top }}
                            />
                        ))}
                    </div>
                )}

                <motion.div
                    animate={{ scaleX: [1, 0.88, 1], opacity: [0.24, 0.12, 0.24] }}
                    transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute bottom-6 h-3.5 w-20 rounded-full bg-slate-900/10 blur-md sm:bottom-8 sm:h-4 sm:w-24"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.86 }}
                    animate={{ opacity: fadeOpacity, scale: 1 }}
                    transition={{ duration: 0.42, ease: "easeOut" }}
                    className="relative z-10 h-[clamp(10rem,36vw,13rem)] w-[clamp(10rem,36vw,13rem)]"
                >
                    <motion.div
                        animate={controls}
                        className="relative flex h-full w-full items-center justify-center rounded-full border-[3px] border-white bg-white shadow-[0_24px_48px_-30px_rgba(15,23,42,0.45)]"
                    >
                        <div className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(135deg,rgba(255,255,255,0.84)_0%,rgba(255,255,255,0.18)_36%,rgba(255,255,255,0)_58%)]" />
                        <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_4px_18px_rgba(15,23,42,0.08)]" />

                        <IkimonoSvg stage={stage} species={state.species} />

                        <AnimatePresence>
                            {ripple && (
                                <motion.div
                                    key={ripple.id}
                                    initial={{ scale: 0, opacity: 0.52 }}
                                    animate={{ scale: 4, opacity: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.55, ease: "easeOut" }}
                                    className="pointer-events-none absolute h-10 w-10 rounded-full"
                                    style={{
                                        left: ripple.x - 20,
                                        top: ripple.y - 20,
                                        background:
                                            "radial-gradient(circle, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0) 72%)",
                                    }}
                                />
                            )}
                        </AnimatePresence>
                    </motion.div>
                </motion.div>

                <AnimatePresence>
                    {particles.map((particle) => (
                        <motion.span
                            key={particle.id}
                            initial={{ opacity: 0, scale: 0.5, x: 0, y: 0 }}
                            animate={{ opacity: [0, 1, 0], scale: [0.7, 1.08, 0.88], x: particle.x, y: particle.y - 42 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1.08, ease: "easeOut" }}
                            className="pointer-events-none absolute z-20 text-2xl"
                        >
                            {particle.emoji}
                        </motion.span>
                    ))}
                </AnimatePresence>

                {stage === "fading" && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute bottom-1 rounded-full border border-amber-200/80 bg-white/92 px-4 py-2 text-xs font-black tracking-wide text-amber-700 shadow-[0_12px_28px_-20px_rgba(217,119,6,0.6)]"
                    >
                        もうすぐ たびだち
                    </motion.div>
                )}

                <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_22%),radial-gradient(circle_at_72%_68%,rgba(255,255,255,0.12),transparent_18%)]" />
            </div>

            <div className="mt-2 flex max-w-xs flex-wrap items-center justify-center gap-2 px-2 sm:mt-3">
                <span className="inline-flex items-center rounded-full border border-cyan-100/90 bg-cyan-50/92 px-3 py-1 text-xs font-black text-cyan-700">
                    {stageLabel}
                </span>
                {stage !== "egg" && (
                    <button
                        type="button"
                        onClick={() => setShowNameModal(true)}
                        className="inline-flex items-center gap-1 rounded-full border border-white/85 bg-white/85 px-3 py-1 text-xs font-black text-slate-700 shadow-sm transition hover:bg-white"
                    >
                        <span className="max-w-[7.5rem] truncate">{state.name || "なまえなし"}</span>
                        <PencilLine size={12} className="text-slate-400" />
                    </button>
                )}
            </div>
        </div>
    );
};
