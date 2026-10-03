import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { newIsland } from '../../../domain/growingIsland/island';
import type { GrowingState } from '../../../domain/growingIsland';
import { GrowingGuideBook, type GrowingGuideBookProps } from './GrowingGuideBook';
import { GrowingGuideCue } from './GrowingGuideCue';

const props = (state = newIsland('reader', 0)): GrowingGuideBookProps => ({ state, busy: false,
    onClose: vi.fn(), onChoose: vi.fn(), onClear: vi.fn(), onTry: vi.fn(), onResumeStarter: vi.fn(),
    onStarterAction: vi.fn(), onTarget: vi.fn() });
const render = (overrides: Partial<GrowingGuideBookProps> = {}) => renderToStaticMarkup(<GrowingGuideBook {...props()} {...overrides} />);
function remembered(): GrowingState {
    const state = newIsland('reader', 0);
    state.guidance!.achievements = {
        A3: { source: 'flag', at: 10, targetId: 'flag', snapshot: { flagColor: 2 } },
        A4: { source: 'move', at: 20, targetId: 'starter-bench', snapshot: { flagColor: 1 } },
    };
    return state;
}
type Clickable = ReactElement<{ onClick?: () => void; children?: ReactNode }>;
function buttons(node: ReactNode): Clickable[] {
    if (Array.isArray(node)) return node.flatMap(buttons);
    if (!isValidElement<{ children?: ReactNode }>(node)) return [];
    return node.type === 'button' ? [node as Clickable] : buttons(node.props.children);
}

describe('growing book entry and attention', () => {
    it('opens the notified memory directly, even when another memory is newer', () => {
        const html = render({ state: remembered(), initialMemory: 'A3' });
        expect(html).toMatch(/aria-selected="true"[^>]*data-guide-tab="done"/);
        expect(html).toContain('data-guidance-memory="A3"');
        expect(html).toContain('data-memory-flag="2"');
        expect(html).toContain('data-guidance-goal="A4"');
        expect(html).not.toContain('data-guidance-goal="A3"');
    });
    it('keeps a normal entry on try with one starter action and optional alternatives', () => {
        const html = render();
        expect(html).toMatch(/aria-selected="true"[^>]*data-guide-tab="try"/);
        expect(html).toContain('data-guidance-starter="S1"');
        expect(html).not.toContain('class="growing-guide-candidates"');
        expect(html).toContain('<details class="growing-guide-all">');
        expect(html).not.toContain('<details open');
        expect(html).toContain('data-guidance-goal="A3"');
    });
    it('gives a chosen play the main action without competing starter instructions', () => {
        const state = newIsland('reader', 0); state.guidance!.selected = 'A3';
        const html = render({ state });
        expect(html).toContain('じぶんの いろの ヒント');
        expect(html).toContain('しまで やってみる');
        expect(html).not.toContain('data-guidance-starter');
        expect(html).not.toContain('class="growing-guide-candidates"');
    });
    it('restores starter guidance once the selected play is achieved', () => {
        const state = remembered(); state.guidance!.selected = 'A3';
        expect(render({ state })).toContain('data-guidance-starter="S1"');
    });
    it('falls back to a real latest memory when a requested record is unavailable', () => {
        const html = render({ state: remembered(), initialMemory: 'A6' });
        expect(html).toContain('data-guidance-memory="A4"');
        expect(html).not.toContain('data-guidance-memory="A6"');
    });
    it('forwards the first displayed notification ID, while goal hints use a normal entry', () => {
        const onBook = vi.fn();
        const notification = GrowingGuideCue({ state: remembered(), notice: ['A3', 'A4'], onBook, onAction: vi.fn(), onClose: vi.fn() });
        buttons(notification)[0].props.onClick?.(); expect(onBook).toHaveBeenLastCalledWith('A3');
        const hint = GrowingGuideCue({ state: newIsland('reader', 0), selected: 'A2', onBook, onAction: vi.fn(), onClose: vi.fn() });
        buttons(hint)[0].props.onClick?.(); expect(onBook).toHaveBeenLastCalledWith();
    });
});
