import manifest from '../../../../../docs/design/2026-10-11-authored-coast-skin/skin-manifest.json';
import type { AuthoredCoastSkin } from './authoredGrowingGround';
import { decodeNativeGrowingKit } from './decodeNativeGrowingKit';
import bridgeProfile from '../../../../domain/growingIsland/nativeWaterBridgeProfile.json';
import type { AuthoredWaterBridgeSkin } from './authoredWaterBridgeArt';
import flowerProfile from '../../../../../docs/design/2026-10-11-authored-flower-garden/native-flower-support-profile.json';
import type { NativeAuthoredFlowerSkin } from './nativeAuthoredFlower';
import coveManifest from '../../../../../docs/design/2026-10-12-authored-cove-entrance/cove-delivery-manifest.json';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as T from 'three';
import { makeNativeAuthoredCove } from './nativeAuthoredCove';
import { guardNativeTransmission } from './nativeTransmission';
import shoulderManifest from '../../../../../prototypes/place-qa/native-shoulder-manifest.json';
import { makeNativeAuthoredShoulder } from './nativeAuthoredShoulder';
import forestManifest from '../../../../../prototypes/place-qa/native-forest-stage4-manifest.json';
import galleryManifest from '../../../../../prototypes/place-qa/native-gallery-v5-manifest.json';
import { makeNativeAuthoredForest } from './nativeAuthoredForest';
import { makeNativeAuthoredGallery } from './nativeAuthoredGallery';
import type { AuthoredWholeArt } from '../authoredWholeArt';

/** Explicit DEV diagnostic asset. The normal island never loads a sample map
 * or grants its sites to an existing owner's save. */
export async function loadAuthoredCoastSkin(signal: AbortSignal): Promise<AuthoredCoastSkin> {
    if (!import.meta.env.DEV) throw Error('Authored coast diagnostic requires development');
    const response = await fetch('/prototypes/place-qa/native05-coast.json.gz', { signal });
    if (!response.ok) throw Error(`Authored coast load: ${response.status}`);
    const buffer = await decodeNativeGrowingKit(await response.arrayBuffer(), manifest.artifact);
    signal.throwIfAborted();
    const skin = JSON.parse(new TextDecoder().decode(buffer)) as AuthoredCoastSkin;
    if (skin.version !== 1 || skin.worldId !== manifest.worldId || skin.source.sha256 !== manifest.source.sha256) throw Error('Authored coast manifest differs');
    return skin;
}

export async function loadAuthoredWaterBridgeSkin(signal: AbortSignal): Promise<AuthoredWaterBridgeSkin> {
    if (!import.meta.env.DEV) throw Error('Authored water bridge diagnostic requires development');
    const response = await fetch(bridgeProfile.artifact.path, { signal });
    if (!response.ok) throw Error(`Authored water bridge load: ${response.status}`);
    const buffer = await decodeNativeGrowingKit(await response.arrayBuffer(), { sha256: bridgeProfile.artifact.expandedSha256,
        gzipSha256: bridgeProfile.artifact.sha256, bytes: bridgeProfile.artifact.bytes });
    signal.throwIfAborted();
    const skin = JSON.parse(new TextDecoder().decode(buffer)) as AuthoredWaterBridgeSkin;
    if (skin.version !== 1 || skin.source.id !== bridgeProfile.source.id || skin.source.sha256 !== bridgeProfile.source.sha256
        || skin.scale !== bridgeProfile.scale || skin.parts.length !== bridgeProfile.counts.parts) throw Error('Authored water bridge manifest differs');
    return skin;
}

export async function loadAuthoredFlowerSupportSkin(signal: AbortSignal): Promise<NativeAuthoredFlowerSkin> {
    if (!import.meta.env.DEV) throw Error('Authored flower support diagnostic requires development');
    const response = await fetch('/prototypes/place-qa/native-flower-support.json.gz', { signal });
    if (!response.ok) throw Error(`Authored flower support load: ${response.status}`);
    const buffer = await decodeNativeGrowingKit(await response.arrayBuffer(), {
        sha256: flowerProfile.artifact.expandedSha256, gzipSha256: flowerProfile.artifact.sha256, bytes: flowerProfile.artifact.expandedBytes,
    });
    signal.throwIfAborted();
    const skin = JSON.parse(new TextDecoder().decode(buffer)) as NativeAuthoredFlowerSkin;
    if (skin.version !== 1 || skin.source.id !== flowerProfile.source.id || skin.source.sha256 !== flowerProfile.source.sha256
        || skin.scale !== flowerProfile.scale || skin.parts.length !== flowerProfile.counts.parts) throw Error('Authored flower support manifest differs');
    return skin;
}

