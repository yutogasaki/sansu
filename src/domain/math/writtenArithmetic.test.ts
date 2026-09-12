import { describe, expect, it } from 'vitest';
import type { HissanGridData, HissanStep } from './hissanTypes';
import { generateWrittenArithmeticGrid } from './writtenArithmetic';

const gridFor = (question: string, answer: string | string[]): HissanGridData => {
    const grid = generateWrittenArithmeticGrid(question, answer);
    expect(grid).not.toBeNull();
    return grid!;
};

const compactDivisionGridFor = (question: string, answer: string | string[]): HissanGridData => {
    const grid = generateWrittenArithmeticGrid(question, answer, { divisionInput: 'compact' });
    expect(grid).not.toBeNull();
    return grid!;
};

const writtenNumber = (step: HissanStep): string => (
    step.inputCellIndices.map((column, index) => [column, step.correctValues[index]] as const)
        .sort(([a], [b]) => a - b)
        .map(([, digit]) => digit).join('')
);

const assertGridContract = (grid: HissanGridData) => {
    const visited = new Set<string>();
    grid.rows.forEach(row => expect(row.cells).toHaveLength(grid.columnCount));
    grid.steps.forEach((step, index) => {
        expect(step.index).toBe(index);
        expect(step.inputCellIndices.length).toBeGreaterThan(0);
        expect(step.inputCellIndices).toHaveLength(step.correctValues.length);
        expect(step.description).toBeTruthy();
        expect(step.hint).toBeTruthy();
        step.inputCellIndices.forEach((column, inputIndex) => {
            const key = `${step.rowIndex}-${column}`;
            expect(visited.has(key)).toBe(false);
            visited.add(key);
            expect(column).toBeGreaterThanOrEqual(0);
            expect(column).toBeLessThan(grid.columnCount);
            const cell = grid.rows[step.rowIndex].cells[column];
            expect(cell.value).toBe('');
            expect(cell.state).toBe('empty');
            expect(cell.correctValue).toBe(step.correctValues[inputIndex]);
            expect(cell.correctValue).toMatch(/^\d$/);
        });
        step.focusCells?.forEach(([row, column]) => {
            expect(grid.rows[row]?.cells[column]).toBeDefined();
        });
    });
};

describe('written multiplication', () => {
    it('keeps one-digit multiplication to one answer row, entered right to left', () => {
        const grid = gridFor('23 × 4 =', '92');
        expect(grid.writtenLayout).toEqual({ kind: 'multiplication', expression: '23 × 4' });
        expect(grid.steps).toHaveLength(1);
        expect(grid.steps[0].phase).toBe('multiply');
        expect(grid.steps[0].inputCellIndices).toEqual([2, 1]);
        expect(grid.steps[0].correctValues).toEqual(['2', '9']);
        expect(grid.rows[grid.steps[0].rowIndex].lineAbove).toBe(true);
        assertGridContract(grid);
    });

    it('aligns both 999 × 99 partial products and the full carry into 98901', () => {
        const grid = gridFor('999 × 99 =', '98901');
        expect(grid.columnCount).toBe(6);
        expect(grid.steps.map(writtenNumber)).toEqual(['8991', '8991', '98901']);
        expect(grid.steps.map(step => step.phase)).toEqual(['multiply', 'multiply', 'sum']);
        expect(grid.steps.map(step => step.inputCellIndices)).toEqual([
            [5, 4, 3, 2], [4, 3, 2, 1], [5, 4, 3, 2, 1],
        ]);
        const tensRow = grid.rows[grid.steps[1].rowIndex];
        expect(tensRow.cells[5]).toEqual({ state: 'empty', value: '' });
        expect(tensRow.label).toBe('十の位');
        expect(grid.rows[grid.steps[2].rowIndex].lineAbove).toBe(true);
        assertGridContract(grid);
    });

    it('retains the zero partial product in 108 × 20 and shifts 216 one place', () => {
        const grid = gridFor('108 × 20 =', '2160');
        expect(grid.steps.map(writtenNumber)).toEqual(['0', '216', '2160']);
        expect(grid.steps.map(step => step.inputCellIndices)).toEqual([[4], [3, 2, 1], [4, 3, 2, 1]]);
        expect(grid.rows[grid.steps[1].rowIndex].cells[4].correctValue).toBeUndefined();
        expect(grid.finalAnswer).toBe('2160');
        assertGridContract(grid);
    });

    it('does not expose future partial products or the sum in visible values', () => {
        const grid = gridFor('76 × 43 =', '3268');
        grid.steps.forEach(step => {
            expect(grid.rows[step.rowIndex].visibleFromStep).toBe(step.index);
            expect(grid.rows[step.rowIndex].cells.every(cell => cell.value === '')).toBe(true);
        });
        assertGridContract(grid);
    });
});

