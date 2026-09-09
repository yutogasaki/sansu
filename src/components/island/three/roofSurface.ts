import * as THREE from 'three';
import type { IslandAppearanceStyleId } from '../../../domain/island/appearance';

export const ISLAND_ROOF_SURFACE_CANDIDATE = 'island-roof-surface-v1';

const seamColors = new Map([
    ['#eb8a5a', '#dfb967'],
    ['#ed9967', '#f5dc9c'],
    ['#de7956', '#d3a760'],
    ['#e58259', '#ebca86'],
]);
const wrap = (value: number, period: number) => (value % period + period) % period;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** A flat color map for the existing roof UVs, not separate raised tiles. */
function makeRoofMap() {
    const size = 128, data = new Uint8Array(size * size * 4);
    const palette = [[247, 209, 107], [239, 164, 166], [140, 194, 179]];
    const rows = [[0, 1, 0, 0], [0, 0, 2, 0], [1, 0, 0, 2]];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        // Matching first/last samples avoid a line at the texture repeat seam.
        const u = wrap(x / (size - 1), 1), v = wrap(y / (size - 1), 1);
        const color = [210, 174, 115];
        // Lower rows first: the rounded end of the row above overlaps them.
        for (let row = 2; row >= -1; row--) {
            const rowId = wrap(row, 3), offset = rowId === 1 ? .5 : 0;
            const across = u * 4 - offset, column = Math.floor(across);
            const localX = across - column - .5, localY = v * 3 - row;
            if (localY < 0 || localY > 1.18) continue;
            const edge = localY > .74
                ? (1 - Math.hypot(localX / .48, (localY - .74) / .42)) * .42
                : Math.min(.48 - Math.abs(localX), localY);
            const coverage = clamp(edge / .03 + .5);
            if (coverage === 0) continue;
            const tile = palette[rows[rowId][wrap(column, 4)]];
            const shade = 1 - .045 * clamp(localY / 1.16);
            for (let channel = 0; channel < 3; channel++) {
                color[channel] += (tile[channel] * shade - color[channel]) * coverage;
            }
        }
        const at = (y * size + x) * 4;
        for (let channel = 0; channel < 3; channel++) data[at + channel] = Math.round(color[channel]);
        data[at + 3] = 255;
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.name = ISLAND_ROOF_SURFACE_CANDIDATE;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true; texture.needsUpdate = true;
    return texture;
}

/** The style pool owns source materials and one lazy texture. Callers may borrow
 * or clone materials; disposing a clone must not dispose this shared texture. */
export function createIslandRoofSurface(styleId: IslandAppearanceStyleId) {
    if (styleId !== 'legacy-v1:moon-garden:houseRoof') return;
    const materials = new Map<string, THREE.MeshStandardMaterial>();
    let texture: THREE.DataTexture | undefined, disposed = false;
    return {
        get texture() { return texture; },
        surface(sourceColor: string, roughness: number, metalness = 0, glow = false) {
            const source = sourceColor.toLowerCase(), face = source === '#c24f3e', seam = seamColors.get(source);
            if (disposed || glow || (!face && !seam)) return;
            const key = `${source}:${roughness}:${metalness}`;
            let material = materials.get(key);
            if (!material) {
                material = new THREE.MeshStandardMaterial({ color: face ? '#ffffff' : seam, roughness, metalness,
                    ...(face ? { map: texture ??= makeRoofMap() } : {}) });
                material.name = `${ISLAND_ROOF_SURFACE_CANDIDATE}:${face ? 'tiles' : source}`;
                materials.set(key, material);
            }
            return material;
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            materials.forEach(material => material.dispose()); materials.clear();
            texture?.dispose();
        },
    };
}
