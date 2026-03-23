import { ProblemVisual } from "../types";
import { randomChoice } from "./core";

const COUNTABLE_ITEMS = [
    { emoji: "🍎", label: "りんご" },
    { emoji: "🍊", label: "みかん" },
    { emoji: "🍓", label: "いちご" },
    { emoji: "🍐", label: "なし" },
];

const pickCountableItem = () => randomChoice(COUNTABLE_ITEMS);

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
