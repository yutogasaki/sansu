import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IslandScene } from './runtime';
import { createIsland, getIslandLandAccess, getIslandLands, isValidIslandPlacement, ISLAND_ITEMS } from '../../../domain/island/catalog';
import { islandFloorContains } from '../../../domain/island/landGeometry';
import { IslandResident } from './animals';
import { IslandMaterials, disposeGeometry } from './primitives';
import { makeOptionalFurniture } from './optionalFurnitureGeometry';
import { OptionalFurnitureController } from './optionalFurnitureController';
import { resolveOptionalFurnitureTrial } from './optionalFurnitureTrial';
import type { IslandStageItem, IslandStageState } from './types';
import { planResidentPointRoute, residentGroundHeight, residentGroundIsSafe, residentObstacles, residentPointIsClear, RESIDENT_FOOTPRINT } from './navigation';
import { optionalFurnitureGroundSupports } from './optionalFurnitureGeometry';
import { optionalFootprintClearsCircle, optionalFootprintsAreSeparate, optionalResidentFootprint } from './optionalFurnitureNavigation';
import { OptionalFurniturePlacement, furniturePlacementKey, type IslandFurniturePlacementResult } from './optionalFurniturePlacement';

const species = ['otter', 'rabbit', 'fox'] as const;
afterEach(() => vi.unstubAllGlobals());
function fixture(kind: 'telescope' | 'hammock' | 'tea-table') {
    const island = createIsland('furniture-01-regression', 0);
    island.completedSets = 21; island.growth!.expansionLevel = 1;
    island.items = [
        { id: 'starter-flower', kind: 'flower', position: { x: 1.5, z: .8 }, rotation: 0, growthLevel: 3 },
        { id: 'starter-lantern', kind: 'lantern', position: { x: -1, z: .25 }, rotation: 0, growthLevel: 0 },
        { id: 'living-bench', kind: 'bench', position: { x: -.1, z: 1 }, rotation: 1.6951513213416582, growthLevel: 3 },
        { id: 'living-fountain', kind: 'fountain', position: { x: 3.4, z: 1.3 }, rotation: 0, growthLevel: 2 },
        { id: 'living-swing', kind: 'swing', position: { x: 6.2, z: 1.15 }, rotation: -1.5172760583355815, growthLevel: 2 },
    ];
    const materials = new IslandMaterials(), scene = new THREE.Scene(), group = makeOptionalFurniture(kind, materials);
    scene.add(group); group.position.set(-1, 0, 2.5);
    const residents = species.map((name, i) => new IslandResident(name, materials,
        i === 0 ? [-1, 0, 2] : i === 1 ? [2.5, 0, 2.5] : [6.75, 0, 0], () => {}));
    residents.forEach(resident => scene.add(resident.group));
    const controller = new OptionalFurnitureController(residents);
    const seed: IslandStageItem = { id: `optional-${kind}`, kind, position: { x: -1, z: 2.5 }, rotation: 0 };
    return { island, group, residents, controller, seed, materials, dispose() { controller.cancel(20000); residents.forEach(r => r.disposeAppearance()); disposeGeometry(scene); materials.dispose(); } };
}

