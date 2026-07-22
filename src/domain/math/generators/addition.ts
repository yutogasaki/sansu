import { GeneratorFn, createProblem, randomInt } from "../core";
import type { RandomSource } from "../../../utils/random";
import { selectAdditionPair } from "../additionProgress";
import {
    buildAdditionBase10Visual,
    buildAdditionMakeTenVisual,
    buildAdditionMentalNumberLineVisual,
    buildAdditionVisual
} from "../problemVisuals";

const getAttemptCount = (totalAnswers?: number): number | undefined =>
    (typeof totalAnswers === "number" ? totalAnswers : undefined);

const pickTwoDigitPlusOneWithoutCarry = (random: RandomSource = Math.random): [number, number] => {
    let a, b;
    do { a = randomInt(10, 99, random); b = randomInt(1, 9, random); } while ((a % 10) + b >= 10);
    return [a, b];
};

const pickTwoDigitPlusOneWithCarry = (random: RandomSource = Math.random): [number, number] => {
    let a, b;
    do { a = randomInt(10, 99, random); b = randomInt(1, 9, random); } while ((a % 10) + b < 10);
    return [a, b];
};

export const generators: Record<string, GeneratorFn> = {
    // Level 4: 絵と式を行き来しながら 1+1 からはじめる
    "add_1d_1_bridge": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.add_1d_1_bridge?.totalAnswers);
        const [a, b] = selectAdditionPair("add_1d_1", totalAnswers, context?.random);
        const visual = buildAdditionVisual(a, b, context?.random);

        return createProblem(
            "add_1d_1_bridge",
            `${a} + ${b} =`,
            (a + b).toString(),
            "number",
            undefined,
            { questionVisual: visual.questionVisual }
        );
    },
    // Level 4: 1+1 からはじめる段階式の1桁足し算
    "add_1d_1": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.add_1d_1?.totalAnswers);
        const [a, b] = selectAdditionPair("add_1d_1", totalAnswers, context?.random);

        return createProblem(
            "add_1d_1",
            `${a} + ${b} =`,
            (a + b).toString(),
            "number"
        );
    },
    // Level 5: 10づくりの前に 絵と式を往復する
    "add_1d_2_bridge": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.add_1d_2_bridge?.totalAnswers);
        const [a, b] = selectAdditionPair("add_1d_2", totalAnswers, context?.random);
        const visual = buildAdditionVisual(a, b, context?.random);

        return createProblem(
            "add_1d_2_bridge",
            `${a} + ${b} =`,
            (a + b).toString(),
            "number",
            undefined,
            { questionVisual: visual.questionVisual }
        );
    },
    // Level 5: 繰り上がりなし → 10づくり → 繰り上がりあり
    "add_1d_2": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.add_1d_2?.totalAnswers);
        const [a, b] = selectAdditionPair("add_1d_2", totalAnswers, context?.random);

        return createProblem(
            "add_1d_2",
            `${a} + ${b} =`,
            (a + b).toString(),
            "number"
        );
    },
    // Level 7: 2桁+1桁（繰上なし）
    "add_2d1d_nc_bridge": (context) => {
        const [a, b] = pickTwoDigitPlusOneWithoutCarry(context?.random);
        const visual = buildAdditionBase10Visual(a, b);
        return createProblem("add_2d1d_nc_bridge", `${a} + ${b} =`, (a + b).toString(), "number", undefined, {
            questionVisual: visual.questionVisual,
        });
    },
    "add_2d1d_mental_nc": (context) => {
        const [a, b] = pickTwoDigitPlusOneWithoutCarry(context?.random);
        const visual = buildAdditionMentalNumberLineVisual(a, b);
        return createProblem("add_2d1d_mental_nc", `${a} + ${b} =`, (a + b).toString(), "number", undefined, {
            questionVisual: visual.questionVisual,
        });
    },
    "add_2d1d_hissan_nc": (context) => {
        const [a, b] = pickTwoDigitPlusOneWithoutCarry(context?.random);
        return createProblem("add_2d1d_hissan_nc", `${a} + ${b} =`, (a + b).toString(), "number");
    },
    "add_2d1d_nc": (context) => {
        const [a, b] = pickTwoDigitPlusOneWithoutCarry(context?.random);
        return createProblem("add_2d1d_nc", `${a} + ${b} =`, (a + b).toString(), "number");
    },
    // Level 7: 2桁+1桁（繰上あり）
    "add_2d1d_c_bridge": (context) => {
        const [a, b] = pickTwoDigitPlusOneWithCarry(context?.random);
        const visual = buildAdditionBase10Visual(a, b);
        return createProblem("add_2d1d_c_bridge", `${a} + ${b} =`, (a + b).toString(), "number", undefined, {
            questionVisual: visual.questionVisual,
        });
    },
    "add_2d1d_make10": (context) => {
        const [a, b] = pickTwoDigitPlusOneWithCarry(context?.random);
        const visual = buildAdditionMakeTenVisual(a, b);
        return createProblem("add_2d1d_make10", `${a} + ${b} =`, (a + b).toString(), "number", undefined, {
            questionVisual: visual.questionVisual,
        });
    },
    "add_2d1d_hissan_c": (context) => {
        const [a, b] = pickTwoDigitPlusOneWithCarry(context?.random);
        return createProblem("add_2d1d_hissan_c", `${a} + ${b} =`, (a + b).toString(), "number");
    },
    "add_2d1d_c": (context) => {
        const [a, b] = pickTwoDigitPlusOneWithCarry(context?.random);
        return createProblem("add_2d1d_c", `${a} + ${b} =`, (a + b).toString(), "number");
    },
    // Level 7: 2桁+2桁（繰上なし）
    "add_2d2d_nc": (context) => {
        const a1 = randomInt(1, 8, context?.random), a2 = randomInt(0, 8, context?.random);
        const b1 = randomInt(1, 9 - a1, context?.random), b2 = randomInt(0, 9 - a2, context?.random);
        const a = a1 * 10 + a2, b = b1 * 10 + b2;
        return createProblem("add_2d2d_nc", `${a} + ${b} =`, (a + b).toString(), "number");
    },
    // Level 7: 2桁+2桁（繰上あり）
    "add_2d2d_c": (context) => {
        let a, b;
        do { a = randomInt(10, 99, context?.random); b = randomInt(10, 99, context?.random); } while (
            (a % 10) + (b % 10) < 10 &&
            (Math.floor(a / 10) + Math.floor(b / 10)) < 10
        );
        return createProblem("add_2d2d_c", `${a} + ${b} =`, (a + b).toString(), "number");
    },
    // Level 8: 3桁+3桁
    "add_3d3d": (context) => {
        const a = randomInt(100, 999, context?.random);
        const b = randomInt(100, 999, context?.random);
        return createProblem("add_3d3d", `${a} + ${b} =`, (a + b).toString(), "number");
    },
    // Level 8: 4桁以上
    "add_4d": (context) => {
        const a = randomInt(1000, 9999, context?.random);
        const b = randomInt(1000, 9999, context?.random);
        return createProblem("add_4d", `${a} + ${b} =`, (a + b).toString(), "number");
    }
};
