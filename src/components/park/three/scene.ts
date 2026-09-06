import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { PartKind } from '../../../domain/park/types';
import { type ToyFrame, TOY } from './choreography';
import { createMaterials, ToyPrimitives } from './materials';
import { createBase, createGate, createSlide, createTrampoline } from './toys';
import { createDoll } from './doll';
import { createBubble } from './bubble';

export function createToyScene(canvas: HTMLCanvasElement, layout: readonly (PartKind | null)[], options: { alpha?: boolean } = {}) {
    // Check before constructing WebGLRenderer, avoiding an uncaught failure in React.
    const gl = canvas.getContext('webgl2', { alpha: Boolean(options.alpha), antialias: true, powerPreference: 'low-power' });
    if (!gl) throw new Error('WebGL2 unavailable');
    const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: Boolean(options.alpha), antialias: true, powerPreference: 'low-power' });
    const p = new ToyPrimitives(), m = createMaterials();
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#fbf7ee');
    const camera = new THREE.OrthographicCamera(-3.6, 3.6, 3, -3, .1, 60);
    const focus = new THREE.Vector3(1.68, 1.25, 0);
    camera.position.copy(focus).add(new THREE.Vector3(4.5, 4.8, 9)); camera.lookAt(focus);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .93;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment(); const environment = pmrem.fromScene(room, .04);
    scene.environment = environment.texture; scene.environmentIntensity = .5;
    room.dispose(); pmrem.dispose();
    scene.add(new THREE.HemisphereLight('#fffdf2', '#b5bdca', 1.05));
    const key = new THREE.DirectionalLight('#fff4dc', 2.0); key.position.set(-3, 7, 5); key.target.position.set(1.5, 0, 0);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.normalBias = .022;
    Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: .1, far: 20 });
    key.shadow.bias = -.0002; scene.add(key, key.target);
    const floor = p.mesh(scene, p.keep(new THREE.PlaneGeometry(200, 200)), m.ground, [0, -.3, 0]); floor.rotation.x = -Math.PI / 2; floor.castShadow = false;
    scene.add(createBase(p, m));
    const trampolines: ReturnType<typeof createTrampoline>[] = [];
    layout.forEach((kind, i) => {
        let group: THREE.Group | undefined;
        if (kind === 'slide') group = createSlide(p, m);
        if (kind === 'bubble') group = createGate(p, m);
        if (kind === 'trampoline') { const t = createTrampoline(p, m); trampolines[i] = t; group = t.group; }
        if (group) { group.position.x = i * TOY.spacing; scene.add(group); }
    });
    const doll = createDoll(p, m); scene.add(doll.root);
    const bubble = createBubble(p); scene.add(bubble.root, bubble.popRoot);
    let width = 0, height = 0, frames = 0;
    const project = (x: number, y: number, z = 0) => {
        const v = new THREE.Vector3(x, y, z).project(camera);
        return { x: (v.x + 1) * width / 2, y: (1 - v.y) * height / 2 };
    };
    return {
        renderer, scene, camera, doll, bubble,
        resize(w: number, h: number, compact = false) {
            width = w; height = h;
            // Compact HTML editor keeps the shelf on screen; camera yaw/elevation stay fixed.
            const compactFocus = new THREE.Vector3(1.68, compact ? .85 : 1.25, 0);
            camera.position.copy(compactFocus).add(new THREE.Vector3(4.5, 4.8, 9)); camera.lookAt(compactFocus);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75, 1200 / Math.max(w, h)));
            renderer.setSize(w, h, false);
            const worldWidth = 7.1;
            camera.left = -worldWidth / 2; camera.right = worldWidth / 2;
            camera.top = worldWidth / (w / h) / 2; camera.bottom = -camera.top;
            camera.updateProjectionMatrix();
        },
        draw(frame: ToyFrame) {
            doll.pose(frame); bubble.update(frame, camera);
            trampolines.forEach((t, i) => t.compress(frame.contactSlot === i ? frame.compression : 0));
            renderer.render(scene, camera); frames++;
            return { frames, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
                geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
                actorPixels: Math.abs(project(0, TOY.height).y - project(0, 0).y),
                foot: project(frame.point.x, frame.point.y), head: project(frame.point.x, frame.point.y + TOY.height),
                buffer: { width: canvas.width, height: canvas.height }, dpr: renderer.getPixelRatio() };
        },
        dispose() {
            p.dispose(); Object.values(m).forEach(material => material.dispose()); m.wood.map?.dispose();
            bubble.materials.forEach(material => material.dispose()); environment.dispose();
            key.shadow.dispose(); renderer.dispose();
            // React StrictMode reuses the connected canvas for its setup/cleanup probe.
            if (!canvas.isConnected) renderer.forceContextLoss();
        },
    };
}
