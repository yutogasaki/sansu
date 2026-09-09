import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const delivery = vi.hoisted(() => ({ island: false }));
vi.mock('../domain/island/feature', () => ({ islandEnabled: () => delivery.island }));
vi.mock('react-router-dom', () => ({ Navigate: ({ to, replace }: { to: string; replace: boolean }) => <a href={to} data-replace={replace} /> }));
import { LaunchRoute } from './LaunchRoute';

describe('top-page entry', () => {
    afterEach(() => vi.unstubAllEnvs());
    it.each([
        [true, false, '/island'],
        [true, true, '/island'],
        [false, true, '/battle'],
        [false, false, '/battle'],
    ] as const)('opens the ordinary home for Island=%s, BuildPlay=%s', (island, park, destination) => {
        delivery.island = island;
        vi.stubEnv('VITE_BUILD_PLAY_ENABLED', String(park));
        const html = renderToStaticMarkup(<LaunchRoute />);
        expect(html).toContain(`href="${destination}"`);
        expect(html).toContain('data-replace="true"');
        expect(html).not.toMatch(/explore|study|learn=/);
    });
});
