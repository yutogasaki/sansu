// ============================================================
// 筆算エンジン — 足し算・引き算のステップ分解
// ============================================================
import { HissanGridData, HissanRow, HissanCell, HissanStep } from './hissanTypes';

/**
 * 数値を各桁に分解（右から左の順）
 * 123 → ['3', '2', '1']
 */
const toDigits = (n: number): string[] => {
    return Math.abs(n).toString().split('').reverse();
};

/**
 * セルを作成するヘルパー
 */
const fixedCell = (value: string): HissanCell => ({
    state: 'fixed', value
});

const emptyCell = (): HissanCell => ({
    state: 'empty', value: ''
});

const inputCell = (correctValue: string): HissanCell => ({
    state: 'empty', value: '', correctValue
});

// ============================================================
// 足し算の筆算
// ============================================================

/**
 * 足し算の筆算グリッドを生成
 *
 * 例: 456 + 789 = 1245
 *
 *     [ ][ ][4][5][6]
 *     [+][ ][7][8][9]
 *     ───────────────
 *     [1][2][4][5]     ← 入力行（結果）
 */
export const generateAdditionGrid = (a: number, b: number): HissanGridData => {
    const sum = a + b;
    const aDigits = toDigits(a);
    const bDigits = toDigits(b);
    const sumDigits = toDigits(sum);

    // 列数は答えの桁数 + 1（演算子列）
    const maxDigits = sumDigits.length;
    const columnCount = maxDigits + 1; // +1 for operator column

    // 行1: 被加数 (a)
    const row1Cells: HissanCell[] = [];
    for (let col = 0; col < columnCount; col++) {
        const digitIdx = columnCount - 1 - col; // 右から何桁目
        if (digitIdx < aDigits.length) {
            row1Cells.push(fixedCell(aDigits[digitIdx]));
        } else {
            row1Cells.push(emptyCell());
        }
    }
    const row1: HissanRow = { cells: row1Cells, type: 'operand' };

    // 行2: 演算子 + 加数 (b)
    const row2Cells: HissanCell[] = [];
    for (let col = 0; col < columnCount; col++) {
        if (col === 0) {
            row2Cells.push(fixedCell('+'));
        } else {
            const digitIdx = columnCount - 1 - col;
            if (digitIdx < bDigits.length) {
                row2Cells.push(fixedCell(bDigits[digitIdx]));
            } else {
                row2Cells.push(emptyCell());
            }
        }
    }
    const row2: HissanRow = { cells: row2Cells, type: 'operator' };

    // 行3: 区切り線
    const separatorRow: HissanRow = {
        cells: Array(columnCount).fill(null).map(() => fixedCell('─')),
        type: 'separator'
    };

    // 行4: 結果入力行
    const resultCells: HissanCell[] = [];
    const inputIndices: number[] = [];
    const correctValues: string[] = [];

    for (let col = 0; col < columnCount; col++) {
        const digitIdx = columnCount - 1 - col;
        if (digitIdx < sumDigits.length) {
            resultCells.push(inputCell(sumDigits[digitIdx]));
            inputIndices.push(col);
            correctValues.push(sumDigits[digitIdx]);
        } else {
            resultCells.push(emptyCell());
        }
    }
    const resultRow: HissanRow = { cells: resultCells, type: 'result', stepIndex: 0 };

    // 入力順は右から左
    const orderedInputIndices = [...inputIndices].reverse();
    const orderedCorrectValues = [...correctValues].reverse();

    const step: HissanStep = {
        index: 0,
        description: `${a} + ${b} の答えを入力`,
        rowIndex: 3,
        inputCellIndices: orderedInputIndices,
        correctValues: orderedCorrectValues,
    };

    return {
        rows: [row1, row2, separatorRow, resultRow],
        steps: [step],
        columnCount,
        operation: 'addition',
        finalAnswer: sum.toString(),
    };
};

// ============================================================
// 引き算の筆算
// ============================================================

/**
 * 引き算の筆算グリッドを生成
 *
 * 例: 834 - 567 = 267
 *
 *     [8][3][4]
 *     [-][5][6][7]
 *     ─────────
 *     [2][6][7]     ← 入力行（結果）
 */
