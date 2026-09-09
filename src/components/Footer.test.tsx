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
        { blocked: false, learningBlocked: true, disabled: [false, true, false] },
        { blocked: true, learningBlocked: false, disabled: [true, true, true] },
        { blocked: false, learningBlocked: false, disabled: [false, false, false] },
    ])('keeps the three destinations usable according to blocked=$blocked and learningBlocked=$learningBlocked', ({ blocked, learningBlocked, disabled }) => {
        vi.stubEnv('VITE_ISLAND_ENABLED', 'true');
        const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/island']}>
            <IslandFooter blocked={blocked} learningBlocked={learningBlocked} />
        </MemoryRouter>);
        const buttons = html.match(/<button\b[^>]*>/g) ?? [];
        expect(buttons.map(button => button.match(/aria-label="([^"]+)"/)?.[1])).toEqual(['しま', 'まなぶ', 'きろく']);
        expect(buttons.map(button => button.includes('disabled=""'))).toEqual(disabled);
        expect(buttons[0]).toContain('aria-current="page"');
    });
});
