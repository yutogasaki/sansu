import * as THREE from 'three';
import { batch, box, curve, cylinder, disposeGeometry, ellipsoid, IslandMaterials, pole, star } from './primitives';
import { makeFlowers } from './furniture';
import { applyTreeGrowth } from './scenery';
import type { IslandStageItem, IslandStageState } from './types';

export function growthAppearance(item: IslandStageItem) {
    const earned = Math.max(0, Math.min(3, Math.floor(item.growthLevel ?? 0)));
    return Math.max(0, Math.min(earned, Math.floor(item.appearanceLevel ?? earned)));
}

function leaves(group: THREE.Group, m: IslandMaterials, x: number, y: number, z: number, count: number, size = .07) {
    for (let i = 0; i < count; i++) {
        const angle = i * 2.4;
        const leaf = ellipsoid(group, m.get(i % 2 ? '#76a85b' : '#4d8c50'),
            [x + Math.cos(angle) * size * .42, y + i * .025, z + Math.sin(angle) * size * .42], [size, .018, size * .42], 8);
        leaf.rotation.y = angle;
    }
}

function smallFlowers(group: THREE.Group, m: IslandMaterials, x: number, y: number, z: number, size: number) {
    const flowers = makeFlowers(m, 2); flowers.position.set(x, y, z); flowers.scale.setScalar(size); group.add(flowers);
}

/** Additional detail lives inside the saved footprint. Seats, roots, poles and
 * use/light anchors never move when an item grows or an older appearance is selected. */
