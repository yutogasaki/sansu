import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import manifest from '../../../prototypes/place-qa/authored-district-kit-manifest.json';
import type { AuthoredDistrictCatalog } from './authoredDistrictWorld';
import type { WorldDefinition, WorldPoint } from './worldTypes';
import { compileWorldDefinition } from './worldDefinition';

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const compressed = readFileSync(manifest.artifact.path.slice(1)), expanded = gunzipSync(compressed);
const catalog: AuthoredDistrictCatalog = JSON.parse(expanded.toString());
const source: WorldDefinition = JSON.parse(gunzipSync(readFileSync(manifest.base.artifact)).toString());
const key = (point: WorldPoint) => [point.x, point.y, point.z].map(value => Math.round(value * 1e8)).join(',');

describe('real native05 district terrain kit', () => {
    it('preserves each native05 terrain triangle, source shading and material at its declared local origin', () => {
        expect(sha(compressed)).toBe(manifest.artifact.sha256); expect(sha(expanded)).toBe(manifest.artifact.expandedSha256);
        expect(expanded.length).toBe(manifest.artifact.expandedBytes); expect(compressed.length).toBe(manifest.artifact.gzipBytes);
        expect(sha(readFileSync(catalog.source.artifact))).toBe(catalog.source.sha256);
        expect(sha(readFileSync(manifest.base.artifact))).toBe(manifest.base.sha256);
        expect(catalog.templates.map(template => template.id)).toEqual(['native05-harbor-lowland-v1', 'native05-northern-hill-v1']);
        for (const template of catalog.templates) {
            const proof = manifest.templates.find(value => value.id === template.id)!, floor = template.district.floors[0];
            const original = source.districts[0].floors.find(value => value.id === `${proof.sourceNode}:${proof.sourcePrimitive}`)!;
            expect(floor.indices).toEqual(original.indices); expect(floor.material).toEqual(original.material); expect(floor.color).toBe(original.color);
            expect(floor.vertices).toHaveLength(original.vertices.length);
            floor.vertices.forEach((vertex, i) => {
                const expected = original.vertices[i];
                expect(vertex.cell).toEqual({ x: vertex.point.x, z: vertex.point.z });
                expect(vertex.point.x + proof.transform.localOrigin.x).toBeCloseTo(expected.point.x, 8);
                expect(vertex.point.y).toBeCloseTo(expected.point.y, 8);
                expect(vertex.point.z + proof.transform.localOrigin.z).toBeCloseTo(expected.point.z, 8);
                expect(vertex.normal).toEqual(expected.normal);
            });
        }
    });

    it('covers every cut edge with real bank and bottom, preserving the declared source pinch without extra floors', () => {
        for (const { district } of catalog.templates) {
            const proof = manifest.templates.find(value => value.id === district.id)!;
            expect(district.floors).toHaveLength(1);
            expect(district.surfaces?.map(surface => surface.kind)).toEqual(['bank', 'bank']);
            const edges = new Map<string, { count: number; winding: number }>();
            const parts = [{ vertices: district.floors[0].vertices.map(vertex => vertex.point), indices: district.floors[0].indices }, ...district.surfaces!];
            for (const part of parts) for (let i = 0; i < part.indices.length; i += 3) {
                const triangle = part.indices.slice(i, i + 3).map(index => key(part.vertices[index]));
                for (let j = 0; j < 3; j++) {
                    const a = triangle[j], b = triangle[(j + 1) % 3], id = [a, b].sort().join(':');
                    const edge = edges.get(id) ?? { count: 0, winding: 0 };
                    edge.count++; edge.winding += a < b ? 1 : -1; edges.set(id, edge);
                }
            }
            expect([...edges.values()].filter(edge => edge.count < 2 || edge.count % 2 || edge.winding !== 0)).toEqual([]);
            const pinchedEdges = proof.authoredClosure.sourceBoundaryPinches.map(({ point, boundaryDegree }) => [
                [key(point), key({ ...point, y: proof.authoredClosure.bottomY })].sort().join(':'),
                { count: boundaryDegree, winding: 0 },
            ]);
            expect([...edges.entries()].filter(([, edge]) => edge.count > 2)).toEqual(pinchedEdges);
            expect(proof.authoredClosure.manifold).toBe(pinchedEdges.length === 0);
        }
        expect(manifest.templates.map(value => value.authoredClosure.sourceBoundaryPinches.length)).toEqual([1, 0]);
    });

    it('supplies real supported sites and reachable edge ports with distinct lowland and hill relief', () => {
        const heights: number[] = [];
        for (const template of catalog.templates) {
            const world = compileWorldDefinition({ version: 1, id: template.id, source: catalog.source, districts: [template.district], edges: template.edges });
            const samples = world.floors.flatMap(floor => floor.vertices.map(vertex => vertex.point.y));
            heights.push(Math.max(...samples) - Math.min(...samples));
            const ports = template.ports.map(port => ({ ...port, site: world.sites.find(site => site.ref.siteId === port.siteId)! }));
            expect(ports.length).toBeGreaterThanOrEqual(2);
            const reached = new Set([ports[0].site.ref.siteId]), queue = [ports[0].site.cell];
            for (let i = 0; i < queue.length; i++) for (const cell of world.neighbors(queue[i])) {
                const id = `${cell.x},${cell.z}`; if (!reached.has(id)) { reached.add(id); queue.push(cell); }
            }
            for (const port of ports) {
                expect(reached.has(port.site.ref.siteId)).toBe(true);
                expect(Number.isInteger(port.site.cell.x) && Number.isInteger(port.site.cell.z)).toBe(true);
                const d = [{ x: 1, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 0 }, { x: 0, z: -1 }][port.facing];
                expect(world.floorAt(port.site.cell)).toBeDefined();
                expect(world.floorAt({ x: port.site.cell.x + d.x * .51, z: port.site.cell.z + d.z * .51 })).toBeUndefined();
            }
            for (const site of world.sites.filter(site => site.placement)) {
                expect(reached.has(site.ref.siteId)).toBe(true);
                for (const dx of [-.46, 0, .46]) for (const dz of [-.46, 0, .46])
                    expect(world.floorAt({ x: site.cell.x + dx, z: site.cell.z + dz })).toBeDefined();
            }
        }
        expect(heights[0]).toBeGreaterThan(.5); expect(heights[1]).toBeGreaterThan(2); expect(heights[1]).toBeGreaterThan(heights[0] * 2);
        for (const port of catalog.basePorts) {
            const district = source.districts.find(district => district.id === port.districtId)!;
            expect(district.sites.some(site => site.id === port.siteId)).toBe(true);
        }
    }, 30_000);
});
