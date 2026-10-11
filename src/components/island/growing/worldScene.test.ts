import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { buildIslandCharacters, makePokomokoRig } from '../three/islandCharacters';
import { makeResidentRig } from '../three/residentRig';
import { newIsland } from '../../../domain/growingIsland/island';
import { createWorldScene } from './worldScene';
import { compileWorldDefinition } from '../../../domain/growingIsland/worldDefinition';

vi.mock('../three/islandCharacters', { spy: true });
vi.mock('../three/residentRig', { spy: true });

describe('world scene resource ownership', () => {
    it('grounds the actual home on authored terrain and never creates a rectangular pedestal or background planting', () => {
        const cells = [{ x: 0, z: 0 }, { x: 0, z: 2 }, { x: 4, z: 0 }, { x: 4, z: 2 }];
        const authored = compileWorldDefinition({ version: 1, id: 'actual-home-floor', districts: [{ id: 'core', templateId: 'actual-home-floor',
            logicalOrigin: { x: 0, z: 0 }, worldOrigin: { x: 0, y: 0, z: 0 }, turn: 0, ports: [],
            floors: [{ id: 'floor', kind: 'ground', color: '#a4cb87', vertices: cells.map(cell => ({ cell, point: { x: cell.x, y: cell.x * .1 + cell.z * .2, z: cell.z } })), indices: [0, 1, 2, 2, 1, 3] }],
            sites: [{ id: 'door', cell: { x: 2, z: 1 }, floorId: 'floor', placement: true }] }], edges: [] });
        const state = newIsland('authored-home', 0), before = structuredClone(state), world = createWorldScene({} as T.WebGLRenderer, undefined, authored);
        const layout = world.layout(state), house = world.scene.children.find(object => object.userData.objectId === 'house')!;
        expect(layout.world).toBe(authored); expect(house.position.y).toBeCloseTo(.35, 9);
        expect(house.position.x).toBeCloseTo(.5, 9); expect(house.position.z).toBeCloseTo(-1.5, 9);
        expect(world.scene.getObjectByName('garden-island-pedestal')).toBeUndefined();
        expect(world.scene.getObjectByName('garden-ground-details')).toBeUndefined();
        expect(world.scene.getObjectByName('authored-evaluated-floor')).toBeDefined(); expect(state).toEqual(before); world.dispose();
    });
    it('replaces only the expanded decorative pedestal and shelter tree, keeping sea and real ground planting', () => {
        const state = newIsland('shore-art', 1000), world = createWorldScene({} as T.WebGLRenderer);
        world.layout(state);
        expect(world.scene.getObjectByName('garden-island-pedestal')!.visible).toBe(true);
        expect(world.scene.getObjectByName('garden-shelter-crown')!.children.length).toBeGreaterThan(0);
        state.land.expanded = 'east'; const saved = structuredClone(state); world.layout(state);
        expect(world.scene.getObjectByName('garden-island-pedestal')!.visible).toBe(false);
        expect(world.scene.getObjectByName('garden-shelter-crown')!.children).toHaveLength(0);
        const sea = world.scene.getObjectByName('life-sea') as T.Mesh<T.PlaneGeometry, T.ShaderMaterial>;
        expect(sea.visible).toBe(true); expect(sea.geometry.parameters.width).toBeGreaterThanOrEqual(160);
        expect(sea.position.y).toBe(-.4); expect(sea.material.vertexShader).toContain('p=position.xy/40.+.5;');
        expect(world.scene.getObjectByName('garden-ground-details')!.children.length).toBeGreaterThan(0);
        const p = new T.Vector3(0, 5, 0), ray = new T.Raycaster(p, new T.Vector3(0, -1, 0));
        expect(world.groundAt(ray)).toBeDefined(); expect(state).toEqual(saved); world.dispose();
    });
    it('creates the original hero without unused residents and releases each owner once', () => {
        const previousHeroes = vi.mocked(makePokomokoRig).mock.calls.length;
        const world = createWorldScene({} as T.WebGLRenderer);
        expect(buildIslandCharacters).not.toHaveBeenCalled();
        expect(makeResidentRig).not.toHaveBeenCalled();
        expect(makePokomokoRig).toHaveBeenCalledTimes(previousHeroes + 1);
        expect(makePokomokoRig).toHaveBeenCalledWith(world.m);
        const hero = vi.mocked(makePokomokoRig).mock.results.at(-1)!.value as ReturnType<typeof makePokomokoRig>;
        expect(world.m.artDirection).toBe('moon-garden');
        expect(world.life.actorIds()).toEqual(['pokomoko']);
        expect(world.scene.getObjectById(hero.hero.id)).toBe(hero.hero);
        const geometry = new Set<T.BufferGeometry>();
        hero.hero.traverse(object => { if (object instanceof T.Mesh) geometry.add(object.geometry); });
        expect(geometry.size).toBeGreaterThan(0);
        const disposed = [...geometry].map(value => vi.spyOn(value, 'dispose'));
        const materialsDisposed = vi.spyOn(world.m, 'dispose');
        const fabricDisposed = vi.spyOn(world.m.residentFabric(), 'dispose');

        world.dispose();

        for (const dispose of disposed) expect(dispose).toHaveBeenCalledTimes(1);
        expect(materialsDisposed).toHaveBeenCalledTimes(1);
        expect(fabricDisposed).toHaveBeenCalledTimes(1);
        expect(world.scene.getObjectById(hero.hero.id)).toBeUndefined();
    });
});
