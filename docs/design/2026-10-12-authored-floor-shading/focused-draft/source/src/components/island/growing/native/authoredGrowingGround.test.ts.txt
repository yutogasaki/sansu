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
    it('keeps source normals and per-floor materials without changing drawn triangles or pointer support', () => {
        const definition = inletWorldDefinition(), original = definition.districts[0], state = newIsland('floor-shading', 0);
        const legacyDeck = { ...original.floors[0], id: 'legacy-deck', kind: 'deck' as const,
            vertices: original.floors[0].vertices.map(vertex => ({ cell: { ...vertex.cell, x: vertex.cell.x + 20 },
                point: { ...vertex.point, x: vertex.point.x + 20 } })) };
        const district = { ...original, floors: [...original.floors, legacyDeck] }; definition.districts = [district];
        const before = buildAuthoredGrowingGround(sceneLayout(state, false, compileWorldDefinition(definition)));
        const sourceNormal = { x: .2, y: .9, z: .3 };
        const afterWorld = compileWorldDefinition({ ...definition, districts: [{ ...district, floors: district.floors.map((floor, i) => i ? floor : ({ ...floor,
            vertices: floor.vertices.map(vertex => ({ ...vertex, normal: sourceNormal })),
            material: { roughness: .78, metalness: .04, doubleSided: true } })) }] });
        const layout = sceneLayout(state, false, afterWorld), after = buildAuthoredGrowingGround(layout);
        expect(Array.from(after.floor.geometry.getAttribute('position').array)).toEqual(Array.from(before.floor.geometry.getAttribute('position').array));
        expect(Array.from(after.floor.geometry.index!.array)).toEqual(Array.from(before.floor.geometry.index!.array));
        expect(Array.from(after.floor.geometry.getAttribute('color').array)).toEqual(Array.from(before.floor.geometry.getAttribute('color').array));
        const normal = after.floor.geometry.getAttribute('normal');
        for (let i = 0; i < district.floors[0].vertices.length; i++) {
            expect([normal.getX(i), normal.getY(i), normal.getZ(i)]).toEqual(Array.from(new Float32Array([.2, .9, .3])));
        }
        const materials = Array.isArray(after.floor.material) ? after.floor.material : [after.floor.material];
        expect(materials[0]).toMatchObject({ roughness: .78, metalness: .04, side: T.DoubleSide });
        expect(materials[1]).toMatchObject({ roughness: .95, metalness: 0, side: T.FrontSide });
        for (let i = district.floors[0].vertices.length; i < normal.count; i++) {
            const fallback = before.floor.geometry.getAttribute('normal');
            expect([normal.getX(i), normal.getY(i), normal.getZ(i)]).toEqual([fallback.getX(i), fallback.getY(i), fallback.getZ(i)]);
        }
        const renderedFloors = afterWorld.floors.filter(floor => floor.kind !== 'water');
        expect(after.floor.geometry.groups.map(group => group.count)).toEqual(renderedFloors.map(floor => floor.indices.length));
        after.root.updateMatrixWorld(true);
        for (const site of afterWorld.sites) {
            const point = layout.point(site.cell, 0), ray = new T.Raycaster(point.clone().add(new T.Vector3(0, 3, 0)), new T.Vector3(0, -1, 0));
            expect(ray.intersectObject(after.floor)[0]?.point.y).toBeCloseTo(point.y, 7);
        }
        const disposed = materials.map(material => vi.spyOn(material, 'dispose'));
        after.dispose(); before.dispose(); disposed.forEach(spy => expect(spy).toHaveBeenCalledOnce());
    });

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