/** Separate DEV source candidate. Its apron is rendered from the shared world,
 * so this asset contains only the shell, frame and grounded supports. */
export async function loadAuthoredCove(signal: AbortSignal) {
    if (!import.meta.env.DEV) throw Error('Authored cove diagnostic requires development');
    const response = await fetch(coveManifest.artifact.path, { signal });
    if (!response.ok) throw Error(`Authored cove load: ${response.status}`);
    const buffer = await decodeNativeGrowingKit(await response.arrayBuffer(), {
        sha256: coveManifest.artifact.expandedSha256, gzipSha256: coveManifest.artifact.sha256, bytes: coveManifest.artifact.expandedBytes,
    });
    signal.throwIfAborted();
    const gltf = await new GLTFLoader().parseAsync(buffer, '');
    gltf.scene.userData.sourceId = coveManifest.source.id;
    gltf.scene.userData.sourceSha256 = coveManifest.source.sha256;
    gltf.scene.traverse(object => {
        if (object instanceof T.Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            if (material instanceof T.MeshPhysicalMaterial) guardNativeTransmission(material);
        }
    });
    const cove = makeNativeAuthoredCove(gltf.scene, coveManifest);
    if (signal.aborted) { cove.dispose(); signal.throwIfAborted(); }
    return cove;
}

/** Only closed sides/bottom and conditional owned roots. The world's two
 * material floors draw the shoulder top; the complete source scene is absent. */
export async function loadAuthoredShoulder(signal: AbortSignal) {
    if (!import.meta.env.DEV) throw Error('Authored shoulder diagnostic requires development');
    const response = await fetch(shoulderManifest.artifact.path, { signal });
    if (!response.ok) throw Error(`Authored shoulder load: ${response.status}`);
    const buffer = await decodeNativeGrowingKit(await response.arrayBuffer(), {
        sha256: shoulderManifest.artifact.expandedSha256, gzipSha256: shoulderManifest.artifact.sha256,
        bytes: shoulderManifest.artifact.expandedBytes,
    });
    signal.throwIfAborted();
    const gltf = await new GLTFLoader().parseAsync(buffer, '');
    gltf.scene.userData.sourceId = shoulderManifest.source.id;
    gltf.scene.userData.sourceSha256 = shoulderManifest.artifact.expandedSha256;
    const shoulder = makeNativeAuthoredShoulder(gltf.scene, shoulderManifest);
    if (signal.aborted) { shoulder.dispose(); signal.throwIfAborted(); }
    return shoulder;
}

/** Saved rough source assemblies, explicitly enabled only in the DEV island.
 * The gallery is visible structure; loading it does not grant an upper route. */
export async function loadAuthoredWholeArt(signal: AbortSignal): Promise<AuthoredWholeArt> {
    if (!import.meta.env.DEV) throw Error('Authored whole art diagnostic requires development');
    const load = async (manifest: typeof forestManifest | typeof galleryManifest) => {
        const response = await fetch(manifest.artifact.path, { signal });
        if (!response.ok) throw Error(`Authored whole art load: ${response.status}`);
        const buffer = await decodeNativeGrowingKit(await response.arrayBuffer(), {
            sha256: manifest.artifact.expandedSha256, gzipSha256: manifest.artifact.sha256, bytes: manifest.artifact.expandedBytes,
        });
        signal.throwIfAborted();
        const gltf = await new GLTFLoader().parseAsync(buffer, '');
        gltf.scene.userData.sourceId = manifest.source.id;
        gltf.scene.userData.sourceSha256 = manifest.artifact.expandedSha256;
        return gltf.scene;
    };
    const forest = makeNativeAuthoredForest(await load(forestManifest), forestManifest);
    try {
        const gallery = makeNativeAuthoredGallery(await load(galleryManifest), galleryManifest);
        if (signal.aborted) { gallery.dispose(); signal.throwIfAborted(); }
        return { forest, gallery };
    } catch (error) { forest.dispose(); throw error; }
}
