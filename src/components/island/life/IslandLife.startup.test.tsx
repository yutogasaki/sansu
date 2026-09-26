import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { isValidElement, type ReactNode } from 'react';
import { newLife, type LifeRecord, type LifeState } from '../../../domain/islandLife/model';
import { growthSnapshot } from './growthCue';
import { observationSnapshot } from './observationCue';
import type { useIslandLife } from './useIslandLife';

// Exercise the component's render and effects without constructing child WebGL views.
const hooks = vi.hoisted(() => {
    type Cell = { value?: unknown; deps?: unknown[]; cleanup?: () => void };
    const cells: Cell[] = [], effects: (() => void)[] = []; let cursor = 0;
    const same = (a?: unknown[], b?: unknown[]) => Boolean(a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i])));
    return {
        replay: vi.fn(), isolated: vi.fn(), districts: vi.fn(), landCells: vi.fn(), catalog: vi.fn(),
        reset() { cells.length = 0; effects.length = 0; cursor = 0; },
        begin() { cursor = 0; },
        useState(initial?: unknown) { const i = cursor++; if (!cells[i]) cells[i] = { value: initial }; return [cells[i].value, (next: unknown) => { cells[i].value = typeof next === 'function' ? next(cells[i].value) : next; }]; },
        useRef(value?: unknown) { const i = cursor++; if (!cells[i]) cells[i] = { value: { current: value } }; return cells[i].value; },
        useMemo(factory: () => unknown, deps: unknown[]) { const i = cursor++; if (!cells[i] || !same(cells[i].deps, deps)) cells[i] = { value: factory(), deps }; return cells[i].value; },
        effect(callback: () => void | (() => void), deps?: unknown[]) { const i = cursor++, old = cells[i]; if (!old || !same(old.deps, deps)) { cells[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { cells[i].cleanup?.(); cells[i].cleanup = callback() || undefined; }); } },
        commit() { for (const effect of effects.splice(0)) effect(); },
        unmount() { for (const cell of cells) cell.cleanup?.(); },
    };
});
vi.mock('react', async original => ({ ...await original<object>(), useState: hooks.useState, useRef: hooks.useRef, useMemo: hooks.useMemo, useEffect: hooks.effect }));
vi.mock('../../../domain/islandLife/simulation', async original => ({ ...await original<object>(), replayLife: hooks.replay }));
vi.mock('../../../domain/islandLife/space', async original => ({ ...await original<object>(), isolatedItems: hooks.isolated, districts: hooks.districts, landCells: hooks.landCells }));
vi.mock('../../../domain/islandLife/capabilities', async original => ({ ...await original<object>(), lifeCatalogKinds: hooks.catalog }));
vi.mock('./LifeObservation', () => { throw new Error('Eager LifeObservation'); });
vi.mock('./LifeMemories', () => { throw new Error('Eager LifeMemories'); });
vi.mock('./LifeWorld', () => { throw new Error('Eager LifeWorld'); });
vi.mock('./usePlacementClearance', () => ({ usePlacementClearance: () => ({ cancel: vi.fn(), clearing: false, onFrame: vi.fn() }) }));
vi.mock('./useLiveDiscovery', () => ({ useLiveDiscovery: () => ({}) }));
import IslandLife from './IslandLife';
const actual = await vi.importActual<typeof import('../../../domain/islandLife/simulation')>('../../../domain/islandLife/simulation');
const space = await vi.importActual<typeof import('../../../domain/islandLife/space')>('../../../domain/islandLife/space');
const capabilities = await vi.importActual<typeof import('../../../domain/islandLife/capabilities')>('../../../domain/islandLife/capabilities');

