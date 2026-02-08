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
import { UserProfile, PeriodicTestResult } from "../domain/types";

// 紙テストリマインドの日数閾値
const PAPER_TEST_REMIND_DAYS = 3;

/**
 * 優先順位に基づいてイベントを決定する
 * 1. periodic_test（定期テストがpending）
 * 2. level_up（レベルアップ通知がpending）
 * 3. paper_test_remind（紙テストが3日以上前）
 * 4. 既存イベント（streak, total, weak_decrease, level_up_near）
 */
const determineEventWithPriority = (
    profile: UserProfile,
    totalCount: number,
    prevWeakCount: number | undefined,
    currentWeakCount: number
): EventType | null => {
    // 1. 定期テストがpending
    if (profile.periodicTestState?.math?.isPending || profile.periodicTestState?.vocab?.isPending) {
        return "periodic_test";
    }

    // 2. レベルアップ通知がpending
    if (profile.pendingLevelUpNotification) {
        return "level_up";
    }

    // 3. 紙テストが3日以上前
    if (profile.pendingPaperTests && profile.pendingPaperTests.length > 0) {
        const now = Date.now();
        const oldEnough = profile.pendingPaperTests.find(pt => {
            const created = new Date(pt.createdAt).getTime();
            const daysPassed = (now - created) / (1000 * 60 * 60 * 24);
            return daysPassed >= PAPER_TEST_REMIND_DAYS;
        });
        if (oldEnough) {
            return "paper_test_remind";
        }
    }

    // 4. 既存のイベントチェック
    const params: EventCheckParams = {
        profile,
        totalCount,
        prevWeakCount,
        currentWeakCount
    };
    return checkEventCondition(params);
};

/**
 * 3日以上前の紙テストを取得
 */
const getOldestPendingPaperTest = (profile: UserProfile) => {
    if (!profile.pendingPaperTests || profile.pendingPaperTests.length === 0) {
        return null;
    }
    const now = Date.now();
    return profile.pendingPaperTests.find(pt => {
        const created = new Date(pt.createdAt).getTime();
        const daysPassed = (now - created) / (1000 * 60 * 60 * 24);
        return daysPassed >= PAPER_TEST_REMIND_DAYS;
    }) || null;
};

