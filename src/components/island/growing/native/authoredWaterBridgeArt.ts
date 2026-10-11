import * as T from 'three';
import type { SceneLayout } from '../sceneLayout';
import profile from '../../../../domain/growingIsland/nativeWaterBridgeProfile.json';

export interface AuthoredWaterBridgeSkin {
    version: 1;
    source: { artifact: string; sha256: string; id: string };
    scale: number;
    parts: readonly { name: string; positions: readonly number[]; normals: readonly number[]; indices: readonly number[];
        material: { name: string; color: string; roughness: number; metalness: number } }[];
}

/** The source boards, posts and rails follow the same span, width and arch as
 * the continuous wooden world deck. They add no floor or passage grants. */
export function buildAuthoredWaterBridgeArt(layout: SceneLayout, skin?: AuthoredWaterBridgeSkin) {
    const root = new T.Group(); root.name = 'authored-water-bridges';
    const geometries: T.BufferGeometry[] = [], materials: T.Material[] = [];
    if (skin) {
        if (skin.version !== 1 || skin.source.id !== profile.source.id || skin.source.sha256 !== layout.world.definition.source?.sha256
            || skin.scale !== profile.scale) throw Error('Authored water bridge source differs');
        for (const bridge of layout.authoredWaterPlan?.bridges ?? []) {
            if (bridge.sourceId !== skin.source.id || bridge.sourceSHA !== skin.source.sha256) throw Error('Bridge plan and art differ');
            const batches = new Map<string, { positions: number[]; normals: number[]; indices: number[]; material: AuthoredWaterBridgeSkin['parts'][number]['material'] }>();
            for (const part of skin.parts) {
                const batch = batches.get(part.material.name) ?? { positions: [], normals: [], indices: [], material: part.material };
                const offset = batch.positions.length / 3;
                const sx = bridge.span / profile.span, sy = bridge.archHeight / profile.archHeight, sz = bridge.width / profile.width;
                for (let i = 0; i < part.positions.length; i += 3) {
                    batch.positions.push(part.positions[i] * sx, (part.positions[i + 1] - profile.deckBaseY) * sy + .003, part.positions[i + 2] * sz);
                    const normal = new T.Vector3(part.normals[i] / sx, part.normals[i + 1] / sy, part.normals[i + 2] / sz).normalize();
                    batch.normals.push(...normal.toArray());
                }
                batch.indices.push(...part.indices.map(index => index + offset)); batches.set(part.material.name, batch);
            }
            const group = new T.Group(); group.rotation.y = bridge.yaw;
            group.position.set(bridge.center.x - layout.center, bridge.deckY, bridge.center.z - 2);
            for (const batch of batches.values()) {
                const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(batch.positions, 3));
                geometry.setAttribute('normal', new T.Float32BufferAttribute(batch.normals, 3)); geometry.setIndex(batch.indices);
                const material = new T.MeshStandardMaterial({ color: batch.material.color, roughness: batch.material.roughness, metalness: batch.material.metalness, side: T.DoubleSide });
                const mesh = new T.Mesh(geometry, material); mesh.name = 'authored-water-bridge';
                mesh.userData.objectId = bridge.ownerId; mesh.userData.worldFloor = bridge.deckFloorId;
                mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); geometries.push(geometry); materials.push(material);
            }
            root.add(group);
        }
    }
    return { root, dispose() { geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); } };
}
