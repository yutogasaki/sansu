import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createIsland } from '../../domain/island/catalog';
import type { IslandItem } from '../../domain/island/types';

// Delay route publication independently of local preview state, as the live shell does.
const hooks = vi.hoisted(() => {
    const cells: { value: unknown; deps?: unknown[] }[] = [];
    const effects: (() => void)[] = []; let cursor = 0;
    return {
        reset() { cells.length = 0; effects.length = 0; cursor = 0; }, begin() { cursor = 0; },
        state(initial?: unknown) {
            const i = cursor++; cells[i] ??= { value: initial };
            return [cells[i].value, (value: unknown) => { cells[i].value = typeof value === 'function' ? value(cells[i].value) : value; }];
        },
        ref(initial: unknown) { const i = cursor++; cells[i] ??= { value: { current: initial } }; return cells[i].value; },
        event(callback: unknown) { return callback; },
        effect(callback: () => void, deps: unknown[]) {
            const i = cursor++, previous = cells[i];
            if (!previous?.deps || deps.some((value, index) => !Object.is(value, previous.deps?.[index]))) effects.push(callback);
            cells[i] = { value: undefined, deps };
        },
        commit() { effects.splice(0).forEach(effect => effect()); },
        save: vi.fn(), appearance: vi.fn(),
    };
});
vi.mock('react', () => ({ useState: hooks.state, useRef: hooks.ref, useEffect: hooks.effect, useEffectEvent: hooks.event }));
vi.mock('../../domain/island/repository', () => ({ saveIslandEdit: hooks.save }));
vi.mock('../../domain/island/growthRepository', () => ({ setIslandItemAppearance: hooks.appearance }));
import { useIslandSessionPlacement } from './useIslandSessionPlacement';

beforeEach(() => { hooks.reset(); hooks.save.mockReset(); hooks.appearance.mockReset(); });
function harness(shell = true) {
    const island = createIsland('child', 1);
    const item: IslandItem = { id: 'owned-flower', kind: 'flower', rotation: 0, position: { x: 0, z: 1 } };
    island.items.push(item);
    const open = vi.fn(), setScreen = vi.fn(), onPlaced = vi.fn(), setSnapshot = vi.fn();
    const inputs: Parameters<typeof useIslandSessionPlacement>[0] = {
        profileId: 'child', island, screen: 'inventory', setScreen, busy: false, active: true, opening: false, hasShell: shell,
        navigation: shell ? { open } as unknown as Parameters<typeof useIslandSessionPlacement>[0]['navigation'] : undefined,
        run: async action => action(), setSnapshot, setDistrict: vi.fn(), setPlayRequest: vi.fn(), setPlayMessage: vi.fn(),
        returnToGuide: false, returnToHouse: false, onPlaced,
    };
    const RenderPlacement = () => { hooks.begin(); const api = useIslandSessionPlacement(inputs); hooks.commit(); return api; };
    return { inputs, item, open, setScreen, onPlaced, setSnapshot, render: RenderPlacement };
}

describe('session placement exits and persistence', () => {
    it('recovers a direct editor entry without an item, but waits while blocked or inactive', () => {
        const h = harness(); h.inputs.screen = 'placement'; h.inputs.active = false; h.render();
        expect(h.open).not.toHaveBeenCalled();
        h.inputs.active = true; h.inputs.opening = true; h.render(); expect(h.open).not.toHaveBeenCalled();
        h.inputs.opening = false; h.render(); expect(h.open).toHaveBeenCalledWith('/island?view=inventory', true);
    });
    it('does not replace the destination during the render between saving and route publication', async () => {
        const h = harness(); h.render().select(h.item); h.inputs.screen = 'placement';
        const api = h.render(); hooks.save.mockResolvedValue({ ...h.inputs.island, revision: 2 });
        await api.place(); h.render();
        expect(h.open).not.toHaveBeenCalled(); expect(h.setScreen).toHaveBeenLastCalledWith('home');
        expect(h.onPlaced).toHaveBeenCalledOnce();
        expect(hooks.save).toHaveBeenCalledWith('child', h.inputs.island!.revision,
            { type: 'place', itemId: h.item.id, position: h.item.position, rotation: 0 });
    });
    it('keeps the selected item and destination when the writer does not commit', async () => {
        const h = harness(); h.render().select(h.item); h.inputs.screen = 'placement';
        await h.render().place();
        expect(h.render().preview?.id).toBe(h.item.id); expect(h.onPlaced).not.toHaveBeenCalled();
        expect(h.setSnapshot).not.toHaveBeenCalled(); expect(h.setScreen).toHaveBeenLastCalledWith('placement');
    });
    it('stores through the same revision guard and returns to the house for the standalone host', async () => {
        const h = harness(false); h.inputs.returnToHouse = true; h.render().select(h.item);
        hooks.save.mockResolvedValue({ ...h.inputs.island, revision: 2 }); await h.render().place(true);
        expect(hooks.save).toHaveBeenCalledWith('child', h.inputs.island!.revision, { type: 'store', itemId: h.item.id });
        expect(h.setScreen).toHaveBeenLastCalledWith('keepsakes'); expect(h.render().preview).toBeUndefined();
    });
});
