import fenceNear from '../../../../assets/island-fence-v1/home-runtime/near.glb?url';
import fenceFar from '../../../../assets/island-fence-v1/home-runtime/far.glb?url';
import wateringcanNear from '../../../../assets/island-watering-can-v1/home-runtime/near.glb?url';
import wateringcanFar from '../../../../assets/island-watering-can-v1/home-runtime/far.glb?url';
import planterNear from '../../../../assets/island-planter-v1/home-runtime/near.glb?url';
import planterFar from '../../../../assets/island-planter-v1/home-runtime/far.glb?url';
import mailboxNear from '../../../../assets/island-mailbox-v1/home-runtime/near.glb?url';
import mailboxFar from '../../../../assets/island-mailbox-v1/home-runtime/far.glb?url';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import decoderJs from 'three/examples/jsm/libs/basis/basis_transcoder.js?url';
import decoderWasm from 'three/examples/jsm/libs/basis/basis_transcoder.wasm?url';
import treeNear from '../../../../assets/island-tree-v1/runtime/near.glb?url';
import treeFar from '../../../../assets/island-tree-v1/runtime/far-geometry.glb?url';
import rockNear from '../../../../assets/island-rock-v1/runtime/near.glb?url';
import rockFar from '../../../../assets/island-rock-v1/runtime/far-geometry.glb?url';
import benchNear from '../../../../assets/island-bench-v1/runtime/near.glb?url';
import benchFar from '../../../../assets/island-bench-v1/runtime/far-geometry.glb?url';
import hutNear from '../../../../assets/island-garden-hut-v1/runtime/near.glb?url';
import hutFar from '../../../../assets/island-garden-hut-v1/runtime/far-geometry.glb?url';
import flowerNear from '../../../../assets/island-flowerbed-v1/runtime/near.glb?url';
import flowerFar from '../../../../assets/island-flowerbed-v1/runtime/far-geometry.glb?url';
import lampNear from '../../../../assets/island-streetlamp-v1/runtime/near.glb?url';
import lampFar from '../../../../assets/island-streetlamp-v1/runtime/far-geometry.glb?url';
import { projectedDiameter, selectFarAsset } from './runtimeAssetLod';
import type { RuntimeAssetKind } from './runtimeAssetSlots';

const urls = { fence: [fenceNear, fenceFar], 'watering-can': [wateringcanNear, wateringcanFar], planter: [planterNear, planterFar], mailbox: [mailboxNear, mailboxFar], tree: [treeNear, treeFar], rock: [rockNear, rockFar], bench: [benchNear, benchFar], 'garden-hut': [hutNear, hutFar], flowerbed: [flowerNear, flowerFar], streetlamp: [lampNear, lampFar] };
type Asset = { near: T.Object3D; far: T.Object3D; bounds: T.Box3 };
type Slot = { target: T.Object3D; visual: T.Group; near: T.Object3D; far: T.Object3D; porch?: T.Mesh<T.BoxGeometry, T.MeshStandardMaterial>; original: [T.Object3D, boolean][]; size: T.Vector3; isFar: boolean };
const resources = (root: T.Object3D) => {
    const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
    root.traverse(o => { if (o instanceof T.Mesh) { geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); } });
    for (const m of materials) for (const value of Object.values(m)) if (value instanceof T.Texture) textures.add(value);
    return { geometries, materials, textures };
};
function release(root: T.Object3D) {
    const r = resources(root); r.geometries.forEach(g => g.dispose()); r.materials.forEach(m => m.dispose()); r.textures.forEach(t => t.dispose());
}

