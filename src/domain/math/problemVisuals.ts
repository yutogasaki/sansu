import { ProblemVisual } from "../types";
import { randomChoice } from "./core";

const COUNTABLE_ITEMS = [
    { emoji: "🍎", label: "りんご" },
    { emoji: "🍊", label: "みかん" },
    { emoji: "🍓", label: "いちご" },
    { emoji: "🍐", label: "なし" },
];

const DOT_ITEM = { emoji: "●", label: "てん" };

const pickCountableItem = () => randomChoice(COUNTABLE_ITEMS);

export const buildSingleCountVisual = (
    count: number,
    options?: {
        prompt?: string;
        frameSize?: number;
        columns?: number;
        style?: "grid" | "frame";
        item?: { emoji: string; label: string };
        questionText?: string;
    }
): { questionText: string; questionVisual: ProblemVisual } => {
    const item = options?.item || pickCountableItem();

    return {
        questionText: options?.questionText || "いくつ ある？",
        questionVisual: {
            kind: "single-items",
            prompt: options?.prompt || "いくつ ある？",
            columns: options?.columns,
            frameSize: options?.frameSize,
            style: options?.style || "grid",
            group: {
                emoji: item.emoji,
                label: item.label,
                count,
            },
        },
    };
};

export const buildAdditionVisual = (a: number, b: number): { questionText: string; questionVisual: ProblemVisual } => {
    const item = pickCountableItem();

    return {
        questionText: `${item.label} ${a}こ と ${item.label} ${b}こ\nあわせて いくつ？`,
        questionVisual: {
            kind: "addition-items",
            prompt: "あわせて いくつ？",
            groups: [
                { emoji: item.emoji, label: item.label, count: a },
                { emoji: item.emoji, label: item.label, count: b },
            ],
        },
    };
};

const buildMoreVisual = (
    count: number,
    increase: number,
    prompt: string
): { questionText: string; questionVisual: ProblemVisual } => {
    const item = pickCountableItem();

    return {
        questionText: `${item.label} ${count}こ に ${increase}こ ふえると\nいくつ？`,
        questionVisual: {
            kind: "addition-items",
            prompt,
            groups: [
                { emoji: item.emoji, label: item.label, count },
                { emoji: item.emoji, label: item.label, count: increase },
            ],
        },
    };
};

export const buildOneMoreVisual = (count: number): { questionText: string; questionVisual: ProblemVisual } =>
    buildMoreVisual(count, 1, "1つ おおいと いくつ？");

export const buildTwoMoreVisual = (count: number): { questionText: string; questionVisual: ProblemVisual } =>
    buildMoreVisual(count, 2, "2つ おおいと いくつ？");

export const buildSubtractionVisual = (a: number, b: number): { questionText: string; questionVisual: ProblemVisual } => {
    const item = pickCountableItem();

    return {
        questionText: `${item.label} ${a}こ あります\n${b}こ なくなると いくつ？`,
        questionVisual: {
            kind: "subtraction-items",
            prompt: "のこりは いくつ？",
            group: {
                emoji: item.emoji,
                label: item.label,
                count: a,
                crossedOutCount: b,
            },
        },
    };
};

const buildLessVisual = (
    count: number,
    decrease: number,
    prompt: string
): { questionText: string; questionVisual: ProblemVisual } => {
    const item = pickCountableItem();

    return {
        questionText: `${item.label} ${count}こ から ${decrease}こ へると\nいくつ？`,
        questionVisual: {
            kind: "subtraction-items",
            prompt,
            group: {
                emoji: item.emoji,
                label: item.label,
                count,
                crossedOutCount: decrease,
            },
        },
    };
};

export const buildOneLessVisual = (count: number): { questionText: string; questionVisual: ProblemVisual } =>
    buildLessVisual(count, 1, "1つ すくないと いくつ？");

export const buildTwoLessVisual = (count: number): { questionText: string; questionVisual: ProblemVisual } =>
    buildLessVisual(count, 2, "2つ すくないと いくつ？");

export const buildSharingVisual = (total: number, recipients: number): { questionText: string; questionVisual: ProblemVisual } => {
    const item = pickCountableItem();

    return {
        questionText: `${item.label} ${total}こを ${recipients}にんで おなじに わけると\n1にんぶんは いくつ？`,
        questionVisual: {
            kind: "sharing-items",
            prompt: "1にんぶんは いくつ？",
            actionLabel: "おなじに わける",
            source: {
                emoji: item.emoji,
                label: item.label,
                count: total,
            },
            recipients: {
                emoji: "🙂",
                label: "ともだち",
                count: recipients,
            },
        },
    };
};

