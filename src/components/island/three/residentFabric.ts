import * as THREE from 'three';

export const RESIDENT_VISUAL_CANDIDATE = 'patchwork-otter-v1';
export const FABRIC_PANELS = ['head', 'body', 'tealDots', 'roseDots', 'goldStripes', 'cream', 'navyDots', 'sole'] as const;
export type FabricPanel = typeof FABRIC_PANELS[number];
const TILE = 256, GUTTER = 4, COLUMNS = 4, ROWS = 2;
type RGB = readonly [number, number, number];
const cream: RGB = [250, 229, 186], ink: RGB = [38, 35, 51], blue: RGB = [32, 114, 195];
const rose: RGB = [221, 67, 121], teal: RGB = [24, 154, 151], gold: RGB = [250, 185, 39];
const thread: RGB = [255, 207, 93];
const fract = (n: number) => n - Math.floor(n);

function dots(u: number, v: number, base: RGB, spot: RGB, columns = 7): RGB {
    const row = Math.floor(v * 5);
    return Math.hypot(fract(u * columns + row % 2 * .5) - .5, fract(v * 5) - .5) < .20 ? spot : base;
}

/** Authored cloth pieces, not random per-frame paint. The large cuts survive
 * the island crop; weave and raised stitches are visible when the camera is near. */
function swatch(panel: FabricPanel, u: number, v: number): { color: RGB; seam?: number; along?: number } {
    switch (panel) {
        case 'head': {
            // The SphereGeometry front is u=.25. Its two facial halves have
            // plain fabric so markings cannot be confused with eyes or mouth.
            const cut = .255 + Math.sin(v * Math.PI) * .012;
            const backCut = .755;
            const color = u < cut || u > backCut ? cream : blue;
            return { color, seam: Math.abs(u - cut) < Math.abs(u - backCut) ? u - cut : u - backCut, along: v };
        }
        case 'body': {
            const vertical = u - .27, diagonal = v - (.34 + u * .48);
            const color = u > .53 ? dots(u, v, teal, cream, 6) : vertical < 0
                ? (v > .37 ? (fract(v * 7) < .33 ? ink : cream) : rose)
                : diagonal < 0 ? gold : blue;
            const seams = [{ distance: vertical, along: v }, { distance: u - .53, along: v },
                { distance: u < .5 ? u : u - 1, along: v }];
            if (u < .53) seams.push({ distance: u < .27 ? v - .37 : diagonal, along: u * 1.5 });
            const seam = seams.reduce((closest, next) => Math.abs(next.distance) < Math.abs(closest.distance) ? next : closest);
            return { color, seam: seam.distance, along: seam.along };
        }
        case 'tealDots': return { color: dots(u, v, teal, ink, 6) };
        case 'roseDots': return { color: dots(u, v, rose, [250, 138, 160], 6) };
        case 'goldStripes': return { color: fract(v * 6) < .29 ? ink : gold };
        case 'navyDots': return { color: dots(u, v, ink, cream, 5) };
        case 'sole': return { color: v < .46 ? gold : rose, seam: v - .46, along: u * 1.5 };
        case 'cream': return { color: cream };
    }
}

export function createResidentFabric() {
    const width = TILE * COLUMNS, height = TILE * ROWS;
    const colors = new Uint8Array(width * height * 4), relief = new Uint8Array(width * height * 4);
    for (let panelIndex = 0; panelIndex < FABRIC_PANELS.length; panelIndex++) {
        const panel = FABRIC_PANELS[panelIndex];
        for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
            // Duplicate edge texels in a gutter so atlas mipmaps never borrow
            // the adjacent cloth's color at a foot, hand or pole.
            const sx = Math.max(GUTTER, Math.min(TILE - GUTTER - 1, x));
            const sy = Math.max(GUTTER, Math.min(TILE - GUTTER - 1, y));
            const u = (sx - GUTTER + .5) / (TILE - GUTTER * 2), v = (sy - GUTTER + .5) / (TILE - GUTTER * 2);
            const sample = swatch(panel, u, v);
            const grain = ((sx * 73 + sy * 151 + sx * sy * 19) % 37) / 36 - .5;
            const weave = Math.sin(sx * Math.PI / 2) * Math.cos(sy * Math.PI / 2);
            const stitch = sample.seam !== undefined && Math.abs(sample.seam) < .018
                && fract((sample.along ?? v) * 17 + sample.seam * 7) < .14;
            const groove = sample.seam !== undefined && Math.abs(sample.seam) < .0035;
            const rgb = stitch ? thread : sample.color;
            const shade = stitch ? 1 : groove ? .64 : 1 + weave * .026 + grain * .065;
            const bump = stitch ? 233 : groove ? 62 : 133 + weave * 27 + grain * 22;
            const index = ((Math.floor(panelIndex / COLUMNS) * TILE + y) * width + panelIndex % COLUMNS * TILE + x) * 4;
            for (let channel = 0; channel < 3; channel++) {
                colors[index + channel] = Math.min(255, Math.max(0, Math.round(rgb[channel] * shade)));
                relief[index + channel] = Math.round(bump);
            }
            colors[index + 3] = relief[index + 3] = 255;
        }
    }
    const texture = (bytes: Uint8Array, colorSpace: THREE.ColorSpace) => {
        const result = new THREE.DataTexture(bytes, width, height, THREE.RGBAFormat);
        result.colorSpace = colorSpace;
        result.magFilter = THREE.LinearFilter; result.minFilter = THREE.LinearMipmapLinearFilter;
        result.generateMipmaps = true; result.needsUpdate = true;
        return result;
    };
    const map = texture(colors, THREE.SRGBColorSpace), bumpMap = texture(relief, THREE.NoColorSpace);
    const material = new THREE.MeshStandardMaterial({ color: '#ffffff', map, bumpMap, bumpScale: .006,
        roughness: .98, metalness: 0 });
    material.name = RESIDENT_VISUAL_CANDIDATE;
    return { material, dispose: () => { material.dispose(); map.dispose(); bumpMap.dispose(); } };
}

/** Keep every moving mesh and its contact anchors. Only UVs and material change,
 * so the same fabric follows the hand, planted foot and existing seat pose. */
export function applyFabricPanel(object: THREE.Mesh, panel: FabricPanel, material: THREE.Material) {
    const index = FABRIC_PANELS.indexOf(panel), uv = object.geometry.getAttribute('uv');
    if (!uv) throw new Error(`Resident fabric requires UVs: ${panel}`);
    for (let i = 0; i < uv.count; i++) {
        const u = GUTTER / TILE + uv.getX(i) * (1 - 2 * GUTTER / TILE);
        const v = GUTTER / TILE + uv.getY(i) * (1 - 2 * GUTTER / TILE);
        uv.setXY(i, (index % COLUMNS + u) / COLUMNS, (Math.floor(index / COLUMNS) + v) / ROWS);
    }
    uv.needsUpdate = true;
    object.material = material;
    object.userData.fabricPanel = panel;
    return object;
}
