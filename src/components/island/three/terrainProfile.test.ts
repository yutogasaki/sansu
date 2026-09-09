import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ISLAND_MAIN_LAND, ISLAND_EAST_LAND, ISLAND_WEST_LAND } from '../../../domain/island/catalog';
import { islandGroundGeometry } from './geometry';
import { makeExpansion, makeScenery } from './scenery';
import { disposeGeometry, IslandMaterials } from './primitives';
import { islandTerrainEnvelope, ISLAND_TERRAIN_PROFILES, ISLAND_TERRAIN_SEGMENTS,
    terrainContour, terrainEdge, terrainRocks } from './terrainProfile';

const areas = [ISLAND_MAIN_LAND, ISLAND_EAST_LAND, ISLAND_WEST_LAND];
// Fixed33/34 authored outline, retained as a geometric before-fixture. A camera
// change must not pass for an actual reduction of the side islands' extra land.
const previousProfiles = {
    main: { phase: .2, lobes: [[1.95, .34, .245], [.56, .28, .16], [4.27, .42, .16]] },
    east: { phase: 1.4, lobes: [[.21, .44, .20], [1.85, .32, .13], [4.75, .35, .195]] },
    west: { phase: 2.7, lobes: [[.64, .37, .16], [2.0, .31, .115], [4.85, .38, .25]] },
} as const;
function previousContour(angle: number, profile: typeof ISLAND_TERRAIN_PROFILES[number]) {
    const p = previousProfiles[profile];
    return 1.018 + .006 * Math.sin(angle * 5 + p.phase) + p.lobes.reduce((sum, [center, width, amount]) => {
        const distance = Math.atan2(Math.sin(angle - center), Math.cos(angle - center));
        return sum + amount * Math.exp(-.5 * (distance / width) ** 2);
    }, 0);
}
const polygonArea = (points: { x: number; z: number }[]) => Math.abs(points.reduce((sum, point, i) => {
    const next = points[(i + 1) % points.length];
    return sum + point.x * next.z - next.x * point.z;
}, 0)) / 2;
function vertices(group: THREE.Object3D) {
    const result: THREE.Vector3[] = []; group.updateWorldMatrix(true, true);
    group.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        const positions = child.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) result.push(new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(child.matrixWorld));
    }); return result;
}

