import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { skinTheme, toneLight } from './themeSkin';

describe('special island skin', () => {
    const thing = (color: string) => new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial({ color }));

    it('dresses placed things in the island materials and gives them back on another island', () => {
        const root = new T.Group(), wood = thing('#8a5a32'), roof = thing('#3d7fd0'), creature = thing('#ff8800');
        creature.userData.species = 'key-weed'; root.add(wood, roof, creature);
        const original = wood.material;
        skinTheme(root, 'karakuri');
        expect(wood.material).not.toBe(original);
        expect((wood.material as T.MeshStandardMaterial).metalness).toBeGreaterThan(.5);
        expect(creature.material.color.getHexString()).toBe('ff8800');
        // Dressing twice reuses the same island material.
        const dressed = wood.material; skinTheme(root, 'karakuri'); expect(wood.material).toBe(dressed);
        skinTheme(root, undefined);
        expect(wood.material).toBe(original);
        // Islands without their own skin leave things as they are.
        skinTheme(root, 'shiokaze'); expect(wood.material).toBe(original);
    });

    it('leans the light toward the island and puts it back', () => {
        const scene = new T.Scene(), hemi = new T.HemisphereLight('#ffffff', '#888888'), sun = new T.DirectionalLight('#ffffff');
        scene.background = new T.Color('#b4d4e7');
        const back = toneLight('karakuri', 'day', scene, hemi, sun)!;
        expect(sun.color.getHexString()).not.toBe('ffffff');
        back();
        expect(sun.color.getHexString()).toBe('ffffff');
        expect((scene.background as T.Color).getHexString()).toBe('b4d4e7');
        expect(toneLight('kodama', 'day', scene, hemi, sun)).toBeUndefined();
    });
});
