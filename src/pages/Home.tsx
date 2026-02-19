import { useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getActiveProfile, saveProfile } from "../domain/user/repository";
import { getTotalStats } from "../domain/stats/repository";
import { checkEventCondition, EventCheckParams, EventType } from "../domain/sessionManager";
import { getWeakPoints } from "../domain/stats/repository";
import { EventModal } from "../components/domain/EventModal";
import { PaperTestScoreModal } from "../components/domain/PaperTestScoreModal";
import { eventStorage, weakPointsStorage } from "../utils/storage";
import { Ikimono } from "../components/ikimono/Ikimono";
import { getSceneText, stageText } from "../components/ikimono/sceneText";
import { Button } from "../components/ui/Button";
import { UserProfile } from "../domain/types";
import { warmUpTTS } from "../utils/tts";
import { toLocaleDateKey } from "../utils/learningDay";
import { recordPaperTestScore } from "../domain/test/paperTest";

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
    const [profileId, setProfileId] = useState<string | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [weakCount, setWeakCount] = useState(0);
    const [showEventModal, setShowEventModal] = useState(false);
    const [currentEventType, setCurrentEventType] = useState<EventType | null>(null);
    const [showPaperTestModal, setShowPaperTestModal] = useState(false);
    const [pendingPaperTest, setPendingPaperTest] = useState<{ id: string; subject: "math" | "vocab"; level: number } | null>(null);
    const isEasy = profile?.uiTextMode === "easy";
    const useKanjiForIkimono = Boolean(profile?.kanjiMode);

    const todayKey = toLocaleDateKey();

    useEffect(() => {
        getActiveProfile().then(p => {
            if (!p) return;
            setProfileId(p.id);
            setProfile(p);

            Promise.all([getTotalStats(p.id), getWeakPoints(p.id)]).then(([total, weakPoints]) => {
                const prevWeakCount = weakPointsStorage.getPrevCount();
                const currentWeakCount = weakPoints.length;
                setWeakCount(currentWeakCount);

                const eventType = determineEventWithPriority(p, total.count, prevWeakCount, currentWeakCount);
                if (eventType) {
                    const shouldAlwaysShow =
                        eventType === "level_up" || eventType === "periodic_test" || eventType === "paper_test_remind";

                    if (shouldAlwaysShow) {
                        setTimeout(() => {
                            setCurrentEventType(eventType);
                            setShowEventModal(true);
                        }, 800);
                    } else {
                        const lastShownEvent = eventStorage.getLastShownEvent();
                        const lastShownDate = eventStorage.getLastShownDate();
                        const shouldShow = !lastShownEvent || lastShownEvent !== eventType || lastShownDate !== todayKey;

                        if (shouldShow) {
                            setTimeout(() => {
                                setCurrentEventType(eventType);
                                setShowEventModal(true);
                            }, 800);
                        }
                    }
                }

                weakPointsStorage.setPrevCount(currentWeakCount);
            });
        });
    }, [todayKey]);

    const scene = useMemo(
        () => getSceneText(profileId, todayKey, weakCount, currentEventType, useKanjiForIkimono),
        [profileId, todayKey, weakCount, currentEventType, useKanjiForIkimono]
    );

    const handleStartCheck = async () => {
        if (currentEventType) eventStorage.setShown(currentEventType, todayKey);
        setShowEventModal(false);

        if (currentEventType === "level_up" && profile) {
            await saveProfile({ ...profile, pendingLevelUpNotification: undefined });
            setProfile({ ...profile, pendingLevelUpNotification: undefined });
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
            await saveProfile({ ...profile, pendingLevelUpNotification: undefined });
            setProfile({ ...profile, pendingLevelUpNotification: undefined });
        }
        setShowEventModal(false);
    };

    const handlePaperTestSubmit = async (correctCount: number) => {
        if (!profile || !pendingPaperTest) return;
        const updatedProfile = recordPaperTestScore(profile, pendingPaperTest, correctCount);

        await saveProfile(updatedProfile);
        setProfile(updatedProfile);
        setShowPaperTestModal(false);
        setPendingPaperTest(null);
    };

    const handlePaperTestDismiss = () => {
        setShowPaperTestModal(false);
        setPendingPaperTest(null);
    };

    return (
        <div className="relative h-full overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(56,189,248,0.3),transparent_44%),radial-gradient(circle_at_84%_18%,rgba(20,184,166,0.2),transparent_46%),radial-gradient(circle_at_70%_82%,rgba(251,191,36,0.2),transparent_44%)]" />
            <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-white/42 blur-3xl" />
            <div className="absolute -bottom-20 -left-16 w-64 h-64 rounded-full bg-cyan-100/55 blur-3xl" />

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

            <div className="relative z-10 flex flex-col h-full items-center justify-start px-5 pt-4 pb-0 land:px-10 land:pt-4 overflow-hidden">
                {/* Status + Ikimono Area (scrollable) */}
                <div className="flex-1 w-full max-w-md flex flex-col items-center min-h-0 overflow-y-auto pb-4">
                    {/* Compact status bar */}
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="w-full rounded-[1.65rem] app-glass px-4 py-3 flex items-start gap-3"
                    >
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-emerald-400 flex-shrink-0 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]" />
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold text-cyan-700 bg-cyan-100/75 border border-cyan-100">
                                    {useKanjiForIkimono ? stageText[scene.stage].kanji : stageText[scene.stage].kana}
                                </span>
                                <span className="text-[10px] font-semibold tracking-wide text-slate-400">TODAY NOTE</span>
                            </div>
                            <div className="text-base leading-snug font-black text-slate-800 line-clamp-2">{scene.nowLine}</div>
                            <div className="mt-1 text-xs text-slate-500">{scene.moodLine}</div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, delay: 0.08 }}
                        className="mt-2 w-full flex flex-wrap gap-2"
                    >
                        {scene.aura.map((tag) => (
                            <span key={tag} className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold text-slate-600 bg-white/62 border border-white/80 backdrop-blur-sm">
                                {tag}
                            </span>
                        ))}
                    </motion.div>

                    {/* Ikimono display */}
                    {profileId && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.7 }}
                            className="mt-3 flex-1 min-h-[200px] w-full rounded-[2rem] app-glass flex flex-col items-center justify-center px-3 pt-2 pb-4"
                        >
                            <Ikimono profileId={profileId} kanjiMode={useKanjiForIkimono} statusText={scene.whisper} />
                        </motion.div>
                    )}
                </div>

                {/* Fixed CTA area at bottom */}
                <div className="flex-none w-full max-w-md pb-24 land:pb-20 pt-2">
                    <div className="flex gap-2 rounded-[1.5rem] bg-white/45 border border-white/80 backdrop-blur-md p-2 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.75)]">
                        <Button
                            size="xl"
                            className="flex-1"
                            onClick={() => { warmUpTTS(); navigate("/study"); }}
                        >
                            {isEasy ? "このこ と すすむ" : "この子と進む"}
                        </Button>
                        <Button
                            variant="secondary"
                            className="h-16 px-5 text-sm"
                            onClick={() => { warmUpTTS(); navigate("/study?session=review&force_review=1"); }}
                        >
                            {isEasy ? "ふくしゅう" : "復習"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
