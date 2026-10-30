import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { houseFits, houseSpot, moveHouse, padHouses, rng, treeFits, treeSpot, type House, type Tree } from './growth';
import { cutRoads, network, type P3, type Road, type XZ } from './roads';
import { N, RES, SIZE, brush, heightAt, sampleIsland, slopeAt, type Heights } from './terrain';
import { IslandMaterials } from '../../components/island/three/primitives';
import { makeResidentRig, type ResidentSpecies } from '../../components/island/three/residentRig';
import './style.css';

// Grow lab: the child shapes a green island with つむ／けずる and now and then
// sets down one special building. The island does the rest: winding roads
// cut into the slopes, a bus, houses along the roads, trees on the hills.
// Nothing the child does is refused: where the rules would say no, the island
// finds another way (steps, a bridge, a funicular, a house that moves next door).

type Tool = 'stack' | 'carve';
type Time = 'day' | 'dusk';
type SpecialKind = 'home' | 'chapel' | 'lighthouse' | 'tower';
/** `stage` is how far a child's house has grown from its seed (0 seed … 3 full). */
interface Special { x: number; z: number; kind: SpecialKind; stage?: number }

const root = document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML = `<div id="viewport"></div>
<div class="top"><span>DEVELOPMENT · そだつ島 試作</span><div class="seg" id="time"><button data-time="day">ひる</button><button data-time="dusk">ゆうがた</button></div></div>
<p class="stat" id="stat" aria-live="polite"></p>
<div class="tools"><button id="undo" aria-label="もどす">↶</button><div class="seg big" id="tool"><button data-tool="stack">つむ</button><button data-tool="carve">けずる</button></div><button id="seed" aria-label="おうちの たね">🌱</button><button id="special" aria-label="とくべつな たてもの">★</button></div>`;
const viewport = root.querySelector<HTMLDivElement>('#viewport')!;
const stat = root.querySelector<HTMLParagraphElement>('#stat')!;
const params = new URLSearchParams(location.search);
let time: Time = params.get('time') === 'dusk' ? 'dusk' : 'day';
let tool: Tool = 'stack';
let placing: SpecialKind | null = null;
const KINDS: SpecialKind[] = ['lighthouse', 'tower', 'chapel'];
let given = 0;

let base: Heights = sampleIsland();
// The island starts from the child's own house on the hill; the roads come to it.
let specials: Special[] = [{ x: -1, z: -1.5, kind: 'home', stage: 3 }];
/** The ground the island has settled on: roads cut in, plots levelled. */
let shaped: Heights = base;
/** Ground with the roads cut in, before the houses level their plots. */
let cut: Heights = base;
/** What the ground is easing towards; while a finger strokes, the stroke on top of the settled ground. */
let target: Heights = base;
/** What is on screen: it follows `target` softly, a few frames behind. */
const shown: Heights = base.slice();
/** shaped minus base, so a stroke can be shown before the island rethinks. */
const offset = new Float32Array(N * N);
let roads: Road[] = [];
let houses: House[] = [];
let trees: Tree[] = [];
const history: { base: Heights; specials: Special[]; houses: House[]; trees: Tree[] }[] = [];
const rand = rng(7);
let nextId = 1;

// ---------- scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
// Start sharp enough and cheap; the loop raises the resolution while frames stay quick.
let pixelRatio = 1;
renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
viewport.append(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, .1, 300);
camera.position.set(11, 13, 17);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.6, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.maxPolarAngle = Math.PI * .47;
controls.minDistance = 6;
controls.maxDistance = 70;
const hemi = new THREE.HemisphereLight(0xffffff, 0x6d7a5a, 1.2);
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 80 });
sun.shadow.bias = -.0006;
scene.add(hemi, sun, sun.target);

const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, ...extra });
const M = {
    ground: mat(0xffffff, { vertexColors: true, flatShading: false }),
    sea: mat(0x2f8fc4, { roughness: .3 }),
    road: mat(0x8f8a83, { polygonOffset: true, polygonOffsetFactor: -2 }),
    stone: mat(0xd9cdb6, { polygonOffset: true, polygonOffsetFactor: -2 }),
    rail: mat(0x5a4f48),
    car: mat(0xd2493a),
    curb: mat(0xf4f0e8),
    base: mat(0xefe8da),
    walls: [0xf6f1e7, 0xf2e3c2, 0xefc4b4, 0xf3d684, 0xdf9478].map(c => mat(c)),
    roof: mat(0xe9e2d4),
    shutter: mat(0x4e8a5c),
    door: mat(0x3f6a4a),
    glass: mat(0x2c3a44),
    dome: mat(0x3a74c9),
    pine: mat(0x456f34), cypress: mat(0x355f30), bush: mat(0x6a9e47), trunk: mat(0x7a5a44),
    bloom: mat(0xe0559a),
    bus: mat(0xef9a2a), busTop: mat(0xf7f3ea), wheel: mat(0x2b2b2b),
};