export const generateSubtractionGrid = (a: number, b: number): HissanGridData => {
    const diff = a - b;
    const aDigits = toDigits(a);
    const bDigits = toDigits(b);
    const diffDigits = toDigits(diff);

    // 列数は大きい方の桁数 + 1（演算子列）
    const maxDigits = Math.max(aDigits.length, bDigits.length);
    const columnCount = maxDigits + 1;

    // 行1: 被減数 (a)
    const row1Cells: HissanCell[] = [];
    for (let col = 0; col < columnCount; col++) {
        const digitIdx = columnCount - 1 - col;
        if (digitIdx < aDigits.length) {
            row1Cells.push(fixedCell(aDigits[digitIdx]));
        } else {
            row1Cells.push(emptyCell());
        }
    }
    const row1: HissanRow = { cells: row1Cells, type: 'operand' };

    // 行2: 演算子 + 減数 (b)
    const row2Cells: HissanCell[] = [];
    for (let col = 0; col < columnCount; col++) {
        if (col === 0) {
            row2Cells.push(fixedCell('−'));
        } else {
            const digitIdx = columnCount - 1 - col;
            if (digitIdx < bDigits.length) {
                row2Cells.push(fixedCell(bDigits[digitIdx]));
            } else {
                row2Cells.push(emptyCell());
            }
        }
    }
    const row2: HissanRow = { cells: row2Cells, type: 'operator' };

    // 行3: 区切り線
    const separatorRow: HissanRow = {
        cells: Array(columnCount).fill(null).map(() => fixedCell('─')),
        type: 'separator'
    };

    // 行4: 結果入力行
    const resultCells: HissanCell[] = [];
    const inputIndices: number[] = [];
    const correctValues: string[] = [];

    for (let col = 0; col < columnCount; col++) {
        const digitIdx = columnCount - 1 - col;
        if (digitIdx < diffDigits.length) {
            resultCells.push(inputCell(diffDigits[digitIdx]));
            inputIndices.push(col);
            correctValues.push(diffDigits[digitIdx]);
        } else {
            resultCells.push(emptyCell());
        }
    }
    const resultRow: HissanRow = { cells: resultCells, type: 'result', stepIndex: 0 };

    // 入力順は右から左
    const orderedInputIndices = [...inputIndices].reverse();
    const orderedCorrectValues = [...correctValues].reverse();

    const step: HissanStep = {
        index: 0,
        description: `${a} - ${b} の答えを入力`,
        rowIndex: 3,
        inputCellIndices: orderedInputIndices,
        correctValues: orderedCorrectValues,
    };

    return {
        rows: [row1, row2, separatorRow, resultRow],
        steps: [step],
        columnCount,
        operation: 'subtraction',
        finalAnswer: diff.toString(),
    };
};

// ============================================================
// スキルIDからグリッドを生成するメインエントリ
// ============================================================

/**
 * 問題文字列からオペランドを抽出
 * "456 + 789 =" → { a: 456, b: 789, op: '+' }
 */
export const parseQuestionText = (questionText: string): { a: number; b: number; op: string } | null => {
    // "a + b =" or "a - b =" or "a × b =" or "a ÷ b ="
    const match = questionText.match(/^(\d+(?:\.\d+)?)\s*([+\-−×÷])\s*(\d+(?:\.\d+)?)\s*=/);
    if (!match) return null;

    return {
        a: parseFloat(match[1]),
        b: parseFloat(match[3]),
        op: match[2],
    };
};

/**
 * スキルIDと問題テキストから筆算グリッドを生成
 */
export const generateHissanGrid = (
    _skillId: string,
    questionText: string,
): HissanGridData | null => {
    const parsed = parseQuestionText(questionText);
    if (!parsed) return null;

    const { a, b, op } = parsed;

    // Phase 1: 足し算・引き算
    if (op === '+') {
        return generateAdditionGrid(a, b);
    }
    if (op === '-' || op === '−') {
        return generateSubtractionGrid(a, b);
    }

    // Phase 2/3: 未実装
    // if (op === '×') return generateMultiplicationGrid(a, b);
    // if (op === '÷') return generateDivisionGrid(a, b);

    return null;
};
