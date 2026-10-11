import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as T from 'three';
import { compileWorldDefinition, type IslandWorld } from '../../../../domain/growingIsland/worldDefinition';
import { authoredWaterFrame } from '../../../../domain/growingIsland/authoredWaterFrame';
import { composeAuthoredWaterWorld } from '../../../../domain/growingIsland/authoredWaterWorld';
import { applyIntent, canPlace } from '../../../../domain/growingIsland/commands';
import { isReachable, key, reachableFromHome, walkableCells } from '../../../../domain/growingIsland/space';
import type { GrowingState } from '../../../../domain/growingIsland/types';
import { derivePlaces } from '../../../../domain/growingIsland/places';
import { buildAuthoredGrowingGround } from './authoredGrowingGround';
import { sceneLayout } from '../sceneLayout';
import { createWorldScene } from '../worldScene';
import { buildObjectLayer, previewGrowingState } from '../objectLayer';
import { IslandMaterials } from '../../three/primitives';
import { chooseGrowingFingerTarget } from '../growingFingerTargets';

let base: IslandWorld, state: GrowingState, epoch: number;
beforeAll(() => {
    base = compileWorldDefinition(JSON.parse(gunzipSync(readFileSync('prototypes/place-qa/native05-world.json.gz')).toString()));
    const fixture = JSON.parse(readFileSync('prototypes/place-qa/authored-water-fixture.json', 'utf8'));
    state = fixture.state; epoch = fixture.epoch;
});

