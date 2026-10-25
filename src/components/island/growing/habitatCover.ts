import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terracePlanOf } from '../../../domain/growingIsland/editableTerrainWorld';
import { occupiedCells } from '../../../domain/islandLife/footprint';
import type { ItemKind } from '../../../domain/islandLife/model';
import { HOUSE_CELLS } from '../../../domain/growingIsland/space';
import { BLOOM_HOURS, TREE_MATURE_HOURS } from '../../../domain/growingIsland/environment';
import { OWN_LANDMARKS, type Cell, type GrowingState } from '../../../domain/growingIsland/types';
import type { SceneLayout } from './sceneLayout';
import { colored, hash, project, rock, tuft } from './terraceGround';

// Low ground life grown from what the child placed: understory under trees, reeds and
// stones by water, little flowers around flower beds and along homes. It is scenery,
// never owned: no floor, hit or route, no trees or crowns that fake a forest, and it
// keeps off owners, the home, the pier, stairs and the shared paths.
/** Colour index that stays valid for the negative cell coordinates of western land. */
const pick = <T,>(list: readonly T[], n: number) => list[((Math.floor(n) % list.length) + list.length) % list.length];
const PETALS = ['#f4b7c9', '#c9b4e8', '#fff2c4', '#f7cfa2'].map(c => new T.Color(c));
const FERN = ['#5f8f5a', '#6f9e62', '#4f7f58'].map(c => new T.Color(c));
const ROSETTE = ['#3f7a6c', '#4d8a74'].map(c => new T.Color(c));
const REED = new T.Color('#6aa08e'), IRIS = new T.Color('#9b8ae0'), CAP = new T.Color('#e9d9c0'), DOT = new T.Color('#e88b7c');

function fern(x: number, y: number, z: number, size: number, seed: number) {
    const out: T.BufferGeometry[] = [];
    for (let j = 0; j < 7; j++) {
        // A broad, arching frond: a flattened lozenge tipped outward from the crown.
        const leaf = new T.SphereGeometry(.06 * size, 5, 3); leaf.scale(.55, .12, 2.6);
        leaf.translate(0, .05 * size, .15 * size); leaf.rotateX(-.35 - hash(x, z, seed + j) * .3);
        leaf.rotateY(j * Math.PI * 2 / 7 + seed); leaf.translate(x, y, z);
        out.push(colored(leaf, pick(FERN, seed + j))); leaf.dispose();
    }
    return out;
}
/** The adopted art's grouped broad leaves: a low, round rosette of dark teal leaves. */
function rosette(x: number, y: number, z: number, size: number, seed: number) {
    const out: T.BufferGeometry[] = [];
    for (let j = 0; j < 6; j++) {
        const leaf = new T.SphereGeometry(.07 * size, 6, 4); leaf.scale(1.25, .32, 1.6);
        leaf.translate(0, .03 * size, .07 * size); leaf.rotateX(-.25); leaf.rotateY(j * Math.PI / 3 + seed * .7); leaf.translate(x, y, z);
        out.push(colored(leaf, pick(ROSETTE, seed + j))); leaf.dispose();
    }
    return out;
}
function reeds(x: number, y: number, z: number, seed: number) {
    const out: T.BufferGeometry[] = [];
    for (let j = 0; j < 4; j++) {
        const h = .28 + hash(x, z, seed + j) * .22, blade = new T.ConeGeometry(.016, h, 3, 1);
        blade.translate(0, h / 2, 0); blade.rotateZ((j - 1.5) * .12); blade.translate(x + (j - 1.5) * .035, y, z + (j % 2) * .03);
        out.push(colored(blade, REED)); blade.dispose();
    }
    if (hash(x, z, seed + 9) > .5) {
        const bloom = new T.SphereGeometry(.035, 6, 4); bloom.scale(1, 1.4, 1); bloom.translate(x, y + .4, z);
        out.push(colored(bloom, IRIS)); bloom.dispose();
    }
    return out;
}
function flowers(x: number, y: number, z: number, seed: number, count = 9) {
    const out: T.BufferGeometry[] = [];
    for (let j = 0; j < count; j++) {
        const a = hash(x, z, seed + j) * Math.PI * 2, r = .04 + hash(x, z, seed + j + 4) * .14, h = .09 + hash(x, z, seed + j + 8) * .1;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        const stem = new T.ConeGeometry(.008, h, 3, 1); stem.translate(px, y + h / 2, pz);
        const head = new T.SphereGeometry(.045, 6, 4); head.scale(1, .6, 1); head.translate(px, y + h, pz);
        out.push(colored(stem, FERN[0]), colored(head, pick(PETALS, seed + j))); stem.dispose(); head.dispose();
    }
    return out;
}
const CROWN = ['#4f9a86', '#5fa98f', '#6fb39a', '#8cc49a'].map(c => new T.Color(c)), BARK = new T.Color('#8a6a52');
/** A young tree the child grew by tending a grove: short trunk, two soft stacked crowns. */
function youngTree(x: number, y: number, z: number, size: number, seed: number) {
    const trunk = new T.CylinderGeometry(.03 * size, .045 * size, .32 * size, 6); trunk.translate(x, y + .16 * size, z);
    const low = new T.SphereGeometry(.2 * size, 8, 6); low.scale(1, .8, 1); low.translate(x, y + .38 * size, z);
    const high = new T.SphereGeometry(.14 * size, 8, 6); high.translate(x + .03 * size, y + .55 * size, z - .02 * size);
    const out = [colored(trunk, BARK), colored(low, pick(CROWN, seed)), colored(high, pick(CROWN, seed + 1))];
    trunk.dispose(); low.dispose(); high.dispose(); return out;
}
function mushroom(x: number, y: number, z: number) {
    const stem = new T.CylinderGeometry(.018, .024, .07, 6); stem.translate(x, y + .035, z);
    const cap = new T.SphereGeometry(.05, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2); cap.translate(x, y + .065, z);
    const out = [colored(stem, CAP), colored(cap, DOT)]; stem.dispose(); cap.dispose(); return out;
}

