import { useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getActiveProfile, saveProfile } from "../domain/user/repository";
import { getTotalStats } from "../domain/stats/repository";
import { checkEventCondition, EventCheckParams, EventType } from "../domain/sessionManager";
import { getWeakPoints } from "../domain/stats/repository";
import { EventModal } from "../components/domain/EventModal";
import { PaperTestScoreModal } from "../components/domain/PaperTestScoreModal";
import { eventStorage, ikimonoStorage, weakPointsStorage } from "../utils/storage";
import { Ikimono } from "../components/ikimono/Ikimono";
import { calculateStage } from "../components/ikimono/lifecycle";
import { IkimonoStage } from "../components/ikimono/types";
import { Button } from "../components/ui/Button";
import { UserProfile, PeriodicTestResult } from "../domain/types";
import { warmUpTTS } from "../utils/tts";
import { toLocaleDateKey } from "../utils/learningDay";

const PAPER_TEST_REMIND_DAYS = 3;

const STAGE_TONE: Record<Exclude<IkimonoStage, "gone">, { now: string[]; mood: string[]; aura: string[] }> = {
    egg: {
        now: [
            "からのなかで、ちいさく あたためてる。",
            "しずかに、まだ かたちを えらんでる。",
            "ねむってるようで、ちゃんと きいてる。",
        ],
        mood: [
            "おだやか。ふわっと きぶん。",
            "すこし くすぐったそう。",
            "やわらかい ひかりに なじんでる。",
        ],
        aura: ["しずけさ", "ぬくもり", "ちいさな予感"],
    },
    hatching: {
        now: [
            "からが かすかに ひびいてる。",
            "なかから、ちいさな こどうが する。",
            "もう すこしで、こえが きこえそう。",
        ],
        mood: [
            "そわそわ しながら たのしそう。",
            "わくわくが ふくらんでる。",
            "いまにも ぴょこっと しそう。",
        ],
        aura: ["ざわめき", "はじまり", "ゆれる気配"],
    },
    small: {
        now: [
            "ちいさく うごいて、まわりを みてる。",
            "はじめての ものに きょうみ しんしん。",
            "まだ こどもっぽく、ぴょんと はずむ。",
        ],
        mood: [
            "ごきげんで、ちょっと いたずら。",
            "きらきら した まなざし。",
            "ちいさく いきおいが ある。",
        ],
        aura: ["好奇心", "軽さ", "あたらしさ"],
    },
    medium: {
        now: [
            "じぶんの リズムで、ゆったり あるいてる。",
            "おちついて、すこし たのもしそう。",
            "まわりを みながら、じぶんの ばしょを つくってる。",
        ],
        mood: [
            "おだやか だけど しっかり。",
            "すこし 大人びた きぶん。",
            "ひかえめに うれしそう。",
        ],
        aura: ["安定", "呼吸", "まるみ"],
    },
    adult: {
        now: [
            "ゆっくり たたずんで、ぜんぶを みわたしてる。",
            "しずかに つよく、そこに いる。",
            "ことばは すくなく、ふんいきで つたえる。",
        ],
        mood: [
            "おちついた ぬくもり。",
            "やさしい いばしょ みたい。",
            "すこし ものおもい。",
        ],
        aura: ["深さ", "余白", "包みこみ"],
    },
    fading: {
        now: [
            "すこしずつ うすれて、かぜに まざっていく。",
            "しずかに ひかりを のこしてる。",
            "さよならに ちかい、でも やわらかい。",
        ],
        mood: [
            "なつかしい きぶん。",
            "やさしく てを ふってる みたい。",
            "しんとして きれい。",
        ],
        aura: ["余韻", "ささやき", "次のいのち"],
    },
};

const STAGE_NEXT_LABEL: Record<Exclude<IkimonoStage, "gone">, string> = {
    egg: "からが うごきだす",
    hatching: "ちいさな すがたが みえそう",
    small: "すこし おとなっぽく なる",
    medium: "どっしり してくる",
    adult: "ひかりが やわらかく かわる",
    fading: "つぎの いのちへ つながる",
};

const STAGE_END_DAY: Record<Exclude<IkimonoStage, "gone">, number> = {
    egg: 3,
    hatching: 7,
    small: 14,
    medium: 22,
    adult: 28,
    fading: 30,
};

const hashSeed = (text: string): number => {
    let h = 0;
    for (let i = 0; i < text.length; i++) {
        h = (h * 31 + text.charCodeAt(i)) % 1000003;
    }
    return h;
};

const pickBySeed = (items: string[], seed: number, shift = 0): string => {
    return items[(seed + shift) % items.length];
};

const getStageSnapshot = (profileId: string | null): { stage: Exclude<IkimonoStage, "gone">; birthDate: string | null } => {
    if (!profileId) return { stage: "egg", birthDate: null };
    const stored = ikimonoStorage.getState();
    if (!stored || stored.profileId !== profileId) return { stage: "egg", birthDate: null };
    const info = calculateStage(stored.birthDate);
    if (info.stage === "gone") return { stage: "egg", birthDate: null };
    return { stage: info.stage, birthDate: stored.birthDate };
};

