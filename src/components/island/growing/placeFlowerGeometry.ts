import * as T from 'three';
import { GardenGeometry, type V3 } from '../three/garden/geometry';
import type { Cell, GrowingState } from '../../../domain/growingIsland';
import type { DerivedPlace } from '../../../domain/growingIsland/placeTypes';
import { key, occupant, walkableCells } from '../../../domain/growingIsland/space';
import type { SceneLayout } from './sceneLayout';
import { placeLeafGeometry } from './placeLeafGeometry';

const PETALS = ['#e9a0c7', '#ae9de1', '#91cbd8', '#f1ca90'];
const TINTS: Record<string, string> = { red: '#e69bbf', pink: '#efafcc', yellow: '#efd09b', orange: '#edb29a', blue: '#99bddf',
    purple: '#ad9add', sky: '#9ecfdf', white: '#ece9ef', cream: '#eadbba', mint: '#a4d2c7', wonder: '#b3ace4' };
const ACTOR_CLEARANCE = 1.166671391 + .10;
const tuple = (point: T.Vector3): V3 => [point.x, point.y, point.z];

/** Ground colour belongs to the same open floor, never a raised garden platform. */
function gardenFloor(g: GardenGeometry, state: GrowingState, layout: SceneLayout, place: DerivedPlace, cells: Cell[]) {
    const open = walkableCells(state), vertices: number[] = [], indices: number[] = [];
    const doors = new Set(state.plots.filter(plot => plot.kind === 'home' && plot.cell).map(plot => key({ x: plot.cell!.x, z: plot.cell!.z + 1 })));
    const colored: Cell[] = [];
    for (const cell of place.footprint) {
        if (!open.has(key(cell)) || occupant(state, cell) || doors.has(key(cell))
            || !cells.some(owner => Math.hypot(owner.x - cell.x, owner.z - cell.z) <= 1.45)) continue;
        colored.push(cell);
        for (let z = 0; z < 4; z++) for (let x = 0; x < 4; x++) {
            const start = vertices.length / 3;
            for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
                const p = layout.point({ x: cell.x - .46 + (x + dx) * .23, z: cell.z - .46 + (z + dz) * .23 }, .004);
                vertices.push(...tuple(p));
            }
            indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
        }
    }
    if (!indices.length) return;
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const material = g.paint('#d7d1e3', .96); material.polygonOffset = true; material.polygonOffsetFactor = -1; material.polygonOffsetUnits = -1;
    const floor = g.mesh(geometry, material); floor.name = 'place-flower-garden-inlay'; floor.castShadow = false;
    floor.userData.openCells = colored; floor.userData.floorOffset = .004;
}

function petal(g: GardenGeometry, center: T.Vector3, length: number, angle: number, color: string, layer: number, parent: T.Group) {
    const mesh = g.mesh(placeLeafGeometry(), g.paint(color, .83), tuple(center), parent);
    // Closed, rounded sections make a thick curled blade, with a second blossom
    // layer rising behind it. All blades grow from the shared flower centre.
    mesh.scale.set(length * (layer ? .92 : 1.07), length * (layer ? .82 : .70), length);
    mesh.rotation.y = angle; mesh.name = 'place-curled-flower-petal'; mesh.userData.blossomLayer = layer;
    return mesh;
}