export function applyFurnitureGrowth(group: THREE.Group, item: IslandStageItem, m: IslandMaterials, progress = 0) {
    const level = growthAppearance(item), enabled = item.growthLevel !== undefined;
    const intermediate = Math.max(0, Math.min(2, progress - (level === 3 ? 6 : level === 2 ? 3 : level === 1 ? 1 : 0)));
    const key = enabled ? `${level}:${item.appearanceLevel === undefined ? intermediate : 0}` : 'legacy';
    if (group.userData.growthVisualKey === key) return false;
    group.userData.growthVisualKey = key;
    const old = group.getObjectByName('growth-details');
    if (old) { old.removeFromParent(); disposeGeometry(old); }
    if (item.kind === 'flower') for (const name of ['furniture-static', 'flower-leaves', 'flower-blooms']) {
        const part = group.children.find(child => child.name === name);
        if (part) part.visible = !enabled;
    }
    if (!enabled) return true;
    const detail = new THREE.Group(); detail.name = 'growth-details';
    detail.userData.level = level; group.add(detail);
    const leaf = m.get('#5f9251'), pale = m.get('#efcf94'), pink = m.get('#f39482');
    if (item.kind === 'flower') {
        const height = [.26, .52, .79, 1.08][level];
        group.userData.growthFlowerHeight = height;
        leaves(detail, m, 0, .04, 0, 4, level >= 2 ? .16 : .11);
        pole(detail, leaf, [0, .04, 0], [0, height, 0], level >= 2 ? .028 : .022);
        if (level === 0) {
            ellipsoid(detail, pink, [0, height, 0], [.065, .09, .065], 12);
        }
        if (level >= 1) {
            for (const side of [-1, 1]) {
                const blade = ellipsoid(detail, leaf, [side * .085, height * .43, 0], [.125, .035, .055], 12);
                blade.rotation.z = side * .4;
            }
            const bloom = new THREE.Group(); bloom.name = 'growth-blooms'; bloom.position.y = height; detail.add(bloom);
            const count = level === 3 ? 8 : 5, orbit = [.0, .067, .102, .132][level], petal = [.0, .085, .12, .157][level];
            for (let i = 0; i < count; i++) {
                const a = i * Math.PI * 2 / count;
                const petalShape = ellipsoid(bloom, m.get(level === 1 ? '#f39482' : '#fff0c0'),
                    [Math.cos(a) * orbit, Math.sin(a * 2) * .012, Math.sin(a) * orbit], [petal, .043, petal * .55], 14);
                petalShape.rotation.y = -a;
            }
            ellipsoid(bloom, m.get('#d99635'), [0, .035, 0], [.058 + level * .017, .037, .058 + level * .017], 14);
            if (level === 3) for (let i = 0; i < 8; i++) {
                const a = i * Math.PI / 4;
                ellipsoid(bloom, pale, [Math.cos(a) * .135, .06, Math.sin(a) * .135], [.073, .027, .046], 12).rotation.y = -a;
            }
            batch(bloom, m.painted);
        }
        if (level >= 2) {
            pole(detail, leaf, [0, height * .35, 0], [-.14, height * .68, -.04], .018);
            ellipsoid(detail, pink, [-.14, height * .7, -.04], [.06, .08, .06], 12);
        }
    } else if (item.kind === 'bench') {
        if (level >= 1) {
            curve(detail, leaf, [[-.45, .98, -.26], [0, .91, -.27], [.45, .98, -.26]], .02);
            leaves(detail, m, -.3, .97, -.26, 3, .045);
        }
        if (level >= 2) {
            // An embroidered back cloth leaves the physical seat completely clear.
            box(detail, m.get('#e4b275'), [0, .82, -.169], [.36, .26, .018]);
            star(detail, pale, [0, .84, -.15], .068);
        }
        if (level >= 3) {
            smallFlowers(detail, m, -.46, .9, -.19, .38);
            smallFlowers(detail, m, .46, .9, -.19, .36);
        }
    } else if (item.kind === 'lantern') {
        if (level >= 1) {
            curve(detail, leaf, [[-.13, .12, -.05], [-.015, .42, -.06], [-.12, .7, -.06], [-.03, 1.04, -.02]], .019);
            leaves(detail, m, -.09, .43, .01, 3, .061);
        }
        if (level >= 2) {
            pole(detail, pale, [-.14, 1.18, 0], [-.2, .91, 0], .011);
            star(detail, m.get('#ffe39a', true), [-.2, .85, .015], .068);
        }
        if (level >= 3) {
            smallFlowers(detail, m, -.18, .08, -.09, .36);
            leaves(detail, m, .12, 1.21, 0, 4, .067);
        }
    } else if (item.kind === 'swing') {
        if (level >= 1) for (const x of [-.66, .66]) {
            curve(detail, leaf, [[x, .2, .1], [x - .04, .7, .12], [x, 1.4, .03]], .018);
            leaves(detail, m, x, .74, .08, 3, .043);
        }
        if (level >= 2) {
            curve(detail, leaf, [[-.6, 1.65, 0], [0, 1.62, 0], [.6, 1.65, 0]], .025);
            for (const x of [-.5, .5]) smallFlowers(detail, m, x, 1.62, 0, .34);
        }
        if (level >= 3) for (const x of [-.22, 0, .22]) {
            pole(detail, pale, [x, 1.59, -.025], [x, 1.37, -.025], .012);
            star(detail, pale, [x, 1.35, -.025], .052);
        }
    } else if (item.kind === 'mushroom') {
        if (level >= 1) for (const x of [-.36, .36]) leaves(detail, m, x, .035, -.08, 4, .075);
        if (level >= 2) for (const [x, z] of [[-.36, -.3], [.38, -.24]]) {
            cylinder(detail, pale, [x, .1, z], .045, .2);
            ellipsoid(detail, pink, [x, .21, z], [.11, .058, .11], 10);
        }
        if (level >= 3) {
            smallFlowers(detail, m, -.12, .015, -.42, .35);
            curve(detail, leaf, [[-.41, .035, -.24], [0, .06, -.48], [.4, .045, -.24]], .025);
        }
    } else if (item.kind === 'fountain') {
        if (level >= 1) for (const [x, z] of [[-.32, .22], [.35, -.18]]) {
            const lily = ellipsoid(detail, leaf, [x, .31, z], [.11, .008, .075], 12); lily.rotation.y = x * 3;
        }
        if (level >= 2) {
            for (const [x, z] of [[-.35, -.24], [-.4, -.17], [-.28, -.34]]) {
                pole(detail, leaf, [x, .31, z], [x - .04, .65, z], .013);
                ellipsoid(detail, pale, [x - .04, .65, z], [.026, .067, .026], 8);
            }
            smallFlowers(detail, m, .36, .3, .22, .22);
        }
        if (level >= 3) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(.45, .011, 5, 32), m.get('#c0eee1'));
            ring.rotation.x = -Math.PI / 2; ring.position.y = .314; detail.add(ring);
            ellipsoid(detail, m.get('#f5be69'), [.1, .3, .34], [.075, .018, .029], 10);
        }
    }
    // Intermediate earned sections leave small permanent buds, with no extra possessions.
    if (item.appearanceLevel === undefined) for (let i = 0; i < intermediate; i++) {
        ellipsoid(detail, pale, [-.09 + i * .12, .065, -.12], [.03, .053, .03], 8);
    }
    const bloom = detail.getObjectByName('growth-blooms'); bloom?.removeFromParent();
    batch(detail, m.painted);
    if (bloom) detail.add(bloom);
    detail.traverse(child => { child.userData.itemId = item.id; });
    return true;
}

