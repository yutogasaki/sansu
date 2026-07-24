import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BookOpen, ChevronLeft } from "lucide-react";
import { cn } from "../../utils/cn";
import { ExploreGlyph } from "./ExploreGlyph";

interface ExploreHudProps {
    energy: number;
    maxEnergy: number;
    researchClueCount: number;
    researchClueTarget: number;
    researchComplete: boolean;
    showResearch?: boolean;
    steps: number;
    disabled?: boolean;
    variant?: "default" | "encounter";
    onBack: () => void;
}

export const ExploreHud: React.FC<ExploreHudProps> = ({
    energy,
    maxEnergy,
    researchClueCount,
    researchClueTarget,
    researchComplete,
    showResearch = true,
    steps,
    disabled = false,
    variant = "default",
    onBack,
}) => {
    const reduceMotion = useReducedMotion();
    const energyPercent = Math.max(0, (energy / maxEnergy) * 100);
    const energySegments = Array.from({ length: maxEnergy }, (_, index) => index < energy);
    const displayedClueCount = Math.max(0, Math.min(researchClueCount, researchClueTarget));

    return (
        <header
            data-testid="explore-hud"
            className={cn(
                "flex shrink-0 items-center gap-2.5 px-3 pb-2 pt-[calc(var(--safe-area-top)+8px)] sm:gap-3 sm:px-5",
                variant === "encounter" && "absolute inset-x-0 top-0 z-30 gap-1.5 px-2 pb-1 pt-[calc(var(--safe-area-top)+4px)] sm:px-3",
            )}
        >
            <button
                type="button"
                onClick={onBack}
                disabled={disabled}
                className={cn(
                    "explore-focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/45 bg-[linear-gradient(160deg,rgba(15,88,103,0.94),rgba(28,111,105,0.9))] text-white shadow-[0_16px_30px_-22px_rgba(8,47,73,0.8)] backdrop-blur-md disabled:opacity-45",
                    variant === "encounter" && "h-10 w-10",
                )}
                aria-label={steps > 0 ? "たんけんを おえて 基地へ帰る" : "あそびメニューへ もどる"}
            >
                <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </button>

            <div className={cn(
                "explore-field-sheet min-w-0 flex-1 rounded-[19px] px-2.5 py-1.5 sm:px-3",
                variant === "encounter" && "bg-[#fff9da]/88 px-2 py-1 backdrop-blur-md sm:px-2.5",
            )}>
                <div className="flex items-center justify-between gap-2 text-[10px] font-extrabold text-[var(--explore-muted)]">
                    <span className="flex min-w-0 items-center gap-1.5">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[9px] bg-amber-100" aria-hidden="true">
                            <ExploreGlyph kind="light" className="h-5 w-5" />
                        </span>
                        <span className="truncate">
                            {variant === "encounter" ? "ひかり" : "ランタンの ひかり"}
                        </span>
                    </span>
                    <span className="shrink-0 text-[var(--explore-ink)]">{energy} / {maxEnergy}</span>
                </div>
                <div
                    className="mt-1 grid h-2.5 gap-0.5 overflow-hidden rounded-full bg-[rgba(24,63,73,0.08)] p-0.5"
                    style={{ gridTemplateColumns: `repeat(${maxEnergy}, minmax(0, 1fr))` }}
                    role="progressbar"
                    aria-label="ひかり"
                    aria-valuemin={0}
                    aria-valuemax={maxEnergy}
                    aria-valuenow={energy}
                    aria-valuetext={`のこり ${energy}`}
                >
                    {energySegments.map((isLit, index) => (
                        <motion.span
                            key={index}
                            className={cn(
                                "rounded-full",
                                isLit
                                    ? energy <= 3
                                        ? "bg-[var(--explore-sand)]"
                                        : "bg-[linear-gradient(90deg,var(--explore-crystal),#78d9b3)]"
                                    : "bg-white/45",
                            )}
                            animate={{ opacity: isLit ? 1 : 0.36, scaleY: isLit ? 1 : 0.72 }}
                            transition={{ duration: reduceMotion ? 0 : 0.18, delay: reduceMotion ? 0 : index * 0.008 }}
                        />
                    ))}
                </div>
                <span className="sr-only">{energyPercent}%</span>
            </div>

            {showResearch ? <div
                className={cn(
                    "explore-field-sheet flex h-11 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm font-black text-violet-800 sm:px-3",
                    variant === "encounter" && "h-10 bg-[#fff9da]/88 px-2 backdrop-blur-md sm:px-2.5",
                )}
                role="status"
                aria-live="polite"
                aria-atomic="true"
                aria-label={researchComplete
                    ? "ちょうさノート 大発見"
                    : `ちょうさノート 手掛かり ${displayedClueCount}/${researchClueTarget}`}
            >
                <BookOpen className="h-4 w-4 text-violet-600" aria-hidden="true" />
                <span>{researchComplete ? "★" : `${displayedClueCount}/${researchClueTarget}`}</span>
                <span className="hidden text-[9px] font-extrabold text-[var(--explore-muted)] sm:inline">・{steps}歩</span>
            </div> : null}
        </header>
    );
};
