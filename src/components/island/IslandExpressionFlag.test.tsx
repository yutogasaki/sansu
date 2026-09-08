import { isValidElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIsland } from '../../domain/island/catalog';
import { getIslandExpression, previewIslandExpression } from '../../domain/island/expression';

// Controlled React hook lifecycle; real component handlers and domain previews,
// without treating this as a browser/layout or font rendering test.
const hooks = vi.hoisted(() => {
    const cells: { value?: unknown; deps?: unknown[]; cleanup?: () => void }[] = [];
    const effects: (() => void)[] = []; let cursor = 0;
    return { begin() { cursor = 0; }, reset() { cells.length = 0; effects.length = 0; cursor = 0; },
        useState(value: unknown) {
            const i = cursor++; cells[i] ??= { value };
            return [cells[i].value, (next: unknown) => { cells[i].value = typeof next === 'function' ? next(cells[i].value) : next; }];
        },
        useEffect(callback: () => void | (() => void), deps: unknown[]) {
            const i = cursor++, old = cells[i];
            if (old?.deps?.length === deps.length && deps.every((d, j) => Object.is(d, old.deps![j]))) return;
            cells[i] = { deps, cleanup: old?.cleanup };
            effects.push(() => { cells[i].cleanup?.(); cells[i].cleanup = callback() || undefined; });
        },
        commit() { for (const effect of effects.splice(0)) effect(); },
        unmount() { for (const cell of cells) cell.cleanup?.(); },
    };
});
vi.mock('react', async original => ({ ...await original<object>(), useState: hooks.useState, useEffect: hooks.useEffect }));
import { IslandExpression, type IslandExpressionProps } from './IslandExpression';

type Props = { children?: ReactNode; onClick?: () => void; [key: string]: unknown };
function text(node: ReactNode): string {
    if (Array.isArray(node)) return node.map(text).join('');
    if (isValidElement<Props>(node)) return text(node.props.children);
    return typeof node === 'string' || typeof node === 'number' ? String(node) : '';
}
function buttons(node: ReactNode): Props[] {
    if (Array.isArray(node)) return node.flatMap(buttons);
    if (!isValidElement<Props>(node)) return [];
    return [...(node.type === 'button' ? [node.props] : []), ...buttons(node.props.children)];
}
function harness() {
    const island = createIsland('flag-focus-ui', 0), onAction = vi.fn(async () => true), onFocusFlag = vi.fn(), onFocusResident = vi.fn();
    const props: IslandExpressionProps = { island, disabled: false, pending: false, previewSelection: getIslandExpression(island).selection,
        soundEnabled: false, soundStatus: 'off', onAction, onFocusFlag, onFocusResident,
        onPreview(action) {
            props.previewAction = action;
            props.previewSelection = action ? previewIslandExpression(props.island, action).selection : getIslandExpression(props.island).selection;
        }, onClose() {}, onLearn() {}, onListen() {}, onVisit() {}, onSaveScene() {} };
    let tree: ReactNode;
    const render = () => { hooks.begin(); tree = IslandExpression(props); hooks.commit(); };
    const click = (test: (p: Props) => boolean) => {
        const target = buttons(tree).find(test); expect(target).toBeDefined(); expect(target!.disabled).not.toBe(true);
        target!.onClick?.(); render();
    };
    render();
    return { props, render, click, onAction, onFocusFlag, onFocusResident,
        clickLabel(label: string) { click(p => text(p.children) === label); },
        selectFlag() { click(p => text(p.children) === 'おもいで'); click(p => p['data-expression-choice'] === 'leaf-bird-flag-trim'); } };
}
beforeEach(hooks.reset); afterEach(hooks.unmount);

describe('flag inspection is a reversible viewing choice', () => {
    it('focuses the real flag on selection, retains that view through preview/cancel and offers overview without saving', () => {
        const h = harness(), before = structuredClone(h.props.island);
        h.selectFlag(); expect(h.onFocusFlag).toHaveBeenLastCalledWith(true); expect(h.onFocusResident).toHaveBeenLastCalledWith(undefined);
        h.click(p => p['data-expression-action'] === 'preview'); expect(h.props.previewSelection.flagTrim).toBe('leaf-bird-flag-trim');
        expect(h.onFocusFlag).toHaveBeenLastCalledWith(true);
        h.clickLabel('いまに もどす'); expect(h.props.previewSelection.flagTrim).toBeNull(); expect(h.onFocusFlag).toHaveBeenLastCalledWith(true);
        h.clickLabel('しま全体を みる'); expect(h.onFocusFlag).toHaveBeenLastCalledWith(false);
        h.click(p => p['data-expression-action'] === 'preview'); expect(h.onFocusFlag).toHaveBeenLastCalledWith(false);
        h.clickLabel('はたを みる'); expect(h.onFocusFlag).toHaveBeenLastCalledWith(true);
        expect(h.props.island).toEqual(before); expect(h.onAction).not.toHaveBeenCalled();
    });
    it('releases the flag on another product, restores the chosen resident focus, and releases on unmount', () => {
        const h = harness(); h.selectFlag();
        h.click(p => p['data-expression-choice'] === 'leaf-album-cover'); expect(h.onFocusFlag).toHaveBeenLastCalledWith(false);
        h.clickLabel('なかま'); expect(h.onFocusResident).toHaveBeenLastCalledWith('otter'); expect(h.onFocusFlag).toHaveBeenLastCalledWith(false);
        h.selectFlag(); expect(h.onFocusFlag).toHaveBeenLastCalledWith(true);
        hooks.unmount(); expect(h.onFocusFlag).toHaveBeenLastCalledWith(false); expect(h.onAction).not.toHaveBeenCalled();
    });
});
