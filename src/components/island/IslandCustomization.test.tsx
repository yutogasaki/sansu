import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createIsland } from '../../domain/island/catalog';
import { getIslandCustomization, type IslandCustomizationState } from '../../domain/island/customization';
import { IslandCustomization, IslandCustomizationGoal, IslandCustomizationPreviewNotice } from './IslandCustomization';

const islandWith = (overrides: Partial<IslandCustomizationState> = {}) => {
    const island = createIsland('child', 1);
    return { ...island, customization: { ...getIslandCustomization(island), ...overrides } };
};
const noop = () => undefined;

describe('island customization choices', () => {
    it('shows the actual cost, current balance and missing stars while a desired item stays selectable', () => {
        const island = islandWith({ points: 10, desiredItemId: 'starry' });
        const before = JSON.stringify(island);
        const html = renderToStaticMarkup(<IslandCustomization island={island} preview={{ themeId: 'starry', accentId: null }} selectedId="starry"
            disabled={false} onSelect={noop} onAction={noop} onClose={noop} />);
        expect(html).toContain('aria-label="もっている ほし 10こ"');
        expect(html).toContain('data-points="10"');
        expect(html).toContain('data-preview="true"');
        expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-customization-action="purchase"/);
        expect(html).toContain('あと ');
        expect(html).toContain('>20<');
        expect(html).toContain('ほしいを やめる');
        expect(html).toContain('data-customization-action="clear-desire"');
        expect(html.match(/data-customization-id=/g)).toHaveLength(7);
        expect(html).not.toContain('<canvas');
        expect(JSON.stringify(island)).toBe(before);
    });
    it('offers a certain purchase when affordable and free selection for an owned appearance', () => {
        const island = islandWith({ points: 30 });
        const buy = renderToStaticMarkup(<IslandCustomization island={island} preview={{ themeId: 'starry', accentId: null }} selectedId="starry"
            disabled={false} onSelect={noop} onAction={noop} onClose={noop} />);
        expect(buy).toMatch(/<button class="island-primary" data-customization-action="purchase"/);
        expect(buy).toContain('こうかんして つかう');
        const owned = islandWith({ points: 0, ownedItemIds: ['moon-garden', 'starry', 'star-lanterns'], accentId: 'star-lanterns' });
        const equip = renderToStaticMarkup(<IslandCustomization island={owned} preview={{ themeId: 'starry', accentId: 'star-lanterns' }} selectedId="starry"
            disabled={false} onSelect={noop} onAction={noop} onClose={noop} />);
        expect(equip).toContain('data-customization-action="equip"');
        expect(equip).toContain('これを つかう');
        expect(equip).not.toContain('data-customization-action="purchase"');
        expect(equip).toContain('ほしぞらの セットが そろった');
        expect(equip).toContain('data-customization-action="clear-accent"');
    });
    it('only shows a home goal after the child has picked one, with an exchange cue at its price', () => {
        expect(renderToStaticMarkup(<IslandCustomizationGoal island={islandWith()} disabled={false} onOpen={noop} />)).toBe('');
        const html = renderToStaticMarkup(<IslandCustomizationGoal island={islandWith({ points: 30, desiredItemId: 'starry' })} disabled={false} onOpen={noop} />);
        expect(html).toContain('ほしぞらの しま');
        expect(html).toContain('こうかん できるよ');
        expect(html).not.toContain('あと');
    });
    it('labels an uncommitted change visibly and an already saved appearance accurately without relying on motion', () => {
        const saved = { themeId: 'candy' as const, accentId: null };
        expect(renderToStaticMarkup(<IslandCustomizationPreviewNotice saved={saved} preview={saved} />)).toContain('いまの しま');
        expect(renderToStaticMarkup(<IslandCustomizationPreviewNotice saved={saved} preview={{ ...saved, accentId: 'star-lanterns' }} />)).toContain('おためし');
    });
});
