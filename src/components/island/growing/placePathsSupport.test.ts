import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { newIsland } from '../../../domain/growingIsland/island';
import { authoredAccessWorld } from '../../../domain/growingIsland/authoredWorldAccess.fixture';
import { compileWorldDefinition, type IslandWorld } from '../../../domain/growingIsland/worldDefinition';
import type { Cell } from '../../../domain/growingIsland/types';
import type { WorldDefinition } from '../../../domain/growingIsland/worldTypes';
import { sceneLayout } from './sceneLayout';
import { buildPlacePaths, placePathEdges } from './placePaths';

const home = (id: string, x: number, z: number) => ({ id, kind: 'home' as const, cell: { x, z }, stage: 4 as const,
    plantedAt: 0, builtAt: 0, growth: 0, origin: 'seed' as const, paid: 40 });
function authoredFixture() {
    const { world, definition } = authoredAccessWorld(), state = newIsland('authored-path-buffer', 0);
    state.landmarks = []; state.plots = [home('north-home', 4, -2), home('west-home', -1, 3)];
    return { state, world, definition, layout: sceneLayout(state, false, world) };
}
function fingerprint(path: T.Mesh) {
    const hash = createHash('sha256'), geometry = path.geometry;
    for (const attribute of [geometry.getAttribute('position') as T.BufferAttribute, geometry.getIndex()!, geometry.getAttribute('normal') as T.BufferAttribute])
        hash.update(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
    return { hash: hash.digest('hex'), vertices: geometry.getAttribute('position').count, indices: geometry.getIndex()!.count,
        edgeHash: createHash('sha256').update(JSON.stringify(path.userData.groundPathEdges)).digest('hex'), edges: path.userData.groundPathEdges.length };
}
const release = (path: T.Mesh) => { path.geometry.dispose(); (path.material as T.Material).dispose(); };
const vertexCell = (path: T.Mesh, index: number, center: number): Cell => {
    const position = path.geometry.getAttribute('position'); return { x: position.getX(index) + center, z: position.getZ(index) + 2 };
};
function withoutFloor(input: WorldDefinition, at: Cell, radius: number, water: boolean) {
    const definition = structuredClone(input), district = definition.districts[0];
    const corners = (x0: number, x1: number, z0: number, z1: number, y?: number) => [[x0, z0], [x0, z1], [x1, z0], [x1, z1]]
        .map(([x, z]) => ({ cell: { x, z }, point: { x, y: y ?? x * .03 + z * .02, z } }));
    if (water) district.floors.push({ id: 'local-water', kind: 'water', color: '#88bbdd',
        vertices: corners(at.x - radius, at.x + radius, at.z - radius, at.z + radius, 5), indices: [0, 1, 2, 2, 1, 3] });
    else {
        // A real hole in the ground mesh, while all explicit graph nodes and
        // sampled walking edges keep their original supported dry floor.
        const floor = district.floors[0], xs = [-1.5, at.x - radius, at.x + radius, 5.5], zs = [-3.5, at.z - radius, at.z + radius, 4.5];
        floor.vertices = []; floor.indices = [];
        for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) {
            if (x === 1 && z === 1) continue;
            const start = floor.vertices.length; floor.vertices.push(...corners(xs[x], xs[x + 1], zs[z], zs[z + 1]));
            floor.indices.push(start, start + 1, start + 2, start + 2, start + 1, start + 3);
        }
    }
    return compileWorldDefinition(definition);
}

