import { Group } from 'three';
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
export function buildHeritageHouse(materials: IslandMaterials) {
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
    house.userData.roofSurfaceCandidate = ISLAND_ROOF_SURFACE_CANDIDATE;
    return { root: house, dispose: () => houseMaterials.dispose() };
}

/** The original rooted, lobed canopy and hanging stars, in local coordinates. */
export function buildHeritageTree(materials: IslandMaterials): Group {
    const tree = makeStarTree(materials);
    tree.position.set(0, 0, 0);
    tree.name = 'life-heritage-tree';
    tree.userData.visualSource = 'moon-garden-star-tree';
    return tree;
}
