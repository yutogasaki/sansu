import type { HissanCell, HissanGridData, HissanRow, HissanStep } from './hissanTypes';

const emptyCells = (count: number): HissanCell[] => (
    Array.from({ length: count }, () => ({ state: 'empty', value: '' }))
);

/** Reject decimals and unsafe integers before any arithmetic or digit layout. */
const integer = (text: string): bigint | null => {
    const trimmed = text.trim();
    if (!/^\d+$/.test(trimmed) || !Number.isSafeInteger(Number(trimmed))) return null;
    return BigInt(trimmed);
};

const fixedNumber = (text: string, count: number, endColumn = count - 1): HissanCell[] => {
    const cells = emptyCells(count);
    [...text].forEach((digit, index) => {
        cells[endColumn - text.length + 1 + index] = { state: 'fixed', value: digit };
    });
    return cells;
};

const numberFocus = (row: number, text: string, endColumn: number): [number, number][] => (
    [...text].map((_, index) => [row, endColumn - text.length + 1 + index])
);

/** The value is deliberately blank: only a successful prior step may reveal a digit. */
const inputNumber = (text: string, count: number, endColumn: number) => {
    const cells = emptyCells(count);
    const inputCellIndices: number[] = [];
    const correctValues = [...text].reverse();
    correctValues.forEach((digit, index) => {
        const column = endColumn - index;
        cells[column] = { state: 'empty', value: '', correctValue: digit };
        inputCellIndices.push(column);
    });
    return { cells, inputCellIndices, correctValues };
};

const multiplicationGrid = (a: bigint, b: bigint, finalAnswer: string): HissanGridData => {
    const aText = String(a);
    const bText = String(b);
    const columnCount = Math.max(aText.length, bText.length, finalAnswer.length) + 1;
    const endColumn = columnCount - 1;
    const multiplierCells = fixedNumber(bText, columnCount);
    multiplierCells[0] = { state: 'fixed', value: '×' };
    const rows: HissanRow[] = [
        { type: 'operand', cells: fixedNumber(aText, columnCount) },
        { type: 'operator', cells: multiplierCells },
    ];
    const steps: HissanStep[] = [];

    [...bText].reverse().forEach((digit, place) => {
        const product = String(a * BigInt(digit));
        const input = inputNumber(product, columnCount, endColumn - place);
        const rowIndex = rows.length;
        const label = bText.length === 1 ? 'こたえ' : `${['一', '十', '百', '千'][place] ?? `10の${place}乗`}の位`;
        rows.push({
            cells: input.cells,
            type: bText.length === 1 ? 'result' : 'input',
            stepIndex: steps.length,
            label,
            visibleFromStep: steps.length,
            lineAbove: place === 0,
        });
        steps.push({
            index: steps.length,
            rowIndex,
            inputCellIndices: input.inputCellIndices,
            correctValues: input.correctValues,
            phase: 'multiply',
            description: bText.length === 1 ? '右から かけよう' : `${label}を かけよう`,
            hint: place === 0
                ? `${aText} × ${digit} を、右から かこう`
                : `${aText} × ${digit} を、${place}マス 左から かこう`,
            focusCells: [...numberFocus(0, aText, endColumn), [1, endColumn - place]],
        });
    });

    if (bText.length > 1) {
        const input = inputNumber(finalAnswer, columnCount, endColumn);
        const rowIndex = rows.length;
        rows.push({
            cells: input.cells, type: 'result', stepIndex: steps.length,
            label: 'こたえ', visibleFromStep: steps.length, lineAbove: true,
        });
        steps.push({
            index: steps.length, rowIndex,
            inputCellIndices: input.inputCellIndices, correctValues: input.correctValues,
            phase: 'sum', description: 'たして まとめよう', hint: '位を そろえて、右から たそう',
            focusCells: steps.flatMap(step => step.inputCellIndices.map(column => (
                [step.rowIndex, column] as [number, number]
            ))),
        });
    }

    return {
        rows, steps, columnCount, operation: 'multiplication', finalAnswer,
        writtenLayout: { kind: 'multiplication', expression: `${aText} × ${bText}` },
    };
};

