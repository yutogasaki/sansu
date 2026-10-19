import { describe, expect, it } from 'vitest';
import { connectedWaterChannels, waterChannelConnections, type WaterLayout } from '../islandLife/waterChannels';
import { comfort, foodSupport, housing } from './community';
import { features, syncSoil, waterLayout } from './environment';
import { mixFlowers } from './flowers';
import { receiveGifts } from './gifts';
import { newLegacyIsland as newIsland } from './legacy.fixture';
import { momentCandidates } from './moments';
import { advanceNature } from './nature';
import { placeStatuses, recordPlaceShown, recordPlaceUse, syncPlaceMilestones } from './placeGoals';
import { derivePlaces } from './places';
import { key, landCells } from './space';
import { openTown, welcome } from './town';
import type { GrowingState, NatureEvent } from './types';
import { compileWorldDefinition } from './worldDefinition';
import type { WorldDefinition } from './worldTypes';

const T0 = Date.UTC(2026, 9, 11), HOUR = 3_600_000;

/** The same dry terrain can have a cut walking route and independent water/join grants. */
function world({ cut = false, joined = true, watered = true } = {}) {
    const sites = [];
    for (let z = -3; z <= 3; z += .25) for (let x = 0; x <= 5; x += .25)
        sites.push({ id: `${x}:${z}`, cell: { x, z }, floorId: 'ground',
            placement: Number.isInteger(x) && Number.isInteger(z) && !(x === 5 && z === 3) });
    const ids = new Set(sites.map(site => site.id));
    const definition: WorldDefinition = { version: 1, id: `growth-${cut}-${joined}-${watered}`, districts: [{
        id: 'shore', templateId: 'growth-test', logicalOrigin: { x: 0, z: 0 }, worldOrigin: { x: 0, y: 0, z: 0 }, turn: 0,
        sites, ports: [], floors: [{ id: 'ground', kind: 'ground', color: '#a4cb87', indices: [0, 1, 2, 2, 1, 3],
            vertices: [[-.5, -3.5], [-.5, 3.5], [5.5, -3.5], [5.5, 3.5]].map(([x, z]) => ({ cell: { x, z }, point: { x, y: 0, z } })) }],
    }], edges: [] };
    for (const site of sites) {
        for (const [dx, dz] of [[.25, 0], [0, .25]]) {
            const next = `${site.cell.x + dx}:${site.cell.z + dz}`;
            if (ids.has(next) && !(cut && site.cell.x === 3.5 && dx)) definition.edges.push({
                from: { districtId: 'shore', siteId: site.id }, to: { districtId: 'shore', siteId: next }, allows: ['walk'],
            });
        }
        if (!site.placement) continue;
        for (const [dx, dz] of [[1, 0], [0, 1]]) {
            const next = sites.find(other => other.placement && other.cell.x === site.cell.x + dx && other.cell.z === site.cell.z + dz);
            const allows = [...(joined ? ['join' as const] : []), ...(watered ? ['water' as const] : [])];
            if (next && allows.length) definition.edges.push({
                from: { districtId: 'shore', siteId: site.id }, to: { districtId: 'shore', siteId: next.id }, allows,
            });
        }
    }
    return compileWorldDefinition(definition);
}

function island(): GrowingState {
    const state = newIsland('authored-growth', T0);
    state.landmarks = []; state.plots = []; state.soil = {}; state.tutorial = 'done'; state.pier.dockAt = 0;
    return state;
}

