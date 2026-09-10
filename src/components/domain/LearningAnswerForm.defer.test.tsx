import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import type { LearningAnswerFormProps } from './LearningAnswerForm';

const hooks = vi.hoisted(() => {
    type Cell = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
    let cells: Cell[] = [], cursor = 0, dirty = false;
    const effects: (() => void)[] = [];
    return {
        reset() { cells = []; cursor = 0; dirty = false; effects.length = 0; },
        begin() { cursor = 0; dirty = false; },
        changed: () => dirty,
        useState(initial: unknown) {
            const i = cursor++;
            cells[i] ??= { value: typeof initial === 'function' ? initial() : initial };
            return [cells[i].value, (next: unknown) => {
                const value = typeof next === 'function' ? next(cells[i].value) : next;
                if (!Object.is(value, cells[i].value)) { cells[i].value = value; dirty = true; }
            }];
        },
        useRef(initial: unknown) { const i = cursor++; cells[i] ??= { value: { current: initial } }; return cells[i].value; },
        effect(callback: () => (() => void) | void, deps?: readonly unknown[]) {
            const i = cursor++, previous = cells[i];
            cells[i] ??= {};
            if (!deps || !previous?.deps || deps.some((value, j) => !Object.is(value, previous.deps?.[j]))) {
                cells[i].deps = deps;
                effects.push(() => { cells[i].cleanup?.(); cells[i].cleanup = callback() || undefined; });
            }
        },
        commit() { for (const effect of effects.splice(0)) effect(); },
        unmount() { for (const cell of cells) cell.cleanup?.(); },
    };
});
vi.mock('react', async importOriginal => ({ ...await importOriginal<typeof import('react')>(),
    useState: hooks.useState, useRef: hooks.useRef, useLayoutEffect: hooks.effect,
    useCallback: (callback: unknown) => callback,
    useMemo: (factory: () => unknown) => factory(),
}));
import { LearningAnswerForm } from './LearningAnswerForm';
import { TenKey } from './TenKey';
import { useHissanSession } from '../../hooks/useHissanSession';

beforeEach(() => { hooks.reset(); vi.stubGlobal('window', new EventTarget()); });
afterEach(() => { hooks.unmount(); vi.unstubAllGlobals(); });
function harness(problemOverride: Partial<LearningAnswerFormProps['slot']['problem']> = {}, initial: Partial<LearningAnswerFormProps> = {}) {
    let props: LearningAnswerFormProps = {
        slot: { problem: { id: 'written', subject: 'math', categoryId: 'mul_2d1d', questionText: '23 × 4 =',
            correctAnswer: '92', inputType: 'hissan', hissanVersion: 2, isReview: false, ...problemOverride },
        source: 'main', assisted: false, completed: false, countsTowardReviewCap: false },
        disabled: false, deferSubmission: true, onAnswer: vi.fn(), ...initial,
    };
    let tree: ReactElement;
    const render = (update: Partial<LearningAnswerFormProps> = {}) => {
        props = { ...props, ...update };
        for (let attempt = 0; attempt < 10; attempt++) {
            hooks.begin(); tree = LearningAnswerForm(props); hooks.commit();
            if (!hooks.changed()) return;
        }
        throw new Error('Render did not settle');
    };
    const find = (element: ReactElement, match: (element: ReactElement) => boolean = element => element.type === TenKey): ReactElement | undefined => {
        if (match(element)) return element;
        const children = (element.props as { children?: unknown }).children;
        for (const child of [children].flat(Infinity)) {
            if (child && typeof child === 'object' && 'type' in child) { const result = find(child as ReactElement, match); if (result) return result; }
        }
    };
    const keypad = () => find(tree)!.props as Parameters<typeof TenKey>[0];
    render();
    return { render, keypad, fieldValue(label: string) {
        const button = find(tree, element => element.type === 'button' && (element.props as { 'aria-label'?: string })['aria-label'] === label)!;
        const cells = find(button, element => 'shape' in (element.props as object))!;
        return (cells.props as { value: string }).value;
    }, select(label: string) {
        const button = find(tree, element => element.type === 'button' && (element.props as { 'aria-label'?: string })['aria-label'] === label);
        if (!button) throw new Error('No field: ' + label);
        (button.props as { onClick: () => void }).onClick(); render();
    }, get props() { return props; }, key(key: string, target?: Partial<HTMLElement>, repeat = false) {
        const event = Object.assign(new Event('keydown', { cancelable: true }), { key, repeat });
        if (target) Object.defineProperty(event, 'target', { value: target });
        window.dispatchEvent(event); render(); return event;
    } };
}

