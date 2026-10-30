import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { houseFits, houseSpot, moveHouse, padHouses, rng, treeFits, treeSpot, type House, type Tree } from './growth';
import { ROAD_HALF, cutRoads, network, type P3, type Road, type XZ } from './roads';
import { N, RES, SIZE, brush, heightAt, sampleIsland, settleSlopes, slopeAt, smallIsland, type Heights } from './terrain';
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
interface Special { x: number; z: number; kind: SpecialKind; stage?: number; theme?: number }

const root = document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML = `<div id="viewport"></div>
<div class="top"><span>試作 · そだつ島</span><div class="right"><button id="learn" class="pill" hidden>📖 まなぶ</button><button id="sound" class="round" aria-label="おと">🔈</button><div class="seg" id="time"><button data-time="day">ひる</button><button data-time="dusk">ゆうがた</button></div></div></div>
<p class="stat" id="stat" aria-live="polite"></p>
<div class="swatches" id="swatches" hidden></div>
<div class="tools"><button id="undo" aria-label="もどす">↶</button><div class="seg big" id="tool"><button data-tool="stack">つむ</button><button data-tool="carve">けずる</button></div><button id="seed" aria-label="おうちの たね">🌱</button><button id="special" aria-label="とくべつな たてもの">★</button></div>`;
const viewport = root.querySelector<HTMLDivElement>('#viewport')!;
const stat = root.querySelector<HTMLParagraphElement>('#stat')!;
const params = new URLSearchParams(location.search);
let time: Time = params.get('time') === 'dusk' ? 'dusk' : 'day';
let tool: Tool = 'stack';
let placing: SpecialKind | null = null;
/** The colour the next house seed will be. */
let seedTheme = 0;
const KINDS: SpecialKind[] = ['lighthouse', 'tower', 'chapel'];
let given = 0;

// ?start=blank begins as a child would: a small low island with nothing on it.
const blank = params.get('start') === 'blank';
// ?pace=learn (the default for a blank start): the island grows only when the
// child finishes a learning session, as it would in the app, not by the clock.
const byLearning = params.get('pace') === 'learn' || (blank && params.get('pace') !== 'time');
/** Growth steps one learning session gives the island. */
const PER_SESSION = 6;
let sessions = 0;
let base: Heights = blank ? smallIsland() : sampleIsland();
// Otherwise the island starts from the child's own house on the hill; the roads come to it.
let specials: Special[] = blank ? [] : [{ x: -1, z: -1.5, kind: 'home', stage: 3 }];
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
    // Two-sided, so a tight bend that folds the paving still shows paving.
    road: mat(0xe2d6bb, { polygonOffset: true, polygonOffsetFactor: -3, side: THREE.DoubleSide }),
    roadEdge: mat(0x9c8c70, { polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide }),
    stone: mat(0xd9cdb6, { polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide }),
    rail: mat(0x5a4f48),
    wood: mat(0xb08a62),
    car: mat(0xd2493a),
    curb: mat(0xf4f0e8, { side: THREE.DoubleSide }),
    base: mat(0xefe8da),
    walls: [0xf6f1e7, 0xf2e3c2, 0xefc4b4, 0xf3d684, 0xdf9478].map(c => mat(c)),
    roof: mat(0xe9e2d4),
    shutter: mat(0x4e8a5c),
    door: mat(0x3f6a4a),
    glass: mat(0x2c3a44),
    dome: mat(0x3a74c9),
    pine: mat(0x456f34), cypress: mat(0x355f30), bush: mat(0x6a9e47), trunk: mat(0x7a5a44), olive: mat(0x8fa67a), palm: mat(0x5f9a3e),
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

// ---------- the child's colours ----------
// When planting a house seed the child picks one of these. The house is
// painted in it, and the town that grows nearest that house takes after it,
// so two children's islands look different even with the same hills.
interface Theme { name: string; swatch: string; walls: THREE.Material[]; dome: THREE.Material; dotDome: THREE.Material; roof: THREE.Material; body: THREE.Material[]; tower: THREE.Material; wonder: (id: number) => 'patch' | 'dots' | null }
const usual = (id: number) => (id % 10 === 3 ? 'patch' : id % 10 === 7 ? 'dots' : null);
const THEMES: Theme[] = [
    { name: 'しろ', swatch: '#3a74c9', walls: M.walls, dome: M.dome, dotDome: W.dome, roof: W.poko, body: [M.walls[1], M.walls[2]], tower: M.walls[3], wonder: usual },
    {
        name: 'ゆうやけ', swatch: '#e0663f',
        walls: [0xf3c9a0, 0xe8a07a, 0xd9785f, 0xf2d58c, 0xc96b5a].map(c => mat(c)),
        dome: mat(0xe0663f), dotDome: mat(0xffffff, { map: dotted('#e0663f', ['#fff1d6'], 55, .035, 21) }),
        roof: mat(0xffffff, { map: dotted('#7a2f3b', ['#f2c230', '#ffd9b0', '#e8578f'], 60, .05, 22) }),
        body: [mat(0xf3c9a0), mat(0xe8a07a)], tower: mat(0xf2d58c), wonder: usual,
    },
    {
        name: 'みずたま', swatch: '#f2c230',
        walls: [0xfde2ef, 0xd9f0e3, 0xdfe7fb, 0xfff1b0, 0xf6d9c9].map(c => mat(c)),
        dome: W.pumpkin, dotDome: W.pumpkin,
        roof: mat(0xffffff, { map: dotted('#e8578f', ['#ffffff', '#fff1b0'], 70, .045, 23) }),
        body: [mat(0xfde2ef), mat(0xdfe7fb)], tower: mat(0xfff1b0),
        // The dotted town: about half the houses carry dots or patchwork.
        wonder: id => (id % 4 === 1 ? 'dots' : id % 6 === 3 ? 'patch' : null),
    },
    {
        name: 'もり', swatch: '#3f7a5a',
        walls: [0xe9e4cf, 0xbfd8b8, 0x9cc5a1, 0xd8c3a0, 0x7fae9b].map(c => mat(c)),
        dome: mat(0x3f7a5a), dotDome: mat(0xffffff, { map: dotted('#3f7a5a', ['#d8f0c0'], 55, .035, 24) }),
        roof: mat(0xffffff, { map: dotted('#2f5a3f', ['#cfe8a9', '#f3d684', '#a8d5c7'], 60, .05, 25) }),
        body: [mat(0xe9e4cf), mat(0xbfd8b8)], tower: mat(0xd8c3a0), wonder: usual,
    },
];

// ---------- paving ----------
// A road shows how much it is used: a worn path in the grass, then gravel,
// then stones, and at its busiest patterned tiles with lamps and flowers.
// Each colour the child chose paves in its own way.
const tiled = (t: THREE.Texture) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const pave = (draw: (c: CanvasRenderingContext2D, s: number, r: () => number) => void, seed: number) =>
    mat(0xffffff, { map: tiled(canvasTexture((c, s) => draw(c, s, rng(seed)))), polygonOffset: true, polygonOffsetFactor: -3, side: THREE.DoubleSide });
