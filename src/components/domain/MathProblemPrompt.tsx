import React from "react";
import { Problem, ProblemVisualGroup, ProblemVisualSequenceSlot, ProblemVisualValueGroup } from "../../domain/types";
import { cn } from "../../utils/cn";
import { MathRenderer } from "./MathRenderer";

type PromptProblem = Pick<Problem, "questionText" | "questionVisual" | "categoryId">;

interface MathProblemPromptProps {
    problem?: PromptProblem | null;
    className?: string;
}

const ItemVisualCard: React.FC<{
    group: ProblemVisualGroup;
}> = ({ group }) => {
    const crossedOutCount = group.crossedOutCount || 0;

    return (
        <div className="min-w-[124px] rounded-[24px] border border-white/80 bg-white/72 px-4 py-3 shadow-[0_16px_30px_-22px_rgba(15,23,42,0.28)]">
            <div className="mb-2 text-sm font-black tracking-[0.08em] text-slate-500">
                {group.label}
            </div>
            <div className="grid grid-cols-5 justify-items-center gap-2">
                {Array.from({ length: group.count }, (_, index) => {
                    const isCrossedOut = index >= group.count - crossedOutCount;

                    return (
                        <span key={`${group.emoji}-${index}`} className="relative text-[clamp(20px,3.6vw,28px)] leading-none">
                            <span className={cn(isCrossedOut && "opacity-25 grayscale")}>
                                {group.emoji}
                            </span>
                            {isCrossedOut && (
                                <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 -rotate-12 rounded-full bg-rose-400/90" />
                            )}
                        </span>
                    );
                })}
            </div>
        </div>
    );
};

const SingleItemsCard: React.FC<{
    group: ProblemVisualGroup;
    columns?: number;
    frameSize?: number;
    style?: "grid" | "frame";
}> = ({ group, columns = 5, frameSize, style = "grid" }) => {
    const slotCount = style === "frame" ? Math.max(frameSize || group.count, group.count) : group.count;

    return (
        <div className="rounded-[24px] border border-white/80 bg-white/72 px-4 py-4 shadow-[0_16px_30px_-22px_rgba(15,23,42,0.28)]">
            <div
                className="grid justify-items-center gap-2"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
                {Array.from({ length: slotCount }, (_, index) => {
                    const isFilled = index < group.count;

                    return (
                        <span
                            key={`${group.emoji}-${index}`}
                            className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-xl text-[clamp(20px,3.6vw,28px)] leading-none",
                                isFilled
                                    ? "border border-white/80 bg-white/90 text-slate-700"
                                    : "border border-dashed border-slate-200 bg-white/40 text-transparent"
                            )}
                        >
                            {group.emoji}
                        </span>
                    );
                })}
            </div>
        </div>
    );
};

const BaseTenValueCard: React.FC<{
    group: ProblemVisualValueGroup;
}> = ({ group }) => {
    const tens = Math.floor(group.value / 10);
    const ones = group.value % 10;

    return (
        <div className="min-w-[132px] rounded-[24px] border border-white/80 bg-white/72 px-4 py-3 shadow-[0_16px_30px_-22px_rgba(15,23,42,0.28)]">
            <div className="mb-3 flex min-h-12 flex-wrap justify-center gap-2">
                {Array.from({ length: tens }, (_, index) => (
                    <span
                        key={`ten-${group.value}-${index}`}
                        className="h-12 w-3 rounded-full bg-cyan-300 shadow-[inset_0_-6px_10px_rgba(8,145,178,0.18)]"
                    />
                ))}
            </div>
            <div className="flex min-h-6 flex-wrap justify-center gap-2">
                {Array.from({ length: ones }, (_, index) => (
                    <span
                        key={`one-${group.value}-${index}`}
                        className="h-4 w-4 rounded-full bg-amber-300 shadow-[inset_0_-3px_6px_rgba(217,119,6,0.22)]"
                    />
                ))}
            </div>
        </div>
    );
};

const PromptCaption: React.FC<{
    text: string;
}> = ({ text }) => (
    <p className="text-sm font-black tracking-[0.08em] text-slate-500">
        {text}
    </p>
);