// ---------- ふしぎカラフル ----------
// Most of the island keeps calm village colours. Here and there a thing is
// painted like a Kusama dot field or a Britto patchwork of black-edged colour,
// and the child's own house always is.
function canvasTexture(draw: (c: CanvasRenderingContext2D, s: number) => void, size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    draw(canvas.getContext('2d')!, size);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}
function dotted(bg: string, dots: string[], count: number, big: number, seed: number) {
    return canvasTexture((c, s) => {
        const r = rng(seed);
        c.fillStyle = bg; c.fillRect(0, 0, s, s);
        for (let i = 0; i < count; i++) {
            c.fillStyle = dots[i % dots.length];
            const x = r() * s, y = r() * s, rad = s * big * (.45 + r() * .55);
            // These go on spheres: squeeze each dot across by how much the
            // sphere's map stretches there, so it lands round, not smeared.
            const across = Math.sin(y / s * Math.PI);
            if (across < .12) continue;
            // Drawn three times across the seam so the dots wrap around.
            for (const dx of [-s, 0, s]) { c.beginPath(); c.ellipse(x + dx, y, rad / (2 * across), rad, 0, 0, Math.PI * 2); c.fill(); }
        }
    });
}
function patchwork(colors: string[], seed: number) {
    return canvasTexture((c, s) => {
        const r = rng(seed), cols = 3, rows = 2;
        const jit = () => (r() - .5) * s * .14;
        const pt = Array.from({ length: (cols + 1) * (rows + 1) }, (_, k) => {
            const i = k % (cols + 1), j = Math.floor(k / (cols + 1));
            return [i * s / cols + (i % cols ? jit() : 0), j * s / rows + (j % rows ? jit() : 0)];
        });
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
            const q = [pt[i + j * (cols + 1)], pt[i + 1 + j * (cols + 1)], pt[i + 1 + (j + 1) * (cols + 1)], pt[i + (j + 1) * (cols + 1)]];
            c.beginPath(); q.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
            c.fillStyle = colors[(i + j * 2 + seed) % colors.length]; c.fill();
            c.save(); c.clip();
            // Every other patch carries dots or stripes, as Britto's do.
            c.fillStyle = '#ffffffcc';
            if ((i + j) % 2) for (let k = 0; k < 14; k++) { c.beginPath(); c.arc(q[0][0] + r() * s / cols, q[0][1] + r() * s / rows, s * .022, 0, Math.PI * 2); c.fill(); }
            else if (r() < .6) for (let k = -s; k < s; k += s * .07) c.fillRect(q[0][0] + k, q[0][1], s * .025, s);
            c.restore();
            c.lineWidth = s * .035; c.strokeStyle = '#1f1c24'; c.stroke();
        }
    });
}
const POKO = ['#739ca5', '#d5b777', '#647db0', '#8e7aac', '#bd897e', '#668bb2'];
const W = {
    // A Kusama pumpkin dome: yellow with black dots.
    pumpkin: mat(0xffffff, { map: dotted('#f2c230', ['#1d1a1a'], 70, .045, 3) }),
    // The village's blue domes, but dotted.
    dome: mat(0xffffff, { map: dotted('#3a74c9', ['#ffffff'], 55, .035, 5) }),
    // The pokomoko dot field, on the child's roof.
    poko: mat(0xffffff, { map: dotted('#234758', POKO, 60, .05, 11) }),
    patch: [
        patchwork(['#ef5b6b', '#f3c63f', '#41a8d8', '#7bc36a', '#9a6fc4'], 1),
        patchwork(['#f29b38', '#4bb7a5', '#e8578f', '#f3d684', '#5a7fd6'], 2),
    ].map(map => mat(0xffffff, { map })),
    crown: mat(0xffffff, { map: dotted('#a48fd0', ['#fff1b0', '#ffc7d9', '#c9f0dc'], 60, .04, 7) }),
};

const sea = new THREE.Mesh(new THREE.CircleGeometry(90, 64), M.sea);
sea.rotation.x = -Math.PI / 2;
sea.position.y = .02;
sea.receiveShadow = true;
scene.add(sea);

const groundGeo = new THREE.PlaneGeometry(SIZE, SIZE, N - 1, N - 1).rotateX(-Math.PI / 2);
groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(N * N * 3), 3));
const ground = new THREE.Mesh(groundGeo, M.ground);
ground.receiveShadow = ground.castShadow = true;
scene.add(ground);

const roadsGroup = new THREE.Group(), housesGroup = new THREE.Group(), treesGroup = new THREE.Group(), specialsGroup = new THREE.Group();
scene.add(roadsGroup, housesGroup, treesGroup, specialsGroup);

const shadowy = <T extends THREE.Object3D>(o: T) => { o.traverse(c => { if ((c as THREE.Mesh).isMesh) c.castShadow = c.receiveShadow = true; }); return o; };

