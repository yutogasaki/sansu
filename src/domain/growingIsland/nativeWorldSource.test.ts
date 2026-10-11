import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { compileWorldDefinition } from './worldDefinition';
import type { WorldDefinition } from './worldTypes';
import { worldFloorGeometry } from '../../components/island/growing/worldFloorGeometry';

describe('approved native05 terrain as a shared world input', () => {
    it('retains the source identity, actual irregular floor, legal planting and reachable dry paths', () => {
        const folder = 'docs/design/2026-10-11-authored-world-foundation';
        const manifest = JSON.parse(readFileSync(`${folder}/world-manifest.json`, 'utf8'));
        const delivered = readFileSync(`${folder}/native05-world.json.gz`), bytes = gunzipSync(delivered);
        const hash = (buffer: Uint8Array) => createHash('sha256').update(buffer).digest('hex');
        expect(hash(delivered)).toBe(manifest.artifact.sha256); expect(hash(bytes)).toBe(manifest.artifact.expandedSha256);
        const definition: WorldDefinition = JSON.parse(bytes.toString()), world = compileWorldDefinition(definition);
        expect(world.id).toBe('native05-authored-world-m0-v2');
        expect(definition.source?.sha256).toBe('8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d');
        expect(world.floors.reduce((n, floor) => n + floor.indices.length / 3, 0)).toBe(89488);
        const planting = world.sites.filter(site => site.placement), open = new Set(world.sites.map(site => `${site.cell.x},${site.cell.z}`));
        expect(planting).toHaveLength(73); expect(world.sites.length).toBeGreaterThan(planting.length * 10);
        for (const site of planting) {
            expect(world.route({ x: 2, z: 1 }, site.cell, open), site.ref.siteId).toBeDefined();
            for (const [dx, dz] of [[0, 0], [.17, -.13], [-.21, .31]]) {
                const point = world.floorAt({ x: site.cell.x + dx, z: site.cell.z + dz })!.point;
                expect(world.siteAt(point)?.ref, site.ref.siteId).toEqual(site.ref);
            }
        }
        expect(manifest.reachableFromHome).toBe(73); expect(manifest.isolatedSites).toEqual([]);
        for (const site of world.sites.filter(site => !site.placement).slice(0, 20)) {
            expect(world.owns(site.cell)).toBe(false); expect(world.neighbors(site.cell, 'join')).toEqual([]); expect(world.neighbors(site.cell, 'water')).toEqual([]);
        }
        // All eight selected source surfaces are drawn by the real runtime floor
        // builder; this checks the physical ray, not just a calculated height.
        const geometry = worldFloorGeometry(world), material = new T.MeshBasicMaterial({ side: T.DoubleSide });
        const floor = new T.Mesh(geometry, material); floor.updateMatrixWorld(true);
        for (const site of planting.filter((_, i) => i % 11 === 0)) {
            const p = new T.Vector3(site.point.x, 10, site.point.z);
            const real = new T.Raycaster(p, new T.Vector3(0, -1, 0)).intersectObject(floor)[0];
            expect(real, site.ref.siteId).toBeDefined(); expect(real.point.y).toBeCloseTo(site.point.y, 5);
            expect(world.siteAt(real.point)?.ref).toEqual(site.ref);
        }
        const corner = { x: Math.floor(world.bounds.min.x), z: Math.floor(world.bounds.min.z) };
        expect(world.floorAt(corner)).toBeUndefined(); expect(world.owns(corner)).toBe(false);
        geometry.dispose(); material.dispose();
    }, 30000);
});
