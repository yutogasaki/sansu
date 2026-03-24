import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { getActiveProfile, saveProfile } from "../domain/user/repository";
import { getTodayStats, getTotalStats, getWeakPoints } from "../domain/stats/repository";
import { checkEventCondition, EventCheckParams, EventType } from "../domain/sessionManager";
import { EventModal } from "../components/domain/EventModal";
import { PaperTestScoreModal } from "../components/domain/PaperTestScoreModal";
import { eventStorage, weakPointsStorage } from "../utils/storage";
import { Ikimono } from "../components/ikimono/Ikimono";
import { HomeAnimatedBackground } from "../components/home/HomeAnimatedBackground";
import { MagicTank } from "../components/home/MagicTank";
import { getHomeMagicEnergyHint, getHomeMagicEnergyState } from "../components/home/homeMagicEnergy";
import {
    buildHomeSpeechConversationContext,
    findHomeSpeechCandidate,
    getHomeEventSpeech,
    getHomeFuwafuwaSpeech,
    type HomeSpeechSelection,
} from "../components/ikimono/fuwafuwaSpeech";
import {
    chooseNextDailyConversation,
    EMPTY_DAILY_CONVERSATION_STATE,
    type DailyConversationState,
} from "../components/ikimono/fuwafuwaDailyConversation";
import { getSceneText } from "../components/ikimono/sceneText";
import { Button } from "../components/ui/Button";
import { UserProfile } from "../domain/types";
import { warmUpTTS } from "../utils/tts";
import { toLocaleDateKey } from "../utils/learningDay";
import { recordPaperTestScore } from "../domain/test/paperTest";
import { useTimeoutScheduler } from "../hooks/useTimeoutScheduler";
import { logInDev } from "../utils/debug";

const PAPER_TEST_REMIND_DAYS = 3;

const determineEventWithPriority = (
    profile: UserProfile,
    totalCount: number,
    prevWeakCount: number | undefined,
    currentWeakCount: number
): EventType | null => {
    if (profile.periodicTestState?.math?.isPending || profile.periodicTestState?.vocab?.isPending) return "periodic_test";
    if (profile.pendingLevelUpNotification) return "level_up";

    if (profile.pendingPaperTests && profile.pendingPaperTests.length > 0) {
        const now = Date.now();
        const oldEnough = profile.pendingPaperTests.find(pt => {
            const created = new Date(pt.createdAt).getTime();
            return (now - created) / (1000 * 60 * 60 * 24) >= PAPER_TEST_REMIND_DAYS;
        });
        if (oldEnough) return "paper_test_remind";
    }

    const params: EventCheckParams = { profile, totalCount, prevWeakCount, currentWeakCount };
    return checkEventCondition(params);
};

const getOldestPendingPaperTest = (profile: UserProfile) => {
    if (!profile.pendingPaperTests || profile.pendingPaperTests.length === 0) return null;
    const now = Date.now();
    return (
        profile.pendingPaperTests.find(pt => {
            const created = new Date(pt.createdAt).getTime();
            return (now - created) / (1000 * 60 * 60 * 24) >= PAPER_TEST_REMIND_DAYS;
        }) || null
    );
};

