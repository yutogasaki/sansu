import { Problem, ProblemVisual, ProblemVisualBalanceItem, ProblemVisualCategoryBucket, ProblemVisualGroup, ProblemVisualItem, ProblemVisualLengthBar, ProblemVisualPairItem } from "../types";

const EMOJI_LABELS: Record<string, string> = {
    "🍎": "りんご",
    "🍊": "みかん",
    "🍓": "いちご",
    "🍐": "なし",
    "🍌": "バナナ",
    "🍇": "ぶどう",
    "🐶": "いぬ",
    "🐱": "ねこ",
    "🐰": "うさぎ",
    "🐻": "くま",
    "🐼": "ぱんだ",
    "🦊": "きつね",
    "🐟": "さかな",
    "🐦": "とり",
    "🌸": "さくら",
    "🌻": "ひまわり",
    "⭐": "ほし",
    "🌙": "つき",
    "🔴": "あか",
    "🔵": "あお",
    "🟡": "きいろ",
    "🟢": "みどり",
    "🟥": "あか",
    "🟦": "あお",
    "🟨": "きいろ",
    "🟩": "みどり",
    "🟧": "オレンジ",
    "🟪": "むらさき",
    "🔺": "さんかく",
    "⚽": "ボール",
    "🏠": "おうち",
    "🌲": "き",
    "🗼": "タワー",
    "🦒": "きりん",
    "🪨": "いし",
    "📚": "ほん",
    "🧺": "かご",
    "📦": "はこ",
    "🎈": "ふうせん",
    "🧸": "くま",
    "🥕": "にんじん",
    "🍯": "はちみつ",
    "🪱": "えさ",
    "🙂": "ともだち",
    "●": "てん",
};

const SPECIAL_CHOICE_LABELS: Record<string, string> = {
    ">": "おおきい (>)",
    "<": "ちいさい (<)",
    "=": "おなじ (=)",
};

const normalizeWhitespace = (text: string): string => text.replace(/[ \t]+/g, " ").trim();

export const toPrintablePaperText = (text: string): string => {
    const blankToken = "__PAPER_BLANK__";
    const replaced = Object.entries(EMOJI_LABELS).reduce(
        (acc, [emoji, label]) => acc.split(emoji).join(label),
        text.replace(/□/g, blankToken).replace(/\[\s+\]/g, blankToken)
    );

    return replaced
        .split("\n")
        .map(line => normalizeWhitespace(line).replace(new RegExp(blankToken, "g"), "[   ]"))
        .join("\n")
        .trim();
};

const toPrintableChoiceLabel = (label: string): string => {
    if (SPECIAL_CHOICE_LABELS[label]) {
        return SPECIAL_CHOICE_LABELS[label];
    }

    const tokens = normalizeWhitespace(label).split(" ").filter(Boolean);

    if (tokens.length >= 2 && tokens.every(token => token === tokens[0]) && EMOJI_LABELS[tokens[0]]) {
        return `${EMOJI_LABELS[tokens[0]]} ${tokens.length}こ`;
    }

    if (tokens.length === 2 && EMOJI_LABELS[tokens[0]] && tokens[1] === EMOJI_LABELS[tokens[0]]) {
        return tokens[1];
    }

    const printable = toPrintablePaperText(label);
    const printableTokens = printable.split(" ").filter(Boolean);

    if (printableTokens.length === 2 && printableTokens[0] === printableTokens[1]) {
        return printableTokens[0];
    }

    return printable;
};

const hasReadableLabel = (item: { emoji?: string; label?: string }): boolean => {
    if (!item.label) return false;
    if (item.label === item.emoji) return false;
    return /[ぁ-んァ-ヶ一-龠a-zA-Z0-9]/.test(item.label);
};

const describeItem = (item: ProblemVisualItem | { emoji: string; label: string }): string => {
    if (hasReadableLabel(item)) return item.label;
    return EMOJI_LABELS[item.emoji] || item.label || item.emoji;
};

const describeCountGroup = (group: ProblemVisualGroup): string => {
    const erased = group.crossedOutCount ? ` (${group.crossedOutCount}こ けす)` : "";
    return `${describeItem(group)} ${group.count}こ${erased}`;
};