describe('written draft during a hint save', () => {
    it('accepts native keys and submits a full row once through the latest receipt callback', () => {
        const h = harness(), old = h.props.onAnswer, saved = vi.fn();
        expect(h.keypad().disabled).toBe(false);
        h.key('9'); h.key('2'); h.key('7');
        expect(old).not.toHaveBeenCalled();
        h.render({ deferSubmission: false, onAnswer: saved, slot: { ...h.props.slot, assisted: true } });
        h.render();
        expect(saved).toHaveBeenCalledTimes(1);
        expect(saved).toHaveBeenCalledWith(['2', '9']);
        expect(old).not.toHaveBeenCalled();
    });
    it('allows Backspace to cancel the queued row and waits for the missing digit', () => {
        const h = harness(), answer = h.props.onAnswer;
        h.key('9'); h.key('2'); h.key('Backspace');
        h.render({ deferSubmission: false });
        expect(answer).not.toHaveBeenCalled();
        h.key('2');
        expect(answer).toHaveBeenCalledTimes(1);
        expect(answer).toHaveBeenCalledWith(['2', '9']);
    });
    it('preserves partial input if a hint save fails without changing the slot', () => {
        const h = harness(), answer = h.props.onAnswer;
        h.key('9'); h.render({ deferSubmission: false }); h.key('2');
        expect(answer).toHaveBeenCalledTimes(1);
        expect(answer).toHaveBeenCalledWith(['2', '9']);
        expect(h.props.slot.assisted).toBe(false);
    });
    it('does not flush or accept keys when a model or answer save disables the form', () => {
        const h = harness(), answer = h.props.onAnswer;
        h.key('9'); h.key('2');
        h.render({ disabled: true, deferSubmission: false }); h.key('7');
        expect(h.keypad().disabled).toBe(true);
        expect(answer).not.toHaveBeenCalled();
    });
});


describe('Study manual decimal written session', () => {
    it('clears the whole failed decimal row and accepts a fresh answer without Enter', () => {
        const RenderHarness = () => { hooks.begin(); return useHissanSession(); };
        let session = RenderHarness();
        session.resetHissan({ id: 'decimal', subject: 'math', categoryId: 'dec_add', questionText: '12.3 + 4 =', correctAnswer: '16.3', inputType: 'hissan', isReview: false }, true);
        session = RenderHarness();
        expect(session.canInputDecimal).toBe(true);
        expect(session.handleHissanInput('1')).toBe(false);
        expect(session.handleHissanInput('.')).toBe(false);
        expect(session.handleHissanInput('9')).toBe(false);
        expect(session.handleHissanInput('.')).toBe(false);
        expect(session.handleHissanInput('3')).toBe(true);
        expect(session.handleHissanEnter()).toBe('incorrect');
        session = RenderHarness();
        expect([...session.userValues.values()]).toEqual([]);
        expect(session.handleHissanInput('1')).toBe(false);
        expect(session.handleHissanInput('6')).toBe(false);
        expect(session.handleHissanInput('.')).toBe(false);
        expect(session.handleHissanInput('3')).toBe(true);
        expect(session.handleHissanEnter()).toBe('all-correct');
        session.resetHissan({ id: 'decimal2', subject: 'math', categoryId: 'dec_add', questionText: '12.3 + 4 =', correctAnswer: '16.3', inputType: 'hissan', isReview: false }, true);
        session.handleHissanInput('8');
        session.handleHissanClear();
        session = RenderHarness();
        expect([...session.userValues.values()]).toEqual([]);
        expect(session.handleHissanInput('1')).toBe(false);
        session.handleHissanBackspace();
        expect(session.handleHissanInput('1')).toBe(false);
        expect(session.handleHissanInput('6')).toBe(false);
        expect(session.handleHissanInput('.')).toBe(false);
        session.handleHissanBackspace();
        expect(session.handleHissanInput('.')).toBe(false);
        expect(session.handleHissanInput('3')).toBe(true);
        expect(session.handleHissanEnter()).toBe('all-correct');
    });
});


