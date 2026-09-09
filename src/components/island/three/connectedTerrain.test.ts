import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { getIslandFloorAreas, ISLAND_EAST_CONNECTOR, ISLAND_WEST_CONNECTOR } from '../../../domain/island/landGeometry';
import { APPEARANCE_FAMILIES, ISLAND_APPEARANCE_VERSIONS, islandAppearanceStyleId } from '../../../domain/island/appearance';
import { IslandPartMaterials } from './appearanceParts';
import { buildConnectedTerrain, connectedTerrainEnvelope, getConnectedTerrainContours,
    type ConnectedTerrainPoint, type ConnectedTerrainSlot } from './connectedTerrain';
import { disposeGeometry, IslandMaterials } from './primitives';
import { ISLAND_TERRAIN_EDGES } from './terrainProfile';

const levels = [0, 1, 2] as const;
const widths = [2.25, 2.9, 3.35] as const;
const slots: readonly ConnectedTerrainSlot[] = ['ground', 'shore', 'water'];
function actualMeshes(root: THREE.Object3D) {
    const result: THREE.Mesh[] = []; root.updateWorldMatrix(true, true);
    root.traverse(child => { if (child instanceof THREE.Mesh) result.push(child); }); return result;
}
function triangles(geometry: THREE.BufferGeometry) {
    const positions = geometry.getAttribute('position'), indices = geometry.index, result: THREE.Triangle[] = [];
    for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
        const p = [0, 1, 2].map(offset => new THREE.Vector3().fromBufferAttribute(positions, indices?.getX(i + offset) ?? i + offset));
        result.push(new THREE.Triangle(p[0], p[1], p[2]));
    }
    return result;
}
const area = (ring: readonly ConnectedTerrainPoint[]) => Math.abs(THREE.ShapeUtils.area(ring.map(([x, , z]) => new THREE.Vector2(x, z))));
const projectedArea = (faces: THREE.Triangle[]) => faces.reduce((sum, { a, b, c }) =>
    sum + Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) / 2, 0);
function sides(ring: readonly ConnectedTerrainPoint[]) {
    const count = ring.length / 2 + 1;
    return { upper: ring.slice(0, count), lower: [ring[0], ...ring.slice(count).reverse(), ring[count - 1]] };
}
function zAt(row: readonly ConnectedTerrainPoint[], x: number) {
    let lo = 0, hi = row.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (row[mid][0] < x) lo = mid; else hi = mid; }
    const a = row[lo], b = row[hi], t = Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0])));
    return a[2] + (b[2] - a[2]) * t;
}

