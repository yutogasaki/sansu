import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { buildIslandCharacters, makePokomokoRig } from '../three/islandCharacters';
import { makeResidentRig } from '../three/residentRig';
import { createWorldScene } from './worldScene';

vi.mock('../three/islandCharacters', { spy: true });
vi.mock('../three/residentRig', { spy: true });

describe('world scene resource ownership', () => {
    it('creates the original hero without unused residents and releases each owner once', () => {
        const world = createWorldScene({} as T.WebGLRenderer);
        expect(buildIslandCharacters).not.toHaveBeenCalled();
        expect(makeResidentRig).not.toHaveBeenCalled();
        expect(makePokomokoRig).toHaveBeenCalledTimes(1);
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
