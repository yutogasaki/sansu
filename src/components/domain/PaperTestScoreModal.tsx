import React, { useEffect, useLayoutEffect, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { isTopModalLayer } from "../ui/modalLayerManager";
import { useModalFocus } from "../ui/useModalFocus";
import { cn } from "../../utils/cn";

interface PaperTestScoreModalProps {
    isOpen: boolean;
    subject: 'math' | 'vocab';
    level: number;
    onSubmit: (correctCount: number) => void;
    onDismiss: () => void;
    isSaving?: boolean;
    error?: string | null;
}

const SCORE_OPTIONS = Array.from({ length: 21 }, (_, i) => i);

export const PaperTestScoreModal: React.FC<PaperTestScoreModalProps> = ({
    isOpen,
    subject,
    level,
    onSubmit,
    onDismiss,
    isSaving = false,
    error,
}) => {
    const [selectedScore, setSelectedScore] = useState<number | null>(null);
    const [focusScopeOpen, setFocusScopeOpen] = useState(isOpen);
    const dialogRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const descriptionId = useId();
    const layerTokenRef = useModalFocus(focusScopeOpen, onDismiss, dialogRef);

    useLayoutEffect(() => {
        if (isOpen) setFocusScopeOpen(true);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setSelectedScore(null);
        }
    }, [isOpen, level, subject]);

    const handleSubmit = () => {
        if (selectedScore !== null && !isSaving) {
            onSubmit(selectedScore);
        }
    };

    const handleExitComplete = () => {
        if (!isOpen) setFocusScopeOpen(false);
    };

    const handleBackdropClick = () => {
        const layerToken = layerTokenRef.current;
        if (!layerToken || isTopModalLayer(layerToken)) onDismiss();
    };

    return (
        <AnimatePresence onExitComplete={handleExitComplete}>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={handleBackdropClick}
                >
                    <div className="absolute inset-0 bg-[color:var(--app-overlay)] backdrop-blur-md" aria-hidden="true" />
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: 20 }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        className="relative w-full max-w-sm overflow-hidden rounded-[28px] app-glass-strong app-shadow-strong"
                        onClick={(e) => e.stopPropagation()}
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        aria-describedby={descriptionId}
                        tabIndex={-1}
                    >
                        <div className="border-b border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.64),rgba(240,249,255,0.48))] px-6 py-5 text-center">
                            <motion.div
                                animate={{
                                    scale: [1, 1.05, 1],
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    repeatDelay: 1
                                }}
                                className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border border-white/80 bg-white/78 text-4xl shadow-[0_18px_30px_-22px_rgba(15,23,42,0.42)]"
                            >
                                📄
                            </motion.div>
                            <Badge variant={subject === "math" ? "primary" : "success"} className="mx-auto">
                                {subject === "math" ? "さんすう" : "えいご"} レベル {level}
                            </Badge>
                            <h2 id={titleId} className="mt-3 text-xl font-black tracking-[-0.02em] text-slate-800">
                                テストの てんすう おしえて
                            </h2>
                            <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-500">
                                20もん の うち、せいかい した かずを えらんでね。
                            </p>
                        </div>

                        <div className="px-5 py-5 text-center">
                            <div role="group" aria-labelledby={descriptionId} className="grid grid-cols-7 gap-1">
                                {SCORE_OPTIONS.map((score) => (
                                    <button
                                        key={score}
                                        type="button"
                                        disabled={isSaving}
                                        aria-pressed={selectedScore === score}
                                        onClick={() => setSelectedScore(score)}
                                        className={cn(
                                            "app-pill flex min-h-11 w-full items-center justify-center rounded-[14px] text-sm font-black text-slate-600 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2BBAA0]/60 focus-visible:ring-offset-2",
                                            selectedScore === score
                                                ? "border-cyan-100/90 bg-cyan-50/90 text-cyan-700 shadow-[0_14px_24px_-18px_rgba(6,182,212,0.58)]"
                                                : "hover:bg-white/82 hover:text-slate-800"
                                        )}
                                    >
                                        {score}
                                    </button>
                                ))}
                            </div>

                            <p className="mt-4 text-xs font-bold tracking-[0.08em] text-slate-400">
                                / 20もん
                            </p>

                            <div className="mt-5 flex flex-col gap-3">
                                {error && <p role="alert" className="text-sm text-slate-700">{error}</p>}
                                <Button
                                    onClick={handleSubmit}
                                    disabled={selectedScore === null || isSaving}
                                    size="xl"
                                >
                                    {isSaving ? "ほぞん しています…" : "とうろく する"}
                                </Button>
                                <Button
                                    onClick={onDismiss}
                                    variant="secondary"
                                    size="lg"
                                    disabled={isSaving}
                                >
                                    あとで やる
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
