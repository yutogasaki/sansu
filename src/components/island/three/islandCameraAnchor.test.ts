import { describe, expect, it } from 'vitest';
import { Matrix4, OrthographicCamera, Vector3 } from 'three';
import { hasChangedIslandCameraView, IslandCameraControls } from './islandCameraControls';
import { cameraPointOnGround, type CameraPanFraming } from './cameraPanFraming';

function rig(width: number) {
    const viewport = { left: 20, top: 80, width, height: 400 };
    const camera = new OrthographicCamera();
    let framing: CameraPanFraming;
    const controls = new IslandCameraControls(() => frame());
    function frame() {
        camera.position.set(9.4, 8.8, 10.77).applyAxisAngle(new Vector3(0, 1, 0), controls.view.azimuth);
        camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
        const m = camera.matrixWorldInverse.elements;
        // A changing authored fit must not pump the apparent size during rotation.
        framing = { height: 12 + Math.abs(Math.sin(controls.view.azimuth)) * 3, aspect: width / 400,
            center: { x: Math.sin(controls.view.azimuth), y: .7 },
            bounds: { minX: -100, maxX: 100, minY: -100, maxY: 100 }, regions: [],
            ground: { origin: { x: m[12], y: m[13] }, x: { x: m[0], y: m[1] }, z: { x: m[8], y: m[9] } } };
        const fit = controls.setFrame(framing);
        camera.left = fit.left; camera.right = fit.right; camera.top = fit.top; camera.bottom = fit.bottom;
        camera.updateProjectionMatrix();
    }
    frame();
    const ground = (x: number, y: number) => {
        const point = new Vector3((x - viewport.left) / width * 2 - 1, 1 - (y - viewport.top) / 400 * 2, 0)
            .applyMatrix4(new Matrix4().multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse));
        const direction = camera.getWorldDirection(new Vector3());
        return point.addScaledVector(direction, -point.y / direction.y);
    };
    return { controls, viewport, camera, ground };
}

describe('island ground focus during gestures', () => {
    it.each([390, 768])('keeps the actual ground under a moving twist/pinch midpoint at width %i', width => {
        const { controls, viewport, camera, ground } = rig(width);
        controls.action('in');
        const x = viewport.left + width * .6, y = viewport.top + 190;
        controls.down(1, { x: x - 40, y }); controls.down(2, { x: x + 40, y });
        const anchor = ground(x, y), initialHeight = camera.top - camera.bottom;
        for (let step = 1; step <= 12; step++) {
            const angle = step * Math.PI / 24, radius = 40 + step;
            const center = { x: x + step, y: y + step / 2 };
            controls.move(1, { x: center.x - radius * Math.cos(angle), y: center.y - radius * Math.sin(angle) }, viewport);
            controls.move(2, { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }, viewport);
            expect(ground(center.x, center.y).distanceTo(anchor)).toBeLessThan(1e-8);
            expect(camera.top - camera.bottom).toBeCloseTo(initialHeight * 40 / radius, 8);
        }
        expect(controls.view.azimuth).toBeCloseTo(Math.PI / 2);
        expect(hasChangedIslandCameraView(controls.view)).toBe(true);
        controls.action('reset');
        expect(hasChangedIslandCameraView(controls.view)).toBe(false);
    });

    it('ignores the small release wobble, then allows a deliberate one-finger drag without selecting', () => {
        const { controls, viewport } = rig(390);
        controls.down(1, { x: 150, y: 250 }); controls.down(2, { x: 230, y: 250 });
        controls.move(2, { x: 240, y: 270 }, viewport);
        controls.up(2, { x: 240, y: 270 });
        const before = structuredClone(controls.view);
        controls.move(1, { x: 152, y: 252 }, viewport);
        expect(controls.view).toEqual(before);
        controls.move(1, { x: 180, y: 270 }, viewport);
        expect(controls.view.pan).not.toEqual(before.pan);
        expect(controls.up(1, { x: 180, y: 270 })).toBe(false);
    });

    it('does not attempt an unstable ground intersection for a level camera', () => {
        expect(cameraPointOnGround({ height: 10, aspect: 1, center: { x: 0, y: 0 }, regions: [],
            bounds: { minX: -10, maxX: 10, minY: -10, maxY: 10 },
            ground: { origin: { x: 0, y: 0 }, x: { x: 1, y: 0 }, z: { x: 0, y: 0 } } }, { x: 0, y: 0 })).toBeUndefined();
    });
});
