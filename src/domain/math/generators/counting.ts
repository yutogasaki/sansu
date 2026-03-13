import { GeneratorFn, createProblem, randomInt, randomChoice } from "../core";
import { shuffleArray } from "../../../utils/shuffle";

const COUNT_EMOJIS = ["🍎", "🍊", "🌸", "⭐", "🐟"];

export const generators: Record<string, GeneratorFn> = {
    // Level 0: 5まで数える
    "count_5": () => {
        const n = randomInt(1, 5);
        const emoji = randomChoice(COUNT_EMOJIS);
        return createProblem(
            "count_5",
            emoji.repeat(n),
            n.toString(),
            "number"
        );
    },
    // Level 0: ドットを数える（1-10）
    "count_dot": () => {
        const n = randomInt(1, 10);
        const emoji = randomChoice(COUNT_EMOJIS);
        return createProblem(
            "count_dot",
            emoji.repeat(n),
            n.toString(),
            "number"
        );
    },
    // Level 0: どっちが多い？
    "count_which_more": () => {
        let a, b;
        do { a = randomInt(1, 6); b = randomInt(1, 6); } while (a === b);
        const emojiA = "🍎";
        const emojiB = "🍊";
        const q = `${emojiA.repeat(a)} と ${emojiB.repeat(b)}\nおおい のは？`;
        return createProblem("count_which_more", q, a > b ? "🍎" : "🍊", "choice", {
            choices: [
                { label: `🍎 (${a}こ)`, value: "🍎" },
                { label: `🍊 (${b}こ)`, value: "🍊" },
            ]
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
        // シャッフルして表示
        const shuffled = shuffleArray(nums);
        const q = `ちいさい じゅんに ならべよう\n${shuffled.join("　")}`;
        // 一番小さい数を答えさせる
        return createProblem("count_order", q, sorted[0].toString(), "number");
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
        const q = `なかまはずれ は？\n${shuffled.join(" ")}`;
        return createProblem("count_oddone", q, group.odd, "choice", {
            choices: [
                { label: group.odd, value: group.odd },
                { label: majority, value: majority },
            ]
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
        return createProblem("count_shape", `${target.emoji} は なに？`, target.name, "choice", {
            choices: choices.map(c => ({ label: `${c.emoji} ${c.name}`, value: c.name }))
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
        return createProblem("count_color", `${target.emoji} は なにいろ？`, target.name, "choice", {
            choices: choices.map(c => ({ label: c.name, value: c.name }))
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
        return createProblem("count_pair", `${target} と おなじ ものは？`, target, "choice", {
            choices: choices.map(c => ({ label: c, value: c }))
        });
    },
    // Level 0: かんたんなたし算（1+1〜3+3）
    "add_tiny": () => {
        const a = randomInt(1, 3);
        const b = randomInt(1, 3);
        return createProblem("add_tiny", `${a} + ${b} = ？`, (a + b).toString(), "number");
    },
    // Level 1: 数を数える（1-10）
    "count_10": () => {
        const n = randomInt(1, 10);
        return createProblem(
            "count_10",
            `🍎`.repeat(n), // Placeholder graphic
            n.toString(),
            "number"
        );
    },
    // Level 1: つぎのかず（1-9）
    "count_next_10": () => {
        const n = randomInt(1, 9);
        return createProblem("count_next_10", `${n} のつぎは？`, (n + 1).toString(), "number");
    },
    // Level 1: ゆびたしざん（絵つき、合計5まで）
    "add_finger": () => {
        const a = randomInt(1, 4);
        const b = randomInt(1, 5 - a);
        const emoji = randomChoice(COUNT_EMOJIS);
        const q = `${emoji.repeat(a)} と ${emoji.repeat(b)}\nあわせて いくつ？`;
        return createProblem("add_finger", q, (a + b).toString(), "number");
    },
    // Level 1: まえのかず（逆に数える、2-10）
    "count_back": () => {
        const n = randomInt(2, 10);
        return createProblem("count_back", `${n} のまえは？`, (n - 1).toString(), "number");
    },
    // Level 2: 数を数える（1-50）
    "count_50": () => {
        const n = randomInt(1, 49);
        return createProblem("count_50", `${n} のつぎは？`, (n + 1).toString(), "number");
    },
    // Level 2: つぎのかず（1-20）
    "count_next_20": () => {
        const n = randomInt(1, 19);
        return createProblem("count_next_20", `${n} のつぎは？`, (n + 1).toString(), "number");
    },
    // Level 2: 5までのたし算
    "add_5": () => {
        const a = randomInt(1, 5);
        const b = randomInt(1, 5);
        return createProblem("add_5", `${a} + ${b} = ？`, (a + b).toString(), "number");
    },
    // Level 2: かんたんなひき算（答えが正になる、5以下）
    "sub_tiny": () => {
        const a = randomInt(2, 5);
        const b = randomInt(1, a - 1);
        return createProblem("sub_tiny", `${a} − ${b} = ？`, (a - b).toString(), "number");
    },
    // Level 3: 数を数える（1-100）
    "count_100": () => {
        const n = randomInt(1, 99);
        return createProblem("count_100", `${n} のつぎは？`, (n + 1).toString(), "number");
    },
    // Level 3: 数の順番
    "count_fill": () => {
        const start = randomInt(1, 95);
        const pos = randomInt(1, 3); // 1,2,[?],4,5
        const seq = [0, 1, 2, 3, 4].map(i => start + i);
        const ans = seq[pos];
        const q = seq.map((v, i) => i === pos ? "□" : v).join(", ");
        return createProblem("count_fill", q, ans.toString(), "number");
    },
    // Level 3: 大小比較（1桁）
    "compare_1d": () => {
        let a, b;
        do { a = randomInt(1, 9); b = randomInt(1, 9); } while (a === b);
        return createProblem("compare_1d", `${a} □ ${b}`, a > b ? ">" : "<", "choice", {
            choices: [{ label: ">", value: ">" }, { label: "=", value: "=" }, { label: "<", value: "<" }]
        });
    },
    // Level 3: 大小比較（2桁）
    "compare_2d": () => {
        let a, b;
        do { a = randomInt(10, 99); b = randomInt(10, 99); } while (a === b);
        return createProblem("compare_2d", `${a} □ ${b}`, a > b ? ">" : "<", "choice", {
            choices: [{ label: ">", value: ">" }, { label: "=", value: "=" }, { label: "<", value: "<" }]
        });
    }
};
