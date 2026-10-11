import matureUrl from '../../../../../docs/design/2026-10-10-island-final-3d/whole-island.glb?url';
import smallUrl from '../../../../../docs/design/2026-10-11-island-growth-art/small-island.glb?url';
import youngUrl from '../../../../../docs/design/2026-10-11-island-growth-art/young-island.glb?url';
import mature from '../../../../../docs/design/2026-10-10-native-art-transfer/runtime-manifest.json';
import small from '../../../../../docs/design/2026-10-11-island-growth-art/small-manifest.json';
import young from '../../../../../docs/design/2026-10-11-island-growth-art/young-manifest.json';

export const NATIVE_ISLAND_ART_STATES = {
    small: { label: '小さな島', url: smallUrl, candidate: small.candidate, sha256: small.sha256,
        roots: small.rootNodes, meshes: small.meshes, triangles: small.triangles, houses: small.houses, coastArea: small.coastArea },
    young: { label: '育ち途中', url: youngUrl, candidate: young.candidate, sha256: young.sha256,
        roots: young.rootNodes, meshes: young.meshes, triangles: young.triangles, houses: young.houses, coastArea: young.coastArea },
    grown: { label: '育った島', url: matureUrl, candidate: mature.candidate, sha256: mature.sourceSha256,
        roots: mature.meshes, meshes: mature.meshes, triangles: mature.triangles, houses: 15, coastArea: 0 },
} as const;
export type NativeIslandArtState = keyof typeof NATIVE_ISLAND_ART_STATES;
export { mature as nativeMatureManifest };