function nodes(node: ReactNode): import('react').ReactElement<Record<string, unknown>>[] {
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (!isValidElement<{ children?: ReactNode }>(node)) return [];
    return [node, ...nodes(node.props.children)];
}
function lifeWorldNode(node: ReactNode) {
    return nodes(node).find(node => node.props.profileId && node.props.state && node.props.changeKey);
}
function worldState(node: ReactNode): LifeState | undefined {
    return lifeWorldNode(node)?.props.state as LifeState | undefined;
}
function render(record?: LifeRecord) {
    const controls: ReturnType<typeof useIslandLife> = { record, currentRecord: () => record, error: undefined, busy: false,
        refresh: vi.fn(), retry: vi.fn(), clearError: vi.fn() };
    hooks.begin();
    const tree = IslandLife({ controls, onHome: vi.fn(), disabled: false, islandName: 'しま' });
    hooks.commit();
    return { tree, state: worldState(tree) };
}
beforeEach(() => {
    hooks.reset(); hooks.replay.mockReset().mockImplementation(actual.replayLife); hooks.isolated.mockReset().mockReturnValue([]);
    hooks.districts.mockReset().mockImplementation(space.districts);
    hooks.landCells.mockReset().mockImplementation(space.landCells);
    hooks.catalog.mockReset().mockImplementation(capabilities.lifeCatalogKinds);
    const storage = new Map<string, string>();
    vi.stubGlobal('window', { setInterval: vi.fn(() => 1), clearInterval: vi.fn(), setTimeout: vi.fn(() => 2), clearTimeout: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(),
        sessionStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
});

it('reuses district groups across home renders and updates them when the saved state changes', () => {
    render();
    expect(hooks.districts).not.toHaveBeenCalled();
    const record = newLife('districts', 100);
    const state = actual.replayLife(record);
    hooks.districts.mockClear();
    const flowers = [0, 1, 2].map(x => ({ id: `flower-${x}`, kind: 'flower' as const,
        cell: { x, z: 3 }, growth: 100, style: 'original' as const }));
    hooks.replay.mockReturnValue({ ...state, items: flowers });
    const opening = render(record);
    expect(opening.tree.props['data-life-districts']).toBe('かだん');
    expect(render(record).tree.props['data-life-districts']).toBe('かだん');
    expect(hooks.districts).toHaveBeenCalledTimes(1);
    hooks.replay.mockReturnValue({ ...state, items: flowers.slice(0, 2) });
    expect(render({ ...record, revision: record.revision + 1 }).tree.props['data-life-districts']).toBe('');
    expect(hooks.districts).toHaveBeenCalledTimes(2);
});

it('defers catalog and cell-picker work until their controls are visible', () => {
    const record = newLife('panels', 100);
    hooks.replay.mockReturnValue({ ...actual.replayLife(record), drops: 100 });
    hooks.landCells.mockClear();
    const opening = render(record);
    render(record);
    expect(hooks.catalog).not.toHaveBeenCalled();
    expect(hooks.landCells).not.toHaveBeenCalled();
    const click = (tree: ReactNode, predicate: (props: Record<string, unknown>) => boolean) => {
        const button = nodes(tree).find(node => node.type === 'button' && predicate(node.props));
        expect(button).toBeDefined();
        (button!.props.onClick as () => void)();
    };
    click(opening.tree, p => p.className === 'life-home-action life-build-action');
    const catalog = render(record);
    expect(hooks.catalog).toHaveBeenCalledTimes(1);
    expect(nodes(catalog.tree).filter(n => n.props['data-life-buy']).map(n => n.props['data-life-buy']))
        .toEqual(capabilities.lifeCatalogKinds());
    expect(hooks.landCells).not.toHaveBeenCalled();
    click(catalog.tree, p => p['data-life-buy'] === 'flower');
    const placement = render(record);
    // Placement validation legitimately enumerates land. Only the hidden picker is deferred.
    hooks.landCells.mockClear();
    render(record);
    expect(hooks.landCells).not.toHaveBeenCalled();
    click(placement.tree, p => p.className === 'life-grid-toggle');
    const grid = render(record);
    expect(hooks.landCells).toHaveBeenCalled();
    expect(nodes(grid.tree).filter(n => n.props['data-life-cell']).map(n => n.props['data-life-cell']))
        .toEqual(space.landCells(grid.state!).slice(0, 6).map(space.cellKey));
    click(grid.tree, p => p['aria-label'] === 'つぎの マス');
    const next = render(record);
    expect(nodes(next.tree).filter(n => n.props['data-life-cell']).map(n => n.props['data-life-cell']))
        .toEqual(space.landCells(next.state!).slice(6, 12).map(space.cellKey));
    click(next.tree, p => p.className === 'life-grid-toggle');
    hooks.landCells.mockClear();
    render(record);
    expect(hooks.landCells).not.toHaveBeenCalled();
    expect(hooks.catalog).toHaveBeenCalledTimes(1);
});
afterEach(() => { hooks.unmount(); vi.unstubAllGlobals(); });

it('replays once per saved record for both the world and notification snapshots', () => {
    expect(render().state).toBeUndefined();
    expect(hooks.replay).not.toHaveBeenCalled();
    const record = newLife('opening', 100);
    const state = render(record).state!;
    expect(hooks.replay).toHaveBeenCalledTimes(1);
    expect(state.drops).toBe(actual.replayLife(record).drops);
    expect(window.sessionStorage.getItem('sansu:island-life-seen-drops:opening')).toBe(String(state.drops));
    expect(window.sessionStorage.getItem('sansu:island-life-seen-growth:opening')).toBe(JSON.stringify(growthSnapshot(state.items)));
    expect(window.sessionStorage.getItem('sansu:island-life-seen-observation:opening')).toBe(JSON.stringify(observationSnapshot(state)));
    expect(render(record).state).toBe(state);
    expect(hooks.replay).toHaveBeenCalledTimes(1);
    const updated = { ...record, revision: record.revision + 1, now: 200 };
    expect(render(updated).state?.now).toBe(200);
    expect(hooks.replay).toHaveBeenCalledTimes(2);
});

it('does not search inventory paths on opening, but still disables a call to an isolated item', () => {
    const record = newLife('opening', 100);
    const flower = { id: 'flower', kind: 'flower' as const, cell: { x: 0, z: 3 }, growth: 0, style: 'original' as const };
    hooks.replay.mockReturnValue({ ...actual.replayLife(record), placementVersion: 1, items: [flower] });
    hooks.isolated.mockReturnValue([flower]);
    const opening = render(record);
    expect(hooks.isolated).not.toHaveBeenCalled();
    const world = lifeWorldNode(opening.tree)!;
    (world.props.onCell as (cell: { x: number; z: number }) => void)(flower.cell);
    const inventory = render(record);
    expect(hooks.isolated).toHaveBeenCalledTimes(1);
    const call = nodes(inventory.tree).find(node => node.type === 'button' && node.props.children === 'ぽこもこを よぶ')!;
    expect(call.props.disabled).toBe(true);
});
