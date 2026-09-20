import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import decoderJs from 'three/examples/jsm/libs/basis/basis_transcoder.js?url';
import decoderWasm from 'three/examples/jsm/libs/basis/basis_transcoder.wasm?url';
import designManifest from '../../../assets/pipeline/island-design-v2/runtime-manifest.json';
import runtimeManifest from '../../../assets/pipeline/island-garden-v1/runtime-manifest.json';
import { IslandMaterials } from '../../components/island/three/primitives';
import { makeScenery, makeOcean } from '../../components/island/three/scenery';
import { IslandResident } from '../../components/island/three/animals';
import './style.css';

const design = new URLSearchParams(location.search).get('set') === 'design-v2';
const garden = new URLSearchParams(location.search).get('set') === 'garden';
const legacyAssets = [
    { id: 'tree', name: '木', position: [1.6, 0, -1.4], scale: .65, bytes: [8528084, 4380344], triangles: 12390 },
    { id: 'rock', name: '岩', position: [-.5, 0, 2.1], scale: .8, bytes: [9027128, 4158408], triangles: 4005 },
    { id: 'bench', name: 'ベンチ', position: [1.7, 0, 1.1], scale: .9, bytes: [7780668, 4077708], triangles: 7709 },
] as const;
const assets = design ? [
    { id: 'fence', name: '柵', position: [-1.5, 0, 1.6], scale: .65, ...designManifest.fence },
    { id: 'watering-can', name: 'じょうろ', position: [.2, 0, 2.0], scale: 1, ...designManifest['watering-can'] },
    { id: 'planter', name: '植木鉢', position: [-1.5, 0, .3], scale: 1, ...designManifest.planter },
    { id: 'mailbox', name: 'ポスト', position: [1.65, 0, 1.35], scale: .85, ...designManifest.mailbox },
] : garden ? [
    ...legacyAssets,
    { id: 'garden-hut', name: '庭小屋', position: [-1.8, 0, .65], scale: .48, ...runtimeManifest['garden-hut'] },
    { id: 'flowerbed', name: '花壇', position: [-1.5, 0, 2.35], scale: .60, ...runtimeManifest.flowerbed },
    { id: 'streetlamp', name: '街灯', position: [2.65, 0, .1], scale: .72, ...runtimeManifest.streetlamp },
] : legacyAssets;
type Quality = '2048' | '1024' | 'runtime';
const candidate = design ? 'island-design-v2' : garden ? 'island-asset-lab-garden-v1' : 'island-asset-lab-v1';
const triangles = assets.reduce((total, asset) => total + asset.triangles, 0);
const root = document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML = `<header><span>DEVELOPMENT · 素材の試験配置</span><h1>島の素材ラボ</h1><p>同じ景色で、テクスチャの細かさを比べる。</p></header>
<main><section class="stage" aria-label="島の3D比較"><div id="viewport"></div><p class="hint">ドラッグで回転 · ピンチで拡大</p></section>
<aside><h2>テクスチャ</h2><div class="buttons"><button data-quality="2048">${design ? '変更前' : '元の2K'}</button><button data-quality="1024">${design ? 'Blender修正版' : '軽い1K'}</button>${garden || design ? '<button data-quality="runtime">配信用</button>' : ''}</div><p id="status" role="status" aria-live="polite"></p><button id="retry" hidden>読み込み直す</button><h2>見る場所</h2><div class="buttons"><button data-focus="all">島全体</button>${assets.map(a => `<button data-focus="${a.id}">${a.name}</button>`).join('')}</div><dl id="stats"></dl><p class="note">${design ? '木・金属・陶器の作り分けとポストの形状修正。' : '形・UV・法線は同一。'}家・住人・照明はゲームと共通です。配置・当たり判定は試験用です。</p><p class="note">読込時間はこのPC・現在の通信環境の参考値です。</p></aside></main><footer>${candidate} · dev-asset-lab · 本番未配信</footer>`;
const viewport = document.querySelector<HTMLDivElement>('#viewport')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const retry = document.querySelector<HTMLButtonElement>('#retry')!;
const scene = new THREE.Scene();
const materials = new IslandMaterials('moon-garden');
scene.background = new THREE.Color(materials.color('#76cdd3'));
scene.add(makeScenery(materials), makeOcean(materials));
const resident = new IslandResident('otter', materials, [.1, 0, .8], () => {});
scene.add(resident.group);
scene.add(new THREE.HemisphereLight('#f4fbef', '#b7b184', 1.7));
const sun = new THREE.DirectionalLight('#fff1d1', 2.6);
sun.position.set(-3, 9, 7); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -9, right: 10, top: 7, bottom: -8, near: 1, far: 25 });
sun.shadow.bias = -.0006; sun.shadow.normalBias = .055; scene.add(sun);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .9;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
viewport.append(renderer.domElement);
const manager = new THREE.LoadingManager();
manager.setURLModifier(url => url.endsWith('basis_transcoder.js') ? decoderJs : url.endsWith('basis_transcoder.wasm') ? decoderWasm : url);
const ktx = new KTX2Loader(manager).setTranscoderPath('/').detectSupport(renderer);
const loader = new GLTFLoader(manager).setKTX2Loader(ktx);
renderer.domElement.setAttribute('aria-label', `島に配置した${assets.map(a => a.name).join('・')}`);
const camera = new THREE.PerspectiveCamera(40, 1, .1, 150);
const controls = new OrbitControls(camera, renderer.domElement);
controls.maxPolarAngle = Math.PI * .48; controls.minDistance = .7; controls.maxDistance = 35;
const draw = () => renderer.render(scene, camera);
controls.addEventListener('change', draw);
let current = new THREE.Group(); scene.add(current);
let wanted: Quality = garden || design ? 'runtime' : '1024';
const lab = { candidate, quality: '' as string, ready: false, errors: [] as string[], loadMs: 0, triangles,
    measure: async () => {
        const samples: number[] = [];
        for (let i = 0; i < 60; i++) {
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            const start = performance.now(); draw(); samples.push(performance.now() - start);
        }
        return { renderCpuMeanMs: samples.reduce((a, b) => a + b, 0) / samples.length,
            calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
            textures: renderer.info.memory.textures, quality: lab.quality };
    },
};
Object.assign(window, { __assetLab: lab });
function focus(id: string) {
    const object = current.children.find(o => o.name === id);
    const center = new THREE.Vector3(0, .5, 0);
    let radius = 5;
    if (object) {
        const bounds = new THREE.Box3().setFromObject(object);
        bounds.getCenter(center); radius = bounds.getSize(new THREE.Vector3()).length() * .52;
    }
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(20)) / Math.min(1, camera.aspect);
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(1, .95, 1.45).normalize().multiplyScalar(distance));
    controls.update(); draw();
}
new ResizeObserver(() => {
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    camera.aspect = viewport.clientWidth / viewport.clientHeight; camera.updateProjectionMatrix();
    if (!lab.ready) focus('all'); else draw();
}).observe(viewport);
function dispose(group: THREE.Group) {
    const textures = new Set<THREE.Texture>();
    group.traverse(o => {
        if (!(o instanceof THREE.Mesh)) return;
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value);
            m.dispose();
        }
    });
    textures.forEach(t => { t.dispose(); if (t.source.data instanceof ImageBitmap) t.source.data.close(); });
}
async function load(quality: Quality) {
    wanted = quality; lab.ready = false; retry.hidden = true; status.textContent = '素材を読み込み中…';
    document.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach(b => b.disabled = true);
    const start = performance.now();
    const results = await Promise.allSettled(assets.map(async a => {
        const path = design && quality !== '2048' ? `design-v2/${quality === 'runtime' ? 'near.glb' : 'model.glb'}` : quality === '1024' ? 'optimized/model-1024.glb' : 'final/model.glb';
        const gltf = await loader.loadAsync(`/assets/island-${a.id}-v1/${quality === 'runtime' && !design ? 'runtime/near.glb' : path}`);
        const group = gltf.scene; group.name = a.id; group.position.set(a.position[0], a.position[1], a.position[2]); group.scale.setScalar(a.scale);
        group.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
        return group;
    }));
    const failed = results.find(r => r.status === 'rejected');
    if (failed) {
        results.forEach(r => { if (r.status === 'fulfilled') dispose(r.value); });
        lab.errors.push(String(failed.reason)); status.textContent = '読み込めませんでした。通信を確認して読み込み直してください。'; retry.hidden = false;
    } else {
        const next = new THREE.Group(); results.forEach(r => { if (r.status === 'fulfilled') next.add(r.value); });
        scene.remove(current); dispose(current); current = next; scene.add(current);
        renderer.shadowMap.needsUpdate = true; draw();
        lab.quality = quality; lab.ready = true; lab.loadMs = Math.round(performance.now() - start);
        status.textContent = `${quality === 'runtime' ? '配信用（圧縮テクスチャ）' : quality === '1024' ? (design ? 'Blender修正版' : '軽い1K') : (design ? '変更前' : '元の2K')}を表示中`;
        const idx = quality === 'runtime' ? 2 : quality === '1024' ? 1 : 0;
        const bytes = assets.reduce((sum, a) => sum + (design ? designManifest[a.id as keyof typeof designManifest].bytes[idx] : runtimeManifest[a.id as keyof typeof runtimeManifest].bytes[idx]), 0);
        document.querySelector('#stats')!.innerHTML = `<dt>${assets.length}素材のGLB合計</dt><dd>${(bytes / 1e6).toFixed(2)} MB</dd><dt>三角形数</dt><dd>${(design ? assets.reduce((sum, a) => sum + designManifest[a.id as keyof typeof designManifest][quality === '2048' ? 'beforeTriangles' : 'triangles'], 0) : triangles).toLocaleString()}</dd><dt>読込＋初回描画</dt><dd>${lab.loadMs} ms</dd>`;
    }
    document.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach(b => {
        b.disabled = false; b.setAttribute('aria-pressed', String(b.dataset.quality === lab.quality));
    });
}
document.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach(b => b.onclick = () => { void load(b.dataset.quality as Quality); });
document.querySelectorAll<HTMLButtonElement>('[data-focus]').forEach(b => b.onclick = () => focus(b.dataset.focus!));
retry.onclick = () => { void load(wanted); };
focus('all'); void load(wanted);