const round = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); };
/** Loose gravel: a sandy ground speckled with pebbles. */
const gravel = (ground: string, pebbles: string[], seed: number) => pave((c, s, r) => {
    c.fillStyle = ground; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 700; i++) { c.fillStyle = pebbles[i % pebbles.length]; c.beginPath(); c.arc(r() * s, r() * s, 1.5 + r() * 3, 0, Math.PI * 2); c.fill(); }
}, seed);
/** Stones laid in rows, every other row shifted half a stone, like a cobbled lane. */
const setts = (stones: string[], grout: string, rows: number, cols: number, seed: number, corner = .3) => pave((c, s, r) => {
    c.fillStyle = grout; c.fillRect(0, 0, s, s);
    const w = s / cols, h = s / rows, gap = s * .012;
    for (let j = 0; j < rows; j++) for (let i = -1; i <= cols; i++) {
        c.fillStyle = stones[Math.floor(r() * stones.length)];
        round(c, i * w + (j % 2) * w / 2 + gap, j * h + gap, w - gap * 2, h - gap * 2, Math.min(w, h) * corner);
    }
}, seed);
/** Little squares of many colours, as on a mosaic floor, with white dots here and there. */
const mosaic = (colors: string[], grout: string, n: number, seed: number, dots = false) => pave((c, s, r) => {
    c.fillStyle = grout; c.fillRect(0, 0, s, s);
    const w = s / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { c.fillStyle = colors[Math.floor(r() * colors.length)]; c.fillRect(i * w + 1.5, j * w + 1.5, w - 3, w - 3); }
    if (dots) for (let i = 0; i < 9; i++) { c.fillStyle = '#ffffff'; c.beginPath(); c.arc(r() * s, r() * s, s * .05, 0, Math.PI * 2); c.fill(); }
}, seed);
/** Boards laid across the path, with gaps and nail heads. */
const boards = (woods: string[], gap: string, seed: number) => pave((c, s, r) => {
    c.fillStyle = gap; c.fillRect(0, 0, s, s);
    const h = s / 6;
    for (let j = 0; j < 6; j++) {
        c.fillStyle = woods[Math.floor(r() * woods.length)]; c.fillRect(0, j * h + 2, s, h - 4);
        c.fillStyle = '#00000033'; for (const x of [s * .12, s * .88]) { c.beginPath(); c.arc(x, j * h + h / 2, 2.5, 0, Math.PI * 2); c.fill(); }
    }
}, seed);
/** Square tiles in two colours, each with a ring or a dot in the middle. */
const tiles = (a: string, b: string, mark: string, ring: boolean, seed: number) => pave(c => {
    const s = c.canvas.width, w = s / 2;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        c.fillStyle = (i + j) % 2 ? a : b; c.fillRect(i * w, j * w, w, w);
        c.fillStyle = mark; c.strokeStyle = mark; c.lineWidth = w * .09;
        c.beginPath(); c.arc(i * w + w / 2, j * w + w / 2, w * (ring ? .3 : .2), 0, Math.PI * 2);
        if (ring) c.stroke(); else c.fill();
        c.fillStyle = '#ffffff99'; c.fillRect(i * w, j * w, w, 2); c.fillRect(i * w, j * w, 2, w);
    }
}, seed);
/** `plaza` is the ふしぎ floor of the little square in front of the child's house. */
interface Paving { path: THREE.Material; stages: THREE.Material[]; edge: THREE.Material; step: THREE.Material; plaza: THREE.Material; lamp: THREE.Material }
const PAVING: Paving[] = [
    {
        // しろ: pale limestone setts, then white and blue tiles.
        path: mat(0xc8b48c, { polygonOffset: true, polygonOffsetFactor: -3, side: THREE.DoubleSide }),
        stages: [
            gravel('#d8cdb2', ['#b9ab8c', '#efe7d4', '#a39575'], 31),
            setts(['#ece5d3', '#e0d6bf', '#f4efe2', '#d6cbb2'], '#b7aa8f', 6, 4, 32),
            tiles('#f6f2e8', '#dfe8f4', '#3a74c9', true, 33),
        ],
        edge: mat(0x9c8c70, { polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide }),
        step: mat(0xe6dcc6), plaza: W.patch[0], lamp: mat(0x3a74c9),
    },
    {
        // ゆうやけ: terracotta bricks, then orange and yellow tiles.
        path: mat(0xc39a6e, { polygonOffset: true, polygonOffsetFactor: -3, side: THREE.DoubleSide }),
        stages: [
            gravel('#d9b48a', ['#b98a5e', '#ecd0a8', '#a0704a'], 41),
            setts(['#c8643c', '#d4774c', '#b85a36', '#dc8a5c'], '#e8cfae', 8, 3, 42, .08),
            tiles('#f2c06a', '#e0663f', '#fff1d6', false, 43),
        ],
        edge: mat(0x8f4a32, { polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide }),
        step: mat(0xd4774c), plaza: W.patch[1], lamp: mat(0xe0663f),
    },
    {
        // みずたま: pastel mosaic, then big dotted tiles.
        path: mat(0xd8c4a8, { polygonOffset: true, polygonOffsetFactor: -3, side: THREE.DoubleSide }),
        stages: [
            gravel('#efe2d6', ['#f4c6d9', '#c9ecdc', '#d7dcf7', '#fff1b0'], 51),
            mosaic(['#fbd3e4', '#cdeedd', '#dbe3fb', '#fff1b0', '#f6d9c9'], '#ffffff', 8, 52),
            mosaic(['#f49ac1', '#8fd6b6', '#a9b8f2', '#f7d65c'], '#ffffff', 4, 53, true),
        ],
        edge: mat(0xe8578f, { polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide }),
        step: mat(0xfbd3e4), plaza: W.pumpkin, lamp: mat(0xf2c230),
    },
    {
        // もり: a needle-strewn path, then boards across, then green and cream tiles.
        path: mat(0xa98f68, { polygonOffset: true, polygonOffsetFactor: -3, side: THREE.DoubleSide }),
        stages: [
            gravel('#b7a27c', ['#8a7553', '#cdbb94', '#6f8a52'], 61),
            boards(['#b08a5e', '#a07c52', '#bf9868'], '#6e5638', 62),
            tiles('#e9e4cf', '#9cc5a1', '#3f7a5a', true, 63),
        ],
        edge: mat(0x5a4630, { polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide }),
        step: mat(0xa07c52), plaza: W.patch[1], lamp: mat(0x3f7a5a),
    },
];
/** How busy the roads look until residents' footsteps decide it (?road=0..3 to compare). */
let roadStage = Math.max(0, Math.min(3, Number(params.get('road') ?? 2)));

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

/** Every plain-coloured piece shares this one material, its colour baked into the vertices. */
const PAINTED = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .85 });
/**
 * One house or tree is drawn in one go: its plain pieces are merged into a
 * single mesh coloured per vertex, and patterned pieces into one per pattern.
 * The shared shapes the pieces were cut from are kept for the next one.
 */
function merge(group: THREE.Group): THREE.Group {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert();
    const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const pieces: THREE.Mesh[] = [];
    group.traverse(o => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || Array.isArray(m.material)) return;
        const material = m.material as THREE.MeshStandardMaterial;
        let geo = m.geometry.clone().applyMatrix4(inverse.clone().multiply(m.matrixWorld));
        if (geo.index) { const flat = geo.toNonIndexed(); geo.dispose(); geo = flat; }
        for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name);
        let target: THREE.Material = material;
        if (material.map) {
            if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
        } else if (!material.emissive || material.emissive.getHex() === 0) {
            geo.deleteAttribute('uv');
            const c = material.color, colors = new Float32Array(geo.attributes.position.count * 3);
            for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
            geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            target = PAINTED;
        } else geo.deleteAttribute('uv');
        const list = buckets.get(target) ?? [];
        list.push(geo);
        buckets.set(target, list);
        pieces.push(m);
    });
    for (const m of pieces) m.removeFromParent();
    for (const o of [...group.children]) if (!o.children.length && !(o as THREE.Mesh).isMesh) o.removeFromParent();
    for (const [material, list] of buckets) {
        const merged = mergeGeometries(list);
        list.forEach(g => g.dispose());
        if (merged) { merged.userData.own = true; group.add(new THREE.Mesh(merged, material)); }
    }
    return group;
}
/** Frees the shapes made for one thing alone; shared shapes stay for the next. */
function release(o: THREE.Object3D) {
    o.traverse(c => {
        const geo = (c as THREE.Mesh).geometry;
        if (geo && (geo.userData.own || geo.userData.ribbon)) geo.dispose();
    });
}
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
    showGround();
    return true;
}
/** Puts the shown heights into the ground mesh, which taps are aimed at. */
function showGround() {
    const pos = groundGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < N * N; i++) pos.setY(i, shown[i]);
    pos.needsUpdate = true;
    groundGeo.computeVertexNormals();
    groundGeo.computeBoundingSphere();
}