describe('connected terrain exterior', () => {
    it('adds a supported central depth only at maturity without repeating the main decorative lobes', () => {
        const materials = new IslandMaterials();
        try {
            for (const level of levels) {
                const ground = buildConnectedTerrain(materials, level, 'ground');
                try {
                    actualMeshes(ground);
                    for (const z of [-5.8, 4.65]) {
                        const hits = new THREE.Raycaster(new THREE.Vector3(0, 1, z), new THREE.Vector3(0, -1, 0)).intersectObject(ground, true);
                        expect(hits.length > 0, `central floor ${level}/${z}`).toBe(level === 2);
                        expect(hits.every(hit => Math.abs(hit.point.y) < 1e-7)).toBe(true);
                    }
                } finally { disposeGeometry(ground); }
            }
            const cap = getConnectedTerrainContours(2).cap, depth = cap.map(point => point[2]);
            // The selected 5.5 floor has a small 1.012 outset, not another
            // copy of the main island's large positive decorative lobes.
            expect(Math.min(...depth)).toBeLessThan(-6.1);
            expect(Math.min(...depth)).toBeGreaterThan(-6.3);
            expect(Math.max(...depth)).toBeGreaterThan(4.9);
            expect(Math.max(...depth)).toBeLessThan(5.1);
        } finally { materials.dispose(); }
    });

    it('returns finite immutable matching rings and caches only plain coordinates', () => {
        for (const level of levels) for (const connectorRadiusZ of widths) {
            const options = { connectorRadiusZ }, rings = getConnectedTerrainContours(level, options);
            expect(new Set(Object.values(rings).map(ring => ring.length)).size).toBe(1);
            expect(rings.cap.length).toBeGreaterThan(64); expect(rings.cap.length).toBeLessThan(8192);
            expect(Object.isFrozen(rings)).toBe(true);
            for (const edge of ISLAND_TERRAIN_EDGES) {
                expect(Object.isFrozen(rings[edge])).toBe(true);
                expect(rings[edge].every(p => p.every(Number.isFinite) && Object.isFrozen(p))).toBe(true);
                expect(rings[edge][0]).not.toEqual(rings[edge][rings[edge].length - 1]);
            }
            expect(rings.cap.every(([, y]) => y === 0)).toBe(true);
            expect(getConnectedTerrainContours(level, options)).toBe(rings);
            expect(connectedTerrainEnvelope(level, options)).toBe(connectedTerrainEnvelope(level, options));
        }
    });

    it.each(levels)('supports every old ellipse and candidate connector on one y=0 cap at level %s', level => {
        const materials = new IslandMaterials();
        try {
            for (const connectorRadiusZ of widths) {
                const group = buildConnectedTerrain(materials, level, 'ground', { connectorRadiusZ });
                try {
                    expect(actualMeshes(group)).toHaveLength(1);
                    const ray = new THREE.Raycaster();
                    for (const region of getIslandFloorAreas(level)) {
                        const rz = region === ISLAND_EAST_CONNECTOR || region === ISLAND_WEST_CONNECTOR ? connectorRadiusZ : region.radiusZ;
                        for (const radial of [0, .5, 1]) for (let i = 0; i < 72; i++) {
                            const angle = i / 72 * Math.PI * 2;
                            ray.set(new THREE.Vector3(region.x + Math.cos(angle) * region.radiusX * radial, 1,
                                region.z + Math.sin(angle) * rz * radial), new THREE.Vector3(0, -1, 0));
                            const hits = ray.intersectObject(group, true);
                            expect(hits.length, `${level}/${connectorRadiusZ}/${region.x}/${radial}/${i}`).toBeGreaterThan(0);
                            expect(hits.every(hit => Math.abs(hit.point.y) < 1e-7 && hit.face!.normal.y > .99999)).toBe(true);
                        }
                    }
                    for (const x of [-7.3, 7.3]) {
                        ray.set(new THREE.Vector3(x, 1, 0), new THREE.Vector3(0, -1, 0));
                        expect(ray.intersectObject(group, true).length > 0).toBe(x > 0 ? level >= 1 : level >= 2);
                    }
                } finally { disposeGeometry(group); }
            }
        } finally { materials.dispose(); }
    });

    it('triangulates the concave cap once without extra covered area or duplicate triangles', () => {
        const materials = new IslandMaterials();
        try {
            for (const level of levels) for (const connectorRadiusZ of widths) {
                const group = buildConnectedTerrain(materials, level, 'ground', { connectorRadiusZ });
                try {
                    const faces = triangles(actualMeshes(group)[0].geometry), ring = getConnectedTerrainContours(level, { connectorRadiusZ }).cap;
                    expect(projectedArea(faces)).toBeCloseTo(area(ring), 4);
                    expect(new Set(faces.map(({ a, b, c }) => [a, b, c].map(p => p.toArray().join(',')).sort().join('|'))).size).toBe(faces.length);
                    expect(faces.every(face => face.getArea() > 1e-14 && face.getNormal(new THREE.Vector3()).y > .99999)).toBe(true);
                } finally { disposeGeometry(group); }
            }
        } finally { materials.dispose(); }
    });

    it('fills only the nested external layer bands and leaves no shore through the connecting floor', () => {
        const materials = new IslandMaterials();
        try {
            for (const level of [1, 2] as const) for (const connectorRadiusZ of widths) {
                const rings = getConnectedTerrainContours(level, { connectorRadiusZ });
                const group = new THREE.Group();
                group.add(buildConnectedTerrain(materials, level, 'shore', { connectorRadiusZ }),
                    buildConnectedTerrain(materials, level, 'water', { connectorRadiusZ }));
                try {
                    const objects = actualMeshes(group);
                    expect(objects).toHaveLength(7);
                    for (const object of objects) {
                        const [a, b] = object.name.split('-') as (typeof ISLAND_TERRAIN_EDGES[number])[];
                        const faces = triangles(object.geometry), expectedArea = Math.abs(area(rings[a]) - area(rings[b]));
                        expect(projectedArea(faces), `${level}/${connectorRadiusZ}/${object.name}`).toBeCloseTo(expectedArea, 4);
                        expect(faces.every(face => face.getArea() > 1e-14 && face.getNormal(new THREE.Vector3()).lengthSq() > .99)).toBe(true);
                        const envelope = new THREE.Box3().setFromPoints(connectedTerrainEnvelope(level, { connectorRadiusZ }).map(p => new THREE.Vector3(...p)));
                        envelope.expandByScalar(1e-6);
                        expect(faces.every(({ a, b, c }) => [a, b, c].every(point => envelope.containsPoint(point)))).toBe(true);
                    }
                    for (const x of level === 2 ? [-3.65, 3.65] : [3.65]) for (const z of [-1.5, 0, 1.5]) {
                        const ray = new THREE.Raycaster(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0));
                        expect(ray.intersectObject(group, true)).toHaveLength(0);
                    }
                } finally { disposeGeometry(group); }
            }
        } finally { materials.dispose(); }
    });

    it('proves band nesting at every linear breakpoint and actual surface support between the boundaries', () => {
        const materials = new IslandMaterials(), twoSided = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
        try {
            for (const level of levels) for (const connectorRadiusZ of widths) {
                const rings = getConnectedTerrainContours(level, { connectorRadiusZ });
                const group = new THREE.Group();
                group.add(buildConnectedTerrain(materials, level, 'shore', { connectorRadiusZ }),
                    buildConnectedTerrain(materials, level, 'water', { connectorRadiusZ }));
                try {
                    for (const object of actualMeshes(group)) {
                        const [a, b] = object.name.split('-') as (typeof ISLAND_TERRAIN_EDGES[number])[];
                        const firstOuter = area(rings[a]) > area(rings[b]);
                        const outer = sides(firstOuter ? rings[a] : rings[b]), inner = sides(firstOuter ? rings[b] : rings[a]);
                        const min = inner.upper[0][0], max = inner.upper[inner.upper.length - 1][0];
                        expect(min).toBeGreaterThanOrEqual(outer.upper[0][0]);
                        expect(max).toBeLessThanOrEqual(outer.upper[outer.upper.length - 1][0]);
                        // All segments are linear between these complete x knots:
                        // endpoint ordering proves no inner/outer crossings.
                        const xs = [...new Set([...outer.upper, ...inner.upper].map(p => p[0]))].filter(x => x >= min && x <= max);
                        let separation = Infinity;
                        for (const x of xs) separation = Math.min(separation,
                            zAt(outer.upper, x) - zAt(inner.upper, x), zAt(inner.lower, x) - zAt(outer.lower, x));
                        expect(separation, `${level}/${connectorRadiusZ}/${object.name}`).toBeGreaterThanOrEqual(-1e-8);
                        const faces = triangles(object.geometry);
                        expect(faces.every(face => (face.getNormal(new THREE.Vector3()).y > 0) === firstOuter)).toBe(true);
                        // Geometry support uses both sides because the cliff's
                        // outward-facing undercut has a correctly negative y normal.
                        const probe = new THREE.Mesh(object.geometry, twoSided);
                        for (let step = 1; step < 16; step++) {
                            const x = min + (max - min) * step / 16;
                            for (const side of ['upper', 'lower'] as const) {
                                const z = (zAt(outer[side], x) + zAt(inner[side], x)) / 2;
                                const hits = new THREE.Raycaster(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0)).intersectObject(probe);
                                expect(hits.length, `${level}/${connectorRadiusZ}/${object.name}/${step}/${side}`).toBeGreaterThan(0);
                                expect(hits.every(hit => hit.point.y <= 1e-7 && hit.point.y >= -.86)).toBe(true);
                            }
                        }
                    }
                } finally { disposeGeometry(group); }
            }
        } finally { materials.dispose(); twoSided.dispose(); }
    });

    it('keeps world UVs, slot material identity and borrowed textures across every existing style', () => {
        for (const family of APPEARANCE_FAMILIES) for (const version of ISLAND_APPEARANCE_VERSIONS) for (const slot of slots) {
            const pool = new IslandPartMaterials(islandAppearanceStyleId(family, slot, version));
            const group = buildConnectedTerrain(pool, 2, slot);
            try {
                for (const object of actualMeshes(group)) {
                    const position = object.geometry.getAttribute('position'), uv = object.geometry.getAttribute('uv');
                    expect(uv.count).toBe(position.count);
                    for (let i = 0; i < position.count; i++) {
                        expect(uv.getX(i)).toBeCloseTo(position.getX(i) / 1.15 + .5, 5);
                        expect(uv.getY(i)).toBeCloseTo(position.getZ(i) / 1.15 + .5, 5);
                    }
                    const material = object.material as THREE.MeshStandardMaterial;
                    expect(material.userData.islandOwned).toBe(true);
                    if (slot === 'ground') {
                        const source = pool.surface('#72ab50', .98);
                        expect(material).not.toBe(source); expect(material.color).toEqual(source.color);
                        expect(material.map).toBe(source.map); expect(material.bumpMap).toBe(source.bumpMap);
                    }
                    if (slot === 'water') expect(object.castShadow || object.receiveShadow).toBe(false);
                }
            } finally { disposeGeometry(group); pool.dispose(); }
        }
    });

    it('retires each generated geometry/clone once while leaving the external pool and cached contours alive', () => {
        const pool = new IslandPartMaterials('legacy-v1:moon-garden:ground');
        const contours = getConnectedTerrainContours(2), source = pool.surface('#72ab50', .98), texture = source.bumpMap!;
        let sourceRetired = 0, textureRetired = 0;
        source.addEventListener('dispose', () => sourceRetired++); texture.addEventListener('dispose', () => textureRetired++);
        const group = buildConnectedTerrain(pool, 2, 'ground'), object = actualMeshes(group)[0];
        let geometryRetired = 0, cloneRetired = 0;
        object.geometry.addEventListener('dispose', () => geometryRetired++);
        (object.material as THREE.Material).addEventListener('dispose', () => cloneRetired++);
        disposeGeometry(group);
        expect([geometryRetired, cloneRetired, sourceRetired, textureRetired]).toEqual([1, 1, 0, 0]);
        const renewed = buildConnectedTerrain(pool, 2, 'ground');
        expect(getConnectedTerrainContours(2)).toBe(contours);
        expect(actualMeshes(renewed)[0].geometry).not.toBe(object.geometry);
        disposeGeometry(renewed); pool.dispose();
        expect([sourceRetired, textureRetired]).toEqual([1, 1]);
    });
});