// ---------- ground ----------
const SAND = new THREE.Color(0xe4d3a8), ROCK = new THREE.Color(0xb7a993), MOSS = new THREE.Color(0x4f7a3c), GRASS = [new THREE.Color(0x7fae55), new THREE.Color(0x6d9e4a), new THREE.Color(0x93b862)];
/** Colours follow where the ground is going, so they never lag behind a stroke. */
function paintGround() {
    const pos = groundGeo.attributes.position as THREE.BufferAttribute;
    const col = groundGeo.attributes.color as THREE.BufferAttribute;
    const c = new THREE.Color();
    for (let k = 0; k < N * N; k++) {
        const y = target[k];
        const x = pos.getX(k), z = pos.getZ(k);
        const steep = slopeAt(target, x, z);
        const g = GRASS[Math.abs(Math.floor(x * 1.7 + z * 2.3)) % 3];
        // Sand by the water, green on the slopes, deep green where it is steep;
        // only a true cliff shows pale rock, and even that keeps some green.
        if (y < .4) c.copy(SAND);
        else c.copy(g).lerp(MOSS, Math.min(1, Math.max(0, (steep - .9) / .8))).lerp(ROCK, Math.min(.6, Math.max(0, (steep - 2.4) / 1.2)));
        if (y < .1) c.lerp(new THREE.Color(0xc9b98f), .5);
        col.setXYZ(k, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
}

/** Eases what is shown towards the target; true while the ground is still moving. */
function easeGround(dt: number): boolean {
    const k = 1 - Math.exp(-dt / .07);
    let most = 0;
    for (let i = 0; i < N * N; i++) {
        const d = target[i] - shown[i];
        if (Math.abs(d) < 1e-4) { shown[i] = target[i]; continue; }
        shown[i] += d * k;
        most = Math.max(most, Math.abs(d));
    }
    if (!most) return false;
    const pos = groundGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < N * N; i++) pos.setY(i, shown[i]);
    pos.needsUpdate = true;
    groundGeo.computeVertexNormals();
    groundGeo.computeBoundingSphere();
    return true;
}

// ---------- roads ----------
function ribbon(line: P3[], width: number, lift: number, wall = 0): THREE.BufferGeometry {
    const pos: number[] = [];
    const idx: number[] = [];
    line.forEach((p, i) => {
        const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
        const len = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
        const nx = -(b[2] - a[2]) / len, nz = (b[0] - a[0]) / len;
        if (wall) {
            // A low wall along one edge: bottom and top of the wall.
            const s = Math.sign(wall) * width / 2;
            pos.push(p[0] + nx * s, p[1] + lift, p[2] + nz * s, p[0] + nx * s, p[1] + lift + Math.abs(wall), p[2] + nz * s);
        } else {
            pos.push(p[0] + nx * width / 2, p[1] + lift, p[2] + nz * width / 2, p[0] - nx * width / 2, p[1] + lift, p[2] - nz * width / 2);
        }
        if (i) { const q = i * 2; idx.push(q - 2, q - 1, q, q - 1, q + 1, q); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.userData.ribbon = true;
    return g;
}

const curbs = (line: P3[], width: number, lift: number, height: number) => {
    // Low white walls on both edges, as on the island roads that inspired this.
    for (const side of [height, -height]) {
        const w = new THREE.Mesh(ribbon(line, width, lift, side), M.curb);
        (w.material as THREE.Material).side = THREE.DoubleSide;
        w.castShadow = true;
        roadsGroup.add(w);
    }
};
const STEP = new THREE.BoxGeometry(.5, .06, .1), PILLAR = new THREE.CylinderGeometry(.07, .09, 1, 8), CAR = new RoundedBoxGeometry(.3, .26, .42, 2, .05);
/** Funicular cars, each running up and down its own track. */
let lifts: { line: P3[]; car: THREE.Object3D; s: number; dir: number }[] = [];
/** The ground the roads were drawn on; they ride the shown ground relative to it. */
let roadGround: Heights = base;
const rise = (x: number, z: number) => heightAt(shown, x, z) - heightAt(roadGround, x, z);
let ribbons: { geo: THREE.BufferGeometry; y0: Float32Array }[] = [];
let pieces: { o: THREE.Object3D; y0: number }[] = [];
/** Roads, steps and bridges move with the ground while it eases, without being rebuilt. */
function rideRoads() {
    for (const r of ribbons) {
        const pos = r.geo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) pos.setY(i, r.y0[i] + rise(pos.getX(i), pos.getZ(i)));
        pos.needsUpdate = true;
    }
    for (const p of pieces) p.o.position.y = p.y0 + rise(p.o.position.x, p.o.position.z);
}
function drawRoads() {
    for (const o of roadsGroup.children) {
        const geo = (o as THREE.Mesh).geometry;
        if (geo?.userData.ribbon) geo.dispose();
    }
    roadsGroup.clear();
    lifts = [];
    roadGround = shaped;
    for (const r of roads) for (const part of r.parts) {
        const line = part.line;
        if (line.length < 2) continue;
        if (part.kind === 'road') {
            const road = new THREE.Mesh(ribbon(line, .5, .05), M.road);
            road.receiveShadow = true;
            roadsGroup.add(road);
            curbs(line, .56, .03, .13);
        } else if (part.kind === 'stair') {
            // Pale steps up the slope, a tread every quarter unit.
            roadsGroup.add(shadowy(new THREE.Mesh(ribbon(line, .46, .04), M.stone)));
            line.forEach((p, i) => {
                if (!i) return;
                const q = line[i - 1];
                const step = new THREE.Mesh(STEP, M.stone);
                step.position.set(p[0], Math.max(p[1], q[1]) + .04, p[2]);
                step.rotation.y = Math.atan2(p[0] - q[0], p[2] - q[2]);
                roadsGroup.add(shadowy(step));
            });
            curbs(line, .52, .03, .1);
        } else if (part.kind === 'bridge') {
            // A stone deck with parapets, on pillars down to the ground or the sea floor.
            roadsGroup.add(shadowy(new THREE.Mesh(ribbon(line, .5, 0), M.stone)));
            curbs(line, .52, 0, .16);
            for (let i = 2; i < line.length - 2; i += 4) {
                const [x, y, z] = line[i];
                const foot = Math.min(0, heightAt(shaped, x, z));
                const pillar = new THREE.Mesh(PILLAR, M.base);
                pillar.scale.y = y - foot;
                pillar.position.set(x, (y + foot) / 2, z);
                roadsGroup.add(shadowy(pillar));
            }
        } else {
            // A little funicular: two rails on sleepers and a red car.
            for (const side of [.09, -.09]) {
                const offset = line.map((p, i): P3 => {
                    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
                    const len = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
                    return [p[0] - (b[2] - a[2]) / len * side, p[1], p[2] + (b[0] - a[0]) / len * side];
                });
                roadsGroup.add(new THREE.Mesh(ribbon(offset, .04, .1), M.rail));
            }
            roadsGroup.add(new THREE.Mesh(ribbon(line, .34, .04), M.stone));
            const car = new THREE.Group();
            const body = new THREE.Mesh(CAR, M.car); body.position.y = .18;
            const glass = new THREE.Mesh(new THREE.BoxGeometry(.31, .08, .34), M.glass); glass.position.y = .24;
            car.add(body, glass);
            roadsGroup.add(shadowy(car));
            lifts.push({ line, car, s: 0, dir: 1 });
        }
    }
    const cars = new Set(lifts.map(l => l.car));
    ribbons = []; pieces = [];
    for (const o of roadsGroup.children) {
        const geo = (o as THREE.Mesh).geometry;
        if (geo?.userData.ribbon) {
            const pos = geo.attributes.position as THREE.BufferAttribute;
            ribbons.push({ geo, y0: Float32Array.from({ length: pos.count }, (_, i) => pos.getY(i)) });
        } else if (!cars.has(o)) pieces.push({ o, y0: o.position.y });
    }
    rideRoads();
}

// ---------- houses ----------
const G = {
    floor: new Map<string, THREE.BufferGeometry>(),
    shutter: new THREE.BoxGeometry(.09, .2, .03),
    glass: new THREE.BoxGeometry(.12, .2, .02),
    door: new RoundedBoxGeometry(.18, .32, .04, 2, .02),
    dome: new THREE.SphereGeometry(.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    bloom: new THREE.IcosahedronGeometry(.1, 1),
};
const floorGeo = (w: number, h: number, d: number) => {
    const k = `${w.toFixed(2)},${h},${d.toFixed(2)}`;
    if (!G.floor.has(k)) G.floor.set(k, new RoundedBoxGeometry(w, h, d, 3, .08));
    return G.floor.get(k)!;
};

function footing(o: { x: number; z: number; w: number; d: number }) {
    const ys = [-1, 1].flatMap(a => [-1, 1].map(b => heightAt(shaped, o.x + a * o.w * .5, o.z + b * o.d * .5)));
    return { low: Math.min(...ys), high: Math.max(...ys) };
}

/** A house, built at the origin; `userData.lift` is how far its floor sits above the ground at its middle. */
function buildHouse(o: House): THREE.Group {
    const g = new THREE.Group();
    const { low, high } = footing(o);
    g.userData.lift = high - heightAt(shaped, o.x, o.z);
    // A white base built down the slope, so the house stands level.
    if (high - low > .05) {
        const b = new THREE.Mesh(floorGeo(o.w, Math.ceil((high - low + .25) * 4) / 4, o.d), M.base);
        b.position.y = -(high - low + .25) / 2 + .02;
        g.add(b);
    }
    const r = rng(o.id * 31);
    // About one house in five is a ふしぎ house: a patchwork wall or a dotted dome.
    const wonder = o.id % 10 === 3 ? 'patch' : o.id % 10 === 7 ? 'dots' : null;
    let y = 0, w = o.w, d = o.d;
    for (let f = 0; f < o.floors; f++) {
        const body = new THREE.Mesh(floorGeo(w, .55, d), wonder === 'patch' && f === 0 ? W.patch[o.id % 2] : M.walls[o.tint]);
        const dx = f ? (r() - .5) * .15 : 0, dz = f ? (r() - .5) * .12 : 0;
        body.position.set(dx, y + .275, dz);
        g.add(body);
        // Windows with green shutters on the front, the door on the ground floor.
        const front = d / 2 + .01;
        if (f === 0) { const door = new THREE.Mesh(G.door, M.door); door.position.set(w * .18 + dx, y + .17, front + dz); g.add(door); }
        for (const wx of f === 0 ? [-w * .2] : [-w * .22, w * .22]) {
            const gl = new THREE.Mesh(G.glass, M.glass); gl.position.set(wx + dx, y + .32, front + dz);
            const l = new THREE.Mesh(G.shutter, M.shutter); l.position.set(wx - .1 + dx, y + .32, front + .01 + dz);
            const rr = new THREE.Mesh(G.shutter, M.shutter); rr.position.set(wx + .1 + dx, y + .32, front + .01 + dz);
            g.add(gl, l, rr);
        }
        y += .55;
        // Upper floors step back, leaving a terrace in front.
        w *= .8 + r() * .12; d *= .72 + r() * .12;
    }
    const roof = new THREE.Mesh(floorGeo(w / (.86) + .05, .07, d / .78 + .05), M.roof);
    roof.position.y = y + .02;
    g.add(roof);
    if (wonder === 'dots' || r() < .22) {
        const dome = new THREE.Mesh(G.dome, wonder === 'dots' ? (o.id % 20 === 7 ? W.pumpkin : W.dome) : M.dome);
        dome.position.y = y + .05;
        if (wonder === 'dots') dome.scale.setScalar(1.35);
        g.add(dome);
    }
    if (r() < .45) {
        // Bougainvillea spilling down a corner.
        for (let i = 0; i < 5; i++) {
            const b = new THREE.Mesh(G.bloom, M.bloom);
            b.position.set(-o.w * .45 + r() * .1, .15 + r() * y * .8, o.d * .3 + r() * .2);
            b.scale.setScalar(.8 + r() * .6);
            g.add(b);
        }
    }
    return shadowy(g);
}

// ---------- trees ----------
const T = {
    trunk: new THREE.CylinderGeometry(.04, .06, 1, 6),
    umbrella: new THREE.SphereGeometry(.5, 14, 10),
    cone: new THREE.ConeGeometry(.22, 1, 10),
    bush: new THREE.IcosahedronGeometry(.3, 1),
};
function buildTree(t: Tree): THREE.Group {
    const g = new THREE.Group();
    if (t.kind === 'pine') {
        // An umbrella pine: a bare leaning trunk and a flat crown.
        const trunk = new THREE.Mesh(T.trunk, M.trunk); trunk.scale.y = .9; trunk.position.y = .45; trunk.rotation.z = .12;
        // Now and then a ふしぎな木: a lavender crown spotted with pale dots.
        const crown = new THREE.Mesh(T.umbrella, t.id % 13 === 5 ? W.crown : M.pine); crown.scale.set(1.15, .42, 1); crown.position.set(.06, .95, 0);
        g.add(trunk, crown);
    } else if (t.kind === 'cypress') {
        const c = new THREE.Mesh(T.cone, M.cypress); c.scale.set(1, 1.4, 1); c.position.y = .72;
        g.add(c);
    } else {
        const b = new THREE.Mesh(T.bush, M.bush); b.scale.set(1, .75, 1); b.position.y = .18;
        g.add(b);
        if (t.id % 3 === 0) for (let i = 0; i < 3; i++) {
            const f = new THREE.Mesh(G.bloom, M.bloom); f.scale.setScalar(.6);
            f.position.set(Math.cos(i * 2.1) * .22, .3, Math.sin(i * 2.1) * .22); g.add(f);
        }
    }
    g.rotation.y = t.id * 1.7;
    g.userData.lift = -.03;
    return shadowy(g);
}

// ---------- special buildings ----------
const lathe = (pts: [number, number][]) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 28);
function buildSpecial(s: Special): THREE.Group {
    const g = new THREE.Group();
    const ground = heightAt(shaped, s.x, s.z);
    // Dug out from under it, the building is not lost: it stands on stilts above the water.
    const y = Math.max(ground, .45);
    g.position.set(s.x, y, s.z);
    g.userData.y0 = y;
    if (ground < y - .05) {
        const deck = new THREE.Mesh(floorGeo(1.4, .12, 1.4), M.base); deck.position.y = -.06; g.add(deck);
        for (const [a, b] of [[-.55, -.55], [.55, -.55], [-.55, .55], [.55, .55]]) {
            const leg = new THREE.Mesh(PILLAR, M.base);
            const foot = heightAt(shaped, s.x + a, s.z + b);
            leg.scale.y = y - foot; leg.position.set(a, (foot - y) / 2, b); g.add(leg);
        }
    }
    if (s.kind === 'home') {
        // The child's house grows from a dotted seed as the child learns:
        // a sprout, a round cottage, a second floor and a flag, then a tower.
        const stage = s.stage ?? 3;
        if (stage === 0) {
            const seed = new THREE.Mesh(G.dome, W.poko); seed.scale.set(1.6, 1.2, 1.6); g.add(seed);
            const stem = new THREE.Mesh(PILLAR, M.bush); stem.scale.set(.35, .3, .35); stem.position.y = .34; g.add(stem);
            for (const side of [-1, 1]) {
                const leaf = new THREE.Mesh(T.bush, M.bush); leaf.scale.set(.34, .1, .2);
                leaf.position.set(side * .11, .5, 0); leaf.rotation.z = side * .5; g.add(leaf);
            }
        } else {
            g.add(new THREE.Mesh(lathe([[0, 0], [.5, 0], [.57, .3], [.52, .62], [0, .62]]), M.walls[1]));
            const band = new THREE.Mesh(new THREE.CylinderGeometry(.555, .53, .16, 28, 1, true), W.patch[1]); band.position.y = .14; g.add(band);
            let top = .62;
            if (stage >= 2) {
                const upper = new THREE.Mesh(lathe([[0, 0], [.42, 0], [.45, .24], [.37, .48], [0, .48]]), M.walls[2]);
                upper.position.y = top; g.add(upper); top += .48;
            }
            const roof = new THREE.Mesh(G.dome, W.poko); roof.scale.set(stage >= 2 ? 2.1 : 2.7, 1.7, stage >= 2 ? 2.1 : 2.7); roof.position.y = top - .03; g.add(roof);
            const door = new THREE.Mesh(G.door, M.door); door.position.set(0, .17, .53); g.add(door);
            for (const wx of [-.3, .3]) { const gl = new THREE.Mesh(G.glass, M.glass); gl.position.set(wx, .42, .46); gl.rotation.y = wx * 1.1; g.add(gl); }
            if (stage >= 2) {
                const pole = new THREE.Mesh(PILLAR, M.trunk); pole.scale.set(.3, .55, .3); pole.position.y = top + .55; g.add(pole);
                const flag = new THREE.Mesh(new THREE.BoxGeometry(.26, .16, .015), W.patch[0]); flag.position.set(.14, top + .74, 0); g.add(flag);
            }
            if (stage >= 3) {
                const tower = new THREE.Group(); tower.position.set(.56, 0, -.28); tower.rotation.z = -.07;
                tower.add(new THREE.Mesh(lathe([[0, 0], [.22, 0], [.26, .5], [.18, 1.1], [.21, 1.5], [0, 1.5]]), M.walls[3]));
                const cap = new THREE.Mesh(G.dome, W.pumpkin); cap.scale.setScalar(1.2); cap.position.y = 1.48; tower.add(cap);
                g.add(tower);
            }
        }
    } else if (s.kind === 'lighthouse') {
        // A swelling white tower with a red band and a lantern.
        g.add(new THREE.Mesh(lathe([[0, 0], [.5, 0], [.44, .6], [.34, 1.6], [.3, 2.4], [.38, 2.5], [0, 2.5]]), M.walls[0]));
        const band = new THREE.Mesh(new THREE.CylinderGeometry(.37, .4, .3, 24), M.walls[4]); band.position.y = 1.1; g.add(band);
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .3, 16), mat(0xffe08a, { emissive: 0xffc040, emissiveIntensity: .6 })); lamp.position.y = 2.65; g.add(lamp);
        const cap = new THREE.Mesh(G.dome, M.walls[4]); cap.position.y = 2.8; g.add(cap);
    } else if (s.kind === 'tower') {
        // A tall house-tower that leans and swells like something grown.
        g.add(new THREE.Mesh(lathe([[0, 0], [.6, 0], [.66, .5], [.55, 1.2], [.6, 1.9], [.46, 2.6], [.5, 3.1], [.2, 3.5], [0, 3.6]]), M.walls[3]));
        for (const h of [.8, 1.6, 2.4]) {
            const w = new THREE.Mesh(G.glass, M.glass); w.position.set(0, h, .58 - (h > 2 ? .1 : 0)); g.add(w);
        }
    } else {
        const body = new THREE.Mesh(floorGeo(1.2, .8, .9), M.walls[0]); body.position.y = .4; g.add(body);
        const bell = new THREE.Mesh(floorGeo(.4, 1.3, .4), M.walls[0]); bell.position.set(.5, .65, -.2); g.add(bell);
        const dome = new THREE.Mesh(G.dome, M.dome); dome.scale.setScalar(1.4); dome.position.set(-.15, .8, 0); g.add(dome);
        const top = new THREE.Mesh(G.dome, M.dome); top.position.set(.5, 1.3, -.2); g.add(top);
    }
    return shadowy(g);
}

// ---------- the island thinks ----------
function harbour(): XZ {
    // Walk in from the sea on grid points, so the harbour sits on a dry node.
    for (let z = 9.5; z > 0; z -= RES) if (heightAt(base, 0, z) > .25) return [0, z];
    return [0, 0];
}

let main: P3[] = [];
let lastMoved = 0;
/** A special building levels its own plot like a house does. */
const plot = (s: Special): House => ({ id: -1, x: s.x, z: s.z, rot: 0, w: 1.3, d: 1.3, floors: 1, tint: 0, born: 0 });
function recompute() {
    const net = network(base, harbour(), specials.map(s => [s.x, s.z] as XZ));
    roads = net.roads;
    cut = cutRoads(base, roads);
    // The bus keeps to the longest stretch of plain road.
    main = roads.flatMap(r => r.parts).filter(p => p.kind === 'road').reduce<P3[]>((a, p) => (p.line.length > a.length ? p.line : a), []);
    // A house that no longer fits moves to the nearest roadside that does;
    // trees in the way simply make room and grow again elsewhere.
    const clear = (o: { x: number; z: number }) => specials.every(s => Math.hypot(s.x - o.x, s.z - o.z) > 1);
    const kept: House[] = [];
    let moved = 0;
    for (const o of houses) {
        if (houseFits(cut, roads, kept, o) && clear(o)) { kept.push(o); continue; }
        const next = moveHouse(cut, roads, kept, rand, o);
        if (next && clear(next)) { kept.push(next); moved++; }
    }
    lastMoved = moved;
    houses = kept;
    settle();
    trees = trees.filter(t => treeFits(shaped, roads, houses, trees, t) && specials.every(s => Math.hypot(s.x - t.x, s.z - t.z) > .9));
    drawRoads();
    specialsGroup.clear();
    for (const s of specials) specialsGroup.add(buildSpecial(s));
    sync(performance.now());
}

/** The island has decided its ground: ease the screen towards it. */
function settle() {
    shaped = padHouses(cut, [...houses, ...specials.filter(s => heightAt(cut, s.x, s.z) > .45).map(plot)]);
    for (let k = 0; k < N * N; k++) offset[k] = shaped[k] - base[k];
    target = shaped;
    paintGround();
}

// Houses and trees on screen, by id. A thing that moves glides to its new
// place; a new one pops up; one that is gone shrinks away.
interface View { g: THREE.Group; x: number; z: number; rot: number; from: { x: number; z: number; rot: number }; t0: number; size: number; key: string; leaving?: number }
const houseViews = new Map<number, View>(), treeViews = new Map<number, View>();
const GLIDE = 450, POP = 650;
function syncOne<T extends { id: number; x: number; z: number }>(list: T[], views: Map<number, View>, group: THREE.Group, build: (o: T) => THREE.Group, look: (o: T) => { rot: number; size: number; key: string }, now: number) {
    const alive = new Set<number>();
    for (const o of list) {
        alive.add(o.id);
        const { rot, size, key } = look(o);
        const v = views.get(o.id);
        if (!v || v.leaving !== undefined) {
            if (v) group.remove(v.g);
            const g = build(o); g.position.set(o.x, heightAt(shown, o.x, o.z), o.z); g.rotation.y = rot; g.scale.setScalar(.01);
            group.add(g);
            views.set(o.id, { g, x: o.x, z: o.z, rot, from: { x: o.x, z: o.z, rot }, t0: now, size, key });
            continue;
        }
        if (v.key !== key) {
            // Same house, new footing: rebuild its body in place.
            const g = build(o); g.position.copy(v.g.position); g.rotation.y = v.g.rotation.y; g.scale.copy(v.g.scale);
            group.remove(v.g); group.add(g); v.g = g; v.key = key;
        }
        if (v.x !== o.x || v.z !== o.z || v.rot !== rot) {
            v.from = { x: v.g.position.x, z: v.g.position.z, rot: v.g.rotation.y };
            v.x = o.x; v.z = o.z; v.rot = rot; v.t0 = now - POP;
        }
    }
    for (const [id, v] of views) if (!alive.has(id) && v.leaving === undefined) v.leaving = now;
}
const houseKey = (o: House) => `${o.w.toFixed(3)},${o.d.toFixed(3)},${o.floors},${o.tint},${footingKey(o)}`;
const footingKey = (o: House) => { const { low, high } = footing(o); return Math.round((high - low) * 8); };
function sync(now: number) {
    syncOne(houses, houseViews, housesGroup, buildHouse, o => ({ rot: o.rot, size: 1, key: houseKey(o) }), now);
    syncOne(trees, treeViews, treesGroup, buildTree, t => ({ rot: t.id * 1.7, size: t.size, key: t.kind }), now);
    updateStat();
}
const smooth = (t: number) => t * t * (3 - 2 * t);
function moveViews(views: Map<number, View>, group: THREE.Group, now: number) {
    for (const [id, v] of views) {
        const g = v.g;
        if (v.leaving !== undefined) {
            const t = Math.min(1, (now - v.leaving) / 300);
            g.scale.setScalar(v.size * (1 - smooth(t)) + .001);
            if (t >= 1) { group.remove(g); views.delete(id); }
            continue;
        }
        const age = now - v.t0;
        if (age < POP) {
            // Pop up with a small overshoot, like something that just grew.
            const t = age / POP;
            g.scale.setScalar(v.size * (smooth(t) + Math.sin(t * Math.PI) * .14));
        } else g.scale.setScalar(v.size);
        const glide = Math.min(1, Math.max(0, (age - POP) / GLIDE));
        const e = smooth(glide);
        const x = v.from.x + (v.x - v.from.x) * e, z = v.from.z + (v.z - v.from.z) * e;
        g.position.set(x, heightAt(shown, x, z) + (g.userData.lift as number) + Math.sin(glide * Math.PI) * .25, z);
        g.rotation.y = v.from.rot + (v.rot - v.from.rot) * e;
    }
}

let ticks = 0;
function grow(now: number) {
    // In the app the child's house grows with learning time; here, every few ticks.
    const young = specials.find(s => s.kind === 'home' && (s.stage ?? 3) < 3);
    if (young && ++ticks % 5 === 0) {
        young.stage = (young.stage ?? 0) + 1;
        if (now > 0) chime(520 + young.stage * 130, .04, .35);
        specialsGroup.clear();
        for (const s of specials) specialsGroup.add(buildSpecial(s));
    }
    const length = roads.reduce((s, r) => s + r.line.length * .25, 0);
    if (houses.length < Math.min(60, length * .9)) {
        const o = houseSpot(cut, roads, houses, rand, nextId++, now);
        if (o && specials.every(s => Math.hypot(s.x - o.x, s.z - o.z) > 1)) {
            houses.push(o);
            if (now > 0) chime(780 + rand() * 240, .025, .22);
            // The new house levels its plot; trees in the way make room.
            settle();
            trees = trees.filter(t => treeFits(shaped, roads, houses, trees, t));
        }
    }
    for (let i = 0; i < 2 && trees.length < 120; i++) {
        const t = treeSpot(shaped, roads, houses, trees, rand, nextId++, now);
        if (t && specials.every(s => Math.hypot(s.x - t.x, s.z - t.z) > .9)) trees.push(t);
    }
    sync(now);
}

function updateStat() {
    const kinds = new Set(roads.flatMap(r => r.parts.map(p => p.kind)));
    const extra = [kinds.has('stair') && 'かいだん', kinds.has('bridge') && 'はし', kinds.has('lift') && 'ケーブルカー'].filter(Boolean).join('・');
    stat.textContent = `みち ${roads.length}${extra ? `（${extra}）` : ''} · いえ ${houses.length} · き ${trees.length} · すむ ${townsfolk()}${placing ? ` · ${placing === 'home' ? 'たね' : '★'}を おく ばしょを タップ` : ''}`;
}

// ---------- bus and residents ----------
const bus = new THREE.Group();
{
    const body = new THREE.Mesh(new RoundedBoxGeometry(.32, .26, .62, 3, .06), M.bus); body.position.y = .2;
    const top = new THREE.Mesh(new RoundedBoxGeometry(.3, .06, .58, 2, .03), M.busTop); top.position.y = .35;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(.33, .09, .5), M.glass); glass.position.y = .25;
    bus.add(body, top, glass);
    for (const [x, z] of [[-.15, -.2], [.15, -.2], [-.15, .2], [.15, .2]]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .05, 12).rotateZ(Math.PI / 2), M.wheel);
        wheel.position.set(x, .07, z); bus.add(wheel);
    }
    shadowy(bus);
    scene.add(bus);
}
let busAt = 0, busDir = 1, busWait = 0;
function along(line: [number, number, number][], s: number, side: number): [THREE.Vector3, number] {
    const i = Math.max(0, Math.min(line.length - 2, Math.floor(s)));
    const t = s - i;
    const a = line[i], b = line[i + 1];
    const nx = -(b[2] - a[2]), nz = b[0] - a[0], len = Math.hypot(nx, nz) || 1;
    const p = new THREE.Vector3(a[0] + (b[0] - a[0]) * t + nx / len * side, a[1] + (b[1] - a[1]) * t + .05, a[2] + (b[2] - a[2]) * t + nz / len * side);
    return [p, Math.atan2(b[0] - a[0], b[2] - a[2])];
}

