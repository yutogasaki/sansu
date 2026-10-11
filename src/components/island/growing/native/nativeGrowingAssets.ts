import kitUrl from '../../../../../docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz?url';
import manifest from '../../../../../docs/design/2026-10-11-native-owned-island/kit-manifest.json';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeNativeGrowingKit } from './nativeGrowingKit';
import { guardNativeTransmission } from './nativeTransmission';
import * as T from 'three';
import { decodeNativeGrowingKit } from './decodeNativeGrowingKit';

export async function loadNativeGrowingKit(signal: AbortSignal) {
    const response = await fetch(kitUrl, { signal });
    if (!response.ok) throw Error(`Native owned kit load: ${response.status}`);
    const buffer = await decodeNativeGrowingKit(await response.arrayBuffer(), manifest);
    signal.throwIfAborted();
    const gltf = await new GLTFLoader().parseAsync(buffer, '');
    gltf.scene.traverse(object => {
        if (object instanceof T.Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            if (material instanceof T.MeshPhysicalMaterial) guardNativeTransmission(material);
        }
    });
    const kit = makeNativeGrowingKit(gltf.scene, manifest);
    if (signal.aborted) { kit.dispose(); signal.throwIfAborted(); }
    return kit;
}
