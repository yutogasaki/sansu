import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { cameraArtPoints, frameCamera, initialView } from './growingCamera';
import { sceneLayout } from './sceneLayout';
import { buildPlaceGround } from './placeGround';

describe('district coordinates and camera clipping', () => {
    it('fits actual curved shore, houses and hero geometry at every azimuth without the uniform empty sky allowance', () => {
        const layout = sceneLayout({ land: { expanded: 'east', extra: ['west', 'south'], capes: ['east', 'west'] } });
        const ground = buildPlaceGround(layout), owners = new T.Group();
        for (const cell of [{ x: 11, z: 4 }, { x: 4, z: 1 }, { x: 7, z: 2 }]) {
            const house = new T.Mesh(new T.BoxGeometry(.9, 1.5, .9), new T.MeshStandardMaterial());
            house.position.copy(layout.point(cell, .75)); owners.add(house);
        }
        const hero = new T.Mesh(new T.SphereGeometry(1, 24, 18), new T.MeshStandardMaterial());
        hero.scale.set(2.3, 2.575, 1.9); hero.position.copy(layout.point({ x: 7, z: 2 }, 2.575)); owners.add(hero);
        layout.cameraObjects = () => [ground.root, owners];
        const points = cameraArtPoints(layout.cameraObjects());
        const camera = new T.OrthographicCamera();
        for (const aspect of [390 / 844, 768 / 1024, 1280 / 720]) for (let step = 0; step < 24; step++) {
            const azimuth = step * Math.PI / 12;
            const view = { ...initialView(), azimuth }; frameCamera(camera, layout, view, aspect); camera.updateMatrixWorld();
            const extents = { minX: 1, maxX: -1, minY: 1, maxY: -1 };
            for (const point of points) {
                const p = point.clone().project(camera);
                expect(Math.abs(p.x)).toBeLessThanOrEqual(.900001); expect(Math.abs(p.y)).toBeLessThanOrEqual(.900001);
                extents.minX = Math.min(extents.minX, p.x); extents.maxX = Math.max(extents.maxX, p.x);
                extents.minY = Math.min(extents.minY, p.y); extents.maxY = Math.max(extents.maxY, p.y);
            }
            expect(Math.max(extents.maxX - extents.minX, extents.maxY - extents.minY)).toBeCloseTo(1.8, 5);
            expect(view).toEqual({ ...initialView(), azimuth });
        }
        ground.dispose();
    });
    it('excludes invisible selection targets, placement art, sea and distant boats while retaining real instanced models', () => {
        const root = new T.Group();
        for (const name of ['life-sea', 'growing-next-boat', 'growing-ghost']) {
            const model = new T.Mesh(new T.BoxGeometry(100, 100, 100), new T.MeshStandardMaterial()); model.name = name; root.add(model);
        }
        const hit = new T.Mesh(new T.BoxGeometry(100, 100, 100), new T.MeshBasicMaterial({ colorWrite: false })); root.add(hit);
        const hidden = new T.Group(); hidden.visible = false;
        hidden.add(new T.Mesh(new T.BoxGeometry(100, 100, 100), new T.MeshStandardMaterial())); root.add(hidden);
        const real = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial(), 2);
        real.setMatrixAt(0, new T.Matrix4().makeTranslation(3, 2, 4)); real.setMatrixAt(1, new T.Matrix4().makeTranslation(-2, 1, -3)); root.add(real);
        const points = cameraArtPoints([root]), box = new T.Box3().setFromPoints(points);
        expect(box.min.toArray()).toEqual([-2.5, .5, -3.5]); expect(box.max.toArray()).toEqual([3.5, 2.5, 4.5]);
    });
    it('fits an owned mature hero on the original land while preserving the original unbuilt garden frame', () => {
        const layout = sceneLayout({ land: { expanded: null, extra: [], capes: [] } }), ground = buildPlaceGround(layout), hero = new T.Group(); hero.name = 'place-root-room';
        const body = new T.Mesh(new T.SphereGeometry(1, 24, 18), new T.MeshStandardMaterial());
        body.scale.set(2.3, 2.8, 1.9); body.position.copy(layout.point({ x: 3, z: 2 }, 2.8)); hero.add(body);
        layout.cameraObjects = () => [ground.root, hero]; const points = cameraArtPoints(layout.cameraObjects()), camera = new T.OrthographicCamera();
        for (const aspect of [390 / 844, 768 / 1024, 1280 / 720]) for (let step = 0; step < 24; step++) {
            frameCamera(camera, layout, { ...initialView(), azimuth: step * Math.PI / 12 }, aspect); camera.updateMatrixWorld();
            for (const point of points) {
                const p = point.clone().project(camera); expect(Math.abs(p.x)).toBeLessThanOrEqual(.900001); expect(Math.abs(p.y)).toBeLessThanOrEqual(.900001);
            }
        }
        const original = sceneLayout({ land: { expanded: null, extra: [], capes: [] } });
        frameCamera(camera, original, initialView(), 1280 / 720);
        expect(camera.top).toBeCloseTo(Math.max((original.depth + 4.2 + original.maxHeight * .8) / 2 * .82,
            (original.width / 2 + original.artMargin) / (1280 / 720)), 10);
        ground.dispose(); body.geometry.dispose(); (body.material as T.Material).dispose();
    });
    it('keeps saved cells selectable and inside the clipping distance on a large island', () => {
        const layout = sceneLayout({ land: { expanded: 'east', extra: ['west', 'south'], capes: ['east', 'west'],
            districts: [...Array.from({ length: 20 }, () => 'south' as const), ...Array.from({ length: 20 }, () => 'west' as const)] } });
        const camera = new T.OrthographicCamera();
        for (const aspect of [390 / 844, 768 / 1024]) for (const azimuth of [0, Math.PI / 2, Math.PI]) {
            frameCamera(camera, layout, { ...initialView(), azimuth }, aspect);
            camera.updateMatrixWorld();
            for (const cell of [{ x: -66, z: 0 }, { x: 11, z: 67 }, { x: 11, z: 0 }, { x: -66, z: 67 }, { x: 2, z: 1 }]) {
                expect(layout.cellAt(layout.point(cell))).toEqual(cell);
                const point = layout.point(cell).project(camera);
                expect(Math.abs(point.x)).toBeLessThanOrEqual(1);
                expect(Math.abs(point.y)).toBeLessThanOrEqual(1);
                expect(Math.abs(point.z)).toBeLessThanOrEqual(1);
            }
        }
    });
});