// The app's own pokomoko residents, at the island's scale. More come to live
// as the town grows: about one for every three houses.
const poko = new IslandMaterials();
const FOLK_SCALE = .34;
const SPECIES: ResidentSpecies[] = ['otter', 'rabbit', 'fox'];
const townsfolk = () => Math.min(18, 3 + Math.floor(houses.length / 3));
const folk = Array.from({ length: 18 }, (_, i) => {
    const g = new THREE.Group();
    const rig = makeResidentRig(SPECIES[i % 3], poko);
    g.add(rig.pose);
    g.scale.setScalar(FOLK_SCALE);
    scene.add(g);
    return { g, rig, feet: rig.feet.map(f => f.position.z), road: i, s: i * 7, dir: i % 2 ? 1 : -1, side: i % 2 ? .2 : -.2, speed: 1.1 + (i % 3) * .35 };
});
// The child's partner waits by the door of the first house.
const partner = (() => {
    const g = new THREE.Group();
    const rig = makeResidentRig('otter', poko);
    g.add(rig.pose);
    g.scale.setScalar(FOLK_SCALE * 1.1);
    scene.add(g);
    return { g, rig };
})();

function landNear(x: number, z: number): XZ {
    if (heightAt(base, x, z) > .3) return [x, z];
    for (let r = .25; r < 14; r += .25) for (let a = 0; a < 24; a++) {
        const px = x + Math.cos(a / 24 * Math.PI * 2) * r, pz = z + Math.sin(a / 24 * Math.PI * 2) * r;
        if (Math.abs(px) < SIZE / 2 && Math.abs(pz) < SIZE / 2 && heightAt(base, px, pz) > .6) return [px, pz];
    }
    return [0, 0];
}
function place(kind: SpecialKind, x: number, z: number) {
    specials.push(kind === 'home' ? { x, z, kind, stage: 0 } : { x, z, kind });
    placing = null;
    recompute();
}