function habitatAppearance(state: IslandStageState, habitat: 'grove' | 'village') {
    const progress = state.growth?.progress[habitat] ?? 0;
    const level = progress >= 6 ? 3 : progress >= 3 ? 2 : progress >= 1 ? 1 : 0;
    const item = state.items.find(candidate => candidate.habitatId === habitat && candidate.appearanceLevel !== undefined);
    return item ? Math.min(level, growthAppearance(item)) : level;
}

/** Fixed scenery grows in place as well, rather than multiplying buildings.
 * Structure stays inside existing reserved ground; upper foliage can overhang. */
export function applySceneryGrowth(group: THREE.Group, state: IslandStageState, m: IslandMaterials,
    trees?: { main?: THREE.Group; west?: THREE.Group }) {
    const treeLevel = habitatAppearance(state, 'grove'), houseLevel = habitatAppearance(state, 'village');
    if (trees?.main) applyTreeGrowth(trees.main, state.growth ? treeLevel : undefined);
    if (trees?.west) applyTreeGrowth(trees.west, state.growth ? treeLevel : undefined);
    const key = `${Boolean(state.growth)}:${treeLevel}:${houseLevel}:${state.completedSets >= 12}`;
    if (group.userData.growthVisualKey === key) return false;
    group.userData.growthVisualKey = key;
    for (const child of [...group.children]) { child.removeFromParent(); disposeGeometry(child); }
    if (!state.growth) return true;
    const tree = new THREE.Group(); tree.name = 'grown-tree'; tree.position.set(1.6, 0, -1.6);
    const house = new THREE.Group(); house.name = 'grown-house'; house.position.set(-2.6, 0, -1.65);
    group.add(tree, house);
    if (treeLevel >= 1) {
        for (const x of [-.7, .72]) ellipsoid(tree, m.get('#76a84d'), [x, 2.28, -.2], [.55, .3, .43], 14);
        leaves(tree, m, .33, .07, -.24, 4, .16);
    }
    if (treeLevel >= 2) {
        for (const [x, z] of [[-1, .48], [.94, .4]]) ellipsoid(tree, m.get('#67994a'), [x, 2.65, z], [.62, .38, .54], 16);
        for (const x of [-.5, .65]) {
            pole(tree, m.get('#b49b64'), [x, 2.42, .38], [x, 1.78, .38], .013);
            star(tree, m.get('#ffe093', true), [x, 1.71, .38], .085);
        }
    }
    if (treeLevel >= 3) {
        ellipsoid(tree, m.get('#86b557'), [.05, 3.65, -.4], [.78, .35, .58], 16);
        for (const x of [-.75, .75]) smallFlowers(tree, m, x, 2.48, .62, .46);
    }
    if (houseLevel >= 1) {
        for (const x of [-.61, .55]) {
            cylinder(house, m.get('#ba7b49'), [x, .18, .72], .13, .25, .16);
            smallFlowers(house, m, x, .31, .72, .47);
        }
        const canopy = box(house, m.get('#e8c47e'), [-.15, 1.2, .92], [1.32, .08, .48]); canopy.rotation.x = -.14;
    }
    if (houseLevel >= 2) {
        // A shallow porch and awning enrich the existing foundation, without new obstacles.
        box(house, m.get('#e4b275'), [0, .045, .78], [1.35, .08, .29]);
        const awning = box(house, m.get('#f4d794'), [-.1, 1.46, .97], [1.75, .12, .6]); awning.rotation.x = -.18;
        for (const x of [-.5, .42]) pole(house, m.get('#ba7b49'), [x, .08, .94], [x, 1.42, .94], .046);
    }
    if (houseLevel >= 3) {
        // One attached roof room and a broad veranda make the same cottage
        // visibly mature. Keep the original patchwork roof exposed; the small
        // dormer extends its pink/yellow paint instead of replacing the roof.
        box(house, m.get('#f7e8c6'), [.4, 2.05, .62], [.6, .68, .56]);
        const roofLeft = box(house, m.get('#f39482'), [.22, 2.45, .65], [.45, .085, .73]); roofLeft.rotation.z = .45;
        const roofRight = box(house, m.get('#dc7c62'), [.6, 2.45, .65], [.45, .085, .73]); roofRight.rotation.z = -.45;
        box(house, m.get('#e4b275'), [.4, 2.13, .912], [.38, .4, .025]);
        box(house, m.get('#80b5b5'), [.4, 2.13, .93], [.26, .29, .018]);
        box(house, m.get('#efcf94'), [.4, 2.13, .946], [.035, .29, .017]);
        box(house, m.get('#efcf94'), [.4, 2.13, .946], [.26, .035, .017]);
        curve(house, m.get('#b49b64'), [[-.75, 1.32, 1.08], [-.15, 1.23, 1.08], [.45, 1.32, 1.08]], .018);
        for (const x of [-.5, -.15, .2]) star(house, m.get('#ffe093', true), [x, 1.23, 1.1], .054);
        leaves(house, m, -.79, .82, .81, 5, .14);
        leaves(house, m, .5, 1.38, .88, 4, .1);
    }
    batch(tree, m.painted); batch(house, m.painted);
    if (state.completedSets >= 12) {
        const westTree = tree.clone(true); westTree.name = 'grown-west-tree';
        westTree.position.set(-6.7, 0, -1.2); westTree.scale.setScalar(.65); group.add(westTree);
    }
    return true;
}

