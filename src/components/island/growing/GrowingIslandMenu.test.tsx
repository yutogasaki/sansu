import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GrowingIslandMenuContents, type GrowingIslandMenuProps } from './GrowingIslandMenu';

type Button = ReactElement<{ children?: ReactNode; onClick: () => void; disabled?: boolean; 'aria-label'?: string }>;
function buttons(node: ReactNode): Button[] {
    if (Array.isArray(node)) return node.flatMap(buttons);
    if (!isValidElement<{ children?: ReactNode }>(node)) return [];
    return node.type === 'button' ? [node as Button] : buttons(node.props.children);
}
function props(overrides: Partial<GrowingIslandMenuProps> = {}): GrowingIslandMenuProps {
    return { villagers: [], faces: {}, drops: 20, busy: false, quote: { sides: ['east', 'south'], price: 24 },
        onClose: vi.fn(), onFriends: vi.fn(), onSeeds: vi.fn(), onTrace: vi.fn(), onStored: vi.fn(),
        onHome: vi.fn(), onShow: vi.fn(), onFlowers: vi.fn(), onGuide: vi.fn(), onSettings: vi.fn(),
        onRotate: vi.fn(), onExpand: vi.fn(), ...overrides };
}
describe('Growing Island menu destinations and actual island identity', () => {
    it('opens the optional place book as its own destination', () => {
        const onPlaces = vi.fn(), p = props({ onPlaces });
        buttons(GrowingIslandMenuContents(p)).find(button => button.props['aria-label'] === 'そだつ場所')!.props.onClick();
        expect(onPlaces).toHaveBeenCalledTimes(1);
        expect(renderToStaticMarkup(GrowingIslandMenuContents(p))).toContain('そだつ場所');
    });
    it('keeps empty population honest and limits portraits while showing the actual full count', () => {
        const empty = renderToStaticMarkup(GrowingIslandMenuContents(props()));
        expect(empty).toContain('0にん'); expect(empty).toContain('これからの なかま'); expect(empty).not.toContain('<img');
        const villagers = Array.from({ length: 8 }, (_, i) => ({ id: `friend-${i}`, name: `なまえ${i}`, species: 'rabbit' as const, home: 'pokomoko', arrivedAt: i, trait: 'mellow' as const, variant: { color: 0, accessory: 0, sparkle: false } }));
        const populated = renderToStaticMarkup(GrowingIslandMenuContents(props({ villagers, pictures: { friends: 'actual-first-three.png' } })));
        expect(populated).toContain('8にん'); expect(populated.match(/<img /g)).toHaveLength(1); expect(populated).toContain('actual-first-three.png');
        expect(populated).not.toContain('friend-3.png');
        const fallback = renderToStaticMarkup(GrowingIslandMenuContents(props({ villagers })));
        expect(fallback).not.toContain('<img'); expect(fallback).toContain('8にん');
    });
    it('forwards each destination once, preserves rotation direction and expansion side', () => {
        const p = props({ drops: 24 }), actions = buttons(GrowingIslandMenuContents(p));
        actions.forEach(button => button.props.onClick());
        for (const action of [p.onFriends, p.onSeeds, p.onTrace, p.onStored, p.onHome, p.onShow, p.onFlowers, p.onGuide, p.onSettings]) expect(action).toHaveBeenCalledTimes(1);
        expect(p.onRotate).toHaveBeenCalledTimes(2);
        expect(p.onRotate).toHaveBeenNthCalledWith(1, -1); expect(p.onRotate).toHaveBeenNthCalledWith(2, 1);
        expect(p.onExpand).toHaveBeenCalledTimes(2);
        expect(p.onExpand).toHaveBeenNthCalledWith(1, 'east'); expect(p.onExpand).toHaveBeenNthCalledWith(2, 'south');
        const html = renderToStaticMarkup(GrowingIslandMenuContents(p));
        expect(html).toContain('<details class="growing-pocket-tools">'); expect(html).not.toContain('<details open');
        expect(html).toContain('aria-label="しまの あそびかた"');
    });
    it.each([{ drops: 23, busy: false, disabled: true }, { drops: 24, busy: false, disabled: false }, { drops: 24, busy: true, disabled: true }])('retains the exact price and prevents unavailable expansion: %j', ({ drops, busy, disabled }) => {
        const p = props({ drops, busy }), actions = buttons(GrowingIslandMenuContents(p));
        expect(actions.slice(-2).every(b => b.props.disabled === disabled)).toBe(true);
        expect(renderToStaticMarkup(GrowingIslandMenuContents(p))).toContain('24</small>');
        expect(buttons(GrowingIslandMenuContents(props({ quote: undefined })))).toHaveLength(11);
    });
});