const NumberSequenceCard: React.FC<{
    slots: ProblemVisualSequenceSlot[];
}> = ({ slots }) => (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-[24px] border border-white/80 bg-white/72 px-4 py-4 shadow-[0_16px_30px_-22px_rgba(15,23,42,0.28)]">
        {slots.map((slot, index) => (
            <React.Fragment key={`slot-${index}`}>
                <div className={cn(
                    "flex h-14 min-w-14 items-center justify-center rounded-full px-4 text-[clamp(24px,4vw,34px)] font-black",
                    slot.value === null
                        ? "border-2 border-dashed border-cyan-300 bg-cyan-50/80 text-cyan-700"
                        : "border border-white/80 bg-white/90 text-slate-700"
                )}>
                    {slot.value ?? "?"}
                </div>
                {index < slots.length - 1 && (
                    <span className="text-lg font-black text-slate-300">→</span>
                )}
            </React.Fragment>
        ))}
    </div>
);

export const MathProblemPrompt: React.FC<MathProblemPromptProps> = ({ problem, className }) => {
    const visual = problem?.questionVisual;

    if (visual?.kind === "single-items") {
        return (
            <div className={cn("flex w-full flex-col items-center gap-4 text-center", className)}>
                <SingleItemsCard
                    group={visual.group}
                    columns={visual.columns}
                    frameSize={visual.frameSize}
                    style={visual.style}
                />
                <PromptCaption text={visual.prompt || "いくつ ある？"} />
            </div>
        );
    }

    if (visual?.kind === "addition-items") {
        const [left, right] = visual.groups;

        if (left && right) {
            return (
                <div className={cn("flex w-full flex-col items-center gap-4 text-center", className)}>
                    <div className="flex w-full flex-wrap items-center justify-center gap-3">
                        <ItemVisualCard group={left} />
                        <span className="text-[clamp(34px,6vw,50px)] font-black text-cyan-700">+</span>
                        <ItemVisualCard group={right} />
                    </div>
                    <PromptCaption text={visual.prompt || "あわせて いくつ？"} />
                </div>
            );
        }
    }

    if (visual?.kind === "subtraction-items") {
        return (
            <div className={cn("flex w-full flex-col items-center gap-4 text-center", className)}>
                <ItemVisualCard group={visual.group} />
                <PromptCaption text={visual.prompt || "のこりは いくつ？"} />
            </div>
        );
    }

    if (visual?.kind === "comparison-items") {
        const [left, right] = visual.groups;

        if (left && right) {
            return (
                <div className={cn("flex w-full flex-col items-center gap-4 text-center", className)}>
                    <div className="flex w-full flex-wrap items-center justify-center gap-3">
                        <ItemVisualCard group={left} />
                        <span className="text-[clamp(34px,6vw,50px)] font-black text-slate-400">□</span>
                        <ItemVisualCard group={right} />
                    </div>
                    <PromptCaption text={visual.prompt || "どちらが おおい？"} />
                </div>
            );
        }
    }

    if (visual?.kind === "comparison-base10") {
        const [left, right] = visual.groups;

        if (left && right) {
            return (
                <div className={cn("flex w-full flex-col items-center gap-4 text-center", className)}>
                    <div className="flex w-full flex-wrap items-center justify-center gap-3">
                        <BaseTenValueCard group={left} />
                        <span className="text-[clamp(34px,6vw,50px)] font-black text-slate-400">□</span>
                        <BaseTenValueCard group={right} />
                    </div>
                    <PromptCaption text={visual.prompt || "どちらが おおい？"} />
                </div>
            );
        }
    }

    if (visual?.kind === "number-sequence") {
        return (
            <div className={cn("flex w-full flex-col items-center gap-4 text-center", className)}>
                <NumberSequenceCard slots={visual.slots} />
                <PromptCaption text={visual.prompt || "つぎの かずは？"} />
            </div>
        );
    }

    if (visual?.kind === "item-order") {
        return (
            <div className={cn("flex w-full flex-col items-center gap-4 text-center", className)}>
                <div className="flex w-full flex-wrap items-center justify-center gap-3">
                    {visual.groups.map((group, index) => (
                        <ItemVisualCard key={`${group.emoji}-${group.count}-${index}`} group={group} />
                    ))}
                </div>
                <PromptCaption text={visual.prompt || "いちばん ちいさい かずは？"} />
            </div>
        );
    }

    return (
        <MathRenderer
            text={problem?.questionText || ""}
            isFraction={problem?.categoryId?.startsWith("frac_")}
            className={className}
        />
    );
};