// ---------- feel ----------
// A soft ring shows where the finger shapes; every stroke answers with a small
// sound, higher as the hill grows, lower as it is carved.
let audio: AudioContext | undefined;
function chime(freq: number, volume = .035, length = .09) {
    if (!audio) return;
    const t = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.12, t + length);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, t + length);
    osc.connect(gain).connect(audio.destination);
    osc.start(t); osc.stop(t + length + .02);
}
const RING = 64, RING_R = 1.6;
const ringGeo = new THREE.BufferGeometry();
ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((RING + 1) * 2 * 3), 3));
ringGeo.setIndex(Array.from({ length: RING }, (_, i) => [i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2]).flat());
const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.renderOrder = 2;
scene.add(ring);
const cursor = { x: 0, z: 0, pulse: 0, shown: 0 };
function drawRing(dt: number) {
    cursor.shown += ((painting ? 1 : 0) - cursor.shown) * (1 - Math.exp(-dt / .08));
    cursor.pulse *= Math.exp(-dt / .12);
    ringMat.opacity = cursor.shown * .85;
    ring.visible = cursor.shown > .01;
    if (!ring.visible) return;
    ringMat.color.set(tool === 'stack' ? 0xffffff : 0xffe2b8);
    const r = RING_R * (1 + cursor.pulse * .12), pos = ringGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i <= RING; i++) {
        const a = i / RING * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
        for (const [j, rr] of [[0, r - .07], [1, r + .07]] as const) {
            const x = cursor.x + c * rr, z = cursor.z + sn * rr;
            pos.setXYZ(i * 2 + j, x, Math.max(heightAt(shown, x, z), .02) + .06, z);
        }
    }
    pos.needsUpdate = true;
    ringGeo.computeBoundingSphere();
}

