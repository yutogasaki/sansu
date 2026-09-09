import React from "react";
import { HissanGridData } from "../../domain/math/hissanTypes";
import { PlaceValueArithmeticGrid } from "./PlaceValueArithmeticGrid";
import { WrittenArithmeticGrid } from './WrittenArithmeticGrid';

export interface HissanGridProps {
    /** グリッドデータ */
    gridData: HissanGridData;
    /** 現在のステップインデックス */
    currentStepIndex: number;
    /** 現在アクティブなセルの位置 [rowIndex, colIndex] */
    activeCellPos: [number, number] | null;
    /** ユーザーの入力状態（各ステップの各セルの値） */
    userValues: Map<string, string>; // key: "row-col"
    /** セルタップハンドラ */
    onCellClick: (rowIndex: number, colIndex: number) => void;
    /** フィードバック状態 */
    stepFeedback?: 'none' | 'correct' | 'incorrect';
    correcting?: boolean;
    disabled?: boolean;
}

/**
 * 筆算グリッド全体のコンポーネント
 */
export const HissanGrid: React.FC<HissanGridProps> = ({
    gridData,
    currentStepIndex,
    activeCellPos,
    userValues,
    onCellClick,
    stepFeedback = 'none',
    correcting = false,
    disabled = false,
}) => {

    if (gridData.writtenLayout) return <WrittenArithmeticGrid gridData={gridData}
        currentStepIndex={currentStepIndex} activeCellPos={activeCellPos} userValues={userValues}
        onCellClick={onCellClick} stepFeedback={stepFeedback} correcting={correcting} disabled={disabled} />;

    return <PlaceValueArithmeticGrid gridData={gridData} currentStepIndex={currentStepIndex}
        activeCellPos={activeCellPos} userValues={userValues} onCellClick={onCellClick}
        stepFeedback={stepFeedback} correcting={correcting} disabled={disabled} />;
};
