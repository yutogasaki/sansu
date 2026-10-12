import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { compileWorldDefinition, type IslandWorld } from './worldDefinition';
import { withNative05WaterCarvingScope } from './authoredWaterCarving';
import { authoredWaterFrame } from './authoredWaterFrame';
import { composeAuthoredWaterWorld } from './authoredWaterWorld';
import { authoredShoulderDrawingRevision, authoredShoulderProfileDrawingRevision, authoredShoulderGroundRevision, authoredShoulderProfilePhysicalRevision,
    composeAuthoredShoulderWorld, type AuthoredShoulderProfile } from './authoredShoulderWorld';
import { composeAuthoredCoveWorld, deriveAuthoredCovePlan } from './authoredCoveWorld';
import { derivePlaces } from './places';
import { applyIntent, canPlace } from './commands';
import { advanceNature } from './nature';
import { hasAuthoredPlacementSupport } from './authoredPlacementSupport';
import type { GrowingState } from './types';

let base: IslandWorld, water: IslandWorld, world: IslandWorld, state: GrowingState, profile: AuthoredShoulderProfile;
beforeAll(() => {
    profile = JSON.parse(gunzipSync(readFileSync('prototypes/place-qa/authored-shoulder-profile.json.gz')).toString());
    base = withNative05WaterCarvingScope(compileWorldDefinition(JSON.parse(gunzipSync(readFileSync('prototypes/place-qa/native05-world.json.gz')).toString())));
    state = JSON.parse(readFileSync('prototypes/place-qa/authored-flower-reference-mature.json', 'utf8')).state;
    water = authoredWaterFrame(state, base).world;
    world = composeAuthoredShoulderWorld(water, profile);
}, 30_000);
const physical = (world: IslandWorld) => world.floors.map(floor => [floor.id, floor.kind, floor.vertices.map(v => [v.cell, v.point]), floor.indices]);
const places = (state: GrowingState, world: IslandWorld) => derivePlaces(state, world).filter(place => ['P02', 'P03', 'P04', 'P05'].includes(place.ruleId))
    .map(place => [place.id, place.stage, place.mainIds, place.memberIds, place.waterRefs]);