describe('authored paving support queries preserve the complete output', () => {
    it('keeps legacy buffers and route ordering identical to the pre-optimization result', () => {
        const state = newIsland('path-buffer-baseline', 0);
        state.land = { expanded: 'east', extra: [], capes: [] }; state.plots.push(home('grown-home', 8, 3));
        state.landmarks.push({ id: 'channel', kind: 'water-channel', cell: { x: 5, z: 1 }, growth: 0 });
        const before = structuredClone(state), path = buildPlacePaths(state, sceneLayout(state), []);
        // Recorded before query caching: every position, index, normal and edge.
        expect(fingerprint(path)).toEqual({ hash: 'bb509feaaef02bc7edfea0ddba91779f941a948bd5e8ea918be97cec702b1238', vertices: 312, indices: 864,
            edgeHash: '78d0c3b81d64f6b527318e82bd677ba691540c67bd07a09a6b8a40455a77eae2', edges: 7 });
        expect(state).toEqual(before); release(path);
    });
    it('keeps all authored quarter-route costs, mesh resolution and buffers identical', () => {
        const { state, layout, world } = authoredFixture(), before = structuredClone(state), path = buildPlacePaths(state, layout, []);
        expect(fingerprint(path)).toEqual({ hash: '907eae60c1af501818500357c0683e2929109cb97570ce48eb2480474e5ad02b', vertices: 1638, indices: 4536,
            edgeHash: 'e9aff28c3280e62a7392490c02463deaf43cffa72576a13b1ad31d47ae87c551', edges: 31 });
        const edges = placePathEdges(state, [], world); expect(edges).toEqual(path.userData.groundPathEdges);
        expect(edges.every(([a, b]) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z) === .25)).toBe(true);
        expect(state).toEqual(before); release(path);
    });
    it('uses compiled supported graph nodes and checks each shared mesh vertex only once', () => {
        const { state, world } = authoredFixture(), floorAt = vi.fn(world.floorAt), logicalAt = vi.fn(world.logicalAt);
        const countedWorld: IslandWorld = { ...world, floorAt, logicalAt };
        expect(placePathEdges(state, [], countedWorld)).toEqual(placePathEdges(state, [], world));
        expect(floorAt).not.toHaveBeenCalled();
        const layout = sceneLayout(state, false, countedWorld); floorAt.mockClear(); logicalAt.mockClear();
        const path = buildPlacePaths(state, layout, []);
        expect(logicalAt).toHaveBeenCalledTimes(new Set(path.geometry.getIndex()!.array).size);
        expect(logicalAt.mock.calls.length).toBeLessThan(path.geometry.getIndex()!.count);
        release(path);
    });
    it.each([true, false])('rejects a spanning face whose three corners are dry but centroid has no floor (water=%s)', water => {
        const { state, world, definition, layout } = authoredFixture(), baseline = buildPlacePaths(state, layout, []);
        const face = Array.from(baseline.geometry.getIndex()!.array.slice(0, 3)), corners = face.map(index => vertexCell(baseline, index, layout.center));
        const centroid = { x: corners.reduce((sum, cell) => sum + cell.x, 0) / 3, z: corners.reduce((sum, cell) => sum + cell.z, 0) / 3 };
        const cutWorld = withoutFloor(definition, centroid, .002, water), cutLayout = sceneLayout(state, false, cutWorld), path = buildPlacePaths(state, cutLayout, []);
        expect(cutWorld.floorAt(centroid)).toBeUndefined(); expect(corners.every(cell => cutWorld.floorAt(cell))).toBe(true);
        expect(placePathEdges(state, [], cutWorld)).toEqual(placePathEdges(state, [], world));
        const indices = Array.from(path.geometry.getIndex()!.array);
        expect(indices.length).toBeLessThan(baseline.geometry.getIndex()!.count);
        expect(indices.some((_, i) => i % 3 === 0 && indices.slice(i, i + 3).every((index, j) => index === face[j]))).toBe(false);
        expect(path.geometry.getAttribute('position').count).toBe(baseline.geometry.getAttribute('position').count);
        if (water) expect(fingerprint(path).hash).toBe('0c5a7451e45e6de123cd07c396335594de33a4ed473de3ea52b601589e0875b9');
        release(path); release(baseline);
    });
    it('rejects every face sharing a vertex over water without changing graph routes or resolution', () => {
        const { state, world, definition, layout } = authoredFixture(), baseline = buildPlacePaths(state, layout, []);
        const first = baseline.geometry.getIndex()!.getX(0), at = vertexCell(baseline, first, layout.center);
        const cutWorld = withoutFloor(definition, at, .0001, true), path = buildPlacePaths(state, sceneLayout(state, false, cutWorld), []);
        expect(cutWorld.floorAt(at)).toBeUndefined(); expect(Array.from(path.geometry.getIndex()!.array)).not.toContain(first);
        expect(placePathEdges(state, [], cutWorld)).toEqual(placePathEdges(state, [], world));
        expect(fingerprint(path)).toEqual({ hash: 'eed87b3e66e4c1c8392023b4dd4eee79f5f1bcdbd9a4dc4a189d42479392f297', vertices: 1638, indices: 4521,
            edgeHash: 'e9aff28c3280e62a7392490c02463deaf43cffa72576a13b1ad31d47ae87c551', edges: 31 });
        release(path); release(baseline);
    });
});
