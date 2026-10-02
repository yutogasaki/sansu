import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { frameCamera, initialView } from './growingCamera';
import { sceneLayout } from './sceneLayout';

describe('district coordinates and camera clipping', () => {
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