/** Same four plants grow one supported flower room; no extra owned flowers or floor. */
export function buildPlaceFlowerRoof(g: GardenGeometry, state: GrowingState, layout: SceneLayout, place: DerivedPlace) {
    const owners = place.mainIds.map(id => state.landmarks.find(owner => owner.id === id && owner.kind === 'flower' && owner.cell))
        .filter((owner): owner is NonNullable<typeof owner> => Boolean(owner));
    if (!owners.length) return;
    const cells = owners.map(owner => owner.cell!), points = cells.map(cell => layout.point(cell));
    const grown = place.stage === 'grown' || place.stage === 'lived';
    if (!grown) {
        for (const [i, point] of points.entries()) {
            const group = new T.Group(); group.name = 'place-owned-flower'; group.userData.ownerId = owners[i].id; g.root.add(group);
            g.taperedBranch([tuple(point), tuple(point.clone().add(new T.Vector3(.015, .13, 0)))], .018, .012, '#73af9c', group);
        }
        return;
    }
    const center = points.reduce((sum, point) => sum.add(point), new T.Vector3()).multiplyScalar(1 / points.length);
    const radius = Math.max(1.45, ...points.map(point => Math.hypot(point.x - center.x, point.z - center.z) + .24));
    // Sample the complete petal extent: hills under a drooping tip require the
    // same ear/hat clearance as the middle of the real entrance.
    let maxGround = center.y - .04;
    for (let z = -radius - .15; z <= radius + .15; z += .15) for (let x = -radius - .15; x <= radius + .15; x += .15) {
        maxGround = Math.max(maxGround, layout.heightAt({ x: center.x + layout.center + x, z: center.z + 2 + z }));
    }
    const roofY = maxGround + .04 + ACTOR_CLEARANCE + radius * .36 + .16;
    const roofCenter = new T.Vector3(center.x, roofY, center.z);
    const roof = new T.Group(); roof.name = 'place-flower-canopy'; roof.userData.ownerIds = owners.map(owner => owner.id);
    roof.userData.actorClearance = ACTOR_CLEARANCE; roof.userData.roofCenter = tuple(roofCenter); g.root.add(roof);
    for (const [i, point] of points.entries()) {
        const group = new T.Group(); group.name = 'place-owned-flower'; group.userData.ownerId = owners[i].id; g.root.add(group);
        const stemTop = point.clone(); stemTop.y = maxGround + .04 + ACTOR_CLEARANCE + .13;
        g.taperedBranch([tuple(point), tuple(point.clone().lerp(stemTop, .55).add(new T.Vector3(.035, 0, 0))), tuple(stemTop)], .055, .045, '#69a891', group)
            .name = 'place-flower-owner-stem';
        g.branch([tuple(stemTop), tuple(stemTop.clone().lerp(roofCenter, .5).add(new T.Vector3(0, .10, 0))), tuple(roofCenter)], .035, '#83bca6', roof)
            .name = 'place-flower-high-support';
    }
    if (place.variant === 'arch') {
        // A row remains a sequence of linked blossoms, with openings between its
        // owner stems, rather than forcing every arrangement into a round canopy.
        for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
            const a = cells[i], b = cells[j];
            if (Math.abs(a.x - b.x) + Math.abs(a.z - b.z) > 2 || (a.x !== b.x && a.z !== b.z)) continue;
            const middle = points[i].clone().lerp(points[j], .5); middle.y = roofY;
            for (let n = 0; n < 4; n++) petal(g, middle, .86, n * Math.PI / 2 + .35, TINTS[owners[(i + n) % owners.length].color ?? ''] ?? PETALS[n], 0, roof);
            g.pebble('#eccda3', [middle.x, middle.y + .10, middle.z], [.23, .12, .23], roof, 20).name = 'place-flower-centre';
        }
    } else {
        for (let layer = 0; layer < 2; layer++) for (let i = 0; i < 6; i++) {
            const color = TINTS[owners[i % owners.length].color ?? ''] ?? PETALS[i % PETALS.length];
            const at = roofCenter.clone().add(new T.Vector3(0, layer * .18, 0));
            petal(g, at, radius * (layer ? .68 : 1), i * Math.PI / 3 + layer * Math.PI / 6, color, layer, roof);
        }
        // The low pollen bowl seals the visual centre while leaving the whole
        // standing space below it open. It is a roof, never a walkable platform.
        g.pebble('#edcda5', [center.x, roofY + .16, center.z], [radius * .26, .15, radius * .26], roof, 28).name = 'place-flower-centre';
    }
    gardenFloor(g, state, layout, place, cells);
}
