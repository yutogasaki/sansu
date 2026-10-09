import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { newIsland } from '../../../domain/growingIsland/island';
import type { GrowingState } from '../../../domain/growingIsland';
import { GrowingGuideBook, type GrowingGuideBookProps } from './GrowingGuideBook';
import { GrowingGuideCue } from './GrowingGuideCue';
import { starterCopy, starterFlowerReady } from './useGrowingGuide';
import { receiveGifts } from '../../../domain/growingIsland/gifts';
import { hasPurchasedFlower, growingTownSeed } from './growingGuideTargets';

const props = (state = newIsland('reader', 0)): GrowingGuideBookProps => ({ state, busy: false,
    onClose: vi.fn(), onChoose: vi.fn(), onClear: vi.fn(), onTry: vi.fn(), onResumeStarter: vi.fn(),
    onStarterAction: vi.fn(), onStarterChoose: vi.fn(), onTarget: vi.fn() });
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
    it('keeps the first purchase invitation after a sibling gift or mixed flower, including an empty sender name', () => {
        const state = newIsland('reader', 0);
        state.guidance!.starter.steps.S4 = { source: 'learning:one', snapshot: { flagColor: 0 } };
        state.drops = 10;
        receiveGifts(state, [{ id: 'gift-1', from: 'sibling', to: 'reader', fromName: '', at: 0 }]);
        state.landmarks.push({ id: 'mixed', kind: 'flower', color: 'orange', growth: 6, cell: { x: 0, z: 0 } });
        expect(starterFlowerReady(state)).toBe(true);
        expect(starterCopy(state, 'S5').action).toBe('はなの なえを えらぶ');
        expect(state.guidance!.firstFlower).toBeUndefined();
        state.landmarks.push({ id: 'old-purchase', kind: 'flower', growth: 6 });
        expect(hasPurchasedFlower(state)).toBe(true);
        expect(starterFlowerReady(state)).toBe(false);
        expect(state.guidance!.firstFlower).toBeUndefined();
    });
    it('does not offer a stored bench as an immediately movable object or trap the remaining starter action', () => {
        const state = newIsland('reader', 0);
        state.guidance!.starter.steps = Object.fromEntries(['S1', 'S2', 'S3'].map(id => [id, { source: 'fixture', snapshot: { flagColor: 0 } }]));
        state.landmarks.find(item => item.id === 'starter-bench')!.cell = undefined;
        expect(render({ state })).not.toContain('data-starter-play="A4"');
        expect(render({ state })).toContain('data-starter-play="A3"');
        state.guidance!.selected = 'A4';
        expect(starterCopy(state, 'S4').action).toBe('もちものを みる');
        expect(render({ state })).toContain('もちものから ベンチを だしてみよう');
        state.guidance!.selected = undefined;
        state.guidance!.achievements.A3 = { source: 'flag', snapshot: { flagColor: 2 } };
        expect(starterCopy(state, 'S4').action).toBe('まなぶ');
        expect(render({ state })).not.toContain('data-starter-play=');
    });
    it('targets an existing growing town seed and does not confuse a natural bud with its completion', () => {
        const state = newIsland('reader', 0);
        state.plots.push({ id: 'old-house', kind: 'home', cell: { x: 3, z: 3 }, stage: 3, growth: 0, paid: 4, plantedAt: 0, origin: 'seed' });
        state.plots.push({ id: 'home-growing', kind: 'home', cell: { x: 0, z: 0 }, stage: 0, growth: 0, paid: 40, plantedAt: 0, origin: 'seed' });
        state.unopened.push('natural-bud');
        expect(growingTownSeed(state)?.id).toBe('home-growing');
        expect(starterCopy(state, 'S5').hint).not.toContain('そだった つぼみ');
        state.unopened.push('home-growing');
        expect(starterCopy(state, 'S5').hint).toContain('そだった つぼみ');
        state.unopened = [];
        state.plots.find(plot => plot.id === 'home-growing')!.stage = 1;
        expect(growingTownSeed(state)).toBeUndefined();
    });
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
    it('offers two free actions after the first friend, then an affordable flower after learning', () => {
        const state = newIsland('reader', 0);
        state.guidance!.starter.steps = {
            S1: { source: 'plant', snapshot: { flagColor: 0 } },
            S2: { source: 'open', snapshot: { flagColor: 0 } },
            S3: { source: 'disembark', snapshot: { flagColor: 0 } },
        };
        const choice = render({ state });
        expect(choice).toContain('data-guidance-starter="S4"');
        expect(choice).toContain('data-starter-play="A3"');
        expect(choice).toContain('data-starter-play="A4"');
        state.guidance!.selected = 'A4';
        expect(starterCopy(state, 'S4').action).toBe('ベンチを みる');
        state.guidance!.achievements.A4 = { source: 'move', snapshot: { flagColor: 0 } };
        expect(starterCopy(state, 'S4').action).toBe('まなぶ');
        state.drops = 6;
        const ready = render({ state });
        expect(ready).toContain('はなの なえ');
        expect(ready).toContain('いま 💧6 ／ なえ 💧10');
        const cue = renderToStaticMarkup(<GrowingGuideCue state={state} cue={{ id: 'S4', hint: 'まなぶと しずくが たまるよ', action: 'まなぶ' }}
            onAction={vi.fn()} onClose={vi.fn()} onBook={vi.fn()} />);
        expect(cue).toContain('いま 💧6 ／ なえ 💧10');
        state.guidance!.starter.steps.S4 = { source: 'learning:one', snapshot: { flagColor: 0 } };
        state.drops = 10;
        expect(starterFlowerReady(state)).toBe(true);
        expect(starterCopy(state, 'S5').action).toBe('はなの なえを えらぶ');
        state.drops = 9;
        expect(starterFlowerReady(state)).toBe(false);
        expect(starterCopy(state, 'S5').action).toBe('しまへ もどる');
    });
    it('does not promise a starter bench to an older island that may have none', () => {
        const state = newIsland('old-reader', 0);
        state.guidance!.starter.steps = {
            S1: { source: 'legacy', snapshot: { flagColor: 0 } },
            S2: { source: 'legacy', snapshot: { flagColor: 0 } },
            S3: { source: 'legacy', snapshot: { flagColor: 0 } },
        };
        state.guidance!.starter.legacy = true;
        state.guidance!.starter.automatic = false;
        state.landmarks = state.landmarks.filter(item => item.kind !== 'bench');
        const html = render({ state });
        expect(html).toContain('data-guidance-starter="S4"');
        expect(html).toContain('しまの あそび');
        expect(html).not.toContain('はじめの あそび');
        expect(html).not.toContain('data-starter-play=');
        expect(html).not.toContain('growing-guide-flower-price');
        expect(starterCopy(state, 'S4').action).toBe('まなぶ');
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
