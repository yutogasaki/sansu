import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { compileWorldDefinition, type IslandWorld } from './worldDefinition';
import { withNative05WaterCarvingScope } from './authoredWaterCarving';
import { authoredWaterFrame } from './authoredWaterFrame';
import { AUTHORED_COVE_SOURCE_PROFILE as profile, composeAuthoredCoveWorld, deriveAuthoredCovePlan } from './authoredCoveWorld';
import { authoredWorldFrame } from './authoredWorldFrame';
import { applyIntent, canPlace } from './commands';
import { derivePlaces } from './places';
import type { GrowingState } from './types';

let base: IslandWorld, state: GrowingState, epoch: number;
const cove = { water: false, cove: true };
const definitionSha = (world: IslandWorld) => createHash('sha256').update(JSON.stringify(world.definition)).digest('hex');
const placementRights = (world: IslandWorld) => world.sites.filter(site => site.placement).map(site => [site.ref, site.cell, site.point]);
beforeAll(() => {
    base = withNative05WaterCarvingScope(compileWorldDefinition(JSON.parse(gunzipSync(readFileSync('prototypes/place-qa/native05-world.json.gz')).toString())));
    const fixture = JSON.parse(readFileSync('prototypes/place-qa/authored-flower-reference-mature.json', 'utf8'));
    state = fixture.state; epoch = fixture.epoch;
});

