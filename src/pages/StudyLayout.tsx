import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { speakEnglish } from "../utils/tts";
import { HiSpeakerWave } from "react-icons/hi2";
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
import { Spinner } from "../components/ui/Spinner";
import { EmptyState } from "../components/ui/EmptyState";
import { HissanGrid } from "../components/domain/HissanGrid";
import { HissanGridData } from "../domain/math/hissanTypes";

type SessionKind = "normal" | "review" | "weak" | "check-normal" | "check-event" | "weak-review" | "periodic-test" | "dev";

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
    sessionResult?: { correct: number; total: number; durationSeconds: number };
    testTimeLimitSeconds?: number;
    testRemainingSeconds?: number;

    // Handlers
    onNavigate: (path: string) => void;
    onContinue: () => void;
    onNext: () => void;
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
    englishAutoRead?: boolean;
    isEasyText?: boolean;
    onToggleTTS?: () => void;

    // 筆算モード
    hissanActive?: boolean;
    hissanEligible?: boolean;
    hissanGridData?: HissanGridData | null;
    hissanStepIndex?: number;
    hissanActiveCellPos?: [number, number] | null;
    hissanUserValues?: Map<string, string>;
    hissanStepFeedback?: 'none' | 'correct' | 'incorrect';
    onHissanCellClick?: (rowIndex: number, colIndex: number) => void;
    onHissanToggle?: () => void;
}

