import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PlotStyle } from '../../../../domain/growingIsland';
import { treeForm } from '../treeSilhouettes';
import { ROOF_COLORS, STYLE_ROOF, WONDER_ROOFS } from '../plotParts';
import { wonder } from '../wonderPaint';

export type NativeGrowingPart = 'cottage' | 'home' | 'home-upper' | 'home-cap' | 'home-leaf' | 'willow' | 'birch' | 'spire'
    | 'fan-crown' | 'hollow-trunk' | 'flower-crown' | 'shell-roof';
export interface NativeGrowingManifest {
    candidate: string; sourceSha256: string; sha256: string; gzipSha256: string; bytes: number; gzipBytes: number;
    shoreProfile: number[]; parts: Record<NativeGrowingPart, { min: number[]; max: number[]; sourceNames: string[] }>;
}

/** Source meshes are baked and batched once. Owners share the immutable geometries;
 * painting clones only its own material. No source figure or sample home is spawned. */
export function makeNativeGrowingKit(source: T.Group, manifest: NativeGrowingManifest) {
    const templates = new Map<NativeGrowingPart, T.Group>();
    const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>();
    source.updateMatrixWorld(true);
    const origins: Partial<Record<NativeGrowingPart, [number, number, number]>> = {
        cottage: [-7, .81, 3.4], home: [-7, 1.25, -4.6], 'home-upper': [-5.1, .81, .5],
        willow: [-8, 1.24, -2.7], 'fan-crown': [-4.8, manifest.parts['fan-crown'].min[1], -17],
        'hollow-trunk': [-4.8, manifest.parts['hollow-trunk'].min[1], -17], 'flower-crown': [6.1, manifest.parts['flower-crown'].min[1], -4.8],
        'shell-roof': [13.9, manifest.parts['shell-roof'].min[1], 1.2],
    };
    for (const part of source.children) {
        const id = part.userData.nativePart as NativeGrowingPart, description = manifest.parts[id];
        if (!description || templates.has(id)) throw Error('Native owned kit parts differ');
        const origin = origins[id] ?? [(description.min[0] + description.max[0]) / 2, description.min[1], (description.min[2] + description.max[2]) / 2];
        const transform = new T.Matrix4().makeTranslation(-origin[0], -origin[1], -origin[2]);
        if (id === 'cottage' || id === 'home' || id === 'home-upper') {
            transform.premultiply(new T.Matrix4().makeRotationY(id === 'cottage' ? .07 : id === 'home' ? -.18 : -.05));
        }
        const buckets = new Map<T.Material, T.BufferGeometry[]>(), root = new T.Group(); root.name = `native05-${id}`;
        part.traverse(object => {
            if (!(object instanceof T.Mesh)) return;
            if (Array.isArray(object.material)) throw Error('Unexpected native material array');
            const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld).applyMatrix4(transform);
            if (!geometry.getAttribute('uv')) geometry.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2));
            for (const attribute of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(attribute)) geometry.deleteAttribute(attribute);
            const bucket = buckets.get(object.material) ?? []; bucket.push(geometry); buckets.set(object.material, bucket); materials.add(object.material);
        });
        for (const [material, pieces] of buckets) {
            const geometry = mergeGeometries(pieces); pieces.forEach(piece => piece.dispose());
            if (!geometry) throw Error(`Native part attributes differ: ${id}`);
            geometries.add(geometry);
            const mesh = new T.Mesh(geometry, material); mesh.name = material.name;
            mesh.castShadow = !(material instanceof T.MeshPhysicalMaterial && material.transmission > .3); mesh.receiveShadow = true;
            mesh.userData.nativeSharedGeometry = true; mesh.userData.nativeSharedMaterial = true; root.add(mesh);
        }
        root.userData.nativePart = id; root.userData.sourceNative05Names = description.sourceNames;
        templates.set(id, root);
    }
    if (templates.size !== Object.keys(manifest.parts).length) throw Error('Native owned kit is incomplete');
    const originalGeometry = new Set<T.BufferGeometry>(); source.traverse(object => { if (object instanceof T.Mesh) originalGeometry.add(object.geometry); });
    originalGeometry.forEach(geometry => geometry.dispose());
    let disposed = false;
    const instance = (id: NativeGrowingPart) => {
        if (disposed) throw Error('Native kit already disposed');
        const root = templates.get(id)!.clone(true); root.userData.nativePart = id;
        root.userData.sourceSha256 = manifest.sourceSha256; return root;
    };
    const paintRoof = (root: T.Group, style: PlotStyle, roof?: number) => {
        const color = roof === undefined || roof === 0 ? STYLE_ROOF[style] : ROOF_COLORS[roof];
        root.traverse(object => {
            if (!(object instanceof T.Mesh) || !/roof|color tile|scalloped blue cap|blue silver leaf tips/.test(object.material.name)) return;
            const pattern = roof !== undefined && roof >= ROOF_COLORS.length ? WONDER_ROOFS[roof - ROOF_COLORS.length] : undefined;
            const material = pattern ? wonder(pattern).clone() : (object.material as T.MeshStandardMaterial).clone();
            if (!pattern && color && material instanceof T.MeshStandardMaterial) material.color.set(color);
            object.material = material; object.userData.nativeSharedMaterial = false; object.userData.ownMaterial = true;
        });
    };
    return {
        manifest, instance,
        tree(id: string, growth: number) {
            const form = treeForm(id), name = form === 'spread' ? 'willow' : form === 'spire' ? 'spire' : 'birch';
            const root = instance(name);
            const height = growth < 6 ? .22 + Math.min(6, Math.max(0, growth)) / 6 * .45 : growth < 18 ? 1.0 : form === 'spire' ? 1.85 : 1.75;
            root.scale.setScalar(height / (manifest.parts[name].max[1] - manifest.parts[name].min[1]));
            root.name = `growing-tree-${form}`; root.userData.treeForm = form; return root;
        },
        home(stage: number, style: PlotStyle, roof?: number) {
            const root = instance(style === 'water' ? 'home-cap' : style === 'tree' ? 'home-leaf' : stage >= 4 ? 'home-upper' : 'home');
            root.scale.setScalar(stage === 2 ? .30 : .34); paintRoof(root, style, roof);
            // An earned upper floor keeps its height even under a native cap or
            // folded leaf roof; it never silently reverts to the small home.
            if (stage >= 4 && (style === 'water' || style === 'tree')) root.scale.y *= 1.25;
            root.name = 'growing-native-home'; root.userData.homeStage = stage; root.userData.homeStyle = style; return root;
        },
        cottage() { const root = instance('cottage'); root.scale.setScalar(.58); return root; },
        dispose() {
            if (disposed) return; disposed = true;
            geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); templates.clear();
        },
    };
}
export type NativeGrowingKit = ReturnType<typeof makeNativeGrowingKit>;
