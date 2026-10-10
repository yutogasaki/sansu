import * as T from 'three';
import { connectedWaterChannels } from '../../../domain/islandLife/waterChannels';
import { waterLayout } from '../../../domain/growingIsland/environment';
import { key, walkableCells } from '../../../domain/growingIsland/space';
import type { Cell, GrowingState, Landmark } from '../../../domain/growingIsland/types';
import type { DerivedPlace } from '../../../domain/growingIsland/placeTypes';
import { GardenGeometry, type V3 } from '../three/garden/geometry';
import type { SceneLayout } from './sceneLayout';
import { buildPlacePond } from './placePondGeometry';

type WaterOwner = Landmark & { cell: Cell; kind: 'water-bowl' | 'water-channel' };
const SEGMENTS = 48;
const tuple = (point: T.Vector3): V3 => [point.x, point.y, point.z];
const hash = (id: string) => [...id].reduce((seed, letter) => Math.imul(seed ^ letter.charCodeAt(0), 16_777_619) >>> 0, 2_166_136_261);

function contour(radius: number, angle: number, seed: number) {
    const phase = seed % 997 / 997 * Math.PI * 2;
    // Broad inward coves change the silhouette while the outer limit stays fixed.
    const organic = .92 + .06 * Math.sin(angle * 3 + phase) + .018 * Math.cos(angle * 5 - phase);
    return { x: Math.cos(angle) * radius * organic, z: Math.sin(angle) * radius * organic };
}

