import * as T from 'three';
import { canopyMaterialStudy } from './canopyMaterialStudy';

export type ShoreStudy = 'lagoon' | 'tidal' | 'shelf';
const requested = import.meta.env.VITE_CANOPY_SHORE_STUDY;
export const canopyShoreStudy: ShoreStudy | undefined = canopyMaterialStudy
    && (requested === 'lagoon' || requested === 'tidal' || requested === 'shelf') ? requested : undefined;

/** ExtrudeGeometry is rotated -PI/2 around X: source Y becomes negative world Z. */
export const coastWorldOutline = (points: readonly T.Vector2[]) => points.map(p => new T.Vector2(p.x, -p.y));

/** A world-space distance field from the same polygon used to extrude the coast.
 * Keep per-pixel GPU work constant, independent of the number of coastline segments. */
export function coastDistanceField(points: readonly T.Vector2[], offsetZ: number, size = 128) {
    const margin = 4;
    const min = new T.Vector2(Math.min(...points.map(p => p.x)) - margin, Math.min(...points.map(p => p.y)) + offsetZ - margin);
    const max = new T.Vector2(Math.max(...points.map(p => p.x)) + margin, Math.max(...points.map(p => p.y)) + offsetZ + margin);
    const span = max.clone().sub(min), data = new Uint8Array(size * size);
    for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
        const px = min.x + (x + .5) / size * span.x, pz = min.y + (z + .5) / size * span.y - offsetZ;
        let distance2 = Infinity, inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const a = points[j], b = points[i], dx = b.x - a.x, dz = b.y - a.y;
            const length2 = dx * dx + dz * dz;
            const t = length2 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.y) * dz) / length2)) : 0;
            distance2 = Math.min(distance2, (px - a.x - t * dx) ** 2 + (pz - a.y - t * dz) ** 2);
            if ((a.y > pz) !== (b.y > pz) && px < (b.x - a.x) * (pz - a.y) / (b.y - a.y) + a.x) inside = !inside;
        }
        data[z * size + x] = inside ? 0 : Math.round(Math.min(1, Math.sqrt(distance2) / margin) * 255);
    }
    const texture = new T.DataTexture(data, size, size, T.RedFormat);
    texture.minFilter = texture.magFilter = T.LinearFilter;
    texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return { texture, min, span };
}

export function makeCanopyShoreStudy(material: T.ShaderMaterial, points: readonly T.Vector2[], offsetZ: number, variant: ShoreStudy) {
    const field = coastDistanceField(points, offsetZ);
    const palettes = {
        lagoon: ['#317eae', '#68b7b3', '#aaccc0', 1.4],
        tidal: ['#396c9d', '#559caa', '#bed4c6', .85],
        shelf: ['#3d91b7', '#74bdbb', '#c1d7c5', 2.1],
    } as const;
    const [deep, shallow, edge, width] = palettes[variant];
    Object.assign(material.uniforms, { coastField: { value: field.texture }, coastMin: { value: field.min }, coastSpan: { value: field.span },
        deep: { value: new T.Color(deep) }, shallow: { value: new T.Color(shallow) }, coastEdge: { value: new T.Color(edge) }, coastWidth: { value: width } });
    material.fragmentShader = material.fragmentShader
        .replace('uniform float time;', 'uniform sampler2D coastField; uniform vec2 coastMin; uniform vec2 coastSpan; uniform vec3 coastEdge; uniform float coastWidth; uniform float time;')
        .replace('float edge=length(max(q,0.0))+min(max(q.x,q.y),0.0)-.7;', 'float edge=texture2D(coastField,(vWorld-coastMin)/coastSpan).r*4.0;')
        .replace('float shelf=1.0-smoothstep(.0,2.2,edge);', 'float shelf=1.0-smoothstep(.05,coastWidth,edge);')
        .replace('vec3 color=mix(deep,shallow,shelf*.92);', 'vec3 color=mix(deep,shallow,shelf); color=mix(color,coastEdge,(1.0-smoothstep(.0,.16,edge))*.38);');
    return () => field.texture.dispose();
}
