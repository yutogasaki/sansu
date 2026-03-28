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

export const buildNumberReadVisual = (
    value: number,
    options?: {
        prompt?: string;
        item?: { emoji: string; label: string };
        questionText?: string;
    }
): { questionText: string; questionVisual: ProblemVisual } => {
    const item = options?.item || pickCountableItem();

    return {
        questionText: options?.questionText || `${value} は？`,
        questionVisual: {
            kind: "number-card",
            prompt: options?.prompt || "よみかたは どれ？",
            card: {
                value,
                frameSize: value <= 5 ? 5 : 10,
                columns: 5,
                supportGroup: {
                    emoji: item.emoji,
                    label: item.label,
                    count: value,
                },
            },
        },
    };
};

export const buildReferenceChoiceGridVisual = (
    reference: { emoji: string; label: string },
    choices: { emoji: string; label: string }[],
    prompt: string,
    questionText = prompt,
    columns = choices.length
): { questionText: string; questionVisual: ProblemVisual } => ({
    questionText,
    questionVisual: {
        kind: "reference-choice-grid",
        prompt,
        grid: {
            reference,
            choices,
            columns,
        },
    },
});

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
            actionLabel: "なくなる",
            takenAwayCount: b,
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
            actionLabel: `${decrease}こ へる`,
            takenAwayCount: decrease,
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
        questionText: `${scenario.source.label} ${count}${scenario.source.counter}に 1こずつ ${scenario.target.label}を あげるよ\nぜんぶで ${scenario.target.label}は なん${scenario.target.counter}？`,
        questionVisual: {
            kind: "sharing-items",
            prompt: `ぜんぶで なん${scenario.target.counter}？`,
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
            actionLabel: "ぜんぶ なくなる",
            takenAwayCount: count,
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
        prompt: "□ に はいる きごうは？",
        groups: [
            { label: "ひだり", value: a },
            { label: "みぎ", value: b },
        ],
    },
});

export const buildAdditionBase10Visual = (a: number, b: number): { questionText: string; questionVisual: ProblemVisual } => ({
    questionText: `${a} + ${b} =`,
    questionVisual: {
        kind: "operation-base10",
        prompt: "10の まとまりで かんがえよう",
        operator: "+",
        groups: [
            { label: "もとの かず", value: a },
            { label: "たす かず", value: b },
        ],
    },
});

export const buildAdditionMentalNumberLineVisual = (
    a: number,
    b: number
): { questionText: string; questionVisual: ProblemVisual } => (
    buildNumberLineVisual(
        a,
        b,
        `${b}こ みぎへ すすもう`,
        `${a} から ${b} すすむと いくつ？`,
        {
            min: Math.max(1, a - 2),
            max: a + b + 2,
        }
    )
);

export const buildAdditionMakeTenVisual = (
    a: number,
    b: number
): { questionText: string; questionVisual: ProblemVisual } => {
    const toTen = 10 - (a % 10);
    const result = a + b;

    return buildStaticNumberLineVisual(
        [a, a + toTen, result],
        `まず ${toTen} で 10を つくろう`,
        `${a} + ${b} =`,
        { hiddenValues: [result] }
    );
};

export const buildSubtractionBase10Visual = (a: number, b: number): { questionText: string; questionVisual: ProblemVisual } => ({
    questionText: `${a} - ${b} =`,
    questionVisual: {
        kind: "operation-base10",
        prompt: "10の まとまりで かんがえよう",
        operator: "−",
        groups: [
            { label: "もとの かず", value: a },
            { label: "ひく かず", value: b },
        ],
    },
});

export const buildSubtractionMentalNumberLineVisual = (
    a: number,
    b: number
): { questionText: string; questionVisual: ProblemVisual } => (
    buildNumberLineVisual(
        a,
        -b,
        `${b}こ ひだりへ もどろう`,
        `${a} から ${b} へると いくつ？`,
        {
            min: Math.max(1, a - b - 2),
            max: a + 2,
        }
    )
);

export const buildSubtractionBackAddVisual = (
    a: number,
    b: number
): { questionText: string; questionVisual: ProblemVisual } => {
    const start = a - b;

    return buildNumberLineVisual(
        start,
        b,
        "たしざんに もどして かんがえよう",
        `□ + ${b} = ${a}`,
        {
            min: Math.max(1, start - 2),
            max: a + 2,
            hiddenTarget: false,
            hiddenValues: [start],
        }
    );
};

export const buildNumberLineVisual = (
    start: number,
    step: number,
    prompt: string,
    questionText: string,
    options?: { min?: number; max?: number; hiddenTarget?: boolean; hiddenValues?: number[]; highlightValues?: number[] }
): { questionText: string; questionVisual: ProblemVisual } => ({
    questionText,
    questionVisual: {
        kind: "number-line",
        prompt,
        line: {
            min: options?.min ?? Math.max(1, start - Math.max(2, Math.abs(step) + 1)),
            max: options?.max ?? (start + step + Math.max(2, step + 1)),
            start,
            end: start + step,
            step,
            hiddenTarget: options?.hiddenTarget ?? true,
            hiddenValues: options?.hiddenValues,
            highlightValues: options?.highlightValues,
        },
    },
});

export const buildStaticNumberLineVisual = (
    values: number[],
    prompt: string,
    questionText: string,
    options?: { hiddenValues?: number[] }
): { questionText: string; questionVisual: ProblemVisual } => {
    const sorted = [...values].sort((left, right) => left - right);
    const min = sorted[0] || 1;
    const max = sorted[sorted.length - 1] || min;

    return {
        questionText,
        questionVisual: {
            kind: "number-line",
            prompt,
            line: {
                min,
                max,
                start: min,
                end: max,
                hiddenTarget: false,
                hiddenValues: options?.hiddenValues,
                highlightValues: values,
            },
        },
    };
};

export const buildNextNumberVisual = (n: number): { questionText: string; questionVisual: ProblemVisual } =>
    buildNumberLineVisual(n, 1, "つぎの かずは？", `${n} のつぎは？`);

export const buildPreviousNumberVisual = (n: number): { questionText: string; questionVisual: ProblemVisual } =>
    buildNumberLineVisual(n, -1, "まえの かずは？", `${n} のまえは？`);

export const buildSequenceFillVisual = (
    values: number[],
    missingIndex: number
): { questionText: string; questionVisual: ProblemVisual } => ({
    questionText: values.map((value, index) => index === missingIndex ? "□" : value).join(", "),
    questionVisual: {
        kind: "number-line",
        prompt: "□に はいる かずは？",
        line: {
            min: values[0] || 1,
            max: values[values.length - 1] || 1,
            start: values[0] || 1,
            end: values[values.length - 1] || 1,
            step: 1,
            hiddenTarget: false,
            hiddenValues: [values[missingIndex] || values[0] || 1],
        },
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
