import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const host = document.querySelector('#stage');
const status = document.querySelector('#status');
const timeline = document.querySelector('#timeline');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0xd9eaf3);
host.append(renderer.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xe4f2ff, 0xb39876, 2));
const sun = new THREE.DirectionalLight(0xfff1dc, 3);
sun.position.set(-3, 7, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
sun.shadow.bias = -0.001;
scene.add(sun);
const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .1, 60);
camera.position.set(4.6, 6, 7.6);
camera.lookAt(.65, .35, -.05);
let mixer, action, playing = false, close = false, previous = 0;

function render() { renderer.render(scene, camera); }
function resize() {
  const { width, height } = host.getBoundingClientRect();
  const halfHeight = close ? 1.6 : 2.55;
  camera.left = -halfHeight * width / height;
  camera.right = -camera.left;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  render();
}
new ResizeObserver(resize).observe(host);
function seek(time) {
  action.reset().play();
  mixer.setTime(time);
  timeline.value = String(time);
  render();
}
function tick(now) {
  if (!playing) return;
  const dt = Math.min((now - previous) / 1000, .05);
  previous = now;
  mixer.update(dt);
  timeline.value = String(Math.min(action.time, action.getClip().duration));
  render();
  if (action.time >= action.getClip().duration) {
    playing = false;
    status.textContent = '浜辺に戻りました';
    return;
  }
  requestAnimationFrame(tick);
}
new GLTFLoader().load('./crab-trial.glb', (gltf) => {
  gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(gltf.scene);
  if (!gltf.animations.length) throw new Error('Animation missing');
  mixer = new THREE.AnimationMixer(gltf.scene);
  action = mixer.clipAction(gltf.animations[0]);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  timeline.max = String(action.getClip().duration);
  document.querySelectorAll('button,input').forEach((el) => { el.disabled = false; });
  document.body.dataset.ready = 'true';
  document.body.dataset.candidate = 'crab-mcp-trial-v1';
  document.body.dataset.duration = String(action.getClip().duration);
  seek(0);
  status.textContent = '準備できました';
}, undefined, (error) => { status.textContent = `読み込みに失敗しました: ${error.message}`; });
document.querySelector('#play').addEventListener('click', () => {
  playing = false;
  seek(0);
  if (reduced.matches) {
    seek(79 / 24);
    status.textContent = '動きを減らす設定：石の陰のポーズを表示しています';
    return;
  }
  playing = true;
  previous = performance.now();
  status.textContent = 'カニの動きを再生しています';
  requestAnimationFrame(tick);
});
document.querySelectorAll('[data-frame]').forEach((button) => button.addEventListener('click', () => {
  playing = false;
  seek((Number(button.dataset.frame) - 1) / 24);
  status.textContent = `${button.textContent}のポーズ`;
}));
timeline.addEventListener('input', () => { playing = false; seek(Number(timeline.value)); });
document.querySelector('#view').addEventListener('click', (event) => {
  close = !close;
  event.target.textContent = close ? '全体を見る' : '近くで見る';
  resize();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) playing = false; });
reduced.addEventListener('change', () => { if (reduced.matches) playing = false; });