// ---------- input ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let painting = false, lastPaint = 0, lastSound = 0, rethink = 0;
const perf = { rethink: [] as number[], stroke: [] as number[] };
function hit(e: PointerEvent) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(ground)[0]?.point;
}
function remember() {
    // One undo puts back the ground and everything the island moved because of it.
    history.push({ base: base.slice(), specials: specials.map(s => ({ ...s })), houses: houses.slice(), trees: trees.slice() });
    if (history.length > 40) history.shift();
}
const live = new Float32Array(N * N);
/**
 * A stroke shows at once: only the ground changes under the finger, and what
 * stands on it rides along. Roads, houses and trees are rethought when the
 * finger lifts or rests, so a stroke never waits for the island to think.
 */
function paint(p: THREE.Vector3, amount: number) {
    const t0 = performance.now();
    cursor.x = p.x; cursor.z = p.z;
    if (!brush(base, p.x, p.z, tool === 'stack' ? amount : -amount)) return;
    for (let k = 0; k < N * N; k++) live[k] = base[k] + offset[k];
    target = live;
    paintGround();
    cursor.pulse = 1;
    if (t0 - lastSound > 110) {
        const y = heightAt(base, p.x, p.z);
        chime(tool === 'stack' ? 330 + y * 45 : 300 - Math.min(5, Math.max(-2, y)) * 25);
        lastSound = t0;
    }
    clearTimeout(rethink);
    rethink = window.setTimeout(think, 380);
    perf.stroke.push(performance.now() - t0);
}
function think() {
    clearTimeout(rethink);
    const t0 = performance.now();
    recompute();
    perf.rethink.push(performance.now() - t0);
}
renderer.domElement.addEventListener('pointerdown', e => {
    if (!e.isPrimary) return;
    const p = hit(e);
    if (!p) { controls.enabled = true; return; }
    controls.enabled = false;
    audio ??= new AudioContext();
    void audio.resume();
    navigator.vibrate?.(6);
    remember();
    if (placing) {
        // Tapped on the water: the building goes to the nearest shore instead.
        const [x, z] = landNear(p.x, p.z);
        place(placing, x, z);
        return;
    }
    painting = true;
    cursor.shown = 1;
    paint(p, .5);
    lastPaint = performance.now();
    renderer.domElement.setPointerCapture(e.pointerId);
}, { capture: true });
renderer.domElement.addEventListener('pointermove', e => {
    const now = performance.now();
    if (!painting || now - lastPaint < 16) return;
    const p = hit(e);
    // Every move counts, in proportion to the time since the last one, so a
    // slow stroke and a quick one pile up the same earth per second.
    if (p) { paint(p, .22 * Math.min(1, (now - lastPaint) / 90)); lastPaint = now; }
});
const end = () => {
    if (painting) {
        // Let the frame with the finger lifted draw first, then rethink.
        clearTimeout(rethink);
        requestAnimationFrame(() => { rethink = window.setTimeout(think, 0); });
    }
    painting = false;
    controls.enabled = true;
};
renderer.domElement.addEventListener('pointerup', end);
renderer.domElement.addEventListener('pointercancel', end);