export const Home: React.FC = () => {
    const navigate = useNavigate();
    const [profileId, setProfileId] = useState<string | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);

    // Event modal state
    const [showEventModal, setShowEventModal] = useState(false);
    const [currentEventType, setCurrentEventType] = useState<EventType | null>(null);

    // Paper test score modal state
    const [showPaperTestModal, setShowPaperTestModal] = useState(false);
    const [pendingPaperTest, setPendingPaperTest] = useState<{
        id: string;
        subject: 'math' | 'vocab';
        level: number;
    } | null>(null);

    const today = new Date();
    const todayKey = today.toISOString().split("T")[0];

    useEffect(() => {
        getActiveProfile().then(p => {
            if (p) {
                setProfileId(p.id);
                setProfile(p);

                // イベント条件チェック（優先順位ベース）
                Promise.all([
                    getTotalStats(p.id),
                    getWeakPoints(p.id)
                ]).then(([total, weakPoints]) => {
                    const prevWeakCount = weakPointsStorage.getPrevCount();
                    const currentWeakCount = weakPoints.length;

                    const eventType = determineEventWithPriority(
                        p,
                        total.count,
                        prevWeakCount,
                        currentWeakCount
                    );

                    if (eventType) {
                        // level_up は毎回表示（pending をクリアするまで）
                        // 他のイベントは1日1回制限
                        const shouldAlwaysShow = eventType === "level_up" || eventType === "periodic_test" || eventType === "paper_test_remind";

                        if (shouldAlwaysShow) {
                            setTimeout(() => {
                                setCurrentEventType(eventType);
                                setShowEventModal(true);
                            }, 800);
                        } else {
                            const lastShownEvent = eventStorage.getLastShownEvent();
                            const lastShownDate = eventStorage.getLastShownDate();

                            const shouldShow =
                                !lastShownEvent ||
                                lastShownEvent !== eventType ||
                                lastShownDate !== todayKey;

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
            }
        });
    }, [todayKey]);

    const handleStartCheck = async () => {
        if (currentEventType) {
            eventStorage.setShown(currentEventType, todayKey);
        }
        setShowEventModal(false);

        if (currentEventType === "level_up" && profile) {
            // レベルアップ通知をクリア
            await saveProfile({
                ...profile,
                pendingLevelUpNotification: undefined
            });
            setProfile({ ...profile, pendingLevelUpNotification: undefined });
            // level_up はホームに戻るだけ（学習開始しない）
            return;
        }

        if (currentEventType === "periodic_test") {
            navigate("/study?session=periodic-test");
            return;
        }

        if (currentEventType === "paper_test_remind" && profile) {
            // 紙テスト点数入力モーダルを開く
            const oldest = getOldestPendingPaperTest(profile);
            if (oldest) {
                setPendingPaperTest({
                    id: oldest.id,
                    subject: oldest.subject,
                    level: oldest.level
                });
                setShowPaperTestModal(true);
            }
            return;
        }

        // その他のイベント
        navigate("/study?session=check-event");
    };

    const handleDismiss = async () => {
        if (currentEventType) {
            eventStorage.setShown(currentEventType, todayKey);
        }

        if (currentEventType === "level_up" && profile) {
            // レベルアップ通知をクリア（閉じた場合も）
            await saveProfile({
                ...profile,
                pendingLevelUpNotification: undefined
            });
            setProfile({ ...profile, pendingLevelUpNotification: undefined });
        }

        setShowEventModal(false);
    };

    const handlePaperTestSubmit = async (correctCount: number) => {
        if (!profile || !pendingPaperTest) return;

        // テスト結果を保存
        const newResult: PeriodicTestResult = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            subject: pendingPaperTest.subject,
            level: pendingPaperTest.level,
            mode: 'manual',
            method: 'paper',
            correctCount,
            totalQuestions: 20,
            score: Math.round((correctCount / 20) * 100),
            durationSeconds: 0 // 紙テストは時間計測なし
        };

        // pendingPaperTests から削除し、testHistory に追加
        const updatedPendingTests = (profile.pendingPaperTests || [])
            .filter(pt => pt.id !== pendingPaperTest.id);

        const updatedProfile = {
            ...profile,
            pendingPaperTests: updatedPendingTests.length > 0 ? updatedPendingTests : undefined,
            testHistory: [...(profile.testHistory || []), newResult]
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
            {/* Event Modal */}
            <EventModal
                isOpen={showEventModal}
                eventType={currentEventType}
                onStartCheck={handleStartCheck}
                onDismiss={handleDismiss}
            />

            {/* Paper Test Score Modal */}
            {pendingPaperTest && (
                <PaperTestScoreModal
                    isOpen={showPaperTestModal}
                    subject={pendingPaperTest.subject}
                    level={pendingPaperTest.level}
                    onSubmit={handlePaperTestSubmit}
                    onDismiss={handlePaperTestDismiss}
                />
            )}

            {/* Content */}
            <div className="relative z-10 flex flex-col h-full items-center justify-center px-6 pb-24 land:px-10 land:pb-20">

                {/* いきもの */}
                {profileId && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8 }}
                        className="flex-1 flex items-center justify-center"
                    >
                        <Ikimono profileId={profileId} />
                    </motion.div>
                )}

                {/* はじめるボタン */}
                <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate("/study")}
                    className="px-12 py-4 rounded-full font-bold text-xl shadow-lg active:shadow-none transition-shadow flex-shrink-0 mb-4"
                    style={{ backgroundColor: '#483D8B', color: '#fff', boxShadow: '0 10px 15px -3px rgba(72,61,139,0.4)' }}
                >
                    はじめる
                </motion.button>
            </div>
        </div>
    );
};
