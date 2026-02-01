import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useSwipeable } from "react-swipeable";
import { Header } from "../components/Header";
import { Card } from "../components/ui/Card";
// Inputs
import { ChoiceGroup } from "../components/domain/ChoiceGroup";
import { TenKey } from "../components/domain/TenKey";
import { MultiNumberInput } from "../components/domain/MultiNumberInput";
// Logic
import { playSound, setSoundEnabled } from "../utils/audio";
import { getActiveProfile } from "../domain/user/repository";
import { useStudySession } from "../hooks/useStudySession";
import { logAttempt } from "../domain/learningRepository";
// Icons
import { Icons } from "../components/icons";
import { Button } from "../components/ui/Button";

export const Study: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const devSkill = searchParams.get("dev_skill") || undefined;
    const focusSubject = searchParams.get("focus_subject") as "math" | "vocab" | null;
    const focusIdsParam = searchParams.get("focus_ids");
    const forceReview = searchParams.get("force_review") === "1";
    const sessionKindParam = searchParams.get("session") as
        | "normal"
        | "review"
        | "weak"
        | "check-normal"
        | "check-event"
        | null;

    const focusIds = focusIdsParam ? focusIdsParam.split(",").filter(Boolean) : undefined;

    const { queue, nextBlock, handleResult, loading, blockSize } = useStudySession({
        devSkill,
        focusSubject: focusSubject || undefined,
        focusIds,
        forceReview,
        sessionKind: sessionKindParam || "normal"
    });

    // State
    const [currentIndex, setCurrentIndex] = useState(0);                    // 0-4
    const [userInput, setUserInput] = useState("");                         // Single input
    const [userInputs, setUserInputs] = useState<string[]>([]);             // Multi input
    const [activeFieldIndex, setActiveFieldIndex] = useState(0);            // Focus for multi

    const [feedback, setFeedback] = useState<"none" | "correct" | "incorrect" | "skipped">("none");
    const [showCorrection, setShowCorrection] = useState(false);

    // UI State for Block Transition
    const [isFinished, setIsFinished] = useState(false);

    // Profile ID for skip logging
    const [profileId, setProfileId] = useState<string | null>(null);

    const currentProblem = queue[currentIndex];

    // Sync Audio Settings & Profile ID
    useEffect(() => {
        getActiveProfile().then(profile => {
            if (profile) {
                setSoundEnabled(profile.soundEnabled);
                setProfileId(profile.id);
            }
        });
    }, []);

    // Reset inputs when problem changes
    useEffect(() => {
        if (!currentProblem) return;
        setUserInput("");
        if (currentProblem.inputType === 'multi-number' && currentProblem.inputConfig?.fields) {
            setUserInputs(new Array(currentProblem.inputConfig.fields.length).fill(""));
            setActiveFieldIndex(0);
        } else {
            setUserInputs([]);
        }
        setFeedback("none");
        setShowCorrection(false);
    }, [currentProblem]);

    // Check if we finished the current queue
    useEffect(() => {
        if (queue.length > 0 && currentIndex >= queue.length) {
            setIsFinished(true);
        } else {
            setIsFinished(false);
        }
    }, [currentIndex, queue.length]);

    // Handlers - 全てのフックより前に定義
    const handleTenKeyInput = useCallback((val: string | number) => {
        const valStr = val.toString();
        if (feedback !== "none") return;
        playSound("tap");

        if (currentProblem?.inputType === 'multi-number' && currentProblem.inputConfig?.fields) {
            const fields = currentProblem.inputConfig.fields;
            const currentFieldLength = fields[activeFieldIndex]?.length || 3;

            setUserInputs(prev => {
                const newInputs = [...prev];
                if (newInputs[activeFieldIndex].length < currentFieldLength) {
                    newInputs[activeFieldIndex] += valStr;

                    if (newInputs[activeFieldIndex].length >= currentFieldLength) {
                        if (activeFieldIndex < fields.length - 1) {
                            setTimeout(() => setActiveFieldIndex(activeFieldIndex + 1), 50);
                        }
                    }
                }
                return newInputs;
            });
        } else {
            if (userInput.length < 8) {
                setUserInput(prev => prev + valStr);
            }
        }
    }, [feedback, currentProblem, activeFieldIndex, userInput.length]);

    const handleBackspace = useCallback(() => {
        if (feedback !== "none") return;
        playSound("tap");

        if (currentProblem?.inputType === 'multi-number') {
            setUserInputs(prev => {
                const newInputs = [...prev];
                newInputs[activeFieldIndex] = newInputs[activeFieldIndex].slice(0, -1);
                return newInputs;
            });
        } else {
            setUserInput(prev => prev.slice(0, -1));
        }
    }, [feedback, currentProblem, activeFieldIndex]);

    const handleClear = useCallback(() => {
        if (feedback !== "none") return;
        if (currentProblem?.inputType === 'multi-number') {
            setUserInputs(prev => {
                const newInputs = [...prev];
                newInputs[activeFieldIndex] = "";
                return newInputs;
            });
        } else {
            setUserInput("");
        }
    }, [feedback, currentProblem, activeFieldIndex]);

    const handleCursorMove = useCallback((direction: "left" | "right") => {
        if (feedback !== "none") return;
        if (currentProblem?.inputType === 'multi-number' && currentProblem.inputConfig?.fields) {
            const maxIndex = currentProblem.inputConfig.fields.length - 1;
            if (direction === "right") {
                setActiveFieldIndex(prev => Math.min(prev + 1, maxIndex));
            } else {
                setActiveFieldIndex(prev => Math.max(prev - 1, 0));
            }
        }
    }, [feedback, currentProblem]);

    const nextProblem = useCallback(() => {
        setFeedback("none");
        setShowCorrection(false);
        setUserInput("");
        setCurrentIndex(prev => prev + 1);
    }, []);

    // Submitting - useEffectより前に定義
    const handleSubmit = useCallback(async (choiceValue?: string) => {
        if (feedback !== "none" || !currentProblem) return;

        let isCorrect = false;

        if (currentProblem.inputType === "choice") {
            isCorrect = choiceValue === currentProblem.correctAnswer;
        } else if (currentProblem.inputType === "multi-number") {
            const correctArr = currentProblem.correctAnswer as string[];
            if (correctArr.length !== userInputs.length) {
                isCorrect = false;
            } else {
                isCorrect = userInputs.every((val, idx) => val === correctArr[idx]);
            }
        } else {
            isCorrect = userInput === currentProblem.correctAnswer;
        }

        if (isCorrect) {
            setFeedback("correct");
            playSound("correct");
            handleResult(currentProblem, 'correct');

            setTimeout(() => {
                nextProblem();
            }, 800);
        } else {
            setFeedback("incorrect");
            playSound("incorrect");
            handleResult(currentProblem, 'incorrect');

            setShowCorrection(true);
            setTimeout(() => {
                nextProblem();
            }, 3000);
        }
    }, [feedback, currentProblem, userInput, userInputs, handleResult, nextProblem]);

    // スキップ処理（仕様 4.7）
    const handleSkip = useCallback(async () => {
        if (feedback !== "none" || !currentProblem || !profileId) return;

        setFeedback("skipped");
        setShowCorrection(true);
        playSound("incorrect");

        // スキップをログ（strength=1にリセット、不正解扱い）
        await logAttempt(profileId, currentProblem.subject, currentProblem.categoryId, 'incorrect', true, currentProblem.isReview);

        setTimeout(() => {
            nextProblem();
        }, 2500);
    }, [feedback, currentProblem, profileId, nextProblem]);

    // 左スワイプでスキップ
    const swipeHandlers = useSwipeable({
        onSwipedLeft: () => handleSkip(),
        trackMouse: false,
        preventScrollOnSwipe: true,
    });

    // PCキーボード操作（仕様 4.2）
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (feedback !== "none") return;
            if (!currentProblem) return;

            // 数字キー 0-9
            if (e.key >= '0' && e.key <= '9') {
                handleTenKeyInput(e.key);
                e.preventDefault();
            }
            // Backspace
            else if (e.key === 'Backspace') {
                handleBackspace();
                e.preventDefault();
            }
            // Delete (クリア)
            else if (e.key === 'Delete') {
                handleClear();
                e.preventDefault();
            }
            // Enter (決定)
            else if (e.key === 'Enter') {
                handleSubmit();
                e.preventDefault();
            }
            // S or Escape (スキップ)
            else if (e.key === 's' || e.key === 'S' || e.key === 'Escape') {
                handleSkip();
                e.preventDefault();
            }
            // 小数点
            else if (e.key === '.' && currentProblem.categoryId.startsWith("dec_")) {
                handleTenKeyInput('.');
                e.preventDefault();
            }
            // 4択の場合 1-4
            else if (currentProblem.inputType === "choice" && e.key >= '1' && e.key <= '4') {
                const choices = currentProblem.inputConfig?.choices;
                if (choices) {
                    const idx = parseInt(e.key) - 1;
                    if (idx < choices.length) {
                        handleSubmit(choices[idx].value);
                    }
                }
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [feedback, currentProblem, handleTenKeyInput, handleBackspace, handleClear, handleSkip, handleSubmit]);

    const handleContinue = useCallback(() => {
        nextBlock();
    }, [nextBlock]);

    // Loading state - 全てのフックの後
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-slate-50 space-y-4">
                <div className="animate-spin text-4xl">🌀</div>
                <div className="text-slate-500 font-bold">じゅんびちゅう...</div>
            </div>
        );
    }

    if (isFinished) {
        return (
            <div className="flex flex-col items-center justify-center p-6 h-full space-y-8 animate-in zoom-in">
                <div className="text-6xl">🙌</div>
                <h2 className="text-2xl font-bold">ここまで おつかれさま</h2>
                <div className="w-full space-y-4">
                    <Button onClick={handleContinue} size="xl" className="w-full shadow-lg shadow-yellow-200">
                        つづける
                    </Button>
                    <Button onClick={() => navigate("/")} variant="secondary" size="lg" className="w-full">
                        おわる
                    </Button>
                </div>
            </div>
        )
    }

    if (!currentProblem) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-slate-50 space-y-4">
                <div className="text-4xl">😵</div>
                <div className="text-slate-500 font-bold">もんだいが つくれなかった</div>
                <Button onClick={handleContinue} size="lg">
                    もういちど
                </Button>
            </div>
        );
    }

    // 正解表示用のコンポーネント
    const renderCorrectAnswer = () => {
        if (currentProblem.inputType === 'multi-number' && Array.isArray(currentProblem.correctAnswer) && currentProblem.inputConfig?.fields) {
            // マルチ入力の場合はフィールド名と一緒に表示
            return (
                <div className="flex justify-center gap-6">
                    {currentProblem.inputConfig.fields.map((field, idx) => (
                        <div key={idx} className="flex flex-col items-center">
                            <span className="text-slate-400 text-sm font-bold mb-1">{field.label}</span>
                            <span className="text-4xl font-mono font-black text-slate-800">
                                {(currentProblem.correctAnswer as string[])[idx]}
                            </span>
                        </div>
                    ))}
                </div>
            );
        }
        // 通常の場合
        return (
            <p className="text-4xl font-mono font-black text-slate-800">
                {currentProblem.correctAnswer as string}
            </p>
        );
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden safe-area-inset-bottom">

            {/* Full Screen Feedback Overlays */}
            <AnimatePresence>
                {feedback === 'correct' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.2 }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-green-400/90 backdrop-blur-sm"
                    >
                        <motion.div
                            animate={{ rotate: [0, 10, -10, 0] }}
                            className="bg-white rounded-full p-8 shadow-2xl"
                        >
                            <div className="text-8xl text-green-500">⭕</div>
                        </motion.div>
                    </motion.div>
                )}

                {feedback === 'incorrect' && showCorrection && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-blue-500/90 backdrop-blur-md p-8"
                    >
                        <div className="bg-white/20 rounded-full p-4 mb-4">
                            <span className="text-6xl">🌱</span>
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-2">ちょっと ちがったね</h2>
                        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-xl">
                            <p className="text-slate-400 font-bold text-sm mb-4">こたえ</p>
                            {renderCorrectAnswer()}
                        </div>
                    </motion.div>
                )}

                {feedback === 'skipped' && showCorrection && (
                    <motion.div
                        initial={{ opacity: 0, x: -100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 100 }}
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-500/90 backdrop-blur-md p-8"
                    >
                        <div className="bg-white/20 rounded-full p-4 mb-4">
                            <span className="text-6xl">🌱</span>
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-2">とばして だいじょうぶ</h2>
                        <p className="text-white/80 text-sm mb-4">また でてくるよ</p>
                        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-xl">
                            <p className="text-slate-400 font-bold text-sm mb-4">こたえ</p>
                            {renderCorrectAnswer()}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <Header
                title={currentProblem.subject === 'math' ? 'さんすう' : 'えいご'}
                subtitle={currentProblem.categoryId}
                onBack={() => navigate("/")}
                rightAction={
                    <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
                        <Icons.Close className="w-6 h-6" />
                    </Button>
                }
            />

            {/* Problem Area */}
            <div {...swipeHandlers} className="flex-1 px-4 py-2 flex flex-col relative z-0 land:px-6">
                <Card className="flex-1 flex flex-col items-center justify-center p-6 shadow-xl border-t-4 border-t-yellow-300 relative land:p-4">

                    {/* Progress Indicator */}
                    <div className="absolute top-4 right-4 text-slate-300 font-bold text-sm">
                        {currentIndex + 1} / {blockSize}
                    </div>

                    {/* Skip Button (PC用) */}
                    <button
                        onClick={handleSkip}
                        disabled={feedback !== "none"}
                        className="absolute top-4 left-4 text-slate-300 hover:text-slate-500 text-sm font-bold flex items-center gap-1 disabled:opacity-30"
                    >
                        スキップ →
                    </button>

                    {/* 復習補助表示（仕様 5.3.3） */}
                    {currentProblem.isReview && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="text-slate-400 text-sm font-bold mb-4 text-center w-full"
                        >
                            🔁 まえに やったところ
                        </motion.div>
                    )}

                    {currentProblem.inputType === "number" ? (
                        <div className="w-full flex flex-col items-center gap-6 ipadland:flex-row ipadland:justify-center ipadland:gap-8">
                            <h2 className="text-6xl font-black text-slate-800 tracking-wider text-center ipadland:text-5xl ipadland:whitespace-nowrap ipadland:overflow-hidden ipadland:text-ellipsis ipadland:text-left">
                                {currentProblem.questionText}
                            </h2>
                            <div
                                className="min-w-[120px] h-20 border-b-4 border-slate-200 flex items-center justify-center text-5xl font-mono text-slate-700 bg-slate-50/50 rounded-xl px-4 transition-all"
                                style={{ width: `${Math.max(3, userInput.length) * 2.5}rem` }}
                            >
                                {userInput}
                                {!userInput && <span className="animate-pulse w-1 h-10 bg-slate-300 ml-1"></span>}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center w-full">
                            {/* Question Text */}
                            <h2 className="text-6xl font-black text-slate-800 mb-8 tracking-wider ipadland:text-5xl ipadland:whitespace-nowrap ipadland:overflow-hidden ipadland:text-ellipsis">
                                {currentProblem.questionText}
                            </h2>

                            {currentProblem.inputType === "multi-number" && currentProblem.inputConfig?.fields && (
                                <div className="mt-4">
                                    <MultiNumberInput
                                        fields={currentProblem.inputConfig.fields.map(f => ({ ...f, label: f.label || "" }))}
                                        values={userInputs}
                                        activeIndex={activeFieldIndex}
                                        onFocus={setActiveFieldIndex}
                                        readOnly={feedback !== "none"}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            </div>

            {/* Controls */}
            <div className="bg-slate-100 p-2 pb-6 rounded-t-3xl shadow-inner flex-none land:min-h-[32vh] land:pb-4">
                {/* TenKey is shared for number and multi-number */}
                {(currentProblem.inputType === "number" || currentProblem.inputType === "multi-number") && (
                    <TenKey
                        onInput={handleTenKeyInput}
                        onDelete={handleBackspace}
                        onClear={handleClear}
                        onEnter={() => handleSubmit()}
                        showDecimal={currentProblem.categoryId.startsWith("dec_")}
                        onCursorMove={handleCursorMove}
                    />
                )}

                {currentProblem.inputType === "choice" && currentProblem.inputConfig?.choices && (
                    <ChoiceGroup
                        choices={currentProblem.inputConfig.choices}
                        onSelect={(val) => handleSubmit(val)}
                        disabled={feedback !== "none"}
                    />
                )}
            </div>
        </div>
    );
};
