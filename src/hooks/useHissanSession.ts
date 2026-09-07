import { useState, useCallback, useRef } from 'react';
import { Problem } from '../domain/types';
import { HissanGridData, isHissanEligible } from '../domain/math/hissanTypes';
import { generateHissanGrid } from '../domain/math/hissanEngine';
import { generateWrittenArithmeticGrid } from '../domain/math/writtenArithmetic';
import { useTimeoutScheduler } from './useTimeoutScheduler';

type StepFeedback = 'none' | 'correct' | 'incorrect';
type EnterResult = 'step-correct' | 'all-correct' | 'incorrect' | 'incomplete';

interface HissanSessionState {
    isHissanActive: boolean;
    isHissanEligibleSkill: boolean;
    isForcedHissanSkill: boolean;
    gridData: HissanGridData | null;
    currentStepIndex: number;
    activeCellPos: [number, number] | null;
    userValues: Map<string, string>;
    stepFeedback: StepFeedback;
    cursorIndex: number;
}

const emptySession = (): HissanSessionState => ({
    isHissanActive: false,
    isHissanEligibleSkill: false,
    isForcedHissanSkill: false,
    gridData: null,
    currentStepIndex: 0,
    activeCellPos: null,
    userValues: new Map(),
    stepFeedback: 'none',
    cursorIndex: 0,
});

const clearCurrentStep = (state: HissanSessionState): HissanSessionState => {
    const step = state.gridData?.steps[state.currentStepIndex];
    if (!step) return state;
    const userValues = new Map(state.userValues);
    for (const col of step.inputCellIndices) userValues.delete(`${step.rowIndex}-${col}`);
    return {
        ...state, userValues, cursorIndex: 0, stepFeedback: 'none',
        activeCellPos: [step.rowIndex, step.inputCellIndices[0]],
    };
};