root.querySelector('#tool')!.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-tool]');
    if (!b) return;
    tool = b.dataset.tool as Tool;
    for (const x of root.querySelectorAll<HTMLButtonElement>('[data-tool]')) x.setAttribute('aria-pressed', String(x === b));
});
root.querySelector('#undo')!.addEventListener('click', () => {
    const prev = history.pop();
    if (!prev) return;
    base = prev.base; specials = prev.specials; houses = prev.houses; trees = prev.trees;
    recompute();
});
// In the app this would be earned by learning; here a button hands one over.
root.querySelector('#special')!.addEventListener('click', () => {
    placing = KINDS[given++ % KINDS.length];
    updateStat();
});
root.querySelector('#seed')!.addEventListener('click', () => {
    placing = 'home';
    updateStat();
});
root.querySelector('#time')!.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-time]');
    if (b) { time = b.dataset.time as Time; light(); }
});
root.querySelector<HTMLButtonElement>('[data-tool="stack"]')!.setAttribute('aria-pressed', 'true');

function light() {
    const dusk = time === 'dusk';
    const sky = dusk ? 0xf4b49a : 0xa8dcf4;
    scene.background = new THREE.Color(sky);
    scene.fog = new THREE.Fog(sky, 40, 110);
    sun.color.set(dusk ? 0xffc2a0 : 0xffffff);
    sun.intensity = dusk ? 2.2 : 2.5;
    sun.position.set(dusk ? -16 : -9, dusk ? 7 : 18, dusk ? 10 : 12);
    hemi.color.set(dusk ? 0xe8dcff : 0xffffff);
    hemi.intensity = dusk ? 1.15 : 1.2;
    M.sea.color.set(dusk ? 0x6f8cc6 : 0x2f8fc4);
    for (const b of root.querySelectorAll<HTMLButtonElement>('[data-time]')) b.setAttribute('aria-pressed', String(b.dataset.time === time));
}

