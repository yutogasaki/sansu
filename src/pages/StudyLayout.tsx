import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SwipeableHandlers } from "react-swipeable";
import { Header } from "../components/Header";
import { Card } from "../components/ui/Card";
import { ChoiceGroup } from "../components/domain/ChoiceGroup";
import { TenKey } from "../components/domain/TenKey";
import { MultiNumberInput } from "../components/domain/MultiNumberInput";
import { Icons } from "../components/icons";
import { Button } from "../components/ui/Button";
import { Problem } from "../domain/types";
import { LayoutDebugOverlay } from "../components/LayoutDebugOverlay";
import { MathRenderer } from "../components/domain/MathRenderer";

type SessionKind = "normal" | "review" | "weak" | "check-normal" | "check-event";

interface StudyLayoutProps {
    loading: boolean;
    isFinished: boolean;
    currentProblem?: Problem;
    currentIndex: number;
    blockSize: number;
    userInput: string;
    userInputs: string[];
    activeFieldIndex: number;
    feedback: "none" | "correct" | "incorrect" | "skipped";
    showCorrection: boolean;

    // Session info for result display
    sessionKind?: SessionKind;
    correctCount?: number;

    // Handlers
    onNavigate: (path: string) => void;
    onContinue: () => void;
    onSkip: () => void;

    // TenKey / Inputs
    onTenKeyInput: (val: string | number) => void;
    onBackspace: () => void;
    onClear: () => void;
    onEnter: () => void;
    onCursorMove: (direction: "left" | "right") => void;

    // Choice / Focus
    onSubmitChoice: (val: string) => void;
    onFocusField: (index: number) => void;

    swipeHandlers: SwipeableHandlers;
}

