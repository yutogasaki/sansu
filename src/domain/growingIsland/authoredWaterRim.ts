import { decomposeWaterOutline, subtractWaterConvexPieces, type WaterOutline } from './authoredWaterContour';
import type { WorldPoint, WorldSurface } from './worldTypes';

interface RimRing { scale: number; height: number }
interface RimMaterial { color: string; roughness: number }
export function scaledWaterOutline(outline: WaterOutline, center: WorldPoint, scale: number): WorldPoint[] {
    return outline.map(p => ({ x: center.x + (p.x - center.x) * scale, y: p.y, z: center.z + (p.z - center.z) * scale }));
}
/** Four source-profile rings create three independently coloured slopes.
 * The outer base is sampled from real ground; the other heights follow water.
 * All bands are non-supporting surfaces, including their open stream mouths. */
export function buildWaterRim({ id, outline, center, waterY, rings, groundAt, mouths, body, lip }: {
    id: string; outline: WaterOutline; center: WorldPoint; waterY: number; rings: readonly RimRing[];
    groundAt: (point: WorldPoint) => number | undefined; mouths: readonly WaterOutline[]; body: RimMaterial; lip: RimMaterial;
}): WorldSurface[] | undefined {
    const rows = rings.map((ring, row) => scaledWaterOutline(outline, center, ring.scale).map(p => {
        const y = row === 0 ? groundAt(p) : waterY + ring.height;
        return y === undefined ? undefined : { ...p, y };
    }));
    if (rows.some(row => row.some(point => !point))) return;
    const mouthPieces = mouths.flatMap(decomposeWaterOutline);
    const result: WorldSurface[] = [];
    for (let band = 0; band + 1 < rows.length; band++) {
        const vertices: WorldPoint[] = [], indices: number[] = [];
        for (let i = 0; i < outline.length; i++) {
            const next = (i + 1) % outline.length;
            const quad = [rows[band][i]!, rows[band][next]!, rows[band + 1][next]!, rows[band + 1][i]!];
            for (const triangle of [[quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]]) {
                for (const polygon of subtractWaterConvexPieces(triangle, mouthPieces)) {
                    const offset = vertices.length; vertices.push(...polygon);
                    for (let vertex = 1; vertex + 1 < polygon.length; vertex++) indices.push(offset, offset + vertex, offset + vertex + 1);
                }
            }
        }
        if (indices.length) result.push({ id: `${id}:${band}`, kind: 'bank', vertices, indices,
            material: { ...(band === 1 ? lip : body), metalness: 0 } });
    }
    return result;
}