export const StudyLayout: React.FC<StudyLayoutProps> = ({
    loading,
    isFinished,
    currentProblem,
    sessionKind = "normal",
    correctCount = 0,
    sessionResult,
    testTimeLimitSeconds,
    testRemainingSeconds,
    currentIndex,
    blockSize,
    userInput,
    userInputs,
    activeFieldIndex,
    feedback,
    showCorrection,
    onNavigate,
    onContinue,
    onNext,
    onSkip,
    onTenKeyInput,
    onBackspace,
    onClear,
    onEnter,
    onCursorMove,
    onSubmitChoice,
    onFocusField,
    swipeHandlers,
    englishAutoRead = false,
    isEasyText = false,
    onToggleTTS,
    // 筆算モード
    hissanActive = false,
    hissanEligible = false,
    hissanGridData,
    hissanStepIndex = 0,
    hissanActiveCellPos = null,
    hissanUserValues = new Map(),
    hissanStepFeedback = 'none',
    onHissanCellClick,
    onHissanToggle,
}) => {
    const t = (easy: string, standard: string) => (isEasyText ? easy : standard);
    const formatTimer = (seconds: number) => {
        const safe = Math.max(0, seconds);
        const m = Math.floor(safe / 60);
        const s = safe % 60;
        return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };
    const showTestTimer = sessionKind === "periodic-test" && typeof testTimeLimitSeconds === "number" && typeof testRemainingSeconds === "number";
    const vocabQuestionText = currentProblem?.subject === 'vocab' ? currentProblem.questionText : undefined;
    // Auto-TTS Effect
    React.useEffect(() => {
        if (englishAutoRead && vocabQuestionText) {
            // Slight delay to allow transition? 
            // Or immediate. Immediate is fine as long as user interaction logic is safe.
            // Check if not already speaking? 
            // speakEnglish cancels previous.

            // Should play ONLY when problem first appears (feedback === 'none').
            if (feedback === 'none') {
                speakEnglish(vocabQuestionText);
            }
        }
    }, [currentProblem?.id, englishAutoRead, feedback, vocabQuestionText]);

    // 正解表示用のヘルパー
    const renderCorrectAnswer = () => {
        if (!currentProblem) return null;

        // 優先表示: displayAnswerがあればそれを使う（英語の日本語訳など）
        // ただしマルチ入力などで特殊な表示が必要な場合は別途考慮（現状はシンプルに上書きでOK）
        if (currentProblem.displayAnswer) {
            return (
                <p className="text-4xl font-bold text-slate-800">
                    {currentProblem.displayAnswer}
                </p>
            );
        }

        if (currentProblem.categoryId.startsWith("frac_") || currentProblem.categoryId.startsWith("div_rem")) {
            // 分数または割り算のあまりの場合
            // 配列の形に応じて文字列を構築
            let answerText = "";
            const ansArr = currentProblem.correctAnswer as string[];

            if (currentProblem.categoryId.startsWith("frac_")) {
                // 分数
                if (ansArr.length === 2) {
                    // 分子/分母
                    answerText = `${ansArr[0]}/${ansArr[1]}`;
                } else if (ansArr.length === 3) {
                    // 整数 分子/分母
                    answerText = `${ansArr[0]} ${ansArr[1]}/${ansArr[2]}`;
                }
            } else if (currentProblem.categoryId.startsWith("div_rem")) {
                // 割り算あまり
                if (ansArr.length === 2) {
                    // 商 あまり 余り
                    answerText = `${ansArr[0]} あまり ${ansArr[1]}`;
                }
            }

            if (answerText) {
                return (
                    <div className="flex justify-center">
                        <MathRenderer
                            text={answerText}
                            isFraction={currentProblem.categoryId.startsWith("frac_")}
                            className="text-4xl text-slate-800 font-bold"
                        />
                    </div>
                );
            }
        }

        if (currentProblem.inputType === 'multi-number' && Array.isArray(currentProblem.correctAnswer) && currentProblem.inputConfig?.fields) {
            // マルチ入力の場合はフィールド名と一緒に表示 (フォールバック)
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
            <Spinner
                message={t("じゅんびちゅう...", "準備中...")}
                fullScreen
                className="bg-transparent"
            />
        );
    }

    if (isFinished) {
        if (sessionKind === "periodic-test" && sessionResult) {
            const score = sessionResult.total > 0
                ? Math.round((sessionResult.correct / sessionResult.total) * 100)
                : 0;

            return (
                <div className="flex flex-col items-center justify-center p-6 h-full space-y-8 animate-in zoom-in">
                    <div className="text-6xl">✨</div>
                    <h2 className="text-2xl font-bold text-center">定期テスト おつかれさま</h2>
                    <div className="app-glass-strong rounded-2xl p-6 w-full max-w-sm text-center space-y-4">
                        <div>
                            <div className="text-xs text-slate-400 font-bold">せいかい</div>
                            <div className="text-4xl font-black text-slate-800">
                                {sessionResult.correct} / {sessionResult.total}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-400 font-bold">てんすう</div>
                            <div className="text-3xl font-black text-slate-800">{score}てん</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-400 font-bold">じかん</div>
                            <div className="text-2xl font-bold text-slate-700">{sessionResult.durationSeconds}びょう</div>
                        </div>
                    </div>
                    <div className="w-full space-y-4 max-w-xs">
                        <Button onClick={() => onNavigate("/stats")} size="xl" className="w-full shadow-lg shadow-yellow-200">
                            {t("きろく を みる", "記録を見る")}
                        </Button>
                        <Button onClick={() => onNavigate("/")} variant="secondary" size="lg" className="w-full">
                            {t("ホーム へ もどる", "ホームへ戻る")}
                        </Button>
                    </div>
                </div>
            );
        }
        // ちからチェック結果表示
        if (sessionKind === "check-normal" || sessionKind === "check-event") {
            const isEvent = sessionKind === "check-event";
            const ratio = blockSize > 0 ? correctCount / blockSize : 0;
            const isGood = ratio >= 0.6; // 60%以上で「よくできた」

            return (
                <div className="flex flex-col items-center justify-center p-6 h-full space-y-8 animate-in zoom-in">
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
                            {t("きろく を みる", "記録を見る")}
                        </Button>
                        <Button onClick={() => onNavigate("/")} variant="secondary" size="lg" className="w-full">
                            {t("ホーム へ もどる", "ホームへ戻る")}
                        </Button>
                    </div>
                </div>
            );
        }

        // Standard 100-question celebration
        const isMilestone = currentIndex > 0 && currentIndex % 100 === 0;

        return (
            <div className="flex flex-col items-center justify-center p-6 h-full space-y-8 animate-in zoom-in">
                <div className="text-6xl">{isMilestone ? "🎉" : "☕"}</div>
                <h2 className="text-2xl font-bold">
                    {isMilestone ? `${currentIndex}もん クリア！` : "すこし やすもう"}
                </h2>
                <div className="text-center text-slate-500">
                    <span className="text-4xl font-bold text-slate-700">{currentIndex}</span>
                    <span className="text-lg"> もん クリア！</span>
                </div>
                {isMilestone && (
                    <p className="text-slate-400 font-bold">すごい！ がんばったね！</p>
                )}
                <div className="w-full space-y-4">
                    <Button onClick={() => {
                        onContinue();
                    }} size="xl" className="w-full shadow-lg shadow-primary/30">
                        まだまだ やる！
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
            <EmptyState
                message={t("もんだいが つくれなかった", "問題を作成できませんでした")}
                actionLabel={t("もういちど", "再試行")}
                onAction={onContinue}
                fullScreen
                className="bg-transparent"
            />
        );
    }


    return (
        <div className="flex flex-col h-[100dvh] relative overflow-hidden safe-area-inset-bottom">
            {import.meta.env.DEV && <LayoutDebugOverlay />}

            {/* Full Screen Feedback Overlays */}
            <AnimatePresence>
                {feedback === 'incorrect' && showCorrection && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-blue-500/95 backdrop-blur-md p-6"
                    >
                        <div className="bg-white/20 rounded-full p-4 mb-2">
                            <span className="text-5xl">🌱</span>
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-6">{t("ちょっと ちがったね", "惜しい！")}</h2>

                        {/* Question Display */}
                        <div className="mb-6 bg-white/10 rounded-xl p-4 w-full max-w-sm flex justify-center">
                            <MathRenderer
                                text={currentProblem?.questionText || ""}
                                isFraction={currentProblem?.categoryId.startsWith("frac_")}
                                className="text-3xl text-white font-bold"
                            />
                        </div>

                        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-xl mb-8">
                            <p className="text-slate-400 font-bold text-sm mb-4">{t("こたえ", "答え")}</p>
                            {renderCorrectAnswer()}
                        </div>

                        <Button
                            onClick={onNext}
                            size="lg"
                            className="bg-white text-blue-600 hover:bg-white/90 shadow-lg w-full max-w-xs text-xl font-bold h-16"
                        >
                            {t("つぎへ", "次へ")}
                        </Button>
                    </motion.div>
                )}

                {feedback === 'skipped' && showCorrection && (
                    <motion.div
                        initial={{ opacity: 0, x: -100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 100 }}
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-600/90 backdrop-blur-md p-6"
                    >
                        <div className="bg-white/20 rounded-full p-4 mb-2">
                            <span className="text-5xl">🌱</span>
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-2">{t("とばして だいじょうぶ", "スキップOK")}</h2>
                        <p className="text-white/80 text-sm mb-6">{t("また でてくるよ", "また出題されます")}</p>

                        {/* Question Display */}
                        <div className="mb-6 bg-white/10 rounded-xl p-4 w-full max-w-sm flex justify-center">
                            <MathRenderer
                                text={currentProblem?.questionText || ""}
                                isFraction={currentProblem?.categoryId.startsWith("frac_")}
                                className="text-3xl text-white font-bold"
                            />
                        </div>

                        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-xl mb-8">
                            <p className="text-slate-400 font-bold text-sm mb-4">{t("こたえ", "答え")}</p>
                            {renderCorrectAnswer()}
                        </div>

                        <Button
                            onClick={onNext}
                            size="lg"
                            className="bg-white text-slate-600 hover:bg-white/90 shadow-lg w-full max-w-xs text-xl font-bold h-16"
                        >
                            {t("つぎへ", "次へ")}
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header: モバイルでは非表示 */}
            <div id="debug-header" className="flex-none mobile:hidden">
                <Header
                    title={currentProblem.subject === 'math' ? t('さんすう', '算数') : t('えいご', '英語')}
                    onBack={() => onNavigate("/")}
                    center={
                        <div className="flex items-center gap-3">
                            <span className="text-slate-400 font-bold text-lg">
                                {currentIndex + 1} 問目
                            </span>
                            {showTestTimer && (
                                <span className={`text-sm font-black px-2 py-1 rounded-full ${testRemainingSeconds <= 60 ? "bg-rose-100 text-rose-700" : "bg-white/75 text-slate-600 border border-white/80"}`}>
                                    {formatTimer(testRemainingSeconds)}
                                </span>
                            )}
                        </div>
                    }
                    rightAction={
                        <Button variant="ghost" size="sm" onClick={() => onNavigate("/")}>
                            <Icons.Close className="w-6 h-6" />
                        </Button>
                    }
                />
            </div>

            {/* モバイル専用: 統合トップバー */}
            <div className="hidden mobile:flex items-center justify-between px-3 py-1 app-glass-strong rounded-b-2xl border-b border-white/75">
                {currentProblem.isReview && (
                    <span className="text-slate-400 text-xs">🔁</span>
                )}
                <div className="flex items-center gap-2">
                    <span className="text-slate-300 font-bold text-xs">
                        {currentIndex + 1} 問目
                    </span>
                    {showTestTimer && (
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${testRemainingSeconds <= 60 ? "bg-rose-100 text-rose-700" : "bg-white/75 text-slate-600 border border-white/80"}`}>
                            {formatTimer(testRemainingSeconds)}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {/* 筆算/暗算 切替トグル */}
                    {hissanEligible && onHissanToggle && (
                        <button
                            onClick={onHissanToggle}
                            className={`px-2 py-0.5 rounded-full text-xs font-bold transition-colors border ${hissanActive
                                    ? 'bg-violet-100 text-violet-600 border-violet-200'
                                    : 'bg-white/70 text-slate-400 border-white/80'
                                }`}
                            title={hissanActive ? '筆算モード ON' : '暗算モード'}
                        >
                            {hissanActive ? '···' : '···'}
                        </button>
                    )}
                    {currentProblem.subject === 'vocab' && onToggleTTS && (
                        <button
                            onClick={onToggleTTS}
                            className={`p-1 rounded-full transition-colors ${englishAutoRead ? 'bg-primary/20 text-primary' : 'text-slate-300'}`}
                            title={englishAutoRead ? '自動読み上げ ON' : '自動読み上げ OFF'}
                        >
                            <HiSpeakerWave className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={() => onNavigate("/")}
                        className="text-slate-400 hover:text-slate-600"
                    >
                        <Icons.Close className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Main Area: Mobile=Vertical, iPad=Horizontal */}
            <div className="flex-1 flex flex-col ipadland:flex-row ipadland:p-6 ipadland:gap-4 overflow-hidden min-h-0 [--tenkey-key:clamp(44px,9vh,56px)]">

                {/* Question / Card Area */}
                {/* Mobile: Use flex-1 with min-h-0 to allow shrinking if controls need space */}
                <div id="debug-card-container" {...swipeHandlers} className="flex-1 min-h-0 px-4 py-2 flex flex-col justify-center relative z-0 land:px-6 ipadland:flex-[2] ipadland:p-0 mobile:px-1 mobile:py-1 ipadland:min-h-0">
                    <Card className="w-full flex flex-col items-center justify-center p-6 border-t-4 border-t-primary relative land:p-4 mobile:p-4 mobile:border-t-2 mobile:shadow-none overflow-hidden min-h-0">

                        {/* Compact correct feedback overlay on card */}
                        <AnimatePresence>
                            {feedback === 'correct' && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.6 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 1.1 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute inset-0 z-20 flex items-center justify-center bg-green-400/85 rounded-[inherit]"
                                >
                                    <motion.div
                                        animate={{ rotate: [0, 8, -8, 0] }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <div className="text-7xl text-white drop-shadow-lg mobile:text-6xl">⭕</div>
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Top row: review badge (left) + skip button (right) */}
                        <div className="absolute top-2 left-3 right-3 flex items-center justify-between z-10 mobile:top-1 mobile:left-2 mobile:right-2">
                            <AnimatePresence>
                                {currentProblem.isReview ? (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className="bg-amber-100 text-amber-600 px-3 py-1 rounded-full text-xs font-bold shadow-sm border border-amber-200 flex items-center gap-1"
                                    >
                                        <span>🔁</span>
                                        <span>{t("復習", "復習")}</span>
                                    </motion.div>
                                ) : <div />}
                            </AnimatePresence>
                            {feedback === "none" && (
                                <button
                                    onClick={onSkip}
                                    className="px-3 py-1 rounded-full text-xs font-bold text-slate-500 bg-white/70 hover:bg-white active:scale-95 transition-all border border-white/80"
                                >
                                    {t("スキップ", "スキップ")}
                                </button>
                            )}
                        </div>

                        {/* Question Content */}
                        {hissanActive && hissanGridData ? (
                            /* 筆算モード: グリッド表示 */
                            <div className="w-full flex-1 flex flex-col items-center justify-center gap-2 overflow-auto min-h-0">
                                {/* 筆算モードトグル（デスクトップ） */}
                                {hissanEligible && onHissanToggle && (
                                    <div className="mobile:hidden">
                                        <button
                                            onClick={onHissanToggle}
                                            className="px-3 py-1 rounded-full text-xs font-bold bg-violet-100 text-violet-600 border border-violet-200 hover:bg-violet-200 transition-colors"
                                        >
                                            ··· → 暗算に切替
                                        </button>
                                    </div>
                                )}
                                <HissanGrid
                                    gridData={hissanGridData}
                                    currentStepIndex={hissanStepIndex}
                                    activeCellPos={hissanActiveCellPos}
                                    userValues={hissanUserValues}
                                    onCellClick={onHissanCellClick || (() => { })}
                                    stepFeedback={hissanStepFeedback}
                                />
                            </div>
                        ) : currentProblem.inputType === "number" ? (
                            <div className={`w-full flex-1 flex flex-col items-center justify-center gap-6 ipadland:flex-col ipadland:items-center ipadland:gap-12 mobile:gap-3 mobile:justify-center ${currentProblem.categoryId.startsWith("frac_") ? "mobile:flex-col" : "mobile:flex-row"
                                }`}>
                                <div className="text-slate-800 font-black tracking-wider text-center max-w-full overflow-hidden mobile:flex-shrink-0">
                                    {/* Font Size Control: Normal vs Fraction */}
                                    {/* Fraction uses stricter clamp and renderer */}
                                    <MathRenderer
                                        text={currentProblem.questionText || ""}
                                        isFraction={currentProblem.categoryId.startsWith("frac_")}
                                        className={currentProblem.categoryId.startsWith("frac_")
                                            ? "text-[clamp(40px,11vw,80px)] ipadland:text-7xl"
                                            : "text-[clamp(28px,8vw,64px)] ipadland:text-8xl mobile:text-4xl"
                                        }
                                    />
                                </div>
                                {/* Input Preview */}
                                <div
                                    className="min-w-[120px] h-20 border-b-4 border-white/80 flex items-center justify-center text-5xl font-mono text-slate-700 bg-white/60 rounded-xl px-4 transition-all ipadland:h-32 ipadland:text-7xl ipadland:min-w-[200px] mobile:h-12 mobile:text-3xl mobile:min-w-[80px] mobile:px-2 mobile:flex-shrink"
                                    style={{ width: `${Math.max(3, userInput.length) * 2.5}rem` }}
                                >
                                    {userInput}
                                    {!userInput && <span className="animate-pulse w-1 h-10 bg-slate-400/60 ml-1 mobile:h-6"></span>}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center w-full flex-1 flex flex-col items-center justify-center gap-2 ipadland:flex-col ipadland:gap-8 mobile:flex-row mobile:gap-3 mobile:justify-center">
                                {/* Question Text */}

                                <div className="mb-2 ipadland:mb-0 max-w-full overflow-hidden mobile:mb-0 mobile:flex-shrink-0 flex items-center justify-center gap-2">
                                    <MathRenderer
                                        text={currentProblem.questionText || ""}
                                        isFraction={currentProblem.categoryId.startsWith("frac_")}
                                        className={currentProblem.categoryId.startsWith("frac_")
                                            ? "text-[clamp(24px,6vw,56px)] ipadland:text-7xl text-slate-800 font-black tracking-wider"
                                            : "text-[clamp(28px,8vw,64px)] ipadland:text-7xl mobile:text-4xl text-slate-800 font-black tracking-wider"
                                        }
                                    />
                                    {/* TTS Button for English */}
                                    {currentProblem.subject === 'vocab' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                speakEnglish(currentProblem.questionText || "");
                                            }}
                                            className="ml-2 p-2 bg-white/75 hover:bg-white text-slate-500 rounded-full border border-white/80 transition-colors active:scale-95"
                                            title="読み上げ"
                                        >
                                            <HiSpeakerWave className="w-6 h-6 mobile:w-5 mobile:h-5" />
                                        </button>
                                    )}
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
                <div id="debug-controls" className="app-glass p-2 pb-6 rounded-t-[2rem] flex-1 max-h-[44vh] min-h-[220px] land:min-h-[32vh] land:pb-4 ipadland:rounded-[2rem] ipadland:h-full ipadland:flex ipadland:flex-col ipadland:justify-center ipadland:p-6 ipadland:min-h-0 ipadland:max-h-none mobile:pb-[var(--safe-area-inset-bottom)] mobile:pt-0 mobile:p-0 mobile:rounded-none mobile:bg-white/35">
                    {/* TenKey / Inputs */}
                    {(currentProblem.inputType === "number" || currentProblem.inputType === "multi-number" || hissanActive) && (
                        <TenKey
                            onInput={onTenKeyInput}
                            onDelete={onBackspace}
                            onClear={onClear}
                            onEnter={onEnter}
                            showDecimal={currentProblem.subject === 'math' && !hissanActive}
                            onCursorMove={currentProblem.inputType === "multi-number" && !hissanActive ? onCursorMove : undefined}
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