describe('shore garden terrain keeps saved physical land', () => {
    it.each(ISLAND_TERRAIN_PROFILES)('%s contains the saved ellipse and retains a broad sand sector without an inward cut', profile => {
        const radii = Array.from({ length: ISLAND_TERRAIN_SEGMENTS }, (_, i) => terrainContour(i / ISLAND_TERRAIN_SEGMENTS * Math.PI * 2, profile));
        expect(Math.min(...radii)).toBeGreaterThan(1 / Math.cos(Math.PI / ISLAND_TERRAIN_SEGMENTS));
        const widths = radii.map((r, i) => terrainEdge(i / ISLAND_TERRAIN_SEGMENTS * Math.PI * 2, 'beach', profile).radius - r);
        expect(Math.max(...widths)).toBeGreaterThan(.24);
        expect(Math.max(...widths) - Math.min(...widths)).toBeGreaterThan(.20);
    });

    it('keeps the main outline while reducing real side-cap area and limiting bridge/outer-end bulges', () => {
        for (const profile of ISLAND_TERRAIN_PROFILES) {
            const radii = Array.from({ length: 360 }, (_, i) => terrainContour(i * Math.PI / 180, profile));
            for (let i = 0; i < 360; i++) {
                const previous = previousContour(i * Math.PI / 180, profile);
                if (profile === 'main') expect(radii[i]).toBe(previous);
                else expect(radii[i]).toBeLessThanOrEqual(previous);
            }
            if (profile === 'main') continue;
            expect(Math.max(...radii)).toBeLessThan(1.10);
            expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(.03);
            expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(.09);
            for (const center of [0, Math.PI]) for (const offset of [-.35, 0, .35]) {
                expect(terrainContour(center + offset, profile)).toBeLessThan(1.08);
            }
            const { radiusX: rx, radiusZ: rz } = ISLAND_EAST_LAND;
            const geometry = islandGroundGeometry(rx, rz, profile);
            try {
                const position = geometry.getAttribute('position'), start = 1 + 2 * (ISLAND_TERRAIN_SEGMENTS + 1);
                const actual = Array.from({ length: ISLAND_TERRAIN_SEGMENTS }, (_, i) => ({
                    x: position.getX(start + i), z: position.getZ(start + i),
                }));
                const previous = actual.map((_, i) => {
                    const angle = i / ISLAND_TERRAIN_SEGMENTS * Math.PI * 2, radius = previousContour(angle, profile);
                    return { x: Math.cos(angle) * rx * radius, z: Math.sin(angle) * rz * radius };
                });
                expect(polygonArea(actual)).toBeLessThan(polygonArea(previous) * .94);
                expect(polygonArea(actual)).toBeGreaterThan(Math.PI * rx * rz);
            } finally { geometry.dispose(); }
        }
    });

    it.each(ISLAND_TERRAIN_PROFILES)('%s keeps old ellipse centers, chords and boundary samples on the exact flat floor', profile => {
        // The small historical size is still a supported geometry call.
        for (const [rx, rz] of [[4.8, 3.6], [3, 3.4], [1.9, 2.3]]) {
            const geometry = islandGroundGeometry(rx, rz, profile), material = new THREE.MeshBasicMaterial();
            const land = new THREE.Mesh(geometry, material), ray = new THREE.Raycaster();
            try {
                const positions = geometry.getAttribute('position');
                expect(Array.from({ length: positions.count }, (_, i) => positions.getY(i)).every(y => y === 0)).toBe(true);
                for (const radius of [0, .5, 1]) for (let i = 0; i < 360; i++) {
                    const angle = i * Math.PI / 180;
                    ray.set(new THREE.Vector3(Math.cos(angle) * rx * radius, 1, Math.sin(angle) * rz * radius), new THREE.Vector3(0, -1, 0));
                    const hit = ray.intersectObject(land)[0];
                    expect(hit?.point.y, `${profile} ${rx}/${rz} ${radius}/${i}`).toBeCloseTo(0, 7);
                    expect(hit?.face?.normal.y).toBeGreaterThan(.99999);
                }
            } finally { geometry.dispose(); material.dispose(); }
        }
    });

    it('keeps western physical bridge/props identical while its terrain is not an eastern mirror', () => {
        const materials = new IslandMaterials();
        try {
            for (const slot of ['bridge', 'tree', 'flower'] as const) {
                const east = makeExpansion(materials, slot), west = makeExpansion(materials, slot, 'west');
                expect(vertices(west)).toEqual(vertices(east)); disposeGeometry(east); disposeGeometry(west);
            }
            const east = islandGroundGeometry(3, 3.4, 'east'), west = islandGroundGeometry(3, 3.4, 'west');
            expect(east.getAttribute('position').array).not.toEqual(west.getAttribute('position').array);
            east.dispose(); west.dispose();
            for (const profile of ISLAND_TERRAIN_PROFILES) for (const rock of terrainRocks(3, 3.4, profile)) {
                expect(rock.position[1] + rock.scale[1]).toBeLessThan(0);
            }
        } finally { materials.dispose(); }
    });

    it('the common envelope contains every actual cap, beach, cliff and shallow vertex under world rotation', () => {
        const materials = new IslandMaterials();
        try {
            for (const [index, profile] of ISLAND_TERRAIN_PROFILES.entries()) {
                const envelope = islandTerrainEnvelope(areas[index]).map(p => new THREE.Vector3(...p));
                for (const slot of ['ground', 'shore', 'water'] as const) {
                    const group = profile === 'main' ? makeScenery(materials, slot) : makeExpansion(materials, slot, profile);
                    if (profile === 'west') group.rotation.y = Math.PI;
                    try {
                        const actual = vertices(group);
                        // All view directions, including low side views: AABB containment
                        // alone would miss a lobe or a chunk escaping the sampled hull.
                        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) for (const elevation of [-.3, .2, 1]) {
                            const axis = new THREE.Vector3(Math.cos(angle), elevation, Math.sin(angle)).normalize();
                            const limit = Math.max(...envelope.map(p => p.dot(axis)));
                            expect(Math.max(...actual.map(p => p.dot(axis))), `${profile}/${slot}/${angle}/${elevation}`).toBeLessThanOrEqual(limit + 1e-6);
                        }
                    } finally { disposeGeometry(group); }
                }
            }
        } finally { materials.dispose(); }
    });
});
