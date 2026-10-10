import * as T from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { GardenGeometry } from '../three/garden/geometry';
import type { GrowingState } from '../../../domain/growingIsland';
import type { DerivedPlace } from '../../../domain/growingIsland/placeTypes';
import { key, onLand, walkableCells } from '../../../domain/growingIsland/space';
import type { SceneLayout } from './sceneLayout';

// Physical standing mesh maxima, including every hat/ear and the fox's tail.
// Sparkles are effects and do not contribute to a body's passage envelope.
export const ROOT_ROOM_ACTOR_HEIGHT = 1.166671391 + .10;
export const ROOT_ROOM_ACTOR_RADIUS = .542376380 + .05;
const CUT_RADIUS = .675, CUT_HEIGHT = 1.38, RESOLUTION = 72;
const roomGeometryCache = new Map<string, T.BufferGeometry>();

function cachedGeometry(signature: string) {
    const source = roomGeometryCache.get(signature);
    if (!source) return undefined;
    roomGeometryCache.delete(signature); roomGeometryCache.set(signature, source);
    // Every world owns its clone: batching and world disposal cannot damage the
    // retained sculpt or another world's actual collision surface.
    return source.clone();
}

function closedCourt(place: DerivedPlace) {
    for (let start = 0; start + 48 < place.walkSurface.length; start++) {
        const loop = place.walkSurface.slice(start, start + 49), first = loop[0], last = loop[48];
        if (Math.hypot(first.x - last.x, first.z - last.z) > 1e-7) continue;
        const center = loop.slice(0, 48).reduce((sum, point) => ({ x: sum.x + point.x / 48, z: sum.z + point.z / 48 }), { x: 0, z: 0 });
        const radius = Math.hypot(first.x - center.x, first.z - center.z);
        if (radius < .45 || radius > .58 || loop.some(point => Math.abs(Math.hypot(point.x - center.x, point.z - center.z) - radius) > 1e-6)) continue;
        return { center, radius, points: loop };
    }
    return undefined;
}

function smoothUnion(a: number, b: number, width: number) {
    const h = Math.max(width - Math.abs(a - b), 0) / width;
    return Math.min(a, b) - h * h * width * .25;
}

function taperedDistance(point: T.Vector3, a: T.Vector3, b: T.Vector3, from: number, to: number) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const t = T.MathUtils.clamp(((point.x - a.x) * dx + (point.y - a.y) * dy + (point.z - a.z) * dz) / (dx * dx + dy * dy + dz * dz), 0, 1);
    return Math.hypot(point.x - a.x - dx * t, point.y - a.y - dy * t, point.z - a.z - dz * t) - T.MathUtils.lerp(from, to, t);
}

function sweptRoute(place: DerivedPlace, layout: SceneLayout) {
    const samples: T.Vector3[] = [], seen = new Set<string>();
    for (let i = 1; i < place.walkSurface.length; i++) {
        const a = layout.floorPoint(place.walkSurface[i - 1]), b = layout.floorPoint(place.walkSurface[i]);
        const steps = Math.max(1, Math.ceil(a.distanceTo(b) / .045));
        for (let step = 0; step <= steps; step++) {
            const point = a.clone().lerp(b, step / steps), id = point.toArray().map(value => value.toFixed(5)).join(',');
            if (!seen.has(id)) { samples.push(point); seen.add(id); }
        }
    }
    return samples;
}

/** One carved living volume: four saved root bases merge into a broad hollow room.
 * The real gallery remains its sole floor; its full actor passage cuts the wood. */
