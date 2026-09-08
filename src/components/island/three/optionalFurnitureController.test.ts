import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ISLAND_ITEMS } from '../../../domain/island/catalog';
import type { IslandOptionalFurnitureKind } from '../../../domain/island/types';
import { IslandResident } from './animals';
import { IslandMaterials, disposeGeometry } from './primitives';
import { makeOptionalFurniture, optionalFurnitureAnchors, hammockSurface } from './optionalFurnitureGeometry';
import { OptionalFurnitureController } from './optionalFurnitureController';
import type { IslandStageItem } from './types';
import { fitOptionalFurnitureCamera } from './optionalFurnitureFraming';
import { boxCorners } from './sceneFraming';
import { RESIDENT_FOOTPRINT } from './navigation';
import { optionalFootprintClearsCircle, optionalFootprintsAreSeparate, optionalResidentFootprint } from './optionalFurnitureNavigation';

const species = ['otter', 'rabbit', 'fox'] as const;
const kinds = ['telescope', 'hammock', 'tea-table'] as const;
function fixture(kind: IslandOptionalFurnitureKind, rotation = 0) {
    const m = new IslandMaterials(), scene = new THREE.Scene(), group = makeOptionalFurniture(kind, m);
    group.rotation.y = rotation; scene.add(group);
    const residents = species.map((name, i) => new IslandResident(name, m,
        i === 0 ? [-1.65, 0, 1.1] : i === 1 ? [1.7, 0, 1.35] : [2.6, 0, -.2], () => {}));
    residents.forEach(resident => { resident.setAppearance('cap'); scene.add(resident.group); });
    const controller = new OptionalFurnitureController(residents);
    const item: IslandStageItem = { id: `optional-${kind}`, kind, position: { x: 0, z: 0 }, rotation };
    const start = (residentId: typeof species[number], borrowed = false, partnerId?: typeof species[number]) => controller.start({ item, group,
        requestId: `${kind}-${residentId}`, residentId, partnerId, borrowed, items: [item], land: 0, now: 0, reduced: false });
    return { m, scene, group, residents, item, controller, start, dispose() {
        controller.cancel(0); residents.forEach(resident => resident.disposeAppearance()); disposeGeometry(scene); m.dispose();
    } };
}
function radialExtent(object: THREE.Object3D, frame: THREE.Group) {
    object.updateWorldMatrix(true, true); frame.updateWorldMatrix(true, true);
    const inverse = frame.matrixWorld.clone().invert(), point = new THREE.Vector3(); let radius = 0;
    object.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        const positions = child.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
            point.fromBufferAttribute(positions, i).applyMatrix4(child.matrixWorld).applyMatrix4(inverse);
            radius = Math.max(radius, Math.hypot(point.x, point.z));
        }
    }); return radius;
}