const describeLabeledGroups = (
    groups: ProblemVisualGroup[],
    labels: string[] = ["ひだり", "みぎ"]
): string => groups.map((group, index) => `${labels[index] || `${index + 1}`}: ${describeCountGroup(group)}`).join(" / ");

const describeBars = (
    bars: ProblemVisualLengthBar[],
    direction: "horizontal" | "vertical" = "horizontal"
): string => bars.map(bar => {
    const marker = direction === "vertical" ? "|" : "-";
    return `${describeItem(bar)}: ${marker.repeat(Math.max(2, bar.length))}`;
}).join("\n");

const describeChoices = (problem: Pick<Problem, "inputType" | "inputConfig">): string => {
    if (problem.inputType !== "choice" || !problem.inputConfig?.choices?.length) return "";
    const labels = problem.inputConfig.choices.map((choice, index) => `${index + 1}. ${toPrintableChoiceLabel(choice.label)}`);
    return labels.length > 0 ? `\nえらぶ ばんごう:\n${labels.join("\n")}` : "";
};

const getPrintableChoiceAnswerIndex = (
    problem: Pick<Problem, "inputType" | "inputConfig" | "correctAnswer">
): number | null => {
    if (problem.inputType !== "choice" || !problem.inputConfig?.choices?.length || Array.isArray(problem.correctAnswer)) {
        return null;
    }

    const normalizedAnswer = toPrintablePaperText(problem.correctAnswer);
    const matchIndex = problem.inputConfig.choices.findIndex(choice =>
        choice.value === problem.correctAnswer ||
        choice.label === problem.correctAnswer ||
        toPrintablePaperText(choice.label) === normalizedAnswer ||
        toPrintablePaperText(choice.value) === normalizedAnswer
    );

    return matchIndex >= 0 ? matchIndex + 1 : null;
};

const describeNumberLine = (visual: Extract<ProblemVisual, { kind: "number-line" }>): string => {
    const values = Array.from({ length: visual.line.max - visual.line.min + 1 }, (_, index) => visual.line.min + index);
    const sequence = values.map(value => {
        const isHidden = visual.line.hiddenValues?.includes(value) || (visual.line.hiddenTarget && value === visual.line.end);
        return isHidden ? "□" : String(value);
    }).join(" ");
    const highlights = visual.line.highlightValues?.length
        ? `\nみる かず: ${visual.line.highlightValues.join(" / ")}`
        : "";

    return `かずせん: ${sequence}${highlights}`;
};

const describeItemPair = (
    items: ProblemVisualPairItem[],
    orientation: "row" | "column" = "row"
): string => {
    const scales = items.map(item => item.scale).filter((scale): scale is number => typeof scale === "number");
    const maxScale = scales.length > 0 ? Math.max(...scales) : undefined;
    const minScale = scales.length > 0 ? Math.min(...scales) : undefined;
    const labels = orientation === "column" ? ["うえ", "した"] : ["ひだり", "みぎ"];

    return items.map(item => {
        let suffix = "";
        if (typeof item.scale === "number" && maxScale !== undefined && minScale !== undefined && maxScale !== minScale) {
            suffix = item.scale === maxScale ? "(おおきい)" : item.scale === minScale ? "(ちいさい)" : "";
        }
        return `${describeItem(item)}${suffix}`;
    }).map((text, index) => `${labels[index] || `${index + 1}`}: ${text}`).join(" / ");
};

const describeCategorySort = (target: ProblemVisualItem, buckets: ProblemVisualCategoryBucket[]): string =>
    `${describeItem(target)} -> ${buckets.map(bucket => bucket.label).join(" / ")}`;

const describeValueGroups = (groups: { label: string; value: number }[]): string =>
    groups.map(group => {
        const tens = Math.floor(group.value / 10);
        const ones = group.value % 10;
        const parts = [
            tens > 0 ? `10が${tens}こ` : "",
            ones > 0 ? `1が${ones}こ` : "",
        ].filter(Boolean);
        const detail = parts.length > 0 ? ` (${parts.join(" と ")})` : "";
        return `${group.label}: ${group.value}${detail}`;
    }).join(" / ");