const divisionGrid = (
    dividend: bigint, divisor: bigint, finalAnswer: string, hasRemainderAnswer: boolean,
): HissanGridData => {
    const dividendText = String(dividend);
    const divisorText = String(divisor);
    const columnCount = dividendText.length;
    const rows: HissanRow[] = [
        { type: 'result', cells: emptyCells(columnCount), label: '商' },
        { type: 'operand', cells: fixedNumber(dividendText, columnCount) },
    ];
    const steps: HissanStep[] = [];
    let partial = 0n;
    let startColumn = 0;
    // The first quotient digit sits over the first sufficient dividend prefix.
    while (startColumn < columnCount) {
        partial = partial * 10n + BigInt(dividendText[startColumn]);
        if (partial >= divisor || startColumn === columnCount - 1) break;
        startColumn += 1;
    }

    let workingRow = 1;
    for (let column = startColumn; column < columnCount; column += 1) {
        const digit = partial / divisor;
        const product = digit * divisor;
        const remainder = partial - product;
        const isLast = column === columnCount - 1;
        rows[0].cells[column] = { state: 'empty', value: '', correctValue: String(digit) };
        steps.push({
            index: steps.length, rowIndex: 0, inputCellIndices: [column], correctValues: [String(digit)],
            phase: 'quotient', description: '商を たてよう',
            hint: column === startColumn
                ? `${partial} に ${divisorText} は いくつ はいるかな`
                : `つぎの ${dividendText[column]} を おろしたよ。${partial} ÷ ${divisorText} を かんがえよう`,
            focusCells: numberFocus(workingRow, String(partial), column),
        });

        const productRow = rows.length;
        const productInput = inputNumber(String(product), columnCount, column);
        rows.push({
            type: 'input', cells: productInput.cells, stepIndex: steps.length,
            label: 'かける', visibleFromStep: steps.length,
        });
        steps.push({
            index: steps.length, rowIndex: productRow,
            inputCellIndices: productInput.inputCellIndices, correctValues: productInput.correctValues,
            phase: 'multiply', description: 'かけて 下に かこう',
            hint: `${divisorText} × ${digit} を、右から かこう`, focusCells: [[0, column]],
        });

        const subtractionRow = rows.length;
        const subtractionInput = inputNumber(String(remainder), columnCount, column);
        rows.push({
            type: isLast ? 'result' : 'input', cells: subtractionInput.cells, stepIndex: steps.length,
            label: isLast && hasRemainderAnswer ? 'あまり' : 'ひく',
            visibleFromStep: steps.length, lineAbove: true,
        });
        steps.push({
            index: steps.length, rowIndex: subtractionRow,
            inputCellIndices: subtractionInput.inputCellIndices, correctValues: subtractionInput.correctValues,
            phase: isLast ? 'remainder' : 'subtract',
            description: isLast && hasRemainderAnswer ? 'ひいて あまりを かこう' : 'ひいて のこりを かこう',
            hint: `${partial} から、いま かけた数を ひこう`,
            focusCells: [
                ...numberFocus(workingRow, String(partial), column),
                ...numberFocus(productRow, String(product), column),
            ],
        });

        if (!isLast) {
            partial = remainder * 10n + BigInt(dividendText[column + 1]);
            workingRow = rows.length;
            // This known remainder + copied digit is visible only after subtraction succeeds.
            // It shares the following quotient step so there are no auto-passing empty steps.
            rows.push({
                type: 'operand', cells: fixedNumber(String(partial), columnCount, column + 1),
                label: 'おろす', visibleFromStep: steps.length,
            });
        }
    }

    return {
        rows, steps, columnCount, operation: 'division', finalAnswer,
        writtenLayout: {
            kind: 'division', expression: `${dividendText} ÷ ${divisorText}`, divisor: divisorText,
            quotientRow: 0, dividendRow: 1, dividendStartColumn: 0,
        },
    };
};

/**
 * Opt-in integer written arithmetic. The stored authoritative answer must agree;
 * unsupported expressions and decimal answers stay with the existing input engine.
 */
export const generateWrittenArithmeticGrid = (
    questionText: string, answer: string | string[],
): HissanGridData | null => {
    const match = questionText.match(/^\s*(\d+)\s*([×÷])\s*(\d+)\s*=\s*(?:[?？])?\s*$/);
    if (!match) return null;
    const a = integer(match[1]);
    const b = integer(match[3]);
    if (a === null || b === null) return null;

    if (match[2] === '×') {
        if (Array.isArray(answer)) return null;
        const expected = integer(answer);
        if (expected === null || expected !== a * b) return null;
        return multiplicationGrid(a, b, String(expected));
    }

    if (b === 0n) return null;
    const quotient = a / b;
    const remainder = a % b;
    const remainderText = typeof answer === 'string' ? answer.match(/^\s*(\d+)\s*あまり\s*(\d+)\s*$/) : null;
    const answerParts = Array.isArray(answer) ? answer : remainderText?.slice(1);
    if (answerParts) {
        if (answerParts.length !== 2 || integer(answerParts[0]) !== quotient || integer(answerParts[1]) !== remainder) return null;
        return divisionGrid(a, b, `${quotient} あまり ${remainder}`, true);
    }
    if (typeof answer !== 'string' || remainder !== 0n || integer(answer) !== quotient) return null;
    return divisionGrid(a, b, String(quotient), false);
};