// ---------- roads ----------
function ribbon(line: P3[], width: number, lift: number, wall = 0): THREE.BufferGeometry {
    const pos: number[] = [];
    const idx: number[] = [];
    // Across the road u runs 0 to 1; along it v counts road widths, so a
    // paving pattern keeps square stones however long the road is.
    const uv: number[] = [];
    let along = 0;
    line.forEach((p, i) => {
        if (i) along += Math.hypot(p[0] - line[i - 1][0], p[2] - line[i - 1][2]) / width;
        uv.push(0, along, 1, along);
        // The edge direction is taken over a few points, so a tight bend
        // does not fold the ribbon over itself.
        const a = line[Math.max(0, i - 2)], b = line[Math.min(line.length - 1, i + 2)];
        const len = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
        const nx = -(b[2] - a[2]) / len, nz = (b[0] - a[0]) / len;
        if (wall) {
            // A low wall along one edge: bottom and top of the wall.
            const s = Math.sign(wall) * width / 2;
            pos.push(p[0] + nx * s, p[1] + lift, p[2] + nz * s, p[0] + nx * s, p[1] + lift + Math.abs(wall), p[2] + nz * s);
        } else {
            pos.push(p[0] + nx * width / 2, p[1] + lift, p[2] + nz * width / 2, p[0] - nx * width / 2, p[1] + lift, p[2] - nz * width / 2);
        }
        // Wound to face up, so the paving is seen from above.
        if (i) { const q = i * 2; idx.push(q - 2, q, q - 1, q - 1, q, q + 1); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.userData.ribbon = true;
    return g;
}

/**
 * A low white wall only where the ground falls away beside the road, the way
 * cliff roads are walled on their open side; on the hillside there is none.
 */
const parapets = (line: P3[], width: number, lift: number, height: number) => {
    for (const side of [1, -1]) {
        let run: P3[] = [];
        const flush = () => {
            if (run.length > 2) {
                const w = new THREE.Mesh(ribbon(run, width, lift, side * height), M.curb);
                w.castShadow = true;
                roadsGroup.add(w);
            }
            run = [];
        };
        line.forEach((p, i) => {
            const a = line[Math.max(0, i - 2)], b = line[Math.min(line.length - 1, i + 2)];
            const len = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
            const nx = -(b[2] - a[2]) / len * side, nz = (b[0] - a[0]) / len * side;
            const drop = p[1] - heightAt(base, p[0] + nx * (width / 2 + .5), p[2] + nz * (width / 2 + .5));
            if (drop > .3) run.push(p); else flush();
        });
        flush();
    }
};
/** Both edges walled, for steps and bridges. */
const curbs = (line: P3[], width: number, lift: number, height: number) => {
    for (const side of [height, -height]) {
        const w = new THREE.Mesh(ribbon(line, width, lift, side), M.curb);
        w.castShadow = true;
        roadsGroup.add(w);
    }
};
const STEP = new THREE.BoxGeometry(ROAD_HALF * 2 - .1, .06, .1), PILLAR = new THREE.CylinderGeometry(.07, .09, 1, 8), CAR = new RoundedBoxGeometry(.3, .26, .42, 2, .05);
const PIER = new THREE.BoxGeometry(.7, .07, 1), CAR_GLASS = new THREE.BoxGeometry(.31, .08, .34);
const boat = new THREE.Group();
{
    const hull = new THREE.Mesh(new THREE.SphereGeometry(.5, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0xdf9478, { side: THREE.DoubleSide }));
    hull.scale.set(.55, .45, 1.2); hull.position.y = .26;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.5, .04, 6, 20).rotateX(Math.PI / 2), M.curb); rim.scale.set(.55, 1, 1.2); rim.position.y = .26;
    const mast = new THREE.Mesh(PILLAR, M.trunk); mast.scale.set(.4, 1.1, .4); mast.position.y = .8;
    const sail = new THREE.Mesh(new THREE.ConeGeometry(.32, .8, 3).rotateY(Math.PI / 6), W.patch[0]); sail.scale.set(.15, 1, 1); sail.position.set(0, .85, .12);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(.5, 20).rotateX(-Math.PI / 2), M.wood); floor.scale.set(.55, 1, 1.2); floor.position.y = .2;
    boat.add(hull, floor, rim, mast, sail);
    scene.add(shadowy(boat));
}
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
const LAMP_HEAD = new THREE.SphereGeometry(.07, 10, 8), LAMP_GLOW = mat(0xffe6a0, { emissive: 0xffc860, emissiveIntensity: .7 });
/** Along the busiest roads: lamps and flower pots in turn, on alternate sides. */
function lamps(line: P3[], pv: Paving) {
    let next = 1, side = 1, gone = 0;
    line.forEach((p, i) => {
        if (i) gone += Math.hypot(p[0] - line[i - 1][0], p[2] - line[i - 1][2]);
        if (gone < next || i < 1 || i > line.length - 2) return;
        next += 1.7; side = -side;
        const a = line[i - 1], b = line[i + 1];
        const len = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
        const off = (ROAD_HALF + .14) * side;
        const g = new THREE.Group();
        g.position.set(p[0] - (b[2] - a[2]) / len * off, p[1], p[2] + (b[0] - a[0]) / len * off);
        if (side > 0) {
            const post = new THREE.Mesh(PILLAR, pv.lamp); post.scale.set(.3, .62, .3); post.position.y = .31;
            const head = new THREE.Mesh(LAMP_HEAD, LAMP_GLOW); head.position.y = .66;
            g.add(post, head);
        } else {
            const pot = new THREE.Mesh(R.pot, pv.lamp); pot.scale.set(1.2, .9, 1.2); pot.position.y = .07;
            const leaves = new THREE.Mesh(R.pot, M.bush); leaves.position.y = .18;
            const bloom = new THREE.Mesh(G.bloom, M.bloom); bloom.scale.setScalar(.6); bloom.position.y = .26;
            g.add(pot, leaves, bloom);
        }
        roadsGroup.add(shadowy(g));
    });
}
function drawRoads() {
    for (const o of roadsGroup.children) release(o);
    roadsGroup.clear();
    lifts = [];
    roadGround = shaped;
    for (const r of roads) for (const part of r.parts) {
        const line = part.line;
        if (line.length < 2) continue;
        const mid = line[line.length >> 1];
        const pv = PAVING[themeOf({ x: mid[0], z: mid[2] })];
        if (part.kind === 'road') {
            if (roadStage === 0) {
                // A worn path: narrower, the colour of earth, no kerb.
                const path = new THREE.Mesh(ribbon(line, ROAD_HALF * 1.3, .05), pv.path);
                path.receiveShadow = true;
                roadsGroup.add(path);
            } else {
                // Paving with a darker kerb line, so the road reads against the grass.
                const width = ROAD_HALF * 2 * (roadStage === 1 ? .85 : 1);
                const edge = new THREE.Mesh(ribbon(line, width + .1, .02), pv.edge);
                const road = new THREE.Mesh(ribbon(line, width, .07), pv.stages[roadStage - 1]);
                edge.receiveShadow = road.receiveShadow = true;
                roadsGroup.add(edge, road);
                if (roadStage >= 2) parapets(line, width + .1, .03, .16);
                if (roadStage === 3) lamps(line, pv);
            }
        } else if (part.kind === 'stair') {
            // Steps up the slope in the island's paving, a tread every quarter unit.
            roadsGroup.add(shadowy(new THREE.Mesh(ribbon(line, ROAD_HALF * 2 - .1, .04), pv.stages[1])));
            line.forEach((p, i) => {
                if (!i) return;
                const q = line[i - 1];
                const step = new THREE.Mesh(STEP, pv.step);
                step.position.set(p[0], Math.max(p[1], q[1]) + .04, p[2]);
                step.rotation.y = Math.atan2(p[0] - q[0], p[2] - q[2]);
                roadsGroup.add(shadowy(step));
            });
            curbs(line, ROAD_HALF * 2, .03, .1);
        } else if (part.kind === 'bridge') {
            // A stone deck with parapets, on pillars down to the ground or the sea floor.
            roadsGroup.add(shadowy(new THREE.Mesh(ribbon(line, ROAD_HALF * 2, 0), pv.stages[1])));
            curbs(line, ROAD_HALF * 2 + .04, 0, .16);
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
            const glass = new THREE.Mesh(CAR_GLASS, M.glass); glass.position.y = .24;
            car.add(body, glass);
            roadsGroup.add(shadowy(car));
            lifts.push({ line, car, s: 0, dir: 1 });
        }
    }
    // The harbour where the road begins: a round quay, a wooden pier out to sea, a boat.
    // Before there is any road, only the pier and the boat.
    const [hx, hz] = harbour();
    const quay = new THREE.Mesh(R.slab, PAVING[themeOf({ x: hx, z: hz })].stages[1]); quay.scale.set(1.1, 1, 1.1);
    quay.position.set(hx, heightAt(shaped, hx, hz) + .04, hz);
    if (roads.length) roadsGroup.add(quay);
    let end = hz;
    while (end < hz + 6 && heightAt(base, hx, end) > -.6) end += .25;
    const length = end - hz + 1.2;
    const deck = new THREE.Mesh(PIER, M.wood); deck.scale.z = length; deck.position.set(hx, .32, hz + length / 2 + .3);
    roadsGroup.add(shadowy(deck));
    for (let z = hz + 1; z < hz + length + .3; z += .7) for (const side of [-.3, .3]) {
        const post = new THREE.Mesh(PILLAR, M.trunk); post.scale.set(.6, .9, .6); post.position.set(hx + side, -.1, z);
        roadsGroup.add(post);
    }
    boat.position.set(hx + .75, 0, hz + length * .7);
    // A little square where the road reaches each child's house, floored ふしぎ.
    for (const home of specials) {
        if (home.kind !== 'home') continue;
        const road = roads.find(r => { const e = r.line[r.line.length - 1]; return Math.hypot(e[0] - home.x, e[2] - home.z) < 1.5; });
        if (!road || road.line.length < 8) continue;
        const [x, , z] = road.line[road.line.length - 6];
        const square = new THREE.Mesh(R.slab, PAVING[home.theme ?? 0].plaza);
        square.scale.set(.85, 1, .85);
        square.position.set(x, heightAt(shaped, x, z) + .09, z);
        square.receiveShadow = true;
        roadsGroup.add(square);
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
const lathe = (pts: [number, number][], segments = 28) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segments);
const floorGeo = (w: number, h: number, d: number) => {
    const k = `${w.toFixed(2)},${h},${d.toFixed(2)}`;
    if (!G.floor.has(k)) G.floor.set(k, new RoundedBoxGeometry(w, h, d, 3, Math.min(.14, Math.min(w, h, d) * .3)));
    return G.floor.get(k)!;
};

function footing(o: { x: number; z: number; w: number; d: number }) {
    const ys = [-1, 1].flatMap(a => [-1, 1].map(b => heightAt(shaped, o.x + a * o.w * .5, o.z + b * o.d * .5)));
    return { low: Math.min(...ys), high: Math.max(...ys) };
}

/** A house, built at the origin; `userData.lift` is how far its floor sits above the ground at its middle. */
const roundGeo = (rad: number) => {
    const k = `round${rad.toFixed(2)}`;
    if (!G.floor.has(k)) G.floor.set(k, lathe([[0, 0], [rad, 0], [rad * 1.05, .2], [rad * 1.02, .42], [rad * .95, .55], [0, .55]], 22));
    return G.floor.get(k)!;
};
const R = {
    slab: new THREE.CylinderGeometry(1, 1, .07, 22),
    vault: new THREE.CylinderGeometry(1, 1, 1, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2),
    turret: lathe([[0, 0], [.14, 0], [.16, .3], [.12, .5], [0, .5]], 14),
    pot: new THREE.IcosahedronGeometry(.08, 1),
    parasol: new THREE.ConeGeometry(.26, .1, 12),
};
type Roof = 'terrace' | 'dome' | 'vault' | 'turret';
/** A town house takes after the child's house nearest to it. */
function themeOf(o: { x: number; z: number }): number {
    let best = 0, bestD = Infinity;
    for (const s of specials) if (s.kind === 'home') {
        const d = Math.hypot(s.x - o.x, s.z - o.z);
        if (d < bestD) { bestD = d; best = s.theme ?? 0; }
    }
    return best;
}

/**
 * A house, built at the origin; `userData.lift` is how far its floor sits above the ground at its middle.
 * Houses are soft-cornered blocks or round like a grown tower, two or three
 * storeys stepping back and leaning a little, each topped differently.
 */
function buildHouse(o: House): THREE.Group {
    builds.house++;
    const g = new THREE.Group();
    const r = rng(o.id * 31);
    const round = o.id % 3 === 0;
    const th = THEMES[themeOf(o)];
    // About one house in five is a ふしぎ house: a patchwork wall or a dotted dome.
    const wonder = th.wonder(o.id);
    const roof: Roof = wonder === 'dots' ? 'dome' : (['terrace', 'dome', 'vault', 'turret', 'terrace'] as const)[Math.floor(r() * 5)];
    let y = 0, w = o.w, d = o.d, dx = 0, dz = 0;
    for (let f = 0; f < o.floors; f++) {
        const wall = wonder === 'patch' && f === 0 ? W.patch[o.id % 2] : th.walls[o.tint];
        const rad = Math.min(w, d) / 2;
        const body = new THREE.Mesh(round ? roundGeo(rad) : floorGeo(w, .55, d), wall);
        body.position.set(dx, y + (round ? 0 : .275), dz);
        g.add(body);
        // Windows with green shutters on the front, the door on the ground floor.
        const front = (round ? rad : d / 2) + .01, span = round ? rad * .9 : w;
        if (f === 0) { const door = new THREE.Mesh(G.door, M.door); door.position.set(span * .18 + dx, y + .17, front + dz); g.add(door); }
        for (const wx of f === 0 ? [-span * .22] : [-span * .24, span * .24]) {
            const gl = new THREE.Mesh(G.glass, M.glass); gl.position.set(wx + dx, y + .32, front + dz);
            const l = new THREE.Mesh(G.shutter, M.shutter); l.position.set(wx - .1 + dx, y + .32, front + .01 + dz);
            const rr = new THREE.Mesh(G.shutter, M.shutter); rr.position.set(wx + .1 + dx, y + .32, front + .01 + dz);
            g.add(gl, l, rr);
        }
        y += .55;
        // Upper floors step back and sit a little off centre, as if grown.
        w *= .86 + r() * .1; d *= .82 + r() * .1;
        dx += (r() - .5) * .12; dz -= .04 + r() * .05;
    }
    const top = new THREE.Group();
    top.position.set(dx, y, dz);
    g.add(top);
    const rad = Math.min(w, d) / 2 / .84;
    const slab = round ? new THREE.Mesh(R.slab, M.roof) : new THREE.Mesh(floorGeo(w / .84 + .05, .07, d / .8 + .05), M.roof);
    if (round) slab.scale.set(rad + .04, 1, rad + .04);
    slab.position.y = .02;
    top.add(slab);
    if (roof === 'dome') {
        const dome = new THREE.Mesh(G.dome, wonder === 'dots' ? (o.id % 20 === 7 ? W.pumpkin : th.dotDome) : th.dome);
        dome.scale.setScalar(Math.min(1.6, rad * 3.2));
        dome.position.y = .05;
        top.add(dome);
    } else if (roof === 'vault') {
        const v = new THREE.Mesh(R.vault, M.base);
        v.scale.set(round ? rad * 1.6 : w * .95 / .84, rad * .55, rad * .8);
        v.position.y = .05;
        top.add(v);
    } else if (roof === 'turret') {
        const t = new THREE.Mesh(R.turret, th.walls[(o.tint + 2) % 5]);
        t.position.set(rad * .45, .05, -rad * .35);
        const cap = new THREE.Mesh(G.dome, th.dome); cap.scale.setScalar(.8); cap.position.y = .5;
        t.add(cap);
        top.add(t);
    } else {
        // A roof terrace: potted plants and a striped parasol.
        for (const [px, pz] of [[-.25, .2], [.25, .22], [-.2, -.2]]) {
            const pot = new THREE.Mesh(R.pot, M.bush); pot.position.set(px * rad * 1.6, .1, pz * rad * 1.6); top.add(pot);
        }
        const pole = new THREE.Mesh(PILLAR, M.base); pole.scale.set(.25, .35, .25); pole.position.set(.1, .22, 0); top.add(pole);
        const para = new THREE.Mesh(R.parasol, th.walls[4]); para.position.set(.1, .42, 0); top.add(para);
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
    shadowy(merge(g));
    setFooting(g, o);
    return g;
}

/**
 * The white base a house stands on down the slope, kept apart from the house
 * itself: when the ground under it changes only the base is swapped, which is
 * cheap, and the house is never rebuilt for it.
 */
function setFooting(g: THREE.Group, o: House) {
    const { low, high } = footing(o);
    g.userData.lift = high - heightAt(shaped, o.x, o.z);
    const steps = high - low > .05 ? Math.ceil((high - low + .25) * 4) : 0;
    if (g.userData.steps === steps) return;
    g.userData.steps = steps;
    const old = g.getObjectByName('base');
    if (old) g.remove(old);
    if (!steps) return;
    const b = new THREE.Mesh(floorGeo(o.w, steps / 4, o.d), M.base);
    b.name = 'base';
    b.position.y = -steps / 8 + .02;
    b.castShadow = b.receiveShadow = true;
    g.add(b);
}

// ---------- trees ----------
const T = {
    trunk: new THREE.CylinderGeometry(.04, .06, 1, 6),
    umbrella: new THREE.SphereGeometry(.5, 14, 10),
    cone: new THREE.ConeGeometry(.22, 1, 10),
    bush: new THREE.IcosahedronGeometry(.3, 1),
    olive: new THREE.IcosahedronGeometry(.32, 1),
    frond: new THREE.ConeGeometry(.09, .62, 5).rotateX(Math.PI / 2).translate(0, 0, .31),
    palmTrunk: new THREE.CylinderGeometry(.035, .055, 1, 6).translate(0, .5, 0),
};
/** Palms lean out to sea; other trees just face any way. */
const treeTurn = (t: Tree) => (t.kind === 'palm' ? Math.atan2(t.z, -t.x) : t.id * 1.7);
function buildTree(t: Tree): THREE.Group {
    builds.tree++;
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
    } else if (t.kind === 'olive') {
        // A small silvery olive: a short trunk and a round, loose crown.
        const trunk = new THREE.Mesh(T.trunk, M.trunk); trunk.scale.y = .45; trunk.position.y = .22;
        const crown = new THREE.Mesh(T.olive, M.olive); crown.scale.set(1.1, .8, 1); crown.position.y = .55;
        g.add(trunk, crown);
    } else if (t.kind === 'palm') {
        // A palm leaning out towards the sea, with drooping fronds.
        const trunk = new THREE.Mesh(T.palmTrunk, M.trunk); trunk.scale.y = 1.1; trunk.rotation.z = .25;
        const top = new THREE.Group(); top.position.set(-.27, 1.06, 0);
        for (let i = 0; i < 7; i++) {
            const f = new THREE.Mesh(T.frond, t.id % 9 === 4 ? W.crown : M.palm);
            f.rotation.set(.45, i / 7 * Math.PI * 2, 0, 'YXZ');
            top.add(f);
        }
        g.add(trunk, top);
    } else {
        const b = new THREE.Mesh(T.bush, M.bush); b.scale.set(1, .75, 1); b.position.y = .18;
        g.add(b);
        if (t.id % 3 === 0) for (let i = 0; i < 3; i++) {
            const f = new THREE.Mesh(G.bloom, M.bloom); f.scale.setScalar(.6);
            f.position.set(Math.cos(i * 2.1) * .22, .3, Math.sin(i * 2.1) * .22); g.add(f);
        }
    }
    g.rotation.y = treeTurn(t);
    g.userData.lift = -.03;
    return shadowy(merge(g));
}

// ---------- special buildings ----------
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
        const th = THEMES[s.theme ?? 0];
        if (stage === 0) {
            const seed = new THREE.Mesh(G.dome, th.roof); seed.scale.set(1.6, 1.2, 1.6); g.add(seed);
            const stem = new THREE.Mesh(PILLAR, M.bush); stem.scale.set(.35, .3, .35); stem.position.y = .34; g.add(stem);
            for (const side of [-1, 1]) {
                const leaf = new THREE.Mesh(T.bush, M.bush); leaf.scale.set(.34, .1, .2);
                leaf.position.set(side * .11, .5, 0); leaf.rotation.z = side * .5; g.add(leaf);
            }
        } else {
            g.add(new THREE.Mesh(lathe([[0, 0], [.5, 0], [.57, .3], [.52, .62], [0, .62]]), th.body[0]));
            const band = new THREE.Mesh(new THREE.CylinderGeometry(.555, .53, .16, 28, 1, true), W.patch[1]); band.position.y = .14; g.add(band);
            let top = .62;
            if (stage >= 2) {
                const upper = new THREE.Mesh(lathe([[0, 0], [.42, 0], [.45, .24], [.37, .48], [0, .48]]), th.body[1]);
                upper.position.y = top; g.add(upper); top += .48;
            }
            const roof = new THREE.Mesh(G.dome, th.roof); roof.scale.set(stage >= 2 ? 2.1 : 2.7, 1.7, stage >= 2 ? 2.1 : 2.7); roof.position.y = top - .03; g.add(roof);
            const door = new THREE.Mesh(G.door, M.door); door.position.set(0, .17, .53); g.add(door);
            for (const wx of [-.3, .3]) { const gl = new THREE.Mesh(G.glass, M.glass); gl.position.set(wx, .42, .46); gl.rotation.y = wx * 1.1; g.add(gl); }
            if (stage >= 2) {
                const pole = new THREE.Mesh(PILLAR, M.trunk); pole.scale.set(.3, .55, .3); pole.position.y = top + .55; g.add(pole);
                const flag = new THREE.Mesh(new THREE.BoxGeometry(.26, .16, .015), W.patch[0]); flag.position.set(.14, top + .74, 0); g.add(flag);
            }
            if (stage >= 3) {
                const tower = new THREE.Group(); tower.position.set(.56, 0, -.28); tower.rotation.z = -.07;
                tower.add(new THREE.Mesh(lathe([[0, 0], [.22, 0], [.26, .5], [.18, 1.1], [.21, 1.5], [0, 1.5]]), th.tower));
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
    return shadowy(merge(g));
}

function redrawSpecials() {
    for (const g of specialsGroup.children) release(g);
    specialsGroup.clear();
    for (const s of specials) specialsGroup.add(buildSpecial(s));
}

// ---------- the island thinks ----------
/**
 * A road always climbs from the harbour to the island's highest point, so a
 * town grows even before the child has placed anything. Not when a special
 * building already stands near the top.
 */
function lookout(): XZ[] {
    let best = -1;
    for (let k = 0; k < N * N; k++) if (best < 0 || base[k] > base[best]) best = k;
    const x = -SIZE / 2 + (best % N) * RES, z = -SIZE / 2 + Math.floor(best / N) * RES;
    if (base[best] < 1.2 || specials.some(s => Math.hypot(s.x - x, s.z - z) < 2.5)) return [];
    return [[x, z]];
}
function harbour(): XZ {
    // Walk in from the sea on grid points, so the harbour sits on a dry node.
    for (let z = 9.5; z > 0; z -= RES) if (heightAt(base, 0, z) > .25) return [0, z];
    return [0, 0];
}

let main: P3[] = [];
let lastMoved = 0;
/** A special building levels its own plot like a house does. */
const plot = (s: Special): House => ({ id: -1, x: s.x, z: s.z, rot: 0, w: 1.3, d: 1.3, floors: 1, tint: 0, born: 0 });
/** Where the last stroke was, until the island has settled after it. */
let stirred: XZ | null = null;
/**
 * The island never disappears, and what the child places makes room for
 * itself. However much is carved away, a little island stays around each
 * thing the child has placed (or in the middle, before there is any), with
 * room for it, a strip of beach and a few houses.
 */
function keepSandbars(h: Heights) {
    const centres: XZ[] = specials.length ? specials.map(s => [s.x, s.z]) : [[0, 0]];
    for (const [cx, cz] of centres) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const d = Math.hypot(-SIZE / 2 + i * RES - cx, -SIZE / 2 + j * RES - cz);
        if (d > 3.2) continue;
        const k = i + j * N;
        h[k] = Math.max(h[k], d < 2 ? .55 : .55 - (d - 2) * .9);
    }
}
function recompute() {
    // Whatever the strokes left half-slid finishes sliding now, starting
    // where the finger was and widening only as far as earth still moves.
    const ts = performance.now();
    if (stirred) { settleSlopes(base, stirred[0], stirred[1], 4.4, 80); stirred = null; }
    keepSandbars(base);
    (perf.parts.slide ??= []).push(performance.now() - ts);
    const tn = performance.now();
    const net = network(base, harbour(), [...specials.map(s => [s.x, s.z] as XZ), ...lookout()]);
    perf.network.push(performance.now() - tn);
    roads = net.roads;
    let tp = performance.now();
    const lap = (name: string) => { const t = performance.now(); (perf.parts[name] ??= []).push(t - tp); tp = t; };
    cut = cutRoads(base, roads);
    lap('cut');
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
    lap('houses');
    settle();
    lap('settle');
    trees = trees.filter(t => treeFits(shaped, roads, houses, trees, t) && specials.every(s => Math.hypot(s.x - t.x, s.z - t.z) > .9));
    lap('trees');
    drawRoads();
    lap('drawRoads');
    redrawSpecials();
    lap('specials');
    const b0 = { ...builds };
    sync(performance.now());
    lap('sync');
    (perf.parts.builtHouses ??= []).push(builds.house - b0.house); (perf.parts.builtTrees ??= []).push(builds.tree - b0.tree);
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
            if (v) { group.remove(v.g); release(v.g); }
            const g = build(o); g.position.set(o.x, heightAt(shown, o.x, o.z), o.z); g.rotation.y = rot; g.scale.setScalar(.01);
            group.add(g);
            views.set(o.id, { g, x: o.x, z: o.z, rot, from: { x: o.x, z: o.z, rot }, t0: now, size, key });
            continue;
        }
        if (v.key !== key) {
            // Same house, new footing: rebuild its body in place.
            const g = build(o); g.position.copy(v.g.position); g.rotation.y = v.g.rotation.y; g.scale.copy(v.g.scale);
            group.remove(v.g); release(v.g); group.add(g); v.g = g; v.key = key;
        }
        if (v.x !== o.x || v.z !== o.z || v.rot !== rot) {
            v.from = { x: v.g.position.x, z: v.g.position.z, rot: v.g.rotation.y };
            v.x = o.x; v.z = o.z; v.rot = rot; v.t0 = now - POP;
        }
    }
    for (const [id, v] of views) if (!alive.has(id) && v.leaving === undefined) v.leaving = now;
}
const houseKey = (o: House) => `${o.w.toFixed(3)},${o.d.toFixed(3)},${o.floors},${o.tint},${themeOf(o)}`;
function sync(now: number) {
    syncOne(houses, houseViews, housesGroup, buildHouse, o => ({ rot: o.rot, size: 1, key: houseKey(o) }), now);
    for (const o of houses) { const v = houseViews.get(o.id); if (v && v.leaving === undefined) setFooting(v.g, o); }
    syncOne(trees, treeViews, treesGroup, buildTree, t => ({ rot: treeTurn(t), size: t.size, key: t.kind }), now);
    updateStat();
}
const smooth = (t: number) => t * t * (3 - 2 * t);
function moveViews(views: Map<number, View>, group: THREE.Group, now: number) {
    for (const [id, v] of views) {
        const g = v.g;
        if (v.leaving !== undefined) {
            const t = Math.min(1, (now - v.leaving) / 300);
            g.scale.setScalar(v.size * (1 - smooth(t)) + .001);
            if (t >= 1) { group.remove(g); release(g); views.delete(id); }
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
        redrawSpecials();
    }
    const length = roads.reduce((s, r) => s + r.line.length * .25, 0);
    let built = false;
    if (houses.length < Math.min(60, length * .9)) {
        const o = houseSpot(cut, roads, houses, rand, nextId++, now);
        if (o && specials.every(s => Math.hypot(s.x - o.x, s.z - o.z) > 1)) {
            houses.push(o);
            built = true;
            if (now > 0) chime(780 + rand() * 240, .025, .22);
            // The new house levels its plot; trees in the way make room.
            settle();
            trees = trees.filter(t => treeFits(shaped, roads, houses, trees, t));
        }
    }
    // Once the roadsides are full the town keeps growing upwards: now and then
    // a house gains a storey, so learning always changes something.
    // Each house has its own height to grow to, two to four storeys, so the
    // skyline stays uneven instead of every house becoming a tower.
    if (!built && houses.length && rand() < .3) {
        const low = houses.filter(o => o.floors < 2 + o.id % 3);
        if (low.length) {
            const i = houses.indexOf(low[Math.floor(rand() * low.length)]);
            houses[i] = { ...houses[i], floors: houses[i].floors + 1 };
            if (now > 0) chime(660 + rand() * 200, .02, .2);
        }
    }
    // As many trees as the land has room for: a small island is not a jungle.
    let land = 0;
    for (let k = 0; k < N * N; k++) if (shaped[k] > .35) land++;
    const room = Math.min(70, Math.round(land * RES * RES * .5));
    if (trees.length > room) trees = trees.slice(0, room);
    for (let i = 0; i < 2 && trees.length < room; i++) {
        const t = treeSpot(shaped, roads, houses, trees, rand, nextId++, now);
        if (t && specials.every(s => Math.hypot(s.x - t.x, s.z - t.z) > .9)) trees.push(t);
    }
    sync(now);
}

function updateStat() {
    const kinds = new Set(roads.flatMap(r => r.parts.map(p => p.kind)));
    const extra = [kinds.has('stair') && 'かいだん', kinds.has('bridge') && 'はし', kinds.has('lift') && 'ケーブルカー'].filter(Boolean).join('・');
    stat.textContent = `${byLearning ? `まなんだ ${sessions}かい · ` : ''}みち ${roads.length}${extra ? `（${extra}）` : ''} · いえ ${houses.length} · き ${trees.length} · すむ ${townsfolk()}${placing ? ` · ${placing === 'home' ? 'たね' : '★'}を おく ばしょを タップ` : ''}`;
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
const FOLK_SCALE = .4;
const SPECIES: ResidentSpecies[] = ['otter', 'rabbit', 'fox'];
const townsfolk = () => Math.min(18, 3 + Math.floor(houses.length / 3));
const folk = Array.from({ length: 18 }, (_, i) => {
    const g = new THREE.Group();
    const rig = makeResidentRig(SPECIES[i % 3], poko);
    // Only the feet move on their own here, so the rest of each resident is drawn in one or two goes.
    merge(rig.body);
    g.add(rig.pose);
    g.scale.setScalar(FOLK_SCALE);
    scene.add(g);
    return {
        g, rig, feet: rig.feet.map(f => f.position.z), road: i, s: i * 7 + 3, dir: i % 2 ? 1 : -1, side: i % 2 ? .25 : -.25, speed: 1.8 + (i % 3) * .5,
        // Each resident has a house to go home to now and then.
        home: -1, homeS: 0, mode: 'walk' as 'walk' | 'in' | 'out', t: 0, rest: 4 + i % 5, from: new THREE.Vector3(), door: new THREE.Vector3(),
    };
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

const ENTER = .9;
/** A house's front door in the world: houses face their road. */
const doorOf = (o: House, out: THREE.Vector3) => out.set(o.x + Math.sin(o.rot) * (o.d / 2 + .1), heightAt(shown, o.x, o.z), o.z + Math.cos(o.rot) * (o.d / 2 + .1));
/**
 * Residents stroll up and down their road. Passing their own house, they now
 * and then step in at the door, stay a while, and come out again.
 */
function walk(f: typeof folk[number], road: Road, dt: number, now: number) {
    const house = houses.find(o => o.id === f.home);
    if (!house) {
        // Choose a house by this road to live in.
        const free = houses.filter(o => !folk.some(q => q !== f && q.home === o.id));
        let best = -1, bestD = 2.4, bestS = 0;
        for (const o of free) road.line.forEach((p, k) => {
            const dd = Math.hypot(p[0] - o.x, p[2] - o.z);
            if (dd < bestD) { bestD = dd; best = o.id; bestS = k; }
        });
        f.home = best; f.homeS = bestS;
        // A newcomer starts a little way along the road, walking home.
        if (best >= 0) f.s = Math.max(0, Math.min(road.line.length - 1.01, bestS - f.dir * (4 + f.road % 6)));
        if (f.mode !== 'walk') { f.mode = 'walk'; f.g.scale.setScalar(FOLK_SCALE); }
    }
    f.rest -= dt;
    if (f.mode === 'walk') {
        // Time to go home: turn towards the house.
        if (house && f.rest < 0 && Math.abs(f.s - f.homeS) > 1) f.dir = Math.sign(f.homeS - f.s);
        f.s += f.dir * dt * f.speed;
        if (f.s <= 0 || f.s >= road.line.length - 1.01) { f.dir *= -1; f.s = Math.max(0, Math.min(road.line.length - 1.01, f.s)); }
        if (house && f.rest < 0 && Math.abs(f.s - f.homeS) < .5) { f.mode = 'in'; f.t = 0; f.from.copy(f.g.position); doorOf(house, f.door); }
    }
    if (f.mode === 'walk' || !house) {
        const [p, heading] = along(road.line, Math.min(f.s, road.line.length - 1.01), f.side);
        p.y += rise(p.x, p.z) - .05;
        f.g.position.copy(p);
        f.g.rotation.y = heading + (f.dir > 0 ? 0 : Math.PI);
    } else {
        // Walking to the door and shrinking into the house, or the other way out.
        f.t += dt / ENTER;
        const t = Math.min(1, f.t), going = f.mode === 'in';
        const k = going ? t : 1 - t;
        f.g.position.lerpVectors(f.from, f.door, Math.min(1, k * 1.3));
        f.g.rotation.y = Math.atan2(f.door.x - f.from.x, f.door.z - f.from.z) + (going ? 0 : Math.PI);
        f.g.scale.setScalar(FOLK_SCALE * (k > .75 ? 1 - (k - .75) * 4 : 1) + 1e-4);
        if (going && f.t > 1 + 3 + (f.home % 4)) { f.mode = 'out'; f.t = 0; }
        else if (!going && t >= 1) { f.mode = 'walk'; f.rest = 8 + (f.home % 7) * 2; f.g.scale.setScalar(FOLK_SCALE); }
    }
    // A waddle: feet take turns, the body rocks a little.
    const step = now / 150 * f.speed;
    f.rig.feet.forEach((foot, k) => { foot.position.z = f.feet[k] + Math.sin(step + k * Math.PI) * .12; });
    f.rig.body.rotation.z = Math.sin(step) * .06;
    f.g.position.y += Math.abs(Math.sin(step)) * .015;
    f.g.visible = true;
}

function landNear(x: number, z: number): XZ {
    if (heightAt(base, x, z) > .3) return [x, z];
    for (let r = .25; r < 14; r += .25) for (let a = 0; a < 24; a++) {
        const px = x + Math.cos(a / 24 * Math.PI * 2) * r, pz = z + Math.sin(a / 24 * Math.PI * 2) * r;
        if (Math.abs(px) < SIZE / 2 && Math.abs(pz) < SIZE / 2 && heightAt(base, px, pz) > .6) return [px, pz];
    }
    return [0, 0];
}
function place(kind: SpecialKind, x: number, z: number) {
    specials.push(kind === 'home' ? { x, z, kind, stage: 0, theme: seedTheme } : { x, z, kind });
    placing = null;
    showSwatches();
    recompute();
}

// ---------- feel ----------
// A soft ring shows where the finger shapes; every stroke answers with a small
// sound, higher as the hill grows, lower as it is carved.
// Made at load, silent until the first touch resumes it, so the first stroke
// does not wait for the sound system to start.
let audio: AudioContext | undefined;
try { audio = new AudioContext(); } catch { /* no sound here */ }
let muted = false;
try { muted = localStorage.getItem('growLab.muted') === '1'; } catch { /* sound stays on */ }
function chime(freq: number, volume = .035, length = .09) {
    if (!audio || muted) return;
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
const builds = { house: 0, tree: 0 };
const perf = { rethink: [] as number[], stroke: [] as number[], folk: [] as number[], render: [] as number[], network: [] as number[], parts: {} as Record<string, number[]> };
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
    stirred = [p.x, p.z];
    keepSandbars(base);
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
    if (audio?.state === 'suspended') void audio.resume();
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
    showSwatches();
    updateStat();
});
const soundButton = root.querySelector<HTMLButtonElement>('#sound')!;
const showSound = () => { soundButton.textContent = muted ? '🔇' : '🔈'; soundButton.setAttribute('aria-pressed', String(!muted)); };
soundButton.addEventListener('click', () => {
    muted = !muted;
    try { localStorage.setItem('growLab.muted', muted ? '1' : '0'); } catch { /* only for this visit */ }
    showSound();
});
showSound();
// 🌱 opens the four colours; the chosen one stays chosen for the next seed too.
const swatches = root.querySelector<HTMLDivElement>('#swatches')!;
swatches.innerHTML = THEMES.map((t, i) => `<button data-theme="${i}" aria-label="${t.name}" style="--c:${t.swatch}"></button>`).join('');
function showSwatches() {
    swatches.hidden = placing !== 'home';
    for (const b of swatches.querySelectorAll<HTMLButtonElement>('[data-theme]')) b.setAttribute('aria-pressed', String(Number(b.dataset.theme) === seedTheme));
}
swatches.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-theme]');
    if (!b) return;
    seedTheme = Number(b.dataset.theme);
    showSwatches();
});
/**
 * Stands in for finishing a learning session in the app: the island grows a
 * few steps, one after another, so the child sees each new thing appear.
 */