describe('actual 27-owner hill water frame', () => {
    it('keeps all acquired anchors and owner approaches while rendering the exact evaluated water and bed', () => {
        const frame = authoredWaterFrame(state, base), open = walkableCells(state, frame.world), reached = reachableFromHome(state, open, frame.world);
        const owners = [...state.plots, ...state.landmarks];
        expect(owners).toHaveLength(27); expect(frame.plan.pools).toHaveLength(3); expect(frame.plan.streams).toHaveLength(4);
        expect(frame.world.sites.filter(site => site.placement)).toHaveLength(73);
        expect(frame.world.sites.map(site => [site.ref, site.cell, site.point, site.placement])).toEqual(base.sites.map(site => [site.ref, site.cell, site.point, site.placement]));
        expect(owners.every(owner => owner.cell && isReachable(owner.cell, reached, frame.world))).toBe(true);
        const layout = sceneLayout(state, false, frame.world, frame.plan, base), terrain = buildAuthoredGrowingGround(layout);
        terrain.root.updateMatrixWorld(true);
        for (const pool of frame.plan.pools) {
            const cell = owners.find(owner => owner.id === pool.ownerId)!.cell!;
            expect(frame.world.owns(cell)).toBe(true); expect(frame.world.floorAt(cell)).toBeUndefined();
            expect(open.has(key(cell))).toBe(false); expect(canPlace(state, cell, pool.ownerId, frame.world)).toBe(false);
            const origin = new T.Vector3(pool.center.x - layout.center, pool.waterY + 3, pool.center.z - 2);
            const ray = new T.Raycaster(origin, new T.Vector3(0, -1, 0));
            const hit = ray.intersectObject(terrain.floor)[0];
            expect(hit.point.y).toBeCloseTo(pool.bedY, 6); expect(Number.isNaN(layout.cellAt(hit.point).x)).toBe(true);
            const mesh = terrain.root.getObjectByName('authored-shared-water')!.children.find(mesh => mesh.userData.objectId === pool.ownerId)!;
            expect(ray.intersectObject(mesh)[0].point.y).toBeCloseTo(pool.waterY, 6);
        }
        expect(derivePlaces(state, frame.world).find(place => place.ruleId === 'P03')?.variant).toBe('tiered');
        const materials = new IslandMaterials('moon-garden'), layer = buildObjectLayer(materials, state, layout);
        layer.root.updateMatrixWorld(true);
        const camera = new T.OrthographicCamera(-12, 12, 12, -12, .01, 100);
        camera.position.set(0, 30, 0); camera.up.set(0, 0, -1); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
        for (const owner of owners.filter(owner => frame.plan.ownerIds.includes(owner.id))) {
            const hits = new T.Raycaster(layout.point(owner.cell!, 3), new T.Vector3(0, -1, 0)).intersectObjects([layer.root, terrain.root], true);
            const selected = chooseGrowingFingerTarget(hits, camera, 1000, 1000, 500, 500);
            expect(selected?.object.name).toBe('authored-water-floor');
            expect(selected?.object.userData.objectId).toBe(owner.id);
            expect(hits.some(hit => hit.object.name === 'life-bowl-water')).toBe(false);
        }
        layer.dispose(); materials.dispose();
        terrain.dispose();
    });

    it('stores and reconnects through real commands, restoring original dry ground and exactly the same water revision', () => {
        const initial = authoredWaterFrame(state, base), channel = state.landmarks.find(owner => owner.id === 'l24')!;
        const stored = applyIntent(state, { id: 'wet-store', command: { type: 'store', id: channel.id } }, epoch, initial.world).state;
        const dry = authoredWaterFrame(stored, base);
        expect(dry.plan.pools).toHaveLength(0); expect(dry.world.floors).toEqual(base.floors);
        const restored = applyIntent(stored, { id: 'wet-restore', command: { type: 'unstore', id: channel.id, cell: channel.cell! } }, epoch, dry.world).state;
        const joined = authoredWaterFrame(restored, base);
        expect(joined.plan).toEqual(initial.plan); expect(joined.world.floors).toEqual(initial.world.floors);
        expect([...restored.plots, ...restored.landmarks].map(owner => owner.id)).toEqual([...state.plots, ...state.landmarks].map(owner => owner.id));
        expect(state.landmarks.find(owner => owner.id === channel.id)?.cell).toEqual(channel.cell);
    });

    it('uses the same future geometry for preview and confirmation without changing the committed frame', () => {
        const initial = authoredWaterFrame(state, base), cell = { x: 12, z: -9 };
        expect(canPlace(state, cell, 'l20', initial.world)).toBe(true);
        const future = previewGrowingState(state, { ownerId: 'l20', kind: 'water-bowl', cell, valid: true, allowed: [cell], seed: false, style: 'plain' })!;
        const predicted = authoredWaterFrame(future, base);
        const confirmed = applyIntent(state, { id: 'wet-move', command: { type: 'move', id: 'l20', cell } }, epoch, initial.world).state;
        expect(authoredWaterFrame(confirmed, base).plan).toEqual(predicted.plan);
        expect(authoredWaterFrame(state, base)).toBe(initial);
        expect(authoredWaterFrame({ ...state, applied: [] }, base)).toBe(initial);
        const keepsake = { ...state, keepsakes: [...state.keepsakes, { id: 'frame-shell', unitId: 'frame-unit', cell: { x: 6, z: -7 } }] };
        const obstructed = authoredWaterFrame(keepsake, base);
        expect(obstructed).not.toBe(initial);
        expect(obstructed.plan).toEqual(composeAuthoredWaterWorld(keepsake, base).plan);
        expect(base.definition.revision).toBeUndefined();
    });

    it('shows separate prospective terrain, keeps committed pointer support, and restores scene resources on cancel', () => {
        const scene = createWorldScene({} as T.WebGLRenderer, undefined, base, undefined, true), committed = scene.layout(state);
        const original = scene.scene.getObjectByName('authored-shared-terrain')!;
        const future = structuredClone(state); delete future.landmarks.find(owner => owner.id === 'l24')!.cell;
        expect(scene.showWaterPreview(future)).toBe(authoredWaterFrame(future, base).plan.revision);
        expect(scene.hasWaterPreview()).toBe(true); expect(original.visible).toBe(false); expect(scene.life.root.visible).toBe(false);
        expect(scene.scene.children.filter(object => object.name === 'authored-shared-terrain')).toHaveLength(2);
        const pool = committed.authoredWaterPlan!.pools[0];
        scene.scene.updateMatrixWorld(true);
        const hit = scene.groundAt(new T.Raycaster(new T.Vector3(pool.center.x - committed.center, pool.waterY + 3, pool.center.z - 2), new T.Vector3(0, -1, 0)));
        expect(hit?.y).toBeCloseTo(pool.bedY, 6);
        scene.showWaterPreview();
        expect(scene.hasWaterPreview()).toBe(false); expect(original.visible).toBe(true); expect(scene.life.root.visible).toBe(true);
        expect(scene.scene.children.filter(object => object.name === 'authored-shared-terrain')).toHaveLength(1);
        scene.dispose();
    });
});
