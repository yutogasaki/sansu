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
        expect(html).toContain('<span>50<span class="island-customization-unit">');
        expect(html).toContain('ほしいを やめる');
        expect(html).toContain('data-customization-action="clear-desire"');
        expect(html).toContain('data-customization-category="part"');
        expect(html).toContain('data-customization-category="set"');
        expect(html).not.toContain('<canvas');
        expect(JSON.stringify(island)).toBe(before);
    });
    it('offers a certain purchase when affordable and free selection for an owned appearance', () => {
        const island = islandWith({ points: 60 });
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
        const accent = renderToStaticMarkup(<IslandCustomization island={owned} preview={{ themeId: 'moon-garden', accentId: 'star-lanterns' }} selectedId="star-lanterns"
            disabled={false} onSelect={noop} onAction={noop} onClose={noop} />);
        expect(accent).toContain('data-customization-action="clear-accent"');
    });
    it('only shows a home goal after the child has picked one, with an exchange cue at its price', () => {
        expect(renderToStaticMarkup(<IslandCustomizationGoal island={islandWith()} disabled={false} onOpen={noop} />)).toBe('');
        const html = renderToStaticMarkup(<IslandCustomizationGoal island={islandWith({ points: 60, desiredItemId: 'starry' })} disabled={false} onOpen={noop} />);
        expect(html).toContain('ほしぞらの しま');
        expect(html).toContain('こうかん できるよ');
        expect(html).not.toContain('あと');
    });
    it('shows only the missing theme price after a house purchase, including the home goal', () => {
        const island = islandWith({ points: 45, ownedItemIds: ['moon-garden', 'starry-house'], desiredItemId: 'starry' });
        const html = renderToStaticMarkup(<IslandCustomization island={island} preview={{ themeId: 'starry', accentId: null }} selectedId="starry"
            disabled={false} onSelect={noop} onAction={noop} onClose={noop} />);
        expect(html).toContain('もっている ぶん');
        expect(html).toContain('<span>15<span class="island-customization-unit">');
        expect(html).toMatch(/<button class="island-primary" data-customization-action="purchase"/);
        expect(html).not.toContain('セットが そろった');
        const goal = renderToStaticMarkup(<IslandCustomizationGoal island={island} disabled={false} onOpen={noop} />);
        expect(goal).toContain('こうかん できるよ');
        expect(goal).not.toContain('あと');
    });
    it('offers a part already included in an old theme without charging again', () => {
        const island = islandWith({ points: 0, ownedItemIds: ['moon-garden', 'starry'] });
        const html = renderToStaticMarkup(<IslandCustomization island={island} preview={{ themeId: 'moon-garden', accentId: null }} selectedId="starry-house"
            disabled={false} onSelect={noop} onAction={noop} onClose={noop} />);
        expect(html).toContain('data-customization-action="equip"');
        expect(html).not.toContain('data-customization-action="purchase"');
    });
    it('labels an uncommitted change visibly and an already saved appearance accurately without relying on motion', () => {
        const saved = { themeId: 'candy' as const, accentId: null };
        expect(renderToStaticMarkup(<IslandCustomizationPreviewNotice saved={saved} preview={saved} />)).toContain('いまの しま');
        expect(renderToStaticMarkup(<IslandCustomizationPreviewNotice saved={saved} preview={{ ...saved, accentId: 'star-lanterns' }} />)).toContain('おためし');
    });
    it('explains house ownership and roof-only application, and offers independent slots without another canvas', () => {
        const island = islandWith({ points: 25 });
        const html = renderToStaticMarkup(<IslandCustomization island={island} preview={{ themeId: 'moon-garden', accentId: null }} selectedId="candy-house"
            selectedSlot="houseRoof" disabled={false} onSelect={noop} onAction={noop} onClose={noop} onRestore={noop} onUndoPart={noop} />);
        expect(html).toContain('いま かえるのは やねだけ');
        expect(html).toContain('data-appearance-slot="houseBody"');
        expect(html).toContain('data-appearance-slot="houseWindows"');
        expect(html).toContain('data-customization-action="preview-default-part"');
        expect(html).not.toContain('<canvas');
    });
    it('makes pending-result retry explicit while keeping the island exit available', () => {
        const html = renderToStaticMarkup(<IslandCustomization island={islandWith({ points: 100 })} preview={{ themeId: 'moon-garden', accentId: null }} selectedId="starry"
            disabled={false} onSelect={noop} onAction={noop} onClose={noop} error="そうさの けっかを たしかめよう。" onRetry={noop} />);
        expect(html).toMatch(/<button class="island-secondary" data-customization-action="retry"/);
        expect(html).toMatch(/<button class="island-primary" disabled="" data-customization-action="purchase"/);
        const close = html.match(/<button[^>]*aria-label="きせかえから もどる"[^>]*>[\s\S]*?<\/button>/)?.[0];
        expect(close).toBeDefined(); expect(close).not.toContain('disabled'); expect(close).toContain('もどる');
    });
    it('waits for an explicit preview choice before exposing a purchase when opening the saved island', () => {
        const html = renderToStaticMarkup(<IslandCustomization island={islandWith({ points: 100 })} preview={{ themeId: 'moon-garden', accentId: null }} selectedId="starry"
            selectionReady={false} disabled={false} onSelect={noop} onAction={noop} onClose={noop} />);
        expect(html).not.toContain('data-customization-action="purchase"');
        expect(html).not.toContain('data-customization-action="equip"');
        expect(html).toContain('しまに あわせてみよう');
    });
});
