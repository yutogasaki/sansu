import * as THREE from 'three';
import { batch, box, curve, cylinder, disposeGeometry, ellipsoid, IslandMaterials, pole, star } from './primitives';
import { makeFlowers } from './furniture';
import { applyTreeGrowth } from './scenery';
import { appearanceBlossom } from './appearanceMotifs';
import { ScenerySlotBuild } from './appearanceParts';
import type { IslandAppearanceSlotId } from '../../../domain/island/appearance';
import { getIslandExpansionLevel } from '../../../domain/island/expansion';
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

function blossom(group: THREE.Group, m: IslandMaterials, x: number, y: number, z: number, radius: number, color: string) {
    if (appearanceBlossom(group, m, x, y, z, radius, color)) return;
    for (let i = 0; i < 7; i++) {
        const angle = i * Math.PI * 2 / 7;
        const petal = ellipsoid(group, m.get(color),
            [x + Math.cos(angle) * radius * .53, y, z + Math.sin(angle) * radius * .53],
            [radius * .47, radius * .22, radius * .32], 12);
        petal.rotation.y = -angle;
    }
    ellipsoid(group, m.get('#d99635'), [x, y + radius * .19, z], [radius * .3, radius * .2, radius * .3], 12);
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
        const height = [.26, .64, 1.02, 1.43][level];
        group.userData.growthFlowerHeight = height;
        leaves(detail, m, 0, .04, 0, 4, level >= 2 ? .16 : .11);
        pole(detail, leaf, [0, .04, 0], [0, height, 0], level >= 2 ? .036 : .025);
        if (level === 0) {
            ellipsoid(detail, pink, [0, height, 0], [.065, .09, .065], 12);
        }
        if (level >= 1) {
            for (const side of [-1, 1]) {
                const blade = ellipsoid(detail, leaf, [side * .085, height * .43, 0], [.125, .035, .055], 12);
                blade.rotation.z = side * .4;
            }
            const bloom = new THREE.Group(); bloom.name = 'growth-blooms'; bloom.position.y = height; detail.add(bloom);
            blossom(bloom, m, 0, 0, 0, [.0, .17, .235, .3][level], level === 1 ? '#f39482' : '#fff0c0');
            if (level >= 2) {
                const branches = level === 3
                    ? [[-.19, .93, -.02], [.18, 1.08, .05], [-.11, .57, .15], [.13, .72, -.15]]
                    : [[-.17, .64, .025]];
                for (const [x, y, z] of branches) {
                    curve(detail, leaf, [[0, .15, 0], [x * .45, y * .6, z * .55], [x, y, z]], .025);
                    blossom(bloom, m, x, y - height, z, level === 3 ? .125 : .11, '#f39482');
                    const blade = ellipsoid(detail, m.get('#76a85b'), [x * .7, y * .55, z], [.13, .047, .065], 12);
                    blade.rotation.z = x < 0 ? -.5 : .5;
                }
            }
            batch(bloom, m.painted);
        }
    } else if (item.kind === 'bench') {
        if (level >= 1) {
            curve(detail, leaf, [[-.45, .98, -.26], [0, .91, -.27], [.45, .98, -.26]], .02);
            leaves(detail, m, -.3, .97, -.26, 3, .045);
        }
        if (level >= 2) {
            // An embroidered back cloth leaves the physical seat completely clear.
            box(detail, m.get('#e4b275'), [0, .82, -.169], [.83, .29, .018]);
            star(detail, pale, [0, .84, -.15], .105);
            curve(detail, leaf, [[-.54, .85, -.24], [-.48, 1.3, -.24], [0, 1.58, -.24], [.48, 1.3, -.24], [.54, .85, -.24]], .033);
        }
        if (level >= 3) {
            for (const [x, y] of [[-.44, 1.25], [-.25, 1.49], [0, 1.61], [.25, 1.49], [.44, 1.25]]) {
                ellipsoid(detail, m.get('#76a84d'), [x, y, -.24], [.12, .13, .1], 12);
                blossom(detail, m, x, y + .04, -.21, .09, x === 0 ? '#fff0c0' : '#f39482');
            }
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
            curve(detail, leaf, [[-.64, 1.52, 0], [-.5, 1.93, 0], [0, 2.09, 0], [.5, 1.93, 0], [.64, 1.52, 0]], .055);
            for (const x of [-.5, .5]) leaves(detail, m, x, 1.78, 0, 4, .11);
        }
        if (level >= 3) {
            for (const [x, y] of [[-.54, 1.91], [-.3, 2.11], [0, 2.18], [.3, 2.11], [.54, 1.91]]) {
                ellipsoid(detail, m.get('#76a84d'), [x, y, 0], [.21, .18, .22], 12);
                blossom(detail, m, x, y + .13, .07, .13, x === 0 ? '#fff0c0' : '#f39482');
            }
            for (const x of [-.28, 0, .28]) {
                pole(detail, pale, [x, 2.02, -.025], [x, 1.79, -.025], .013);
                star(detail, pale, [x, 1.74, -.025], .073);
            }
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
        if (level >= 1) {
            const water = m.surface('#b3efde', .2, .04, true), height = [0, .91, 1.25, 1.64][level];
            curve(detail, water, [[0, .63, 0], [.04, height * .81, 0], [0, height, 0]], .055);
            ellipsoid(detail, water, [0, height, 0], [.085, .12, .085], 12);
            const count = level === 3 ? 6 : level === 2 ? 4 : 2;
            for (let i = 0; i < count; i++) {
                const a = i * Math.PI * 2 / count, x = Math.cos(a), z = Math.sin(a), reach = .33 + level * .035;
                curve(detail, water, [[0, height - .1, 0], [x * reach * .6, height - .05, z * reach * .6],
                    [x * reach, .48, z * reach]], .022 + level * .004);
            }
            for (const [x, z] of [[-.32, .22], [.35, -.18], ...(level === 3 ? [[-.24, -.31], [.3, .28]] : [])]) {
                const lily = ellipsoid(detail, leaf, [x, .323, z], [level >= 2 ? .18 : .13, .013, level >= 2 ? .13 : .085], 12);
                lily.rotation.y = x * 3;
            }
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
            blossom(detail, m, -.3, .36, .2, .13, '#f39482');
            blossom(detail, m, .32, .36, -.2, .12, '#fff0c0');
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
    trees?: { main?: THREE.Group; west?: THREE.Group }, slot?: IslandAppearanceSlotId) {
    const treeLevel = habitatAppearance(state, 'grove'), houseLevel = habitatAppearance(state, 'village');
    if (trees?.main) applyTreeGrowth(trees.main, state.growth ? treeLevel : undefined);
    if (trees?.west) applyTreeGrowth(trees.west, state.growth ? treeLevel : undefined);
    const western = getIslandExpansionLevel(state) >= 2;
    const key = `${Boolean(state.growth)}:${treeLevel}:${houseLevel}:${western}`;
    if (group.userData.growthVisualKey === key) return false;
    group.userData.growthVisualKey = key;
    const retired = new THREE.Group();
    for (const child of [...group.children]) retired.add(child);
    disposeGeometry(retired);
    if (!state.growth) return true;
    const treeBuild = new ScenerySlotBuild(slot), houseBuild = new ScenerySlotBuild(slot);
    treeBuild.group.name = 'grown-tree'; treeBuild.group.position.set(1.6, 0, -1.6);
    houseBuild.group.name = 'grown-house'; houseBuild.group.position.set(-2.6, 0, -1.65);
    const tree = treeBuild.part('tree'); let house = houseBuild.part('houseBody');
    group.add(treeBuild.group, houseBuild.group);
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
            smallFlowers(houseBuild.part('flower'), m, x, .31, .72, .47);
        }
        house = houseBuild.part('houseRoof');
        const canopyHeight = [0, 1.2, 1.46, 1.75][houseLevel];
        const canopy = box(house, m.get(houseLevel === 3 ? '#dc7c62' : '#e8c47e'), [-.1, canopyHeight, .97],
            [[0, 0, 0], [1.32, .08, .48], [1.75, .12, .6], [2.15, .14, .8]][houseLevel] as [number, number, number]);
        canopy.rotation.x = -.14;
        if (houseLevel === 3) for (const x of [-.92, -.51, -.1, .31, .72]) {
            box(house, m.get('#f39482'), [x, 1.735, 1.32], [.21, .18, .095]);
        }
    }
    if (houseLevel >= 2) {
        house = houseBuild.part('houseBody');
        // A shallow porch and awning enrich the existing foundation, without new obstacles.
        box(house, m.get('#e4b275'), [0, .045, .78], [1.35, .08, .29]);
        for (const x of [-.5, .42]) pole(house, m.get('#ba7b49'), [x, .08, .94], [x, houseLevel === 3 ? 1.71 : 1.42, .94], .046);
    }
    if (houseLevel >= 3) {
        house = houseBuild.part('houseBody');
        // One attached roof room and a broad veranda make the same cottage
        // visibly mature. The tall front dormer adds a new roof silhouette;
        // the original broad patchwork planes remain exposed behind it.
        box(house, m.get('#f7e8c6'), [.38, 2.37, .62], [.94, 1.02, .68]);
        house = houseBuild.part('houseRoof');
        const roofLeft = box(house, m.get('#f39482'), [.08, 2.95, .65], [.69, .1, .87]); roofLeft.rotation.z = .45;
        const roofRight = box(house, m.get('#dc7c62'), [.68, 2.95, .65], [.69, .1, .87]); roofRight.rotation.z = -.45;
        house = houseBuild.part('houseWindows');
        box(house, m.get('#e4b275'), [.38, 2.43, .976], [.63, .63, .025]);
        box(house, m.get('#80b5b5'), [.38, 2.43, .995], [.48, .48, .018]);
        box(house, m.get('#efcf94'), [.38, 2.43, 1.01], [.045, .48, .017]);
        box(house, m.get('#efcf94'), [.38, 2.43, 1.01], [.48, .045, .017]);
        house = houseBuild.part('houseBody');
        curve(house, m.get('#b49b64'), [[-.81, 1.66, 1.34], [-.1, 1.51, 1.34], [.61, 1.66, 1.34]], .023);
        for (const x of [-.56, -.1, .36]) star(house, m.get('#ffe093', true), [x, 1.5, 1.36], .087);
        leaves(house, m, -.79, .82, .81, 5, .14);
        leaves(house, m, .62, 1.62, .96, 4, .14);
    }
    treeBuild.finish(false); houseBuild.finish(false);
    batch(treeBuild.group, m.painted); batch(houseBuild.group, m.painted);
    if (western) {
        const westTree = treeBuild.group.clone(true); westTree.name = 'grown-west-tree';
        westTree.position.set(-6.7, 0, -1.2); westTree.scale.setScalar(.65); group.add(westTree);
    }
    return true;
}

export { IslandNatureVisuals } from './natureVisuals';
