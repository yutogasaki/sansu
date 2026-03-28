import { GeneratorFn, createProblem, randomInt } from "../core";
import { selectAdditionPair } from "../additionProgress";
import {
    buildAdditionBase10Visual,
    buildAdditionMakeTenVisual,
    buildAdditionMentalNumberLineVisual,
    buildAdditionVisual
} from "../problemVisuals";

const getAttemptCount = (totalAnswers?: number): number | undefined =>
    (typeof totalAnswers === "number" ? totalAnswers : undefined);

const pickTwoDigitPlusOneWithoutCarry = (): [number, number] => {
    let a, b;
    do { a = randomInt(10, 99); b = randomInt(1, 9); } while ((a % 10) + b >= 10);
    return [a, b];
};

const pickTwoDigitPlusOneWithCarry = (): [number, number] => {
    let a, b;
    do { a = randomInt(10, 99); b = randomInt(1, 9); } while ((a % 10) + b < 10);
    return [a, b];
};

export const generators: Record<string, GeneratorFn> = {
    // Level 4: 絵と式を行き来しながら 1+1 からはじめる
    "add_1d_1_bridge": (context) => {
        const totalAnswers = getAttemptCount(context?.profile?.mathSkills?.add_1d_1_bridge?.totalAnswers);
        const [a, b] = selectAdditionPair("add_1d_1", totalAnswers);
        const visual = buildAdditionVisual(a, b);

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
        const [a, b] = selectAdditionPair("add_1d_1", totalAnswers);

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
        const [a, b] = selectAdditionPair("add_1d_2", totalAnswers);
        const visual = buildAdditionVisual(a, b);

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
        const [a, b] = selectAdditionPair("add_1d_2", totalAnswers);

        return createProblem(
            "add_1d_2",
            `${a} + ${b} =`,
            (a + b).toString(),
            "number"
        );
    },
    // Level 7: 2桁+1桁（繰上なし）
    "add_2d1d_nc_bridge": () => {
        const [a, b] = pickTwoDigitPlusOneWithoutCarry();
        const visual = buildAdditionBase10Visual(a, b);
        return createProblem("add_2d1d_nc_bridge", `${a} + ${b} =`, (a + b).toString(), "number", undefined, {
            questionVisual: visual.questionVisual,
        });
    },
    "add_2d1d_mental_nc": () => {
        const [a, b] = pickTwoDigitPlusOneWithoutCarry();
        const visual = buildAdditionMentalNumberLineVisual(a, b);
        return createProblem("add_2d1d_mental_nc", `${a} + ${b} =`, (a + b).toString(), "number", undefined, {
            questionVisual: visual.questionVisual,
        });
    },
    "add_2d1d_hissan_nc": () => {
        const [a, b] = pickTwoDigitPlusOneWithoutCarry();
        return createProblem("add_2d1d_hissan_nc", `${a} + ${b} =`, (a + b).toString(), "number");
    },
    "add_2d1d_nc": () => {
        const [a, b] = pickTwoDigitPlusOneWithoutCarry();
        return createProblem("add_2d1d_nc", `${a} + ${b} =`, (a + b).toString(), "number");
    },
    // Level 7: 2桁+1桁（繰上あり）
    "add_2d1d_c_bridge": () => {
        const [a, b] = pickTwoDigitPlusOneWithCarry();
        const visual = buildAdditionBase10Visual(a, b);
        return createProblem("add_2d1d_c_bridge", `${a} + ${b} =`, (a + b).toString(), "number", undefined, {
            questionVisual: visual.questionVisual,
        });
    },
    "add_2d1d_make10": () => {
        const [a, b] = pickTwoDigitPlusOneWithCarry();
        const visual = buildAdditionMakeTenVisual(a, b);
        return createProblem("add_2d1d_make10", `${a} + ${b} =`, (a + b).toString(), "number", undefined, {
            questionVisual: visual.questionVisual,
        });
    },
    "add_2d1d_hissan_c": () => {
        const [a, b] = pickTwoDigitPlusOneWithCarry();
        return createProblem("add_2d1d_hissan_c", `${a} + ${b} =`, (a + b).toString(), "number");
    },
    "add_2d1d_c": () => {
        const [a, b] = pickTwoDigitPlusOneWithCarry();
        return createProblem("add_2d1d_c", `${a} + ${b} =`, (a + b).toString(), "number");
    },
    // Level 7: 2桁+2桁（繰上なし）
    "add_2d2d_nc": () => {
        const a1 = randomInt(1, 8), a2 = randomInt(0, 8);
        const b1 = randomInt(1, 9 - a1), b2 = randomInt(0, 9 - a2);
        const a = a1 * 10 + a2, b = b1 * 10 + b2;
        return createProblem("add_2d2d_nc", `${a} + ${b} =`, (a + b).toString(), "number");
    },
    // Level 7: 2桁+2桁（繰上あり）
    "add_2d2d_c": () => {
        let a, b;
        do { a = randomInt(10, 99); b = randomInt(10, 99); } while (
            (a % 10) + (b % 10) < 10 &&
            (Math.floor(a / 10) + Math.floor(b / 10)) < 10
        );
        return createProblem("add_2d2d_c", `${a} + ${b} =`, (a + b).toString(), "number");
    },
    // Level 8: 3桁+3桁
    "add_3d3d": () => {
        const a = randomInt(100, 999);
        const b = randomInt(100, 999);
        return createProblem("add_3d3d", `${a} + ${b} =`, (a + b).toString(), "number");
    },
    // Level 8: 4桁以上
    "add_4d": () => {
        const a = randomInt(1000, 9999);
        const b = randomInt(1000, 9999);
        return createProblem("add_4d", `${a} + ${b} =`, (a + b).toString(), "number");
    }
};