const getTransitionNuance = (stage: Exclude<IkimonoStage, "gone">, birthDate: string | null): string => {
    if (!birthDate) return `もうすこしで、${STAGE_NEXT_LABEL[stage]}。`;
    const elapsedDays = (Date.now() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24);
    const remain = STAGE_END_DAY[stage] - elapsedDays;
    const prefix = remain < 0.6 ? "いまにも、" : remain < 1.6 ? "そろそろ、" : "ゆっくり、";
    return `${prefix}${STAGE_NEXT_LABEL[stage]}。`;
};

const getSceneText = (
    profileId: string | null,
    dayKey: string,
    weakCount: number,
    currentEventType: EventType | null
) => {
    const snapshot = getStageSnapshot(profileId);
    const tone = STAGE_TONE[snapshot.stage];
    const seed = hashSeed(`${profileId || "guest"}-${dayKey}-${snapshot.stage}`);
    const nowLine = pickBySeed(tone.now, seed);
    const moodLineBase = pickBySeed(tone.mood, seed, 1);
    const aura = [tone.aura[seed % tone.aura.length], tone.aura[(seed + 1) % tone.aura.length], tone.aura[(seed + 2) % tone.aura.length]];
    const transition = getTransitionNuance(snapshot.stage, snapshot.birthDate);

    let moodLine = moodLineBase;
    if (weakCount >= 6) moodLine = `${moodLineBase} ちょっと まよいも ある。`;
    if (weakCount === 0) moodLine = `${moodLineBase} いまは すごく かるい。`;
    if (currentEventType === "periodic_test") moodLine = `${moodLineBase} きょうは すこし きりっと。`;
    if (currentEventType === "level_up") moodLine = `${moodLineBase} なんだか ほこらしげ。`;

    return {
        stage: snapshot.stage,
        nowLine,
        transition,
        moodLine,
        aura,
        whisper: currentEventType
            ? "なにか つたえたい ことが あるみたい。"
            : weakCount > 0
                ? "すこし きになる ことが あるみたい。"
                : "きょうは ただ、そばに いたいみたい。",
    };
};

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

    const scene = useMemo(() => getSceneText(profileId, todayKey, weakCount, currentEventType), [profileId, todayKey, weakCount, currentEventType]);

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

        const newResult: PeriodicTestResult = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            subject: pendingPaperTest.subject,
            level: pendingPaperTest.level,
            mode: "manual",
            method: "paper",
            correctCount,
            totalQuestions: 20,
            score: Math.round((correctCount / 20) * 100),
            durationSeconds: 0,
        };

        const updatedPendingTests = (profile.pendingPaperTests || []).filter(pt => pt.id !== pendingPaperTest.id);
        const updatedProfile = {
            ...profile,
            pendingPaperTests: updatedPendingTests.length > 0 ? updatedPendingTests : undefined,
            testHistory: [...(profile.testHistory || []), newResult],
        };

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
        <div className="relative h-full overflow-hidden bg-background">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(56,189,248,0.24),transparent_42%),radial-gradient(circle_at_84%_18%,rgba(20,184,166,0.17),transparent_45%),radial-gradient(circle_at_70%_82%,rgba(251,191,36,0.16),transparent_42%)]" />
            <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-white/35 blur-3xl" />
            <div className="absolute -bottom-20 -left-16 w-64 h-64 rounded-full bg-cyan-100/45 blur-3xl" />

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
                        className="w-full rounded-2xl bg-white/80 backdrop-blur-md border border-white/80 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.5)] px-4 py-3 flex items-start gap-3"
                    >
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-emerald-400 flex-shrink-0" />
                        <div className="min-w-0">
                            <div className="text-base leading-snug font-black text-slate-800 line-clamp-2">{scene.nowLine}</div>
                            <div className="mt-1 text-xs text-slate-500">{scene.moodLine}</div>
                        </div>
                    </motion.div>

                    {/* Ikimono display */}
                    {profileId && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.7 }}
                            className="mt-3 flex-1 min-h-[200px] w-full rounded-[2rem] border border-white/80 bg-white/55 backdrop-blur-sm shadow-[0_20px_32px_-28px_rgba(15,23,42,0.7)] flex flex-col items-center justify-center px-3 relative"
                        >
                            <Ikimono profileId={profileId} />
                            {/* Whisper overlay at bottom of ikimono card */}
                            <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                                <span className="text-[11px] text-slate-400 bg-white/60 backdrop-blur-sm px-3 py-1 rounded-full border border-white/70">
                                    {scene.whisper}
                                </span>
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Fixed CTA area at bottom */}
                <div className="flex-none w-full max-w-md pb-24 land:pb-20 pt-2">
                    <div className="flex gap-2">
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
