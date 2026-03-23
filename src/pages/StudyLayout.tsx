import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { speakEnglish } from "../utils/tts";
import { HiSpeakerWave } from "react-icons/hi2";
import { SwipeableHandlers } from "react-swipeable";
import { Header } from "../components/Header";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { ChoiceGroup } from "../components/domain/ChoiceGroup";
import { TenKey } from "../components/domain/TenKey";
import { MultiNumberInput } from "../components/domain/MultiNumberInput";
import { Icons } from "../components/icons";
import { Button } from "../components/ui/Button";
import { InsetPanel, SurfacePanel, SurfacePanelHeader } from "../components/ui/SurfacePanel";
import { Problem } from "../domain/types";
import { LayoutDebugOverlay } from "../components/LayoutDebugOverlay";
import { MathRenderer } from "../components/domain/MathRenderer";
import { MathProblemPrompt } from "../components/domain/MathProblemPrompt";
import { Spinner } from "../components/ui/Spinner";
import { EmptyState } from "../components/ui/EmptyState";
import { HissanGrid } from "../components/domain/HissanGrid";
import { HissanGridData } from "../domain/math/hissanTypes";
import { cn } from "../utils/cn";

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

interface ResultMetricProps {
    label: string;
    value: React.ReactNode;
    tone?: "default" | "sky" | "mint";
}

const resultMetricToneClassMap: Record<NonNullable<ResultMetricProps["tone"]>, string> = {
    default: "text-slate-800",
    sky: "text-sky-700",
    mint: "text-emerald-700",
};

