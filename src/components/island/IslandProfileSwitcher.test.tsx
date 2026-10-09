import { isValidElement, type ReactElement, type ReactNode, type ComponentProps } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { UserProfile } from '../../domain/types';

// Controlled hook lifecycle tests the real handlers; the native click race is
// covered by the production mouse journey, not by this non-DOM harness.
const hooks = vi.hoisted(() => {
    const cells: { value?: unknown; deps?: unknown[]; cleanup?: () => void }[] = [];
    const effects: (() => void)[] = []; let cursor = 0;
    return {
        begin() { cursor = 0; }, reset() { cells.length = 0; effects.length = 0; cursor = 0; },
        useState(value?: unknown) {
            const i = cursor++; cells[i] ??= { value };
            return [cells[i].value, (next: unknown) => { cells[i].value = typeof next === 'function' ? next(cells[i].value) : next; }];
        },
        useRef(value?: unknown) { const i = cursor++; cells[i] ??= { value: { current: value } }; return cells[i].value; },
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
const mocks = vi.hoisted(() => ({ profiles: vi.fn(), select: vi.fn(), navigate: vi.fn(), hold: vi.fn(), release: vi.fn() }));
vi.mock('react', async original => ({ ...await original<object>(), useState: hooks.useState, useRef: hooks.useRef, useEffect: hooks.useEffect }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('../../domain/user/repository', () => ({ getAllProfiles: mocks.profiles, setActiveProfileId: mocks.select }));
vi.mock('../../pwa', () => ({ holdPwaUpdateForCriticalPersistence: mocks.hold }));
import { IslandProfileSwitcher } from './IslandProfileSwitcher';
import { Modal } from '../ui/Modal';
import { ProfileChoices } from '../ProfileChoices';

function elements(node: ReactNode): ReactElement<{ children?: ReactNode }>[] {
    if (Array.isArray(node)) return node.flatMap(elements);
    if (!isValidElement<{ children?: ReactNode }>(node)) return [];
    return [node, ...elements(node.props.children)];
}
function render(disabled: boolean) {
    hooks.begin(); const tree = IslandProfileSwitcher({ activeId: 'current', disabled }); hooks.commit();
    const nodes = elements(tree);
    return {
        trigger: (nodes.find(node => node.type === 'button') as ReactElement<ComponentProps<'button'>>).props,
        dialog: (nodes.find(node => node.type === Modal) as ReactElement<ComponentProps<typeof Modal>>).props,
        choices: (nodes.find(node => node.type === ProfileChoices) as ReactElement<ComponentProps<typeof ProfileChoices>> | undefined)?.props,
        statuses: nodes.filter(node => (node.props as { role?: string }).role === 'status').map(node => node.props.children),
    };
}
beforeEach(() => {
    hooks.reset(); vi.clearAllMocks();
    mocks.profiles.mockResolvedValue([{ id: 'current', name: 'いま' }, { id: 'next', name: 'つぎ' }] as UserProfile[]);
    mocks.select.mockResolvedValue(undefined); mocks.hold.mockReturnValue(mocks.release);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
});
afterEach(() => { hooks.unmount(); vi.unstubAllGlobals(); });

it('keeps the name opener available across a background save, but waits to switch until unblocked', async () => {
    expect(render(false).trigger.disabled).not.toBe(true);
    const saving = render(true);
    expect(saving.trigger.disabled).not.toBe(true);
    saving.trigger.onClick?.({} as never);
    expect(render(true).dialog.isOpen).toBe(true);
    await Promise.resolve();
    const blocked = render(true);
    expect(blocked.choices?.disabled).toBe(true);
    expect(blocked.statuses).toContain('いまの そうさが おわるまで まってね。');
    blocked.choices?.onSelect('next');
    expect(mocks.select).not.toHaveBeenCalled(); expect(mocks.hold).not.toHaveBeenCalled(); expect(mocks.navigate).not.toHaveBeenCalled();

    let finish!: () => void;
    mocks.select.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    const ready = render(false);
    expect(ready.dialog.isOpen).toBe(true); expect(ready.choices?.disabled).toBe(false);
    ready.choices?.onSelect('next'); ready.choices?.onSelect('next');
    expect(mocks.select).toHaveBeenCalledTimes(1); expect(mocks.select).toHaveBeenCalledWith('next');
    expect(render(false).choices?.disabled).toBe(true);
    expect(mocks.hold).toHaveBeenCalledTimes(1); expect(mocks.navigate).not.toHaveBeenCalled();
    finish(); await Promise.resolve();
    expect(mocks.navigate).toHaveBeenCalledTimes(1); expect(mocks.navigate).toHaveBeenCalledWith('/', { replace: true });
    expect(mocks.release).toHaveBeenCalledTimes(1);
});

it('allows closing the read-only chooser while another island operation is blocked', async () => {
    render(true).trigger.onClick?.({} as never); render(true); await Promise.resolve();
    const chooser = render(true);
    expect(chooser.dialog.isOpen).toBe(true); expect(chooser.choices?.disabled).toBe(true);
    chooser.dialog.onClose();
    expect(render(true).dialog.isOpen).toBe(false);
    expect(mocks.select).not.toHaveBeenCalled(); expect(mocks.hold).not.toHaveBeenCalled();
});
