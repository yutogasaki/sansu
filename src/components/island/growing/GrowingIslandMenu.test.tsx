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
    return { villagers: [], faces: {}, drops: 20, busy: false,
        onClose: vi.fn(), onFriends: vi.fn(), onTrace: vi.fn(),
        onShow: vi.fn(), onFlowers: vi.fn(), onGuide: vi.fn(), ...overrides };

}
describe('Growing Island menu destinations and actual island identity', () => {
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
    it('keeps primary island actions and view controls out of the secondary menu', () => {
        const p = props(), actions = buttons(GrowingIslandMenuContents(p));
        actions.forEach(button => button.props.onClick());
        for (const action of [p.onFriends, p.onTrace, p.onShow, p.onFlowers, p.onGuide]) expect(action).toHaveBeenCalledTimes(1);
        const html = renderToStaticMarkup(GrowingIslandMenuContents(p));
        expect(html).toContain('aria-label="しまの くらし"');
        for (const label of ['しまに おく', 'もちもの', 'そだつ場所', 'まわす', 'へ ひろげる']) expect(html).not.toContain(label);
        for (const label of ['いえ', 'きろく', '設定']) expect(html).not.toContain(`<span>${label}</span>`);
    });
    it('keeps profile and sound utilities in an optional disclosure', () => {
        const html = renderToStaticMarkup(GrowingIslandMenuContents(props({ utilities: <button>きりかえ</button> })));
        expect(html.split('growing-pocket-other')[1]).toContain('きりかえ');
        expect(html).not.toContain('<details open');
    });
    it('preserves sea voyages and bridge actions, including their busy locks', () => {
        const p = props({ onVoyages: vi.fn(), onBridge: vi.fn(), bridge: { built: true, ready: false, reason: '' } });
        const actions = buttons(GrowingIslandMenuContents(p));
        actions.find(button => renderToStaticMarkup(button).includes('海図と ふね'))!.props.onClick();
        actions.find(button => button.props['aria-label'] === 'はしを みにいく')!.props.onClick();
        expect(p.onVoyages).toHaveBeenCalledTimes(1); expect(p.onBridge).toHaveBeenCalledTimes(1);
        const busy = buttons(GrowingIslandMenuContents({ ...p, busy: true }));
        expect(busy.find(button => renderToStaticMarkup(button).includes('海図と ふね'))!.props.disabled).toBe(true);
        expect(busy.find(button => button.props['aria-label'] === 'はしを みにいく')!.props.disabled).toBe(true);
    });
});