const PAIRING_SCENARIOS = [
    {
        source: { emoji: "🐰", label: "うさぎ", counter: "ひき" },
        target: { emoji: "🥕", label: "にんじん", counter: "こ" },
    },
    {
        source: { emoji: "🐻", label: "くま", counter: "ひき" },
        target: { emoji: "🍯", label: "はちみつ", counter: "こ" },
    },
    {
        source: { emoji: "🐦", label: "ことり", counter: "わ" },
        target: { emoji: "🪱", label: "えさ", counter: "こ" },
    },
];

export const buildOneToOneMatchVisual = (count: number): { questionText: string; questionVisual: ProblemVisual } => {
    const scenario = randomChoice(PAIRING_SCENARIOS);

    return {
        questionText: `${scenario.source.label} ${count}${scenario.source.counter}に 1こずつ ${scenario.target.label}を あげると\n${scenario.target.label}は なん${scenario.target.counter} いる？`,
        questionVisual: {
            kind: "sharing-items",
            prompt: `${scenario.target.label}は なん${scenario.target.counter} いる？`,
            actionLabel: "1こずつ",
            source: {
                emoji: scenario.source.emoji,
                label: scenario.source.label,
                count,
            },
            recipients: {
                emoji: scenario.target.emoji,
                label: scenario.target.label,
                count,
            },
        },
    };
};

export const buildZeroConceptVisual = (count: number): { questionText: string; questionVisual: ProblemVisual } => {
    const item = pickCountableItem();

    return {
        questionText: `${item.label} ${count}こ あります\nぜんぶ なくなると いくつ？`,
        questionVisual: {
            kind: "subtraction-items",
            prompt: "ぜんぶ なくなると？",
            group: {
                emoji: item.emoji,
                label: item.label,
                count,
                crossedOutCount: count,
            },
        },
    };
};

export const buildComparisonItemsVisual = (a: number, b: number): { questionText: string; questionVisual: ProblemVisual } => {
    const item = pickCountableItem();

    return {
        questionText: `${a} □ ${b}`,
        questionVisual: {
            kind: "comparison-items",
            prompt: "どちらが おおい？",
            groups: [
                { emoji: item.emoji, label: item.label, count: a },
                { emoji: item.emoji, label: item.label, count: b },
            ],
        },
    };
};

export const buildWhichMoreVisual = (a: number, b: number): { questionText: string; questionVisual: ProblemVisual } => {
    const leftItem = pickCountableItem();
    const rightItem = randomChoice(COUNTABLE_ITEMS.filter(item => item.emoji !== leftItem.emoji));

    return {
        questionText: "どちらが おおい？",
        questionVisual: {
            kind: "comparison-items",
            prompt: "おおい のは どっち？",
            groups: [
                { emoji: leftItem.emoji, label: leftItem.label, count: a },
                { emoji: rightItem.emoji, label: rightItem.label, count: b },
            ],
        },
    };
};

export const buildComparisonBase10Visual = (a: number, b: number): { questionText: string; questionVisual: ProblemVisual } => ({
    questionText: `${a} □ ${b}`,
    questionVisual: {
        kind: "comparison-base10",
        prompt: "どちらが おおい？",
        groups: [
            { label: "ひだり", value: a },
            { label: "みぎ", value: b },
        ],
    },
});

export const buildNextNumberVisual = (n: number): { questionText: string; questionVisual: ProblemVisual } => ({
    questionText: `${n} のつぎは？`,
    questionVisual: {
        kind: "number-sequence",
        prompt: "つぎの かずは？",
        slots: n === 1
            ? [{ value: 1 }, { value: null }]
            : [{ value: n - 1 }, { value: n }, { value: null }],
    },
});

export const buildPreviousNumberVisual = (n: number): { questionText: string; questionVisual: ProblemVisual } => ({
    questionText: `${n} のまえは？`,
    questionVisual: {
        kind: "number-sequence",
        prompt: "まえの かずは？",
        slots: n === 2
            ? [{ value: null }, { value: 2 }]
            : [{ value: n - 2 }, { value: null }, { value: n }],
    },
});

