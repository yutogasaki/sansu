import * as T from 'three';
import type { AuthoredWaterPool } from '../../../../domain/growingIsland/authoredWaterWorld';
import type { CompiledWorldFloor } from '../../../../domain/growingIsland/worldDefinition';
import type { SceneLayout } from '../sceneLayout';
import source from '../../../../domain/growingIsland/nativeWaterSource.json';

// Native05's graduated blue pools and pale aqua flow highlights. Geometry and
// pointer support still come entirely from the evaluated world floor.
const deep = new T.Color(source.water.deepColor), shallow = new T.Color(source.water.shoreColor);
function distanceToShore(point: { x: number; z: number }, pool: AuthoredWaterPool) {
    return Math.min(...pool.outline.map((a, i) => {
        const b = pool.outline[(i + 1) % pool.outline.length], dx = b.x - a.x, dz = b.z - a.z;
        const t = T.MathUtils.clamp(((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
        return Math.hypot(point.x - a.x - dx * t, point.z - a.z - dz * t);
    }));
}

export function colorAuthoredWater(geometry: T.BufferGeometry, floor: CompiledWorldFloor, pool?: AuthoredWaterPool) {
    if (!pool) return false;
    const colors = floor.vertices.flatMap(vertex => {
        const depth = T.MathUtils.smoothstep(distanceToShore(vertex.point, pool), .015, Math.max(.12, pool.radius * .55));
        return shallow.clone().lerp(deep, depth).toArray();
    });
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    return true;
}

/** Optical strokes are emitted only above an actual triangle of this pool.
 * They cannot create support, mask a missing trench, or become pointer targets. */
export function buildAuthoredPoolRipples(layout: SceneLayout, pool: AuthoredWaterPool, floor: CompiledWorldFloor) {
    const geometry = new T.BufferGeometry(), positions: number[] = [];
    const actualWaterAt = (x: number, z: number): number | undefined => {
        for (let i = 0; i < floor.indices.length; i += 3) {
            const [a, b, c] = floor.indices.slice(i, i + 3).map(index => floor.vertices[index].point);
            const det = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
            if (Math.abs(det) < 1e-12) continue;
            const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / det;
            const v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / det;
            if (u >= -1e-7 && v >= -1e-7 && u + v <= 1 + 1e-7) return u * a.y + v * b.y + (1 - u - v) * c.y;
        }
    };
    for (const [ring, scale] of [.42, .64].entries()) {
        let previous: number[] | undefined;
        for (let i = 0; i <= pool.outline.length; i++) {
            // Leave a broad quiet opening; the water, rather than a white
            // concentric symbol, remains the dominant mass from the whole view.
            const phase = i / pool.outline.length;
            if (phase < .13 + ring * .14 || phase > .7 + ring * .14) { previous = undefined; continue; }
            const edge = pool.outline[i % pool.outline.length];
            const x = pool.center.x + (edge.x - pool.center.x) * scale, z = pool.center.z + (edge.z - pool.center.z) * scale;
            const y = actualWaterAt(x, z);
            if (y === undefined) { previous = undefined; continue; }
            const point = [x - layout.center, y + .003, z - 2];
            if (previous) positions.push(...previous, ...point);
            previous = point;
        }
    }
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    const material = new T.LineBasicMaterial({ color: '#a9e4df', transparent: true, opacity: .55, depthWrite: false });
    const strokes = new T.LineSegments(geometry, material);
    strokes.name = 'authored-water-ripples'; strokes.raycast = () => {};
    return { strokes, dispose() { geometry.dispose(); material.dispose(); } };
}
