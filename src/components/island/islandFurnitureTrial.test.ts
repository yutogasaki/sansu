import { describe, expect, it } from 'vitest';
import { createIsland, isValidIslandPlacement } from '../../domain/island/catalog';
import { getIslandCustomization } from '../../domain/island/customization';
import { ISLAND_FURNITURE_CATALOG, reduceIslandFurniture } from '../../domain/island/furniture';
import { islandFurnitureTrial } from './islandFurnitureTrial';

describe('unowned furniture trial placement', () => {
    it.each(ISLAND_FURNITURE_CATALOG)('offers a legal $kind model without granting, placing, or spending', ({ kind, itemId }) => {
        const island = createIsland('child', 1), before = structuredClone(island), trial = islandFurnitureTrial(island, kind);
        expect(trial?.id).toBe(itemId); expect(trial?.position).toBeDefined();
        expect(isValidIslandPlacement({ ...island, items: [...island.items, trial!] }, itemId, trial!.position!, trial!.rotation)).toBe(true);
        expect(island).toEqual(before);
    });
    it('uses owned storage as storage and does not create a second placed preview', () => {
        const island = createIsland('child', 1); island.customization = { ...getIslandCustomization(island), points: 30 };
        const owned = reduceIslandFurniture(island, { type: 'acquire-furniture', kind: 'telescope' }), before = structuredClone(owned);
        expect(islandFurnitureTrial(owned, 'telescope')).toBeUndefined(); expect(owned).toEqual(before);
        expect(owned.items.find(item => item.id === 'optional-telescope')?.position).toBeUndefined();
    });
    it('leaves a fully occupied old island untouched when no valid trial space exists', () => {
        const island = createIsland('child', 1);
        // Deliberately crowded legacy layout: the helper must never move or remove
        // existing possessions to manufacture space for a not-yet-owned product.
        for (let x = -5; x <= 5; x += .5) for (let z = -4; z <= 4; z += .5)
            island.items.push({ id: `old-${x}-${z}`, kind: 'bench', position: { x, z }, rotation: 0 });
        const before = structuredClone(island);
        expect(islandFurnitureTrial(island, 'tea-table')).toBeUndefined(); expect(island).toEqual(before);
    });
});
