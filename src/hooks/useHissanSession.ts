import { useState, useCallback, useMemo } from 'react';
import { Problem } from '../domain/types';
import { HissanGridData, HissanStep, isHissanEligible } from '../domain/math/hissanTypes';
import { generateHissanGrid } from '../domain/math/hissanEngine';

interface UseHissanSessionReturn {
    /** 筆算モードがアクティブか */
    isHissanActive: boolean;
    /** このスキルが筆算対象か */
    isHissanEligibleSkill: boolean;
    /** 筆算グリッドデータ */
    gridData: HissanGridData | null;
    /** 現在のステップインデックス */
    currentStepIndex: number;
    /** アクティブセル位置 */
    activeCellPos: [number, number] | null;
    /** ユーザー入力値 */
    userValues: Map<string, string>;
    /** ステップフィードバック */
    stepFeedback: 'none' | 'correct' | 'incorrect';
    /** テンキー入力ハンドラ */
    handleHissanInput: (val: number | string) => void;
    /** バックスペースハンドラ */
    handleHissanBackspace: () => void;
    /** クリアハンドラ */
    handleHissanClear: () => void;
    /** カーソル移動ハンドラ */
    handleHissanCursorMove: (direction: "left" | "right") => void;
    /** 確定ハンドラ（ステップ正誤判定） - returns true if final step correct, false otherwise */
    handleHissanEnter: () => 'step-correct' | 'all-correct' | 'incorrect';
    /** セルタップハンドラ */
    handleCellClick: (rowIndex: number, colIndex: number) => void;
    /** 筆算/暗算トグル */
    toggleHissanMode: () => void;
    /** 筆算モードリセット（新問題時） */
    resetHissan: (problem: Problem | undefined, hissanEnabled: boolean) => void;
}

/**
 * 筆算セッション管理フック
 */
