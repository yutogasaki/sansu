import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { compileWorldDefinition } from '../../../../domain/growingIsland/worldDefinition';
import { inletWorldDefinition } from '../../../../domain/growingIsland/worldDefinition.fixture';
import type { WorldDefinition } from '../../../../domain/growingIsland/worldTypes';
import { newIsland } from '../../../../domain/growingIsland/island';
import { sceneLayout } from '../sceneLayout';
import { buildAuthoredGrowingGround, buildAuthoredGrowingSea, type AuthoredCoastSkin } from './authoredGrowingGround';

describe('authored ground does not fill the authored inlet', () => {
    it('renders the evaluated dry triangles, leaves water open and releases all ground resources', () => {
        const world = compileWorldDefinition(inletWorldDefinition()), layout = sceneLayout(newIsland('authored-ground', 0), false, world);
        const ground = buildAuthoredGrowingGround(layout); ground.root.updateMatrixWorld(true);
        for (const site of world.sites) {
            const p = layout.point(site.cell, 0), hit = new T.Raycaster(p.clone().add(new T.Vector3(0, 3, 0)), new T.Vector3(0, -1, 0)).intersectObject(ground.floor)[0];
            expect(hit).toBeDefined(); expect(hit.point.y).toBeCloseTo(p.y, 7); expect(layout.cellAt(hit.point)).toEqual(site.cell);
        }
        const water = new T.Vector3(1.45 - layout.center, 3, 1.1 - 2);
        expect(new T.Raycaster(water, new T.Vector3(0, -1, 0)).intersectObject(ground.floor)).toHaveLength(0);
        expect(ground.root.getObjectByName('native05-shore-bank')).toBeUndefined(); expect(ground.root.getObjectByName('garden-island-pedestal')).toBeUndefined();
        const disposed = vi.spyOn(ground.floor.geometry, 'dispose'); ground.dispose(); expect(disposed).toHaveBeenCalledOnce();
    });
    it('keeps the shipped coast skin tied to the original source and actual floor world, with no static owners', () => {
        const root = new URL('../../../../../docs/design/', import.meta.url);
        const manifest = JSON.parse(readFileSync(new URL('2026-10-11-authored-coast-skin/skin-manifest.json', root), 'utf8'));
        const gzip = readFileSync(new URL('2026-10-11-authored-coast-skin/native05-coast.json.gz', root));
        const bytes = gunzipSync(gzip), skin = JSON.parse(bytes.toString()) as AuthoredCoastSkin;
        const sha = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
        expect(sha(gzip)).toBe(manifest.artifact.gzipSha256); expect(sha(bytes)).toBe(manifest.artifact.sha256);
        expect(skin.parts).toHaveLength(10); expect(skin.parts.every(part => /^Coast \/ continuous layered shore|rounded living terrace|rounded flower terrace|shared sunny court|sheltered open room|open sky gathering court|shared waterfront court|shared frontage court/.test(part.name))).toBe(true);
        const definition = JSON.parse(gunzipSync(readFileSync(new URL('2026-10-11-authored-world-foundation/native05-world.json.gz', root))).toString()) as WorldDefinition;
        const world = compileWorldDefinition(definition), layout = sceneLayout(newIsland('native05-floor', 0), true, world), ground = buildAuthoredGrowingGround(layout, skin);
        expect(ground.root.children).toHaveLength(11);
        expect(ground.root.children.slice(1).every(part => part.userData.authoredCoastSkin && !part.userData.objectId && !part.userData.actorId)).toBe(true);
        for (const site of world.sites.filter(site => site.placement)) {
            const p = layout.point(site.cell, 0), hit = new T.Raycaster(p.clone().add(new T.Vector3(0, 5, 0)), new T.Vector3(0, -1, 0)).intersectObject(ground.floor)[0];
            expect(hit).toBeDefined(); expect(hit.point.y).toBeCloseTo(p.y, 5); expect(layout.cellAt(hit.point)).toEqual(site.cell);
        }
        expect(() => buildAuthoredGrowingGround(layout, { ...skin, worldId: 'another-source' })).toThrow(/sources differ/);
        ground.dispose();
    });
    it('uses an open sea in world units without a rectangular shoreline effect', () => {
        const world = compileWorldDefinition(inletWorldDefinition()), sea = buildAuthoredGrowingSea(sceneLayout(newIsland('sea', 0), false, world));
        const mesh = sea.root.getObjectByName('life-sea') as T.Mesh<T.PlaneGeometry, T.ShaderMaterial>;
        expect(mesh.geometry.parameters.width).toBeGreaterThanOrEqual(160); expect(mesh.position.y).toBe(-.4);
        expect(mesh.material.fragmentShader).not.toContain('shoreSize'); sea.animate(2000, false); expect(mesh.material.uniforms.at.value).toBe(2);
        sea.animate(2000, true); expect(mesh.material.uniforms.at.value).toBe(0); sea.dispose();
    });
});