describe('growth on the same authored world as placement and walking', () => {
    it('leaves banked time and residents intact while a real home route is cut, then builds after reconnection', () => {
        const state = island();
        state.plots.push({ id: 'home', kind: 'home', cell: { x: 4, z: 2 }, stage: 0, growth: 0, plantedAt: 0, paid: 40, origin: 'seed' });
        state.town.bank = 24;
        expect(openTown(state, world({ cut: true }))).toContainEqual({ type: 'blocked', reason: 'unreachable', plotId: 'home' });
        expect(state.town).toMatchObject({ clock: 0, bank: 24 });
        expect(state.villagers).toEqual([]);
        expect(housing(state, undefined, world({ cut: true }))).toMatchObject({ capacity: 0, vacancy: 0 });
        const events = openTown(state, world());
        expect(events).toContainEqual({ type: 'built', plotId: 'home' });
        expect(state.plots[0].stage).toBe(1);
        expect(state.villagers[0]?.home).toBe('home');
        expect(state.town.bank).toBeLessThan(24);
    });

    it('requires integer water grants even when a quarter-grid walking path exists', () => {
        const state = island();
        state.landmarks.push({ id: 'bowl', kind: 'water-bowl', cell: { x: 0, z: -2 }, growth: 0 },
            { id: 'channel', kind: 'water-channel', cell: { x: 1, z: -2 }, growth: 0 });
        const dry = waterLayout(state, world({ watered: false })), wet = waterLayout(state, world());
        expect(connectedWaterChannels(dry)).toEqual(new Set());
        expect(waterChannelConnections(dry, { x: 1, z: -2 })).toBe(0);
        expect(connectedWaterChannels(wet)).toEqual(new Set(['1,-2']));
        expect(waterChannelConnections(wet, { x: 1, z: -2 })).toBe(8);
        expect(features(state, world({ watered: false })).filter(feature => key(feature.cell) === '1,-2')).toEqual([]);
    });

    it('keeps the eight-piece water limit and refuses fractional walking points as trench pieces', () => {
        const layout: WaterLayout = { items: [{ kind: 'water-bowl', cell: { x: 0, z: 0 }, growth: 0 },
            ...Array.from({ length: 9 }, (_, i) => ({ kind: 'water-channel' as const, cell: { x: i + 1, z: 0 }, growth: 0 }))],
        neighbors: cell => [{ x: cell.x - 1, z: 0 }, { x: cell.x + 1, z: 0 }, { x: cell.x + .25, z: 0 }] };
        expect([...connectedWaterChannels(layout)]).toEqual(Array.from({ length: 8 }, (_, i) => `${i + 1},0`));
        layout.items = [{ kind: 'water-bowl', cell: { x: 0, z: 0 }, growth: 0 }, { kind: 'water-channel', cell: { x: .25, z: 0 }, growth: 0 }];
        expect(connectedWaterChannels(layout)).toEqual(new Set());
    });

    it('grows owned negative-coordinate plants while preserving stored and unsupported objects without inventing soil', () => {
        const state = island(), terrain = world();
        state.landmarks.push({ id: 'owned', kind: 'sapling', cell: { x: 0, z: -2 }, growth: 0 },
            { id: 'walk-only', kind: 'sapling', cell: { x: 1.25, z: -2 }, growth: 0 },
            { id: 'stored', kind: 'sapling', growth: 0 });
        const unsupported = structuredClone(state.landmarks.slice(1));
        advanceNature(state, T0 + 18 * HOUR, terrain);
        expect(state.landmarks[0]).toMatchObject({ id: 'owned', growth: 18, maturedAt: 18 });
        expect(state.landmarks.slice(1)).toEqual(unsupported);
        expect(new Set(Object.keys(state.soil))).toEqual(new Set(landCells(state, terrain).map(key)));
        expect(Object.keys(state.soil)).not.toContain('5,3');
        const gift = receiveGifts(state, [{ id: 'gift', to: 'kid', from: 'friend', fromName: 'ともだち', at: T0 }], terrain);
        const flower = state.landmarks.find(item => item.id === (gift[0] as { landmarkId: string }).landmarkId)!;
        expect(terrain.owns(flower.cell!)).toBe(true);
    });

    it('mixes flowers only over joining land, never by borrowing the walking graph', () => {
        const state = island();
        state.landmarks.push({ id: 'red', kind: 'flower', cell: { x: 0, z: -2 }, color: 'red', growth: 6 },
            { id: 'yellow', kind: 'flower', cell: { x: 0, z: -1 }, color: 'yellow', growth: 6 });
        const separated = structuredClone(state), disconnected = world({ joined: false });
        for (let round = 1; round <= 32; round++) mixFlowers(separated, round, [], disconnected);
        expect(separated.landmarks).toEqual(state.landmarks);
        const events: NatureEvent[] = [], terrain = world();
        for (let round = 1; round <= 32 && !events.length; round++) mixFlowers(state, round, events, terrain);
        expect(events).toContainEqual(expect.objectContaining({ type: 'mixed', color: 'orange' }));
        expect(state.landmarks.every(item => terrain.owns(item.cell!))).toBe(true);
    });

    it('spreads a wet wild garden into authored planting land without using walking-only joins', () => {
        const state = island();
        state.plots.push({ id: 'wild', kind: 'wild', cell: { x: 0, z: -2 }, stage: 1, growth: 6, plantedAt: 0, origin: 'seed', paid: 10 });
        state.landmarks.push({ id: 'bowl-a', kind: 'water-bowl', cell: { x: 0, z: -1 }, growth: 0 },
            { id: 'bowl-b', kind: 'water-bowl', cell: { x: 2, z: -2 }, growth: 0 });
        const separated = structuredClone(state), terrain = world();
        advanceNature(separated, T0 + 7 * 24 * HOUR, world({ joined: false }));
        expect(separated.plots).toHaveLength(1);
        advanceNature(state, T0 + 7 * 24 * HOUR, terrain);
        expect(state.plots.length).toBeGreaterThan(1);
        expect(state.plots.every(plot => terrain.owns(plot.cell!))).toBe(true);
    });

    it('grants no housing, food, comfort or world events to objects placed at walking-only sites', () => {
        const state = island(), terrain = world(), cell = { x: 1.25, z: -2 };
        state.plots.push({ id: 'unsupported-home', kind: 'home', cell, stage: 4, growth: 0, plantedAt: 0, origin: 'seed', paid: 40 },
            { id: 'unsupported-farm', kind: 'farm', cell, stage: 1, growth: 0, plantedAt: 0, origin: 'seed', paid: 40 });
        const visitor = state.pier.visitor;
        state.villagers.push({ ...visitor, id: 'friend', home: 'unsupported-home', arrivedAt: 0 });
        state.landmarks.push({ id: 'unsupported-light', kind: 'lighthouse', cell, growth: 0 });
        expect(housing(state, undefined, terrain)).toEqual({ capacity: 0, housed: 1, vacancy: 0 });
        expect(foodSupport(state, undefined, terrain)).toBe(2);
        expect(comfort(state, state.villagers[0], undefined, undefined, terrain)).toBe(0);
        expect(features(state, terrain)).toEqual([]);
        expect(momentCandidates(state, terrain)).not.toContainEqual({ moment: 'whale' });
        const before = structuredClone(state);
        expect(() => welcome(state, 6, state.plots[0], terrain)).toThrow();
        expect(state).toEqual(before);
        expect(state.villagers[0].id).toBe('friend');
    });

    it('records only the authored current grown place and retains its exact milestone when split', () => {
        const state = island(), terrain = world();
        state.landmarks.push({ id: 'tree-a', kind: 'sapling', cell: { x: 0, z: -2 }, growth: 18, maturedAt: 0 },
            { id: 'tree-b', kind: 'sapling', cell: { x: 1, z: -2 }, growth: 18, maturedAt: 0 },
            { id: 'bench', kind: 'bench', cell: { x: 1, z: -1 }, growth: 0 });
        syncSoil(state, terrain);
        const place = derivePlaces(state, terrain).find(place => place.ruleId === 'P01' && place.stage === 'grown')!;
        expect(place).toBeDefined();
        syncPlaceMilestones(state, T0, terrain);
        const achievement = structuredClone(state.placeProgress!.milestones.P01);
        recordPlaceShown(state, { ruleId: 'P01', revision: place.revision }, terrain);
        recordPlaceUse(state, { ruleId: 'P01', placeId: place.id, revision: place.revision,
            actorId: 'pokomoko', targetId: place.useTargets[0].id }, T0 + 1, terrain);
        expect(placeStatuses(state, terrain).find(goal => goal.id === 'P01')?.stage).toBe('lived');
        state.landmarks.find(item => item.id === 'bench')!.cell = undefined;
        syncPlaceMilestones(state, T0 + 2, terrain);
        expect(state.placeProgress!.milestones.P01).toEqual(achievement);
        expect(placeStatuses(state, terrain).find(goal => goal.id === 'P01')).toMatchObject({ achieved: true, stage: 'seeded' });
    });
});
