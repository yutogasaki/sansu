// ============================================================
// 筆算モード型定義
// ============================================================

/**
 * 筆算グリッドの1セル
 */
export interface HissanCell {
    /** セルの状態 */
    state: 'fixed' | 'active' | 'filled' | 'locked' | 'empty';
    /** 表示値（数字 or 演算子 or 空） */
    value: string;
    /** 正解値（入力セルの場合） */
    correctValue?: string;
    /** 小数点を右に表示するか */
    hasDecimalPoint?: boolean;
}

/**
 * 筆算の行
 */
export interface HissanRow {
    cells: HissanCell[];
    /** 行の種類 */
    type: 'operand' | 'operator' | 'separator' | 'input' | 'result';
    /** ステップインデックス（入力行の場合、どのステップに属するか） */
    stepIndex?: number;
    /** 新しい筆算面で使う短い行名 */
    label?: string;
    /** 固定の途中式を答えより先に見せないための表示開始ステップ */
    visibleFromStep?: number;
    /** この行の上に計算線を表示する */
    lineAbove?: boolean;
}

/**
 * 筆算の1ステップ（ユーザーが入力する単位）
 */
export interface HissanStep {
    /** ステップのインデックス */
    index: number;
    /** ステップの説明（デバッグ用） */
    description: string;
    /** このステップで入力する行インデックス */
    rowIndex: number;
    /** このステップで入力するセルのインデックス一覧（保存・採点順。表示の入力順は writtenInputOrder で求める） */
    inputCellIndices: number[];
    /** 各セルの正解値 */
    correctValues: string[];
    /** 新しい筆算面の現在の操作 */
    phase?: 'multiply' | 'sum' | 'quotient' | 'subtract' | 'bring-down' | 'remainder';
    /** 現在の一手を示す短文 */
    hint?: string;
    /** 現在の計算で参照するセル [行, 列] */
    focusCells?: [number, number][];
}

/**
 * 筆算グリッド全体の定義
 */
export interface HissanGridData {
    /** Full operands for presentation; old row/column coordinates stay unchanged. */
    operandTexts?: [string, string];
    /** グリッドの行一覧 */
    rows: HissanRow[];
    /** ステップ一覧（入力順） */
    steps: HissanStep[];
    /** 列数 */
    columnCount: number;
    /** 演算の種類 */
    operation: 'addition' | 'subtraction' | 'multiplication' | 'division';
    /** 最終回答（従来の correctAnswer と同じ値） */
    finalAnswer: string;
    /** 多段の整数筆算用。省略された既存グリッドの座標・表示は維持する。 */
    writtenLayout?: {
        kind: 'multiplication' | 'division';
        expression: string;
        /** 割る数はグリッドの左、囲みの外に描画する。 */
        divisor?: string;
        dividendRow?: number;
        quotientRow?: number;
        dividendStartColumn?: number;
    };
}

/**
 * 筆算対象スキルの判定に使うスキルID一覧
 */
export const HISSAN_ELIGIBLE_SKILLS: ReadonlySet<string> = new Set([
    // Phase 1: 足し算・引き算
    'add_2d1d_hissan_nc', 'add_2d1d_nc', 'add_2d1d_hissan_c', 'add_2d1d_c', 'add_2d2d_nc', 'add_2d2d_c',
    'add_3d3d', 'add_4d',
    'sub_2d1d_hissan_nc', 'sub_2d1d_nc', 'sub_2d1d_hissan_c', 'sub_2d1d_c', 'sub_2d2d',
    'sub_3d3d', 'sub_4d',
    // Phase 2: 掛け算
    'mul_2d1d', 'mul_3d1d', 'mul_2d2d', 'mul_3d2d',
    // Phase 3: 割り算
    'div_2d1d_exact', 'div_3d1d_exact', 'div_2d2d_exact', 'div_3d2d_exact',
    // Phase 3: 小数
    'dec_add', 'dec_sub', 'dec_mul_int', 'dec_div_int', 'dec_mul_dec', 'dec_div_dec',
]);

/**
 * スキルIDが筆算対象かどうか判定
 */
export const isHissanEligible = (skillId: string): boolean => {
    return HISSAN_ELIGIBLE_SKILLS.has(skillId);
};