// ---------- loop ----------
function resize() {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const away = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(controls.target).addScaledVector(away, 22 * Math.max(1, 1.25 / camera.aspect * .8));
}
addEventListener('resize', resize);
resize();
light();
recompute();
// Start from an island that has already grown for a while, already settled.
for (let i = 0; i < 60; i++) grow(-1e6);
easeGround(10);
rideRoads();

let last = performance.now(), lastGrow = 0, frames = 0, frameSum = 0;
renderer.setAnimationLoop(now => {
    const frame = now - last;
    const dt = Math.min(.05, frame / 1000);
    last = now;
    // Raise the resolution while frames stay quick; drop it back if they do not.
    frames++; frameSum += frame;
    if (frames === 90) {
        const avg = frameSum / frames, most = Math.min(devicePixelRatio, 1.5);
        const next = avg < 18 && pixelRatio < most ? Math.min(most, pixelRatio + .25) : avg > 30 && pixelRatio > 1 ? Math.max(1, pixelRatio - .25) : pixelRatio;
        if (next !== pixelRatio) { pixelRatio = next; renderer.setPixelRatio(next); renderer.setSize(viewport.clientWidth, viewport.clientHeight, false); }
        frames = 0; frameSum = 0;
    }
    // While a finger strokes, the island waits; it grows again once the hand is off.
    if (!painting && now - lastGrow > 900) { grow(now); lastGrow = now; }
    if (easeGround(dt)) rideRoads();
    moveViews(houseViews, housesGroup, now);
    moveViews(treeViews, treesGroup, now);
    for (const g of specialsGroup.children) g.position.y = (g.userData.y0 as number) + rise(g.position.x, g.position.z);
    drawRing(dt);
    // The bus runs up and down the main road and waits at each end.
    if (main.length > 2) {
        if (busWait > 0) busWait -= dt;
        else {
            busAt += busDir * dt * 6;
            if (busAt <= 0 || busAt >= main.length - 1.01) { busAt = Math.max(0, Math.min(main.length - 1.01, busAt)); busDir *= -1; busWait = 1.6; }
        }
        const [p, heading] = along(main, busAt, busDir > 0 ? -.11 : .11);
        p.y += rise(p.x, p.z);
        bus.position.copy(p);
        bus.rotation.y = heading + (busDir > 0 ? 0 : Math.PI);
        bus.visible = true;
    } else bus.visible = false;
    for (const l of lifts) {
        l.s += l.dir * dt * 3;
        if (l.s <= 0 || l.s >= l.line.length - 1.01) { l.dir *= -1; l.s = Math.max(0, Math.min(l.line.length - 1.01, l.s)); }
        const [p, heading] = along(l.line, l.s, 0);
        p.y += rise(p.x, p.z);
        l.car.position.copy(p);
        l.car.rotation.y = heading;
    }
    const living = townsfolk();
    folk.forEach((f, i) => {
        const road = roads[f.road % Math.max(1, roads.length)];
        if (i >= living || !road || road.line.length < 3) { f.g.visible = false; return; }
        f.g.visible = true;
        f.s += f.dir * dt * f.speed;
        if (f.s <= 0 || f.s >= road.line.length - 1.01) { f.dir *= -1; f.s = Math.max(0, Math.min(road.line.length - 1.01, f.s)); }
        const [p, heading] = along(road.line, f.s, f.side);
        p.y += rise(p.x, p.z) - .05;
        f.g.position.copy(p);
        // A waddle: feet take turns, the body rocks a little.
        const step = now / 150 * f.speed;
        f.rig.feet.forEach((foot, k) => { foot.position.z = f.feet[k] + Math.sin(step + k * Math.PI) * .12; });
        f.rig.body.rotation.z = Math.sin(step) * .06;
        f.g.position.y += Math.abs(Math.sin(step)) * .015;
        f.g.rotation.y = heading + (f.dir > 0 ? 0 : Math.PI);
    });
    const home = specials.find(s => s.kind === 'home');
    partner.g.visible = !!home;
    if (home) {
        const x = home.x + .55, z = home.z + .75;
        partner.g.position.set(x, heightAt(shown, x, z), z);
        partner.g.rotation.y = .5 + Math.sin(now / 1400) * .5;
        partner.rig.head.rotation.z = Math.sin(now / 700) * .12;
    }
    controls.update();
    renderer.render(scene, camera);
});

// For checks from the outside: the same strokes and taps a finger makes.
Object.assign(window, {
    growLab: {
        get roads() { return roads; }, get houses() { return houses; }, get trees() { return trees; }, get specials() { return specials; },
        get moved() { return lastMoved; },
        get pixelRatio() { return pixelRatio; },
        perf,
        stroke(x: number, z: number, amount: number, times = 1, carve = false) {
            remember();
            const t0 = performance.now();
            for (let i = 0; i < times; i++) brush(base, x, z, carve ? -amount : amount);
            recompute();
            return performance.now() - t0;
        },
        place(kind: SpecialKind, x: number, z: number) { remember(); const [px, pz] = landNear(x, z); place(kind, px, pz); },
        undo() { root.querySelector<HTMLButtonElement>('#undo')!.click(); },
        grow(n: number) { for (let i = 0; i < n; i++) grow(-1e6); },
        heightAt: (x: number, z: number) => heightAt(base, x, z),
        groundAt: (x: number, z: number) => heightAt(shaped, x, z),
        /** Look at a point from the sea side of it, from above. */
        view(x: number, z: number, distance: number) {
            const out = new THREE.Vector3(x, 0, z).normalize();
            const away = new THREE.Vector3(out.x * .7, .75, out.z * .7).normalize();
            controls.target.set(x, heightAt(shaped, x, z), z);
            camera.position.copy(controls.target).addScaledVector(away, distance);
        },
    },
});
