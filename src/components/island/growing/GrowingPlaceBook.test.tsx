import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newIsland } from '../../../domain/growingIsland/island';
import { newPlaceProgress } from '../../../domain/growingIsland/placeGoals';
import type { GrowingState } from '../../../domain/growingIsland';
import { GrowingPlaceBook, type GrowingPlaceBookProps } from './GrowingPlaceBook';

const hooks = vi.hoisted(() => {
    const values: unknown[] = []; let cursor = 0;
    return { reset() { values.length = 0; cursor = 0; }, begin() { cursor = 0; },
        state(initial: unknown) { const index = cursor++; if (!(index in values)) values[index] = initial;
            return [values[index], (next: unknown) => { values[index] = next; }]; } };
});
vi.mock('react', async importOriginal => ({ ...await importOriginal<typeof import('react')>(),
    useState: hooks.state, useEffect: () => {}, useRef: (current: unknown) => ({ current }), useId: () => 'place-test' }));

type Button = ReactElement<{ children?: ReactNode; onClick?: () => void; onKeyDown?: (event: unknown) => void; disabled?: boolean; 'data-place-goal'?: string; 'data-place-tab'?: string; 'aria-pressed'?: boolean }>;
function buttons(node: ReactNode): Button[] {
    if (Array.isArray(node)) return node.flatMap(buttons);
    if (!isValidElement<{ children?: ReactNode }>(node)) return [];
    return node.type === 'button' ? [node as Button] : buttons(node.props.children);
}
const words = (node: ReactNode): string => Array.isArray(node) ? node.map(words).join('') : isValidElement<{ children?: ReactNode }>(node) ? words(node.props.children) : typeof node === 'string' ? node : '';
function props(state = newIsland('place-reader', 0)): GrowingPlaceBookProps {
    return { state, busy: false, onClose: vi.fn(), onChoose: vi.fn(), onTarget: vi.fn() };
}
function tree(p: GrowingPlaceBookProps) { hooks.begin(); return GrowingPlaceBook(p); }
function html(p: GrowingPlaceBookProps) { return renderToStaticMarkup(tree(p)); }
beforeEach(() => hooks.reset());

describe('optional growing place destinations', () => {
    it('makes all six destinations readable without choosing a prerequisite or adding a reward', () => {
        const p = props(), output = html(p);
        expect(output.match(/data-place-goal=/g)).toHaveLength(6);
        expect(output).toContain('えらばなくても そだつよ');
        expect(output).toContain('そだった姿の めやす');
        expect(output).not.toContain('あと何問');
        expect(output).not.toContain('しずく');
        expect(output).not.toContain('<details open');
        expect(output).not.toContain('landmark:');
        expect(output).not.toContain('plot:');
        const destination = buttons(tree(p)).find(button => button.props['data-place-goal'] === 'P04')!;
        destination.props.onClick!();
        buttons(tree(p)).find(button => words(button.props.children) === 'ここを そだてたい')!.props.onClick!();
        expect(p.onChoose).toHaveBeenCalledTimes(1); expect(p.onChoose).toHaveBeenCalledWith('P04');
    });
    it('clears only the optional bookmark and forwards a current place to the island', () => {
        const state = newIsland('place-reader', 0); state.placeProgress = newPlaceProgress(); state.placeProgress.selected = 'P01';
        state.landmarks = [
            { id: 'tree-1', kind: 'sapling', cell: { x: 0, z: 2 }, growth: 18 },
            { id: 'tree-2', kind: 'sapling', cell: { x: 2, z: 2 }, growth: 18 },
            { id: 'seat-1', kind: 'bench', cell: { x: 1, z: 3 }, growth: 0 },
        ];
        const before = JSON.stringify(state), p = props(state);
        buttons(tree(p)).find(button => words(button.props.children) === '目標を はずす')!.props.onClick!();
        expect(p.onChoose).toHaveBeenCalledTimes(1); expect(p.onChoose).toHaveBeenCalledWith();
        buttons(tree(p)).find(button => words(button.props.children) === 'この場所へ')!.props.onClick!();
        expect(p.onTarget).toHaveBeenCalledTimes(1); expect(p.onTarget).toHaveBeenCalledWith('tree-1');
        expect(JSON.stringify(state)).toBe(before);
    });
    it('labels all three layout diagrams as examples, and keeps the live status separate', () => {
        const p = { ...props(), initialGoal: 'P03' as const }, first = tree(p);
        for (const label of ['段につなぐ', '曲げる', '岸へ開く']) expect(buttons(first).some(button => words(button.props.children) === label)).toBe(true);
        buttons(first).find(button => words(button.props.children) === '曲げる')!.props.onClick!();
        const output = html(p);
        expect(output).toContain('aria-pressed="true">曲げる');
        expect(output).toContain('平地の水庭');
        expect(output).toContain('置きかたの例。いまの しまの絵では ないよ');
        expect(output).toContain('role="status"');
    });
    it('retains old achievements without describing the split current island as grown', () => {
        const state: GrowingState = newIsland('place-reader', 0); state.placeProgress = newPlaceProgress();
        state.placeProgress.milestones.P01 = { at: 4, ruleId: 'P01', anchorId: 'remembered-tree', memberIds: ['remembered-tree', 'old-seat'], variant: 'lane', revision: 'then' };
        state.landmarks = [{ id: 'remembered-tree', kind: 'sapling', growth: 24 }];
        const p = props(state), now = html(p);
        expect(now).not.toContain('いま つながる');
        buttons(tree(p)).find(button => button.props['data-place-tab'] === 'memory')!.props.onClick!();
        const memory = html(p);
        expect(memory).toContain('置きかえても おもいでは のこるよ');
        expect(memory).toContain('もちものへ');
        expect(memory.match(/data-place-goal=/g)).toHaveLength(1);
        buttons(tree(p)).find(button => words(button.props.children) === 'もちものへ')!.props.onClick!();
        expect(p.onTarget).toHaveBeenCalledTimes(1); expect(p.onTarget).toHaveBeenCalledWith('remembered-tree');
    });
    it('offers all four relationships on the whole-island page without an imposed order', () => {
        const output = html({ ...props(), initialGoal: 'P06' });
        for (const id of ['C01', 'C02', 'C03', 'C04']) expect(output).toContain(`data-place-combo="${id}"`);
        expect(output).toContain('順番は じゆうだよ');
        expect(output).not.toContain('growing-place-layouts');
    });
    it('blocks bookmark and world actions while saving, keeping page exploration usable', () => {
        const p = { ...props(), busy: true }, actions = buttons(tree(p));
        expect(actions.find(button => words(button.props.children) === 'ここを そだてたい')?.props.disabled).toBe(true);
        expect(actions.filter(button => button.props['data-place-goal']).every(button => !button.props.disabled)).toBe(true);
        expect(actions.find(button => words(button.props.children) === 'とじる ×')?.props.disabled).not.toBe(true);
    });
});
