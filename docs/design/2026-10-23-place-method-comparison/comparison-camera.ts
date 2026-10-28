import * as T from 'three';

// Camera from the actual A overview in evidence/14-A-dom.json. Explicit visual
// diagnostic only: ordinary editing keeps the app's free camera when absent.
const matrix = new T.Matrix4().fromArray([
    .9255469562056767, 0, -.3786328457205041, 0,
    -.2077497339430649, .8360299122352683, -.5078326829719364, 0,
    .31654838477710295, .5486838669469785, .7737849405662516, 0,
    8.431386398020607, 14.482434863204427, 20.088499474122667, 1,
]);
export function fixedComparisonCamera(camera: T.OrthographicCamera, aspect: number): T.Vector3 | undefined {
    if (typeof window === 'undefined' || new URLSearchParams(window.location.search).get('trialCamera') !== 'fixed') return;
    const expanded = ['expanded', 'shore'].includes(new URLSearchParams(window.location.search).get('trialScene') ?? '');
    const half = (expanded ? 2.3 : 1) / .11397398623138763;
    camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half;
    camera.near = .1; camera.far = 100;
    matrix.decompose(camera.position, camera.quaternion, camera.scale);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    return camera.position.clone().addScaledVector(new T.Vector3(0, 0, -1).applyQuaternion(camera.quaternion), 20);
}