describe('ordinary numeric entry', () => {
    it('advances at the visible field size, Backspace returns, and the final digit grades', () => {
        const h = harness({ categoryId: 'frac_add_same', questionText: '1/7 + 11/7 =', correctAnswer: ['12','7'], inputType: 'multi-number', hissanVersion: undefined,
            inputConfig: {fields:[{label:'分子',length:2},{label:'分母',length:2}]} });
        h.render({deferSubmission:false});
        expect(h.keypad().showDecimal).toBe(false);
        expect(h.keypad().nextFieldDisabled).toBe(false);
        h.key('1'); h.key('.'); h.key('2');
        expect(h.keypad().nextFieldDisabled).toBe(true);
        h.key('Backspace');
        expect(h.keypad().nextFieldDisabled).toBe(false);
        h.key('2');
        expect(h.keypad().nextFieldDisabled).toBe(true);
        expect(h.props.onAnswer).not.toHaveBeenCalled();
        h.key('7');
        expect(h.props.onAnswer).toHaveBeenCalledWith(['12','7']);
    });
    it('uses slash for a short numerator and rejects a physical decimal point', () => {
        const h = harness({ categoryId: 'frac_add_same', questionText: '1/4 + 1/4 =', correctAnswer: ['1','2'], inputType: 'multi-number', hissanVersion: undefined,
            inputConfig: {fields:[{label:'分子',length:2},{label:'分母',length:2}]} });
        h.render({deferSubmission:false}); h.key('1'); h.key('.'); h.key('2');
        expect(h.props.onAnswer).toHaveBeenCalledWith(['1','2']);
    });
});


describe('automatic ordinary answer events', () => {
    it.each(['3', '12', '123'])('grades %s at the last cell, even when the supplied answer is wrong', correctAnswer => {
        const h = harness({ categoryId: 'add_1d_1', questionText: '2 + 1 =', correctAnswer, inputType: 'number', hissanVersion: undefined });
        h.render({ deferSubmission: false });
        for (let i = 0; i < correctAnswer.length - 1; i++) { h.key('9'); expect(h.props.onAnswer).not.toHaveBeenCalled(); }
        h.key('Enter'); expect(h.props.onAnswer).not.toHaveBeenCalled();
        h.key('9');
        expect(h.props.onAnswer).toHaveBeenCalledTimes(1);
        expect(h.props.onAnswer).toHaveBeenCalledWith('9'.repeat(correctAnswer.length));
    });
    it('requires decimal input and permits deleting and entering the point before completion', () => {
        const h = harness({ categoryId: 'dec_add', correctAnswer: '12.3', inputType: 'number', hissanVersion: undefined });
        h.render({ deferSubmission: false });
        expect(h.keypad().showDecimal).toBe(true);
        h.key('1'); h.key('9'); h.key('Backspace'); h.key('2');
        expect(h.props.onAnswer).not.toHaveBeenCalled();
        h.key('3');
        expect(h.props.onAnswer).not.toHaveBeenCalled();
        h.key('.'); h.key('Backspace'); h.key('.'); h.key('3');
        expect(h.props.onAnswer).toHaveBeenCalledWith('12.3');
    });
    it('keeps the completed ordinary draft queued until the hint receipt settles', () => {
        const h = harness({ categoryId: 'add_1d_1', correctAnswer: '12', inputType: 'number', hissanVersion: undefined });
        h.key('1'); h.key('2'); h.key('9');
        expect(h.props.onAnswer).not.toHaveBeenCalled();
        h.key('Backspace'); h.render({ deferSubmission: false });
        expect(h.props.onAnswer).not.toHaveBeenCalled();
        h.key('3');
        expect(h.props.onAnswer).toHaveBeenCalledTimes(1);
        expect(h.props.onAnswer).toHaveBeenCalledWith('13');
    });
});


describe('automatic numeric save boundary', () => {
    it('latches before a second same-event digit and permits a failed-save resend', () => {
        const h = harness({ categoryId: 'add_1d_1', correctAnswer: '12', inputType: 'number', hissanVersion: undefined });
        h.render({ deferSubmission: false });
        const keys = h.keypad();
        keys.onInput('1'); keys.onInput('2'); keys.onInput('3'); keys.onEnter();
        expect(h.props.onAnswer).toHaveBeenCalledTimes(1);
        expect(h.props.onAnswer).toHaveBeenCalledWith('12');
        h.render({ disabled: true }); h.render({ disabled: false });
        expect(h.keypad().enterDisabled).toBe(false);
        h.key('Enter');
        expect(h.props.onAnswer).toHaveBeenCalledTimes(2);
        expect(h.props.onAnswer).toHaveBeenLastCalledWith('12');
    });
});


