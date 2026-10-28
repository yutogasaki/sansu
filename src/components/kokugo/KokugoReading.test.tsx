import { isValidElement, type ReactElement, type ReactNode, type ComponentProps } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';

// Controlled lifecycle exercises a pending repository call without changing DB timing.
const hooks = vi.hoisted(() => {
    const cells: { value?: unknown; deps?: unknown[]; cleanup?: () => void }[] = [];
    const effects: (() => void)[] = []; let cursor = 0;
    return {
        reset() { cells.length = 0; effects.length = 0; cursor = 0; },
        begin() { cursor = 0; },
        useState(value?: unknown) {
            const i = cursor++; cells[i] ??= { value };
            return [cells[i].value, (next: unknown) => { cells[i].value = next; }];
        },
        useRef(value?: unknown) { const i = cursor++; cells[i] ??= { value: { current: value } }; return cells[i].value; },
        useEffect(callback: () => void | (() => void), deps: unknown[]) {
            const i = cursor++, old = cells[i];
            if (old?.deps?.length === deps.length && deps.every((d, j) => Object.is(d, old.deps![j]))) return;
            cells[i] = { deps, cleanup: old?.cleanup };
            effects.push(() => { cells[i].cleanup?.(); cells[i].cleanup = callback() || undefined; });
        },
        commit() { for (const effect of effects.splice(0)) effect(); },
    };
});
const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('react', async original => ({ ...await original<object>(), useState: hooks.useState, useRef: hooks.useRef, useEffect: hooks.useEffect }));
vi.mock('../../domain/kokugo/repository', () => ({ saveKokugoWork: mocks.save }));
import { KokugoReading } from './KokugoActivities';

function elements(node: ReactNode): ReactElement<{ children?: ReactNode }>[] {
    if (Array.isArray(node)) return node.flatMap(elements);
    if (!isValidElement<{ children?: ReactNode }>(node)) return [];
    return [node, ...elements(node.props.children)];
}
function harness(busy = false) {
    const onSaving = vi.fn(), onError = vi.fn();
    const render = () => {
        hooks.begin(); const tree = KokugoReading({ profileId: 'reader', busy, onSaving, onError }); hooks.commit();
        const nodes = elements(tree);
        return {
            save: (nodes.find(node => node.type === 'button') as ReactElement<ComponentProps<'button'>>).props,
            book: (nodes.find(node => node.type === 'select') as ReactElement<ComponentProps<'select'>>).props,
        };
    };
    return { render, onSaving, onError };
}
beforeEach(() => { hooks.reset(); vi.clearAllMocks(); });

it('holds exit and book changes until persistence completes and ignores a second click', async () => {
    let finish!: () => void;
    mocks.save.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    const view = harness(), initial = view.render();
    initial.save.onClick?.({} as never);
    const pending = view.render();
    expect(pending.save.disabled).toBe(true); expect(pending.book.disabled).toBe(true);
    expect(view.onSaving).toHaveBeenLastCalledWith(true);
    initial.save.onClick?.({} as never);
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.save.mock.calls[0][0]).toMatchObject({ profileId: 'reader', saved: true });
    finish(); await Promise.resolve(); await Promise.resolve();
    expect(view.render().book.disabled).toBe(false);
    expect(view.onSaving).toHaveBeenLastCalledWith(false);
});

it('releases the persistence hold on error and preserves retry', async () => {
    mocks.save.mockRejectedValue(new Error('save unavailable'));
    const view = harness(); view.render().save.onClick?.({} as never);
    view.render(); await Promise.resolve(); await Promise.resolve();
    expect(view.render().save.disabled).toBe(false);
    expect(view.onSaving).toHaveBeenLastCalledWith(false);
    expect(view.onError).toHaveBeenCalledWith('Error: save unavailable');
});

it('does not write when another learning lease blocks this reader', () => {
    const view = harness(true), tree = view.render();
    expect(tree.save.disabled).toBe(true); expect(tree.book.disabled).toBe(true);
    tree.save.onClick?.({} as never);
    expect(mocks.save).not.toHaveBeenCalled();
});
