import { expect, it } from 'vitest';
import { newIsland } from '../../../domain/growingIsland/island';
import { IslandMaterials } from '../three/primitives';
import { sceneLayout } from './sceneLayout';
import { buildObjectLayer } from './objectLayer';

it('renders small v0.4 places with their actual owner identities and no imaginary gallery', () => {
    const state = newIsland('small-v04-scene', 0);
    state.landmarks = [
        { id: 'wood', kind: 'sapling', cell: { x: 5, z: 1 }, growth: 18, maturedAt: 0 },
        { id: 'bloom', kind: 'flower', cell: { x: 0, z: 3 }, growth: 6 },
        { id: 'source', kind: 'water-bowl', cell: { x: 5, z: 4 }, growth: 0 },
    ];
    const before = structuredClone(state), material = new IslandMaterials('moon-garden');
    const layer = buildObjectLayer(material, state, sceneLayout(state));
    try {
        for (const id of ['wood', 'bloom', 'source']) expect(layer.objects.has(id)).toBe(true);
        expect(layer.places.filter(p => p.stage === 'grown').map(p => p.ruleId)).toEqual(expect.arrayContaining(['P01', 'P03', 'P05']));
        expect(layer.placeRoot.getObjectByName('place-physical-gallery')).toBeUndefined();
        expect(layer.placeRoot.getObjectByName('place-flower-canopy')).toBeUndefined();
        expect(state).toEqual(before);
    } finally { layer.dispose(); material.dispose(); }
});