describe('optional tools use the actual bodies and bounded furniture', () => {
    it.each([false, true])('starts the walk clock only after its first actual rendered frame (reduced=%s)', reduced => {
        const f = fixture('telescope'); expect(f.start('otter').status).toBe('playing');
        const origin = f.residents[0].group.position.clone();
        // Both a long synchronous preparation and repeated non-rendered
        // updates must preserve the initial walk, without claiming contact.
        for (const now of [900, 5000, 10000]) {
            f.controller.update(now, reduced);
            expect(f.controller.phase).toBe('walking');
            expect(f.residents[0].group.position.distanceTo(origin)).toBeLessThan(.001);
            expect(f.controller.describe()).toMatchObject({ contactSeen: false, transferSeen: false });
        }
        f.controller.afterRender(() => true, 10200);
        const duration = reduced ? 300 : 2400;
        f.controller.update(10200 + duration - 1, reduced); expect(f.controller.phase).toBe('walking');
        // Later walking renders cannot keep resetting the clock.
        f.controller.afterRender(() => true, 10200 + duration - 1);
        f.controller.update(10200 + duration, reduced); expect(f.controller.phase).toBe('contact');
        expect(f.controller.describe()!.contactSeen).toBe(false);
        f.controller.update(14000, reduced); expect(f.controller.phase).toBe('contact');
        f.controller.afterRender(() => false, 14000); expect(f.controller.describe()!.contactSeen).toBe(false);
        f.controller.afterRender(() => true, 14001); expect(f.controller.describe()!.contactSeen).toBe(true);
        f.dispose();
    });
    it('cancels a prepared walk without borrowing its render clock for the next invitation', () => {
        const f = fixture('telescope'); expect(f.start('otter').status).toBe('playing');
        f.controller.update(5000, true); f.controller.cancel(5001);
        expect(f.controller.active).toBe(false); f.controller.afterRender(() => true, 5002);
        expect(f.start('rabbit').status).toBe('playing');
        f.controller.update(15000, true); expect(f.controller.phase).toBe('walking');
        expect(f.controller.describe()!.actorIds).toEqual(['rabbit']); f.dispose();
    });
    it.each(kinds)('%s static model stays within the domain occupancy', kind => {
        const f = fixture(kind); expect(radialExtent(f.group, f.group)).toBeLessThanOrEqual(ISLAND_ITEMS[kind].radius); f.dispose();
    });
    for (const kind of kinds) it.each(species)(`${kind} uses selected %s with visible actual contacts`, residentId => {
        const f = fixture(kind);
        const result = f.start(residentId); expect(result, JSON.stringify(result)).toMatchObject({ status: 'playing', resident: residentId });
        const phases: string[] = [], cups = new Set<string>(); let extent = 0;
        for (let now = 0; now <= 15000; now += 100) {
            f.controller.update(now, false); f.controller.afterRender(() => true);
            const state = f.controller.describe()!; phases.push(state.phase); if (state.cup) cups.add(state.cup.uuid);
            if (!['walking', 'mounting'].includes(state.phase)) {
                extent = Math.max(extent, radialExtent(f.group, f.group));
                for (const id of state.actorIds) extent = Math.max(extent, radialExtent(f.residents.find(r => r.species === id)!.group, f.group));
            }
            if (state.phase === 'settled') break;
        }
        const state = f.controller.describe()!;
        expect(state, JSON.stringify(state)).toMatchObject({ phase: 'settled', contactSeen: true });
        expect(extent, `actual ${kind}/${residentId} occupied radius ${extent}`).toBeLessThanOrEqual(ISLAND_ITEMS[kind].radius);
        if (kind === 'tea-table') { expect(state.transferSeen).toBe(true); expect(cups.size).toBe(1); expect(phases).toContain('handoff'); }
        if (kind === 'hammock') {
            const seat = optionalFurnitureAnchors(f.group).seat!, actor = f.residents.find(r => r.species === residentId)!;
            expect(actor.seatContact.getWorldPosition(new THREE.Vector3()).distanceTo(seat)).toBeLessThan(.001);
            expect(hammockSurface(0, .12)).toBeCloseTo(.44);
        }
        f.dispose();
    });
    it('requires actual rendered contact before transferring the cup', () => {
        const f = fixture('tea-table'); expect(f.start('otter', true, 'fox').status).toBe('playing');
        for (let now = 0; now < 10000; now += 100) { f.controller.update(now, false); f.controller.afterRender(() => false); }
        expect(f.controller.describe()).toMatchObject({ phase: 'pickup', contactSeen: false, transferSeen: false, cup: { holder: 'table' } });
        f.controller.afterRender(() => true); f.controller.update(10001, false);
        expect(f.controller.describe()).toMatchObject({ phase: 'offering', cup: { holder: 'otter' } }); f.dispose();
    });
    it('keeps explicit absent residents and partners unavailable', () => {
        const f = fixture('tea-table'); f.residents[2].group.visible = false;
        expect(f.start('fox').reason).toBe('resident-unavailable');
        expect(f.start('otter', true, 'fox').reason).toBe('partner-unavailable'); expect(f.controller.active).toBe(false); f.dispose();
    });
    for (const kind of kinds) it.each([Math.PI / 2, Math.PI, Math.PI * 1.5])(`${kind} keeps contact and real framing at rotation %s in both motion modes`, rotation => {
        for (const reduced of [false, true]) {
            const f = fixture(kind, rotation), selected = species[Math.round(rotation / (Math.PI / 2)) - 1];
            expect(f.start(selected).status).toBe('playing');
            for (let t = 0; t < 18000; t += reduced ? 80 : 200) {
                f.controller.update(t, reduced); f.controller.afterRender(() => true);
                if (f.controller.phase === 'settled') break;
            }
            expect(f.controller.describe()).toMatchObject({ phase: 'settled', contactSeen: true });
            const bounds = f.controller.framingBounds!;
            for (const aspect of [390 / 240, 390 / 380, 768 / 380]) {
                const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
                fitOptionalFurnitureCamera(camera, bounds, aspect, rotation);
                for (const point of boxCorners(bounds)) {
                    point.project(camera); expect(Math.abs(point.x)).toBeLessThan(.96); expect(Math.abs(point.y)).toBeLessThan(.96);
                    expect(Math.abs(point.z)).toBeLessThan(1);
                }
            }
            f.dispose();
        }
    });
    for (const giver of species) it.each(species.filter(name => name !== giver))(`tea passes one real cup from ${giver} to %s with both hands touching`, receiver => {
        const f = fixture('tea-table', Math.PI / 2), uuid = f.group.getObjectByName('optional-tea-cup')!.uuid;
        expect(f.start(giver, true, receiver)).toMatchObject({ status: 'playing', resident: giver, partner: receiver });
        const holders: string[] = [];
        for (let t = 0; t < 18000; t += 100) {
            f.controller.update(t, false); f.controller.afterRender(() => true);
            const state = f.controller.describe()!; holders.push(state.cup!.holder);
            expect(state.cup!.uuid).toBe(uuid);
            if (state.phase === 'handoff' && state.transferSeen) {
                const contacts = optionalFurnitureAnchors(f.group).cupGrips;
                expect(f.residents.find(r => r.species === giver)!.handAnchor(new THREE.Vector3(), 'right').distanceTo(contacts[0]!)).toBeLessThan(.008);
                expect(f.residents.find(r => r.species === receiver)!.handAnchor(new THREE.Vector3(), 'left').distanceTo(contacts[1]!)).toBeLessThan(.008);
            }
            if (state.phase === 'settled') break;
        }
        expect(f.controller.describe()).toMatchObject({ phase: 'settled', transferSeen: true });
        expect(holders).toContain(giver); expect(holders).toContain(receiver); expect(holders[holders.length - 1]).toBe('table'); f.dispose();
    });
    it('does not walk through a display covering the destination, and restores a cancelled actor clear of newly placed displays', () => {
        const f = fixture('telescope'), origin = f.residents[0].group.position.clone();
        expect(f.controller.start({ item: f.item, group: f.group, requestId: 'blocked', residentId: 'otter', borrowed: true,
            items: [f.item], land: 0, now: 0, reduced: false, obstacles: [{ x: 0, z: .28, radius: .72 }] }).status).toBe('blocked');
        expect(f.residents[0].group.position.toArray()).toEqual(origin.toArray());
        expect(f.start('otter').status).toBe('playing');
        f.controller.update(3000, false);
        f.controller.cancel(4000, [f.item], 0, [{ x: origin.x, z: origin.z, radius: .72 }]);
        expect(f.residents[0].group.position.distanceTo(origin)).toBeGreaterThanOrEqual(.72 + RESIDENT_FOOTPRINT);
        expect(f.controller.active).toBe(false); f.dispose();
    });
    it('routes the actual fox tail around an independent obstacle and the stationary residents', () => {
        const f = fixture('telescope'), obstacle = { x: 1.22, z: -.05, radius: .22 };
        expect(f.controller.start({ item: f.item, group: f.group, requestId: 'tail-clear', residentId: 'fox', borrowed: true,
            items: [f.item], land: 0, now: 0, reduced: false, obstacles: [obstacle] }).status).toBe('playing');
        const fox = f.residents[2], otherBodies = f.residents.slice(0, 2).map(resident => optionalResidentFootprint(resident.group));
        for (let t = 0; t < 2400; t += 20) {
            f.controller.update(t, false);
            const body = optionalResidentFootprint(fox.group);
            expect(optionalFootprintClearsCircle(body, obstacle), `tail at ${t}`).toBe(true);
            expect(otherBodies.every(other => optionalFootprintsAreSeparate(body, other)), `body at ${t}`).toBe(true);
        }
        f.dispose();
    });
    it.each(kinds)('%s cancellation drops a borrowed action without replay or changing owned poses', kind => {
        const f = fixture(kind), before = structuredClone(f.item), uuids = f.residents.map(r => r.group.uuid);
        expect(f.start('rabbit', true).status).toBe('playing');
        for (let t = 0; t < 6200; t += 100) { f.controller.update(t, false); f.controller.afterRender(() => true); }
        f.controller.cancel(6200, [f.item], 0); expect(f.controller.active).toBe(false);
        f.controller.update(50000, false); expect(f.controller.active).toBe(false); expect(f.item).toEqual(before);
        expect(f.residents.map(r => r.group.uuid)).toEqual(uuids);
        for (const resident of f.residents) expect(resident.group.position.y).toBeCloseTo(0);
        f.dispose();
    });
});