/** One natural visitor at a time, attached to the visited object. The earned
 * behavior is independent of the chosen old appearance. */
export class IslandNatureVisuals {
    readonly group = new THREE.Group();
    private readonly butterfly = new THREE.Group();
    private readonly wings: THREE.Group[] = [];
    private readonly boat = new THREE.Group();
    constructor(m: IslandMaterials) {
        this.group.name = 'island-nature';
        ellipsoid(this.butterfly, m.get('#735b42'), [0, 0, 0], [.017, .055, .017], 8);
        for (const side of [-1, 1]) {
            const wing = new THREE.Group();
            ellipsoid(wing, m.get('#f2bb74'), [side * .064, .023, 0], [.077, .061, .012], 10);
            ellipsoid(wing, m.get('#efcf94'), [side * .052, -.032, .004], [.055, .044, .01], 10);
            this.wings.push(wing); this.butterfly.add(wing);
        }
        const leaf = ellipsoid(this.boat, m.get('#76a85b'), [0, 0, 0], [.12, .021, .058], 12);
        leaf.rotation.y = .25;
        pole(this.boat, m.get('#b49b64'), [0, .01, 0], [0, .17, 0], .008);
        const sail = ellipsoid(this.boat, m.get('#fff0c0'), [.04, .115, 0], [.045, .06, .007], 8); sail.rotation.z = -.2;
        this.group.add(this.butterfly, this.boat); this.clear();
    }
    clear() { this.group.visible = false; this.butterfly.visible = false; this.boat.visible = false; }
    update(kind: 'butterfly' | 'boat', source: THREE.Group, elapsed: number, reduced: boolean) {
        this.group.visible = true; this.butterfly.visible = kind === 'butterfly'; this.boat.visible = kind === 'boat';
        source.updateWorldMatrix(true, false);
        const phase = reduced ? .8 : Math.min(1, elapsed / 4200), turn = phase * Math.PI * 2;
        const local = kind === 'butterfly'
            ? new THREE.Vector3(Math.sin(turn) * .17, (source.userData.growthFlowerHeight ?? .52) + .14 + Math.sin(phase * Math.PI) * .2, Math.cos(turn) * .14)
            : new THREE.Vector3(Math.sin(turn) * .32, .327, Math.cos(turn) * .32);
        const object = kind === 'butterfly' ? this.butterfly : this.boat;
        object.position.copy(source.localToWorld(local));
        object.rotation.y = kind === 'boat' ? turn + source.rotation.y : .3;
        this.wings.forEach((wing, i) => { wing.rotation.y = (i ? 1 : -1) * (reduced ? .35 : .3 + Math.sin(elapsed / 110) * .55); });
        return !reduced && phase < 1;
    }
    dispose() { disposeGeometry(this.group); }
}
