import React from "react";
import { Problem, ProblemVisualBalanceItem, ProblemVisualCategoryBucket, ProblemVisualGroup, ProblemVisualItem, ProblemVisualLengthBar, ProblemVisualPairItem, ProblemVisualSequenceSlot, ProblemVisualValueGroup } from "../../domain/types";
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

const LENGTH_TONE_STYLES: Record<ProblemVisualLengthBar["tone"], { rail: string; fill: string }> = {
    rose: {
        rail: "bg-rose-100",
        fill: "bg-rose-400",
    },
    sky: {
        rail: "bg-sky-100",
        fill: "bg-sky-400",
    },
    amber: {
        rail: "bg-amber-100",
        fill: "bg-amber-400",
    },
    emerald: {
        rail: "bg-emerald-100",
        fill: "bg-emerald-400",
    },
};

const CATEGORY_TONE_STYLES: Record<ProblemVisualCategoryBucket["tone"], { card: string; chip: string }> = {
    rose: {
        card: "bg-rose-50/80 border-rose-100",
        chip: "bg-rose-400",
    },
    sky: {
        card: "bg-sky-50/80 border-sky-100",
        chip: "bg-sky-400",
    },
    amber: {
        card: "bg-amber-50/80 border-amber-100",
        chip: "bg-amber-400",
    },
    emerald: {
        card: "bg-emerald-50/80 border-emerald-100",
        chip: "bg-emerald-400",
    },
};

const OrdinalRowCard: React.FC<{
    items: ProblemVisualItem[];
    showPlaceholder?: boolean;
}> = ({ items, showPlaceholder = false }) => (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-[24px] border border-white/80 bg-white/72 px-4 py-4 shadow-[0_16px_30px_-22px_rgba(15,23,42,0.28)]">
        {items.map((item, index) => (
            <React.Fragment key={`${item.emoji}-${index}`}>
                <div className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-white/80 bg-white/90 text-[clamp(26px,4vw,38px)] shadow-[0_10px_18px_-16px_rgba(15,23,42,0.24)]">
                    {item.emoji}
                </div>
                {index < items.length - 1 && (
                    <span className="text-lg font-black text-slate-300">→</span>
                )}
            </React.Fragment>
        ))}
        {showPlaceholder && (
            <>
                {items.length > 0 && (
                    <span className="text-lg font-black text-slate-300">→</span>
                )}
                <div className="flex h-16 w-16 items-center justify-center rounded-[20px] border-2 border-dashed border-cyan-300 bg-cyan-50/80 text-[clamp(26px,4vw,38px)] font-black text-cyan-700">
                    ?
                </div>
            </>
        )}
    </div>
);