function learn(spread = 450) {
    sessions++;
    for (let i = 0; i < PER_SESSION; i++) window.setTimeout(() => grow(performance.now()), spread * i);
    updateStat();
}
const learnButton = root.querySelector<HTMLButtonElement>('#learn')!;
learnButton.hidden = !byLearning;
learnButton.addEventListener('click', () => learn());
root.querySelector('#seed')!.addEventListener('click', () => {
    placing = 'home';
    showSwatches();
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
    // The camera looks down steeply, so on a tall phone the island fills the
    // height instead of leaving sky above and sea below.
    // On a wide screen the island's height is what must fit, so stand further back.
    const away = new THREE.Vector3(.54, .95, .84).normalize();
    camera.position.copy(controls.target).addScaledVector(away, camera.aspect < 1 ? 22 * Math.max(1, 1.25 / camera.aspect * .66) : 30);
}
addEventListener('resize', resize);
resize();
light();
recompute();
// The ground starts already settled, so nothing would ease it into place.
showGround();
// Prepare the finger ring's drawing now, not on the first stroke.
ring.visible = true;
renderer.compile(scene, camera);
ring.visible = false;
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
    if (!byLearning && !painting && now - lastGrow > 900) { grow(now); lastGrow = now; }
    if (easeGround(dt)) rideRoads();
    moveViews(houseViews, housesGroup, now);
    moveViews(treeViews, treesGroup, now);
    for (const g of specialsGroup.children) g.position.y = (g.userData.y0 as number) + rise(g.position.x, g.position.z);
    drawRing(dt);
    boat.position.y = Math.sin(now / 900) * .04;
    boat.rotation.z = Math.sin(now / 1100) * .06;
    // The bus runs up and down the main road and waits at each end.
    if (main.length > 2) {
        if (busWait > 0) busWait -= dt;
        else {
            busAt += busDir * dt * 6;
            if (busAt <= 0 || busAt >= main.length - 1.01) { busAt = Math.max(0, Math.min(main.length - 1.01, busAt)); busDir *= -1; busWait = 1.6; }
        }
        const [p, heading] = along(main, busAt, busDir > 0 ? -.2 : .2);
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
    const tf = performance.now();
    folk.forEach((f, i) => {
        const road = roads[f.road % Math.max(1, roads.length)];
        if (i >= living || !road || road.line.length < 3) { f.g.visible = false; return; }
        walk(f, road, dt, now);
    });
    perf.folk.push(performance.now() - tf);
    const home = specials.find(s => s.kind === 'home');
    partner.g.visible = !!home;
    if (home) {
        const x = home.x + .55, z = home.z + .75;
        partner.g.position.set(x, heightAt(shown, x, z), z);
        partner.g.rotation.y = .5 + Math.sin(now / 1400) * .5;
        partner.rig.head.rotation.z = Math.sin(now / 700) * .12;
    }
    controls.update();
    const tr = performance.now();
    renderer.render(scene, camera);
    perf.render.push(performance.now() - tr);
});

