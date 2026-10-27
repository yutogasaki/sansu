import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { newIsland } from '../../../domain/growingIsland/island';
import { chooseTheme, finaleLit, grantRoutes, noteLevels, starSubjects } from '../../../domain/growingIsland/journey';
import type { GrowingState } from '../../../domain/growingIsland';
import type { IslandStart } from '../../../domain/growingIsland/voyages';
import { SeaMap, Stars } from './VoyageChart';

const now = 1_800_000_000_000;
const welcomed = (state: GrowingState) => { state.villagers.push({ ...state.pier.visitor, id: 'v1', arrivedAt: 0 } as never); state.arrivals = []; return state; };
const home = { id: 'main', name: 'はじまりのしま', start: undefined as IslandStart | undefined, land: undefined as never, villagers: 2, active: true };
const map = (state: GrowingState, islands = [home]) => renderToStaticMarkup(<SeaMap state={state} islands={islands} locked={false} onSail={vi.fn()} onChoose={vi.fn()} />);
const label = (html: string, theme: string) => html.match(new RegExp(`data-island="${theme}"[^>]*aria-label="([^"]+)"`))?.[1];
const mode = (html: string, theme: string) => html.match(new RegExp(`data-island="${theme}" data-mode="(\\w+)"`))?.[1];

describe('the sea chart (island-journey.md §3.2)', () => {
    it('keeps every special island in its place and shows only the very next condition in the mist', () => {
        const state = newIsland('child', now), html = map(state);
        expect(html.match(/data-island="(shiokaze|kodama|hikari|watagumo|karakuri|hoshi)"/g)).toHaveLength(6);
        expect(mode(html, 'hoshi')).toBe('fog');
        expect(label(html, 'shiokaze')).toBe('しおかぜの小島・なかまを むかえると');
        expect(html).toContain('style="left:50%;top:10%"');
    });

    it('lights the island a route opened for, then the next one waits for the next ship', () => {
        const state = welcomed(newIsland('child', now));
        grantRoutes(state, { math: 0, vocab: 0, kokugo: 0 }, now);
        let html = map(state);
        expect(mode(html, 'shiokaze')).toBe('open');
        expect(label(html, 'kodama')).toBe('こだまの森・しおかぜの小島の あとで');
        chooseTheme(state, 'shiokaze', 'a');
        html = map(state, [home, { id: 'a', name: 'しおかぜの小島', start: 'shiokaze', land: undefined as never, villagers: 0, active: false } as never]);
        expect(label(html, 'shiokaze')).toBe('しおかぜの小島へ ふねでいく');
        expect(label(html, 'kodama')).toBe('こだまの森・Lv2の ⛵で');
        grantRoutes(state, { math: 0, vocab: 0, kokugo: 2 }, now);
        expect(['kodama', 'hikari', 'watagumo', 'karakuri', 'hoshi'].map(theme => mode(map(state), theme))).toEqual(['open', 'open', 'open', 'open', 'open']);
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
        expect(html).toContain('aria-label="Lv5・こうろ・さんすうと こくご"');
        expect(html.match(/data-lit="true"/g)).toHaveLength(9);
    });

    it('finishes at Lv20 in any subject: recorded once, and the chart joins the islands made', () => {
        const state = welcomed(newIsland('child', now));
        noteLevels(state, { math: 0, vocab: 19, kokugo: 0 });
        expect(finaleLit(state)).toBe(false);
        noteLevels(state, { math: 0, vocab: 20, kokugo: 0 });
        expect(finaleLit(state)).toBe(true);
        expect(state.discoveries).toContain('learn:finale');
        grantRoutes(state, undefined, now); chooseTheme(state, 'shiokaze', 'a');
        grantRoutes(state, undefined, now); chooseTheme(state, 'hoshi', 'b');
        const html = map(state, [home, ...(['shiokaze', 'hoshi'] as const).map((start, i) => ({ id: 'ab'[i], name: start, start, land: undefined as never, villagers: 0, active: false }))]);
        expect(html).toContain('data-finale="true"');
        expect(html.match(/class="voyage-ring"/g)).toHaveLength(1);
    });
});
