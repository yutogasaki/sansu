import type { HissanGridData } from './hissanTypes';

export interface PlaceDigit { value: string; column: number; sourceColumn?: number; point: boolean; padding: boolean }
const fractionLength = (value: string) => value.split('.')[1]?.length ?? 0;
/** Decimal shifting is string based, so 0.29 never becomes 28.999… . */
export function shiftWrittenDecimal(value: string, places: number): string {
    const [integer, fraction = ''] = value.split('.');
    const digits = integer + fraction.padEnd(places, '0');
    const split = integer.length + places;
    const left = digits.slice(0, split).replace(/^0+(?=\d)/, '') || '0';
    const right = digits.slice(split);
    return left + (right ? `.${right}` : '');
}
export function writtenPlaceValue(grid: HissanGridData) {
    const operands = grid.operandTexts ?? grid.rows.filter(row => row.type === 'operand' || row.type === 'operator')
        .slice(0, 2).map(row => row.cells.map(cell => /^[\d.]$/.test(cell.value) ? cell.value : '').join('')) as [string, string];
    const shift = grid.operation === 'division' ? fractionLength(operands[1]) : 0;
    const shown = operands.map(value => shiftWrittenDecimal(value, shift));
    const step = grid.steps[0];
    const ordered = step.inputCellIndices.map((column, index) => ({ column, value: step.correctValues[index] })).sort((a, b) => a.column - b.column);
    const answer = ordered.map(cell => cell.value).join('');
    const texts = grid.operation === 'division' ? [shown[0], answer] : [...shown, answer];
    const alignPoint = grid.operation !== 'multiplication';
    const fractions = alignPoint ? Math.max(...texts.map(fractionLength)) : 0;
    const columns = alignPoint ? Math.max(...texts.map(text => text.split('.')[0].length)) + fractions : Math.max(...texts.map(text => text.replace('.', '').length));
    const digits = (text: string, result = false): PlaceDigit[] => {
        const [integer, fraction = ''] = text.split('.');
        const content = integer + fraction;
        const start = alignPoint ? columns - fractions - integer.length : columns - content.length;
        const source = ordered.filter(cell => cell.value !== '.');
        const cells = [...content].map((value, index) => ({ value, column: start + index,
            sourceColumn: result ? source[index]?.column : undefined,
            point: index === integer.length - 1 && (alignPoint ? fractions > 0 : fraction.length > 0), padding: false }));
        if (alignPoint) for (let index = fraction.length; index < fractions; index++) cells.push({ value: '0', column: columns - fractions + index, sourceColumn: undefined, point: false, padding: true });
        return cells;
    };
    return { columns, operands: shown.map(text => digits(text)), result: digits(answer, true), divisor: shown[1],
        normalization: shift ? `${operands[0]} ÷ ${operands[1]} → ${shown[0]} ÷ ${shown[1]}` : undefined };
}