describe('explicit authored shoulder diagnostic terrain', () => {
    it('composes exact two-material source top and actual site floor references without mutating water input', () => {
        const before = JSON.stringify(water.definition), sourceState = JSON.stringify(state);
        const again = composeAuthoredShoulderWorld(water, profile), district = again.definition.districts.at(-1)!;
        expect(district.floors).toEqual(profile.district.floors);
        expect(district.floors.map(floor => floor.indices.length / 3)).toEqual([1722, 4893]);
        expect(profile.triangleLineage).toHaveLength(6615);
        expect(district.sites).toHaveLength(19); expect(district.sites.filter(site => !site.placement)).toHaveLength(17);
        expect(profile.edges.filter(edge => edge.allows.includes('walk'))).toHaveLength(35);
        expect(district.floors.every(floor => floor.vertices.every(vertex => !!vertex.normal))).toBe(true);
        for (const site of district.sites) expect(again.floorAt(site.cell, JSON.stringify([district.id, site.floorId]))).toBeDefined();
        expect(JSON.stringify(water.definition)).toBe(before); expect(JSON.stringify(state)).toBe(sourceState);
    });

    it('keeps all 73 acquired anchors/full-footprint samples, adds two supported rights, and retains ordinary place identities', () => {
        expect(water.sites.filter(site => site.placement)).toHaveLength(73);
        expect(world.sites.filter(site => site.placement)).toHaveLength(75);
        expect(world.anchorFloors).toEqual(water.anchorFloors);
        for (const site of water.sites.filter(site => site.placement)) {
            expect(world.anchorAt(site.cell)).toEqual(site.point);
            for (const dx of [-.46, 0, .46]) for (const dz of [-.46, 0, .46]) {
                const cell = { x: site.cell.x + dx, z: site.cell.z + dz };
                expect(world.floorAt(cell)?.point).toEqual(water.floorAt(cell)?.point);
            }
        }
        expect(world.floorAt({ x: 7, z: -6 })?.point.y).toBe(1.585);
        expect(world.floorAt({ x: 8, z: -6 })?.point.y).toBe(1.615);
        expect(hasAuthoredPlacementSupport(world, { x: 7, z: -6 })).toBe(true);
        expect(hasAuthoredPlacementSupport(world, { x: 8, z: -6 })).toBe(true);
        expect(places(state, world)).toEqual(places(state, water));
        const cove = deriveAuthoredCovePlan(state, world, derivePlaces(state, world));
        expect(cove.assemblies).toHaveLength(1);
        expect(composeAuthoredCoveWorld(world, cove).sites.filter(site => site.placement)).toHaveLength(75);
    }, 30_000);

    it('uses normal purchases/maturation for the same three trees without coupling land to their records', () => {
        let next = structuredClone(state);
        for (const [x, z] of [[6, -7], [7, -6], [8, -6]]) {
            expect(canPlace(next, { x, z }, undefined, world)).toBe(true);
            next = applyIntent(next, { id: `test-${x}-${z}`, command: { type: 'place', kind: 'sapling', cell: { x, z } } }, undefined, world).state;
        }
        advanceNature(next, next.nature.realAt + 18 * 3600000, world);
        expect(next.drops).toBe(state.drops - 60); expect(next.plots.length + next.landmarks.length).toBe(35);
        expect([...state.plots, ...state.landmarks].every(old => [...next.plots, ...next.landmarks].some(owner => JSON.stringify(owner) === JSON.stringify(old)))).toBe(true);
        expect(places(next, world)).toEqual(places(state, world));
        const stored = structuredClone(next); stored.landmarks = stored.landmarks.filter(owner => !['l33', 'l34', 'l35'].includes(owner.id));
        expect(composeAuthoredShoulderWorld(authoredWaterFrame(stored, base).world, profile).owns({ x: 7, z: -6 })).toBe(true);
        const moved = structuredClone(next); moved.landmarks.find(owner => owner.id === 'l34')!.cell = { x: 13, z: -9 };
        expect(composeAuthoredShoulderWorld(authoredWaterFrame(moved, base).world, profile).owns({ x: 8, z: -6 })).toBe(true);
    }, 30_000);

    it('accepts source normal/material changes, preserves clip interpolation, and changes drawing identity only', () => {
        const definition = structuredClone(water.definition);
        definition.districts = definition.districts.map(district => ({ ...district, floors: district.floors.map(floor => ({ ...floor,
            vertices: floor.vertices.map(vertex => ({ ...vertex, normal: { x: vertex.point.x * .01, y: .9, z: vertex.point.z * .01 } })),
            material: { roughness: .78, metalness: 0, doubleSided: true } })) }));
        const shaded = compileWorldDefinition(definition);
        expect(authoredShoulderGroundRevision(shaded, profile.localGround)).toBe(profile.localGround.revision);
        const composed = composeAuthoredShoulderWorld(shaded, profile);
        expect(physical(composed)).toEqual(physical(world));
        expect(composed.definition.revision).not.toBe(world.definition.revision);
        expect(authoredShoulderDrawingRevision(composed)).not.toBe(authoredShoulderDrawingRevision(world));
        const source = composed.definition.districts.find(district => district.id === profile.sourceDistrictId)!;
        for (const floor of source.floors.filter(floor => profile.clipFloorIds.includes(floor.id))) for (const vertex of floor.vertices) {
            expect(vertex.normal?.x).toBeCloseTo(vertex.point.x * .01, 12);
            expect(vertex.normal?.y).toBeCloseTo(.9, 12);
            expect(vertex.normal?.z).toBeCloseTo(vertex.point.z * .01, 12);
        }
        const recolored = structuredClone(profile);
        recolored.district.floors[0].vertices[0].normal = { x: .1, y: .99, z: 0 };
        expect(authoredShoulderProfilePhysicalRevision(recolored)).toBe(profile.physicalRevision);
        expect(authoredShoulderProfileDrawingRevision(recolored)).not.toBe(authoredShoulderProfileDrawingRevision(profile));
    }, 30_000);

    it('fails closed for double composition, wrong source/local geometry, or changed physical profile', () => {
        expect(() => composeAuthoredShoulderWorld(world, profile)).toThrow('without shoulder or cove');
        const cove = composeAuthoredCoveWorld(water, deriveAuthoredCovePlan(state, water, derivePlaces(state, water)));
        expect(() => composeAuthoredShoulderWorld(cove, profile)).toThrow('without shoulder or cove');
        expect(() => composeAuthoredShoulderWorld(compileWorldDefinition({ ...water.definition, source: { artifact: 'wrong', sha256: '0'.repeat(64) } }), profile)).toThrow('physical locality');
        const changed = structuredClone(water.definition);
        changed.districts[0].worldOrigin.y += .01;
        expect(() => composeAuthoredShoulderWorld(compileWorldDefinition(changed), profile)).toThrow('physical locality');
        const invalid = structuredClone(profile); invalid.district.floors[0].vertices[0].point.y += .01;
        expect(() => composeAuthoredShoulderWorld(water, invalid)).toThrow('physical profile');
    });

    it('accepts the delivered source NORMAL/PBR world with identical support and a distinct drawing revision', () => {
        const source = withNative05WaterCarvingScope(compileWorldDefinition(JSON.parse(gunzipSync(
            readFileSync('prototypes/place-qa/native05-world-source-shading.json.gz')).toString())));
        expect(source.floors.some(floor => !!floor.material && floor.vertices.some(vertex => !!vertex.normal))).toBe(true);
        expect(authoredShoulderGroundRevision(source, profile.localGround)).toBe(profile.localGround.revision);
        const shaded = composeAuthoredShoulderWorld(source, profile), legacy = composeAuthoredShoulderWorld(base, profile);
        expect(physical(shaded)).toEqual(physical(legacy));
        expect(shaded.definition.revision).not.toBe(legacy.definition.revision);
        expect(authoredShoulderDrawingRevision(shaded)).not.toBe(authoredShoulderDrawingRevision(legacy));
        expect(shaded.sites.filter(site => site.placement)).toHaveLength(75);
        for (const site of legacy.sites) expect(shaded.anchorAt(site.cell)).toEqual(site.point);
    }, 30_000);

    it('preserves the selected triangle/material union, supports, navigation and places when shoulder precedes water/cove', () => {
        expect(authoredShoulderGroundRevision(base, profile.localGround)).toBe(profile.localGround.revision);
        const shoulder = composeAuthoredShoulderWorld(base, profile), afterWater = composeAuthoredWaterWorld(state, shoulder).world;
        const triangleDigest = (input: IslandWorld) => input.floors.map(floor => {
            const triangles = Array.from({ length: floor.indices.length / 3 }, (_, i) => floor.indices.slice(i * 3, i * 3 + 3)
                .map(index => { const v = floor.vertices[index]; return [v.cell.x, v.cell.z, v.point.x, v.point.y, v.point.z].map(n => Math.round(n * 1e8) / 1e8).join(','); }).sort().join('|')).sort();
            return [floor.id, floor.kind, floor.color, floor.material, createHash('sha256').update(triangles.join(';')).digest('hex')];
        });
        expect(triangleDigest(afterWater)).toEqual(triangleDigest(world));
        expect(afterWater.definition.edges).toEqual(world.definition.edges);
        expect(places(state, afterWater)).toEqual(places(state, world));
        for (const site of world.sites) {
            expect(afterWater.anchorAt(site.cell)).toEqual(site.point);
            expect(afterWater.floorAt(site.cell)?.point).toEqual(world.floorAt(site.cell)?.point);
        }
        const coveFor = (input: IslandWorld) => composeAuthoredCoveWorld(input, deriveAuthoredCovePlan(state, input, derivePlaces(state, input)));
        const final = coveFor(afterWater), selected = coveFor(world);
        expect(triangleDigest(final)).toEqual(triangleDigest(selected));
        expect(final.definition.edges).toEqual(selected.definition.edges);
        expect(places(state, final)).toEqual(places(state, selected));
        expect(final.sites.filter(site => site.placement)).toHaveLength(75);
    }, 30_000);

    it('recognizes new-right water owners and preserves land through an ordinary existing-water move', () => {
        const shoulder = composeAuthoredShoulderWorld(base, profile);
        let next = structuredClone(state);
        for (const [kind, x] of [['water-bowl', 7], ['water-channel', 8]] as const) {
            expect(canPlace(next, { x, z: -6 }, undefined, shoulder)).toBe(true);
            next = applyIntent(next, { id: `water-${x}`, command: { type: 'place', kind, cell: { x, z: -6 } } }, undefined, shoulder).state;
        }
        const waterNext = composeAuthoredWaterWorld(next, shoulder);
        expect(waterNext.world.sites.filter(site => site.placement)).toHaveLength(75);
        const group = waterNext.plan.groups.find(group => group.ownerIds.includes('l33'))!;
        expect(group.ownerIds).toEqual(['l33', 'l34']); expect(group.bowlIds).toEqual(['l33']); expect(group.channelIds).toEqual(['l34']);
        // Ordinary individual-bodies behavior: the existing source sculpture
        // requires three bowls/two channels. No extra carving right is invented.
        expect(group.cut).toBe(false); expect(group.reason).toBe('individual-bodies');
        const moved = applyIntent(state, { id: 'move-existing-water', command: { type: 'move', id: 'l22', cell: { x: 6, z: -7 } } }, undefined, shoulder).state;
        expect(moved.landmarks.find(owner => owner.id === 'l22')?.cell).toEqual({ x: 6, z: -7 });
        const remapped = composeAuthoredWaterWorld(moved, shoulder);
        expect(remapped.world.sites.filter(site => site.placement)).toHaveLength(75);
        for (const cell of [{ x: 7, z: -6 }, { x: 8, z: -6 }]) {
            expect(remapped.world.owns(cell)).toBe(true); expect(remapped.world.floorAt(cell)?.point).toEqual(shoulder.floorAt(cell)?.point);
        }
    }, 30_000);
});
