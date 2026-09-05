/**
 * G0 whitebox専用の色。完成絵ではなく、量を一目で区別するための平面色。
 *
 * 色は「目標量に対する割合」で決める。整数の5、小数の0.5、分数の1/2は
 * 同じ大きさで同じ色になり、表記が違っても同じ量だと目で分かる。
 */
import { quantityRatio, type SuikaQuantity } from "../../../domain/explore/suikaQuantity";

const RATIO_STEPS = 12;

const STEP_FILLS: readonly string[] = [
    "#9aa5b1",
    "#ffd166",
    "#f4978e",
    "#b07de0",
    "#90be6d",
    "#43aa8b",
    "#4d96ff",
    "#c77dff",
    "#ff9f1c",
    "#06d6a0",
    "#ef476f",
    "#118ab2",
    "#ffd60a",
];

export const getSuikaRatioFill = (ratio: number): string => {
    const step = Math.min(
        RATIO_STEPS,
        Math.max(0, Math.round(ratio * RATIO_STEPS)),
    );
    return STEP_FILLS[step];
};

export const getSuikaQuantityFill = (
    quantity: SuikaQuantity,
    target: SuikaQuantity,
): string => getSuikaRatioFill(quantityRatio(quantity, target));