const describeBalanceItems = (items: ProblemVisualBalanceItem[]): string => {
    const [left, right] = items;
    if (!left || !right) {
        return items.map(item => describeItem(item)).join(" / ");
    }

    const heavier = left.weight >= right.weight ? left : right;
    const lighter = heavier === left ? right : left;
    return `てんびん: ${describeItem(heavier)} が さがる / ${describeItem(lighter)} が あがる`;
};

const describePositionScene = (visual: Extract<ProblemVisual, { kind: "position-scene" }>): string =>
    `${describeItem(visual.target)} は ${describeItem(visual.reference)} の ${visual.relation}`;

const describeOrdinalRow = (visual: Extract<ProblemVisual, { kind: "ordinal-row" }>): string =>
    `ひだりから: ${visual.items.map(item => describeItem(item)).join(" -> ")}${visual.showPlaceholder ? " -> [   ]" : ""}`;

const describeSharingVisual = (visual: Extract<ProblemVisual, { kind: "sharing-items" }>): string => {
    if (visual.actionLabel === "1こずつ") {
        return `${describeCountGroup(visual.source)} に ${describeItem(visual.recipients)} を 1こずつ`;
    }

    const recipientUnit = visual.recipients.label === "ともだち" ? "にん" : "こ";
    return `${describeCountGroup(visual.source)} を ${visual.recipients.count}${recipientUnit}に ${visual.actionLabel || "わける"}`;
};

const buildVisualPrompt = (visual: ProblemVisual): string => {
    switch (visual.kind) {
        case "number-card":
            return `${visual.card.value}\n${describeCountGroup(visual.card.supportGroup)}`;
        case "reference-choice-grid":
            return `おてほん: ${describeItem(visual.grid.reference)}\nえらぶ: ${visual.grid.choices.map(choice => describeItem(choice)).join(" / ")}`;
        case "single-items":
            return describeCountGroup(visual.group);
        case "addition-items":
            return visual.groups.map(group => describeCountGroup(group)).join(" + ");
        case "subtraction-items":
            return describeCountGroup(visual.group);
        case "sharing-items":
            return describeSharingVisual(visual);
        case "comparison-items":
            return describeLabeledGroups(visual.groups);
        case "comparison-base10":
            return describeValueGroups(visual.groups);
        case "number-sequence":
            return `ならび: ${visual.slots.map(slot => slot.value ?? "[   ]").join(" ")}`;
        case "number-line":
            return describeNumberLine(visual);
        case "item-order":
            return describeLabeledGroups(visual.groups, ["A", "B", "C"]);
        case "ordinal-row":
            return describeOrdinalRow(visual);
        case "length-compare":
            return describeBars(visual.bars, visual.direction);
        case "category-sort":
            return describeCategorySort(visual.target, visual.buckets);
        case "balance-compare":
            return describeBalanceItems(visual.items);
        case "position-scene":
            return describePositionScene(visual);
        case "item-grid":
            return `ならび: ${visual.items.map(item => describeItem(item)).join(" / ")}`;
        case "item-pair":
            return describeItemPair(visual.items, visual.orientation);
        default: {
            const exhaustiveCheck: never = visual;
            return exhaustiveCheck;
        }
    }
};

export const buildPrintableMathPrompt = (
    problem: Pick<Problem, "questionText" | "questionVisual" | "inputType" | "inputConfig">
): string => {
    const lead = problem.questionText || problem.questionVisual?.prompt || "";
    const base = problem.questionVisual
        ? buildVisualPrompt(problem.questionVisual)
        : "";
    const body = lead && base && lead !== base ? `${lead}\n${base}` : lead || base;

    return toPrintablePaperText(`${body}${describeChoices(problem)}`);
};

export const buildPrintableMathAnswer = (
    problem: Pick<Problem, "correctAnswer" | "inputType" | "inputConfig">
): string => {
    const choiceIndex = getPrintableChoiceAnswerIndex(problem);
    if (choiceIndex !== null) {
        return String(choiceIndex);
    }

    if (Array.isArray(problem.correctAnswer)) {
        return `${problem.correctAnswer[0]}/${problem.correctAnswer[1]}`;
    }

    return toPrintablePaperText(problem.correctAnswer);
};
