import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const stage = document.querySelector('#stage');
const canvas = stage.querySelector('canvas');
const status = stage.querySelector('.loading');
const buttons = [...stage.querySelectorAll('[data-view]')];
const MODEL_REVISION = '1699f584c55e5644';
const modelUrl = new URL('./whole-island.glb', import.meta.url);
modelUrl.searchParams.set('v', MODEL_REVISION);
document.querySelector('#model-file').href = modelUrl.href;
document.querySelector('#native-file').href = new URL('./whole-island.blend', import.meta.url).href;
document.querySelector('#render-file').href = new URL('./whole-island-render.png', import.meta.url).href;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#b4c7df');
const camera = new THREE.OrthographicCamera(-20, 20, 15, -15, 0.1, 180);
camera.position.set(24, 29, 36);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
const sky = new THREE.HemisphereLight('#d5e6ff', '#b9afb6', 1.6);
scene.add(sky);
const sun = new THREE.DirectionalLight('#ffdbc3', 1.8);
sun.position.set(-12, 20, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 65 });
sun.shadow.bias = -0.00035;
sun.shadow.normalBias = 0.03;
scene.add(sun);
const fill = new THREE.DirectionalLight('#b9d6ff', 1.1);
fill.position.set(12, 18, -14);
scene.add(fill);

