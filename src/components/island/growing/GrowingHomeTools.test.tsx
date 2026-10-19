import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GrowingExpansion, GrowingHomeTools } from './GrowingHomeTools';

describe('island direct tools', () => {
    it.each([
        { drops: 119, busy: false, disabled: true },
        { drops: 120, busy: false, disabled: false },
        { drops: 120, busy: true, disabled: true },
    ])('preserves the quoted price, available sides and purchase lock: %j', ({ drops, busy, disabled }) => {
        const html = renderToStaticMarkup(<GrowingExpansion quote={{ sides: ['east', 'south'], price: 120 }} drops={drops} busy={busy} onClose={vi.fn()} onExpand={vi.fn()} />);
        expect(html).toContain('ひがしへ ひろげる');
        expect(html).toContain('みなみへ ひろげる');
        expect(html).not.toContain('にしへ ひろげる');
        expect(html.match(/disabled=""/g)?.length ?? 0).toBe(disabled ? 2 : 0);
        expect(html.match(/💧 120/g)).toHaveLength(2);
    });
    it('shows the actual price before opening land choices and keeps primary play out of an open menu', () => {
        const p = { islandName: 'ながい なまえの しま', drops: 120, quote: { sides: ['east' as const], price: 120 }, visible: true, goalVisible: true, menuOpen: false, menuRef: { current: null },
            onName: vi.fn(), onView: vi.fn(), onExpand: vi.fn(), onPlace: vi.fn(), onStored: vi.fn(), onMenu: vi.fn(), onGoal: vi.fn() };
        const ready = renderToStaticMarkup(<GrowingHomeTools {...p} />);
        expect(ready).toContain('aria-label="しまに おく"');
        expect(ready).toContain('aria-label="もちもの"');
        expect(ready).toContain('data-affordable="true"');
        expect(ready).toContain('💧 120');
        const menu = renderToStaticMarkup(<GrowingHomeTools {...p} visible={false} menuOpen />);
        expect(menu).toContain('aria-label="しまのメニュー"');
        for (const label of ['しまに おく', 'もちもの', 'しまを ひろげる', 'そだつ場所']) expect(menu).not.toContain(`aria-label="${label}"`);
    });
});