export const buildSequenceFillVisual = (
    values: number[],
    missingIndex: number
): { questionText: string; questionVisual: ProblemVisual } => ({
    questionText: values.map((value, index) => index === missingIndex ? "□" : value).join(", "),
    questionVisual: {
        kind: "number-sequence",
        prompt: "□に はいる かずは？",
        slots: values.map((value, index) => ({
            value: index === missingIndex ? null : value,
        })),
    },
});

export const buildItemOrderVisual = (counts: number[]): { questionText: string; questionVisual: ProblemVisual } => {
    const item = pickCountableItem();

    return {
        questionText: "いちばん ちいさい かずは？",
        questionVisual: {
            kind: "item-order",
            prompt: "いちばん ちいさい かずは？",
            groups: counts.map(count => ({
                emoji: item.emoji,
                label: item.label,
                count,
            })),
        },
    };
};

export const buildOrdinalVisual = (
    items: { emoji: string; label: string }[],
    prompt: string
): { questionText: string; questionVisual: ProblemVisual } => ({
    questionText: prompt,
    questionVisual: {
        kind: "ordinal-row",
        prompt,
        items,
    },
});

export const buildPatternVisual = (
    items: { emoji: string; label: string }[],
    prompt = "つぎは どれ？"
): { questionText: string; questionVisual: ProblemVisual } => ({
    questionText: prompt,
    questionVisual: {
        kind: "ordinal-row",
        prompt,
        items,
        showPlaceholder: true,
    },
});

export const buildLengthCompareVisual = (
    bars: { emoji: string; label: string; length: number; tone: "rose" | "sky" | "amber" | "emerald" }[],
    prompt = "ながい のは どっち？",
    direction: "horizontal" | "vertical" = "horizontal"
): { questionText: string; questionVisual: ProblemVisual } => ({
    questionText: prompt,
    questionVisual: {
        kind: "length-compare",
        prompt,
        bars,
        direction,
    },
});

export const buildHeightCompareVisual = (
    bars: { emoji: string; label: string; length: number; tone: "rose" | "sky" | "amber" | "emerald" }[],
    prompt = "たかい のは どっち？"
): { questionText: string; questionVisual: ProblemVisual } =>
    buildLengthCompareVisual(bars, prompt, "vertical");

export const buildCategorySortVisual = (
    target: { emoji: string; label: string },
    buckets: {
        label: string;
        tone: "rose" | "sky" | "amber" | "emerald";
        items: { emoji: string; label: string }[];
    }[],
    prompt = "どちらの なかま？"
): { questionText: string; questionVisual: ProblemVisual } => ({
    questionText: `${target.emoji} は どちらの なかま？`,
    questionVisual: {
        kind: "category-sort",
        prompt,
        target,
        buckets,
    },
});

export const buildItemGridVisual = (
    items: { emoji: string; label: string }[],
    prompt: string,
    columns = Math.min(Math.max(items.length, 1), 4)
): { questionText: string; questionVisual: ProblemVisual } => ({
    questionText: prompt,
    questionVisual: {
        kind: "item-grid",
        prompt,
        items,
        columns,
    },
});

export const buildWeightCompareVisual = (
    items: { emoji: string; label: string; weight: number }[],
    prompt = "おもい のは どっち？"
): { questionText: string; questionVisual: ProblemVisual } => ({
    questionText: prompt,
    questionVisual: {
        kind: "balance-compare",
        prompt,
        items,
    },
});

export const buildPositionSceneVisual = (
    scene: "front-back" | "inside-outside",
    target: { emoji: string; label: string },
    reference: { emoji: string; label: string },
    relation: "まえ" | "うしろ" | "なか" | "そと",
    prompt: string
): { questionText: string; questionVisual: ProblemVisual } => ({
    questionText: prompt,
    questionVisual: {
        kind: "position-scene",
        prompt,
        scene,
        target,
        reference,
        relation,
    },
});

export const buildItemPairVisual = (
    items: { emoji: string; label: string; scale?: number }[],
    prompt: string,
    orientation: "row" | "column" = "row"
): { questionText: string; questionVisual: ProblemVisual } => ({
    questionText: prompt,
    questionVisual: {
        kind: "item-pair",
        prompt,
        items,
        orientation,
    },
});

export const buildDotCountVisual = (count: number): { questionText: string; questionVisual: ProblemVisual } =>
    buildSingleCountVisual(count, {
        item: DOT_ITEM,
        prompt: "てんは いくつ？",
        questionText: "てんは いくつ？",
        style: "grid",
        columns: 5,
    });
