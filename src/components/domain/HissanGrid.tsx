import React from "react";
import { HissanGridData, HissanStep } from "../../domain/math/hissanTypes";
import { HissanCellView } from "./HissanCell";
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
    const currentStep: HissanStep | undefined = gridData.steps[currentStepIndex];

    if (gridData.writtenLayout) return <WrittenArithmeticGrid gridData={gridData}
        currentStepIndex={currentStepIndex} activeCellPos={activeCellPos} userValues={userValues}
        onCellClick={onCellClick} stepFeedback={stepFeedback} correcting={correcting} disabled={disabled} />;

    return (
        <div className="flex flex-col items-center gap-0.5 p-2">
            {gridData.rows.map((row, rowIdx) => (
                <div key={rowIdx} className="flex gap-0.5">
                    {row.cells.map((cell, colIdx) => {
                        const cellKey = `${rowIdx}-${colIdx}`;
                        const userValue = userValues.get(cellKey);

                        // セル状態の決定
                        let displayCell = { ...cell };

                        // ユーザーが入力した値がある場合
                        if (userValue !== undefined && userValue !== '') {
                            displayCell = {
                                ...displayCell,
                                value: userValue,
                                state: 'filled',
                            };
                        }

                        // 前のステップで完了済みのセルはロック
                        if (
                            row.stepIndex !== undefined &&
                            row.stepIndex < currentStepIndex &&
                            displayCell.correctValue !== undefined &&
                            displayCell.state !== 'empty'
                        ) {
                            displayCell = {
                                ...displayCell,
                                state: 'locked',
                            };
                        }

                        // 不正解フィードバック
                        if (
                            stepFeedback === 'incorrect' &&
                            currentStep &&
                            currentStep.rowIndex === rowIdx &&
                            currentStep.inputCellIndices.includes(colIdx)
                        ) {
                            // 不正解時はセルをハイライト（赤系）
                            // これはCSSクラスで対応
                        }

                        // アクティブセルの判定
                        const isActive =
                            activeCellPos !== null &&
                            activeCellPos[0] === rowIdx &&
                            activeCellPos[1] === colIdx;

                        return (
                            <HissanCellView
                                key={cellKey}
                                cell={displayCell}
                                isActive={isActive}
                                onClick={() => onCellClick(rowIdx, colIdx)}
                                size="md"
                            />
                        );
                    })}
                </div>
            ))}
        </div>
    );
};