describe('borrowed tools choose an actually usable legal trial location', () => {
    it('rechecks the chosen resident using the same borrowed model and retains a usable position on reselection', () => {
        vi.stubGlobal('document', { hidden: false });
        const f = fixture('telescope'), saved = JSON.stringify(f.island);
        const scene = f.group.parent!, runtime = Object.create(IslandScene.prototype) as {
            state: IslandStageState; updateFurnitureTrial(state: IslandStageState): void; advanceTrialSearch(): void;
            furnitureTrial: { item: IslandStageItem; group: THREE.Group }; trialSearch?: unknown;
            trialResolution?: { ready: boolean; item: IslandStageItem };
        };
        Object.assign(runtime, { state: { ...f.island, pulse: 0, learning: false, furnitureTrial: f.seed,
            furnitureTrialChoice: { residentId: 'otter' } }, scene, materials: f.materials, residents: f.residents,
            optionalFurniture: f.controller, motion: { matches: false }, onscreen: true,
            furnitureClearance: { active: false },
            callbacks: { caption: vi.fn() }, resize: vi.fn() });
        const set = (residentId: 'otter' | 'rabbit') => {
            runtime.state = { ...runtime.state, furnitureTrialChoice: { residentId } };
            runtime.updateFurnitureTrial(runtime.state);
        };
        const finish = () => {
            for (let i = 0; runtime.trialSearch && i < 1000; i++) runtime.advanceTrialSearch();
            expect(runtime.trialSearch).toBeUndefined(); expect(runtime.trialResolution?.ready).toBe(true);
        };
        set('otter'); finish();
        const borrowed = runtime.furnitureTrial, uuid = borrowed.group.uuid, initial = structuredClone(borrowed.item);
        const preflight = vi.spyOn(f.controller, 'canStart');
        set('rabbit'); runtime.advanceTrialSearch();
        expect(runtime.trialSearch).toBeDefined(); preflight.mockClear();
        set('otter'); finish();
        expect(preflight).toHaveBeenCalled();
        expect(preflight.mock.calls.every(([choice]) => choice.residentId === 'otter')).toBe(true);
        expect(borrowed.item).toEqual(initial);
        set('rabbit');
        expect(runtime.trialSearch).toBeDefined();
        expect(borrowed.group.visible).toBe(false);
        expect(borrowed.item).toEqual(initial);
        finish();
        expect(runtime.furnitureTrial.group.uuid).toBe(uuid);
        const current = structuredClone(borrowed.item);
        expect(f.controller.canStart({ item: current, group: borrowed.group, residentId: 'rabbit', requestId: 'selected-rabbit',
            borrowed: true, items: f.island.items, land: getIslandLandAccess(f.island), now: 0, reduced: false }).status).toBe('playing');
        // A new React state or cancellation for the same choice must not reset
        // a resolved borrowed position to the catalog's original seed.
        set('rabbit'); expect(runtime.trialSearch).toBeUndefined(); expect(borrowed.item).toEqual(current);
        const poses = f.residents.map(resident => resident.group.position.toArray());
        set('otter'); runtime.advanceTrialSearch();
        set('rabbit'); finish();
        expect(f.controller.canStart({ item: borrowed.item, group: borrowed.group, residentId: 'rabbit', requestId: 'latest-choice',
            borrowed: true, items: f.island.items, land: getIslandLandAccess(f.island), now: 0, reduced: false }).status).toBe('playing');
        expect(f.residents.map(resident => resident.group.position.toArray())).toEqual(poses);
        expect(runtime.furnitureTrial.group.uuid).toBe(uuid); expect(JSON.stringify(f.island)).toBe(saved);
        f.dispose();
    });
    it('uses the new connecting floor for the formerly blocked furniture-03 hammock without moving saved furniture', () => {
        const f = fixture('hammock');
        // Recorded positions/items, with constructor idle poses: the browser
        // trace did not capture idle yaw. Full render verification is separate.
        f.residents[0].group.position.set(-2.25, 0, 2);
        f.residents[1].group.position.set(2.487529474955016, 0, 2.2381189740553324);
        const telescope: IslandStageItem = { id: 'optional-telescope', kind: 'telescope', position: { x: -.75, z: 2.5 }, rotation: 0 };
        f.island.items.push(telescope);
        const seed = { ...f.seed, position: { x: -2.5, z: 1.25 }, rotation: Math.PI / 2 };
        const events: IslandFurniturePlacementResult[] = [];
        const placement = new OptionalFurniturePlacement(f.residents, f.controller, f.materials, event => events.push(event));
        const choice = { residentId: 'rabbit' as const }, saved = JSON.stringify(f.island);
        const poses = f.residents.map(resident => ({ uuid: resident.group.uuid, position: resident.group.position.toArray() }));
        placement.update({ preview: seed, choice, island: f.island, searchRequestId: 'first-search' });
        for (let i = 0; i < 1000 && placement.busy; i++) placement.step(i * 20, false);
        expect(placement.busy).toBe(false);
        // Furniture-03 on the old separate ellipses exhausted this search:
        // no-space until the telescope moved to (-.5,-2.5). Keep that original
        // failure evidence; connected floor now makes an unchanged layout usable.
        const first = events.at(-1)!;
        expect(first).toMatchObject({ status: 'ready', residentId: 'rabbit', itemId: seed.id,
            suggestion: { requestId: 'first-search' } });
        expect(JSON.stringify(f.island)).toBe(saved);
        expect(f.residents.map(resident => ({ uuid: resident.group.uuid, position: resident.group.position.toArray() }))).toEqual(poses);
        expect(f.controller.active).toBe(false);
        const suggested = { ...seed, position: first.suggestion!.position, rotation: first.suggestion!.rotation };
        const confirmedLayout = { ...f.island, items: [...f.island.items, suggested] }, land = getIslandLandAccess(f.island);
        expect(isValidIslandPlacement(confirmedLayout, suggested.id, suggested.position, suggested.rotation)).toBe(true);
        const oldFootprintFits = (point: { x: number; z: number }, radius: number) => getIslandLands(land).some(area =>
            ((point.x - area.x) / (area.radiusX - radius)) ** 2 + ((point.z - area.z) / (area.radiusZ - radius)) ** 2 <= 1);
        f.group.position.set(suggested.position.x, 0, suggested.position.z); f.group.rotation.set(0, suggested.rotation, 0);
        expect(f.controller.start({ item: suggested, group: f.group, ...choice, requestId: 'use-new-floor', borrowed: false,
            items: confirmedLayout.items, land, now: 0, reduced: false }).status).toBe('playing');
        const actor = f.controller.describe()!.actors[0] as { uuid: string; route: [number, number][] };
        expect(actor.uuid).toBe(poses[1].uuid);
        // Establish why this is newly possible, rather than merely accepting a
        // different status: the furniture or approach needs the new floor.
        expect(!oldFootprintFits(suggested.position, ISLAND_ITEMS.hammock.radius)
            || actor.route.some(([x, z]) => !oldFootprintFits({ x, z }, RESIDENT_FOOTPRINT)
                && !(x >= 4.05 && x <= 5.5 && Math.abs(z) <= .09)), JSON.stringify({ suggested, route: actor.route })).toBe(true);
        const physical = optionalFurnitureGroundSupports('hammock').map(support => {
            const point = f.group.localToWorld(new THREE.Vector3(support.x, 0, support.z));
            expect(islandFloorContains(point, support.radius, 1)).toBe(true);
            return { x: point.x, z: point.z, radius: support.radius };
        });
        const obstacles = [...residentObstacles(f.island.items, ''), ...physical];
        for (let t = 0; t < 17000 && f.controller.phase !== 'settled'; t += 40) {
            f.controller.update(t, false); f.controller.afterRender(() => true);
            if (f.controller.phase !== 'walking') continue;
            const rabbit = f.residents[1], body = optionalResidentFootprint(rabbit.group);
            expect(residentPointIsClear(rabbit.group.position, land, obstacles)).toBe(true);
            expect(rabbit.group.position.y).toBeCloseTo(residentGroundHeight(rabbit.group.position, land), 8);
            expect(residentObstacles(f.island.items, '').every(circle => optionalFootprintClearsCircle(body, circle))).toBe(true);
            expect(f.residents.filter(other => other !== rabbit).every(other => optionalFootprintsAreSeparate(body, optionalResidentFootprint(other.group)))).toBe(true);
        }
        expect(f.controller.describe()).toMatchObject({ phase: 'settled', contactSeen: true, actorIds: ['rabbit'] });
        f.controller.cancel(18000, confirmedLayout.items, land);
        expect(f.controller.active).toBe(false);
        expect(f.residents.map(resident => ({ uuid: resident.group.uuid, position: resident.group.position.toArray() }))).toEqual(poses);
        expect(residentGroundIsSafe(f.residents[1].group.position, land)).toBe(true);
        expect(JSON.stringify(f.island)).toBe(saved);

        // A distinct explicit placement changes only the surrounding telescope.
        const rearranged = { ...f.island, items: f.island.items.map(item => item.id === telescope.id ? { ...item, position: { x: -.5, z: -2.5 } } : item) };
        expect(isValidIslandPlacement(rearranged, telescope.id, { x: -.5, z: -2.5 }, telescope.rotation)).toBe(true);
        const rearrangedSaved = JSON.stringify(rearranged);
        placement.update({ preview: seed, choice, island: rearranged, searchRequestId: 'after-rearranging' });
        for (let i = 0; i < 1000 && placement.busy; i++) placement.step(20000 + i * 20, false);
        const ready = events.at(-1)!;
        expect(ready).toMatchObject({ status: 'ready', residentId: 'rabbit', itemId: seed.id });
        expect(ready.suggestion).toBeDefined();
        expect(JSON.stringify(rearranged)).toBe(rearrangedSaved);
        expect(f.residents.map(resident => ({ uuid: resident.group.uuid, position: resident.group.position.toArray() }))).toEqual(poses);
        expect(f.controller.active).toBe(false);
        const item = { ...seed, position: ready.suggestion!.position, rotation: ready.suggestion!.rotation };
        f.group.position.set(item.position.x, 0, item.position.z); f.group.rotation.set(0, item.rotation, 0);
        expect(f.controller.start({ item, group: f.group, ...choice, requestId: 'use-after-confirmation', borrowed: false,
            items: [...rearranged.items, item], land: getIslandLandAccess(rearranged), now: 0, reduced: false }).status).toBe('playing');
        for (let t = 0; t < 17000 && f.controller.phase !== 'settled'; t += 80) { f.controller.update(t, false); f.controller.afterRender(() => true); }
        expect(f.controller.describe()).toMatchObject({ phase: 'settled', contactSeen: true, actorIds: ['rabbit'] });
        placement.dispose(); f.dispose();
    });
    it('keeps the furniture-02 narrow passage blocked for the actual body, then accepts only a child-requested usable preview', () => {
        const f = fixture('telescope');
        f.residents[0].group.position.set(-2.25, 0, 2); f.residents[1].group.position.set(2.3508669769653117, 0, 2.36130628857774);
        const item = { ...f.seed, position: { x: -1, z: 2.5 }, rotation: Math.PI };
        f.group.position.set(-1, 0, 2.5); f.group.rotation.y = Math.PI;
        const physical = optionalFurnitureGroundSupports('telescope').map(p => ({ x: -1 - p.x, z: 2.5 - p.z, radius: p.radius }));
        const circles = [...residentObstacles(f.island.items, ''), ...physical, ...f.residents.slice(1).map(r => ({ x: r.group.position.x, z: r.group.position.z, radius: RESIDENT_FOOTPRINT }))];
        expect(residentPointIsClear(f.residents[0].group.position, 1, circles), 'origin clear').toBe(true);
        expect(residentPointIsClear({ x: -1, z: 2.22 }, 1, circles), 'arrival clear').toBe(true);
        const body = optionalResidentFootprint(f.residents[0].group).map(p => ({ x: p.x + 2.25, z: p.z - 2 }));
        const distance = Math.hypot(1.9, .5), gap = distance - .35 - .7 - RESIDENT_FOOTPRINT * 2;
        const t = (.35 + RESIDENT_FOOTPRINT + gap / 2) / distance, pinch = { x: 1.5 + 1.9 * t, z: .8 + .5 * t };
        const clearYaws = Array.from({ length: 360 }, (_, i) => i * Math.PI / 180).filter(yaw => {
            const polygon = body.map(p => ({ x: pinch.x + p.x * Math.cos(yaw) + p.z * Math.sin(yaw), z: pinch.z - p.x * Math.sin(yaw) + p.z * Math.cos(yaw) }));
            return [{ x: 1.5, z: .8, radius: .35 }, { x: 3.4, z: 1.3, radius: .7 }].every(circle => optionalFootprintClearsCircle(polygon, circle));
        });
        expect(clearYaws, `actual body can enter pinch at ${clearYaws.length} sampled yaws; center gap ${gap}`).toHaveLength(0);
        expect(planResidentPointRoute(f.residents[0].group.position, { x: -1, z: 2.22 }, f.island.items, 1,
            { obstacles: physical, occupied: f.residents.slice(1).map(r => r.group.position), yaw: Math.PI })).toBeUndefined();
        const result = f.controller.start({ item, group: f.group, requestId: 'repositioned', residentId: 'otter', borrowed: false,
            items: [...f.island.items, item], land: getIslandLandAccess(f.island), now: 0, reduced: false });
        expect(result).toMatchObject({ status: 'blocked', reason: 'unreachable', resident: 'otter' });
        const events: IslandFurniturePlacementResult[] = [], placement = new OptionalFurniturePlacement(f.residents, f.controller, f.materials, event => events.push(event));
        const island = { ...f.island, items: [...f.island.items, item] }, choice = { residentId: 'otter' as const }, input = { preview: item, choice, island };
        const saved = JSON.stringify(island), originalPose = { position: f.group.position.toArray(), rotation: f.group.rotation.y, uuid: f.group.uuid };
        placement.update(input); expect(events.at(-1)?.status).toBe('checking'); placement.step(0, false);
        expect(events.at(-1)?.status).toBe('blocked'); expect(events.some(event => event.suggestion)).toBe(false);
        placement.update({ ...input, searchRequestId: 'child-find' }); expect(events.at(-1)?.status).toBe('searching');
        let frames = 0; while (placement.busy && frames++ < 2500) placement.step(frames * 35, false);
        expect(placement.busy).toBe(false);
        const suggested = events.at(-1)!;
        expect(suggested).toMatchObject({ status: 'ready', residentId: 'otter', key: furniturePlacementKey(item, choice), suggestion: { requestId: 'child-find' } });
        expect(JSON.stringify(island)).toBe(saved);
        expect({ position: f.group.position.toArray(), rotation: f.group.rotation.y, uuid: f.group.uuid }).toEqual(originalPose);
        // The controller emitted a proposal only. The caller now explicitly
        // confirms that pose; the same actual resident uses the saved object.
        const confirmed = { ...item, position: suggested.suggestion!.position, rotation: suggested.suggestion!.rotation };
        expect(furniturePlacementKey(confirmed, choice)).not.toBe(furniturePlacementKey(item, choice));
        f.group.position.set(confirmed.position.x, 0, confirmed.position.z); f.group.rotation.y = confirmed.rotation;
        expect(f.controller.start({ item: confirmed, group: f.group, requestId: 'confirmed', residentId: 'otter', borrowed: false,
            items: [...f.island.items, confirmed], land: 1, now: 0, reduced: false })).toMatchObject({ status: 'playing', resident: 'otter' });
        for (let t = 0; t < 12000 && f.controller.phase !== 'settled'; t += 40) {
            f.controller.update(t, false); f.controller.afterRender(() => true);
            if (f.controller.phase === 'walking') expect(residentObstacles(f.island.items, '').every(circle => optionalFootprintClearsCircle(optionalResidentFootprint(f.residents[0].group), circle))).toBe(true);
        }
        expect(f.controller.describe()).toMatchObject({ phase: 'settled', contactSeen: true }); expect(f.group.uuid).toBe(originalPose.uuid);
        placement.dispose(); f.dispose();
    });
    it('drops an old explicit search on movement, lifecycle pause and foreground resume', () => {
        const f = fixture('telescope'), events: IslandFurniturePlacementResult[] = [];
        const placement = new OptionalFurniturePlacement(f.residents, f.controller, f.materials, event => events.push(event));
        const input = { preview: f.seed, choice: { residentId: 'rabbit' as const }, island: f.island, searchRequestId: 'old-find' };
        placement.update(input); placement.step(0, false); expect(placement.busy).toBe(true);
        placement.cancel(); const count = events.length; placement.step(1000, false); expect(events).toHaveLength(count);
        placement.resume(); placement.update(input); placement.step(2000, false);
        expect(events.slice(count).some(event => event.suggestion || event.status === 'searching')).toBe(false);
        placement.update({ ...input, searchRequestId: 'new-find' }); placement.step(2100, false);
        const moved = { ...input, preview: { ...f.seed, position: { x: -.5, z: -1 }, rotation: Math.PI / 2 }, searchRequestId: undefined };
        placement.update(moved); const boundary = events.length;
        for (let i = 0; i < 10; i++) placement.step(2200 + i * 35, false);
        expect(events.slice(boundary).every(event => event.key === furniturePlacementKey(moved.preview, moved.choice) && !event.suggestion)).toBe(true);
        placement.update(); const exit = events.length; placement.resume(); placement.step(5000, false); expect(events).toHaveLength(exit);
        expect(f.controller.active).toBe(false); placement.dispose(); f.dispose();
    });
    it('reproduces furniture-01: the saved-legal telescope blocks the explicitly selected rabbit beside the returned otter', () => {
        const f = fixture('telescope');
        expect(isValidIslandPlacement({ ...f.island, items: [...f.island.items, f.seed] }, f.seed.id, f.seed.position!)).toBe(true);
        const base = { item: f.seed, group: f.group, requestId: 'original', borrowed: true, items: f.island.items,
            land: getIslandLandAccess(f.island), now: 0, reduced: false };
        expect(f.controller.canStart({ ...base, residentId: 'otter' }).status).toBe('playing');
        expect(f.controller.canStart({ ...base, residentId: 'rabbit' })).toMatchObject({ status: 'blocked', resident: 'rabbit' });
        expect(f.controller.active).toBe(false); f.dispose();
    });
    it.each(['telescope', 'hammock', 'tea-table'] as const)('%s preflights every selected resident then retains the same real model through sequential trials', kind => {
        const f = fixture(kind), before = JSON.stringify(f.island), positions = f.residents.map(r => r.group.position.toArray()), uuid = f.group.uuid;
        const result = resolveOptionalFurnitureTrial(f.seed, f.group, f.residents, f.controller, f.island, 0, false);
        expect(result, JSON.stringify(result)).toMatchObject({ ready: true, participants: [...species] });
        expect(f.controller.active).toBe(false); expect(f.residents.map(r => r.group.position.toArray())).toEqual(positions);
        expect(isValidIslandPlacement({ ...f.island, items: [...f.island.items, result.item] }, result.item.id, result.item.position!, result.item.rotation)).toBe(true);
        const pairs = species.flatMap(residentId => kind === 'tea-table' ? species.filter(partner => partner !== residentId).map(partnerId => ({ residentId, partnerId })) : [{ residentId }]);
        for (const choice of pairs) for (const reduced of [false, true]) {
            expect(f.controller.start({ item: result.item, group: f.group, ...choice, requestId: 'chosen', borrowed: true,
                items: f.island.items, land: getIslandLandAccess(f.island), now: 0, reduced }).status).toBe('playing');
            const selected = 'partnerId' in choice ? [choice.residentId, choice.partnerId] : [choice.residentId];
            for (let t = 0; t < 17000 && f.controller.phase !== 'settled'; t += 80) {
                f.controller.update(t, reduced); f.controller.afterRender(() => true);
                if (f.controller.phase === 'walking') for (const resident of f.residents.filter(resident => selected.includes(resident.species))) {
                    const body = optionalResidentFootprint(resident.group);
                    expect(residentObstacles(f.island.items, '').every(circle => optionalFootprintClearsCircle(body, circle)), `${kind}/${resident.species}/${reduced} furniture at ${t}`).toBe(true);
                    expect(f.residents.filter(other => other !== resident).every(other => optionalFootprintsAreSeparate(body, optionalResidentFootprint(other.group))), `${kind}/${resident.species}/${reduced} resident at ${t}`).toBe(true);
                }
            }
            expect(f.controller.describe()).toMatchObject({ phase: 'settled', contactSeen: true, actorIds: 'partnerId' in choice ? [choice.residentId, choice.partnerId] : [choice.residentId] });
            expect(f.controller.caption).not.toContain('とことこ');
            f.controller.cancel(5100); expect(f.group.uuid).toBe(uuid);
        }
        expect(JSON.stringify(f.island)).toBe(before); f.dispose();
    });
});
