import * as T from 'three';
import type { GardenGround } from './garden';

/** DEV comparison only (?island-sea=coast): the sea learns the island's real coast,
 * from the grow-lab prototype. It reads ground heights and writes nothing. */
export const coastSeaEnabled = () => import.meta.env.DEV && typeof location !== 'undefined'
    && new URLSearchParams(location.search).get('island-sea') === 'coast';

const PER_CELL = 4, MARGIN = 7, SEA_LEVEL = -.40;

/** A soft land mask around the owned cells: 1 on land, fading to 0 about two cells out to sea.
 * `frame` is the mask's origin and size in the garden's own space, taken from where cells are drawn. */
export function coastMask(ground: GardenGround, point: (cell: { x: number; z: number }) => T.Vector3) {
    const { bounds } = ground;
    const cellsX = bounds.maxX - bounds.minX + 1 + MARGIN * 2, cellsZ = bounds.depth + MARGIN * 2;
    const w = cellsX * PER_CELL, h = cellsZ * PER_CELL;
    let land = new Float32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const x = bounds.minX - MARGIN + Math.floor(i / PER_CELL), z = -MARGIN + Math.floor(j / PER_CELL);
        const owned = x >= bounds.minX && x <= bounds.maxX && z >= 0 && z < bounds.depth;
        land[i + j * w] = owned && (ground.heightAt?.({ x, z }) ?? 0) > SEA_LEVEL ? 1 : 0;
    }
    // The drawn shore stands about three quarters of a cell out from the owned cells,
    // so the land grows by that much before three box blurs each way soften it.
    const grow = new Float32Array(w * h), reach = 3;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        let v = 0;
        for (let b = Math.max(0, j - reach); b <= Math.min(h - 1, j + reach) && !v; b++)
            for (let a = Math.max(0, i - reach); a <= Math.min(w - 1, i + reach); a++) if (land[a + b * w]) { v = 1; break; }
        grow[i + j * w] = v;
    }
    land = grow;
    const blur = (from: Float32Array, dx: number, dy: number) => {
        const to = new Float32Array(w * h), r = 5;
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
            let sum = 0;
            for (let k = -r; k <= r; k++) {
                const a = Math.min(w - 1, Math.max(0, i + k * dx)), b = Math.min(h - 1, Math.max(0, j + k * dy));
                sum += from[a + b * w];
            }
            to[i + j * w] = sum / (r * 2 + 1);
        }
        return to;
    };
    for (let pass = 0; pass < 3; pass++) land = blur(blur(land, 1, 0), 0, 1);
    const pixels = new Uint8Array(w * h);
    for (let k = 0; k < w * h; k++) pixels[k] = Math.round(land[k] * 255);
    const texture = new T.DataTexture(pixels, w, h, T.RedFormat, T.UnsignedByteType);
    texture.magFilter = texture.minFilter = T.LinearFilter; texture.needsUpdate = true;
    const origin = point({ x: bounds.minX, z: 0 }), step = new T.Vector2(point({ x: bounds.minX + 1, z: 0 }).x - origin.x, point({ x: bounds.minX, z: 1 }).z - origin.z);
    const frame = new T.Vector4(origin.x - (MARGIN + .5) * step.x, origin.z - (MARGIN + .5) * step.y, cellsX * step.x, cellsZ * step.y);
    return { texture, frame };
}

/** Replaces the elliptical shore with shallows, lapping foam and broken surf that follow the mask. */
export const COAST_SEA_FRAGMENT = `
            vec2 world=vec2(q.x,coastCenterZ-q.y);
            vec2 coastUv=(world-coastFrame.xy)/coastFrame.zw;
            float near=all(greaterThan(coastUv,vec2(0.)))&&all(lessThan(coastUv,vec2(1.)))?texture2D(coastLand,coastUv).r:0.;
            color=mix(deep,shallow,smoothstep(.02,.32,near)*.9+waves*.025);
            float lap=.5+.5*sin(at*1.6-near*14.+sin(world.x*1.3+world.y)*1.5);
            color=mix(color,vec3(1.),smoothstep(.27+.06*lap,.4,near)*.6);
            float roll=fract(at*.18+sin(world.x*.9+world.y*.6)*.08);
            float pieces=smoothstep(.1,.7,sin(world.x*1.7+world.y*1.1+at*.4)*sin(world.x*.9-world.y*1.4-at*.3)+.35);
            color=mix(color,vec3(1.),(1.-smoothstep(0.,.025,abs(near-(.12+roll*.13))))*pieces*(1.-roll)*.25);`;
