import * as THREE from 'three';
import type { IslandAppearanceStyleId } from '../../../domain/island/appearance';

export const ISLAND_GRASS_SURFACE_CANDIDATE = 'island-grass-surface-v5';
export const ISLAND_GRASS_BLADE_HALF_LENGTH = [3, 6.5] as const;

/** Height only: short rounded blades with no albedo mottling or time input.
 * Wrapped stamps make a continuous tile; irregular positions/orientations avoid
 * a visible planting grid. One tiny height map is shared by all three caps. */
export function createIslandGrassSurface(base: THREE.MeshStandardMaterial, styleId: IslandAppearanceStyleId) {
    if (styleId !== 'legacy-v1:moon-garden:ground' || base.map || base.bumpMap || base.normalMap || base.displacementMap) return;
    const size = 128, height = new Float32Array(size * size).fill(.12);
    let seed = 0x6c61776e;
    const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 0x100000000;
    };
    for (let blade = 0; blade < 380; blade++) {
        const cx = random() * size, cy = random() * size, angle = random() * Math.PI * 2;
        const halfLength = ISLAND_GRASS_BLADE_HALF_LENGTH[0]
            + random() * (ISLAND_GRASS_BLADE_HALF_LENGTH[1] - ISLAND_GRASS_BLADE_HALF_LENGTH[0]);
        const halfWidth = 1.1 + random() * 1.1, rise = .28 + random() * .38;
        const sin = Math.sin(angle), cos = Math.cos(angle), bound = Math.ceil(halfLength + halfWidth);
        for (let y = Math.floor(cy) - bound; y <= Math.ceil(cy) + bound; y++) {
            for (let x = Math.floor(cx) - bound; x <= Math.ceil(cx) + bound; x++) {
                const dx = x + .5 - cx, dy = y + .5 - cy;
                const u = (cos * dx + sin * dy) / halfLength, v = (-sin * dx + cos * dy) / halfWidth;
                const dome = Math.max(0, 1 - u * u - v * v);
                if (dome === 0) continue;
                const index = ((y % size + size) % size) * size + ((x % size + size) % size);
                height[index] = Math.max(height[index], .12 + rise * dome * dome);
            }
        }
    }
    const data = Uint8Array.from(height, value => Math.round(value * 255));
    const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat);
    texture.name = ISLAND_GRASS_SURFACE_CANDIDATE;
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(.25, .25); // Existing UVs span 1.15 world units; one height tile now spans 4.6.
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true; texture.needsUpdate = true;
    const material = base.clone();
    material.name = ISLAND_GRASS_SURFACE_CANDIDATE;
    // Three perturbs the normal from adjacent screen-space height samples;
    // this response scale is not a displacement or a world-space blade height.
    material.bumpMap = texture; material.bumpScale = 1.2;
    let disposed = false;
    return { material, texture, dispose() {
        if (disposed) return;
        disposed = true; material.dispose(); texture.dispose();
    } };
}