const ResultMetric: React.FC<ResultMetricProps> = ({ label, value, tone = "default" }) => (
    <InsetPanel className="space-y-1 py-4 text-center">
        <div className={`text-2xl font-black tracking-[-0.04em] ${resultMetricToneClassMap[tone]}`}>
            {value}
        </div>
        <div className="text-[11px] font-bold tracking-[0.1em] text-slate-500">{label}</div>
    </InsetPanel>
);

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
                <div className="flex h-full items-center justify-center p-6 animate-in zoom-in">
                    <SurfacePanel className="w-full max-w-md space-y-5 text-center">
                        <Badge variant="primary" className="mx-auto">ていき テスト</Badge>
                        <SurfacePanelHeader
                            className="justify-center text-center"
                            title="ていきテスト おつかれさま"
                            description="けっかを みて つぎのペースを きめよう"
                        />
                        <div className="grid grid-cols-3 gap-2">
                            <ResultMetric
                                label="せいかい"
                                value={`${sessionResult.correct}/${sessionResult.total}`}
                                tone="sky"
                            />
                            <ResultMetric label="てんすう" value={`${score}てん`} tone="mint" />
                            <ResultMetric label="じかん" value={`${sessionResult.durationSeconds}びょう`} />
                        </div>
                        <div className="space-y-3">
                            <Button onClick={() => onNavigate("/stats")} size="xl" className="w-full shadow-lg shadow-yellow-200">
                                {t("きろく を みる", "記録を見る")}
                            </Button>
                            <Button onClick={() => onNavigate("/")} variant="secondary" size="lg" className="w-full">
                                {t("ホーム へ もどる", "ホームへ戻る")}
                            </Button>
                        </div>
                    </SurfacePanel>
                </div>
            );
        }
        // ちからチェック結果表示
        if (sessionKind === "check-normal" || sessionKind === "check-event") {
            const isEvent = sessionKind === "check-event";
            const ratio = blockSize > 0 ? correctCount / blockSize : 0;
            const accuracy = Math.round(ratio * 100);
            const isGood = ratio >= 0.6; // 60%以上で「よくできた」

            return (
                <div className="flex h-full items-center justify-center p-6 animate-in zoom-in">
                    <SurfacePanel className="w-full max-w-md space-y-5 text-center">
                        <Badge variant={isEvent || isGood ? "success" : "warning"} className="mx-auto">
                            {isEvent ? "イベント チェック" : "ちから チェック"}
                        </Badge>
                        <SurfacePanelHeader
                            className="justify-center text-center"
                            title={
                                isEvent
                                    ? "ここまで よく がんばったね"
                                    : (isGood ? "よく できたね" : "もう いちど やってみよ")
                            }
                            description={
                                isEvent
                                    ? "つぎのステップへ すすむ じゅんびが できたよ"
                                    : (isGood ? "このペースで つぎへ すすめるよ" : "もうすこし かんたんなところから やっていこう")
                            }
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <ResultMetric label="せいかい" value={`${correctCount}/${blockSize}`} tone="sky" />
                            <ResultMetric label="せいかいりつ" value={`${accuracy}%`} tone="mint" />
                        </div>
                        <div className="space-y-3">
                            <Button onClick={() => onNavigate("/stats")} size="xl" className="w-full shadow-lg shadow-yellow-200">
                                {t("きろく を みる", "記録を見る")}
                            </Button>
                            <Button onClick={() => onNavigate("/")} variant="secondary" size="lg" className="w-full">
                                {t("ホーム へ もどる", "ホームへ戻る")}
                            </Button>
                        </div>
                    </SurfacePanel>
                </div>
            );
        }

        // Standard 100-question celebration
        const isMilestone = currentIndex > 0 && currentIndex % 100 === 0;

        return (
            <div className="flex h-full items-center justify-center p-6 animate-in zoom-in">
                <SurfacePanel className="w-full max-w-md space-y-5 text-center">
                    <Badge variant={isMilestone ? "success" : "neutral"} className="mx-auto">
                        {isMilestone ? "100もん ごとの けいか" : "ひとやすみ"}
                    </Badge>
                    <SurfacePanelHeader
                        className="justify-center text-center"
                        title={isMilestone ? `${currentIndex}もん クリア！` : "すこし やすもう"}
                        description={isMilestone ? "ここまで つづけられてるの すごいよ" : "みずを のんで ひといき つこう"}
                    />
                    <ResultMetric label="クリア" value={`${currentIndex}もん`} tone="sky" />
                    <div className="space-y-3">
                        <Button onClick={() => {
                            onContinue();
                        }} size="xl" className="w-full shadow-lg shadow-primary/30">
                            まだまだ やる！
                        </Button>
                        <Button onClick={() => onNavigate("/")} variant="secondary" size="lg" className="w-full">
                            おわる
                        </Button>
                    </div>
                </SurfacePanel>
            </div>
        );
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

    const shouldCompactTenKey =
        hissanActive ||
        currentProblem.inputType === "multi-number" ||
        currentProblem.categoryId.startsWith("frac_") ||
        (currentProblem.questionText?.length ?? 0) >= 14;
    const showCursorButtons = currentProblem.inputType === "multi-number" || hissanActive;
    const timerBadgeClass = cn(
        "app-pill inline-flex items-center rounded-full px-3 py-1 text-sm font-black tracking-[0.08em]",
        showTestTimer && testRemainingSeconds <= 60
            ? "border-rose-100/90 bg-rose-50/88 text-rose-700"
            : "border-white/85 bg-white/72 text-slate-600"
    );
    const mobileTimerBadgeClass = cn(
        "app-pill inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black tracking-[0.08em]",
        showTestTimer && testRemainingSeconds <= 60
            ? "border-rose-100/90 bg-rose-50/88 text-rose-700"
            : "border-white/85 bg-white/72 text-slate-600"
    );

    return (
        <div className="relative flex h-[100dvh] flex-col overflow-hidden safe-area-inset-bottom bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.26),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.22),rgba(255,255,255,0.08))]">
            {import.meta.env.DEV && <LayoutDebugOverlay />}

            {/* Full Screen Feedback Overlays */}
            <AnimatePresence>
                {feedback === 'incorrect' && showCorrection && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[linear-gradient(180deg,rgba(255,251,235,0.8),rgba(255,255,255,0.54))] p-6 backdrop-blur-xl"
                    >
                        <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full border border-white/85 bg-white/70 shadow-[0_22px_40px_-28px_rgba(15,23,42,0.38)]">
                            <span className="text-5xl">🌱</span>
                        </div>
                        <h2 className="mb-6 text-3xl font-black tracking-[-0.02em] text-slate-800">{t("ちょっと ちがったね", "惜しい！")}</h2>

                        {/* Question Display */}
                        <div className="mb-5 flex w-full max-w-sm justify-center rounded-[24px] border border-white/80 bg-white/50 p-4 shadow-[0_20px_34px_-26px_rgba(15,23,42,0.34)] backdrop-blur-md">
                            <MathProblemPrompt
                                problem={currentProblem}
                                className="text-3xl font-bold text-slate-700"
                            />
                        </div>

                        <div className="mb-8 w-full max-w-sm rounded-[26px] app-glass-strong p-6 text-center">
                            <p className="mb-4 text-sm font-bold text-slate-400">{t("こたえ", "答え")}</p>
                            {renderCorrectAnswer()}
                        </div>

                        <Button
                            onClick={onNext}
                            size="lg"
                            className="h-14 w-full max-w-xs text-lg"
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
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[linear-gradient(180deg,rgba(240,249,255,0.84),rgba(255,255,255,0.58))] p-6 backdrop-blur-xl"
                    >
                        <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full border border-white/85 bg-white/72 shadow-[0_22px_40px_-28px_rgba(15,23,42,0.38)]">
                            <span className="text-5xl">🌱</span>
                        </div>
                        <h2 className="mb-2 text-3xl font-black tracking-[-0.02em] text-slate-800">{t("とばして だいじょうぶ", "スキップOK")}</h2>
                        <p className="mb-6 text-sm font-medium text-slate-500">{t("また でてくるよ", "また出題されます")}</p>

                        {/* Question Display */}
                        <div className="mb-5 flex w-full max-w-sm justify-center rounded-[24px] border border-white/80 bg-white/50 p-4 shadow-[0_20px_34px_-26px_rgba(15,23,42,0.34)] backdrop-blur-md">
                            <MathProblemPrompt
                                problem={currentProblem}
                                className="text-3xl font-bold text-slate-700"
                            />
                        </div>

                        <div className="mb-8 w-full max-w-sm rounded-[26px] app-glass-strong p-6 text-center">
                            <p className="mb-4 text-sm font-bold text-slate-400">{t("こたえ", "答え")}</p>
                            {renderCorrectAnswer()}
                        </div>

                        <Button
                            onClick={onNext}
                            size="lg"
                            className="h-14 w-full max-w-xs text-lg"
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
                            <span className="app-pill px-3 py-1 text-sm font-black text-slate-500">
                                {currentIndex + 1} 問目
                            </span>
                            {showTestTimer && (
                                <span className={timerBadgeClass}>
                                    {formatTimer(testRemainingSeconds)}
                                </span>
                            )}
                        </div>
                    }
                    rightAction={
                        <Button variant="secondary" size="sm" onClick={() => onNavigate("/")}>
                            <Icons.Close className="w-6 h-6" />
                        </Button>
                    }
                />
            </div>

            {/* モバイル専用: 統合トップバー */}
            <div className="hidden mobile:flex items-center justify-between border-b border-white/75 px-4 py-2 app-glass-strong rounded-b-[24px] shadow-[0_16px_30px_-24px_rgba(15,23,42,0.34)]">
                {currentProblem.isReview && (
                    <Badge variant="warning" className="px-2.5 py-0.5 text-[10px]">🔁 復習</Badge>
                )}
                <div className="flex items-center gap-2">
                    <span className="app-pill px-2.5 py-0.5 text-[11px] font-black text-slate-500">
                        {currentIndex + 1} 問目
                    </span>
                    {showTestTimer && (
                        <span className={mobileTimerBadgeClass}>
                            {formatTimer(testRemainingSeconds)}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {/* 筆算/暗算 切替トグル */}
                    {hissanEligible && onHissanToggle && (
                        <button
                            onClick={onHissanToggle}
                            className={`app-pill px-2.5 py-1 text-[11px] font-black transition-colors ${hissanActive
                                    ? 'border-cyan-100/90 bg-cyan-50/86 text-cyan-700'
                                    : 'border-white/80 bg-white/68 text-slate-500'
                                }`}
                            title={hissanActive ? '筆算モード ON' : '暗算モード'}
                        >
                            {hissanActive ? '筆算' : '暗算'}
                        </button>
                    )}
                    {currentProblem.subject === 'vocab' && onToggleTTS && (
                        <button
                            onClick={onToggleTTS}
                            className={`app-pill p-2 transition-colors ${englishAutoRead ? 'border-cyan-100/90 bg-cyan-50/86 text-cyan-700' : 'border-white/80 bg-white/68 text-slate-500'}`}
                            title={englishAutoRead ? '自動読み上げ ON' : '自動読み上げ OFF'}
                        >
                            <HiSpeakerWave className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={() => onNavigate("/")}
                        className="app-pill p-2 text-slate-500 transition-colors hover:text-slate-700"
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
                    <Card className="relative min-h-0 w-full overflow-hidden rounded-[30px] border-t-[3px] border-t-cyan-300/80 p-6 shadow-[0_26px_60px_-40px_rgba(15,23,42,0.42)] land:p-4 mobile:border-t-2 mobile:p-4 mobile:shadow-none">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.3),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.18),transparent_50%)]" />

                        {/* Compact correct feedback overlay on card */}
                        <AnimatePresence>
                            {feedback === 'correct' && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.6 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 1.1 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-[radial-gradient(circle,rgba(220,252,231,0.82),rgba(240,253,250,0.72),rgba(255,255,255,0.34))] backdrop-blur-sm"
                                >
                                    <motion.div
                                        animate={{ rotate: [0, 8, -8, 0] }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <div className="flex h-28 w-28 items-center justify-center rounded-full border border-white/85 bg-white/58 text-6xl text-emerald-500 shadow-[0_22px_40px_-30px_rgba(16,185,129,0.55)] mobile:h-24 mobile:w-24 mobile:text-5xl">⭕</div>
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
                                    >
                                        <Badge variant="warning" className="flex items-center gap-1 px-3 py-1 text-[11px]">
                                            <span>🔁</span>
                                            <span>{t("復習", "復習")}</span>
                                        </Badge>
                                    </motion.div>
                                ) : <div />}
                            </AnimatePresence>
                            {feedback === "none" && (
                                <button
                                    onClick={onSkip}
                                    className="app-pill px-3 py-1 text-xs font-black text-slate-500 transition-all hover:bg-white/84 active:scale-95"
                                >
                                    {t("スキップ", "スキップ")}
                                </button>
                            )}
                        </div>

                        {/* Question Content */}
                        <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center">
                        {hissanActive && hissanGridData ? (
                            /* 筆算モード: グリッド表示 */
                            <div className="w-full flex-1 flex flex-col items-center justify-center gap-2 overflow-auto min-h-0">
                                {/* 筆算モードトグル（デスクトップ） */}
                                {hissanEligible && onHissanToggle && (
                                    <div className="mobile:hidden">
                                        <button
                                            onClick={onHissanToggle}
                                            className="app-pill px-3 py-1 text-xs font-black text-cyan-700 transition-colors hover:bg-cyan-50/92"
                                        >
                                            筆算 → 暗算に切替
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
                                    <MathProblemPrompt
                                        problem={currentProblem}
                                        className={currentProblem.categoryId.startsWith("frac_")
                                            ? "text-[clamp(40px,11vw,80px)] ipadland:text-7xl"
                                            : "text-[clamp(28px,8vw,64px)] ipadland:text-8xl mobile:text-4xl"
                                        }
                                    />
                                </div>
                                {/* Input Preview */}
                                <div
                                    className="app-glass min-w-[120px] h-20 flex items-center justify-center rounded-[22px] px-4 text-5xl font-mono text-slate-700 transition-all ipadland:h-32 ipadland:min-w-[200px] ipadland:text-7xl mobile:h-12 mobile:min-w-[80px] mobile:flex-shrink mobile:px-2 mobile:text-3xl"
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
                                    <MathProblemPrompt
                                        problem={currentProblem}
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
                                            className="app-pill ml-2 p-2 text-slate-500 transition-colors hover:text-slate-700 active:scale-95"
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
                        </div>
                    </Card>
                </div>

                {/* Controls Area */}
                <div
                    id="debug-controls"
                    className={`app-glass-strong p-2 pb-6 rounded-t-[2rem] flex-1 border-t border-white/75 land:min-h-[32vh] land:pb-4 ipadland:rounded-[2rem] ipadland:h-full ipadland:flex ipadland:flex-col ipadland:justify-center ipadland:p-6 ipadland:min-h-0 ipadland:max-h-none mobile:pb-[var(--safe-area-inset-bottom)] mobile:pt-0 mobile:p-0 mobile:rounded-none mobile:bg-white/46 ${shouldCompactTenKey
                            ? "max-h-[36vh] min-h-[176px] mobile:min-h-[150px]"
                            : "max-h-[44vh] min-h-[220px] mobile:min-h-[190px]"
                        }`}
                >
                    {/* TenKey / Inputs */}
                    {(currentProblem.inputType === "number" || currentProblem.inputType === "multi-number" || hissanActive) && (
                        <TenKey
                            onInput={onTenKeyInput}
                            onDelete={onBackspace}
                            onClear={onClear}
                            onEnter={onEnter}
                            showDecimal={currentProblem.subject === 'math' && !hissanActive}
                            onCursorMove={showCursorButtons ? onCursorMove : undefined}
                            compact={shouldCompactTenKey}
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