export function buildHabitatCover(state: GrowingState, layout: SceneLayout, pathEdges: readonly [Cell, Cell][] = []) {
    const plan = terracePlanOf(layout.world);
    if (!plan) return undefined;
    const ownerCells: Cell[] = [...HOUSE_CELLS];
    // How grown each anchor is (0..1) and how long it has been grown (0..1): ground life
    // starts small around a new owner and spreads as it matures, so the island fills in
    // through play rather than arriving as a finished picture.
    const anchors: { cell: Cell; kind: 'tree' | 'water' | 'flower' | 'home'; grown: number; spread: number; tended?: number }[] = [];
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v)), hours = state.nature.hours;
    for (const owner of state.landmarks) if (owner.cell) {
        const cells = OWN_LANDMARKS.includes(owner.kind) ? [owner.cell] : occupiedCells({ kind: owner.kind as ItemKind, cell: owner.cell });
        ownerCells.push(...cells);
        const kind = owner.kind === 'sapling' ? 'tree' : owner.kind === 'water-bowl' || owner.kind === 'water-channel' ? 'water' : owner.kind === 'flower' || owner.kind === 'planter' ? 'flower' : undefined;
        if (!kind) continue;
        const grown = kind === 'tree' ? clamp01(owner.growth / TREE_MATURE_HOURS) : kind === 'flower' ? clamp01(owner.growth / BLOOM_HOURS) : 1;
        const spread = kind === 'tree' && owner.maturedAt !== undefined ? clamp01((hours - owner.maturedAt) / 72) : 0;
        anchors.push({ cell: owner.cell, kind, grown, spread, tended: owner.tended });
    }
    for (const plot of state.plots) if (plot.cell) {
        ownerCells.push(plot.cell);
        const kind = plot.kind === 'wild' ? 'flower' : plot.kind === 'home' ? 'home' : plot.style === 'tree' ? 'tree' : plot.style === 'flower' ? 'flower' : plot.style === 'water' ? 'water' : 'home';
        const grown = plot.kind === 'wild' ? clamp01(plot.growth / BLOOM_HOURS) : plot.kind === 'home' ? clamp01(plot.stage / 3) : clamp01(plot.stage);
        anchors.push({ cell: plot.cell, kind, grown, spread: 0 });
    }
    for (const keepsake of state.keepsakes) if (keepsake.cell) ownerCells.push(keepsake.cell);
    anchors.push({ cell: HOUSE_CELLS[2], kind: 'home', grown: 1, spread: 0 });
    const nearSegment = (p: Cell, a: Cell, b: Cell) => {
        const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
        return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
    };
    const pier = { x: layout.bounds.maxX - 1, z: layout.bounds.depth - 1 };
    const open = (p: Cell, clearance: number) => {
        const cell = `${Math.floor(p.x + .5)},${Math.floor(p.z + .5)}`;
        if (!plan.dry.has(cell) || plan.occupied.has(cell)) return false;
        if (ownerCells.some(o => Math.abs(p.x - o.x) < .5 + clearance && Math.abs(p.z - o.z) < .5 + clearance)) return false;
        if (Math.hypot(p.x - pier.x, p.z - pier.z) < 1.1) return false;
        if (pathEdges.some(([a, b]) => nearSegment(p, a, b) < .3)) return false;
        // Not on a cliff band or a stair ramp: only on ground that is level here.
        const h = plan.heightAt(p), e = .07;
        return [[e, 0], [-e, 0], [0, e], [0, -e]].every(([dx, dz]) => Math.abs(plan.heightAt({ x: p.x + dx, z: p.z + dz }) - h) < .035);
    };
    const list: T.BufferGeometry[] = [];
    const ring = (anchor: Cell, total: number, inner: number, full: number, salt: number, add: (p: Cell, i: number) => void, grown = 1, spread = 0) => {
        const count = Math.round(total * (.3 + .7 * grown) + total * .6 * spread), outer = inner + (full - inner) * (.45 + .55 * grown) + spread * .9;
        for (let i = 0; i < count; i++) {
            const a = (i + hash(anchor.x, anchor.z, salt + i) * .7) / count * Math.PI * 2, r = inner + hash(anchor.x, anchor.z, salt + i + 20) * (outer - inner);
            const p = { x: anchor.x + Math.cos(a) * r, z: anchor.z + Math.sin(a) * r };
            if (open(p, .02)) add(p, i);
        }
    };
    for (const { cell, kind, grown, spread: grownFor, tended = 0 } of anchors) {
        // Each time the child grows the place, its ground life reaches further.
        const spread = grownFor + tended * .45;
        if (kind === 'tree' && tended) ring(cell, tended * 4, .8, 1.3 + tended * .4, 17, (p, i) => {
            if (open(p, .12)) list.push(...youngTree(p.x, plan.heightAt(p), p.z, 1 + hash(p.x, p.z, 7) * .5, i));
        });
        if (kind === 'tree') ring(cell, 18, .6, 1.9, 11, (p, i) => {
            const h = hash(p.x, p.z, 3), y = plan.heightAt(p);
            list.push(...(h < .4 ? rosette(p.x, y, p.z, 1.3 + h, i) : h < .75 ? fern(p.x, y, p.z, 1.2 + h, i) : h < .85 ? mushroom(p.x, y, p.z) : flowers(p.x, y, p.z, i, 6)));
        }, grown, spread);
        else if (kind === 'water') ring(cell, 9, .5, 1, 23, (p, i) => {
            const h = hash(p.x, p.z, 5), y = plan.heightAt(p);
            list.push(...(h < .5 ? reeds(p.x, y, p.z, i) : h < .75 ? rosette(p.x, y, p.z, 1.1, i) : [rock(p.x, y - .02, p.z, 1 + h, i)]));
        }, grown, spread);
        else if (kind === 'flower') ring(cell, 9, .55, 1.4, 31, (p, i) => list.push(...(i % 3 ? flowers(p.x, plan.heightAt(p), p.z, i + cell.x * 3) : rosette(p.x, plan.heightAt(p), p.z, 1, i))), grown, spread);
        else ring(cell, 7, .55, .95, 41, (p, i) => list.push(...(i % 2 ? flowers(p.x, plan.heightAt(p), p.z, i, 7) : rosette(p.x, plan.heightAt(p), p.z, 1, i))), grown, spread);
    }
    // Sparse meadow drifts keep the open middle readable as the child's canvas.
    for (const id of plan.dry) {
        const [x, z] = id.split(',').map(Number);
        if (hash(x, z, 51) > .08 + .25 * clamp01(hours / 500) || anchors.some(a => Math.abs(a.cell.x - x) + Math.abs(a.cell.z - z) <= 1)) continue;
        for (let j = 0; j < 3; j++) {
            const p = { x: x + (hash(x, z, 60 + j) - .5) * .7, z: z + (hash(x, z, 70 + j) - .5) * .7 };
            if (open(p, .02)) list.push(...(j === 0 ? flowers(p.x, plan.heightAt(p), p.z, x + z + j, 6) : j === 1 ? rosette(p.x, plan.heightAt(p), p.z, .9, j) : tuft(p.x, plan.heightAt(p), p.z, 1, j)));
        }
    }
    if (!list.length) return undefined;
    const merged = mergeGeometries(list)!; list.forEach(g => g.dispose());
    const mesh = new T.Mesh(project(merged, layout), new T.MeshStandardMaterial({ vertexColors: true, roughness: .9 }));
    mesh.name = 'habitat-ground-cover'; mesh.castShadow = mesh.receiveShadow = true; mesh.userData.ownMaterial = true;
    return mesh;
}
