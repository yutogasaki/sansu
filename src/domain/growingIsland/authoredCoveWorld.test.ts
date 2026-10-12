import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { compileWorldDefinition, type IslandWorld } from './worldDefinition';
import { withNative05WaterCarvingScope } from './authoredWaterCarving';
import { authoredWaterFrame } from './authoredWaterFrame';
import { derivePlaces } from './places';
import type { GrowingState } from './types';
import { AUTHORED_COVE_SOURCE_PROFILE as profile, authoredCoveGroundRevision, composeAuthoredCoveWorld,
    deriveAuthoredCovePlan, reconcileAuthoredCovePlan } from './authoredCoveWorld';

let base: IslandWorld, water: IslandWorld, state: GrowingState;
beforeAll(() => {
    base = withNative05WaterCarvingScope(compileWorldDefinition(JSON.parse(gunzipSync(readFileSync('prototypes/place-qa/native05-world.json.gz')).toString())));
    state = JSON.parse(readFileSync('prototypes/place-qa/authored-flower-reference-mature.json', 'utf8')).state;
    water = authoredWaterFrame(state, base).world;
}, 30_000);

const planFor = (current: GrowingState, world = base) => deriveAuthoredCovePlan(current, world, derivePlaces(current, world));

describe('authored cove source applicability', () => {
    it('keeps the audited physical court when only its source shading changes', () => {
        const definition = structuredClone(base.definition);
        definition.districts = definition.districts.map(district => ({ ...district, floors: district.floors.map(floor => ({ ...floor,
            vertices: floor.vertices.map(vertex => ({ ...vertex, normal: { x: .1, y: .9, z: .2 } })),
            material: { roughness: .78, metalness: 0, doubleSided: true } })) }));
        const shaded = compileWorldDefinition(definition);
        expect(authoredCoveGroundRevision(shaded, profile.localGround)).toBe(profile.localGround.revision);
        expect(planFor(state, shaded).assemblies).toEqual(planFor(state).assemblies);
        expect(shaded.sites).toEqual(base.sites);
        definition.districts[0].worldOrigin.y += .001;
        expect(planFor(state, compileWorldDefinition(definition)).assemblies).toEqual([]);
    });

    it('uses the real 32-owner P04 roles and play target on both original and water-composed terrain', () => {
        expect(state.plots.length + state.landmarks.length).toBe(32);
        for (const world of [base, water]) {
            expect(authoredCoveGroundRevision(world, profile.localGround)).toBe(profile.localGround.revision);
            const places = derivePlaces(state, world), plan = deriveAuthoredCovePlan(state, world, places);
            expect(plan.assemblies).toHaveLength(1);
            expect(plan.assemblies[0]).toMatchObject({ placeId: 'P04:p6', playId: 'p9', ownerIds: ['l32', 'p6', 'p7', 'p9'],
                sourceId: 'native05-authored-cove-corner-v3', sourceSha256: 'f08ada4907c76a617e2c22090049b9b2880dde2d75fa11ad61f6e76c7eec7146',
                transform: { pivot: [13.9, .89, 1.2], position: { x: 8, y: .0475, z: .5 }, scale: .45, yaw: 0 } });
            const p04 = places.find(place => place.ruleId === 'P04')!;
            expect(plan.assemblies[0].playId).not.toBe(p04.anchorId);
            const renamed = structuredClone(state), names = new Map(['p6', 'p7', 'p9', 'l32'].map(id => [id, `renamed-${id}`]));
            for (const owner of [...renamed.plots, ...renamed.landmarks]) owner.id = names.get(owner.id) ?? owner.id;
            const other = planFor(renamed, world).assemblies[0];
            expect(other.playId).toBe('renamed-p9'); expect(other.ownerIds).toEqual(['renamed-l32', 'renamed-p6', 'renamed-p7', 'renamed-p9']);
            expect(other.transform).toEqual(plan.assemblies[0].transform);
        }
    });

    it('restricts only this source profile when mature P04 roles have an unaudited physical model or position', () => {
        const initial = planFor(state);
        const changes: ((next: GrowingState) => void)[] = [
            next => { next.plots.find(p => p.id === 'p6')!.stage = 3; },
            next => { next.plots.find(p => p.id === 'p7')!.style = 'plain'; },
            next => { next.plots.find(p => p.id === 'p9')!.style = 'water'; },
            next => { next.plots.find(p => p.id === 'p9')!.stage = 0; },
            next => { next.plots.find(p => p.id === 'p6')!.cell = { x: 7, z: 0 }; },
            next => { delete next.plots.find(p => p.id === 'p7')!.cell; },
            next => { delete next.plots.find(p => p.id === 'p9')!.cell; },
            next => { delete next.landmarks.find(p => p.id === 'l32')!.cell; },
            next => { next.landmarks.find(p => p.id === 'l32')!.cell = { x: 8, z: -3 }; },
            next => { next.unopened.push('p6'); },
        ];
        for (const change of changes) {
            const next = structuredClone(state); change(next);
            const absent = planFor(next);
            expect(absent.assemblies).toEqual([]); expect(absent.patch).toBeUndefined();
            expect(composeAuthoredCoveWorld(base, absent)).toBe(base);
        }
        const stage3 = structuredClone(state); stage3.plots.find(p => p.id === 'p6')!.stage = 3;
        expect(derivePlaces(stage3, base).find(place => place.ruleId === 'P04')?.stage).toBe('grown');
        const recolored = structuredClone(state); recolored.plots.find(p => p.id === 'p6')!.roof = 2;
        expect(planFor(recolored).assemblies).toHaveLength(1);
        expect(planFor(state)).toEqual(initial);
    });

    it('rejects new local owners and changed local ground while allowing a remote edit', () => {
        for (const kind of ['landmark', 'keepsake', 'plot']) {
            const next = structuredClone(state), cell = { x: 8, z: 1 };
            if (kind === 'landmark') next.landmarks.push({ id: 'obstacle', kind: 'sapling', growth: 18, cell });
            if (kind === 'keepsake') next.keepsakes.push({ id: 'obstacle', unitId: 'test', cell });
            if (kind === 'plot') next.plots.push({ ...next.plots[0], id: 'obstacle', cell });
            expect(planFor(next).assemblies).toEqual([]);
        }
        const remote = structuredClone(state); remote.landmarks.push({ id: 'remote', kind: 'flower', growth: 0, cell: { x: 12, z: -9 } });
        expect(planFor(remote).assemblies).toHaveLength(1);
        const definition = structuredClone(base.definition);
        definition.districts[0].worldOrigin.y += .05;
        const changed = compileWorldDefinition(definition);
        expect(changed.definition.source).toEqual(base.definition.source);
        expect(planFor(state, changed).assemblies).toEqual([]);
        const wrongSource = compileWorldDefinition({ ...base.definition, source: { artifact: 'different.glb', sha256: '0'.repeat(64) } });
        expect(planFor(state, wrongSource).assemblies).toEqual([]);
    });

    it('rejects unaudited ground and owners beyond the former rectangle at the bowed shore', () => {
        const definition = structuredClone(base.definition);
        definition.districts.push({ id: 'unreviewed-shore', templateId: 'test',
            logicalOrigin: { x: 0, z: 0 }, worldOrigin: { x: 0, y: 0, z: 0 }, turn: 0,
            floors: [{ id: 'new-floor', kind: 'ground', color: '#ffffff',
                vertices: [{ x: 8, z: 2.4 }, { x: 8.1, z: 2.4 }, { x: 8, z: 2.5 }]
                    .map(cell => ({ cell, point: { ...cell, y: .02 } })), indices: [0, 2, 1] }],
            sites: [], ports: [] });
        const changed = compileWorldDefinition(definition);
        const oldWindow = { min: { x: 6, z: -2.6 }, max: { x: 10.5, z: 2.25 } };
        expect(authoredCoveGroundRevision(changed, oldWindow)).toBe(authoredCoveGroundRevision(base, oldWindow));
        expect(authoredCoveGroundRevision(changed, profile.localGround)).not.toBe(profile.localGround.revision);
        expect(planFor(state, changed).assemblies).toEqual([]);
        const occupied = structuredClone(state);
        occupied.landmarks.push({ id: 'unaudited-shore-owner', kind: 'flower', growth: 18, cell: { x: 11, z: 0 } });
        expect(planFor(occupied).assemblies).toEqual([]);
        expect(planFor(state).assemblies).toHaveLength(1);
    });
});

