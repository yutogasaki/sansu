import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { newIsland } from '../../../domain/growingIsland/island';
import { LANDMARK_PRICE, SEED_PRICE, type GrowingState } from '../../../domain/growingIsland';
import { GrowingTray } from './GrowingTray';

function state(): GrowingState {
    const value = newIsland('catalog-reader', 0);
    value.tutorial = 'done';
    value.unlocked = [...Object.keys(SEED_PRICE).map(kind => `seed:${kind}`), ...Object.keys(LANDMARK_PRICE).map(kind => `landmark:${kind}`)];
    value.wonderSeeds = 2;
    return value;
}
const render = (value = state(), initialTab: 'seeds' | 'landmarks' | 'stored' = 'seeds') => renderToStaticMarkup(<GrowingTray state={value} initialTab={initialTab} onPick={vi.fn()} onClose={vi.fn()} />);

describe('Growing placement catalog', () => {
    it('keeps every currently purchasable item and separates result types rather than seed mechanics', () => {
        const html = render();
        for (const kind of ['home', 'farm', 'wonder']) expect(html).toContain(`data-growing-seed="${kind}"`);
        for (const kind of ['bench', 'water-bowl', 'sapling', 'water-channel', 'picnic-table', 'swing', 'lantern', 'fence', 'lighthouse', 'bandstand', 'slide', 'trampoline', 'fountain', 'postbox']) expect(html).toContain(`data-growing-landmark="${kind}"`);
        for (const kind of ['wild', 'play', 'market', 'festival']) expect(html).not.toContain(`data-growing-seed="${kind}"`);
        for (const kind of ['planter', 'bakery']) expect(html).not.toContain(`data-growing-landmark="${kind}"`);
        expect(html).toContain('data-growing-flower=');
        const home = html.split('<section class="growing-catalog-group" aria-label="おうち">')[1].split('</section>')[0];
        expect(home).not.toContain('data-growing-seed="farm"');
        const rest = html.split('<section class="growing-catalog-group" aria-label="あそぶ・やすむ">')[1].split('</section>')[0];
        expect(rest).toContain('data-growing-landmark="bench"');
        expect(html).toContain('まなぶと そだつ'); expect(html).toContain('じかんで そだつ'); expect(html).toContain('すぐ つかえる');
        expect(html).not.toContain('>めじるし<');
    });
    it('does not expose locked items or spent wonder seeds', () => {
        const value = state(); value.unlocked = ['seed:home']; value.wonderSeeds = 0;
        const html = render(value);
        expect(html).toContain('data-growing-seed="home"');
        expect(html).not.toContain('data-growing-seed="farm"'); expect(html).not.toContain('data-growing-landmark='); expect(html).not.toContain('data-growing-seed="wonder"');
        expect(html).toContain('>もちもの</button>');
    });
    it('retains the single free first home even when opened through the former landmark entry', () => {
        const value = state(); value.tutorial = 'first-home';
        const html = render(value, 'landmarks');
        expect(html.match(/data-growing-seed=/g)).toHaveLength(1);
        expect(html).toContain('むりょう'); expect(html).not.toContain('data-growing-landmark='); expect(html).not.toContain('>もちもの');
    });
    it('shows owned stored items and keepsakes without a second price or placed duplicates', () => {
        const value = state();
        value.landmarks = [{ id: 'owned-bench', kind: 'bench', growth: 0 }, { id: 'placed-bench', kind: 'bench', growth: 0, cell: { x: 0, z: 0 } }];
        value.plots = [{ id: 'owned-home', kind: 'home', stage: 3, plantedAt: 0, growth: 0, origin: 'seed', paid: 40 }];
        value.keepsakes = [{ id: 'owned-award', unitId: 'math:1' }];
        const html = render(value, 'stored');
        for (const id of ['owned-bench', 'owned-home', 'owned-award']) expect(html).toContain(`data-growing-stored="${id}"`);
        expect(html).not.toContain('data-growing-stored="placed-bench"');
        expect(html).not.toContain('class="growing-price"'); expect(html).not.toContain('まなびの じかんが たまっている');
    });
    it('keeps an empty owned collection reachable with its own explanation', () => {
        const html = render(state(), 'stored');
        expect(html).toContain('しまってある ものは まだ ないよ');
        expect(html).toContain('role="tabpanel"'); expect(html).toContain('aria-selected="true"');
    });
});
