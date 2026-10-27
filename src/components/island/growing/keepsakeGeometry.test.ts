import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { IslandMaterials } from '../three/primitives';
import { buildSpecies } from './keepsakeGeometry';

describe('island species', () => {
    it('gives every creature a face with shining eyes', () => {
        const m = new IslandMaterials();
        for (const id of ['leaf-crab', 'echo-bird', 'fluff-sheep', 'clock-bird', 'star-jelly', 'glow-shell'] as const) {
            const model = buildSpecies(m, id), shines: T.Mesh[] = [];
            model.traverse(o => { if (o instanceof T.Mesh && o.material instanceof T.MeshBasicMaterial) shines.push(o); });
            expect(shines, id).toHaveLength(2);
            expect(model.userData.species).toBe(id);
        }
    });
});
