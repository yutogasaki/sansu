import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { newIsland } from '../../../domain/growingIsland/island';
import { chooseTheme, finaleLit, grantRoutes, nextIsland, noteLevels, starSubjects } from '../../../domain/growingIsland/journey';
import type { GrowingState } from '../../../domain/growingIsland';
import type { IslandStart } from '../../../domain/growingIsland/voyages';
import { SeaMap, Stars } from './VoyageChart';

const now = 1_800_000_000_000;
const welcomed = (state: GrowingState) => { state.villagers.push({ ...state.pier.visitor, id: 'v1', arrivedAt: 0 } as never); state.arrivals = []; return state; };
const home = { id: 'main', name: 'はじまりのしま', start: undefined as IslandStart | undefined, land: undefined as never, villagers: 2, active: true };
const map = (state: GrowingState, islands = [home]) => renderToStaticMarkup(<SeaMap state={state} islands={islands} locked={false} onSail={vi.fn()} onCross={vi.fn()} />);
const grown = (state: GrowingState) => { for (let i = 0; i < 5; i++) state.villagers.push({ ...state.pier.visitor, id: `f${i}`, arrivedAt: 0 } as never); state.arrivals = [];
    state.land.expanded = 'west'; state.land.extra = ['east', 'south']; for (let i = 0; i < 3; i++) state.landmarks.push({ id: `t${i}`, kind: 'sapling', cell: { x: i, z: 4 }, growth: 99 }); return state; };
const label = (html: string, theme: string) => html.match(new RegExp(`data-island="${theme}"[^>]*aria-label="([^"]+)"`))?.[1];

describe('the sea chart (island-journey.md §3.2, §3.6)', () => {
    it('shows no island before the child reaches it: no names, no mist, no conditions', () => {
        const state = welcomed(newIsland('child', now)), html = map(state);
        expect(html).not.toMatch(/data-island="(shiokaze|kodama|hikari|watagumo|karakuri|hoshi|shoal)"/);
        expect(html).not.toContain('Lv');
    });

    it('draws the growing shoal without saying what it is, and crosses only once it is an island', () => {
        const state = welcomed(newIsland('child', now));
        noteLevels(state, { math: 2, vocab: 0, kokugo: 0 }); grantRoutes(state, undefined, now);
        let html = map(state);
        expect(html).toContain('data-stage="1"');
        expect(label(html, 'shoal')).toBe('うみの いろが ちがう ところ');
        grantRoutes(grown(state), undefined, now);
        html = map(state);
        expect(label(html, 'shoal')).toBe('きりの むこうへ わたる');
        const theme = nextIsland(state)!;
        expect(html).not.toContain(['こだま', 'ひかり', 'わたぐも', 'ぜんまい', '星の島'].find(name => html.includes(name)) ?? '@@');
        chooseTheme(state, theme, 'a');
        html = map(state, [home, { id: 'a', name: 'x', start: theme, land: undefined as never, villagers: 0, active: false }]);
        expect(html).toContain(`data-island="${theme}"`);
        expect(html).not.toContain('data-island="shoal"');
    });
});

describe('stars and the Lv20 finish (island-journey.md §3.3)', () => {
    it('marks each star with every subject that reached it, without opening more routes', () => {
        const state = welcomed(newIsland('child', now));
        noteLevels(state, { math: 9, vocab: 2, kokugo: 5 });
        expect(starSubjects(state, 2)).toEqual(['math', 'vocab', 'kokugo']);
        expect(starSubjects(state, 5)).toEqual(['math', 'kokugo']);
        expect(starSubjects(state, 10)).toEqual([]);
        const html = renderToStaticMarkup(<Stars state={state} />);
        expect(html).toContain('aria-label="Lv5・さんすうと こくご"');
        expect(html).not.toContain('⛵');
        expect(html.match(/data-lit="true"/g)).toHaveLength(9);
    });

    it('finishes at Lv20 in any subject: recorded once, and the chart joins the islands made', () => {
        const state = welcomed(newIsland('child', now));
        noteLevels(state, { math: 0, vocab: 19, kokugo: 0 });
        expect(finaleLit(state)).toBe(false);
        noteLevels(state, { math: 0, vocab: 20, kokugo: 0 });
        expect(finaleLit(state)).toBe(true);
        expect(state.discoveries).toContain('learn:finale');
        state.journey!.chosen = [{ slot: 0, theme: 'shiokaze', islandId: 'a' }, { slot: 1, theme: 'hoshi', islandId: 'b' }];
        const html = map(state, [home, ...(['shiokaze', 'hoshi'] as const).map((start, i) => ({ id: 'ab'[i], name: start, start, land: undefined as never, villagers: 0, active: false }))]);
        expect(html).toContain('data-finale="true"');
        expect(html.match(/class="voyage-ring"/g)).toHaveLength(1);
    });
});