describe('one-way authored world frames', () => {
    it('shares the water frame unchanged, supports cove-only and disabled modes, and exposes final place revisions', () => {
        const off = authoredWorldFrame(state, base, { water: false, cove: false });
        expect(off.world).toBe(base); expect(off.waterPlan).toBeUndefined(); expect(off.covePlan).toBeUndefined();
        const water = authoredWaterFrame(state, base), waterOnly = authoredWorldFrame(state, base, { water: true, cove: false });
        expect(waterOnly.world).toBe(water.world); expect(waterOnly.waterPlan).toBe(water.plan); expect(waterOnly.covePlan).toBeUndefined();
        expect(waterOnly.revision).toBe(water.plan.revision); expect(off.revision).toBe('base');
        const dry = authoredWorldFrame(state, base, cove), wet = authoredWorldFrame(state, base, { water: true, cove: true });
        for (const frame of [dry, wet]) {
            expect(frame.covePlan?.assemblies).toHaveLength(1);
            const assembly = frame.covePlan!.assemblies[0];
            expect(assembly.placeRevision).toBe(derivePlaces(state, frame.world).find(place => place.id === assembly.placeId)!.revision);
            expect(frame.world.definition.source).toEqual(base.definition.source);
            expect(Object.isFrozen(frame)).toBe(true); expect(Object.isFrozen(assembly.transform)).toBe(true);
        }
        expect(wet.waterPlan).toBe(water.plan);
        expect(dry.covePlan!.assemblies[0].transform).toEqual(wet.covePlan!.assemblies[0].transform);
        expect(new Set([off.revision, waterOnly.revision, dry.revision, wet.revision]).size).toBe(4);
        expect(() => authoredWorldFrame(state, dry.world, cove)).toThrow('immutable base');
    }, 30_000);

    it('removes every dependent floor/ref/edge on real home, play and supply edits and restores the exact frame revision', () => {
        const initial = authoredWorldFrame(state, base, cove);
        const initialDefinition = definitionSha(initial.world), acquired = placementRights(initial.world);
        for (const ownerId of ['p6', 'p9', 'l32']) {
            const owner = [...state.plots, ...state.landmarks].find(owner => owner.id === ownerId)!;
            // The real inhabited home remains protected by the command gate.
            // Move its residents to Pokomoko for the permitted storage branch.
            if (state.villagers.some(villager => villager.home === ownerId))
                expect(() => applyIntent(state, { id: `occupied-${ownerId}`, command: { type: 'store', id: ownerId } }, epoch, initial.world)).toThrow('すんでいる');
            const storable = { ...state, villagers: state.villagers.map(villager => villager.home === ownerId ? { ...villager, home: 'pokomoko' } : villager) };
            const stored = applyIntent(storable, { id: `cove-store-${ownerId}`, command: { type: 'store', id: ownerId } }, epoch, initial.world).state;
            const absent = authoredWorldFrame(stored, base, cove);
            expect(absent.covePlan?.assemblies).toEqual([]); expect(absent.world).toBe(base);
            expect(absent.world.definition.districts).toEqual(base.definition.districts);
            expect(absent.world.definition.edges).toEqual(base.definition.edges);
            expect(absent.world.sites.filter(site => site.placement)).toHaveLength(73);
            const restored = applyIntent(stored, { id: `cove-restore-${ownerId}`, command: { type: 'unstore', id: ownerId, cell: owner.cell! } }, epoch, absent.world).state;
            const returned = authoredWorldFrame(restored, base, cove);
            expect(returned.revision).toBe(initial.revision); expect(returned.covePlan).toEqual(initial.covePlan);
            expect(definitionSha(returned.world)).toBe(initialDefinition);
            expect(placementRights(returned.world)).toEqual(acquired);
            const destination = initial.world.sites.find(site => site.placement && site.cell.z < -3 && canPlace(state, site.cell, ownerId, initial.world))!.cell;
            const moved = applyIntent(state, { id: `cove-move-${ownerId}`, command: { type: 'move', id: ownerId, cell: destination } }, epoch, initial.world).state;
            const separated = authoredWorldFrame(moved, base, cove);
            expect(separated.covePlan?.assemblies).toEqual([]); expect(separated.world).toBe(base);
            const rejoined = applyIntent(moved, { id: `cove-rejoin-${ownerId}`, command: { type: 'move', id: ownerId, cell: owner.cell! } }, epoch, separated.world).state;
            const connectedAgain = authoredWorldFrame(rejoined, base, cove);
            expect(connectedAgain.revision).toBe(initial.revision);
            expect(definitionSha(connectedAgain.world)).toBe(initialDefinition);
            expect([absent.world, separated.world, connectedAgain.world].map(placementRights)).toEqual([acquired, acquired, acquired]);
            // A renderer may still hold the initial frame throughout these edits.
            expect(definitionSha(initial.world)).toBe(initialDefinition);
        }
        expect(base.definition.revision).toBeUndefined();
        expect(state.plots.find(owner => owner.id === 'p6')?.cell).toEqual({ x: 7, z: -1 });
    }, 30_000);

    it('removes and restores a cove on the current water-composed world without losing upstream water', () => {
        const options = { water: true, cove: true }, initial = authoredWorldFrame(state, base, options);
        const stored = applyIntent(state, { id: 'water-cove-store', command: { type: 'store', id: 'p9' } }, epoch, initial.world).state;
        const absent = authoredWorldFrame(stored, base, options), water = authoredWaterFrame(stored, base);
        expect(absent.covePlan?.assemblies).toEqual([]); expect(absent.world).toBe(water.world); expect(absent.waterPlan).toBe(water.plan);
        expect(absent.waterPlan!.pools.length).toBeGreaterThan(0);
        const restored = applyIntent(stored, { id: 'water-cove-restore', command: { type: 'unstore', id: 'p9', cell: { x: 8, z: 0 } } }, epoch, absent.world).state;
        const returned = authoredWorldFrame(restored, base, options);
        expect(returned.revision).toBe(initial.revision); expect(returned.covePlan).toEqual(initial.covePlan);
    }, 40_000);

    it('keys the bounded cache by unopened and derivation inputs while ignoring receipts and signs profile/source/patch changes', () => {
        const initial = authoredWorldFrame(state, base, cove);
        const initialDefinition = definitionSha(initial.world);
        const receipts = { ...state, applied: ['only-receipt'], placeProgress: { version: 1 as const, milestones: {}, uses: {}, shown: {} } };
        expect(authoredWorldFrame(receipts, base, cove)).toBe(initial);
        const unopened = { ...state, unopened: [...state.unopened, 'p9'] };
        expect(authoredWorldFrame(unopened, base, cove).covePlan?.assemblies).toEqual([]);
        const returned = authoredWorldFrame(state, base, cove);
        expect(returned.revision).toBe(initial.revision); expect(returned.covePlan).toEqual(initial.covePlan);
        expect(definitionSha(returned.world)).toBe(initialDefinition);
        expect(definitionSha(initial.world)).toBe(initialDefinition);
        expect(authoredWorldFrame(receipts, base, cove)).toBe(returned);
        const sourceChanged = authoredWorldFrame(state, base, cove, { ...profile, sourceSha256: '1'.repeat(64) });
        expect(sourceChanged.revision).not.toBe(initial.revision);
        expect(sourceChanged.covePlan!.assemblies[0].sourceSha256).toBe('1'.repeat(64));
        const transformChanged = authoredWorldFrame(state, base, cove, { ...profile, transform: { ...profile.transform, yaw: .01 } });
        expect(transformChanged.revision).not.toBe(initial.revision);
        const recoloredPatch = { ...profile.patch, district: { ...profile.patch.district,
            floors: profile.patch.district.floors.map(floor => ({ ...floor, color: '#cccad4' })) } };
        const patchChanged = authoredWorldFrame(state, base, cove, { ...profile, patch: recoloredPatch });
        expect(patchChanged.revision).not.toBe(initial.revision);
        const afterEviction = authoredWorldFrame(state, base, cove);
        expect(afterEviction.revision).toBe(initial.revision); expect(afterEviction.covePlan).toEqual(initial.covePlan);
        expect(definitionSha(afterEviction.world)).toBe(initialDefinition);
        expect(definitionSha(initial.world)).toBe(initialDefinition);
        const evolving = Object.freeze(structuredClone(profile));
        const beforeEdit = authoredWorldFrame(state, base, cove, evolving);
        Object.assign(evolving.transform, { yaw: .02 });
        expect(authoredWorldFrame(state, base, cove, evolving).revision).not.toBe(beforeEdit.revision);
    }, 30_000);

    it('fails closed on absent references, extra placement rights and changed original support', () => {
        const badEdge = { ...profile.patch.edges[0], from: { districtId: 'absent', siteId: 'absent' } };
        const badRef = { ...profile, patch: { ...profile.patch, edges: [badEdge, ...profile.patch.edges.slice(1)] } };
        const badGrant = { ...profile, patch: { ...profile.patch, district: { ...profile.patch.district,
            sites: profile.patch.district.sites.map(site => ({ ...site, placement: true })) } } };
        const coveringFloor = { id: 'unproved-cover', kind: 'ground' as const, color: '#cccccc', indices: [0, 1, 2],
            vertices: [{ x: 7.8, z: -.2 }, { x: 8.2, z: -.2 }, { x: 8, z: .2 }]
                .map(cell => ({ cell, point: { ...cell, y: base.floorAt({ x: 8, z: 0 })!.point.y + .03 } })) };
        const badSupport = { ...profile, patch: { ...profile.patch, district: { ...profile.patch.district,
            floors: [...profile.patch.district.floors, coveringFloor] } } };
        expect(() => composeAuthoredCoveWorld(base, deriveAuthoredCovePlan(state, base, derivePlaces(state, base), badSupport)))
            .toThrow('changes existing site support');
        for (const source of [badRef, badGrant, badSupport]) {
            const frame = authoredWorldFrame(state, base, cove, source);
            expect(frame.world === base).toBe(true); expect(frame.covePlan?.assemblies).toEqual([]); expect(frame.covePlan?.patch).toBeUndefined();
        }
    });
});
