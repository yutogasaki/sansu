import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const hooks = vi.hoisted(() => {
    type Cell = { value?: unknown; deps?: unknown[]; cleanup?: () => void };
    const cells: Cell[] = []; let cursor = 0;
    const effects: (() => void)[] = [];
    const same = (a?: unknown[], b?: unknown[]) => Boolean(a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index])));
    return { cells, effects, save: vi.fn(),
        reset() { cells.length = 0; effects.length = 0; cursor = 0; },
        begin() { cursor = 0; },
        useState(initial?: unknown) {
            const index = cursor++; if (!cells[index]) cells[index] = { value: typeof initial === 'function' ? initial() : initial };
            return [cells[index].value, (next: unknown) => { cells[index].value = typeof next === 'function' ? next(cells[index].value) : next; }];
        },
        useRef(value?: unknown) { const index = cursor++; if (!cells[index]) cells[index] = { value: { current: value } }; return cells[index].value; },
        useCallback(callback: unknown, deps: unknown[]) {
            const index = cursor++; if (!cells[index] || !same(cells[index].deps, deps)) cells[index] = { value: callback, deps }; return cells[index].value;
        },
        effect(callback: () => void | (() => void), deps?: unknown[]) {
            const index = cursor++, previous = cells[index];
            if (!previous || !same(previous.deps, deps)) {
                cells[index] = { deps, cleanup: previous?.cleanup };
                effects.push(() => { cells[index].cleanup?.(); cells[index].cleanup = callback() || undefined; });
            }
        },
        commit() { for (const effect of effects.splice(0)) effect(); },
        unmount() { for (const cell of cells) cell.cleanup?.(); },
    };
});
vi.mock('react', () => ({ useState: hooks.useState, useRef: hooks.useRef, useCallback: hooks.useCallback, useEffect: hooks.effect, useLayoutEffect: hooks.effect }));

import { useIslandTutorial } from './useIslandTutorial';
import { clearTutorialMemory, hasTutorialEvent, tutorialKey } from '../../../domain/island/tutorialState';
let doc: EventTarget & { hidden: boolean };
let win: EventTarget;
beforeEach(() => {
    hooks.reset(); clearTutorialMemory();
    doc = Object.assign(new EventTarget(), { hidden: false }); win = new EventTarget();
    vi.stubGlobal('document', doc); vi.stubGlobal('window', win);
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
});
afterEach(() => { hooks.unmount(); vi.unstubAllGlobals(); });
function harness() {
    let props: Parameters<typeof useIslandTutorial>[0] = { profileId: 'child', eligible: true, screen: 'home', active: true, allowed: true, grown: true, canView: true };
    let api!: ReturnType<typeof useIslandTutorial>;
    function RenderTutorial() { hooks.begin(); const result = useIslandTutorial(props); hooks.commit(); return result; }
    const render = (next: Partial<typeof props> = {}) => {
        props = { ...props, ...next };
        // Explicit controlled React hook commits, not browser/participant evidence.
        for (let n = 0; n < 3; n++) api = RenderTutorial();
        return api;
    };
    render(); return { render, get api() { return api; } };
}
describe('tutorial interruption and replay', () => {
    it('suspends one guide during background persistence without losing it or queuing another', () => {
        const h = harness(); expect(h.api.current?.id).toBe('growth'); h.api.shown();
        h.render({ allowed: false }); expect(h.api.current).toBeUndefined();
        h.render({ allowed: true }); expect(h.api.current?.id).toBe('growth');
        h.api.dismiss(); h.render(); expect(h.api.current).toBeUndefined();
        h.render({ allowed: false }); h.render({ allowed: true }); expect(h.api.current).toBeUndefined();
        expect(hasTutorialEvent('child', 'growth', 'dismissed')).toBe(true);
    });
    it('retires a shown guide on learning and offers only the next unseen guide on return', () => {
        const h = harness(); h.api.shown();
        h.render({ screen: 'learning' }); expect(h.api.current).toBeUndefined();
        h.render({ screen: 'home' }); expect(h.api.current?.id).toBe('view');
    });
    it('does not return a guide after hiding the document', () => {
        const h = harness(); h.api.shown();
        doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); h.render(); expect(h.api.current).toBeUndefined();
        doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); h.render(); expect(h.api.current).toBeUndefined();
    });
    it('replays explicitly for an existing user without resetting or recording automatic state', () => {
        const h = harness(); h.render({ screen: 'help', eligible: false });
        h.api.start('customization', 'customization'); h.render({ screen: 'customization', allowed: false });
        h.render({ allowed: true }); expect(h.api.current?.manual).toBe(true);
        h.api.shown(); h.api.practice('customization'); h.render();
        expect(hasTutorialEvent('child', 'customization', 'shown')).toBe(false);
        expect(h.api.current).toBeUndefined();
    });
    it('drops a pending manual request when learning interrupts before the target is ready', () => {
        const h = harness(); h.render({ screen: 'help', eligible: false });
        h.api.start('photo', 'camera'); h.render({ screen: 'camera', allowed: false });
        h.render({ screen: 'learning' }); h.render({ screen: 'camera', allowed: true });
        expect(h.api.current).toBeUndefined();
    });
    it('ignores unrelated tab writes but retires the same guide completed elsewhere', () => {
        const h = harness(); h.api.shown();
        win.dispatchEvent(Object.assign(new Event('storage'), { key: 'unrelated', newValue: '1' }));
        h.render(); expect(h.api.current?.id).toBe('growth');
        win.dispatchEvent(Object.assign(new Event('storage'), { key: tutorialKey('child', 'growth', 'dismissed'), newValue: '1' }));
        h.render(); expect(h.api.current).toBeUndefined();
    });
});
