import { beforeEach, describe, expect, it, vi } from 'vitest';
const hooks = vi.hoisted(() => ({ state: vi.fn(), refs: [] as { current: unknown }[] }));
vi.mock('react', async original => ({ ...await original<object>(),
    useState: () => [0, hooks.state], useRef: (value: unknown) => { const ref = { current: value }; hooks.refs.push(ref); return ref; },
}));
import LifeCatalogPages from './LifeCatalogPages';
beforeEach(() => { hooks.refs.length = 0; hooks.state.mockReset(); });
function harness() {
    const tree = LifeCatalogPages({ children: [<button key="a">おはな</button>, <button key="b">ブランコ</button>] });
    const viewport = tree.props.children[0].props;
    return { viewport, dots: tree.props.children[1].props.children[1].props.children };
}
describe('build catalog native swipe', () => {
    it('does not turn a drag that returns to its start into a product purchase', () => {
        const { viewport } = harness();
        viewport.onTouchStartCapture({ touches: [{ clientX: 200, clientY: 40 }] });
        viewport.onTouchMoveCapture({ touches: [{ clientX: 70, clientY: 45 }] });
        viewport.onTouchMoveCapture({ touches: [{ clientX: 200, clientY: 40 }] });
        const event = { detail: 1, preventDefault: vi.fn(), stopPropagation: vi.fn() };
        viewport.onClickCapture(event); expect(event.stopPropagation).toHaveBeenCalledOnce();
        viewport.onTouchStartCapture({ touches: [{ clientX: 200, clientY: 40 }] });
        event.stopPropagation.mockClear(); viewport.onClickCapture(event); expect(event.stopPropagation).not.toHaveBeenCalled();
    });
    it('leaves vertical scrolling native and permits keyboard activation after a swipe', () => {
        const { viewport } = harness(), preventDefault = vi.fn();
        viewport.onTouchStartCapture({ touches: [{ clientX: 50, clientY: 20 }] });
        viewport.onTouchMoveCapture({ touches: [{ clientX: 52, clientY: 120 }], preventDefault });
        viewport.onClickCapture({ detail: 0, preventDefault, stopPropagation: vi.fn() });
        expect(preventDefault).not.toHaveBeenCalled();
    });
    it('offers named dot controls and jumps immediately for reduced motion', () => {
        const { dots } = harness(), scrollTo = vi.fn();
        hooks.refs[0].current = { clientWidth: 300, scrollTo };
        vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
        try {
            expect(dots[1].props['aria-label']).toBe('2ページめ');
            dots[1].props.onClick(); expect(scrollTo).toHaveBeenCalledWith({ left: 300, behavior: 'instant' });
        } finally { vi.unstubAllGlobals(); }
    });
});