/** A shallow stone hollow rests on the real ground. Only supplied inlets lower the lip. */
function basinGeometry(seed: number, ground: (cell: Cell) => number, inlets: Cell[]) {
    const profile = [[.31, -.027], [.405, -.015], [.445, -.006], [.46, -.01], [.479, .145], [.485, .085], [.480, -.040], [.350, -.040]];
    const vertices: number[] = [0, -.027, 0], indices: number[] = [];
    for (const [ring, [radius, height]] of profile.entries()) for (let i = 0; i < SEGMENTS; i++) {
        const point = contour(radius, i / SEGMENTS * Math.PI * 2, seed);
        const length = Math.hypot(point.x, point.z);
        const inlet = Math.max(0, ...inlets.map(direction => T.MathUtils.smoothstep((point.x * direction.x + point.z * direction.z) / length, .5, .8)));
        const rim = ring === 4 || ring === 5 ? T.MathUtils.lerp(height, -.013, inlet) : height;
        vertices.push(point.x, ground(point) + rim, point.z);
    }
    const bottom = vertices.length / 3; vertices.push(0, -.040, 0);
    for (let i = 0; i < SEGMENTS; i++) {
        const next = (i + 1) % SEGMENTS;
        indices.push(0, 1 + next, 1 + i);
        for (let ring = 0; ring < profile.length - 1; ring++) {
            const a = 1 + ring * SEGMENTS + i, an = 1 + ring * SEGMENTS + next, b = a + SEGMENTS, bn = an + SEGMENTS;
            indices.push(a, an, b, b, an, bn);
        }
        const last = 1 + (profile.length - 1) * SEGMENTS;
        indices.push(last + i, last + next, bottom);
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function basinWater(seed: number, ground: (cell: Cell) => number, radius = .46) {
    const vertices: number[] = [0, 0, 0], indices: number[] = [];
    for (let i = 0; i < SEGMENTS; i++) {
        const point = contour(radius, i / SEGMENTS * Math.PI * 2, seed);
        vertices.push(point.x, ground(point), point.z);
        indices.push(0, 1 + (i + 1) % SEGMENTS, 1 + i);
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

/** Its upper face is the same shared floor as the actor, above shallow water by 1cm. */
function crossingGeometry(ground: (cell: Cell) => number) {
    const segments = 24, vertices: number[] = [0, 0, 0], indices: number[] = [];
    const rings = [[.215, 0], [.23, -.006], [.22, -.023]];
    for (const [radius, y] of rings) for (let i = 0; i < segments; i++) {
        const angle = i / segments * Math.PI * 2, cell = { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
        vertices.push(cell.x, ground(cell) + y, cell.z);
    }
    const bottom = vertices.length / 3; vertices.push(0, -.023, 0);
    for (let i = 0; i < segments; i++) {
        const next = (i + 1) % segments; indices.push(0, 1 + next, 1 + i);
        for (let ring = 0; ring < rings.length - 1; ring++) {
            const a = 1 + ring * segments + i, an = 1 + ring * segments + next, b = a + segments, bn = an + segments;
            indices.push(a, an, b, b, an, bn);
        }
        const last = 1 + (rings.length - 1) * segments; indices.push(last + i, last + next, bottom);
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function ownerGroup(g: GardenGeometry, item: WaterOwner, name: string) {
    const group = new T.Group(); group.name = name;
    group.userData.ownerId = item.id; group.userData.objectId = item.id; group.userData.cell = { ...item.cell };
    g.root.add(group); return group;
}

/** Mature owned water becomes wide stone pools and supplied streams; no simulation state changes. */
export function buildPlaceSpring(g: GardenGeometry, state: GrowingState, layout: SceneLayout, place: DerivedPlace, allPlaces: readonly DerivedPlace[] = [place]): void {
    const ids = new Set([...place.mainIds, ...place.waterRefs]), reached = connectedWaterChannels(waterLayout(state));
    const water = state.landmarks.filter((item): item is WaterOwner => ids.has(item.id) && Boolean(item.cell)
        && (item.kind === 'water-bowl' || item.kind === 'water-channel' && reached.has(key(item.cell!))))
        .sort((a, b) => a.id.localeCompare(b.id));
    const bowls = water.filter(item => item.kind === 'water-bowl');
    const grown = place.stage === 'grown' || place.stage === 'lived';
    if (!grown) {
        for (const item of bowls) {
            const group = ownerGroup(g, item, 'place-owned-basin'); group.position.copy(layout.point(item.cell));
            const pebble = g.pebble('#93a9d7', [0, .025, 0], [.4, .04, .4], group); pebble.name = 'place-young-basin';
        }
        return;
    }
    buildPlacePond(g, state, layout, place, allPlaces);
    const waterMaterial = new T.MeshPhysicalMaterial({ color: '#429cbb', roughness: .16, metalness: .05,
        transparent: true, opacity: .86, clearcoat: .9, clearcoatRoughness: .12, side: T.DoubleSide });
    const source = [...bowls].sort((a, b) => layout.heightAt(b.cell) - layout.heightAt(a.cell) || a.id.localeCompare(b.id))[0];
    for (const item of bowls) {
        const group = ownerGroup(g, item, 'place-owned-basin'), seed = hash(item.id);
        group.position.copy(layout.point(item.cell)); group.userData.source = item.id === source?.id;
        const ground = (cell: Cell) => layout.heightAt({ x: item.cell.x + cell.x, z: item.cell.z + cell.z }) - layout.heightAt(item.cell);
        const inlets = water.filter(other => other.id !== item.id && Math.abs(other.cell.x - item.cell.x) + Math.abs(other.cell.z - item.cell.z) === 1)
            .map(other => ({ x: other.cell.x - item.cell.x, z: other.cell.z - item.cell.z }));
        group.userData.inlets = inlets;
        g.mesh(basinGeometry(seed, ground, inlets), g.paint('#9eacc7', .94), [0, 0, 0], group).name = 'place-stone-basin';
        g.mesh(basinWater(seed, ground, .38), g.paint('#356c97', .58), [0, -.025, 0], group).name = 'place-basin-bottom';
        g.mesh(basinWater(seed, ground), waterMaterial, [0, -.01, 0], group).name = 'place-connected-water';
        // Thin incomplete ripples keep broad water legible without filling it with props.
        for (let ring = 0; ring < 2; ring++) {
            const points: V3[] = [], radius = [.24, .34][ring];
            for (let i = 0; i <= 12; i++) {
                const angle = .35 + ring * .85 + i / 12 * Math.PI * 1.05, cell = { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
                points.push([cell.x, ground(cell) - .008, cell.z]);
            }
            g.branch(points, .0022, '#c5edf0', group).name = 'place-water-ripple';
        }
        const count = item.id === source?.id ? 2 : 4;
        for (let i = 0; i < count; i++) {
            const a = seed % 13 * .17 + i * 1.71, radius = .416, cell = { x: Math.cos(a) * radius, z: Math.sin(a) * radius };
            const stone = g.pebble(i % 2 ? '#c1c8d8' : '#93a7bf', [cell.x, ground(cell) + .020 + i % 2 * .01, cell.z],
                [.039, .020, .033], group, 10); stone.rotation.y = a; stone.name = 'place-basin-pebble';
        }
        if (item.id !== source?.id) continue;
        // Only the highest source gets the crystal silhouette. Other pools retain
        // their wide, quiet water instead of repeating a three-spike ornament.
        for (let i = 0; i < 3; i++) {
            const angle = 3.35 + i * .34, height = [.36, .62, .44][i], cell = { x: Math.cos(angle) * .25, z: Math.sin(angle) * .25 };
            const crystal = g.mesh(new T.CylinderGeometry(0, [.075, .105, .085][i], height, 5),
                g.paint(['#aa9ddd', '#8176c2', '#c0a8e6'][i], .3),
                [cell.x, ground(cell) - .006 + height / 2, cell.z], group);
            crystal.rotation.set(.07, i * .7, -.09 + i * .07); crystal.name = 'place-source-crystal';
        }
    }
    const open = walkableCells(state);
    let shallowsMaterial: T.MeshPhysicalMaterial | undefined;
    for (const item of water) {
        if (item.kind !== 'water-channel' || !open.has(key(item.cell))) continue;
        const group = ownerGroup(g, item, 'place-channel-crossing'); group.position.copy(layout.point(item.cell));
        const ground = (cell: Cell) => layout.heightAt({ x: item.cell.x + cell.x, z: item.cell.z + cell.z }) - layout.heightAt(item.cell);
        // A walkable water tile becomes a broad, shallow inlet between the real
        // basins. It is still one centimetre below the original actor/stone floor.
        shallowsMaterial ??= waterMaterial.clone();
        shallowsMaterial.polygonOffset = true; shallowsMaterial.polygonOffsetFactor = -1; shallowsMaterial.polygonOffsetUnits = -1;
        g.mesh(basinWater(hash(item.id), ground), shallowsMaterial, [0, -.01, 0], group).name = 'place-channel-shallows';
        g.mesh(crossingGeometry(ground), g.paint('#c3d0d2', .94), [0, 0, 0], group).name = 'place-shallow-stepping-stone';
    }
    for (let i = 0; i < water.length; i++) for (let j = i + 1; j < water.length; j++) {
        const left = water[i], right = water[j];
        if (Math.abs(left.cell.x - right.cell.x) + Math.abs(left.cell.z - right.cell.z) !== 1) continue;
        const high = layout.heightAt(left.cell) >= layout.heightAt(right.cell) ? left : right, low = high === left ? right : left;
        const direction = new T.Vector3(low.cell.x - high.cell.x, 0, low.cell.z - high.cell.z);
        const normal = new T.Vector3(direction.z, 0, -direction.x), phase = hash(`${high.id}:${low.id}`) % 2 ? 1 : -1;
        const vertices: number[] = [], indices: number[] = [], banks: [V3[], V3[]] = [[], []];
        const group = ownerGroup(g, left.kind === 'water-channel' ? left : right, 'place-owned-stream');
        group.userData.waterOwners = [high.id, low.id];
        for (let step = 0; step <= 16; step++) {
            const t = step / 16, wave = Math.sin(Math.PI * t) * .045 * phase, halfWidth = .35 + .04 * Math.sin(Math.PI * t) ** 2;
            const center = { x: high.cell.x + direction.x * t + normal.x * wave, z: high.cell.z + direction.z * t + normal.z * wave };
            for (const [sideIndex, side] of [-1, 1].entries()) {
                const cell = { x: center.x + normal.x * halfWidth * side, z: center.z + normal.z * halfWidth * side };
                const point = layout.point(cell, .03); vertices.push(point.x, point.y, point.z);
                const bankCell = { x: center.x + normal.x * (halfWidth + .024) * side, z: center.z + normal.z * (halfWidth + .024) * side };
                banks[sideIndex].push(tuple(layout.point(bankCell, .045)));
            }
            if (step < 16) { const a = step * 2; indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
        }
        const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices); geometry.computeVertexNormals();
        const stream = g.mesh(geometry, waterMaterial, [0, 0, 0], group);
        stream.name = layout.heightAt(high.cell) - layout.heightAt(low.cell) > .10 ? 'place-descending-stream' : 'place-supplied-stream';
        for (const points of banks) g.branch(points, .012, '#b3c3d4', group).name = 'place-stream-rock-bank';
    }
}
