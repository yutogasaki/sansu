import { GeneratorFn, createProblem, randomInt, randomChoice } from "../core";
import { shuffleArray } from "../../../utils/shuffle";
import {
    buildAdditionVisual,
    buildCategorySortVisual,
    buildComparisonBase10Visual,
    buildDotCountVisual,
    buildItemGridVisual,
    buildItemPairVisual,
    buildHeightCompareVisual,
    buildLengthCompareVisual,
    buildNumberLineVisual,
    buildNextNumberVisual,
    buildOrdinalVisual,
    buildOneToOneMatchVisual,
    buildPatternVisual,
    buildPositionSceneVisual,
    buildPreviousNumberVisual,
    buildSequenceFillVisual,
    buildSharingVisual,
    buildSingleCountVisual,
    buildStaticNumberLineVisual,
    buildSubtractionVisual,
    buildWeightCompareVisual,
    buildZeroConceptVisual,
    buildWhichMoreVisual,
} from "../problemVisuals";
import { selectSubtractionPair } from "../subtractionProgress";
import { selectComparisonPair } from "../comparisonProgress";
import { selectCountFillPattern } from "../sequenceProgress";
import { selectBigSmallPattern, selectComposeFilledCount, selectHeightComparePattern, selectLengthComparePattern, selectOneLessCount, selectOneMoreCount, selectOneToOneCount, selectOrdinalPattern, selectPatternCopyPattern, selectSameOrDifferentPattern, selectSameCountMatchPattern, selectShareEqualPattern, selectSortByAttributePattern, selectSpatialWordsPattern, selectTwoLessCount, selectTwoMoreCount, selectWeightComparePattern, selectWhichIsEmptyCount, selectZeroConceptCount } from "../numberSenseProgress";