describe('written division', () => {
    it('asks only for quotient digits and a final remainder', () => {
        const grid = compactDivisionGridFor('816 ÷ 8 =', '102');
        expect(grid.steps.map(writtenNumber)).toEqual(['1', '0', '2']);
        expect(grid.steps.map(step => step.phase)).toEqual(['quotient', 'quotient', 'quotient']);
        expect(grid.steps.map(step => step.inputCellIndices)).toEqual([[0], [1], [2]]);
        expect(grid.rows.filter(row => row.label === 'かける').map(row => row.cells.map(cell => cell.value).join('')))
            .toEqual(['8', '0', '16']);
        expect(grid.rows.filter(row => row.label === 'ひく').map(row => row.cells.map(cell => cell.value).join('')))
            .toEqual(['0', '1', '0']);
        expect(grid.rows.filter(row => row.label === 'おろす').map(row => row.visibleFromStep)).toEqual([1, 2]);
        expect(grid.steps).toHaveLength(3);
        assertGridContract(grid);
    });

    it('keeps the final remainder as the only non-quotient input', () => {
        const grid = compactDivisionGridFor('899 ÷ 9 =', ['99', '8']);
        expect(grid.steps.map(writtenNumber)).toEqual(['9', '9', '8']);
        expect(grid.steps.map(step => step.phase)).toEqual(['quotient', 'quotient', 'remainder']);
        expect(grid.steps.at(-1)?.inputCellIndices).toEqual([2]);
        expect(grid.rows.filter(row => row.label === 'かける').map(row => row.cells.map(cell => cell.value).join('')))
            .toEqual(['81', '81']);
        expect(grid.rows.filter(row => row.label === 'ひく').map(row => row.cells.map(cell => cell.value).join('')))
            .toEqual(['8']);
        expect(grid.rows.at(-1)?.label).toBe('あまり');
        assertGridContract(grid);
    });

    it.each([
        ['96 ÷ 12 =', '8', 1, '96'],
        ['144 ÷ 24 =', '6', 2, '144'],
    ])('places the quotient over the correct dividend digit in %s', (question, answer, column, product) => {
        const grid = gridFor(question, answer);
        expect(grid.writtenLayout?.quotientRow).toBe(0);
        expect(grid.writtenLayout?.dividendRow).toBe(1);
        expect(grid.writtenLayout?.dividendStartColumn).toBe(0);
        expect(grid.steps[0].rowIndex).toBe(0);
        expect(grid.steps[0].inputCellIndices).toEqual([column]);
        expect(grid.steps.map(writtenNumber)).toEqual([answer, product, '0']);
        expect(grid.steps[1].inputCellIndices).toEqual([...Array(product.length).keys()].map(i => Number(column) - i));
        expect(grid.rows[0].cells.slice(0, Number(column)).every(cell => cell.correctValue === undefined)).toBe(true);
        assertGridContract(grid);
    });

    it.each([
        ['816 ÷ 8 =', '102', ['1', '0', '2'], ['8', '0', '16'], ['0', '1', '0'], ['1', '16']],
        ['840 ÷ 8 =', '105', ['1', '0', '5'], ['8', '0', '40'], ['0', '4', '0'], ['4', '40']],
        ['220 ÷ 2 =', '110', ['1', '1', '0'], ['2', '2', '0'], ['0', '0', '0'], ['2', '0']],
    ])('keeps internal and trailing quotient zeros in %s', (question, answer, quotients, products, remainders, broughtDown) => {
        const grid = gridFor(question, answer);
        expect(grid.steps.filter(step => step.phase === 'quotient').map(writtenNumber)).toEqual(quotients);
        expect(grid.steps.filter(step => step.phase === 'quotient').map(step => step.inputCellIndices[0])).toEqual([0, 1, 2]);
        expect(grid.steps.filter(step => step.phase === 'multiply').map(writtenNumber)).toEqual(products);
        expect(grid.steps.filter(step => ['subtract', 'remainder'].includes(step.phase!)).map(writtenNumber)).toEqual(remainders);
        expect(grid.rows.filter(row => row.label === 'おろす').map(row => row.cells.map(cell => cell.value).join(''))).toEqual(broughtDown);
        expect(grid.finalAnswer).toBe(answer);
        assertGridContract(grid);
    });

    it('reveals copied digits only after the preceding subtraction is accepted', () => {
        const grid = gridFor('816 ÷ 8 =', '102');
        const bringDownRows = grid.rows.filter(row => row.label === 'おろす');
        expect(bringDownRows.map(row => row.visibleFromStep)).toEqual([3, 6]);
        for (const row of bringDownRows) {
            const visibleFrom = row.visibleFromStep!;
            expect(grid.steps[visibleFrom - 1].phase).toBe('subtract');
            expect(grid.steps[visibleFrom].phase).toBe('quotient');
            expect(grid.steps[visibleFrom].hint).toContain('おろしたよ');
            const rowIndex = grid.rows.indexOf(row);
            expect(grid.steps[visibleFrom].focusCells?.some(([focusedRow]) => focusedRow === rowIndex)).toBe(true);
        }
        expect(grid.steps).toHaveLength(9);
    });

    it('preserves quotient and remainder as separate answers in 899 ÷ 9', () => {
        const grid = gridFor('899 ÷ 9 =', ['99', '8']);
        expect(grid.finalAnswer).toBe('99 あまり 8');
        expect(grid.writtenLayout?.divisor).toBe('9');
        expect(grid.steps.map(writtenNumber)).toEqual(['9', '81', '8', '9', '81', '8']);
        expect(grid.steps.filter(step => step.phase === 'quotient').map(step => step.inputCellIndices)).toEqual([[1], [2]]);
        expect(grid.steps.at(-1)?.phase).toBe('remainder');
        expect(grid.rows[grid.steps.at(-1)!.rowIndex].label).toBe('あまり');
        assertGridContract(grid);
    });

    it.each([
        ['7 ÷ 2 =', ['3', '1'], ['3', '6', '1']],
        ['7 ÷ 12 =', ['0', '7'], ['0', '0', '7']],
        ['0 ÷ 2 =', '0', ['0', '0', '0']],
        ['20 ÷ 2 =', ['10', '0'], ['1', '2', '0', '0', '0', '0']],
    ])('handles the low-value edge %s', (question, answer, numbers) => {
        const grid = gridFor(question, answer);
        expect(grid.steps.map(writtenNumber)).toEqual(numbers);
        assertGridContract(grid);
    });

    it('accepts canonical remainder text without merging its fields', () => {
        expect(gridFor('899 ÷ 9 =', '99 あまり 8').finalAnswer).toBe('99 あまり 8');
    });
});

