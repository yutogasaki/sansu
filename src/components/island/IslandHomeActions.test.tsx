import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { IslandHomeActions, type IslandHomeActionsProps } from './IslandHomeActions';

type ActionButton = ReactElement<{ 'data-home-action': string; 'aria-label'?: string; disabled: boolean; onClick: () => void; children?: ReactNode }>;
function buttons(node: ReactNode): ActionButton[] {
    if (Array.isArray(node)) return node.flatMap(buttons);
    if (!isValidElement<{ children?: ReactNode }>(node)) return [];
    return node.type === 'button' ? [node as ActionButton] : buttons(node.props.children);
}
function props(overrides: Partial<IslandHomeActionsProps> = {}): IslandHomeActionsProps {
    return { busy: false, comparisonDisabled: false, workshopUnlocked: true, pendingRewards: 0,
        onPlay: vi.fn(), onGuide: vi.fn(), onWorkshop: vi.fn(), onInventory: vi.fn(), onCustomization: vi.fn(),
        onExperience: vi.fn(), onRewards: vi.fn(), onAlbum: vi.fn(), onShared: vi.fn(), ...overrides };
}
describe('home optional action hierarchy', () => {
    it('keeps all existing routes and accessible names in the intended six-tile order', () => {
        const tree = IslandHomeActions(props()), actions = buttons(tree);
        expect(actions.map(button => button.props['data-home-action'])).toEqual([
            'play', 'guide', 'workshop', 'inventory', 'customization', 'experience', 'album', 'shared',
        ]);
        expect(actions.slice(0, 6).map(button => button.props['aria-label'])).toEqual([
            'どうぶつと あそぶ', 'みつける', 'おためしの いりえ', 'もちもの', 'きせかえ', 'しまづくり',
        ]);
        const html = renderToStaticMarkup(tree);
        expect(html).toContain('island-home-secondary'); expect(html).toContain('island-play-entry');
        expect(html).toContain('>あそぶ</span>'); expect(html).toContain('>つくる</span>');
    });
    it('does not invent locked workshop, shared, or empty gift buttons', () => {
        const tree = IslandHomeActions(props({ workshopUnlocked: false }));
        expect(buttons(tree).map(button => button.props['data-home-action'])).toEqual(['play', 'guide', 'inventory', 'customization', 'experience', 'album']);
        const html = renderToStaticMarkup(tree);
        expect(html).not.toContain('おためしの いりえ'); expect(html).not.toContain('かざりと きおく'); expect(html).not.toContain('おくりものを えらぶ');
    });
    it('forwards each existing action once and gives a real gift its own arrival row', () => {
        const callbacks = props({ pendingRewards: 2 }), tree = IslandHomeActions(callbacks);
        const actionCallbacks = { play: callbacks.onPlay, guide: callbacks.onGuide, workshop: callbacks.onWorkshop,
            inventory: callbacks.onInventory, customization: callbacks.onCustomization, experience: callbacks.onExperience,
            rewards: callbacks.onRewards, album: callbacks.onAlbum, shared: callbacks.onShared };
        for (const button of buttons(tree)) {
            button.props.onClick();
            expect(actionCallbacks[button.props['data-home-action'] as keyof typeof actionCallbacks]).toHaveBeenCalledTimes(1);
        }
        const html = renderToStaticMarkup(tree);
        expect(html).toContain('island-home-arrival'); expect(html).toContain('2こ とどいているよ');
        expect(buttons(tree)[0].props['data-home-action']).toBe('rewards');
    });
    it('retains the discovery-read exception while all mutating routes remain busy', () => {
        const openComparison = buttons(IslandHomeActions(props({ busy: true, comparisonDisabled: false, pendingRewards: 1 })));
        expect(openComparison.filter(button => !button.props.disabled).map(button => button.props['data-home-action'])).toEqual(['guide', 'album']);
        expect(buttons(IslandHomeActions(props({ busy: true, comparisonDisabled: true, pendingRewards: 1 }))).every(button => button.props.disabled)).toBe(true);
    });
});
