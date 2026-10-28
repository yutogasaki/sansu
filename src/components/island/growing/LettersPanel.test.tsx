import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
const hooks = vi.hoisted(() => {
    type Cell = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
    let cells: Cell[] = [], cursor = 0, dirty = false;
    const effects: (() => void)[] = [];
    return {
        reset() { cells = []; cursor = 0; dirty = false; effects.length = 0; },
        begin() { cursor = 0; dirty = false; },
        changed: () => dirty,
        useState(initial: unknown) {
            const i = cursor++;
            cells[i] ??= { value: typeof initial === 'function' ? initial() : initial };
            return [cells[i].value, (next: unknown) => {
                const value = typeof next === 'function' ? next(cells[i].value) : next;
                if (!Object.is(value, cells[i].value)) { cells[i].value = value; dirty = true; }
            }];
        },
        useRef(initial: unknown) { const i = cursor++; cells[i] ??= { value: { current: initial } }; return cells[i].value; },
        effect(callback: () => (() => void) | void, deps?: readonly unknown[]) {
            const i = cursor++, previous = cells[i];
            cells[i] ??= {};
            if (!deps || !previous?.deps || deps.some((value, j) => !Object.is(value, previous.deps?.[j]))) {
                cells[i].deps = deps;
                effects.push(() => { cells[i].cleanup?.(); cells[i].cleanup = callback() || undefined; });
            }
        },
        commit() { for (const effect of effects.splice(0)) effect(); },
        unmount() { for (const cell of cells) cell.cleanup?.(); },
    };
});
vi.mock('react', async importOriginal => ({ ...await importOriginal<typeof import('react')>(),
    useState: hooks.useState, useRef: hooks.useRef, useEffect: hooks.effect,
    useCallback: (callback: unknown) => callback,
    useMemo: (factory: () => unknown) => factory(),
}));

const audio = vi.hoisted(() => ({ speak: vi.fn(), stop: vi.fn() }));
vi.mock('../../../utils/tts', () => ({ speakJapanese: audio.speak }));
import { LettersPanel } from './LettersPanel';
const store = new Map<string, string>();
beforeEach(() => {
    hooks.reset(); store.clear(); vi.clearAllMocks(); audio.speak.mockReturnValue(audio.stop);
    vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) });
    vi.stubGlobal('document', Object.assign(new EventTarget(), { querySelector: () => null, hidden: false }));
    vi.stubGlobal('requestAnimationFrame', (fn: () => void) => { fn(); return 0; });
});
afterEach(() => { hooks.unmount(); vi.unstubAllGlobals(); });
const letters = [{ id: 'one', from: 'ぽこもこ', text: 'あたらしい はなが さいたよ。'.repeat(12), order: 2 }, { id: 'two', from: 'なかま', text: 'あそぼう', order: 1 }];
function harness() {
    let tree: ReactElement;
    const render = () => { hooks.begin(); tree = LettersPanel({ profileId: 'menu-test', letters }); hooks.commit(); };
    const nodes = (node: unknown): ReactElement<Record<string, unknown>>[] => {
        if (!node || typeof node !== 'object' || !('props' in node)) return [];
        const e = node as ReactElement<Record<string, unknown>>;
        return [e, ...[e.props.children].flat(Infinity).flatMap(nodes)];
    };
    render();
    return {
        click(name: string) {
            const button = nodes(tree).find(e => e.type === 'button' && (e.props.children === name || e.props['data-letter-id'] === name || e.props['data-room-entry'] === name));
            if (!button) throw new Error('Missing button: ' + name);
            (button.props.onClick as () => void)(); render();
        },
        paragraphs: () => nodes(tree).filter(e => e.type === 'p').map(e => e.props.children),
        unread: () => nodes(tree).filter(e => e.props['data-unread'] === 'true').length,
    };
}
describe('one-letter reader', () => {
    it('keeps the list concise and marks only the explicitly spoken letter read', () => {
        const h = harness(); h.click('letters');
        expect(h.unread()).toBe(2); expect(h.paragraphs()).not.toContain(letters[0].text);
        h.click('one'); expect(h.paragraphs()).toEqual([letters[0].text]);
        expect(store.size).toBe(0); expect(audio.speak).not.toHaveBeenCalled();
        h.click('よみあげる');
        expect(JSON.parse(store.get('sansu-growing-letters-read:menu-test')!)).toEqual(['one']);
        expect(audio.speak).toHaveBeenCalledWith(`ぽこもこより。${letters[0].text}`);
        h.click('いちらんへ もどる'); expect(audio.stop).toHaveBeenCalled(); expect(h.unread()).toBe(1);
    });
    it('stops owned audio on stop, close and unmount and reopens the list', () => {
        const h = harness(); h.click('letters'); h.click('one'); h.click('よみあげる');
        h.click('よみあげを とめる'); expect(audio.stop).toHaveBeenCalledTimes(1);
        h.click('とじる'); expect(audio.stop).toHaveBeenCalledTimes(2);
        h.click('letters'); expect(h.unread()).toBe(1); expect(h.paragraphs()).toEqual([]);
        hooks.unmount(); expect(audio.stop).toHaveBeenCalledTimes(3);
    });
});
