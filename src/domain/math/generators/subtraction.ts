import { GeneratorFn, createProblem, randomInt } from "../core";
import type { RandomSource } from "../../../utils/random";
import { selectSubtractionPair } from "../subtractionProgress";
import {
    buildSubtractionBackAddVisual,
    buildSubtractionBase10Visual,
    buildSubtractionMentalNumberLineVisual,
    buildSubtractionVisual
} from "../problemVisuals";

const pickTwoDigitMinusOneWithoutBorrow = (random: RandomSource = Math.random): [number, number] => {
    let a, ones;
    do {
        a = randomInt(10, 99, random);
        ones = a % 10;
    } while (ones === 0);
    return [a, randomInt(1, ones, random)];
};

const pickTwoDigitMinusOneWithBorrow = (random: RandomSource = Math.random): [number, number] => {
    let a, b;
    do { a = randomInt(10, 99, random); b = randomInt(1, 9, random); } while (b <= (a % 10));
    return [a, b];
};

export const generators: Record<string, GeneratorFn> = {
    // Level 6: 絵と式を結びつける 1桁引き算（繰下なし）
    "sub_1d1d_nc_bridge": (context) => {
        const totalAnswers = context?.profile?.mathSkills?.sub_1d1d_nc_bridge?.totalAnswers;
        const [a, b] = selectSubtractionPair("sub_1d1d_nc", totalAnswers, context?.random);
        const visual = buildSubtractionVisual(a, b, context?.random);
        return createProblem("sub_1d1d_nc_bridge", `${a} - ${b} =`, (a - b).toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 6: 1桁-1桁（繰下なし）
    "sub_1d1d_nc": (context) => {
        const totalAnswers = context?.profile?.mathSkills?.sub_1d1d_nc?.totalAnswers;
        const [a, b] = selectSubtractionPair("sub_1d1d_nc", totalAnswers, context?.random);
        return createProblem("sub_1d1d_nc", `${a} - ${b} =`, (a - b).toString(), "number");
    },
    // Level 6: 絵と式を結びつける 1桁引き算（繰下あり）
    "sub_1d1d_c_bridge": (context) => {
        const totalAnswers = context?.profile?.mathSkills?.sub_1d1d_c_bridge?.totalAnswers;
        const [a, b] = selectSubtractionPair("sub_1d1d_c", totalAnswers, context?.random);
        const visual = buildSubtractionVisual(a, b, context?.random);
        return createProblem("sub_1d1d_c_bridge", `${a} - ${b} =`, (a - b).toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    // Level 6: 1桁-1桁（繰下あり）
    "sub_1d1d_c": (context) => {
        const totalAnswers = context?.profile?.mathSkills?.sub_1d1d_c?.totalAnswers;
        const [a, b] = selectSubtractionPair("sub_1d1d_c", totalAnswers, context?.random);
        return createProblem("sub_1d1d_c", `${a} - ${b} =`, (a - b).toString(), "number");
    },
    // Level 7: 2桁-1桁（繰下なし）
    "sub_2d1d_nc_bridge": (context) => {
        const [a, safeB] = pickTwoDigitMinusOneWithoutBorrow(context?.random);
        const visual = buildSubtractionBase10Visual(a, safeB);
        return createProblem("sub_2d1d_nc_bridge", `${a} - ${safeB} =`, (a - safeB).toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    "sub_2d1d_diff": (context) => {
        const [a, safeB] = pickTwoDigitMinusOneWithoutBorrow(context?.random);
        const visual = buildSubtractionMentalNumberLineVisual(a, safeB);
        return createProblem("sub_2d1d_diff", `${a} - ${safeB} =`, (a - safeB).toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    "sub_2d1d_hissan_nc": (context) => {
        const [a, safeB] = pickTwoDigitMinusOneWithoutBorrow(context?.random);
        return createProblem("sub_2d1d_hissan_nc", `${a} - ${safeB} =`, (a - safeB).toString(), "number");
    },
    "sub_2d1d_nc": (context) => {
        const [a, safeB] = pickTwoDigitMinusOneWithoutBorrow(context?.random);
        return createProblem("sub_2d1d_nc", `${a} - ${safeB} =`, (a - safeB).toString(), "number");
    },
    // Level 7: 2桁-1桁（繰下あり）
    "sub_2d1d_c_bridge": (context) => {
        const [a, b] = pickTwoDigitMinusOneWithBorrow(context?.random);
        const visual = buildSubtractionBase10Visual(a, b);
        return createProblem("sub_2d1d_c_bridge", `${a} - ${b} =`, (a - b).toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    "sub_2d1d_back_add": (context) => {
        const [a, b] = pickTwoDigitMinusOneWithBorrow(context?.random);
        const visual = buildSubtractionBackAddVisual(a, b);
        return createProblem("sub_2d1d_back_add", `□ + ${b} = ${a}`, (a - b).toString(), "number", undefined, {
            questionVisual: visual.questionVisual
        });
    },
    "sub_2d1d_hissan_c": (context) => {
        const [a, b] = pickTwoDigitMinusOneWithBorrow(context?.random);
        return createProblem("sub_2d1d_hissan_c", `${a} - ${b} =`, (a - b).toString(), "number");
    },
    "sub_2d1d_c": (context) => {
        const [a, b] = pickTwoDigitMinusOneWithBorrow(context?.random);
        return createProblem("sub_2d1d_c", `${a} - ${b} =`, (a - b).toString(), "number");
    },
    // Level 7: 2桁-2桁
    "sub_2d2d": (context) => {
        const a = randomInt(10, 99, context?.random);
        const b = randomInt(10, a, context?.random);
        return createProblem("sub_2d2d", `${a} - ${b} =`, (a - b).toString(), "number");
    },
    // Level 8: 3桁-3桁
    "sub_3d3d": (context) => {
        const a = randomInt(100, 999, context?.random);
        const b = randomInt(100, a, context?.random);
        return createProblem("sub_3d3d", `${a} - ${b} =`, (a - b).toString(), "number");
    },
    // Level 8: 4桁以上
    "sub_4d": (context) => {
        const a = randomInt(1000, 9999, context?.random);
        const b = randomInt(1000, a, context?.random);
        return createProblem("sub_4d", `${a} - ${b} =`, (a - b).toString(), "number");
    }
};
