import { expect, it } from 'vitest';
import { Mesh, MeshStandardMaterial, Object3D } from 'three';
import { newLife } from '../../../domain/islandLife/model';
import { replayLife } from '../../../domain/islandLife/simulation';
import { buildLifeScene } from './scene';

it('reserves patchwork for Pokomoko and gives the otter natural fur', () => {
    const state = replayLife(newLife('identity', 1));
    const scene = buildLifeScene(state);
    const materials = (actor: Object3D) => {
        const result: MeshStandardMaterial[] = [];
        actor.traverse(node => {
            if (node instanceof Mesh) result.push(...(Array.isArray(node.material) ? node.material : [node.material]));
        });
        return result;
    };
    try {
        const actors = state.residents.map(r => scene.root.getObjectByName(`life-resident-${r.id}`)!);
        expect(actors).toHaveLength(3);
        expect(actors.every(Boolean)).toBe(true);
        expect(materials(actors[0]).some(m => m.map)).toBe(true);
        expect(materials(actors[2]).every(m => !m.map)).toBe(true);
        const colors = materials(actors[2]).map(m => m.color.getHexString());
        expect(colors).toContain('b38154');
        expect(colors).toContain('fff0d4');
        expect(actors[2].userData.visualCandidate).toBe('natural-otter-v1');
    } finally { scene.dispose(); }
});