const LengthCompareCard: React.FC<{
    bars: ProblemVisualLengthBar[];
    direction?: "horizontal" | "vertical";
}> = ({ bars, direction = "horizontal" }) => {
    if (direction === "vertical") {
        return (
            <div className="flex w-full max-w-[420px] items-end justify-center gap-4 rounded-[24px] border border-white/80 bg-white/72 px-4 py-4 shadow-[0_16px_30px_-22px_rgba(15,23,42,0.28)]">
                {bars.map((bar, index) => {
                    const tone = LENGTH_TONE_STYLES[bar.tone];

                    return (
                        <div key={`${bar.emoji}-${index}`} className="flex min-w-[110px] flex-col items-center gap-3">
                            <div className="flex h-36 items-end rounded-[22px] border border-white/70 bg-white/70 px-4 py-3">
                                <div
                                    className={cn("w-10 rounded-t-[18px] shadow-[inset_0_-4px_8px_rgba(255,255,255,0.24)]", tone.fill)}
                                    style={{ height: `${Math.max(42, bar.length * 14)}px` }}
                                />
                            </div>
                            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/80 bg-white/90 text-[clamp(24px,4vw,32px)] shadow-[0_10px_18px_-16px_rgba(15,23,42,0.24)]">
                                {bar.emoji}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="flex w-full max-w-[460px] flex-col gap-3 rounded-[24px] border border-white/80 bg-white/72 px-4 py-4 shadow-[0_16px_30px_-22px_rgba(15,23,42,0.28)]">
            {bars.map((bar, index) => {
                const tone = LENGTH_TONE_STYLES[bar.tone];

                return (
                    <div key={`${bar.emoji}-${index}`} className="flex items-center gap-3">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/80 bg-white/90 text-[clamp(24px,4vw,32px)] shadow-[0_10px_18px_-16px_rgba(15,23,42,0.24)]">
                            {bar.emoji}
                        </span>
                        <div className={cn("flex h-6 flex-1 items-center rounded-full px-1", tone.rail)}>
                            <div
                                className={cn("h-4 rounded-full shadow-[inset_0_-2px_4px_rgba(255,255,255,0.24)]", tone.fill)}
                                style={{ width: `${Math.max(28, bar.length * 18)}px` }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const BalanceCompareCard: React.FC<{
    items: ProblemVisualBalanceItem[];
}> = ({ items }) => {
    const [left, right] = items;
    const tilt = left && right ? Math.max(-10, Math.min(10, (right.weight - left.weight) * 3.5)) : 0;

    return (
        <div className="flex w-full max-w-[420px] flex-col items-center gap-3 rounded-[24px] border border-white/80 bg-white/72 px-4 py-4 shadow-[0_16px_30px_-22px_rgba(15,23,42,0.28)]">
            <div className="relative flex h-36 w-full items-end justify-center">
                <div className="absolute bottom-3 h-20 w-3 rounded-full bg-slate-300" />
                <div
                    className="absolute bottom-[92px] flex w-[240px] items-center justify-between"
                    style={{ transform: `rotate(${tilt}deg)` }}
                >
                    <div className="h-1 w-full rounded-full bg-slate-400" />
                    <div className="absolute left-0 top-1/2 flex -translate-y-1/2 -translate-x-1/2 flex-col items-center gap-2">
                        <div className="h-8 w-[82px] rounded-[16px] border border-slate-200 bg-white/90 shadow-[0_10px_18px_-16px_rgba(15,23,42,0.24)]" />
                        <span className="text-[clamp(24px,4vw,34px)] leading-none">{left?.emoji}</span>
                    </div>
                    <div className="absolute right-0 top-1/2 flex -translate-y-1/2 translate-x-1/2 flex-col items-center gap-2">
                        <div className="h-8 w-[82px] rounded-[16px] border border-slate-200 bg-white/90 shadow-[0_10px_18px_-16px_rgba(15,23,42,0.24)]" />
                        <span className="text-[clamp(24px,4vw,34px)] leading-none">{right?.emoji}</span>
                    </div>
                </div>
                <div className="absolute bottom-0 h-4 w-40 rounded-full bg-slate-200/90" />
            </div>
        </div>
    );
};

const CategorySortCard: React.FC<{
    target: ProblemVisualItem;
    buckets: ProblemVisualCategoryBucket[];
}> = ({ target, buckets }) => (
    <div className="flex w-full max-w-[520px] flex-col items-center gap-4 rounded-[24px] border border-white/80 bg-white/72 px-4 py-4 shadow-[0_16px_30px_-22px_rgba(15,23,42,0.28)]">
        <div className="flex flex-col items-center gap-1">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/80 bg-white/90 text-[clamp(28px,4vw,38px)] shadow-[0_10px_18px_-16px_rgba(15,23,42,0.24)]">
                {target.emoji}
            </div>
            <span className="text-xs font-black tracking-[0.08em] text-slate-500">どこに はいる？</span>
        </div>
        <div className="flex w-full flex-wrap items-stretch justify-center gap-3">
            {buckets.map((bucket, index) => {
                const tone = CATEGORY_TONE_STYLES[bucket.tone];

                return (
                    <div
                        key={`${bucket.label}-${index}`}
                        className={cn("flex min-w-[150px] flex-1 flex-col gap-3 rounded-[22px] border px-4 py-3", tone.card)}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <span className={cn("h-3 w-3 rounded-full", tone.chip)} />
                            <span className="text-sm font-black text-slate-700">{bucket.label}</span>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2">
                            {bucket.items.map((item, itemIndex) => (
                                <span
                                    key={`${bucket.label}-${item.emoji}-${itemIndex}`}
                                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/80 bg-white/80 text-[clamp(20px,3vw,28px)]"
                                >
                                    {item.emoji}
                                </span>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
);

const ItemGridCard: React.FC<{
    items: ProblemVisualItem[];
    columns?: number;
}> = ({ items, columns = Math.min(Math.max(items.length, 1), 4) }) => (
    <div className="rounded-[24px] border border-white/80 bg-white/72 px-4 py-4 shadow-[0_16px_30px_-22px_rgba(15,23,42,0.28)]">
        <div
            className="grid justify-items-center gap-3"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
            {items.map((item, index) => (
                <div
                    key={`${item.emoji}-${index}`}
                    className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-white/80 bg-white/90 text-[clamp(26px,4vw,38px)] shadow-[0_10px_18px_-16px_rgba(15,23,42,0.24)]"
                >
                    {item.emoji}
                </div>
            ))}
        </div>
    </div>
);

const ItemPairCard: React.FC<{
    items: ProblemVisualPairItem[];
    orientation?: "row" | "column";
}> = ({ items, orientation = "row" }) => (
    <div className={cn(
        "flex w-full items-center justify-center gap-4 rounded-[24px] border border-white/80 bg-white/72 px-4 py-4 shadow-[0_16px_30px_-22px_rgba(15,23,42,0.28)]",
        orientation === "column" ? "max-w-[220px] flex-col" : "max-w-[420px] flex-wrap"
    )}>
        {items.map((item, index) => (
            <div
                key={`${item.emoji}-${index}`}
                className="flex min-w-[120px] flex-col items-center gap-2 rounded-[22px] border border-white/80 bg-white/90 px-4 py-4 shadow-[0_10px_18px_-16px_rgba(15,23,42,0.24)]"
            >
                <span
                    className="leading-none"
                    style={{ fontSize: `${Math.round((item.scale || 1) * 38)}px` }}
                >
                    {item.emoji}
                </span>
                <span className="text-xs font-black tracking-[0.08em] text-slate-500">{item.label}</span>
            </div>
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

    if (visual?.kind === "sharing-items") {
        return (
            <div className={cn("flex w-full flex-col items-center gap-4 text-center", className)}>
                <div className="flex w-full flex-wrap items-center justify-center gap-3">
                    <ItemVisualCard group={visual.source} />
                    <div className="flex flex-col items-center gap-1 rounded-[24px] border border-white/70 bg-white/52 px-4 py-3 text-cyan-700 shadow-[0_16px_30px_-22px_rgba(15,23,42,0.2)]">
                        <span className="text-[clamp(28px,5vw,40px)] font-black">→</span>
                        <span className="text-xs font-black tracking-[0.08em] text-slate-500">{visual.actionLabel || "おなじに わける"}</span>
                    </div>
                    <ItemVisualCard group={visual.recipients} />
                </div>
                <PromptCaption text={visual.prompt || "1にんぶんは いくつ？"} />
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

    if (visual?.kind === "ordinal-row") {
        return (
            <div className={cn("flex w-full flex-col items-center gap-4 text-center", className)}>
                <OrdinalRowCard items={visual.items} showPlaceholder={visual.showPlaceholder} />
                <PromptCaption text={visual.prompt || "なんばんめ？"} />
            </div>
        );
    }

    if (visual?.kind === "length-compare") {
        return (
            <div className={cn("flex w-full flex-col items-center gap-4 text-center", className)}>
                <LengthCompareCard bars={visual.bars} direction={visual.direction} />
                <PromptCaption text={visual.prompt || "ながい のは どっち？"} />
            </div>
        );
    }

    if (visual?.kind === "category-sort") {
        return (
            <div className={cn("flex w-full flex-col items-center gap-4 text-center", className)}>
                <CategorySortCard target={visual.target} buckets={visual.buckets} />
                <PromptCaption text={visual.prompt || "どちらの なかま？"} />
            </div>
        );
    }

    if (visual?.kind === "item-grid") {
        return (
            <div className={cn("flex w-full flex-col items-center gap-4 text-center", className)}>
                <ItemGridCard items={visual.items} columns={visual.columns} />
                <PromptCaption text={visual.prompt || "えらぼう"} />
            </div>
        );
    }

    if (visual?.kind === "balance-compare") {
        return (
            <div className={cn("flex w-full flex-col items-center gap-4 text-center", className)}>
                <BalanceCompareCard items={visual.items} />
                <PromptCaption text={visual.prompt || "おもい のは どっち？"} />
            </div>
        );
    }

    if (visual?.kind === "item-pair") {
        return (
            <div className={cn("flex w-full flex-col items-center gap-4 text-center", className)}>
                <ItemPairCard items={visual.items} orientation={visual.orientation} />
                <PromptCaption text={visual.prompt || "おなじ？"} />
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