export const useHissanSession = (): UseHissanSessionReturn => {
    const [isHissanActive, setIsHissanActive] = useState(false);
    const [isHissanEligibleSkill, setIsHissanEligibleSkill] = useState(false);
    const [gridData, setGridData] = useState<HissanGridData | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [activeCellPos, setActiveCellPos] = useState<[number, number] | null>(null);
    const [userValues, setUserValues] = useState<Map<string, string>>(new Map());
    const [stepFeedback, setStepFeedback] = useState<'none' | 'correct' | 'incorrect'>('none');

    // 現在のステップの入力セル一覧（アクティブなセル内でのカーソル位置を管理）
    const [cursorIndex, setCursorIndex] = useState(0);

    const currentStep: HissanStep | undefined = useMemo(
        () => gridData?.steps[currentStepIndex],
        [gridData, currentStepIndex]
    );

    /**
     * 新問題に切り替わった時のリセット
     */
    const resetHissan = useCallback((problem: Problem | undefined, hissanEnabled: boolean) => {
        if (!problem) {
            setIsHissanActive(false);
            setIsHissanEligibleSkill(false);
            setGridData(null);
            return;
        }

        const eligible = problem.subject === 'math' && isHissanEligible(problem.categoryId);
        setIsHissanEligibleSkill(eligible);

        if (eligible && hissanEnabled && problem.questionText) {
            const grid = generateHissanGrid(problem.categoryId, problem.questionText);
            if (grid) {
                setGridData(grid);
                setCurrentStepIndex(0);
                setUserValues(new Map());
                setStepFeedback('none');
                setCursorIndex(0);
                setIsHissanActive(true);

                // 最初のステップの最初の入力セルをアクティブにする
                if (grid.steps.length > 0) {
                    const firstStep = grid.steps[0];
                    const firstCellCol = firstStep.inputCellIndices[0];
                    setActiveCellPos([firstStep.rowIndex, firstCellCol]);
                }
                return;
            }
        }

        setIsHissanActive(false);
        setGridData(null);
    }, []);

    /**
     * テンキー入力
     */
    const handleHissanInput = useCallback((val: number | string) => {
        if (!currentStep || !gridData || stepFeedback !== 'none') return;

        const digit = String(val);
        if (!/^[0-9]$/.test(digit)) return;

        const cellCol = currentStep.inputCellIndices[cursorIndex];
        if (cellCol === undefined) return;

        const cellKey = `${currentStep.rowIndex}-${cellCol}`;

        setUserValues(prev => {
            const next = new Map(prev);
            next.set(cellKey, digit);
            return next;
        });

        // 次のセルへ移動
        const nextCursorIndex = cursorIndex + 1;
        if (nextCursorIndex < currentStep.inputCellIndices.length) {
            setCursorIndex(nextCursorIndex);
            const nextCellCol = currentStep.inputCellIndices[nextCursorIndex];
            setActiveCellPos([currentStep.rowIndex, nextCellCol]);
        } else {
            // 最後のセルまで入力完了 → アクティブセルはそのまま
            setActiveCellPos(null);
        }
    }, [currentStep, gridData, cursorIndex, stepFeedback]);

    /**
     * バックスペース
     */
    const handleHissanBackspace = useCallback(() => {
        if (!currentStep || stepFeedback !== 'none') return;

        // 現在のセルが空なら前のセルに戻る
        const currentCellCol = currentStep.inputCellIndices[cursorIndex];
        const currentKey = `${currentStep.rowIndex}-${currentCellCol}`;
        const currentValue = userValues.get(currentKey);

        if (currentValue && currentValue !== '') {
            // 現在のセルをクリア
            setUserValues(prev => {
                const next = new Map(prev);
                next.delete(currentKey);
                return next;
            });
        } else if (cursorIndex > 0) {
            // 前のセルに戻ってクリア
            const prevIndex = cursorIndex - 1;
            const prevCellCol = currentStep.inputCellIndices[prevIndex];
            const prevKey = `${currentStep.rowIndex}-${prevCellCol}`;
            setUserValues(prev => {
                const next = new Map(prev);
                next.delete(prevKey);
                return next;
            });
            setCursorIndex(prevIndex);
            setActiveCellPos([currentStep.rowIndex, prevCellCol]);
        }
    }, [currentStep, cursorIndex, userValues, stepFeedback]);

    /**
     * クリア（現在ステップの入力をすべて消す）
     */
    const handleHissanClear = useCallback(() => {
        if (!currentStep || stepFeedback !== 'none') return;

        setUserValues(prev => {
            const next = new Map(prev);
            for (const col of currentStep.inputCellIndices) {
                next.delete(`${currentStep.rowIndex}-${col}`);
            }
            return next;
        });
        setCursorIndex(0);
        const firstCellCol = currentStep.inputCellIndices[0];
        setActiveCellPos([currentStep.rowIndex, firstCellCol]);
    }, [currentStep, stepFeedback]);

    /**
     * カーソル移動（左右）
     */
    const handleHissanCursorMove = useCallback((direction: "left" | "right") => {
        if (!currentStep || stepFeedback !== 'none') return;
        const lastIndex = currentStep.inputCellIndices.length - 1;
        if (lastIndex < 0) return;

        if (direction === "right") {
            setCursorIndex(prev => {
                const nextIndex = Math.min(prev + 1, lastIndex);
                setActiveCellPos([currentStep.rowIndex, currentStep.inputCellIndices[nextIndex]]);
                return nextIndex;
            });
            return;
        }

        setCursorIndex(prev => {
            const nextIndex = Math.max(prev - 1, 0);
            setActiveCellPos([currentStep.rowIndex, currentStep.inputCellIndices[nextIndex]]);
            return nextIndex;
        });
    }, [currentStep, stepFeedback]);

    /**
     * 確定（ステップ正誤判定）
     */
    const handleHissanEnter = useCallback((): 'step-correct' | 'all-correct' | 'incorrect' => {
        if (!currentStep || !gridData) return 'incorrect';

        // 全セルに値が入っているか確認
        const userAnswers: string[] = [];
        for (const col of currentStep.inputCellIndices) {
            const key = `${currentStep.rowIndex}-${col}`;
            const val = userValues.get(key);
            if (!val || val === '') {
                // 未入力セルがある場合 → 最初の空セルにフォーカス
                const emptyIdx = currentStep.inputCellIndices.findIndex(c => {
                    const k = `${currentStep.rowIndex}-${c}`;
                    return !userValues.get(k);
                });
                if (emptyIdx >= 0) {
                    setCursorIndex(emptyIdx);
                    setActiveCellPos([currentStep.rowIndex, currentStep.inputCellIndices[emptyIdx]]);
                }
                return 'incorrect';
            }
            userAnswers.push(val);
        }

        // 正誤判定
        const isCorrect = currentStep.correctValues.every(
            (correct, idx) => correct === userAnswers[idx]
        );

        if (isCorrect) {
            // 次のステップがあるか？
            const nextStepIdx = currentStepIndex + 1;
            if (nextStepIdx < gridData.steps.length) {
                // 次のステップへ
                setCurrentStepIndex(nextStepIdx);
                const nextStep = gridData.steps[nextStepIdx];
                setCursorIndex(0);
                setActiveCellPos([nextStep.rowIndex, nextStep.inputCellIndices[0]]);
                setStepFeedback('none');
                return 'step-correct';
            } else {
                // 全ステップ完了
                setStepFeedback('correct');
                setActiveCellPos(null);
                return 'all-correct';
            }
        } else {
            // 不正解 → クリアして最初から
            setStepFeedback('incorrect');
            setTimeout(() => {
                setStepFeedback('none');
                handleHissanClear();
            }, 800);
            return 'incorrect';
        }
    }, [currentStep, gridData, currentStepIndex, userValues, handleHissanClear]);

    /**
     * セルタップ
     */
    const handleCellClick = useCallback((rowIndex: number, colIndex: number) => {
        if (!currentStep || stepFeedback !== 'none') return;

        // 現在のステップの入力セルのみタップ可能
        if (rowIndex !== currentStep.rowIndex) return;

        const cellIdx = currentStep.inputCellIndices.indexOf(colIndex);
        if (cellIdx === -1) return;

        setCursorIndex(cellIdx);
        setActiveCellPos([rowIndex, colIndex]);
    }, [currentStep, stepFeedback]);

    /**
     * 筆算/暗算トグル
     */
    const toggleHissanMode = useCallback(() => {
        setIsHissanActive(prev => !prev);
    }, []);

    return {
        isHissanActive,
        isHissanEligibleSkill,
        gridData,
        currentStepIndex,
        activeCellPos,
        userValues,
        stepFeedback,
        handleHissanInput,
        handleHissanBackspace,
        handleHissanClear,
        handleHissanCursorMove,
        handleHissanEnter,
        handleCellClick,
        toggleHissanMode,
        resetHissan,
    };
};