/** Own pending input synchronously so consecutive native key events cannot reuse a stale cell. */
export const useHissanSession = () => {
    const [state, setState] = useState(emptySession);
    const pending = useRef(state);
    const { scheduleTimeout, clearScheduledTimeouts } = useTimeoutScheduler();
    const publish = useCallback((next: HissanSessionState) => {
        pending.current = next;
        setState(next);
    }, []);

    const resetHissan = useCallback((problem: Problem | undefined, hissanEnabled: boolean) => {
        clearScheduledTimeouts();
        const next = emptySession();
        if (problem?.subject === 'math' && problem.inputType !== 'choice' && problem.questionText) {
            const eligible = isHissanEligible(problem.categoryId) || ['div_rem_q1', 'div_rem_q2'].includes(problem.categoryId);
            if (eligible) {
                // Build while disabled as well: the child can open written work from mental mode.
                const written = /^(mul|div)_/.test(problem.categoryId)
                    ? generateWrittenArithmeticGrid(problem.questionText, problem.correctAnswer) : null;
                next.gridData = written
                    ?? generateHissanGrid(problem.categoryId, problem.questionText,
                        Array.isArray(problem.correctAnswer) ? problem.correctAnswer.join('') : problem.correctAnswer);
                next.isHissanEligibleSkill = Boolean(next.gridData);
                next.isForcedHissanSkill = Boolean(next.gridData)
                    && (problem.categoryId.includes('_hissan') || problem.categoryId.includes('_algorithm'));
                next.isHissanActive = Boolean(next.gridData) && (next.isForcedHissanSkill || hissanEnabled);
                const firstStep = next.gridData?.steps[0];
                if (firstStep) next.activeCellPos = [firstStep.rowIndex, firstStep.inputCellIndices[0]];
            }
        }
        publish(next);
    }, [clearScheduledTimeouts, publish]);

    const handleHissanInput = useCallback((val: number | string) => {
        const current = pending.current;
        const step = current.gridData?.steps[current.currentStepIndex];
        if (!current.isHissanActive || !step || current.stepFeedback !== 'none' || !current.activeCellPos) return;
        const col = step.inputCellIndices[current.cursorIndex];
        const expected = step.correctValues[current.cursorIndex];
        const value = String(val);
        if (col === undefined || !expected || !/^[0-9.]$/.test(value)) return;
        if (expected === '.' ? value !== '.' : !/^[0-9]$/.test(value)) return;
        const userValues = new Map(current.userValues);
        userValues.set(`${step.rowIndex}-${col}`, value);
        const hasNext = current.cursorIndex + 1 < step.inputCellIndices.length;
        const cursorIndex = hasNext ? current.cursorIndex + 1 : current.cursorIndex;
        publish({ ...current, userValues, cursorIndex,
            activeCellPos: hasNext ? [step.rowIndex, step.inputCellIndices[cursorIndex]] : null });
    }, [publish]);

    const handleHissanBackspace = useCallback(() => {
        const current = pending.current;
        const step = current.gridData?.steps[current.currentStepIndex];
        if (!current.isHissanActive || !step || current.stepFeedback !== 'none') return;
        let cursorIndex = current.cursorIndex;
        const key = `${step.rowIndex}-${step.inputCellIndices[cursorIndex]}`;
        if (!current.userValues.get(key) && cursorIndex > 0) cursorIndex -= 1;
        const col = step.inputCellIndices[cursorIndex];
        const userValues = new Map(current.userValues);
        userValues.delete(`${step.rowIndex}-${col}`);
        publish({ ...current, userValues, cursorIndex, activeCellPos: [step.rowIndex, col] });
    }, [publish]);

    const handleHissanClear = useCallback(() => {
        const current = pending.current;
        if (current.isHissanActive && current.stepFeedback === 'none') publish(clearCurrentStep(current));
    }, [publish]);

    const handleHissanCursorMove = useCallback((direction: 'left' | 'right') => {
        const current = pending.current;
        const step = current.gridData?.steps[current.currentStepIndex];
        if (!current.isHissanActive || !step || current.stepFeedback !== 'none') return;
        const col = step.inputCellIndices[current.cursorIndex];
        // Input order varies by operation; arrows always follow the visible column direction.
        const candidates = step.inputCellIndices.filter(c => direction === 'left' ? c < col : c > col);
        const nextCol = candidates.length ? (direction === 'left' ? Math.max(...candidates) : Math.min(...candidates)) : col;
        publish({ ...current, cursorIndex: step.inputCellIndices.indexOf(nextCol), activeCellPos: [step.rowIndex, nextCol] });
    }, [publish]);

    const handleHissanEnter = useCallback((): EnterResult => {
        const current = pending.current;
        const grid = current.gridData;
        const step = grid?.steps[current.currentStepIndex];
        if (!current.isHissanActive || !grid || !step || current.stepFeedback !== 'none') return 'incomplete';
        const emptyIndex = step.inputCellIndices.findIndex(col => !current.userValues.get(`${step.rowIndex}-${col}`));
        if (emptyIndex >= 0) {
            publish({ ...current, cursorIndex: emptyIndex, activeCellPos: [step.rowIndex, step.inputCellIndices[emptyIndex]] });
            return 'incomplete';
        }
        const correct = step.correctValues.every((value, i) => current.userValues.get(`${step.rowIndex}-${step.inputCellIndices[i]}`) === value);
        if (!correct) {
            const failed = { ...current, stepFeedback: 'incorrect' as const };
            publish(failed);
            scheduleTimeout(() => {
                // A new problem or a mode switch may already have replaced the failed state.
                if (pending.current === failed) publish(clearCurrentStep(failed));
            }, 800);
            return 'incorrect';
        }
        const nextStepIndex = current.currentStepIndex + 1;
        const nextStep = grid.steps[nextStepIndex];
        if (nextStep) {
            publish({ ...current, currentStepIndex: nextStepIndex, cursorIndex: 0,
                activeCellPos: [nextStep.rowIndex, nextStep.inputCellIndices[0]] });
            return 'step-correct';
        }
        publish({ ...current, stepFeedback: 'correct', activeCellPos: null });
        return 'all-correct';
    }, [publish, scheduleTimeout]);

    const handleCellClick = useCallback((rowIndex: number, colIndex: number) => {
        const current = pending.current;
        const step = current.gridData?.steps[current.currentStepIndex];
        if (!current.isHissanActive || !step || current.stepFeedback !== 'none' || rowIndex !== step.rowIndex) return;
        const cursorIndex = step.inputCellIndices.indexOf(colIndex);
        if (cursorIndex >= 0) publish({ ...current, cursorIndex, activeCellPos: [rowIndex, colIndex] });
    }, [publish]);

    const toggleHissanMode = useCallback(() => {
        const current = pending.current;
        if (!current.gridData || current.isForcedHissanSkill) return;
        clearScheduledTimeouts();
        const next = current.stepFeedback === 'incorrect' ? clearCurrentStep(current) : current;
        publish({ ...next, isHissanActive: !current.isHissanActive });
    }, [clearScheduledTimeouts, publish]);

    const retryHissanSave = useCallback(() => {
        const current = pending.current;
        if (current.stepFeedback === 'correct') publish({ ...current, stepFeedback: 'none' });
    }, [publish]);

    return {
        ...state,
        canToggleHissanMode: state.isHissanEligibleSkill && !state.isForcedHissanSkill,
        canInputDecimal: state.gridData?.steps[state.currentStepIndex]?.correctValues.includes('.') ?? false,
        handleHissanInput,
        handleHissanBackspace,
        handleHissanClear,
        handleHissanCursorMove,
        handleHissanEnter,
        handleCellClick,
        toggleHissanMode,
        retryHissanSave,
        resetHissan,
    };
};