// For checks from the outside: the same strokes and taps a finger makes.
Object.assign(window, {
    growLab: {
        get roads() { return roads; }, get houses() { return houses; }, get trees() { return trees; }, get specials() { return specials; },
        get moved() { return lastMoved; },
        get pixelRatio() { return pixelRatio; },
        get drawCalls() { return renderer.info.render.calls; },
        get memory() { return { ...renderer.info.memory }; },
        /** Where a point on the ground shows on screen, in page pixels, to aim a real tap at it. */
        screenOf(x: number, z: number) {
            const v = new THREE.Vector3(x, heightAt(shown, x, z), z).project(camera);
            const r = renderer.domElement.getBoundingClientRect();
            return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height];
        },
        get muted() { return muted; },
        shownAt: (x: number, z: number) => heightAt(shown, x, z),
        get cameraAt() { return camera.position.toArray().map(v => +v.toFixed(2)); },
        get folk() { return folk.filter(f => f.g.visible).map(f => f.mode); },
        get folkDebug() { return folk.slice(0, townsfolk()).map(f => ({ m: f.mode, home: f.home, s: +f.s.toFixed(1), hs: f.homeS, rest: +f.rest.toFixed(1), road: f.road % Math.max(1, roads.length) })); },
        get harbour() { return harbour(); },
        folkMeshes() { let n = 0; folk[0].g.traverse(o => { if ((o as THREE.Mesh).isMesh) n++; }); return n; },
        perf,
        /** One finger stroke along a path, as the pointer would make it: a press, then moves. */
        drag(path: [number, number][], carve = false) {
            remember();
            path.forEach(([x, z], i) => brush(base, x, z, (carve ? -1 : 1) * (i ? .22 * 16 / 90 * 3 : .5)));
            stirred = path[path.length - 1];
            recompute();
        },
        get summary() {
            let land = 0, top = -9;
            for (let k = 0; k < N * N; k++) { if (base[k] > .3) land++; top = Math.max(top, base[k]); }
            const kinds = [...new Set(roads.flatMap(r => r.parts.map(p => p.kind)))];
            return { land: +(land * RES * RES).toFixed(0), top: +top.toFixed(1), roads: roads.length, kinds, houses: houses.length, trees: trees.length, folk: townsfolk(), specials: specials.map(s => `${s.kind}${s.stage ?? ''}`) };
        },
        stroke(x: number, z: number, amount: number, times = 1, carve = false) {
            remember();
            const t0 = performance.now();
            for (let i = 0; i < times; i++) brush(base, x, z, carve ? -amount : amount);
            stirred = [x, z];
            recompute();
            return performance.now() - t0;
        },
        place(kind: SpecialKind, x: number, z: number, theme?: number) { remember(); if (theme !== undefined) seedTheme = theme; const [px, pz] = landNear(x, z); place(kind, px, pz); },
        undo() { root.querySelector<HTMLButtonElement>('#undo')!.click(); },
        grow(n: number) { for (let i = 0; i < n; i++) grow(-1e6); },
        /** n learning sessions, all at once. */
        learn(n = 1) { for (let i = 0; i < n; i++) { sessions++; for (let k = 0; k < PER_SESSION; k++) grow(-1e6); } updateStat(); },
        get sessions() { return sessions; },
        /** Show every road at one stage of use (0 worn path … 3 tiles), to compare. */
        roadStage(n: number) { roadStage = n; drawRoads(); },
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
