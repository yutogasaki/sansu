import * as THREE from 'three';

/** Broad pressed squares remain legible from the whole-island camera. The
 * texture is baked color on level ground; it adds no step or walking obstacle. */
export function createBiscuitGroundSurface() {
    const size = 128, data = new Uint8Array(size * size * 4);
    const center = [240, 199, 128], groove = [187, 125, 61], rim = [255, 226, 172];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const u = (x + .5) / size, v = (y + .5) / size;
        const edge = Math.min(u, v, 1 - u, 1 - v);
        const color = edge < .038 ? groove : edge < .09 ? rim : center;
        // A smooth toasted edge makes each pressed square read as one surface.
        const shade = edge < .09 ? 1 : .94 + .06 * Math.min(1, (edge - .09) / .22);
        const index = (y * size + x) * 4;
        data.set([...color.map(value => Math.round(value * shade)), 255], index);
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.name = 'biscuit-ground-v1'; texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true; texture.needsUpdate = true;
    const material = new THREE.MeshStandardMaterial({ color: '#ffffff', map: texture, roughness: .98 });
    material.name = 'biscuit-ground-v1';
    return { material, dispose() { material.dispose(); texture.dispose(); } };
}
