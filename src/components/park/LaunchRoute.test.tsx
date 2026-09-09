import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const delivery = vi.hoisted(() => ({ island: false, park: false }));
vi.mock('../../domain/island/feature', () => ({ islandEnabled: () => delivery.island }));
vi.mock('../../domain/park/feature', () => ({ get BUILD_PLAY_ENABLED() { return delivery.park; } }));
vi.mock('react-router-dom', () => ({ Navigate: ({ to, replace }: { to: string; replace: boolean }) => <a href={to} data-replace={replace} /> }));
import { LaunchRoute } from './LaunchRoute';

describe('top-page entry', () => {
    it.each([
        [true, false, '/island'],
        [true, true, '/island'],
        [false, true, '/park'],
        [false, false, '/battle'],
    ] as const)('opens the ordinary home for Island=%s, BuildPlay=%s', (island, park, destination) => {
        Object.assign(delivery, { island, park });
        const html = renderToStaticMarkup(<LaunchRoute />);
        expect(html).toContain(`href="${destination}"`);
        expect(html).toContain('data-replace="true"');
        expect(html).not.toMatch(/explore|study|learn=/);
    });
});
