import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ISLAND_MAIN_LAND, ISLAND_EAST_LAND, ISLAND_WEST_LAND } from '../../../domain/island/catalog';
import { islandGroundGeometry } from './geometry';
import { makeExpansion, makeScenery } from './scenery';
import { disposeGeometry, IslandMaterials } from './primitives';
import { islandTerrainEnvelope, ISLAND_TERRAIN_PROFILES, ISLAND_TERRAIN_SEGMENTS,
    terrainContour, terrainEdge, terrainRocks } from './terrainProfile';

const areas = [ISLAND_MAIN_LAND, ISLAND_EAST_LAND, ISLAND_WEST_LAND];
function vertices(group: THREE.Object3D) {
    const result: THREE.Vector3[] = []; group.updateWorldMatrix(true, true);
    group.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        const positions = child.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) result.push(new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(child.matrixWorld));
    }); return result;
}

describe('shore garden terrain keeps saved physical land', () => {
    it.each(ISLAND_TERRAIN_PROFILES)('%s has large asymmetric outer lobes and one broad sand sector, with no inward cut', profile => {
        const radii = Array.from({ length: ISLAND_TERRAIN_SEGMENTS }, (_, i) => terrainContour(i / ISLAND_TERRAIN_SEGMENTS * Math.PI * 2, profile));
        expect(Math.min(...radii)).toBeGreaterThan(1 / Math.cos(Math.PI / ISLAND_TERRAIN_SEGMENTS));
        expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(.17);
        const widths = radii.map((r, i) => terrainEdge(i / ISLAND_TERRAIN_SEGMENTS * Math.PI * 2, 'beach', profile).radius - r);
        expect(Math.max(...widths)).toBeGreaterThan(.24);
        expect(Math.max(...widths) - Math.min(...widths)).toBeGreaterThan(.20);
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
