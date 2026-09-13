import { Group, Mesh, MeshStandardMaterial } from 'three';
import { roundedBoxGeometry } from '../three/geometry';
import { disposeGeometry, IslandMaterials } from '../three/primitives';
import { makeScenery, makeStarTree } from '../three/scenery';
import { createIslandRoofSurface, ISLAND_ROOF_SURFACE_CANDIDATE } from '../three/roofSurface';

/** Borrow the world's paints; own only the equipped legacy roof surface. */
class HeritageHouseMaterials extends IslandMaterials {
    private readonly roof = createIslandRoofSurface('legacy-v1:moon-garden:houseRoof')!;
    constructor(private readonly shared: IslandMaterials) { super(shared.artDirection); }
    override surface(color: string, roughness: number, metalness = 0, glow = false) {
        return this.roof.surface(color, roughness, metalness, glow)
            ?? this.shared.surface(color, roughness, metalness, glow);
    }
    override dispose() { this.roof.dispose(); super.dispose(); }
}

/**
 * Reuse the original moon-garden cottage, including its equipped warm tile roof,
 * arched amber door, pink trims, side window and flower box. The caller owns
 * world materials and applies the existing Life house scale (.8) and position.
 * Dispose this factory's roof pool when the scene is torn down.
 */
export function buildHeritageHouse(materials: IslandMaterials, vivid = false) {
    const houseMaterials = new HeritageHouseMaterials(materials);
    // The legacy cottage factory is private. Extract its named shell through
    // the public scenery builder without constructing the old island terrain.
    const scenery = makeScenery(houseMaterials, undefined, { terrain: false });
    const shell = scenery.getObjectByName('island-home-shell');
    if (!(shell instanceof Group)) {
        disposeGeometry(scenery);
        houseMaterials.dispose();
        throw new Error('Heritage cottage shell is missing');
    }
    const tileMaterials: MeshStandardMaterial[] = [];
    if (vivid) {
        shell.traverse(object => {
            if (object instanceof Mesh && !Array.isArray(object.material)
                && object.material.name.startsWith(ISLAND_ROOF_SURFACE_CANDIDATE)) object.visible = false;
        });
        tileMaterials.push(...['#f5c431', '#e767aa', '#299bc5'].map(color => new MeshStandardMaterial({ color, roughness: .38 })));
        const tiles = new Group(); tiles.name = 'life-canopy-roof'; shell.add(tiles);
        for (const side of [-1, 1]) for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
            const x = side * (.23 + row * .39), y = 2.36 - Math.abs(x) * .769;
            const tile = new Mesh(roundedBoxGeometry([.54, .12, .65], .065, 3), tileMaterials[(col + row + (side === 1 ? 1 : 0)) % 3]);
            tile.position.set(x, y, (col - 1) * .65); tile.rotation.z = -side * Math.atan(.769);
            tile.castShadow = tile.receiveShadow = true; tiles.add(tile);
        }
    }
    shell.removeFromParent();
    disposeGeometry(scenery);
    scenery.clear();
    const house = new Group();
    house.name = 'home';
    // Original door center (-.18, .77) -> Life door center (0, .27).
    // Keep the inhabited footprint behind the same walk-up point.
    shell.position.set(.18, 0, -.5);
    house.add(shell);
    house.userData.visualSource = 'moon-garden-cottage';
    house.userData.roofSurfaceCandidate = vivid ? 'canopy-c3-rounded-tiles-v1' : ISLAND_ROOF_SURFACE_CANDIDATE;
    return { root: house, dispose: () => { tileMaterials.forEach(material => material.dispose()); houseMaterials.dispose(); } };
}

/** The original rooted, lobed canopy and hanging stars, in local coordinates. */
export function buildHeritageTree(materials: IslandMaterials): Group {
    const tree = makeStarTree(materials);
    tree.position.set(0, 0, 0);
    tree.name = 'life-heritage-tree';
    tree.userData.visualSource = 'moon-garden-star-tree';
    return tree;
}
