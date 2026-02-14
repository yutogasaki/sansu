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
    /** このステップで入力するセルのインデックス一覧（右から左） */
    inputCellIndices: number[];
    /** 各セルの正解値 */
    correctValues: string[];
}

/**
 * 筆算グリッド全体の定義
 */
export interface HissanGridData {
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
}

/**
 * 筆算対象スキルの判定に使うスキルID一覧
 */
export const HISSAN_ELIGIBLE_SKILLS: ReadonlySet<string> = new Set([
    // Phase 1: 足し算・引き算
    'add_3d3d', 'add_4d',
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
