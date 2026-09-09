import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { IslandHomeActions, IslandHomeMenuContents, type IslandHomeActionsProps } from './IslandHomeActions';

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
const contents = (callbacks: IslandHomeActionsProps) => IslandHomeMenuContents({ ...callbacks, onChoose: action => action() });
describe('home optional action hierarchy', () => {
    it('groups editing and extra play while preserving fallback record routes', () => {
        const tree = contents(props()), actions = buttons(tree);
        expect(actions.map(button => button.props['data-home-action'])).toEqual([
            'play', 'guide', 'inventory', 'customization', 'experience', 'album', 'shared', 'workshop',
        ]);
        expect(actions.slice(0, 5).map(button => button.props['aria-label'])).toEqual([
            'どうぶつと あそぶ', 'みつける', 'もちものを おく', 'しまの きせかえ', 'なまえ・けしき',
        ]);
        const html = renderToStaticMarkup(tree);
        expect(html).toContain('island-menu-scroll'); expect(html).toContain('island-play-entry');
        expect(html).toContain('<details class="island-menu-group" data-home-group="arrange">');
        expect(html).toContain('<details class="island-menu-group" data-home-group="more-play">');
        expect(html).not.toContain('<details open');
        expect(html).toContain('>あそぶ</span>'); expect(html).toContain('>つくる</span>');
    });
    it('does not invent locked workshop, shared, or empty gift buttons', () => {
        const tree = contents(props({ workshopUnlocked: false }));
        expect(buttons(tree).map(button => button.props['data-home-action'])).toEqual(['play', 'guide', 'inventory', 'customization', 'experience', 'album']);
        const html = renderToStaticMarkup(tree);
        expect(html).not.toContain('おためしの いりえ'); expect(html).not.toContain('かざりと きおく'); expect(html).not.toContain('おくりものを えらぶ');
    });
    it('forwards each existing action once and gives a real gift its own arrival row', () => {
        const callbacks = props({ pendingRewards: 2, onKeepsakes: vi.fn(), onOtherGames: vi.fn() }), tree = contents(callbacks);
        const actionCallbacks = { play: callbacks.onPlay, guide: callbacks.onGuide, workshop: callbacks.onWorkshop,
            inventory: callbacks.onInventory, customization: callbacks.onCustomization, experience: callbacks.onExperience,
            rewards: callbacks.onRewards, album: callbacks.onAlbum, shared: callbacks.onShared,
            keepsakes: callbacks.onKeepsakes, 'other-games': callbacks.onOtherGames };
        for (const button of buttons(tree)) {
            button.props.onClick();
            expect(actionCallbacks[button.props['data-home-action'] as keyof typeof actionCallbacks]).toHaveBeenCalledTimes(1);
        }
        const html = renderToStaticMarkup(tree);
        expect(html).toContain('island-home-arrival'); expect(html).toContain('2こ とどいているよ');
        expect(buttons(tree)[0].props['data-home-action']).toBe('rewards');
        expect(buttons(tree).map(button => button.props['data-home-action'])).toEqual([
            'rewards', 'play', 'guide', 'inventory', 'customization', 'experience', 'keepsakes', 'workshop', 'other-games',
        ]);
        expect(html).not.toContain('data-home-action="album"');
        expect(html).not.toContain('data-home-action="shared"');
    });
    it('retains the discovery-read exception while all mutating routes remain busy', () => {
        const openComparison = buttons(contents(props({ busy: true, comparisonDisabled: false, pendingRewards: 1, onKeepsakes: vi.fn(), onOtherGames: vi.fn() })));
        expect(openComparison.filter(button => !button.props.disabled).map(button => button.props['data-home-action'])).toEqual(['guide', 'keepsakes']);
        expect(buttons(contents(props({ busy: true, comparisonDisabled: true, pendingRewards: 1 }))).every(button => button.props.disabled)).toBe(true);
    });
});

describe('native home menu shell', () => {
    it.each([false, true])('renders a labelled dialog and comparisonDisabled=%s on its trigger through React', comparisonDisabled => {
        const html = renderToStaticMarkup(<IslandHomeActions {...props({ busy: true, comparisonDisabled })} />);
        const trigger = html.match(/<button[^>]*class="island-menu-trigger"[^>]*>/)?.[0];
        expect(trigger).toBeDefined();
        expect(trigger).toContain('aria-haspopup="dialog"');
        expect(trigger?.includes('disabled=""')).toBe(comparisonDisabled);
        expect(html).toContain('<dialog class="island-menu" aria-labelledby="island-menu-title">');
        expect(html).toContain('<h2 id="island-menu-title">しまのメニュー</h2>');
        expect(html).toContain('aria-label="しまのメニューを とじる"');
    });
});
