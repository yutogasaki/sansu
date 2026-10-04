import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { applyIntent } from '../../../domain/growingIsland/commands';
import { newIsland } from '../../../domain/growingIsland/island';
import { GrowingPlacementControls } from './GrowingPlacementControls';
import { placementPrice } from './placementPrice';

type Button = ReactElement<{ children?: ReactNode; disabled?: boolean; onClick: () => void }>;
function buttons(node: ReactNode): Button[] {
    if (Array.isArray(node)) return node.flatMap(buttons);
    if (!isValidElement<{ children?: ReactNode }>(node)) return [];
    return node.type === 'button' ? [node as Button] : buttons(node.props.children);
}
const T0 = Date.UTC(2026, 9, 3, 12);
describe('placement recovery with current prices and retained owned items', () => {
    it.each([true, false])('home preview matches actual saved consumption; free first home %s', first => {
        const state = newIsland('cost', T0); state.drops = 40; if (!first) state.tutorial = 'done';
        const price = placementPrice(state, { mode: 'new', seed: true, kind: 'home' });
        const saved = applyIntent(state, { id: 'home', command: { type: 'plant', kind: 'home', cell: { x: 4, z: 2 } } }).state;
        expect(price).toBe(first ? 0 : 40); expect(state.drops - saved.drops).toBe(price); expect(state.plots).toHaveLength(0);
    });
    it('wild seeds are still paid during the first-home state; landmarks match the command price', () => {
        const state = newIsland('cost', T0); state.drops = 40;
        const wild = applyIntent(state, { id: 'wild', command: { type: 'plant', kind: 'wild', cell: { x: 4, z: 2 } } }).state;
        expect(placementPrice(state, { mode: 'new', seed: true, kind: 'wild' })).toBe(state.drops - wild.drops);
        const bench = applyIntent(state, { id: 'bench', command: { type: 'place', kind: 'bench', cell: { x: 4, z: 2 } } }).state;
        expect(placementPrice(state, { mode: 'new', seed: false, kind: 'bench' })).toBe(state.drops - bench.drops);
    });
    it('moving and restoring owned items stay free at zero drops', () => {
        const state = newIsland('cost', T0);
        expect(placementPrice(state, { mode: 'move', seed: false, kind: 'bench' })).toBe(0);
        const moved = applyIntent(state, { id: 'move', command: { type: 'move', id: 'starter-bench', cell: { x: 4, z: 2 } } }).state;
        const stored = applyIntent(moved, { id: 'store', command: { type: 'store', id: 'starter-bench' } }).state;
        expect(placementPrice(stored, { mode: 'unstore', seed: false, kind: 'bench' })).toBe(0);
        const restored = applyIntent(stored, { id: 'restore', command: { type: 'unstore', id: 'starter-bench', cell: { x: 4, z: 2 } } }).state;
        expect(restored.drops).toBe(0); expect(restored.landmarks).toHaveLength(state.landmarks.length);
    });
    it('offers selection and cancel instead of a misleading confirm when drops are insufficient', () => {
        const p = { itemName: 'すむの たね', message: 'ここで いい？', shortfall: 3, valid: true, pending: false, onConfirm: vi.fn(), onChoose: vi.fn(), onCancel: vi.fn() };
        const result = GrowingPlacementControls(p), html = renderToStaticMarkup(result);
        expect(html).toContain('すむの たね'); expect(html).toContain('aria-describedby="growing-placement-message"');
        expect(html).toContain('しずくが あと 3こ いるよ'); expect(html).not.toContain('ここに おく');
        buttons(result).forEach(b => { expect(b.props.disabled).toBe(false); b.props.onClick(); });
        expect(p.onChoose).toHaveBeenCalledOnce(); expect(p.onCancel).toHaveBeenCalledOnce(); expect(p.onConfirm).not.toHaveBeenCalled();
        const pending = buttons(GrowingPlacementControls({ ...p, pending: true })); expect(pending.every(b => b.props.disabled)).toBe(true);
    });
    it('keeps cancel available for an invalid location and returns to confirm when balance recovers', () => {
        const p = { itemName: 'ベンチ', message: 'ここには おけないよ', shortfall: 0, valid: false, pending: false, onConfirm: vi.fn(), onChoose: vi.fn(), onCancel: vi.fn() };
        const invalid = buttons(GrowingPlacementControls(p)); expect(invalid[0].props.disabled).toBe(true); expect(invalid[1].props.disabled).toBe(false);
        const valid = GrowingPlacementControls({ ...p, valid: true }); expect(renderToStaticMarkup(valid)).toContain('ここに おく');
        buttons(valid)[0].props.onClick(); expect(p.onConfirm).toHaveBeenCalledOnce();
    });
});
