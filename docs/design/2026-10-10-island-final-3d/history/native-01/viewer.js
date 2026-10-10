import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const stage = document.querySelector('#stage');
const canvas = stage.querySelector('canvas');
const status = stage.querySelector('.loading');
const buttons = [...stage.querySelectorAll('[data-view]')];
const modelUrl = new URL('./whole-island.glb', import.meta.url);
document.querySelector('#model-file').href = modelUrl.href;
document.querySelector('#native-file').href = new URL('./whole-island.blend', import.meta.url).href;
document.querySelector('#render-file').href = new URL('./whole-island-render.png', import.meta.url).href;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#8dccdf');
const camera = new THREE.OrthographicCamera(-20, 20, 15, -15, 0.1, 180);
camera.position.set(26, 30, 35);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
const sky = new THREE.HemisphereLight('#edf8ff', '#9ba4ab', 1.6);
scene.add(sky);
const sun = new THREE.DirectionalLight('#fff6e8', 2.7);
sun.position.set(-12, 28, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 65 });
sun.shadow.bias = -0.00035;
sun.shadow.normalBias = 0.03;
scene.add(sun);
const fill = new THREE.DirectionalLight('#d9f0ff', 0.9);
fill.position.set(12, 18, -14);
scene.add(fill);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = false;
controls.minZoom = 0.55;
controls.maxZoom = 4;
controls.minPolarAngle = 0.24;
controls.maxPolarAngle = 1.37;
controls.target.set(0, 1.8, -1.2);
controls.enablePan = true;
const views = {
  whole: { position: [26, 30, 35], target: [0, 1.8, -1.2], span: 30 },
  grove: { position: [10, 15, 17], target: [-5.5, 3.2, -4.1], span: 14 },
  village: { position: [9, 13, 21], target: [-5.2, 1.9, 2.7], span: 11 },
  garden: { position: [19, 15, 12], target: [6, 2.7, -4.2], span: 12 },
};
let currentView = 'whole';
let queued = false;
function draw() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    renderer.render(scene, camera);
  });
}
function resize() {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  const aspect = width / height;
  // Keep the complete island at narrow widths; ocean is excluded from the fit.
  const halfHeight = Math.max(views[currentView].span * 0.38, views[currentView].span / (2 * aspect));
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  draw();
}
function showView(name) {
  currentView = name;
  const view = views[name];
  camera.position.fromArray(view.position);
  controls.target.fromArray(view.target);
  camera.zoom = 1;
  controls.update();
  buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === name)));
  resize();
}
buttons.forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
stage.querySelectorAll('[data-zoom]').forEach(button => button.addEventListener('click', () => zoom(button.dataset.zoom === 'in' ? 1.2 : 1 / 1.2)));
function zoom(factor) {
  camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, controls.minZoom, controls.maxZoom);
  camera.updateProjectionMatrix();
  draw();
}
canvas.addEventListener('keydown', event => {
  if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.2); }
  if (event.key === '-') { event.preventDefault(); zoom(1 / 1.2); }
  if (event.key === 'Home') { event.preventDefault(); showView('whole'); }
  if (event.key.startsWith('Arrow')) {
    event.preventDefault();
    const relative = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(relative);
    if (event.key === 'ArrowLeft') spherical.theta -= 0.12;
    if (event.key === 'ArrowRight') spherical.theta += 0.12;
    if (event.key === 'ArrowUp') spherical.phi -= 0.09;
    if (event.key === 'ArrowDown') spherical.phi += 0.09;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, controls.minPolarAngle, controls.maxPolarAngle);
    camera.position.copy(new THREE.Vector3().setFromSpherical(spherical).add(controls.target));
    controls.update();
  }
});
controls.addEventListener('change', draw);
new ResizeObserver(resize).observe(stage);
showView('whole');

new GLTFLoader().load(modelUrl.href, gltf => {
  gltf.scene.updateMatrixWorld(true);
  // Batch the immutable presentation copy. The .blend retains every editable object.
  const buckets = new Map();
  const leftovers = [];
  gltf.scene.traverse(object => {
    if (!object.isMesh) return;
    if (Array.isArray(object.material) || object.isSkinnedMesh) { leftovers.push(object); return; }
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    for (const attribute of Object.keys(geometry.attributes)) {
      if (!['position', 'normal', 'uv'].includes(attribute)) geometry.deleteAttribute(attribute);
    }
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
    const list = buckets.get(object.material) ?? [];
    list.push(geometry);
    buckets.set(object.material, list);
  });
  for (const [material, geometries] of buckets) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
    mesh.castShadow = material.name !== 'sea / clean blue';
    mesh.receiveShadow = true;
    scene.add(mesh);
    geometries.forEach(geometry => geometry.dispose());
  }
  leftovers.forEach(object => scene.attach(object));
  gltf.scene.traverse(object => { if (object.isMesh && !leftovers.includes(object)) object.geometry.dispose(); });
  renderer.shadowMap.needsUpdate = true;
  status.textContent = '';
  stage.dataset.model = 'whole-island-native-3d-01';
  draw();
}, undefined, error => {
  status.textContent = '3Dを読み込めませんでした。下の全景レンダーから島を確認できます。';
  console.error(error);
});