describe('written arithmetic boundaries', () => {
    it.each([
        ['1.2 × 3 =', '3.6'], ['12 × 0.3 =', '3.6'], ['7 ÷ 2 =', '3.5'],
        ['7 ÷ 2 =', '3'], ['96 ÷ 12 =', '8.0'], ['-12 × 3 =', '-36'],
        ['12 ÷ 0 =', '0'], ['2 + 3 =', '5'], ['abc 12 × 3 =', '36'],
        ['12 × 3 = 5', '36'], ['12 × 3 =', '35'], ['12 × 3 =', ['3', '6']],
        ['899 ÷ 9 =', ['9', '98']], ['899 ÷ 9 =', ['99', '7']],
        ['899 ÷ 9 =', ['99', '8', '0']], ['899 ÷ 9 =', ['99.0', '8']],
        ['9007199254740992 × 0 =', '0'], ['9007199254740991 × 2 =', '18014398509481982'],
    ])('leaves unsupported or inconsistent %s (%j) to the existing engine', (question, answer) => {
        expect(generateWrittenArithmeticGrid(question, answer)).toBeNull();
    });

    it('handles safe-integer boundary division exactly', () => {
        const grid = gridFor('9007199254740991 ÷ 9 =', ['1000799917193443', '4']);
        expect(grid.steps.filter(step => step.phase === 'quotient').map(writtenNumber).join('')).toBe('1000799917193443');
        expect(writtenNumber(grid.steps.at(-1)!)).toBe('4');
        assertGridContract(grid);
    });

    it('maintains digit alignment and arithmetic identities across varying dividend prefixes', () => {
        for (const divisor of [1, 2, 7, 9, 12, 24, 47, 99]) {
            for (const dividend of [0, 1, 9, 10, 19, 99, 100, 108, 201, 499, 700, 990, 999]) {
                const quotient = Math.floor(dividend / divisor);
                const remainder = dividend % divisor;
                const grid = gridFor(`${dividend} ÷ ${divisor} =`, [String(quotient), String(remainder)]);
                const quotientSteps = grid.steps.filter(step => step.phase === 'quotient');
                expect(quotientSteps.map(writtenNumber).join('')).toBe(String(quotient));
                expect(writtenNumber(grid.steps.at(-1)!)).toBe(String(remainder));
                expect(quotientSteps.at(-1)?.inputCellIndices).toEqual([String(dividend).length - 1]);
                assertGridContract(grid);
            }
        }
    });
});