// The same quiet pink / blue sky lights rough walls, leaves and reflective water.
const skyPixels = new Float32Array(64 * 32 * 4);
const horizon = new THREE.Color('#e8c4d0');
const zenith = new THREE.Color('#91bada');
const lower = new THREE.Color('#9fbed1');
for (let y = 0; y < 32; y++) {
  const elevation = Math.cos((y / 31) * Math.PI);
  const color = horizon.clone().lerp(elevation > 0 ? zenith : lower, Math.pow(Math.abs(elevation), 0.5));
  for (let x = 0; x < 64; x++) {
    const n = (y * 64 + x) * 4;
    skyPixels.set([color.r, color.g, color.b, 1], n);
  }
}
const skyMap = new THREE.DataTexture(skyPixels, 64, 32, THREE.RGBAFormat, THREE.FloatType);
skyMap.mapping = THREE.EquirectangularReflectionMapping;
skyMap.colorSpace = THREE.LinearSRGBColorSpace;
skyMap.needsUpdate = true;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromEquirectangular(skyMap).texture;
scene.environmentIntensity = 0.45;
skyMap.dispose(); pmrem.dispose();

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.13, 0.45, 1.4);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const entryLights = [];
const glowMaterials = new Map();
let currentLight = 'dusk';

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = false;
controls.minZoom = 0.55;
controls.maxZoom = 4;
controls.minPolarAngle = 0.24;
controls.maxPolarAngle = 1.37;
controls.target.set(0, 1.8, -1.2);
controls.enablePan = true;
const views = {
  whole: { position: [24, 29, 36], target: [0, 2, -1.2], span: 29.4 },
  grove: { position: [7, 20, 15], target: [-5.5, 3.5, -4.1], span: 14 },
  village: { position: [9, 13, 21], target: [-5.2, 1.9, 2.7], span: 11 },
  garden: { position: [19, 15, 12], target: [5.6, 3.1, -4.2], span: 13 },
};
let currentView = 'whole';
let queued = false;
function draw() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    composer.render();
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
  composer.setSize(width, height);
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
function showLight(name) {
  currentLight = name;
  const day = name === 'day';
  sky.color.set(day ? '#e8f4ff' : '#d5e6ff');
  sun.color.set(day ? '#fff2dd' : '#ffdbc3');
  sun.intensity = day ? 2.4 : 1.8;
  fill.intensity = day ? 0.85 : 1.1;
  bloom.strength = day ? 0 : 0.13;
  entryLights.forEach(light => { light.intensity = day ? 0.2 : 1.5; });
  for (const [material, strength] of glowMaterials) material.emissiveIntensity = strength * (day ? 0.1 : 1);
  stage.dataset.lighting = name;
  stage.querySelectorAll('[data-light]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.light === name)));
  renderer.shadowMap.needsUpdate = true;
  draw();
}
stage.querySelectorAll('[data-light]').forEach(button => button.addEventListener('click', () => showLight(button.dataset.light)));
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

function addWaterReflection(mesh) {
  // Reflect the actual island with the actual orthographic camera. No painted copy.
  const target = new THREE.WebGLRenderTarget(1024, 1024, { type: THREE.HalfFloatType });
  const reflectionMatrix = new THREE.Matrix4();
  const reflectedCamera = camera.clone();
  const material = mesh.material;
  material.onBeforeCompile = shader => {
    shader.uniforms.islandReflection = { value: target.texture };
    shader.uniforms.islandReflectionMatrix = { value: reflectionMatrix };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 islandReflectionMatrix;\nvarying vec4 islandReflectionCoord;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nislandReflectionCoord = islandReflectionMatrix * modelMatrix * vec4(transformed, 1.0);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D islandReflection;\nvarying vec4 islandReflectionCoord;')
      .replace('#include <opaque_fragment>', `
        vec2 reflectedUV = islandReflectionCoord.xy / islandReflectionCoord.w;
        vec3 reflectedColor = texture2D(islandReflection, reflectedUV).rgb;
        float waterFresnel = 0.10 + 0.30 * pow(1.0 - max(dot(normal, normalize(vViewPosition)), 0.0), 3.0);
        outgoingLight = mix(outgoingLight, reflectedColor, waterFresnel);
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => 'native-02-reflected-tide';
  mesh.onBeforeRender = () => {
    const height = -0.025;
    reflectedCamera.copy(camera);
    reflectedCamera.position.y = 2 * height - camera.position.y;
    const reflectedTarget = controls.target.clone();
    reflectedTarget.y = 2 * height - reflectedTarget.y;
    reflectedCamera.up.copy(camera.up); reflectedCamera.up.y *= -1;
    reflectedCamera.lookAt(reflectedTarget); reflectedCamera.updateMatrixWorld();
    reflectionMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
      .multiply(reflectedCamera.projectionMatrix).multiply(reflectedCamera.matrixWorldInverse);
    // General oblique near plane, including orthographic projections.
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -height).applyMatrix4(reflectedCamera.matrixWorldInverse);
    const clip = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const q = new THREE.Vector4(Math.sign(clip.x), Math.sign(clip.y), 1, 1).applyMatrix4(reflectedCamera.projectionMatrix.clone().invert());
    clip.multiplyScalar(2 / clip.dot(q));
    const e = reflectedCamera.projectionMatrix.elements;
    e[2] = clip.x - e[3]; e[6] = clip.y - e[7]; e[10] = clip.z - e[11]; e[14] = clip.w - e[15];
    const previous = renderer.getRenderTarget();
    const tone = renderer.toneMapping;
    mesh.visible = false;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, reflectedCamera);
    renderer.setRenderTarget(previous); renderer.toneMapping = tone;
    mesh.visible = true;
  };
}

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
      if (!['position', 'normal', 'uv', 'color'].includes(attribute)) geometry.deleteAttribute(attribute);
    }
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
    const list = buckets.get(object.material) ?? [];
    list.push(geometry);
    buckets.set(object.material, list);
  });
  for (const [material, geometries] of buckets) {
    if (['window / pale blue glass', 'willow / pearl flower light'].includes(material.name)) glowMaterials.set(material, material.emissiveIntensity);
    const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
    mesh.castShadow = !material.name.startsWith('sea /');
    mesh.receiveShadow = true;
    if (material.name === 'sea / tide and sky water') addWaterReflection(mesh);
    scene.add(mesh);
    geometries.forEach(geometry => geometry.dispose());
  }
  leftovers.forEach(object => scene.attach(object));
  gltf.scene.traverse(object => { if (object.isMesh && !leftovers.includes(object)) object.geometry.dispose(); });
  renderer.shadowMap.needsUpdate = true;
  // Modest local light at real house entries; bright ambient illumination remains.
  for (const [x, y, z] of [[-7, 1.9, 4.3], [-3.8, 1.9, 3.9], [-5.1, 1.9, 1.4], [-7, 2.3, -3.7], [-3.6, 3.5, -6.9], [5.4, 1.9, 4.4], [8.25, 1.9, 2.8], [7.6, 2.3, -0.9]]) {
    const lamp = new THREE.PointLight('#ffcc93', 1.5, 3.2, 2);
    lamp.position.set(x, y, z); scene.add(lamp); entryLights.push(lamp);
  }
  status.textContent = '';
  stage.dataset.model = 'whole-island-native-3d-02';
  stage.dataset.revision = MODEL_REVISION;
  showLight(currentLight);
  draw();
}, undefined, error => {
  status.textContent = '3Dを読み込めませんでした。下の全景レンダーから島を確認できます。';
  console.error(error);
});
