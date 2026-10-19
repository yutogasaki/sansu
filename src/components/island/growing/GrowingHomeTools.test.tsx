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
        const p = { islandName: 'ながい なまえの しま', drops: 120, quote: { sides: ['east' as const], price: 120 }, visible: true, goalVisible: true, expansionVisible: true, menuOpen: false, menuRef: { current: null },
            onName: vi.fn(), onView: vi.fn(), onExpand: vi.fn(), onPlace: vi.fn(), onStored: vi.fn(), onMenu: vi.fn(), onGoal: vi.fn() };
        const ready = renderToStaticMarkup(<GrowingHomeTools {...p} />);
        expect(ready).toContain('aria-label="しまに おく"');
        expect(ready).toContain('aria-label="もちもの"');
        expect(ready).toContain('data-affordable="true"');
        expect(ready).toContain('💧 120');
        const locked = renderToStaticMarkup(<GrowingHomeTools {...p} quote={undefined} goalVisible={false} expansionLock={{ requiredLevel: 5, currentLevel: 4, price: 720 }} />);
        expect(locked).toContain('aria-label="しまを ひろげる"');
        expect(locked).toContain('島Lv5から');
        expect(locked).toContain('data-affordable="false"');
        expect(locked).not.toContain('disabled');
        const menu = renderToStaticMarkup(<GrowingHomeTools {...p} visible={false} menuOpen />);
        expect(menu).toContain('aria-label="しまのメニュー"');
        for (const label of ['しまに おく', 'もちもの', 'しまを ひろげる', 'そだつ場所']) expect(menu).not.toContain(`aria-label="${label}"`);
    });
    it('explains a level gate without offering a purchase or changing its price', () => {
        const html = renderToStaticMarkup(<GrowingExpansion expansionLock={{ requiredLevel: 6, currentLevel: 5, price: 960 }} drops={1148} busy={false} onClose={vi.fn()} onExpand={vi.fn()} />);
        expect(html).toContain('島Lv6で 次の土地が ひらくよ');
        expect(html).toContain('いまの 島Lv：5');
        expect(html).toContain('960');
        expect(html).not.toContain('へ ひろげる');
        expect(html).toContain('ひろげるを とじる');
    });
});