export const StudyLayout: React.FC<StudyLayoutProps> = ({
    loading,
    isFinished,
    currentProblem,
    sessionKind = "normal",
    correctCount = 0,
    currentIndex,
    blockSize,
    userInput,
    userInputs,
    activeFieldIndex,
    feedback,
    showCorrection,
    onNavigate,
    onContinue,
    onSkip,
    onTenKeyInput,
    onBackspace,
    onClear,
    onEnter,
    onCursorMove,
    onSubmitChoice,
    onFocusField,
    swipeHandlers
}) => {
    const showDebugSubtitle = import.meta.env.DEV;

    // 正解表示用のヘルパー
    const renderCorrectAnswer = () => {
        if (!currentProblem) return null;

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

    // Loading state
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-slate-50 space-y-4">
                <div className="animate-spin text-4xl">🌀</div>
                <div className="text-slate-500 font-bold">じゅんびちゅう...</div>
            </div>
        );
    }

    if (isFinished) {
        // ちからチェック結果表示
        if (sessionKind === "check-normal" || sessionKind === "check-event") {
            const isEvent = sessionKind === "check-event";
            const ratio = blockSize > 0 ? correctCount / blockSize : 0;
            const isGood = ratio >= 0.6; // 60%以上で「よくできた」

            return (
                <div className="flex flex-col items-center justify-center p-6 h-full space-y-8 animate-in zoom-in bg-gradient-to-b from-slate-50 to-white">
                    <div className="text-6xl">{isEvent ? "🎉" : (isGood ? "👍" : "🔁")}</div>
                    <h2 className="text-2xl font-bold text-center">
                        {isEvent
                            ? "ここまで よく がんばったね"
                            : (isGood ? "よく できたね" : "もう いちど やってみよ")
                        }
                    </h2>
                    <div className="text-center text-slate-500">
                        <span className="text-4xl font-bold text-slate-700">{correctCount}</span>
                        <span className="text-lg"> / {blockSize} もん</span>
                    </div>
                    <div className="w-full space-y-4 max-w-xs">
                        <Button onClick={() => onNavigate("/stats")} size="xl" className="w-full shadow-lg shadow-yellow-200">
                            きろく を みる
                        </Button>
                        <Button onClick={() => onNavigate("/")} variant="secondary" size="lg" className="w-full">
                            ホーム へ もどる
                        </Button>
                    </div>
                </div>
            );
        }

        // 通常完了画面
        return (
            <div className="flex flex-col items-center justify-center p-6 h-full space-y-8 animate-in zoom-in">
                <div className="text-6xl">🙌</div>
                <h2 className="text-2xl font-bold">ここまで おつかれさま</h2>
                <div className="w-full space-y-4">
                    <Button onClick={onContinue} size="xl" className="w-full shadow-lg shadow-yellow-200">
                        つづける
                    </Button>
                    <Button onClick={() => onNavigate("/")} variant="secondary" size="lg" className="w-full">
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
                <Button onClick={onContinue} size="lg">
                    もういちど
                </Button>
            </div>
        );
    }


    return (
        <div className="flex flex-col h-[100dvh] bg-slate-50 relative overflow-hidden safe-area-inset-bottom">
            <LayoutDebugOverlay />

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

            {/* Header: モバイルでは非表示 */}
            <div id="debug-header" className="flex-none mobile:hidden">
                <Header
                    title={currentProblem.subject === 'math' ? 'さんすう' : 'えいご'}
                    subtitle={showDebugSubtitle ? currentProblem.categoryId : undefined}
                    onBack={() => onNavigate("/")}
                    rightAction={
                        <Button variant="ghost" size="sm" onClick={() => onNavigate("/")}>
                            <Icons.Close className="w-6 h-6" />
                        </Button>
                    }
                />
            </div>

            {/* モバイル専用: 統合トップバー */}
            <div className="hidden mobile:flex items-center justify-between px-3 py-1 bg-white border-b border-slate-100">
                <button
                    onClick={onSkip}
                    disabled={feedback !== "none"}
                    className="text-slate-400 hover:text-slate-600 text-xs font-bold disabled:opacity-30"
                >
                    スキップ→
                </button>
                {currentProblem.isReview && (
                    <span className="text-slate-400 text-xs">🔁</span>
                )}
                <span className="text-slate-300 font-bold text-xs">
                    {currentIndex + 1}/{blockSize}
                </span>
                <button
                    onClick={() => onNavigate("/")}
                    className="text-slate-400 hover:text-slate-600"
                >
                    <Icons.Close className="w-5 h-5" />
                </button>
            </div>

            {/* Main Area: Mobile=Vertical, iPad=Horizontal */}
            <div className="flex-1 flex flex-col ipadland:flex-row ipadland:p-6 ipadland:gap-4 overflow-hidden min-h-0 [--tenkey-key:clamp(44px,9vh,56px)]">

                {/* Question / Card Area */}
                {/* Mobile: flex-1 but with shrink allowed. ipadland:flex-[2] */}
                <div id="debug-card-container" {...swipeHandlers} className="flex-1 px-4 py-2 flex flex-col relative z-0 land:px-6 ipadland:flex-[2] ipadland:p-0 mobile:px-1 mobile:py-1 min-h-[200px] mobile:min-h-[35vh] ipadland:min-h-0">
                    <Card className="flex-1 flex flex-col items-center justify-center p-6 shadow-xl border-t-4 border-t-yellow-300 relative land:p-4 bg-white mobile:p-2 mobile:border-t-2 mobile:shadow-none overflow-hidden min-h-0">

                        {/* Progress Indicator - モバイルでは上部バーに移動したので非表示 */}
                        <div className="absolute top-4 right-4 text-slate-300 font-bold text-sm mobile:hidden">
                            {currentIndex + 1} / {blockSize}
                        </div>

                        {/* Skip Button - モバイルでは上部バーに移動したので非表示 */}
                        <button
                            onClick={onSkip}
                            disabled={feedback !== "none"}
                            className="absolute top-4 left-4 text-slate-300 hover:text-slate-500 text-sm font-bold flex items-center gap-1 disabled:opacity-30 mobile:hidden"
                        >
                            スキップ →
                        </button>

                        {/* 復習補助表示 - モバイルでは上部バーに移動したので非表示 */}
                        {currentProblem.isReview && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.5 }}
                                className="text-slate-400 text-sm font-bold mb-4 text-center w-full mobile:hidden"
                            >
                                🔁 まえに やったところ
                            </motion.div>
                        )}

                        {/* Question Content */}
                        {currentProblem.inputType === "number" ? (
                            <div className="w-full flex-1 flex flex-col items-center justify-center gap-6 ipadland:flex-col ipadland:items-center ipadland:gap-12 mobile:flex-row mobile:gap-3 mobile:justify-center">
                                <div className="text-slate-800 font-black tracking-wider text-center max-w-full overflow-hidden mobile:flex-shrink-0">
                                    {/* Font Size Control: Normal vs Fraction */}
                                    {/* Fraction uses stricter clamp and renderer */}
                                    <MathRenderer
                                        text={currentProblem.questionText || ""}
                                        isFraction={currentProblem.categoryId.startsWith("frac_")}
                                        className={currentProblem.categoryId.startsWith("frac_")
                                            ? "text-[clamp(28px,7vw,56px)] ipadland:text-7xl"
                                            : "text-[clamp(28px,8vw,64px)] ipadland:text-8xl mobile:text-4xl"
                                        }
                                    />
                                </div>
                                {/* Input Preview */}
                                <div
                                    className="min-w-[120px] h-20 border-b-4 border-slate-200 flex items-center justify-center text-5xl font-mono text-slate-700 bg-slate-50/50 rounded-xl px-4 transition-all ipadland:h-32 ipadland:text-7xl ipadland:min-w-[200px] mobile:h-12 mobile:text-3xl mobile:min-w-[80px] mobile:px-2 mobile:flex-shrink"
                                    style={{ width: `${Math.max(3, userInput.length) * 2.5}rem` }}
                                >
                                    {userInput}
                                    {!userInput && <span className="animate-pulse w-1 h-10 bg-slate-300 ml-1 mobile:h-6"></span>}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center w-full flex-1 flex flex-col items-center justify-center gap-2 ipadland:flex-col ipadland:gap-8 mobile:flex-row mobile:gap-3 mobile:justify-center">
                                {/* Question Text */}
                                <div className="mb-2 ipadland:mb-0 max-w-full overflow-hidden mobile:mb-0 mobile:flex-shrink-0">
                                    <MathRenderer
                                        text={currentProblem.questionText || ""}
                                        isFraction={currentProblem.categoryId.startsWith("frac_")}
                                        className={currentProblem.categoryId.startsWith("frac_")
                                            ? "text-[clamp(24px,6vw,56px)] ipadland:text-7xl text-slate-800 font-black tracking-wider"
                                            : "text-[clamp(28px,8vw,64px)] ipadland:text-7xl mobile:text-4xl text-slate-800 font-black tracking-wider"
                                        }
                                    />
                                </div>

                                {currentProblem.inputType === "multi-number" && currentProblem.inputConfig?.fields && (
                                    <div className="ipadland:mt-0 mobile:flex-shrink">
                                        <MultiNumberInput
                                            fields={currentProblem.inputConfig.fields.map(f => ({ ...f, label: f.label || "" }))}
                                            values={userInputs}
                                            activeIndex={activeFieldIndex}
                                            onFocus={onFocusField}
                                            readOnly={feedback !== "none"}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Controls Area */}
                {/* Mobile: Removed padding/margin to prevent overflow. Fixed safe area is handled by safe-area-inset-bottom class on root. */}
                <div id="debug-controls" className="bg-slate-100 p-2 pb-6 rounded-t-3xl shadow-inner flex-1 min-h-0 mobile:min-h-[240px] mobile:max-h-[340px] land:min-h-[32vh] land:pb-4 ipadland:flex-1 ipadland:rounded-3xl ipadland:h-full ipadland:flex ipadland:flex-col ipadland:justify-center ipadland:p-6 ipadland:shadow-lg ipadland:min-h-0 ipadland:max-h-none mobile:pb-[var(--safe-area-inset-bottom)] mobile:pt-0 mobile:p-0 mobile:rounded-none mobile:bg-slate-50">
                    {/* TenKey / Inputs */}
                    {(currentProblem.inputType === "number" || currentProblem.inputType === "multi-number") && (
                        <TenKey
                            onInput={onTenKeyInput}
                            onDelete={onBackspace}
                            onClear={onClear}
                            onEnter={onEnter}
                            showDecimal={currentProblem.subject === 'math'}
                            onCursorMove={onCursorMove}
                        />
                    )}

                    {currentProblem.inputType === "choice" && currentProblem.inputConfig?.choices && (
                        <ChoiceGroup
                            choices={currentProblem.inputConfig.choices}
                            onSelect={onSubmitChoice}
                            disabled={feedback !== "none"}
                        />
                    )}
                </div>

            </div>
        </div>
    );
};
