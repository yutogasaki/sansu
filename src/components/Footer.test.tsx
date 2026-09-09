import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Footer } from './Footer';
import { IslandNavigationContext, useIslandNavigationState } from './island/useIslandNavigation';

function IslandFooter({ blocked, learningBlocked }: { blocked: boolean; learningBlocked: boolean }) {
    const navigation = useIslandNavigationState(true);
    return <IslandNavigationContext.Provider value={{ ...navigation, blocked, learningBlocked }}>
        <Footer />
    </IslandNavigationContext.Provider>;
}

describe('Island footer persistence gates', () => {
    afterEach(() => vi.unstubAllEnvs());

    it.each([
        { blocked: false, learningBlocked: true, disabled: [false, false, true, false, false] },
        { blocked: true, learningBlocked: false, disabled: [true, true, true, true, true] },
        { blocked: false, learningBlocked: false, disabled: [false, false, false, false, false] },
    ])('keeps the five destinations usable according to blocked=$blocked and learningBlocked=$learningBlocked', ({ blocked, learningBlocked, disabled }) => {
        vi.stubEnv('VITE_ISLAND_ENABLED', 'true');
        const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/island']}>
            <IslandFooter blocked={blocked} learningBlocked={learningBlocked} />
        </MemoryRouter>);
        const buttons = html.match(/<button\b[^>]*>/g) ?? [];
        expect(buttons.map(button => button.match(/aria-label="([^"]+)"/)?.[1])).toEqual(['しま', 'いえ', 'まなぶ', 'きろく', '設定']);
        expect(buttons.map(button => button.includes('disabled=""'))).toEqual(disabled);
        expect(buttons[0]).toContain('aria-current="page"');
    });
    it.each([
        ['/island?view=keepsakes', 'いえ'],
        ['/settings', '設定'],
        ['/settings?section=learning', '設定'],
        ['/settings/curriculum', '設定'],
        ['/parents', '設定'],
        ['/stats', 'きろく'],
    ])('marks the destination for direct entry %s', (entry, label) => {
        vi.stubEnv('VITE_ISLAND_ENABLED', 'true');
        const html = renderToStaticMarkup(<MemoryRouter initialEntries={[entry]}>
            <IslandFooter blocked={false} learningBlocked={false} />
        </MemoryRouter>);
        const current = (html.match(/<button\b[^>]*>/g) ?? []).filter(button => button.includes('aria-current="page"'));
        expect(current).toHaveLength(1);
        expect(current[0]).toContain(`aria-label="${label}"`);
    });

});
