import * as T from 'three';

export function projectedDiameter(camera: T.Camera, diameter: number, distance: number, height: number) {
    if (camera instanceof T.OrthographicCamera) return diameter * height * camera.zoom / (camera.top - camera.bottom);
    if (camera instanceof T.PerspectiveCamera) return diameter * height * camera.zoom / (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * Math.max(distance, .001));
    return Infinity;
}
export const selectFarAsset = (pixels: number, wasFar: boolean) => pixels < (wasFar ? 32 : 24);