/** One pool per mounted world. Detach borrowed meshes before the scene disposes its own geometry. */
export class LifeRuntimeAssets {
    private readonly ktx: KTX2Loader;
    private readonly loader: GLTFLoader;
    private readonly assets = new Map<RuntimeAssetKind, Asset>();
    private readonly pending = new Set<RuntimeAssetKind>();
    private readonly failed = new Set<RuntimeAssetKind>();
    private slots: Slot[] = [];
    private root?: T.Object3D;
    private disposed = false;
    private readonly position = new T.Vector3();
    private readonly scale = new T.Vector3();
    private readonly cameraPosition = new T.Vector3();
    constructor(renderer: T.WebGLRenderer, private readonly changed: () => void) {
        const manager = new T.LoadingManager();
        manager.setURLModifier(url => url.endsWith('basis_transcoder.js') ? decoderJs : url.endsWith('basis_transcoder.wasm') ? decoderWasm : url);
        this.ktx = new KTX2Loader(manager).setTranscoderPath('/').detectSupport(renderer);
        this.loader = new GLTFLoader(manager).setKTX2Loader(this.ktx);
    }
    bind(root: T.Object3D) {
        this.detach(); this.root = root;
        const targets: T.Object3D[] = [];
        root.traverse(o => { if (o.userData.runtimeAssetKind) targets.push(o); });
        for (const target of targets) {
            const kind = target.userData.runtimeAssetKind as RuntimeAssetKind;
            const asset = this.assets.get(kind);
            if (!asset) { if (!this.pending.has(kind) && !this.failed.has(kind)) void this.load(kind); continue; }
            const original = target.children.map(o => [o, o.visible] as [T.Object3D, boolean]);
            // Measure in target coordinates, preserving the caller's position, scale and rotation.
            const local = new T.Group(); for (const child of target.children) local.add(child.clone(true));
            const bounds = new T.Box3().setFromObject(local), size = bounds.getSize(new T.Vector3());
            // The existing facility owns cells [0,0]..[1,1], with use at [0,2].
            // Keep the generated central door behind a forecourt spanning both door and old entrance.
            if (kind === 'garden-hut') {
                bounds.set(new T.Vector3(-.46, 0, -.46), new T.Vector3(1.46, 1.56, 1.06));
                bounds.getSize(size);
            }
            const sourceSize = asset.bounds.getSize(new T.Vector3());
            const near = asset.near.clone(true), far = asset.far.clone(true), visual = new T.Group();
            const scale = new T.Vector3(size.x / sourceSize.x, size.y / sourceSize.y, size.z / sourceSize.z);
            // This versioned bench's seat surface is y=.43 in its one-unit-tall source.
            // Fit feet to the ground and the visible seat to the existing resident anchor.
            if (kind === 'bench' && typeof target.userData.runtimeAssetSeatY === 'number') scale.y = (target.userData.runtimeAssetSeatY - bounds.min.y) / .43;
            const offset = new T.Vector3().copy(bounds.min).sub(asset.bounds.min.clone().multiply(scale));
            for (const object of [near, far]) { object.scale.copy(scale); object.position.copy(offset); visual.add(object); }
            const porch = kind === 'garden-hut' ? new T.Mesh(new T.BoxGeometry(1.15, .12, .46), new T.MeshStandardMaterial({ color: '#e6d8bd', roughness: .85 })) : undefined;
            if (porch) { porch.name = 'runtime-hut-forecourt'; porch.position.set(.25, .06, 1.27); porch.castShadow = porch.receiveShadow = true; visual.add(porch); }
            near.visible = true; far.visible = false;
            original.forEach(([o]) => { o.visible = false; }); target.add(visual);
            this.slots.push({ target, visual, near, far, porch, original, size: sourceSize.clone().multiply(scale), isFar: false });
        }
        this.changed();
    }
    private async load(kind: RuntimeAssetKind) {
        this.pending.add(kind);
        const loaded = await Promise.allSettled(urls[kind].map(url => this.loader.loadAsync(url)));
        this.pending.delete(kind);
        if (this.disposed || loaded.some(r => r.status === 'rejected')) {
            for (const r of loaded) if (r.status === 'fulfilled') release(r.value.scene);
            this.failed.add(kind); if (!this.disposed) this.changed();
            else if (!this.pending.size) this.ktx.dispose();
            return;
        }
        const [near, far] = loaded.map(r => (r as PromiseFulfilledResult<Awaited<ReturnType<GLTFLoader['loadAsync']>>>).value.scene);
        const materials = new Map<string, T.Material>();
        near.traverse(o => { if (o instanceof T.Mesh) {
            for (const material of Array.isArray(o.material) ? o.material : [o.material]) materials.set(material.name, material);
            o.castShadow = o.receiveShadow = true;
        } });
        let missingMaterial = !materials.size;
        far.traverse(o => { if (o instanceof T.Mesh) {
            const original = Array.isArray(o.material) ? o.material : [o.material];
            const shared = original.map(m => materials.get(m.name));
            if (shared.some(m => !m)) { missingMaterial = true; return; }
            original.forEach(m => m.dispose());
            o.material = Array.isArray(o.material) ? shared as T.Material[] : shared[0]!;
            o.castShadow = o.receiveShadow = true;
        } });
        if (missingMaterial) { release(near); release(far); this.failed.add(kind); this.changed(); return; }
        this.assets.set(kind, { near, far, bounds: new T.Box3().setFromObject(near) });
        if (this.root) this.bind(this.root);
    }
    update(camera: T.Camera, height: number) {
        camera.getWorldPosition(this.cameraPosition); let changed = false;
        for (const slot of this.slots) {
            slot.target.getWorldPosition(this.position); slot.target.getWorldScale(this.scale);
            const pixels = projectedDiameter(camera, this.scale.multiply(slot.size).length(), this.cameraPosition.distanceTo(this.position), height);
            const far = selectFarAsset(pixels, slot.isFar);
            if (far !== slot.isFar) { slot.isFar = far; slot.near.visible = !far; slot.far.visible = far; changed = true; }
        }
        if (changed) this.changed();
    }
    describe() { return { candidate: 'island-life-runtime-assets-v3', homePropsCandidate: 'island-home-props-v1', loaded: [...this.assets.keys()], failed: [...this.failed], pending: [...this.pending], instances: this.slots.length, byKind: Object.fromEntries([...this.assets.keys()].map(kind => [kind, this.slots.filter(slot => slot.target.userData.runtimeAssetKind === kind).length])), far: this.slots.filter(s => s.isFar).length }; }
    detach() {
        for (const slot of this.slots) { slot.visual.removeFromParent(); slot.porch?.geometry.dispose(); slot.porch?.material.dispose(); slot.original.forEach(([o, visible]) => { o.visible = visible; }); }
        this.slots = []; this.root = undefined;
    }
    dispose() {
        this.disposed = true; this.detach();
        const pool = new T.Group(); for (const a of this.assets.values()) pool.add(a.near, a.far);
        release(pool); this.assets.clear(); if (!this.pending.size) this.ktx.dispose();
    }
}
