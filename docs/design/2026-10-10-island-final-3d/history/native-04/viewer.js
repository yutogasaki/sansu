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
const MODEL_REVISION = 'b32206613c7383a3';
const PREVIOUS_REVISION = '1699f584c55e5644';
const phases = {
  grown: { model: new URL('./whole-island.glb', import.meta.url), native: new URL('./whole-island.blend', import.meta.url), render: new URL('./whole-island-render.png', import.meta.url), revision: MODEL_REVISION, candidate: 'whole-island-native-3d-04' },
  previous: { model: new URL('./history/native-02/whole-island.glb', import.meta.url), native: new URL('./history/native-02/whole-island.blend', import.meta.url), render: new URL('./history/native-02/whole-island-render.png', import.meta.url), revision: PREVIOUS_REVISION, candidate: 'whole-island-native-3d-02' },
};
let currentPhase = 'grown';
let loadSequence = 0;
let modelRoot = null;
const modelUrl = new URL('./whole-island.glb', import.meta.url);
modelUrl.searchParams.set('v', MODEL_REVISION);
document.querySelector('#model-file').href = modelUrl.href;
document.querySelector('#native-file').href = new URL('./whole-island.blend', import.meta.url).href;
document.querySelector('#render-file').href = new URL('./whole-island-render.png', import.meta.url).href;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#b4c7df');
const camera = new THREE.OrthographicCamera(-20, 20, 15, -15, 0.1, 180);
camera.position.set(39, 43, 46);
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
sun.position.set(-16, 32, 22);
sun.target.position.set(3, 2, -6);
scene.add(sun.target);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 110 });
sun.shadow.bias = -0.00035;
sun.shadow.normalBias = 0.03;
sun.shadow.intensity = 0.55;
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
let currentLight = 'day';

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = false;
controls.minZoom = 0.55;
controls.maxZoom = 4;
controls.minPolarAngle = 0.24;
controls.maxPolarAngle = 1.37;
controls.target.set(3, 3.2, -6.3);
controls.enablePan = true;
const views = {
  whole: { position: [39, 43, 46], target: [3, 3.2, -6.3], span: 46 },
  grove: { position: [8, 23, 8], target: [-5.0, 6.2, -15.7], span: 18 },
  village: { position: [24, 24, 8], target: [3.1, 4.9, -15.8], span: 16 },
  harbor: { position: [30, 21, 20], target: [14.1, 2.1, -2], span: 17 },
  garden: { position: [19, 15, 12], target: [5.6, 3.1, -4.2], span: 13 },
};
let currentView = 'whole';
let queued = false;
function draw() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    stage.dataset.camera = JSON.stringify({ position: camera.position.toArray(), target: controls.target.toArray(), zoom: camera.zoom, frustum: [camera.left, camera.right, camera.top, camera.bottom] });
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
  stage.dataset.view = name;
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
  mesh.userData.reflectionTarget = target;
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

function extendWaterBackground(geometry) {
  // A common camera reaches beyond the archived ocean. Continue only its water
  // from the stored edge colors; island geometry and its world scale are intact.
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  const inner = [[bounds.min.x, bounds.min.z], [bounds.max.x, bounds.min.z], [bounds.max.x, bounds.max.z], [bounds.min.x, bounds.max.z]];
  const outer = [[-240, -240], [240, -240], [240, 240], [-240, 240]];
  const position = geometry.attributes.position;
  const color = geometry.attributes.color;
  const colors = [];
  for (const [x, z] of inner) {
    let nearest = 0; let distance = Infinity;
    for (let i = 0; i < position.count; i++) {
      const d = (position.getX(i) - x) ** 2 + (position.getZ(i) - z) ** 2;
      if (d < distance) { nearest = i; distance = d; }
    }
    const rgba = [color.getX(nearest), color.getY(nearest), color.getZ(nearest)];
    if (color.itemSize === 4) rgba.push(color.getW(nearest));
    colors.push(rgba);
  }
  // A flat four-quad skirt makes the rippling archived water end in a visible
  // diagonal. Continue its actual wave equation over a gridded outer surface.
  const along = 160;
  const layers = 100;
  const ringSize = along * 4;
  const vertices = []; const rgba = []; const indices = [];
  for (let ring = 0; ring <= layers; ring++) {
    const t = ring / layers;
    for (let side = 0; side < 4; side++) {
      const next = (side + 1) % 4;
      for (let step = 0; step < along; step++) {
        const u = step / along;
        const ix = THREE.MathUtils.lerp(inner[side][0], inner[next][0], u);
        const iz = THREE.MathUtils.lerp(inner[side][1], inner[next][1], u);
        const ox = THREE.MathUtils.lerp(outer[side][0], outer[next][0], u);
        const oz = THREE.MathUtils.lerp(outer[side][1], outer[next][1], u);
        const x = THREE.MathUtils.lerp(ix, ox, t);
        const z = THREE.MathUtils.lerp(iz, oz, t);
        const wave = 0.014 * Math.sin(x * 3.1 - z * 1.7) + 0.006 * Math.cos(x * 6.1 + z * 3.2);
        vertices.push(x, -0.026 + wave, z);
        for (let channel = 0; channel < color.itemSize; channel++) rgba.push(THREE.MathUtils.lerp(colors[side][channel], colors[next][channel], u));
      }
    }
  }
  for (let ring = 0; ring < layers; ring++) {
    for (let i = 0; i < ringSize; i++) {
      const next = (i + 1) % ringSize;
      const a = ring * ringSize + i; const b = (ring + 1) * ringSize + i;
      const an = ring * ringSize + next; const bn = (ring + 1) * ringSize + next;
      indices.push(a, bn, b, a, an, bn);
    }
  }
  const skirt = new THREE.BufferGeometry();
  skirt.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  skirt.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(vertices.length / 3 * 2), 2));
  skirt.setAttribute('color', new THREE.Float32BufferAttribute(rgba, color.itemSize));
  skirt.setIndex(indices); skirt.computeVertexNormals();
  const merged = mergeGeometries([geometry, skirt]);
  geometry.dispose(); skirt.dispose();
  return merged;
}