describe('authored cove additive world patch', () => {
    it('preserves every upstream floor, anchor, owner grant and edge, adds 13 walk-only refs, and keeps final P04 identity', () => {
        const beforeState = structuredClone(state);
        for (const upstream of [base, water]) {
            const originalDefinition = JSON.stringify(upstream.definition), input = derivePlaces(state, upstream);
            const initial = deriveAuthoredCovePlan(state, upstream, input), world = composeAuthoredCoveWorld(upstream, initial);
            const final = derivePlaces(state, world), plan = reconcileAuthoredCovePlan(initial, input, final);
            expect(plan.assemblies).toHaveLength(1);
            expect(plan.assemblies[0].placeRevision).toBe(final.find(place => place.id === initial.assemblies[0].placeId)!.revision);
            expect(world.definition.source).toEqual(upstream.definition.source);
            expect(world.floors.slice(0, upstream.floors.length)).toEqual(upstream.floors);
            expect(world.anchorFloors).toEqual(upstream.anchorFloors);
            expect(world.surfaces.slice(0, upstream.surfaces.length)).toEqual(upstream.surfaces);
            expect(world.sites.filter(site => site.placement)).toEqual(upstream.sites.filter(site => site.placement));
            expect(world.sites.filter(site => site.placement)).toHaveLength(73);
            expect(world.sites).toHaveLength(upstream.sites.length + 13);
            for (const original of upstream.sites) {
                const site = world.sites.find(site => site.ref.districtId === original.ref.districtId && site.ref.siteId === original.ref.siteId)!;
                expect([site.cell, site.point, site.floorId, site.placement]).toEqual([original.cell, original.point, original.floorId, original.placement]);
            }
            expect(world.definition.edges.slice(0, upstream.definition.edges.length)).toEqual(upstream.definition.edges);
            expect(world.definition.edges).toHaveLength(upstream.definition.edges.length + 15);
            for (const edge of world.definition.edges.slice(upstream.definition.edges.length)) {
                expect(edge.allows).toEqual(['walk']);
                const from = world.sites.find(site => JSON.stringify(site.ref) === JSON.stringify(edge.from))!;
                const to = world.sites.find(site => JSON.stringify(site.ref) === JSON.stringify(edge.to))!;
                expect(world.isWalkEdgeSupported(from.cell, to.cell)).toBe(true);
            }
            expect(world.owns({ x: 7, z: 1.7 })).toBe(false);
            expect(world.floorAt({ x: 7, z: 1.7 })).toBeDefined();
            expect(upstream.floorAt({ x: 7, z: 1.7 })).toBeUndefined();
            expect(JSON.stringify(upstream.definition)).toBe(originalDefinition);
        }
        expect(state).toEqual(beforeState);
    }, 30_000);

    it('rejects identity bootstrap and cannot compose from its own already-composed floor', () => {
        const input = derivePlaces(state, base), plan = deriveAuthoredCovePlan(state, base, input);
        const final = structuredClone(input), p04 = final.find(place => place.ruleId === 'P04')!;
        p04.mainIds.push('unproved-house');
        expect(reconcileAuthoredCovePlan(plan, input, final).assemblies).toEqual([]);
        const world = composeAuthoredCoveWorld(base, plan);
        expect(() => deriveAuthoredCovePlan(state, world, derivePlaces(state, world))).toThrow('without its apron');
        expect(() => composeAuthoredCoveWorld(world, plan)).toThrow('upstream geometry changed');
    });
});