const COUNT_EMOJIS = ["🍎", "🍊", "🌸", "⭐", "🐟"];
const MATCH_EMOJIS = ["🍎", "🍊", "🍓", "🌸", "⭐", "🐟"];
const ORDINAL_EMOJIS = [
    { emoji: "🐶", label: "いぬ" },
    { emoji: "🐱", label: "ねこ" },
    { emoji: "🐰", label: "うさぎ" },
    { emoji: "🐻", label: "くま" },
    { emoji: "🐼", label: "ぱんだ" },
    { emoji: "🦊", label: "きつね" },
];
const PATTERN_ITEMS = [
    { emoji: "🔴", label: "あか" },
    { emoji: "🔵", label: "あお" },
    { emoji: "🟡", label: "きいろ" },
    { emoji: "🟢", label: "みどり" },
];
const LENGTH_COMPARE_ITEMS = [
    { emoji: "🔴", label: "あか", tone: "rose" as const },
    { emoji: "🔵", label: "あお", tone: "sky" as const },
    { emoji: "🟡", label: "きいろ", tone: "amber" as const },
    { emoji: "🟢", label: "みどり", tone: "emerald" as const },
];
const HEIGHT_COMPARE_ITEMS = [
    { emoji: "🏠", label: "おうち", tone: "amber" as const },
    { emoji: "🌲", label: "き", tone: "emerald" as const },
    { emoji: "🗼", label: "タワー", tone: "rose" as const },
    { emoji: "🦒", label: "きりん", tone: "sky" as const },
];
const VISUAL_COMPARE_ITEMS = [
    { emoji: "🔴", label: "あか" },
    { emoji: "🔵", label: "あお" },
    { emoji: "🟡", label: "きいろ" },
    { emoji: "🟢", label: "みどり" },
];
const FRONT_BACK_SCENES = [
    {
        target: { emoji: "🐶", label: "いぬ" },
        reference: { emoji: "🌳", label: "き" },
    },
    {
        target: { emoji: "🐱", label: "ねこ" },
        reference: { emoji: "🏠", label: "おうち" },
    },
    {
        target: { emoji: "🐰", label: "うさぎ" },
        reference: { emoji: "🎈", label: "ふうせん" },
    },
];
const INSIDE_OUTSIDE_SCENES = [
    {
        target: { emoji: "🍎", label: "りんご" },
        reference: { emoji: "🧺", label: "かご" },
    },
    {
        target: { emoji: "⚽", label: "ボール" },
        reference: { emoji: "📦", label: "はこ" },
    },
    {
        target: { emoji: "🧸", label: "くま" },
        reference: { emoji: "🎁", label: "はこ" },
    },
];
const WEIGHT_COMPARE_ITEMS = [
    { emoji: "🪨", label: "いし" },
    { emoji: "🧸", label: "くま" },
    { emoji: "📚", label: "ほん" },
    { emoji: "🍎", label: "りんご" },
];
const SORT_ATTRIBUTE_SETS = [
    {
        buckets: [
            {
                label: "どうぶつ",
                tone: "emerald" as const,
                items: [
                    { emoji: "🐶", label: "いぬ" },
                    { emoji: "🐱", label: "ねこ" },
                    { emoji: "🐰", label: "うさぎ" },
                ],
            },
            {
                label: "たべもの",
                tone: "amber" as const,
                items: [
                    { emoji: "🍎", label: "りんご" },
                    { emoji: "🍓", label: "いちご" },
                    { emoji: "🥕", label: "にんじん" },
                ],
            },
        ],
    },
    {
        buckets: [
            {
                label: "くだもの",
                tone: "rose" as const,
                items: [
                    { emoji: "🍎", label: "りんご" },
                    { emoji: "🍊", label: "みかん" },
                    { emoji: "🍓", label: "いちご" },
                ],
            },
            {
                label: "どうぶつ",
                tone: "sky" as const,
                items: [
                    { emoji: "🐶", label: "いぬ" },
                    { emoji: "🐻", label: "くま" },
                    { emoji: "🦊", label: "きつね" },
                ],
            },
        ],
    },
    {
        buckets: [
            {
                label: "あかいもの",
                tone: "rose" as const,
                items: [
                    { emoji: "🍎", label: "りんご" },
                    { emoji: "🍓", label: "いちご" },
                    { emoji: "🔴", label: "あか" },
                ],
            },
            {
                label: "あおいもの",
                tone: "sky" as const,
                items: [
                    { emoji: "🫐", label: "あお" },
                    { emoji: "🟦", label: "あお" },
                    { emoji: "🐟", label: "さかな" },
                ],
            },
        ],
    },
    {
        buckets: [
            {
                label: "まる",
                tone: "amber" as const,
                items: [
                    { emoji: "🔴", label: "まる" },
                    { emoji: "🟠", label: "まる" },
                    { emoji: "⚽", label: "ボール" },
                ],
            },
            {
                label: "しかく",
                tone: "emerald" as const,
                items: [
                    { emoji: "🟦", label: "しかく" },
                    { emoji: "🟨", label: "しかく" },
                    { emoji: "⬜", label: "しかく" },
                ],
            },
        ],
    },
];

const getAttemptCount = (totalAnswers?: number): number | undefined =>
    (typeof totalAnswers === "number" ? totalAnswers : undefined);

const renderChoiceItems = (emoji: string, count: number): string =>
    Array.from({ length: count }, () => emoji).join(" ");

