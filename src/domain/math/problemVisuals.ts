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

export const buildDotCountVisual = (count: number): { questionText: string; questionVisual: ProblemVisual } =>
    buildSingleCountVisual(count, {
        item: DOT_ITEM,
        prompt: "てんは いくつ？",
        questionText: "てんは いくつ？",
        style: "grid",
        columns: 5,
    });