describe('answer-cell editing edge cases', () => {
    it('Backspace removes the entered point as a separate character', () => {
        const h = harness({ categoryId: 'dec_add', correctAnswer: '12.34', inputType: 'number', hissanVersion: undefined });
        h.render({ deferSubmission: false });
        h.key('1'); h.key('2'); h.key('.'); h.key('3'); h.key('Backspace'); h.key('Backspace'); h.key('Backspace');
        h.key('9'); h.key('.'); h.key('8'); h.key('7');
        expect(h.props.onAnswer).toHaveBeenCalledTimes(1);
        expect(h.props.onAnswer).toHaveBeenCalledWith('19.87');
    });
    it('treats slash as a separator without skipping the automatically selected field', () => {
        const h = harness({ categoryId: 'frac_mixed', correctAnswer: ['1','2','3'], inputType: 'multi-number', hissanVersion: undefined,
            inputConfig: { fields: [{label:'整数',length:2},{label:'分子',length:2},{label:'分母',length:2}] } });
        h.render({ deferSubmission: false });
        h.key('1'); h.key('/'); h.key('2'); h.key('/'); h.key('3');
        expect(h.props.onAnswer).toHaveBeenCalledWith(['1','2','3']);
    });
    it('can clear while on the last field, then fill all fields without another navigation key', () => {
        const h = harness({ categoryId: 'frac_add_same', correctAnswer: ['1','2'], inputType: 'multi-number', hissanVersion: undefined,
            inputConfig: { fields: [{label:'分子',length:1},{label:'分母',length:1}] } });
        h.render({ deferSubmission: false });
        h.key('ArrowRight'); h.keypad().onClear(); h.render();
        h.key('1'); h.key('2');
        expect(h.props.onAnswer).toHaveBeenCalledWith(['1','2']);
    });
});


it('does not grade a digit typed into another contenteditable control', () => {
    const h = harness({ categoryId: 'add_1d_1', correctAnswer: '3', inputType: 'number', hissanVersion: undefined });
    h.render({ deferSubmission: false });
    h.key('3', { tagName: 'DIV', isContentEditable: true });
    expect(h.key('3', { tagName: 'DIV', isContentEditable: true }, true).defaultPrevented).toBe(false);
    expect(h.props.onAnswer).not.toHaveBeenCalled();
    h.key('3');
    expect(h.props.onAnswer).toHaveBeenCalledTimes(1);
});


it('Backspace returns to the last edited field after automatic wraparound', () => {
    const h = harness({ categoryId: 'frac_mixed', correctAnswer: ['1','2','7'], inputType: 'multi-number', hissanVersion: undefined,
        inputConfig: { fields: [{label:'整数',length:1},{label:'分子',length:1},{label:'分母',length:1}] } });
    h.render({ deferSubmission: false });
    h.key('ArrowRight'); h.key('ArrowRight'); h.key('7'); h.key('Backspace');
    h.key('7'); h.key('1'); h.key('2');
    expect(h.props.onAnswer).toHaveBeenCalledTimes(1);
    expect(h.props.onAnswer).toHaveBeenCalledWith(['1','2','7']);
});


it('a clamped arrow preserves the last edited field for Backspace', () => {
    const h = harness({ categoryId: 'frac_mixed', correctAnswer: ['1','2','3'], inputType: 'multi-number', hissanVersion: undefined,
        inputConfig: { fields: [{label:'整数',length:1},{label:'分子',length:1},{label:'分母',length:1}] } });
    h.render({ deferSubmission: false });
    h.key('ArrowRight'); h.key('2'); h.key('ArrowLeft'); h.key('ArrowLeft'); h.key('1');
    h.key('ArrowRight'); h.key('Backspace'); h.key('1'); h.key('3');
    expect(h.props.onAnswer).toHaveBeenCalledWith(['1','2','3']);
});


