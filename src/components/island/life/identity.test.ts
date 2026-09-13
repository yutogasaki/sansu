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

it('keeps every resident mesh, fabric, transform and walking pose identical across C3 and legacy scenery', () => {
    const state = replayLife(newLife('identity-worlds', 1));
    const legacy = buildLifeScene(state), canopy = buildLifeScene({ ...state, worldStyle: 'canopy-dots-c3-v1' });
    const signature = (actor: Object3D) => {
        const nodes: unknown[] = [];
        actor.traverse(node => {
            nodes.push({ name: node.name, position: node.position.toArray(), quaternion: node.quaternion.toArray(), scale: node.scale.toArray(),
                ...(node instanceof Mesh ? { vertices: Array.from(node.geometry.getAttribute('position').array),
                    materials: (Array.isArray(node.material) ? node.material : [node.material]).map((m: MeshStandardMaterial) => ({ color: m.color.toArray(), roughness: m.roughness,
                        map: m.map?.name, mapData: m.map?.image?.data ? Array.from(m.map.image.data as Uint8Array) : undefined })) } : {}) });
        });
        return nodes;
    };
    try {
        expect(legacy.root.userData.worldStyle).toBe('moon-garden-v1');
        expect(canopy.root.userData.worldStyle).toBe('canopy-dots-c3-v1');
        expect(legacy.clickables.map(o => o.userData.cell)).toEqual(canopy.clickables.map(o => o.userData.cell));
        for (const at of [1, 1800, 6000]) {
            legacy.animate(at, false); canopy.animate(at, false);
            expect(canopy.audit()).toEqual(legacy.audit());
            for (const resident of state.residents) {
                const name = `life-resident-${resident.id}`;
                expect(signature(canopy.root.getObjectByName(name)!)).toEqual(signature(legacy.root.getObjectByName(name)!));
            }
        }
    } finally { legacy.dispose(); canopy.dispose(); }
});
