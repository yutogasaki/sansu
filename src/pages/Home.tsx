import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getActiveProfile, saveProfile } from "../domain/user/repository";
import { getTotalStats } from "../domain/stats/repository";
import { checkEventCondition, EventCheckParams, EventType } from "../domain/sessionManager";
import { getWeakPoints } from "../domain/stats/repository";
import { EventModal } from "../components/domain/EventModal";
import { PaperTestScoreModal } from "../components/domain/PaperTestScoreModal";
import { eventStorage, weakPointsStorage } from "../utils/storage";
import { Ikimono } from "../components/ikimono/Ikimono";
import { HomeAnimatedBackground } from "../components/home/HomeAnimatedBackground";
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
    const [showEventModal, setShowEventModal] = useState(false);
    const [currentEventType, setCurrentEventType] = useState<EventType | null>(null);
    const [showPaperTestModal, setShowPaperTestModal] = useState(false);
    const [pendingPaperTest, setPendingPaperTest] = useState<{ id: string; subject: "math" | "vocab"; level: number } | null>(null);
    const profileId = profile?.id ?? null;
    const isEasy = profile?.uiTextMode === "easy";
    const useKanjiForIkimono = Boolean(profile?.kanjiMode);
    const { scheduleTimeout, clearScheduledTimeouts } = useTimeoutScheduler();

    const todayKey = toLocaleDateKey();

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

                const [total, weakPoints] = await Promise.all([
                    getTotalStats(activeProfile.id),
                    getWeakPoints(activeProfile.id)
                ]);
                if (cancelled) return;

                const prevWeakCount = weakPointsStorage.getPrevCount();
                const currentWeakCount = weakPoints.length;

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
                    <div className="flex justify-end">
                        <Button
                            variant="secondary"
                            size="md"
                            className="px-5"
                            onClick={() => { warmUpTTS(); navigate("/study?session=review&force_review=1"); }}
                        >
                            {isEasy ? "ふくしゅう" : "復習"}
                        </Button>
                    </div>

                    {/* Ikimono display */}
                    {profileId && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.7 }}
                            className="card-surface mt-3 flex min-h-[360px] w-full flex-1 flex-col items-center justify-center rounded-[20px] px-3 pt-6 pb-6"
                        >
                            <Ikimono profileId={profileId} kanjiMode={useKanjiForIkimono} />
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
};
