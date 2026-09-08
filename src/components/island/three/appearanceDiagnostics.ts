import * as THREE from 'three';
import type { IslandAppearanceSlotId, IslandAppearanceStyleId } from '../../../domain/island/appearance';

export interface IslandAppearanceSlotDiagnostic {
    slot: IslandAppearanceSlotId;
    styleId: IslandAppearanceStyleId;
    groupUuids: string[];
    meshCount: number;
    visibleMeshCount: number;
    geometrySignature: string;
    materialSignature: string;
    bounds: { min: number[]; max: number[] } | null;
    backdrop: boolean;
}

/** FNV fingerprints are diagnostic change detectors, not persisted identity. */
function fingerprint(parts: Iterable<string | ArrayBufferView>) {
    let result = 2166136261;
    for (const part of parts) {
        const bytes = typeof part === 'string' ? new TextEncoder().encode(part)
            : new Uint8Array(part.buffer, part.byteOffset, part.byteLength);
        for (const byte of bytes) { result ^= byte; result = Math.imul(result, 16777619); }
    }
    return (result >>> 0).toString(16).padStart(8, '0');
}
const geometryKeys = new WeakMap<THREE.BufferGeometry, string>();
const textureKeys = new WeakMap<THREE.Texture, string>();
function geometryKey(geometry: THREE.BufferGeometry) {
    let result = geometryKeys.get(geometry);
    if (!result) {
        const pieces: (string | ArrayBufferView)[] = [];
        for (const name of Object.keys(geometry.attributes).sort()) {
            const attribute = geometry.getAttribute(name); pieces.push(name, attribute.array);
        }
        if (geometry.index) pieces.push(geometry.index.array);
        result = fingerprint(pieces); geometryKeys.set(geometry, result);
    }
    return result;
}
function materialKey(material: THREE.Material) {
    const m = material as THREE.MeshStandardMaterial;
    let texture = '';
    if (m.map) {
        const data = (m.map.image as { data?: ArrayBufferView } | undefined)?.data;
        texture = textureKeys.get(m.map) ?? fingerprint([data ?? '', m.map.colorSpace]);
        textureKeys.set(m.map, texture);
    }
    return JSON.stringify({ type: m.type, color: m.color?.toArray(), emissive: m.emissive?.toArray(), emissiveIntensity: m.emissiveIntensity,
        roughness: m.roughness, metalness: m.metalness, vertexColors: m.vertexColors, opacity: m.opacity, transparent: m.transparent, texture });
}
const shown = (object: THREE.Object3D) => {
    for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return false;
    return true;
};

export function describeAppearanceSlot(slot: IslandAppearanceSlotId, styleId: IslandAppearanceStyleId,
    objects: readonly THREE.Group[], background?: THREE.Color): IslandAppearanceSlotDiagnostic {
    const geometries: string[] = [], materials: string[] = [], bounds = new THREE.Box3();
    let meshCount = 0, visibleMeshCount = 0;
    for (const group of objects) {
        group.updateWorldMatrix(true, true);
        group.traverse(child => {
            if (!(child instanceof THREE.Mesh)) return;
            meshCount++; if (shown(child)) visibleMeshCount++;
            geometries.push(geometryKey(child.geometry), JSON.stringify(child.matrixWorld.toArray()));
            for (const material of Array.isArray(child.material) ? child.material : [child.material]) materials.push(materialKey(material));
            bounds.union(new THREE.Box3().setFromObject(child, true));
        });
    }
    if (background) materials.push(`background:${background.getHexString()}`);
    return { slot, styleId, groupUuids: objects.map(group => group.uuid), meshCount, visibleMeshCount,
        geometrySignature: fingerprint(geometries), materialSignature: fingerprint(materials),
        bounds: bounds.isEmpty() ? null : { min: bounds.min.toArray(), max: bounds.max.toArray() }, backdrop: slot === 'sky' };
}