// Only one island is visible. Switching keeps the same world scale and camera.
// Each phase is the actual archived/current GLB, never a scaled screenshot.
function loadPhase(name) {
  currentPhase = name;
  const sequence = ++loadSequence;
  const phase = phases[name];
  const url = new URL(phase.model.href);
  url.searchParams.set('v', phase.revision);
  status.textContent = '3Dの島を読み込んでいます…';
  stage.dataset.loading = 'true';
  stage.querySelectorAll('[data-phase]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.phase === name)));
  new GLTFLoader().load(url.href, gltf => {
    if (sequence !== loadSequence) {
      gltf.scene.traverse(object => { if (object.isMesh) object.geometry.dispose(); });
      return;
    }
    if (modelRoot) {
      scene.remove(modelRoot);
      modelRoot.traverse(object => {
        if (!object.isMesh) return;
        object.geometry.dispose();
        if (object.userData.reflectionTarget) object.userData.reflectionTarget.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => { material.map?.dispose(); material.dispose(); });
      });
    }
    entryLights.forEach(light => scene.remove(light));
    entryLights.length = 0;
    glowMaterials.clear();
    modelRoot = new THREE.Group();
    gltf.scene.updateMatrixWorld(true);
    const buckets = new Map();
    const lamps = [];
    gltf.scene.traverse(object => {
      if (!object.isMesh) return;
      if (object.name.includes('cobalt_entry') || object.name.includes('cobalt entry')) {
        lamps.push(object.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.4, 0.18)));
      }
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
      let geometry = mergeGeometries(geometries);
      if (material.name === 'sea / tide and sky water') geometry = extendWaterBackground(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = !material.name.startsWith('sea /') && !(material.transmission > 0.3);
      mesh.receiveShadow = true;
      if (material.name === 'sea / tide and sky water') addWaterReflection(mesh);
      modelRoot.add(mesh);
      geometries.forEach(geometry => geometry.dispose());
    }
    scene.add(modelRoot);
    gltf.scene.traverse(object => { if (object.isMesh) object.geometry.dispose(); });
    for (const position of lamps) {
      const lamp = new THREE.PointLight('#ffcc93', 1.5, 3.2, 2);
      lamp.position.copy(position); scene.add(lamp); entryLights.push(lamp);
    }
    document.querySelector('#model-file').href = url.href;
    document.querySelector('#native-file').href = phase.native.href;
    document.querySelector('#render-file').href = phase.render.href;
    status.textContent = '';
    stage.dataset.model = phase.candidate;
    stage.dataset.revision = phase.revision;
    stage.dataset.phase = name;
    stage.dataset.loading = 'false';
    document.querySelector('.phase-note').textContent = name === 'grown' ? '丘・森・入り江へ育った島' : 'これまでの庭（同じ縮尺）';
    renderer.shadowMap.needsUpdate = true;
    showLight(currentLight);
    draw();
  }, undefined, error => {
    if (sequence !== loadSequence) return;
    stage.dataset.loading = 'false';
    status.textContent = '3Dを読み込めませんでした。下の全景レンダーから島を確認できます。';
    console.error(error);
  });
}
stage.querySelectorAll('[data-phase]').forEach(button => button.addEventListener('click', () => loadPhase(button.dataset.phase)));
loadPhase('grown');
