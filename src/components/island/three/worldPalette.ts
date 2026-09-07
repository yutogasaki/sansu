import * as THREE from 'three';

export type IslandArtDirection = 'festival' | 'moon-garden' | 'prism';
export const ISLAND_ART_DIRECTIONS: IslandArtDirection[] = ['festival', 'moon-garden', 'prism'];

export function currentIslandArtDirection(): IslandArtDirection {
    const requested = (import.meta.env.DEV && typeof location !== 'undefined'
        ? new URLSearchParams(location.search).get('island-art') : undefined) ?? import.meta.env.VITE_ISLAND_ART_DIRECTION;
    return ISLAND_ART_DIRECTIONS.includes(requested as IslandArtDirection) ? requested as IslandArtDirection : 'moon-garden';
}

const palettes = {
    festival: { sea: '#1abaca', deep: '#168fc7', grass: '#7ace35', leaf: '#00a779', leafLight: '#61d46d',
        leafAccent: '#ff55ad', roof: '#ff4b61', trim: '#ffd447', wood: '#f0a73b', ink: '#292341', stone: '#899adb', sand: '#ffdb86' },
    'moon-garden': { sea: '#4370e6', deep: '#304cad', grass: '#39c4a7', leaf: '#9f48d5', leafLight: '#df6cbc',
        leafAccent: '#ffcc40', roof: '#ffd447', trim: '#f75aa4', wood: '#e79b50', ink: '#292341', stone: '#9580ca', sand: '#ffc58e' },
    prism: { sea: '#23bfd5', deep: '#227bcb', grass: '#a0d64c', leaf: '#2d9bbb', leafLight: '#47d2ad',
        leafAccent: '#f968ac', roof: '#e9549b', trim: '#ffbc37', wood: '#ee9551', ink: '#292341', stone: '#b59bd5', sand: '#ffe29a' },
} as const;

/** Curated world paint keys. Fur, eyes, facial features and learning diagrams are not recolored. */
export function islandWorldColor(source: string, direction: IslandArtDirection) {
    const p = palettes[direction];
    const groups: [string[], string][] = [
        [['#76cdd3', '#78d5d5'], p.sea], [['#43a9c5'], p.deep],
        [['#72ab50'], p.grass], [['#76d3c9'], '#75e9da'],
        [['#4e8843', '#649c46', '#67994a', '#5e9d63'], p.leaf],
        [['#76a84d', '#77a854', '#7caf4b', '#75ae66'], p.leafLight],
        [['#86b557'], p.leafAccent], [['#77ab4d'], direction === 'festival' ? '#15b6ad' : p.leaf],
        [['#c24f3e', '#dc7c62', '#dc795d'], p.roof],
        [['#eb8a5a', '#ed9967', '#de7956', '#e58259', '#426857', '#4d7e62', '#687c71'], p.ink],
        [['#dfb37b', '#e9b768', '#d6a76e', '#e7bb7c', '#d9ab6b'], p.trim],
        [['#bc8a4d', '#c89d5f', '#ba7b49', '#b77640', '#b78552', '#a97b4b'], p.wood],
        [['#e4c48a', '#e5d3a2', '#ecd2a0'], p.sand],
        [['#939d85', '#9ca99e', '#b9b9a2', '#8eaaa3', '#cdd3b9'], p.stone],
        [['#f7e8c6', '#f6eacb', '#dcceab', '#d5dac3'], '#fff1bf'],
        [['#67c9bf', '#b3efde', '#c0eee1', '#79b6ac', '#80b5b5'], '#60dcf2'],
        [['#f39482'], '#f24e9c'], [['#ffd06c', '#d99635'], '#ffbf27'],
        [['#638f48', '#467343', '#4d8c50'], '#087f6a'], [['#76a85b', '#76aa53'], '#32bb83'],
        [['#6baba0'], '#16bfa7'], [['#9faebf'], '#788ae3'],
    ];
    return groups.find(([keys]) => keys.includes(source.toLowerCase()))?.[1] ?? source;
}

/** Three small repeatable paint surfaces, generated once without raster/model downloads. */
export function makeWorldPattern(source: string, direction: IslandArtDirection): THREE.DataTexture | undefined {
    const pattern = source === '#c24f3e' ? 'patchwork' : source === '#86b557' || source === '#dc795d' ? 'dots' : undefined;
    if (!pattern) return;
    const p = palettes[direction], size = 128;
    const rgb = (hex: string) => [1, 3, 5].map(start => Number.parseInt(hex.slice(start, start + 2), 16));
    const base = rgb(islandWorldColor(source, direction)), ink = rgb(p.ink), gold = rgb(p.trim), aqua = rgb(p.sea);
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const u = (x + .5) / size, v = (y + .5) / size;
        let color = base;
        if (pattern === 'dots') {
            const row = Math.floor(v * 3), px = ((u * 3 + row % 2 * .5) % 1) - .5, py = v * 3 % 1 - .5;
            if (Math.hypot(px, py) < .19) color = source === '#dc795d' ? ink : gold;
        } else {
            const division = u + v;
            if (division < .75) color = gold;
            else if (division > 1.3) color = aqua;
            if (Math.abs(division - .75) < .016 || Math.abs(division - 1.3) < .016) color = ink;
            if (division < .7 && Math.hypot(u * 4 % 1 - .5, v * 4 % 1 - .5) < .14) color = ink;
            if (division > 1.35 && (u - v + 2) * 6 % 1 < .12) color = ink;
        }
        const i = (y * size + x) * 4;
        data.set([...color, 255], i);
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
}