export const Home: React.FC = () => {
    const navigate = useNavigate();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [homeStats, setHomeStats] = useState({
        todayCount: 0,
        todayCorrect: 0,
        totalCount: 0,
        weakCount: 0,
    });
    const [showEventModal, setShowEventModal] = useState(false);
    const [currentEventType, setCurrentEventType] = useState<EventType | null>(null);
    const [showPaperTestModal, setShowPaperTestModal] = useState(false);
    const [pendingPaperTest, setPendingPaperTest] = useState<{ id: string; subject: "math" | "vocab"; level: number } | null>(null);
    const [isMagicDeliveryActive, setIsMagicDeliveryActive] = useState(false);
    const [dailyConversationState, setDailyConversationState] = useState<DailyConversationState>(EMPTY_DAILY_CONVERSATION_STATE);
    const [dailySelection, setDailySelection] = useState<HomeSpeechSelection | null>(null);
    const profileId = profile?.id ?? null;
    const isEasy = profile?.uiTextMode === "easy";
    const useKanjiForIkimono = Boolean(profile?.kanjiMode);
    const { scheduleTimeout, clearScheduledTimeouts } = useTimeoutScheduler();
    const magicDeliveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dailyConversationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const todayKey = toLocaleDateKey();
    const t = (kana: string, kanji: string) => (useKanjiForIkimono ? kanji : kana);

    const persistProfileUpdate = async (nextProfile: UserProfile) => {
        await saveProfile(nextProfile);
        setProfile(nextProfile);
    };

    useEffect(() => {
        let cancelled = false;
        clearScheduledTimeouts();

        const openEventModal = (eventType: EventType) => {
            scheduleTimeout(() => {
                if (cancelled) return;
                setCurrentEventType(eventType);
                setShowEventModal(true);
            }, 800);
        };

        const loadHomeData = async () => {
            try {
                const activeProfile = await getActiveProfile();
                if (!activeProfile || cancelled) return;

                setProfile(activeProfile);

                const [total, today, weakPoints] = await Promise.all([
                    getTotalStats(activeProfile.id),
                    getTodayStats(activeProfile.id),
                    getWeakPoints(activeProfile.id)
                ]);
                if (cancelled) return;

                const prevWeakCount = weakPointsStorage.getPrevCount();
                const currentWeakCount = weakPoints.length;
                setHomeStats({
                    todayCount: today.count,
                    todayCorrect: today.correct,
                    totalCount: total.count,
                    weakCount: currentWeakCount,
                });

                const eventType = determineEventWithPriority(
                    activeProfile,
                    total.count,
                    prevWeakCount,
                    currentWeakCount
                );

                if (eventType) {
                    const shouldAlwaysShow =
                        eventType === "level_up" || eventType === "periodic_test" || eventType === "paper_test_remind";

                    if (shouldAlwaysShow) {
                        openEventModal(eventType);
                    } else {
                        const lastShownEvent = eventStorage.getLastShownEvent();
                        const lastShownDate = eventStorage.getLastShownDate();
                        const shouldShow = !lastShownEvent || lastShownEvent !== eventType || lastShownDate !== todayKey;

                        if (shouldShow) {
                            openEventModal(eventType);
                        }
                    }
                }

                weakPointsStorage.setPrevCount(currentWeakCount);
            } catch (error) {
                logInDev("[Home] failed to load home data:", error);
            }
        };

        void loadHomeData();

        return () => {
            cancelled = true;
            clearScheduledTimeouts();
        };
    }, [todayKey, scheduleTimeout, clearScheduledTimeouts]);

    useEffect(() => {
        return () => {
            if (magicDeliveryTimerRef.current) {
                clearTimeout(magicDeliveryTimerRef.current);
                magicDeliveryTimerRef.current = null;
            }
            if (dailyConversationTimerRef.current) {
                clearTimeout(dailyConversationTimerRef.current);
                dailyConversationTimerRef.current = null;
            }
        };
    }, []);

    const handleStartCheck = async () => {
        if (currentEventType) eventStorage.setShown(currentEventType, todayKey);
        setShowEventModal(false);

        if (currentEventType === "level_up" && profile) {
            await persistProfileUpdate({ ...profile, pendingLevelUpNotification: undefined });
            return;
        }
        if (currentEventType === "periodic_test") {
            warmUpTTS();
            navigate("/study?session=periodic-test");
            return;
        }
        if (currentEventType === "paper_test_remind" && profile) {
            const oldest = getOldestPendingPaperTest(profile);
            if (oldest) {
                setPendingPaperTest({ id: oldest.id, subject: oldest.subject, level: oldest.level });
                setShowPaperTestModal(true);
            }
            return;
        }

        warmUpTTS();
        navigate("/study?session=check-event");
    };

    const handleDismiss = async () => {
        if (currentEventType) eventStorage.setShown(currentEventType, todayKey);
        if (currentEventType === "level_up" && profile) {
            await persistProfileUpdate({ ...profile, pendingLevelUpNotification: undefined });
        }
        setShowEventModal(false);
    };

    const handlePaperTestSubmit = async (correctCount: number) => {
        if (!profile || !pendingPaperTest) return;
        const updatedProfile = recordPaperTestScore(profile, pendingPaperTest, correctCount);

        await persistProfileUpdate(updatedProfile);
        setShowPaperTestModal(false);
        setPendingPaperTest(null);
    };

    const handlePaperTestDismiss = () => {
        setShowPaperTestModal(false);
        setPendingPaperTest(null);
    };

    const magicEnergy = useMemo(() => getHomeMagicEnergyState({
        todayCount: homeStats.todayCount,
        todayCorrect: homeStats.todayCorrect,
        streak: profile?.streak ?? 0,
        weakCount: homeStats.weakCount,
    }), [homeStats.todayCorrect, homeStats.todayCount, homeStats.weakCount, profile?.streak]);
    const scene = useMemo(
        () => getSceneText(profileId, todayKey, homeStats.weakCount, currentEventType, useKanjiForIkimono),
        [profileId, todayKey, homeStats.weakCount, currentEventType, useKanjiForIkimono],
    );
    const homeSpeechState = useMemo(() => ({
        percent: magicEnergy.percent,
        isFull: magicEnergy.isFull,
        isSending: isMagicDeliveryActive,
        useKanjiText: useKanjiForIkimono,
    }), [isMagicDeliveryActive, magicEnergy.isFull, magicEnergy.percent, useKanjiForIkimono]);
    const eventSpeech = useMemo(
        () => getHomeEventSpeech(scene, currentEventType, homeStats.weakCount, homeSpeechState),
        [scene, currentEventType, homeStats.weakCount, homeSpeechState],
    );
    const dailyConversationContext = useMemo(
        () => buildHomeSpeechConversationContext(scene, homeStats.weakCount, homeSpeechState),
        [scene, homeStats.weakCount, homeSpeechState],
    );
    const dailyCandidateSignature = useMemo(
        () => dailyConversationContext.candidates
            .map((candidate) => `${candidate.selection.group}:${candidate.selection.topic}:${candidate.replyId}`)
            .join("|"),
        [dailyConversationContext.candidates],
    );
    const dailyContextKey = useMemo(
        () => [
            profileId ?? "guest",
            dailyConversationContext.ambientAvailable ? "ambient" : "no-ambient",
            dailyConversationContext.percent,
            dailyConversationContext.hasGrowthLite ? "growth" : "no-growth",
            dailyConversationContext.hasNamingHint ? "naming" : "no-naming",
            dailyCandidateSignature,
        ].join("::"),
        [
            profileId,
            dailyConversationContext.ambientAvailable,
            dailyConversationContext.percent,
            dailyConversationContext.hasGrowthLite,
            dailyConversationContext.hasNamingHint,
            dailyCandidateSignature,
        ],
    );
    const initialDailyConversation = useMemo(
        () => chooseNextDailyConversation(EMPTY_DAILY_CONVERSATION_STATE, dailyConversationContext, "initial"),
        [dailyConversationContext],
    );
    const resolvedDailySelection = dailySelection ?? initialDailyConversation.candidate?.selection ?? null;
    const resolvedDailyState = dailySelection ? dailyConversationState : initialDailyConversation.nextState;
    const dailySpeech = useMemo(() => {
        if (resolvedDailySelection) {
            return findHomeSpeechCandidate(dailyConversationContext.candidates, resolvedDailySelection)?.speech ?? null;
        }

        return initialDailyConversation.candidate?.speech ?? null;
    }, [dailyConversationContext.candidates, initialDailyConversation.candidate, resolvedDailySelection]);
    const homeSpeech = eventSpeech
        ?? dailySpeech
        ?? getHomeFuwafuwaSpeech(scene, currentEventType, homeStats.weakCount, homeSpeechState);
    const magicHint = getHomeMagicEnergyHint(magicEnergy.percent, useKanjiForIkimono, isMagicDeliveryActive);

    useEffect(() => {
        const { candidate, nextState } = chooseNextDailyConversation(
            EMPTY_DAILY_CONVERSATION_STATE,
            dailyConversationContext,
            "initial",
        );

        setDailyConversationState(nextState);
        setDailySelection(candidate?.selection ?? null);
    }, [dailyContextKey, dailyConversationContext]);

    useEffect(() => {
        if (dailyConversationTimerRef.current) {
            clearTimeout(dailyConversationTimerRef.current);
            dailyConversationTimerRef.current = null;
        }

        if (eventSpeech || !resolvedDailySelection) {
            return;
        }

        dailyConversationTimerRef.current = setTimeout(() => {
            const { candidate, nextState } = chooseNextDailyConversation(
                resolvedDailyState,
                dailyConversationContext,
                "tick",
            );

            if (candidate) {
                setDailyConversationState(nextState);
                setDailySelection(candidate.selection);
            }

            dailyConversationTimerRef.current = null;
        }, 12000);

        return () => {
            if (dailyConversationTimerRef.current) {
                clearTimeout(dailyConversationTimerRef.current);
                dailyConversationTimerRef.current = null;
            }
        };
    }, [dailyConversationContext, eventSpeech, resolvedDailySelection, resolvedDailyState]);

    const handleAdvanceHomeSpeech = useCallback(() => {
        if (eventSpeech) {
            return;
        }

        const { candidate, nextState } = chooseNextDailyConversation(
            resolvedDailyState,
            dailyConversationContext,
            "tap",
        );

        if (!candidate) {
            return;
        }

        setDailyConversationState(nextState);
        setDailySelection(candidate.selection);
    }, [dailyConversationContext, eventSpeech, resolvedDailyState]);

    const handleMagicRelease = () => {
        if (!magicEnergy.isFull) return;
        if (magicDeliveryTimerRef.current) clearTimeout(magicDeliveryTimerRef.current);
        setIsMagicDeliveryActive(true);
        magicDeliveryTimerRef.current = setTimeout(() => {
            setIsMagicDeliveryActive(false);
            magicDeliveryTimerRef.current = null;
        }, 2600);
    };

    return (
        <div className="relative h-full overflow-hidden">
            <HomeAnimatedBackground />

            <EventModal isOpen={showEventModal} eventType={currentEventType} onStartCheck={handleStartCheck} onDismiss={handleDismiss} />

            {pendingPaperTest && (
                <PaperTestScoreModal
                    isOpen={showPaperTestModal}
                    subject={pendingPaperTest.subject}
                    level={pendingPaperTest.level}
                    onSubmit={handlePaperTestSubmit}
                    onDismiss={handlePaperTestDismiss}
                />
            )}

            <div className="relative z-10 flex h-full flex-col px-[var(--screen-padding-x)] pt-[var(--screen-header-top)] pb-[var(--screen-bottom-with-footer)]">
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-4">
                    <div className="flex items-center justify-end">
                        <Button
                            variant="secondary"
                            size="sm"
                            className="px-4"
                            onClick={() => { warmUpTTS(); navigate("/study?session=review&force_review=1"); }}
                        >
                            {isEasy ? "ふくしゅう" : "復習"}
                        </Button>
                    </div>

                    {profileId && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.7 }}
                            className="card-surface relative mt-3 flex min-h-[420px] w-full flex-1 overflow-hidden rounded-[28px] px-5 pt-5 pb-6"
                        >
                            <motion.div
                                aria-hidden="true"
                                animate={{ x: [0, 12, 0], y: [0, -10, 0], opacity: [0.32, 0.52, 0.32] }}
                                transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }}
                                className="pointer-events-none absolute -top-10 -left-8 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(255,234,167,0.55)_0%,rgba(255,234,167,0.06)_62%,transparent_76%)] blur-2xl"
                            />
                            <motion.div
                                aria-hidden="true"
                                animate={{ x: [0, -10, 0], y: [0, 12, 0], opacity: [0.18, 0.38, 0.18] }}
                                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                                className="pointer-events-none absolute right-[-2rem] bottom-8 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.34)_0%,rgba(56,189,248,0.05)_64%,transparent_78%)] blur-2xl"
                            />
                            <div className="relative z-10 flex h-full w-full flex-col">
                                <p className="text-center text-sm font-bold leading-relaxed text-slate-600">
                                    {magicHint}
                                </p>

                                <div className="mt-4 flex flex-col items-center">
                                    <MagicTank
                                        currentValue={magicEnergy.currentValue}
                                        maxValue={magicEnergy.maxValue}
                                        isSending={isMagicDeliveryActive}
                                        onRelease={magicEnergy.isFull ? handleMagicRelease : undefined}
                                        ariaLabel={t("まほうタンク", "魔法タンク")}
                                    />
                                    <span className="mt-2 text-xs font-bold text-slate-400">
                                        {`${magicEnergy.currentValue} / ${magicEnergy.maxValue}`}
                                    </span>
                                </div>

                                <div className="mt-2 flex min-h-0 flex-1 items-center justify-center">
                                    <Ikimono
                                        profileId={profileId}
                                        kanjiMode={useKanjiForIkimono}
                                        speech={homeSpeech}
                                        onSpeechAdvance={eventSpeech ? undefined : handleAdvanceHomeSpeech}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
};
