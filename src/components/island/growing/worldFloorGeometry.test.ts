import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { compileWorldDefinition } from '../../../domain/growingIsland/worldDefinition';
import { inletWorldDefinition } from '../../../domain/growingIsland/worldDefinition.fixture';
import { worldFloorGeometry } from './worldFloorGeometry';

describe('rendered floor and world evaluation', () => {
    it('supports feet and inverse placement on the actual irregular mesh, leaving the inlet open', () => {
        const world = compileWorldDefinition(inletWorldDefinition()), origin = { x: 5.5, z: 3.5 };
        const geometry = worldFloorGeometry(world, origin), material = new T.MeshBasicMaterial({ side: T.DoubleSide });
        const mesh = new T.Mesh(geometry, material); mesh.updateMatrixWorld(true);
        const hit = (point: { x: number; z: number }) => new T.Raycaster(new T.Vector3(point.x - origin.x, 10, point.z - origin.z), new T.Vector3(0, -1, 0)).intersectObject(mesh)[0];
        for (const site of world.sites) for (const [dx, dz] of [[0, 0], [.17, -.13], [-.21, .31]]) {
            const floor = world.floorAt({ x: site.cell.x + dx, z: site.cell.z + dz })!, real = hit(floor.point);
            expect(real).toBeDefined(); expect(real.point.y).toBeCloseTo(floor.point.y, 6);
            const placement = world.siteAt({ x: real.point.x + origin.x, y: real.point.y, z: real.point.z + origin.z });
            expect(placement?.ref).toEqual(site.ref);
        }
        expect(hit({ x: 1.45, z: 1.1 })).toBeUndefined();
        geometry.dispose(); material.dispose();
    });
});
