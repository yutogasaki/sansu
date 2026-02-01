import { generators as counting } from "./generators/counting";
import { generators as addition } from "./generators/addition";
import { generators as subtraction } from "./generators/subtraction";
import { generators as multiplication } from "./generators/multiplication";
import { generators as division } from "./generators/division";
import { generators as decimal } from "./generators/decimal";
import { generators as fraction } from "./generators/fraction";
import { generators as advanced } from "./generators/advanced";

import { GeneratorFn } from "./core";

export const MATH_GENERATORS: Record<string, GeneratorFn> = {
    ...counting,
    ...addition,
    ...subtraction,
    ...multiplication,
    ...division,
    ...decimal,
    ...fraction,
    ...advanced,
};

export const generateMathProblem = (skillId: string) => {
    const gen = MATH_GENERATORS[skillId];
    if (!gen) throw new Error(`Generator not found for skill: ${skillId}`);
    return gen();
};
