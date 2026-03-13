export interface ArithmeticGateChallenge {
    prompt: string;
    answer: string;
}

const randomInt = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

export const normalizeGateAnswer = (value: string) =>
    value
        .replace(/[０-９]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
        .replace(/[^\d]/g, "");

export const createAdditionGateChallenge = (): ArithmeticGateChallenge => {
    const a = randomInt(3, 7);
    const b = randomInt(3, 7);

    return {
        prompt: `${a} + ${b} = ?`,
        answer: String(a + b),
    };
};

export const createMultiplicationGateChallenge = (): ArithmeticGateChallenge => {
    const a = randomInt(2, 9);
    const b = randomInt(2, 9);

    return {
        prompt: `${a} × ${b} = ?`,
        answer: String(a * b),
    };
};