describe('natural fraction correction', () => {
    const fraction = { categoryId: 'frac_add_same', questionText: '5/7 + 7/7 =', correctAnswer: ['12', '7'], inputType: 'multi-number' as const, hissanVersion: undefined,
        inputConfig: { fields: [{ label: '分子', length: 2 }, { label: '分母', length: 2 }] } };
    it('selects a filled field without erasing it, then replaces it with new digits', () => {
        const h = harness(fraction); h.render({ deferSubmission: false });
        h.key('1'); h.key('2'); h.select('分子'); h.key('.');
        expect(h.props.onAnswer).not.toHaveBeenCalled();
        h.key('9'); h.key('8'); h.key('7');
        expect(h.props.onAnswer).toHaveBeenCalledTimes(1);
        expect(h.props.onAnswer).toHaveBeenCalledWith(['98', '7']);
    });
    it('keeps another filled field while replacing a selected numerator', () => {
        const h = harness(fraction); h.render({ deferSubmission: false });
        h.key('1'); h.select('分母'); h.key('7'); h.select('分子');
        h.key('1'); h.key('2');
        expect(h.props.onAnswer).toHaveBeenCalledTimes(1);
        expect(h.props.onAnswer).toHaveBeenCalledWith(['12', '7']);
    });
    it('clears every field and returns to the first field', () => {
        const h = harness(fraction); h.render({ deferSubmission: false });
        h.key('1'); h.key('2'); h.keypad().onClear(); h.render();
        expect(h.keypad().nextFieldDisabled).toBe(false);
        h.key('9'); h.key('8'); h.key('7');
        expect(h.props.onAnswer).toHaveBeenCalledTimes(1);
        expect(h.props.onAnswer).toHaveBeenCalledWith(['98', '7']);
    });
    it.each(['1', '2'])('accepts a single integer %s for a frozen 1/1 answer', digit => {
        const h = harness({ ...fraction, questionText: '1/2 + 1/2 =', correctAnswer: ['1', '1'] });
        h.render({ deferSubmission: false }); h.key(digit);
        expect(h.props.onAnswer).toHaveBeenCalledTimes(1);
        expect(h.props.onAnswer).toHaveBeenCalledWith([digit, '1']);
        expect(h.props.slot.problem.correctAnswer).toEqual(['1', '1']);
        expect(h.props.slot.problem.inputConfig?.fields).toHaveLength(2);
    });
});


describe('whole-row retries in the shared form', () => {
    it('requires both digits again when just one of two was correct', () => {
        const h = harness({}, { retryAnswer: ['7', '9'], deferSubmission: false });
        h.key('9');
        expect(h.props.onAnswer).not.toHaveBeenCalled();
        h.key('2');
        expect(h.props.onAnswer).toHaveBeenCalledWith(['2', '9']);
    });
    it('does not retain a correct decimal point or digits from a failed row', () => {
        const h = harness({ categoryId: 'dec_add', questionText: '12.3 + 4 =', correctAnswer: '16.3', hissanVersion: undefined },
            { retryAnswer: ['3', '.', '9', '1'], deferSubmission: false });
        expect(h.keypad().showDecimal).toBe(true);
        h.key('1'); h.key('6'); h.key('.');
        expect(h.props.onAnswer).not.toHaveBeenCalled();
        h.key('3');
        expect(h.props.onAnswer).toHaveBeenCalledWith(['3', '.', '6', '1']);
    });
});


it('does not erase a selected decimal field when a leading point is rejected', () => {
    const h = harness({ categoryId: 'dec_add', correctAnswer: '12.3', inputType: 'number', hissanVersion: undefined }, { deferSubmission: false });
    h.key('1'); h.key('2');
    h.select('こたえ'); h.key('.');
    expect(h.fieldValue('こたえ')).toBe('12');
    h.key('1'); h.key('2'); h.key('.'); h.key('3');
    expect(h.props.onAnswer).toHaveBeenCalledWith('12.3');
});


it('Backspace deletes a selected field as a whole, then ordinary deletion removes one character', () => {
    const h = harness({ categoryId: 'dec_add', correctAnswer: '12.34', inputType: 'number', hissanVersion: undefined });
    h.key('1'); h.key('2'); h.key('.');
    h.select('こたえ'); h.key('Backspace');
    expect(h.fieldValue('こたえ')).toBe('');
    h.key('1'); h.key('2'); h.key('Backspace');
    expect(h.fieldValue('こたえ')).toBe('1');
});
it('deleting a selected fraction field preserves its neighbour', () => {
    const h = harness({ categoryId: 'frac_add_same', correctAnswer: ['12','7'], inputType: 'multi-number', hissanVersion: undefined,
        inputConfig: { fields: [{label:'分子',length:2},{label:'分母',length:1}] } });
    h.key('1'); h.key('2'); h.key('7');
    h.select('分子'); h.key('Backspace');
    expect(h.fieldValue('分子')).toBe('');
    expect(h.fieldValue('分母')).toBe('7');
    h.render({ deferSubmission: false });
    expect(h.props.onAnswer).not.toHaveBeenCalled();
});
it.each(['BUTTON', 'A'])('leaves Enter on a focused %s to the native action', tagName => {
    const h = harness({ subject: 'vocab', inputType: 'number', correctAnswer: '12', hissanVersion: undefined });
    h.render({ deferSubmission: false }); h.key('1'); h.key('2');
    const event = h.key('Enter', { tagName });
    expect(event.defaultPrevented).toBe(false);
    expect(h.props.onAnswer).not.toHaveBeenCalled();
    h.key('Enter');
    expect(h.props.onAnswer).toHaveBeenCalledWith('12');
});