export function buildPlaceRootRoom(g: GardenGeometry, state: GrowingState, layout: SceneLayout, place: DerivedPlace): boolean {
    if (place.ruleId !== 'P02' || place.variant !== 'court' || !['grown', 'lived'].includes(place.stage)) return false;
    const loop = closedCourt(place), open = walkableCells(state);
    const owners = place.mainIds.map(id => state.landmarks.find(item => item.id === id && item.kind === 'sapling' && item.cell));
    if (!loop || owners.length !== 4 || owners.some(owner => !owner?.cell || open.has(key(owner.cell)) || !onLand(state, owner.cell))) return false;
    if (place.walkSurface.some(point => !Number.isFinite(point.y) || !onLand(state, layout.cellAt(layout.floorPoint(point))) || !open.has(key(layout.cellAt(layout.floorPoint(point)))))) return false;
    const center = layout.point(loop.center), radius = 1.46;
    // An excessively wide or displaced ownership arrangement needs its existing
    // open-tree fallback, rather than a room resting on invented ground columns.
    if (owners.some(owner => Math.hypot(owner!.cell!.x - loop.center.x, owner!.cell!.z - loop.center.z) > 1.58)) return false;
    const route = sweptRoute(place, layout);
    const relevant = route.filter(point => Math.hypot(point.x - center.x, point.z - center.z) < radius + CUT_RADIUS);
    if (!relevant.length) return false;
    let groundMaximum = -Infinity;
    for (let z = -.15 - radius; z <= radius + .15; z += .15) for (let x = -.15 - radius; x <= radius + .15; x += .15) {
        if (Math.hypot(x, z) <= radius + .15) groundMaximum = Math.max(groundMaximum, layout.heightAt({ x: loop.center.x + x, z: loop.center.z + z }));
    }
    const mergeY = groundMaximum + ROOT_ROOM_ACTOR_HEIGHT + .16;
    const ceilingY = Math.max(...relevant.map(point => point.y)) + ROOT_ROOM_ACTOR_HEIGHT + .14;
    const crownY = Math.max(ceilingY + .85, mergeY + 2.25), middleY = (mergeY + crownY) / 2, halfHeight = (crownY - mergeY) / 2;
    const roots = owners.map(owner => {
        const base = layout.point(owner!.cell!), toward = center.clone().sub(base).setY(0).normalize();
        // The saved low root stays in its blocked cell. Only its upper shoulder
        // bends inward, joining the living body above the full standing passage.
        const bend = base.clone().addScaledVector(toward, .055); bend.y = mergeY - .23;
        const middle = base.clone().addScaledVector(toward, .19); middle.y = mergeY + .45;
        const shoulder = base.clone().addScaledVector(toward, .42); shoulder.y = middleY + .06;
        const start = base.clone(); start.y += .30;
        return { start, bend, middle, shoulder };
    });
    const windowAngle = .85, windowHeight = .35;
    const windowRadius = radius * Math.sqrt(1 - (windowHeight / halfHeight) ** 2) + .019;
    const window = new T.Vector3(center.x + Math.sin(windowAngle) * windowRadius, middleY + windowHeight, center.z + Math.cos(windowAngle) * windowRadius);
    const innerRadius = loop.radius + CUT_RADIUS + .035;
    const minimumY = Math.min(...roots.map(root => root.start.y - .35));
    const side = Math.max(3.7, crownY - minimumY + .55), half = side / 2;
    const origin = new T.Vector3(center.x, (minimumY + crownY) / 2, center.z);
    const signature = JSON.stringify([layout.key, layout.center, center.toArray(), mergeY, crownY,
        roots.map(root => [root.start.toArray(), root.bend.toArray(), root.middle.toArray(), root.shoulder.toArray()]), route.map(point => point.toArray())]);
    const material = g.paint('#ffffff', .91); material.vertexColors = true;
    let geometry = cachedGeometry(signature);
    if (!geometry) {
        const cubes = new MarchingCubes(RESOLUTION, material, false, false, 60_000); cubes.isolation = 0;
        const point = new T.Vector3();
        for (let z = 0; z < RESOLUTION; z++) for (let y = 0; y < RESOLUTION; y++) for (let x = 0; x < RESOLUTION; x++) {
            point.set(origin.x + (x / RESOLUTION * 2 - 1) * half, origin.y + (y / RESOLUTION * 2 - 1) * half, origin.z + (z / RESOLUTION * 2 - 1) * half);
            const dx = point.x - center.x, dz = point.z - center.z;
            let wood = (Math.hypot(dx / radius, (point.y - middleY) / halfHeight, dz / radius) - 1) * Math.min(radius, halfHeight);
            for (const root of roots) {
                const leg = Math.min(taperedDistance(point, root.start, root.bend, .34, .27),
                    taperedDistance(point, root.bend, root.middle, .27, .30), taperedDistance(point, root.middle, root.shoulder, .30, .48));
                wood = smoothUnion(wood, leg, .16);
            }
            // The central cavity is open below the body. It never supplies a plane
            // masquerading as the real boards beneath an actor's soles.
            const hollow = Math.max(Math.hypot(dx, dz) - innerRadius, point.y - ceilingY);
            wood = Math.max(wood, -hollow);
            for (const sample of route) {
                if (point.y < sample.y - .15 || point.y > sample.y + CUT_HEIGHT + .1) continue;
                const cut = Math.max(Math.hypot(point.x - sample.x, point.z - sample.z) - CUT_RADIUS, sample.y - .09 - point.y, point.y - sample.y - CUT_HEIGHT);
                wood = Math.max(wood, -cut);
            }
            cubes.field[x + y * RESOLUTION + z * RESOLUTION * RESOLUTION] = -wood;
        }
        cubes.update();
        const count = cubes.geometry.drawRange.count;
        if (!Number.isFinite(count) || count < 3 || count >= 180_000) { cubes.geometry.dispose(); return false; }
        geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.Float32BufferAttribute(cubes.geometry.getAttribute('position').array.slice(0, count * 3), 3));
        geometry.setAttribute('normal', new T.Float32BufferAttribute(cubes.geometry.getAttribute('normal').array.slice(0, count * 3), 3));
        geometry.scale(half, half, half); geometry.translate(origin.x, origin.y, origin.z);
        const positions = geometry.getAttribute('position'), colors = new Float32Array(positions.count * 3);
        const amber = new T.Color('#c39350'), grain = new T.Color('#a9743a'), shade = new T.Color();
        for (let i = 0; i < positions.count; i++) {
            const angle = Math.atan2(positions.getZ(i) - center.z, positions.getX(i) - center.x), y = positions.getY(i);
            const stripe = Math.max(0, Math.sin(angle * 17 + Math.sin(y * 1.3) * .65)) ** 8;
            shade.copy(amber).lerp(grain, stripe * .42);
            colors[i * 3] = shade.r; colors[i * 3 + 1] = shade.g; colors[i * 3 + 2] = shade.b;
        }
        geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
        geometry.normalizeNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere(); cubes.geometry.dispose();
        roomGeometryCache.set(signature, geometry.clone());
        if (roomGeometryCache.size > 4) {
            const oldest = roomGeometryCache.keys().next().value!;
            roomGeometryCache.get(oldest)!.dispose(); roomGeometryCache.delete(oldest);
        }
    }
    const group = new T.Group(); group.name = 'place-root-room';
    const floorConnectionAnchors = owners.map(owner => {
        const base = layout.point(owner!.cell!), direction = base.clone().sub(center).setY(0).normalize();
        const actual = loop.points.reduce((nearest, point) => {
            const a = new T.Vector3(point.x - loop.center.x, 0, point.z - loop.center.z).normalize();
            const b = new T.Vector3(nearest.x - loop.center.x, 0, nearest.z - loop.center.z).normalize();
            return a.dot(direction) > b.dot(direction) ? point : nearest;
        });
        const to = layout.floorPoint(actual).addScaledVector(direction, .21); to.y -= .055;
        const from = base.addScaledVector(direction, -.18); from.y = to.y;
        return { ownerId: owner!.id, from: { x: from.x, y: from.y, z: from.z }, to: { x: to.x, y: to.y, z: to.z } };
    });
    group.userData = { courtCenter: { ...loop.center }, crownY, supportOwnerIds: owners.map(owner => owner!.id),
        actorHeight: ROOT_ROOM_ACTOR_HEIGHT, actorRadius: ROOT_ROOM_ACTOR_RADIUS, floorRoute: place.walkSurface,
        rootCells: owners.map(owner => ({ ...owner!.cell! })), mergeY, ownerId: place.anchorId, floorConnectionAnchors };
    const wood = new T.Group(); wood.name = 'place-living-root-room'; group.add(wood);
    const parts = Array.from({ length: 5 }, () => ({ positions: [] as number[], normals: [] as number[], colors: [] as number[] }));
    const sourcePositions = geometry.getAttribute('position'), sourceNormals = geometry.getAttribute('normal'), sourceColors = geometry.getAttribute('color');
    // Split ownership at real triangle boundaries. This leaves the same closed
    // continuous wood surface while each original root remains directly selectable.
    for (let i = 0; i < sourcePositions.count; i += 3) {
        const x = (sourcePositions.getX(i) + sourcePositions.getX(i + 1) + sourcePositions.getX(i + 2)) / 3;
        const y = (sourcePositions.getY(i) + sourcePositions.getY(i + 1) + sourcePositions.getY(i + 2)) / 3;
        const z = (sourcePositions.getZ(i) + sourcePositions.getZ(i + 1) + sourcePositions.getZ(i + 2)) / 3;
        let part = 0;
        if (y < mergeY) {
            let nearest = Infinity;
            for (let owner = 0; owner < roots.length; owner++) {
                const distance = Math.hypot(x - roots[owner].start.x, z - roots[owner].start.z);
                if (distance < nearest) { nearest = distance; part = owner + 1; }
            }
        }
        for (let offset = 0; offset < 3; offset++) {
            const vertex = i + offset;
            parts[part].positions.push(sourcePositions.getX(vertex), sourcePositions.getY(vertex), sourcePositions.getZ(vertex));
            parts[part].normals.push(sourceNormals.getX(vertex), sourceNormals.getY(vertex), sourceNormals.getZ(vertex));
            parts[part].colors.push(sourceColors.getX(vertex), sourceColors.getY(vertex), sourceColors.getZ(vertex));
        }
    }
    geometry.dispose();
    for (const [i, part] of parts.entries()) {
        if (!part.positions.length) continue;
        const piece = new T.BufferGeometry(); piece.setAttribute('position', new T.Float32BufferAttribute(part.positions, 3));
        piece.setAttribute('normal', new T.Float32BufferAttribute(part.normals, 3)); piece.setAttribute('color', new T.Float32BufferAttribute(part.colors, 3));
        piece.computeBoundingBox(); piece.computeBoundingSphere();
        const parent = i ? new T.Group() : wood;
        if (i) { parent.name = 'place-owned-tree'; parent.userData.ownerId = owners[i - 1]!.id; wood.add(parent); }
        const surface = g.mesh(piece, material, [0, 0, 0], parent); surface.name = i ? 'place-owned-root-surface' : 'place-root-room-shell';
        surface.userData.objectId = i ? owners[i - 1]!.id : place.anchorId;
    }
    // One offset blue pane belongs to the curved outer wood skin. It does not
    // carve two eye-like holes or change the actual hollow passage below it.
    const pane = g.pebble('#93c4d2', window.toArray() as [number, number, number], [.115, .17, .029], group, 16);
    pane.rotation.y = windowAngle; pane.rotation.x = -.34; pane.name = 'place-root-room-small-window';
    const rim = g.mesh(new T.TorusGeometry(.14, .022, 8, 32), g.paint('#d8b16d'), window.toArray() as [number, number, number], group);
    rim.scale.y = 1.35; rim.rotation.set(-.34, windowAngle, 0); rim.name = 'place-root-room-window-rim';
    g.root.add(group);
    return true;
}
