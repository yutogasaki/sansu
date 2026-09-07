import * as THREE from 'three';

export function boxCorners(bounds: THREE.Box3) {
    return [bounds.min.x, bounds.max.x].flatMap(x => [bounds.min.y, bounds.max.y]
        .flatMap(y => [bounds.min.z, bounds.max.z].map(z => new THREE.Vector3(x, y, z))));
}

/** Fit a captured learning envelope once; ordinary answers never move the camera. */
export function fitLearningFrame(camera: THREE.OrthographicCamera, bounds: THREE.Box3[], aspect: number, minimumWidth: number) {
    const points = bounds.filter(box => !box.isEmpty()).flatMap(boxCorners);
    if (!points.length) return;
    camera.updateMatrixWorld(true);
    const projected = new THREE.Box3().setFromPoints(points.map(point => point.applyMatrix4(camera.matrixWorldInverse)));
    const size = projected.getSize(new THREE.Vector3()), center = projected.getCenter(new THREE.Vector3());
    const height = Math.max(minimumWidth / aspect, size.y / .86, size.x / (aspect * .9));
    // Preserve the familiar focus where it already fits; shift only enough to protect
    // the full residents, including ears and soles, with breathing room at both edges.
    const fitCenter = (low: number, high: number, half: number, preferred: number) =>
        THREE.MathUtils.clamp(preferred, high - half, low + half);
    const x = fitCenter(projected.min.x, projected.max.x, height * aspect * .45, 0);
    const y = fitCenter(projected.min.y, projected.max.y, height * .43, 0);
    camera.left = x - height * aspect / 2; camera.right = x + height * aspect / 2;
    camera.top = y + height / 2; camera.bottom = y - height / 2;
    camera.updateProjectionMatrix();
    return { center, width: height * aspect, height };
}

/** Camera-space bounds also retain depth, unlike a screen rectangle alone. */
export function cameraBounds(object: THREE.Object3D, camera: THREE.Camera) {
    object.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3(), transform = new THREE.Matrix4();
    object.traverseVisible(child => {
        if (!(child instanceof THREE.Mesh)) return;
        if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
        if (!child.geometry.boundingBox) return;
        transform.multiplyMatrices(camera.matrixWorldInverse, child.matrixWorld);
        for (const point of boxCorners(child.geometry.boundingBox)) bounds.expandByPoint(point.applyMatrix4(transform));
    });
    return bounds;
}

export function occludesPreview(preview: THREE.Box3, other: THREE.Box3) {
    return other.max.x > preview.min.x && other.min.x < preview.max.x
        && other.max.y > preview.min.y && other.min.y < preview.max.y
        && other.max.z > preview.min.z;
}