export const generators: Record<string, GeneratorFn> = {
    // Level 0: 5まで数える
    "count_5": () => {
        const n = randomInt(1, 5);
        const visual = buildSingleCountVisual(n, {
            prompt: "いくつ ある？",
            questionText: "いくつ ある？",
            frameSize: 5,
            columns: 5,
            style: "frame",
            item: { emoji: randomChoice(COUNT_EMOJIS), label: "かず" },
        });
        return createProblem("count_5", visual.questionText, n.toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 0: ドットを数える（1-10）
    "count_dot": () => {
        const n = randomInt(1, 10);
        const visual = buildDotCountVisual(n);
        return createProblem("count_dot", visual.questionText, n.toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 0: どっちが多い？
    "count_which_more": () => {
        let a, b;
        do { a = randomInt(1, 6); b = randomInt(1, 6); } while (a === b);
        const visual = buildWhichMoreVisual(a, b);
        const left = visual.questionVisual.kind === "comparison-items" ? visual.questionVisual.groups[0] : undefined;
        const right = visual.questionVisual.kind === "comparison-items" ? visual.questionVisual.groups[1] : undefined;
        return createProblem("count_which_more", visual.questionText, a > b ? (left?.emoji || "🍎") : (right?.emoji || "🍊"), "choice", {
            choices: [
                { label: `${left?.emoji || "🍎"} ${left?.label || ""}`.trim(), value: left?.emoji || "🍎" },
                { label: `${right?.emoji || "🍊"} ${right?.label || ""}`.trim(), value: right?.emoji || "🍊" },
            ]
        }, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 0: 1つおおい
    "one_more": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.one_more?.totalAnswers);
        const count = selectOneMoreCount(totalAnswers);
        const visual = buildNumberLineVisual(
            count,
            1,
            "1つ おおいと いくつ？",
            `${count} の 1つ おおい かずは？`
        );

        return createProblem("one_more", visual.questionText, (count + 1).toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 0: すうじをよむ（数字→読み方の選択）
    "count_read": () => {
        const NUMS = [
            { n: 1, reading: "いち" }, { n: 2, reading: "に" }, { n: 3, reading: "さん" },
            { n: 4, reading: "よん" }, { n: 5, reading: "ご" }, { n: 6, reading: "ろく" },
            { n: 7, reading: "なな" }, { n: 8, reading: "はち" }, { n: 9, reading: "きゅう" },
            { n: 10, reading: "じゅう" },
        ];
        const target = randomChoice(NUMS);
        // 正解以外から2つ選んでディストラクタに
        const others = NUMS.filter(x => x.n !== target.n);
        const d1 = randomChoice(others);
        const remaining = others.filter(x => x.n !== d1.n);
        const d2 = randomChoice(remaining);
        const choices = shuffleArray([target, d1, d2]);
        return createProblem("count_read", `${target.n} は？`, target.reading, "choice", {
            choices: choices.map(c => ({ label: c.reading, value: c.reading }))
        });
    },
    // Level 0: ならべよう（小さい順）
    "count_order": () => {
        // 3つの異なる1桁の数を生成
        const nums: number[] = [];
        while (nums.length < 3) {
            const n = randomInt(1, 9);
            if (!nums.includes(n)) nums.push(n);
        }
        const sorted = [...nums].sort((a, b) => a - b);
        const shuffled = shuffleArray(nums);
        const visual = buildStaticNumberLineVisual(shuffled, "いちばん ちいさい かずは？", "いちばん ちいさい かずは？");
        return createProblem("count_order", visual.questionText, sorted[0].toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 0: なんばんめ？
    "ordinal_small": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.ordinal_small?.totalAnswers);
        const pattern = selectOrdinalPattern(totalAnswers);
        const items = shuffleArray(ORDINAL_EMOJIS).slice(0, pattern.length);
        const visual = buildOrdinalVisual(items, pattern.prompt);
        const answer = items[pattern.targetIndex];

        return createProblem("ordinal_small", visual.questionText, answer?.emoji || items[0]?.emoji || "🐶", "choice", {
            choices: items.map(item => ({ label: item.emoji, value: item.emoji })),
        }, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 0: くりかえしのつづき
    "pattern_copy": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.pattern_copy?.totalAnswers);
        const pattern = selectPatternCopyPattern(totalAnswers);
        const uniqueCount = Math.max(...pattern.visible, pattern.answerIndex) + 1;
        const palette = shuffleArray(PATTERN_ITEMS).slice(0, uniqueCount);
        const items = pattern.visible.map(index => palette[index] || PATTERN_ITEMS[0]);
        const visual = buildPatternVisual(items, "つぎは どれ？");
        const choices = palette.map(item => ({ label: item.emoji, value: item.emoji }));
        const answer = palette[pattern.answerIndex];

        return createProblem("pattern_copy", visual.questionText, answer?.emoji || palette[0]?.emoji || "🔴", "choice", {
            choices,
        }, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 0: ながさくらべ
    "length_compare": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.length_compare?.totalAnswers);
        const pattern = selectLengthComparePattern(totalAnswers);
        const palette = shuffleArray(LENGTH_COMPARE_ITEMS).slice(0, 2);
        const left = palette[0] || LENGTH_COMPARE_ITEMS[0];
        const right = palette[1] || LENGTH_COMPARE_ITEMS[1];
        const visual = buildLengthCompareVisual([
            { emoji: left.emoji, label: left.label, length: pattern.left, tone: left.tone },
            { emoji: right.emoji, label: right.label, length: pattern.right, tone: right.tone },
        ]);
        const answer = pattern.left > pattern.right ? left.emoji : right.emoji;

        return createProblem("length_compare", visual.questionText, answer, "choice", {
            choices: [
                { label: left.emoji, value: left.emoji },
                { label: right.emoji, value: right.emoji },
            ],
        }, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 0: たかさくらべ
    "height_compare": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.height_compare?.totalAnswers);
        const pattern = selectHeightComparePattern(totalAnswers);
        const palette = shuffleArray(HEIGHT_COMPARE_ITEMS).slice(0, 2);
        const left = palette[0] || HEIGHT_COMPARE_ITEMS[0];
        const right = palette[1] || HEIGHT_COMPARE_ITEMS[1];
        const visual = buildHeightCompareVisual([
            { emoji: left.emoji, label: left.label, length: pattern.left, tone: left.tone },
            { emoji: right.emoji, label: right.label, length: pattern.right, tone: right.tone },
        ]);
        const answer = pattern.left > pattern.right ? left.emoji : right.emoji;

        return createProblem("height_compare", visual.questionText, answer, "choice", {
            choices: [
                { label: left.emoji, value: left.emoji },
                { label: right.emoji, value: right.emoji },
            ],
        }, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 0: おもさくらべ
    "weight_compare": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.weight_compare?.totalAnswers);
        const pattern = selectWeightComparePattern(totalAnswers);
        const items = shuffleArray(WEIGHT_COMPARE_ITEMS).slice(0, 2);
        const left = items[0] || WEIGHT_COMPARE_ITEMS[0];
        const right = items[1] || WEIGHT_COMPARE_ITEMS[1];
        const visual = buildWeightCompareVisual([
            { emoji: left.emoji, label: left.label, weight: pattern.left },
            { emoji: right.emoji, label: right.label, weight: pattern.right },
        ]);
        const answer = pattern.left > pattern.right ? left.emoji : right.emoji;

        return createProblem("weight_compare", visual.questionText, answer, "choice", {
            choices: [
                { label: `${left.emoji} ${left.label}`, value: left.emoji },
                { label: `${right.emoji} ${right.label}`, value: right.emoji },
            ],
        }, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 0: 1たい1たいおう
    "one_to_one_match": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.one_to_one_match?.totalAnswers);
        const count = selectOneToOneCount(totalAnswers);
        const visual = buildOneToOneMatchVisual(count);

        return createProblem("one_to_one_match", visual.questionText, count.toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 0: なかまでわける
    "sort_by_attribute": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.sort_by_attribute?.totalAnswers);
        const pattern = selectSortByAttributePattern(totalAnswers);
        const scenario = SORT_ATTRIBUTE_SETS[pattern.setIndex] || SORT_ATTRIBUTE_SETS[0];
        const targetBucket = scenario.buckets[pattern.targetBucket] || scenario.buckets[0];
        const target = shuffleArray(targetBucket.items)[0] || targetBucket.items[0];
        const visual = buildCategorySortVisual(target, scenario.buckets, "どちらの なかま？");

        return createProblem("sort_by_attribute", visual.questionText, targetBucket.label, "choice", {
            choices: scenario.buckets.map(bucket => ({ label: bucket.label, value: bucket.label })),
        }, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 0: おおきい・ちいさい
    "big_small_compare": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.big_small_compare?.totalAnswers);
        const pattern = selectBigSmallPattern(totalAnswers);
        const items = shuffleArray(VISUAL_COMPARE_ITEMS).slice(0, 2);
        const left = items[0] || VISUAL_COMPARE_ITEMS[0];
        const right = items[1] || VISUAL_COMPARE_ITEMS[1];
        const visual = buildItemPairVisual([
            { ...left, scale: pattern.leftScale },
            { ...right, scale: pattern.rightScale },
        ], "おおきい のは どっち？");
        const answer = pattern.largerIndex === 0 ? left : right;

        return createProblem("big_small_compare", visual.questionText, answer.emoji, "choice", {
            choices: [
                { label: `${left.emoji} ${left.label}`, value: left.emoji },
                { label: `${right.emoji} ${right.label}`, value: right.emoji },
            ],
        }, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 0: おなじ？ちがう？
    "same_or_different": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.same_or_different?.totalAnswers);
        const pattern = selectSameOrDifferentPattern(totalAnswers);
        const items = shuffleArray(VISUAL_COMPARE_ITEMS).slice(0, 2);
        const left = items[0] || VISUAL_COMPARE_ITEMS[0];
        const right = pattern.isSame ? left : (items[1] || VISUAL_COMPARE_ITEMS[1]);
        const visual = buildItemPairVisual([left, right], "おなじ？ ちがう？");

        return createProblem("same_or_different", visual.questionText, pattern.isSame ? "おなじ" : "ちがう", "choice", {
            choices: [
                { label: "おなじ", value: "おなじ" },
                { label: "ちがう", value: "ちがう" },
            ],
        }, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 0: ばしょのことば
    "spatial_words": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.spatial_words?.totalAnswers);
        const pattern = selectSpatialWordsPattern(totalAnswers);
        if (pattern.mode === "pair") {
            const items = shuffleArray(ORDINAL_EMOJIS).slice(0, 2);
            const target = items[pattern.targetIndex || 0] || items[0] || ORDINAL_EMOJIS[0];
            const prompt = `${target.label} は ${pattern.choices[0]}？ ${pattern.choices[1]}？`;
            const visual = buildItemPairVisual(items, prompt, pattern.orientation || "row");

            return createProblem("spatial_words", visual.questionText, pattern.answer, "choice", {
                choices: pattern.choices.map(choice => ({ label: choice, value: choice })),
            }, {
                questionVisual: visual.questionVisual
            });
        }

        if (pattern.mode === "front-back") {
            const scene = randomChoice(FRONT_BACK_SCENES);
            const prompt = `${scene.target.label} は まえ？ うしろ？`;
            const visual = buildPositionSceneVisual(
                "front-back",
                scene.target,
                scene.reference,
                pattern.answer as "まえ" | "うしろ",
                prompt
            );

            return createProblem("spatial_words", visual.questionText, pattern.answer, "choice", {
                choices: pattern.choices.map(choice => ({ label: choice, value: choice })),
            }, {
                questionVisual: visual.questionVisual
            });
        }

        const scene = randomChoice(INSIDE_OUTSIDE_SCENES);
        const prompt = `${scene.target.label} は なか？ そと？`;
        const visual = buildPositionSceneVisual(
            "inside-outside",
            scene.target,
            scene.reference,
            pattern.answer as "なか" | "そと",
            prompt
        );

        return createProblem("spatial_words", visual.questionText, pattern.answer, "choice", {
            choices: pattern.choices.map(choice => ({ label: choice, value: choice })),
        }, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 0: なかまはずれ（形・色）
    "count_oddone": () => {
        const groups = [
            { items: ["🍎", "🍎", "🍎", "🍊"], odd: "🍊" },
            { items: ["🔵", "🔵", "🔴", "🔵"], odd: "🔴" },
            { items: ["⭐", "⭐", "⭐", "🌙"], odd: "🌙" },
            { items: ["🐶", "🐱", "🐶", "🐶"], odd: "🐱" },
            { items: ["🌸", "🌸", "🌻", "🌸"], odd: "🌻" },
            { items: ["🟢", "🟢", "🟢", "🟡"], odd: "🟡" },
            { items: ["🐟", "🐟", "🐦", "🐟"], odd: "🐦" },
            { items: ["🍌", "🍇", "🍌", "🍌"], odd: "🍇" },
        ];
        const group = randomChoice(groups);
        // シャッフルして表示
        const shuffled = shuffleArray(group.items);
        const majority = group.items.find(i => i !== group.odd)!;
        const visual = buildItemGridVisual(
            shuffled.map(item => ({ emoji: item, label: item })),
            "なかまはずれ は？",
            4
        );
        return createProblem("count_oddone", visual.questionText, group.odd, "choice", {
            choices: [
                { label: group.odd, value: group.odd },
                { label: majority, value: majority },
            ]
        }, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 0: かたちをみつける（○△□の認識）
    "count_shape": () => {
        const SHAPES = [
            { emoji: "🔴", name: "まる" },
            { emoji: "🔺", name: "さんかく" },
            { emoji: "🟦", name: "しかく" },
        ];
        const target = randomChoice(SHAPES);
        const others = SHAPES.filter(s => s.name !== target.name);
        const choices = shuffleArray([target, ...others]);
        const visual = buildItemGridVisual([{ emoji: target.emoji, label: target.name }], "これは なに？", 1);
        return createProblem("count_shape", visual.questionText, target.name, "choice", {
            choices: choices.map(c => ({ label: `${c.emoji} ${c.name}`, value: c.name }))
        }, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 0: いろをえらぶ（色の名前と認識）
    "count_color": () => {
        const COLORS = [
            { emoji: "🟥", name: "あか" }, { emoji: "🟦", name: "あお" },
            { emoji: "🟨", name: "きいろ" }, { emoji: "🟩", name: "みどり" },
            { emoji: "🟧", name: "オレンジ" }, { emoji: "🟪", name: "むらさき" },
        ];
        const target = randomChoice(COLORS);
        const others = COLORS.filter(c => c.name !== target.name);
        const d1 = randomChoice(others);
        const d2 = randomChoice(others.filter(c => c.name !== d1.name));
        const choices = shuffleArray([target, d1, d2]);
        const visual = buildItemGridVisual([{ emoji: target.emoji, label: target.name }], "これは なにいろ？", 1);
        return createProblem("count_color", visual.questionText, target.name, "choice", {
            choices: choices.map(c => ({ label: c.name, value: c.name }))
        }, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 0: ペアをみつける（同じもの探し）
    "count_pair": () => {
        const ITEMS = ["🍎", "🍊", "🍇", "🍌", "🐶", "🐱", "🐟", "🌸", "⭐", "🌙"];
        const target = randomChoice(ITEMS);
        const others = ITEMS.filter(i => i !== target);
        const d1 = randomChoice(others);
        const d2 = randomChoice(others.filter(i => i !== d1));
        // 表示: ターゲットを見せて、3択から同じものを選ぶ
        const choices = shuffleArray([target, d1, d2]);
        const visual = buildItemGridVisual([{ emoji: target, label: "おてほん" }], "おなじ ものは？", 1);
        return createProblem("count_pair", visual.questionText, target, "choice", {
            choices: choices.map(c => ({ label: c, value: c }))
        }, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 0: おなじ数のまとまりを見つける
    "same_count_match": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.same_count_match?.totalAnswers);
        const { target, options } = selectSameCountMatchPattern(totalAnswers);
        const emojiPool = shuffleArray(MATCH_EMOJIS).slice(0, 4);
        const targetEmoji = emojiPool[0] || "🍎";
        const choiceEmojis = emojiPool.slice(1);
        const visual = buildSingleCountVisual(target, {
            prompt: "おなじ かずを えらぼう",
            questionText: "おなじ かずを えらぼう",
            columns: 5,
            style: "grid",
            item: { emoji: targetEmoji, label: "おてほん" },
        });

        return createProblem("same_count_match", visual.questionText, target.toString(), "choice", {
            choices: options.map((count, index) => ({
                label: renderChoiceItems(choiceEmojis[index] || "⭐", count),
                value: count.toString(),
            })),
        }, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 0: 5になるにはあといくつ？
    "compose_5": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.compose_5?.totalAnswers);
        const filled = selectComposeFilledCount("compose_5", totalAnswers);
        const visual = buildSingleCountVisual(filled, {
            prompt: "5になるには あといくつ？",
            questionText: "5になるには あといくつ？",
            frameSize: 5,
            columns: 5,
            style: "frame",
            item: { emoji: randomChoice(COUNT_EMOJIS), label: "かず" },
        });

        return createProblem("compose_5", visual.questionText, (5 - filled).toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 0: かんたんなたし算（1+1〜3+3）
    "add_tiny": () => {
        const a = randomInt(1, 3);
        const b = randomInt(1, 3);
        const visual = buildAdditionVisual(a, b);
        return createProblem("add_tiny", visual.questionText, (a + b).toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 1: 数を数える（1-10）
    "count_10": () => {
        const n = randomInt(1, 10);
        const visual = buildSingleCountVisual(n, {
            prompt: "いくつ ある？",
            questionText: "いくつ ある？",
            frameSize: 10,
            columns: 5,
            style: "frame",
            item: { emoji: randomChoice(COUNT_EMOJIS), label: "かず" },
        });
        return createProblem("count_10", visual.questionText, n.toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 1: つぎのかず（1-9）
    "count_next_10": () => {
        const n = randomInt(1, 9);
        const visual = buildNextNumberVisual(n);
        return createProblem("count_next_10", visual.questionText, (n + 1).toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 1: ゆびたしざん（絵つき、合計5まで）
    "add_finger": () => {
        const a = randomInt(1, 4);
        const b = randomInt(1, 5 - a);
        const visual = buildAdditionVisual(a, b);
        return createProblem("add_finger", visual.questionText, (a + b).toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 1: まえのかず（逆に数える、2-10）
    "count_back": () => {
        const n = randomInt(2, 10);
        const visual = buildPreviousNumberVisual(n);
        return createProblem("count_back", visual.questionText, (n - 1).toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 1: 2つおおい
    "two_more": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.two_more?.totalAnswers);
        const count = selectTwoMoreCount(totalAnswers);
        const visual = buildNumberLineVisual(
            count,
            2,
            "2つ おおいと いくつ？",
            `${count} の 2つ おおい かずは？`
        );

        return createProblem("two_more", visual.questionText, (count + 2).toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 1: 1つすくない
    "one_less": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.one_less?.totalAnswers);
        const count = selectOneLessCount(totalAnswers);
        const visual = buildNumberLineVisual(
            count,
            -1,
            "1つ すくないと いくつ？",
            `${count} の 1つ すくない かずは？`
        );

        return createProblem("one_less", visual.questionText, (count - 1).toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 1: 0のかんかく
    "zero_concept": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.zero_concept?.totalAnswers);
        const count = selectZeroConceptCount(totalAnswers);
        const visual = buildZeroConceptVisual(count);

        return createProblem("zero_concept", visual.questionText, "0", "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 1: からっぽ かな？
    "which_is_empty": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.which_is_empty?.totalAnswers);
        const count = selectWhichIsEmptyCount(totalAnswers);
        const visual = buildSingleCountVisual(count, {
            prompt: "からっぽ かな？",
            questionText: "からっぽ かな？",
            frameSize: 5,
            columns: 5,
            style: "frame",
            item: { emoji: randomChoice(COUNT_EMOJIS), label: "かず" },
        });

        return createProblem("which_is_empty", visual.questionText, count === 0 ? "はい" : "いいえ", "choice", {
            choices: [
                { label: "はい", value: "はい" },
                { label: "いいえ", value: "いいえ" },
            ],
        }, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 1: おなじにわける
    "share_equal": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.share_equal?.totalAnswers);
        const { total, groups } = selectShareEqualPattern(totalAnswers);
        const visual = buildSharingVisual(total, groups);
        return createProblem("share_equal", visual.questionText, (total / groups).toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 2: 数を数える（1-50）
    "count_50": () => {
        const n = randomInt(1, 49);
        const visual = buildNextNumberVisual(n);
        return createProblem("count_50", visual.questionText, (n + 1).toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 2: つぎのかず（1-20）
    "count_next_20": () => {
        const n = randomInt(1, 19);
        const visual = buildNextNumberVisual(n);
        return createProblem("count_next_20", visual.questionText, (n + 1).toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 2: 5までのたし算
    "add_5": () => {
        const a = randomInt(1, 5);
        const b = randomInt(1, 5);
        const visual = buildAdditionVisual(a, b);
        return createProblem("add_5", visual.questionText, (a + b).toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 2: 10になるにはあといくつ？
    "compose_10": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.compose_10?.totalAnswers);
        const filled = selectComposeFilledCount("compose_10", totalAnswers);
        const visual = buildSingleCountVisual(filled, {
            prompt: "10になるには あといくつ？",
            questionText: "10になるには あといくつ？",
            frameSize: 10,
            columns: 5,
            style: "frame",
            item: { emoji: randomChoice(COUNT_EMOJIS), label: "かず" },
        });

        return createProblem("compose_10", visual.questionText, (10 - filled).toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 2: 2つすくない
    "two_less": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.two_less?.totalAnswers);
        const count = selectTwoLessCount(totalAnswers);
        const visual = buildNumberLineVisual(
            count,
            -2,
            "2つ すくないと いくつ？",
            `${count} の 2つ すくない かずは？`
        );

        return createProblem("two_less", visual.questionText, (count - 2).toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 2: かんたんなひき算（答えが正になる、5以下）
    "sub_tiny": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.sub_tiny?.totalAnswers);
        const [a, b] = selectSubtractionPair("sub_tiny", totalAnswers);
        const visual = buildSubtractionVisual(a, b);
        return createProblem("sub_tiny", visual.questionText, (a - b).toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 3: 数を数える（1-100）
    "count_100": () => {
        const n = randomInt(1, 99);
        const visual = buildNextNumberVisual(n);
        return createProblem("count_100", visual.questionText, (n + 1).toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 3: 数の順番
    "count_fill": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.count_fill?.totalAnswers);
        const { start, missingIndex } = selectCountFillPattern(totalAnswers);
        const seq = [0, 1, 2, 3, 4].map(i => start + i);
        const ans = seq[missingIndex];
        const visual = buildSequenceFillVisual(seq, missingIndex);
        return createProblem("count_fill", visual.questionText, ans.toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 3: 大小比較（1桁）
    "compare_1d": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.compare_1d?.totalAnswers);
        const [a, b] = selectComparisonPair("compare_1d", totalAnswers);
        const visual = buildStaticNumberLineVisual([a, b], "どちらが おおきい？", `${a} □ ${b}`);
        return createProblem("compare_1d", visual.questionText, a > b ? ">" : "<", "choice", {
            choices: [{ label: ">", value: ">" }, { label: "=", value: "=" }, { label: "<", value: "<" }]
        }, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 3: 大小比較（2桁）
    "compare_2d": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.compare_2d?.totalAnswers);
        const [a, b] = selectComparisonPair("compare_2d", totalAnswers);
        const visual = buildComparisonBase10Visual(a, b);
        return createProblem("compare_2d", visual.questionText, a > b ? ">" : "<", "choice", {
            choices: [{ label: ">", value: ">" }, { label: "=", value: "=" }, { label: "<", value: "<" }]
        }, {
            questionVisual: visual.questionVisual
        });
    }
};
