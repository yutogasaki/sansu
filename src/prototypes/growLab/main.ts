import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { houseFits, houseSpot, moveHouse, padHouses, rng, treeFits, treeSpot, type House, type Tree } from './growth';
import { ROAD_HALF, cutRoads, network, type P3, type Road, type XZ } from './roads';
import { busySpot, graphOf, newFootfall, nodeNear, pathBetween, stagesAlong, walkTrips } from './traffic';
import { N, RES, SIZE, brush, heightAt, sampleIsland, settleSlopes, slopeAt, smallIsland, type Heights } from './terrain';
import { IslandMaterials } from '../../components/island/three/primitives';
import { makeResidentRig, type ResidentSpecies } from '../../components/island/three/residentRig';
import './style.css';

// Grow lab: the child shapes a green island with つむ／けずる and now and then
// sets down one special building. The island does the rest: winding roads
// cut into the slopes, a bus, houses along the roads, trees on the hills.
// Nothing the child does is refused: where the rules would say no, the island
// finds another way (steps, a bridge, a funicular, a house that moves next door).

type Tool = 'stack' | 'carve' | 'road';
type Time = 'day' | 'dusk' | 'night';
type SpecialKind = 'home' | 'chapel' | 'lighthouse' | 'tower';
/** `stage` is how far a child's house has grown from its seed (0 seed … 3 full). */
interface Special { x: number; z: number; kind: SpecialKind; stage?: number; theme?: number; lived?: boolean }

const root = document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML = `<div id="viewport"></div>
<div class="top"><span>試作 · そだつ島</span><div class="right"><button id="learn" class="pill" hidden aria-label="まなぶ">📖<span> まなぶ</span></button><button id="photo" class="round" aria-label="しゃしん">📷</button><button id="sound" class="round" aria-label="おと">🔈</button><button id="time" class="round" aria-label="じかん">☀️</button></div></div>
<p class="stat" id="stat" aria-live="polite"></p>
<div class="swatches" id="swatches" hidden></div>
<div class="card" id="card" hidden><img alt="しまの しゃしん"><div class="card-buttons"><a id="save" download="shima.png">ほぞん</a><button id="close">とじる</button></div></div>
<div class="tools"><button id="undo" aria-label="もどす">↶</button><div class="seg big" id="tool"><button data-tool="stack">つむ</button><button data-tool="carve">けずる</button><button data-tool="road" hidden>みち</button></div><button id="seed" aria-label="おうちの たね">🌱</button><button id="special" aria-label="とくべつな たてもの">★</button></div>`;
const viewport = root.querySelector<HTMLDivElement>('#viewport')!;
const stat = root.querySelector<HTMLParagraphElement>('#stat')!;
const params = new URLSearchParams(location.search);
let time: Time = (['dusk', 'night'] as const).find(t => t === params.get('time')) ?? 'day';
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
// ?roads=draw: the child lays the roads with a みち stroke. The island still
// runs one road from the harbour to each child's house, so nobody is stuck.
const drawMode = params.get('roads') === 'draw';
/** Points along the roads the child has drawn, in the order drawn. */
let drawn: XZ[] = [];
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
const history: { base: Heights; specials: Special[]; houses: House[]; trees: Tree[]; drawn: XZ[] }[] = [];
const rand = rng(7);
let nextId = 1;

// ---------- scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
// Start sharp enough and cheap; the loop raises the resolution while frames stay quick.
let pixelRatio = 1;
/**
 * How much the island draws: 0 everything; 1 no shadows; 2 also fewer residents
 * and nobody out walking. It only steps down, when frames stay slow at the
 * lowest resolution, so a weak phone stays smooth without asking anyone.
 */
let quality = 0;
renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
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

// Toy-bright colours for parasols, boats, fruit and washing.
const BRIGHT = [0xef5b6b, 0xf3c63f, 0x41a8d8, 0x7bc36a, 0x9a6fc4, 0xf29b38].map(c => mat(c));

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
        c.fillStyle = mark; c.strokeStyle = mark; c.lineWidth = w * .06;
        c.beginPath(); c.arc(i * w + w / 2, j * w + w / 2, w * (ring ? .24 : .16), 0, Math.PI * 2);
        if (ring) c.stroke(); else c.fill();
        c.fillStyle = '#ffffff99'; c.fillRect(i * w, j * w, w, 2); c.fillRect(i * w, j * w, 2, w);
    }
}, seed);
/** `plaza` is the ふしぎ floor of the little square in front of the child's house. */
/** A worn path fades into the grass at its edges instead of ending in a hard line. */
const SOFT_EDGE = canvasTexture((c, s) => {
    const r = rng(91);
    const g = c.createLinearGradient(0, 0, s, 0);
    g.addColorStop(0, '#000'); g.addColorStop(.3, '#fff'); g.addColorStop(.7, '#fff'); g.addColorStop(1, '#000');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    // A few bare patches, so the path looks trodden rather than painted.
    for (let i = 0; i < 18; i++) { c.fillStyle = '#0006'; c.beginPath(); c.arc(s * (.3 + r() * .4), r() * s, s * .04, 0, Math.PI * 2); c.fill(); }
});
SOFT_EDGE.wrapT = THREE.RepeatWrapping;
const worn = (color: number) => mat(color, { alphaMap: SOFT_EDGE, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, side: THREE.DoubleSide });
interface Paving { path: THREE.Material; stages: THREE.Material[]; edge: THREE.Material; step: THREE.Material; plaza: THREE.Material; lamp: THREE.Material }
const PAVING: Paving[] = [
    {
        // しろ: pale limestone setts, then white and blue tiles.
        path: worn(0xc8b48c),
        stages: [
            gravel('#d8cdb2', ['#b9ab8c', '#efe7d4', '#a39575'], 31),
            setts(['#ece5d3', '#e0d6bf', '#f4efe2', '#d6cbb2'], '#b7aa8f', 6, 4, 32),
            tiles('#f6f2e8', '#e6edf6', '#9db8dc', true, 33),
        ],
        edge: mat(0x9c8c70, { polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide }),
        step: mat(0xe6dcc6), plaza: W.patch[0], lamp: mat(0x3a74c9),
    },
    {
        // ゆうやけ: terracotta bricks, then orange and yellow tiles.
        path: worn(0xc39a6e),
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
        path: worn(0xd8c4a8),
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
        path: worn(0xa98f68),
        stages: [
            gravel('#b7a27c', ['#8a7553', '#cdbb94', '#6f8a52'], 61),
            boards(['#b08a5e', '#a07c52', '#bf9868'], '#6e5638', 62),
            tiles('#e9e4cf', '#b9d6bb', '#6f9d7c', true, 63),
        ],
        edge: mat(0x5a4630, { polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide }),
        step: mat(0xa07c52), plaza: W.patch[1], lamp: mat(0x3f7a5a),
    },
];
/** ?road=0..3 shows every road at one stage, to compare; otherwise footsteps decide. */
let roadStage: number | null = params.has('road') ? Math.max(0, Math.min(3, Number(params.get('road')))) : null;
/** Footsteps on each road node, from residents' trips. They stay when roads move: the ground remembers. */
const footfall = newFootfall();
/** Places no road reaches yet; residents gather at the nearest road end and look that way. */
let unreached: XZ[] = [];
/** Where along the roads residents stand to look at an unreached place. */
let gazing: { at: P3; look: XZ }[] = [];
function lookTowards() {
    gazing = unreached.slice(0, 2).flatMap(look => {
        let best: P3 | undefined, bestD = Infinity;
        for (const r of roads) for (const p of r.line) { const d = Math.hypot(p[0] - look[0], p[2] - look[1]); if (d < bestD) { bestD = d; best = p; } }
        return best ? [{ at: best, look }] : [];
    });
}

// ---------- the sea ----------
// The sea knows how deep it is over the island's ground: emerald in the
// shallows, deep blue further out, a moving white edge where waves meet the
// shore, and little glints of sun. The ground heights reach the sea as a
// small texture that is refreshed whenever the ground changes.
const depthData = new Uint8Array(N * N);
const depthTex = new THREE.DataTexture(depthData, N, N, THREE.RedFormat, THREE.UnsignedByteType);
depthTex.magFilter = depthTex.minFilter = THREE.LinearFilter;
const SEA = {
    time: { value: 0 },
    deep: { value: new THREE.Color(0x1a76b8) },
    shallow: { value: new THREE.Color(0x46d0c8) },
    foam: { value: new THREE.Color(0xffffff) },
};
/** Heights from -2 to 2 into 0..255, enough to place the shore within about 2cm. */
function seaKnowsGround(h: Heights) {
    for (let k = 0; k < N * N; k++) depthData[k] = Math.max(0, Math.min(255, Math.round((h[k] + 2) / 4 * 255)));
    depthTex.needsUpdate = true;
}
M.sea.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { uTime: SEA.time, uDeep: SEA.deep, uShallow: SEA.shallow, uFoam: SEA.foam, uDepth: { value: depthTex } });
    shader.vertexShader = 'varying vec3 vSeaWorld;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSeaWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = `varying vec3 vSeaWorld;
uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam; uniform sampler2D uDepth;
` + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
{
    vec2 uv = (vSeaWorld.xz + ${(SIZE / 2).toFixed(1)}) / ${SIZE.toFixed(1)};
    bool inside = all(greaterThan(uv, vec2(0.0))) && all(lessThan(uv, vec2(1.0)));
    float ground = inside ? texture2D(uDepth, uv).r * 4.0 - 2.0 : -2.0;
    float depth = clamp(-ground, 0.0, 2.0);
    vec3 water = mix(uShallow, uDeep, smoothstep(0.05, 1.4, depth));
    // Waves lap the shore: a white band that breathes in and out.
    float wave = 0.5 + 0.5 * sin(uTime * 1.6 - depth * 22.0 + sin(vSeaWorld.x * 1.3 + vSeaWorld.z) * 1.5);
    float edge = 1.0 - smoothstep(0.0, 0.2 + 0.12 * wave, depth);
    water = mix(water, uFoam, edge * 0.9);
    // A thin line of surf a little way out, rolling in towards the beach.
    float roll = fract(uTime * 0.18 + sin(vSeaWorld.x * 0.9 + vSeaWorld.z * 0.6) * 0.08);
    float surf = 1.0 - smoothstep(0.0, 0.05, abs(depth - (0.75 - roll * 0.6)));
    water = mix(water, uFoam, surf * (1.0 - roll) * 0.55 * step(0.02, depth));
    // Sun glints: tiny bright specks that come and go.
    // A few at a time, gathered in drifting patches rather than everywhere.
    float g = sin(vSeaWorld.x * 7.0 + uTime * 1.3) * sin(vSeaWorld.z * 6.0 - uTime * 1.1) * sin((vSeaWorld.x + vSeaWorld.z) * 3.3 + uTime * .7);
    float cluster = smoothstep(0.55, 1.0, sin(vSeaWorld.x * 0.35 + uTime * 0.2) * sin(vSeaWorld.z * 0.31 - uTime * 0.17));
    water += smoothstep(0.93, 0.995, g) * cluster * 0.45 * smoothstep(0.3, 1.0, depth);
    // Gentle swell: broad lighter and darker bands moving across the sea.
    water *= 0.94 + 0.06 * sin(vSeaWorld.x * 0.8 + vSeaWorld.z * 0.5 + uTime * 0.6);
    diffuseColor.rgb = water;
}`);
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
const WET = new THREE.Color(0xb59f74), COVE = new THREE.Color(0xa49a8c), SAND = new THREE.Color(0xeedfb6), ROCK = new THREE.Color(0xb7a993), MOSS = new THREE.Color(0x4f7a3c), GRASS = [new THREE.Color(0x7fae55), new THREE.Color(0x6d9e4a), new THREE.Color(0x93b862)];
/** Colours follow where the ground is going, so they never lag behind a stroke. */
function paintGround() {
    seaKnowsGround(target);
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
        c.copy(g).lerp(MOSS, Math.min(1, Math.max(0, (steep - .9) / .8))).lerp(ROCK, Math.min(.6, Math.max(0, (steep - 2.4) / 1.2)));
        // The beach fades into the grass along a wavy line, not a hard edge.
        const wobble = Math.sin(x * 1.9 + z * .7) * .06 + Math.sin(z * 2.6 - x) * .04;
        c.lerp(SAND, Math.min(1, Math.max(0, (.6 + wobble - y) / .22)));
        // Where the shore is steep it is rocky instead: a little cove of stone.
        if (y < .7 && steep > 1.1) c.lerp(COVE, Math.min(.85, (steep - 1.1) / .8) * Math.min(1, (.7 - y) / .3));
        // Darker wet sand where the waves reach.
        if (y < .12) c.lerp(WET, Math.min(1, (.12 - y) / .12) * .7);
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
/** Where the pier ends, out at sea: the traveller waits there. */
let pierEnd: XZ = [0, 9];
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
// A soft warm glow round each lamp, seen once the sun goes down.
const WARM_DOT = canvasTexture((c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, '#fff4d0'); g.addColorStop(.2, '#ffd27acc'); g.addColorStop(.55, '#ffb24a33'); g.addColorStop(1, '#ffa03000');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
}, 64);
const HALO = {
    lamp: new THREE.PointsMaterial({ size: 1.3, map: WARM_DOT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    door: new THREE.PointsMaterial({ size: .7, map: WARM_DOT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
};
// The warm patch of light a lamp throws on the paving below it.
const POOL_GEO = new THREE.PlaneGeometry(1.8, 1.8).rotateX(-Math.PI / 2);
const POOL = new THREE.MeshBasicMaterial({ map: WARM_DOT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 });
const ONE_POINT = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
const halo = (material: THREE.PointsMaterial, x: number, y: number, z: number) => {
    const p = new THREE.Points(ONE_POINT, material);
    p.position.set(x, y, z);
    return p;
};
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
            const pool = new THREE.Mesh(POOL_GEO, POOL); pool.position.y = .04;
            g.add(post, head, halo(HALO.lamp, 0, .66, 0), pool);
        } else {
            const pot = new THREE.Mesh(R.pot, pv.lamp); pot.scale.set(1.2, .9, 1.2); pot.position.y = .07;
            const leaves = new THREE.Mesh(R.pot, M.bush); leaves.position.y = .18;
            const bloom = new THREE.Mesh(G.bloom, M.bloom); bloom.scale.setScalar(.6); bloom.position.y = .26;
            g.add(pot, leaves, bloom);
        }
        roadsGroup.add(shadowy(g));
    });
}
/** One stretch of road at one stage of use. */
function pavedRun(line: P3[], stage: number, pv: Paving) {
    if (line.length < 2) return;
    if (stage === 0) {
        // A worn path: narrower, the colour of earth, no kerb.
        const path = new THREE.Mesh(ribbon(line, ROAD_HALF * 1.7, .05), pv.path);
        path.receiveShadow = true;
        roadsGroup.add(path);
        return;
    }
    // Paving with a darker kerb line, so the road reads against the grass.
    const width = ROAD_HALF * 2 * (stage === 1 ? .85 : 1);
    const edge = new THREE.Mesh(ribbon(line, width + .1, .02), pv.edge);
    const road = new THREE.Mesh(ribbon(line, width, .07), pv.stages[stage - 1]);
    edge.receiveShadow = road.receiveShadow = true;
    roadsGroup.add(edge, road);
    if (stage >= 2) parapets(line, width + .1, .03, .16);
    if (stage === 3) lamps(line, pv);
}
interface Bench { road: number; s: number; g: THREE.Group; by: object | null }
let benches: Bench[] = [];
const BENCH = { seat: new THREE.BoxGeometry(.5, .04, .16), back: new THREE.BoxGeometry(.5, .14, .03), leg: new THREE.BoxGeometry(.04, .12, .14) };
const STALL = { table: new THREE.BoxGeometry(.6, .05, .3), crate: new THREE.BoxGeometry(.14, .08, .14), awning: new THREE.BoxGeometry(.7, .03, .42) };
const STRIPES = mat(0xffffff, { map: canvasTexture((c, s) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#e8578f'; c.fillRect(i * s / 8, 0, s / 8, s); } }, 64) });
function drawRoads() {
    for (const o of roadsGroup.children) release(o);
    roadsGroup.clear();
    lifts = [];
    roadGround = shaped;
    for (const r of roads) for (const [pi, part] of r.parts.entries()) {
        const line = part.line;
        // Where this part starts on the whole road's line (later parts drop their shared first point).
        const offset = r.parts.slice(0, pi).reduce((n, q, qi) => n + q.line.length - (qi ? 1 : 0), 0) - (pi ? 1 : 0);
        if (line.length < 2) continue;
        const mid = line[line.length >> 1];
        const pv = PAVING[themeOf({ x: mid[0], z: mid[2] })];
        if (part.kind === 'road') {
            // Each stretch is paved for the footsteps it has had.
            const stages = roadStage === null ? stagesAlong(footfall, r).slice(offset, offset + line.length) : line.map(() => roadStage!);
            for (let a = 0; a < line.length - 1;) {
                let b = a + 1;
                while (b < line.length - 1 && stages[b] === stages[a]) b++;
                pavedRun(line.slice(a, b + 1), stages[a], pv);
                a = b;
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
    if (roads.length) {
        roadsGroup.add(quay);
        // A lamp on the quay, so the harbour shows at night.
        const q = new THREE.Group(); q.position.set(hx - .7, quay.position.y, hz - .3);
        const post = new THREE.Mesh(PILLAR, M.rail); post.scale.set(.35, .8, .35); post.position.y = .4;
        const head = new THREE.Mesh(LAMP_HEAD, LAMP_GLOW); head.scale.setScalar(1.3); head.position.y = .85;
        q.add(shadowy(post), head, halo(HALO.lamp, 0, .85, 0));
        roadsGroup.add(q);
    }
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
    pierEnd = [hx, hz + length - .1];
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
    // Benches beside the roads, where residents stop and sit for a while.
    benches = [];
    roads.forEach((r, ri) => {
        for (let k = 4; k < r.line.length - 3; k += 9) {
            const a = r.line[k - 1], p = r.line[k], b = r.line[k + 1];
            const len = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1, side = (k / 9) % 2 < 1 ? 1 : -1;
            const nx = -(b[2] - a[2]) / len * side, nz = (b[0] - a[0]) / len * side;
            const x = p[0] + nx * (ROAD_HALF + .3), z = p[2] + nz * (ROAD_HALF + .3), y = heightAt(shaped, x, z);
            if (Math.abs(y - p[1]) > .3 || houses.some(o => Math.hypot(o.x - x, o.z - z) < Math.max(o.w, o.d) * .7)) continue;
            const g = new THREE.Group();
            g.position.set(x, Math.max(y, p[1]), z);
            // Facing away from the road, towards the view.
            g.rotation.y = Math.atan2(nx, nz);
            const seat = new THREE.Mesh(BENCH.seat, M.wood); seat.position.y = .13;
            const back = new THREE.Mesh(BENCH.back, M.wood); back.position.set(0, .24, -.07); back.rotation.x = -.15;
            g.add(seat, back);
            for (const lx of [-.2, .2]) { const leg = new THREE.Mesh(BENCH.leg, M.rail); leg.position.set(lx, .06, 0); g.add(leg); }
            roadsGroup.add(shadowy(g));
            benches.push({ road: ri, s: k, g, by: null });
        }
    });
    // A market stall on the quay once the town has a road: a striped awning over boxes of fruit.
    if (roads.length) {
        const st = new THREE.Group();
        st.position.set(hx + .75, quay.position.y, hz - .2);
        st.rotation.y = -.5;
        const table = new THREE.Mesh(STALL.table, M.wood); table.position.y = .18;
        st.add(table);
        for (const [i, px] of [-.16, 0, .16].entries()) {
            const crate = new THREE.Mesh(STALL.crate, M.trunk); crate.position.set(px, .3, .03); st.add(crate);
            for (let f = 0; f < 3; f++) { const fruit = new THREE.Mesh(R.pot, BRIGHT[[0, 1, 3][i]]); fruit.scale.setScalar(.45); fruit.position.set(px + (f - 1) * .04, .36, .03 + (f % 2) * .03); st.add(fruit); }
        }
        for (const lx of [-.28, .28]) { const post = new THREE.Mesh(PILLAR, M.curb); post.scale.set(.25, .7, .25); post.position.set(lx, .35, -.12); st.add(post); }
        const awning = new THREE.Mesh(STALL.awning, STRIPES); awning.position.set(0, .68, 0); awning.rotation.x = .3;
        st.add(awning);
        roadsGroup.add(shadowy(st));
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
    shutter: new THREE.BoxGeometry(.08, .22, .025),
    glass: new THREE.BoxGeometry(.13, .22, .02),
    arch: new THREE.CylinderGeometry(.065, .065, .02, 12, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2),
    sill: new THREE.BoxGeometry(.2, .03, .06),
    box: new THREE.BoxGeometry(.22, .06, .07),
    door: new RoundedBoxGeometry(.2, .28, .04, 2, .02),
    doorArch: new THREE.CylinderGeometry(.1, .1, .04, 14, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2),
    balcony: new THREE.BoxGeometry(.56, .04, .22),
    rail: new THREE.BoxGeometry(.56, .12, .02),
    railSide: new THREE.BoxGeometry(.02, .12, .22),
    awning: new THREE.BoxGeometry(.34, .025, .2),
    dome: new THREE.SphereGeometry(.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    bloom: new THREE.IcosahedronGeometry(.1, 1),
};
const lathe = (pts: [number, number][], segments = 28) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segments);
// Crisp whitewashed corners, softened just enough to stay toy-like.
const floorGeo = (w: number, h: number, d: number) => {
    const k = `${w.toFixed(2)},${h},${d.toFixed(2)}`;
    if (!G.floor.has(k)) G.floor.set(k, new RoundedBoxGeometry(w, h, d, 3, Math.min(.09, Math.min(w, h, d) * .3)));
    return G.floor.get(k)!;
};

function footing(o: { x: number; z: number; w: number; d: number }) {
    const ys = [-1, 1].flatMap(a => [-1, 1].map(b => heightAt(shaped, o.x + a * o.w * .5, o.z + b * o.d * .5)));
    return { low: Math.min(...ys), high: Math.max(...ys) };
}

const roundGeo = (rad: number) => {
    const k = `round${rad.toFixed(2)}`;
    if (!G.floor.has(k)) G.floor.set(k, lathe([[0, 0], [rad, 0], [rad * 1.03, .25], [rad, .5], [rad * .97, .55], [0, .55]], 22));
    return G.floor.get(k)!;
};
const R = {
    slab: new THREE.CylinderGeometry(1, 1, .07, 22),
    vault: new THREE.CylinderGeometry(1, 1, 1, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2),
    turret: lathe([[0, 0], [.14, 0], [.16, .3], [.12, .5], [0, .5]], 14),
    pot: new THREE.IcosahedronGeometry(.08, 1),
    parasol: new THREE.ConeGeometry(.26, .1, 12),
};
/**
 * Window glass is shared by every house, so evening can light the whole town
 * at once: most windows light at dusk, the rest once it is night.
 */
const WINDOW = {
    early: mat(0x2f4a5c, { roughness: .35, emissive: 0xffb45a, emissiveIntensity: 0 }),
    late: mat(0x2f4a5c, { roughness: .35, emissive: 0xffc878, emissiveIntensity: 0 }),
};
// Shutters, doors and trims in the colours painted villages use, one set per house.
const TRIMS = [0x4e8a5c, 0x3a74c9, 0x2fa3a0, 0xe0663f, 0x6b5fb5, 0xf2b630].map(c => mat(c));
type Roof = 'terrace' | 'dome' | 'vault' | 'turret';
const LAUNDRY = { line: new THREE.BoxGeometry(1, .01, .01), cloth: new THREE.BoxGeometry(.12, .14, .01) };
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
 * One window on a wall facing +z: arched glass between shutters on a sill,
 * sometimes with a box of flowers.
 */
function addWindow(to: THREE.Object3D, x: number, y: number, z: number, turn: number, trim: THREE.Material, r: () => number) {
    const w = new THREE.Group();
    w.position.set(x, y, z);
    w.rotation.y = turn;
    const glass = r() < .7 ? WINDOW.early : WINDOW.late;
    const gl = new THREE.Mesh(G.glass, glass);
    const top = new THREE.Mesh(G.arch, glass); top.position.y = .11;
    const sill = new THREE.Mesh(G.sill, M.curb); sill.position.set(0, -.12, .02);
    w.add(gl, top, sill);
    for (const side of [-1, 1]) { const s = new THREE.Mesh(G.shutter, trim); s.position.set(side * .11, 0, .01); w.add(s); }
    if (r() < .3) {
        const box = new THREE.Mesh(G.box, trim); box.position.set(0, -.15, .05); w.add(box);
        for (const bx of [-.07, 0, .07]) { const b = new THREE.Mesh(G.bloom, r() < .5 ? M.bloom : M.bush); b.scale.setScalar(.45); b.position.set(bx, -.1, .06); w.add(b); }
    }
    to.add(w);
}

/**
 * A house, built at the origin; `userData.lift` is how far its floor sits above the ground at its middle.
 * Houses are whitewashed or coloured blocks, or round like a grown tower, two
 * or three storeys stepping back and leaning a little, each topped differently.
 * Windows look out on every side, so the town lights up all round at night.
 */
function buildHouse(o: House): THREE.Group {
    builds.house++;
    const g = new THREE.Group();
    const r = rng(o.id * 31);
    const round = o.id % 3 === 0;
    const th = THEMES[themeOf(o)];
    const trim = TRIMS[(o.id * 7 + o.tint) % TRIMS.length];
    // About one house in five is a ふしぎ house: a patchwork wall or a dotted dome.
    const wonder = th.wonder(o.id);
    const roof: Roof = wonder === 'dots' ? 'dome' : (['terrace', 'dome', 'vault', 'turret', 'terrace'] as const)[Math.floor(r() * 5)];
    let y = 0, w = o.w, d = o.d, dx = 0, dz = 0, turn = 0;
    for (let f = 0; f < o.floors; f++) {
        const wall = wonder === 'patch' && f === 0 ? W.patch[o.id % 2] : th.walls[(o.tint + f * (r() < .3 ? 1 : 0)) % 5];
        const rad = Math.min(w, d) / 2;
        // Each storey turns a little on the one below, so a tall house looks
        // grown rather than stacked.
        const storey = new THREE.Group();
        storey.position.set(dx, y, dz);
        storey.rotation.y = turn;
        g.add(storey);
        const body = new THREE.Mesh(round ? roundGeo(rad) : floorGeo(w, .55, d), wall);
        body.position.y = round ? 0 : .275;
        storey.add(body);
        // A thin ledge where one storey meets the next.
        const ledge = round ? new THREE.Mesh(R.slab, M.curb) : new THREE.Mesh(floorGeo(w + .06, .045, d + .06), M.curb);
        if (round) ledge.scale.set(rad + .03, .65, rad + .03);
        ledge.position.y = .55;
        storey.add(ledge);
        const front = (round ? rad : d / 2) + .01, span = round ? rad * .9 : w;
        const balcony = f > 0 && !round && w > .75 && r() < .4;
        if (f === 0) {
            // An arched door in the house's own colour, a lamp beside it, sometimes an awning.
            const door = new THREE.Mesh(G.door, trim); door.position.set(span * .18, .14, front);
            const arch = new THREE.Mesh(G.doorArch, trim); arch.position.set(span * .18, .28, front);
            const lamp = new THREE.Mesh(LAMP_HEAD, LAMP_GLOW); lamp.scale.setScalar(.6); lamp.position.set(span * .18 + .17, .33, front + .04);
            storey.add(door, arch, lamp);
            g.userData.doorLamp = [span * .18 + .17, .33, front + .04];
            if (r() < .45) { const a = new THREE.Mesh(G.awning, trim); a.position.set(span * .18, .42, front + .08); a.rotation.x = .35; storey.add(a); }
            addWindow(storey, -span * .22, .3, front, 0, trim, r);
        } else if (balcony) {
            // A balcony with a railing, its glass door behind.
            const slab = new THREE.Mesh(G.balcony, M.curb); slab.position.set(0, .02, front + .1);
            const rail = new THREE.Mesh(G.rail, trim); rail.position.set(0, .1, front + .2);
            storey.add(slab, rail);
            for (const side of [-1, 1]) { const rs = new THREE.Mesh(G.railSide, trim); rs.position.set(side * .27, .1, front + .1); storey.add(rs); }
            const glass = new THREE.Mesh(G.glass, WINDOW.early); glass.scale.set(1.2, 1.4, 1); glass.position.set(0, .2, front); storey.add(glass);
            if (r() < .6) for (const bx of [-.2, .2]) { const b = new THREE.Mesh(R.pot, M.bush); b.position.set(bx, .09, front + .1); storey.add(b); }
        } else for (const wx of [-span * .24, span * .24]) addWindow(storey, wx, .3, front, 0, trim, r);
        // The sides and back, so the house is never blank from the other side.
        if (round) for (const a of [Math.PI / 2, Math.PI, -Math.PI / 2]) addWindow(storey, Math.sin(a) * (rad + .01), .3, Math.cos(a) * (rad + .01), a, trim, r);
        else {
            for (const side of [-1, 1]) if (d > .7) addWindow(storey, side * (w / 2 + .01), .3, 0, side * Math.PI / 2, trim, r);
            addWindow(storey, (r() - .5) * w * .4, .3, -d / 2 - .01, Math.PI, trim, r);
        }
        turn += (r() - .5) * .3;
        y += .55;
        // Upper floors step back and sit a little off centre, as if grown.
        w *= .86 + r() * .1; d *= .82 + r() * .1;
        dx += (r() - .5) * .12; dz -= .04 + r() * .05;
    }
    const top = new THREE.Group();
    top.position.set(dx, y, dz);
    top.rotation.y = turn;
    g.add(top);
    const rad = Math.min(w, d) / 2 / .84;
    const slab = round ? new THREE.Mesh(R.slab, M.roof) : new THREE.Mesh(floorGeo(w + .08, .07, d + .08), M.roof);
    if (round) slab.scale.set(Math.min(w, d) / 2 + .05, 1, Math.min(w, d) / 2 + .05);
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
        // A roof terrace: potted plants and a parasol, and a low parapet round it.
        for (const [px, pz] of [[-.25, .2], [.25, .22], [-.2, -.2]]) {
            const pot = new THREE.Mesh(R.pot, M.bush); pot.position.set(px * rad * 1.6, .1, pz * rad * 1.6); top.add(pot);
        }
        if (r() < .5) {
            const pole = new THREE.Mesh(PILLAR, M.base); pole.scale.set(.25, .35, .25); pole.position.set(.1, .22, 0); top.add(pole);
            const para = new THREE.Mesh(R.parasol, trim); para.position.set(.1, .42, 0); top.add(para);
        } else {
            // Washing hung out to dry on a line across the roof.
            const reach = Math.max(.2, w / 2 - .12);
            for (const lx of [-reach, reach]) { const post = new THREE.Mesh(PILLAR, M.curb); post.scale.set(.18, .32, .18); post.position.set(lx, .2, -.05); top.add(post); }
            const line = new THREE.Mesh(LAUNDRY.line, M.curb); line.scale.x = reach * 2; line.position.set(0, .34, -.05); top.add(line);
            for (let i = 0; i < 3; i++) {
                const cloth = new THREE.Mesh(LAUNDRY.cloth, i === 1 ? M.curb : BRIGHT[(o.id + i) % 6]);
                cloth.position.set(-reach * .6 + i * reach * .6, .26, -.05); cloth.scale.y = .8 + (i % 2) * .4; top.add(cloth);
            }
        }
    }
    if (r() < .45) {
        // Bougainvillea spilling down a corner.
        for (let i = 0; i < 6; i++) {
            const b = new THREE.Mesh(G.bloom, M.bloom);
            b.position.set(-o.w * .45 + r() * .1, .15 + r() * y * .8, o.d * .3 + r() * .2);
            b.scale.setScalar(.8 + r() * .6);
            g.add(b);
        }
    }
    shadowy(merge(g));
    const [lx, ly, lz] = g.userData.doorLamp as number[];
    g.add(halo(HALO.door, lx, ly, lz));
    setFooting(g, o);
    return g;
}

/** Dry-stone terrace walls, as hillside villages build them, instead of a plain white block. */
const TERRACE = mat(0xffffff, { map: canvasTexture((c, s) => {
    const r = rng(81);
    c.fillStyle = '#b9a98c'; c.fillRect(0, 0, s, s);
    const rows = 7;
    for (let j = 0; j < rows; j++) {
        let x = -r() * 30;
        while (x < s) {
            const w = 26 + r() * 30, h = s / rows;
            c.fillStyle = ['#e4d8bf', '#d8c9aa', '#efe5cf', '#cdbd9c'][Math.floor(r() * 4)];
            c.beginPath(); c.roundRect(x + 2, j * h + 2, w - 4, h - 4, 7); c.fill();
            x += w;
        }
    }
}) });
/**
 * The stone base a house stands on down the slope, kept apart from the house
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
    const b = new THREE.Mesh(floorGeo(o.w, steps / 4, o.d), TERRACE);
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
            for (const wx of [-.3, .3]) { const gl = new THREE.Mesh(G.glass, WINDOW.early); gl.position.set(wx, .42, .46); gl.rotation.y = wx * 1.1; g.add(gl); }
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
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .3, 16), LIGHTHOUSE); lamp.position.y = 2.65; g.add(lamp);
        const cap = new THREE.Mesh(G.dome, M.walls[4]); cap.position.y = 2.8; g.add(cap);
    } else if (s.kind === 'tower') {
        // A tall house-tower that leans and swells like something grown.
        g.add(new THREE.Mesh(lathe([[0, 0], [.6, 0], [.66, .5], [.55, 1.2], [.6, 1.9], [.46, 2.6], [.5, 3.1], [.2, 3.5], [0, 3.6]]), M.walls[3]));
        for (const h of [.8, 1.6, 2.4]) {
            const w = new THREE.Mesh(G.glass, WINDOW.early); w.position.set(0, h, .58 - (h > 2 ? .1 : 0)); g.add(w);
        }
    } else {
        const body = new THREE.Mesh(floorGeo(1.2, .8, .9), M.walls[0]); body.position.y = .4; g.add(body);
        const bell = new THREE.Mesh(floorGeo(.4, 1.3, .4), M.walls[0]); bell.position.set(.5, .65, -.2); g.add(bell);
        const dome = new THREE.Mesh(G.dome, M.dome); dome.scale.setScalar(1.4); dome.position.set(-.15, .8, 0); g.add(dome);
        const top = new THREE.Mesh(G.dome, M.dome); top.position.set(.5, 1.3, -.2); g.add(top);
    }
    shadowy(merge(g));
    if (s.kind === 'lighthouse') {
        // After dark the lantern sweeps a beam out over the sea.
        const beam = new THREE.Mesh(BEAM_GEO, BEAM);
        beam.name = 'beam';
        beam.position.y = 2.65;
        g.add(beam, halo(HALO.lamp, 0, 2.65, 0));
    }
    return g;
}
const LIGHTHOUSE = mat(0xffe08a, { emissive: 0xffc040, emissiveIntensity: .6 });
// A long cone lying on its side, its tip at the lantern, brightest near it.
const BEAM_GEO = (() => {
    const geo = new THREE.ConeGeometry(1.1, 9, 20, 1, true).translate(0, -4.5, 0).rotateZ(Math.PI / 2);
    const pos = geo.attributes.position, fade = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { const k = Math.max(0, 1 - pos.getX(i) / 9); fade.fill(k * k, i * 3, i * 3 + 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(fade, 3));
    return geo;
})();
const BEAM = new THREE.MeshBasicMaterial({ color: 0xfff0b8, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

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
    const places: XZ[] = drawMode
        ? [...specials.filter(s => s.kind === 'home').map(s => [s.x, s.z] as XZ), ...drawn]
        : [...specials.map(s => [s.x, s.z] as XZ), ...lookout()];
    const net = network(base, harbour(), places);
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
    // Which places no road reaches now, so residents can look towards them.
    unreached = walkTrips(footfall, roads, homesOf(), placesOf(), 0, rand).unreached;
    lookTowards();
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
    scatterMeadow();
    placeGlimmers();
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
        // A tree that has grown is drawn bigger; the view eases to it.
        v.size = size;
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
/** Where trips start: every house, the town's and the child's. */
const homesOf = (): XZ[] => [...houses.map(o => [o.x, o.z] as XZ), ...specials.filter(s => s.kind === 'home').map(s => [s.x, s.z] as XZ)];
/** Where residents like to go: everything the child placed, and the harbour. */
const placesOf = (): XZ[] => [...specials.map(s => [s.x, s.z] as XZ), harbour()];
/** A road's look, stage by stage, so it is redrawn only when its paving changes. */
const paving = () => (roadStage === null ? roads.map(r => stagesAlong(footfall, r).join('')).join('|') : '');
function grow(now: number) {
    // Residents go about: a third of them make a trip each step.
    const before = paving();
    const went = walkTrips(footfall, roads, homesOf(), placesOf(), Math.ceil(townsfolk() / 3), rand);
    unreached = went.unreached;
    lookTowards();
    // One of those trips is seen: a resident sets off along the roads to the place.
    if (now > 0 && went.routes.length) setOff(went.routes[0]);
    if (paving() !== before) drawRoads();
    // In the app the child's house grows with learning time; here, every few ticks.
    const young = specials.find(s => s.kind === 'home' && (s.stage ?? 3) < 3);
    if (young && ++ticks % 5 === 0) {
        young.stage = (young.stage ?? 0) + 1;
        if (now > 0) { chime(520 + young.stage * 130, .04, .35); burst(young.x, heightAt(shaped, young.x, young.z) + 1, young.z, 30, .8); }
        redrawSpecials();
    }
    const length = roads.reduce((s, r) => s + r.line.length * .25, 0);
    let built = false;
    if (houses.length < Math.min(60, length * .9)) {
        // New houses go up where people pass, if anyone has passed yet.
        const busy = busySpot(footfall, roads, rand);
        const o = (busy && houseSpot(cut, roads, houses, rand, nextId, now, { x: busy[0], z: busy[1], reach: 2.5 })) || houseSpot(cut, roads, houses, rand, nextId, now);
        nextId++;
        if (o && specials.every(s => Math.hypot(s.x - o.x, s.z - o.z) > 1)) {
            houses.push(o);
            built = true;
            if (now > 0) { chime(780 + rand() * 240, .025, .22); burst(o.x, heightAt(shaped, o.x, o.z) + .6, o.z, 14, .6); }
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
            if (now > 0) { chime(660 + rand() * 200, .02, .2); burst(houses[i].x, heightAt(shaped, houses[i].x, houses[i].z) + houses[i].floors * .55, houses[i].z, 10, .4); }
        }
    }
    // As many trees as the land has room for: a small island is not a jungle.
    let land = 0;
    for (let k = 0; k < N * N; k++) if (shaped[k] > .35) land++;
    const room = Math.min(70, Math.round(land * RES * RES * .5));
    if (trees.length > room) trees = trees.slice(0, room);
    // Trees keep growing: a sapling planted early is a big tree many steps later.
    for (let i = 0; i < 3 && trees.length; i++) {
        const k = Math.floor(rand() * trees.length), t = trees[k];
        const most = t.kind === 'pine' || t.kind === 'olive' ? 1.8 : t.kind === 'cypress' ? 1.5 : 1.2;
        if (t.size < most) trees[k] = { ...t, size: Math.min(most, t.size + .07) };
    }
    for (let i = 0; i < 2 && trees.length < room; i++) {
        const t = treeSpot(shaped, roads, houses, trees, rand, nextId++, now);
        if (t && specials.every(s => Math.hypot(s.x - t.x, s.z - t.z) > .9)) trees.push(t);
    }
    sync(now);
}

function updateStat() {
    const kinds = new Set(roads.flatMap(r => r.parts.map(p => p.kind)));
    const extra = [kinds.has('stair') && 'かいだん', kinds.has('bridge') && 'はし', kinds.has('lift') && 'ケーブルカー'].filter(Boolean).join('・');
    stat.textContent = `${byLearning ? `まなんだ ${sessions}かい${buds.length ? ` · つぼみ ${buds.length}` : ''} · ` : ''}みち ${roads.length}${extra ? `（${extra}）` : ''} · いえ ${houses.length} · き ${trees.length} · すむ ${townsfolk()}${placing ? ` · ${placing === 'home' ? 'たね' : '★'}を おく ばしょを タップ` : ''}`;
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
const townsfolk = () => Math.min(quality >= 2 ? 8 : 18, 3 + Math.floor(houses.length / 3) + movedIn);
/** Travellers who came by boat and now live in a house the child grew. */
let movedIn = 0;
// What a resident says when two meet: a little picture in a bubble, no words.
const SAYS = ['♪', '♥', '!', '☀', '★', '?'];
const BUBBLES = SAYS.map(say => new THREE.SpriteMaterial({ map: canvasTexture((c, s) => {
    c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(s / 2, s * .44, s * .42, s * .36, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(s * .4, s * .74); c.lineTo(s * .5, s * .95); c.lineTo(s * .56, s * .72); c.fill();
    c.fillStyle = say === '♥' ? '#e8578f' : say === '★' || say === '☀' ? '#f2b630' : '#3a74c9';
    c.font = `bold ${s * .48}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(say, s / 2, s * .46);
}, 96), depthTest: false, transparent: true }));
function makeBubble(i: number) {
    const b = new THREE.Sprite(BUBBLES[i % BUBBLES.length]);
    b.scale.setScalar(.55);
    b.visible = false;
    b.renderOrder = 3;
    scene.add(b);
    return b;
}
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
        home: -1, homeS: 0, mode: 'walk' as 'walk' | 'in' | 'out' | 'sit' | 'chat', t: 0, rest: 4 + i % 5, from: new THREE.Vector3(), door: new THREE.Vector3(),
        // Sitting on a bench or chatting with a neighbour met on the road; `cool` keeps it from happening every few steps.
        bench: null as Bench | null, cool: 3 + i % 6, bubble: makeBubble(i),
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

// ---------- meadow, rocks, clouds, birds ----------
// Small things that make the island feel lived in: tufts of grass and wild
// flowers on the open slopes, rocks along the waterline, a few slow clouds
// whose shadows drift over the hills, and seabirds turning above.
const TUFT = (() => {
    const blades = [0, 1, 2].map(i => new THREE.ConeGeometry(.035, .22, 4).translate(Math.cos(i * 2.1) * .04, .11, Math.sin(i * 2.1) * .04).rotateZ((i - 1) * .25));
    const g = mergeGeometries(blades); blades.forEach(b => b.dispose());
    return g;
})();
const tufts = new THREE.InstancedMesh(TUFT, mat(0xffffff), 700);
const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.055, 0), mat(0xffffff, { emissive: 0x221a22 }), 260);
const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.22, 0), mat(0xb3aa98, { flatShading: true }), 70);
for (const m of [tufts, flowers, rocks]) { m.castShadow = m === rocks; m.receiveShadow = true; scene.add(m); }
const GRASS_TONES = ['#5f9a3f', '#76ad4b', '#4f8a38', '#8fbf5a'].map(c => new THREE.Color(c));
const FLOWER_TONES = ['#ffd6e8', '#fff3a0', '#ffffff', '#d9c6ff', '#ff9fc4'].map(c => new THREE.Color(c));
/** Scatter the meadow anew on the settled ground: clear of roads, houses and the shore. */
function scatterMeadow() {
    const r = rng(17), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    // Ground the roads run over, marked once on the grid, so each try is a lookup.
    const onRoad = new Uint8Array(N * N);
    for (const rd of roads) for (const [px, , pz] of rd.line) {
        const ci = Math.round((px + SIZE / 2) / RES), cj = Math.round((pz + SIZE / 2) / RES);
        for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
            const i = ci + di, j = cj + dj;
            if (i >= 0 && j >= 0 && i < N && j < N) onRoad[i + j * N] = 1;
        }
    }
    const clear = (x: number, z: number) => !onRoad[Math.round((x + SIZE / 2) / RES) + Math.round((z + SIZE / 2) / RES) * N] && !houses.some(o => Math.hypot(o.x - x, o.z - z) < Math.max(o.w, o.d) * .7) && specials.every(sp => Math.hypot(sp.x - x, sp.z - z) > 1);
    const place = (mesh: THREE.InstancedMesh, want: (y: number, slope: number) => boolean, scale: () => number, tone: (i: number) => THREE.Color) => {
        let n = 0;
        for (let tries = 0; tries < mesh.count * 6 && n < mesh.count; tries++) {
            const x = (r() - .5) * (SIZE - 1), z = (r() - .5) * (SIZE - 1), y = heightAt(shaped, x, z);
            if (!want(y, slopeAt(shaped, x, z)) || !clear(x, z)) continue;
            q.setFromAxisAngle(up, r() * Math.PI * 2);
            const k = scale();
            m.compose(new THREE.Vector3(x, y - .02, z), q, new THREE.Vector3(k, k, k));
            mesh.setMatrixAt(n, m); mesh.setColorAt(n, tone(n)); n++;
        }
        // Unused ones are tucked away under the sea.
        m.makeTranslation(0, -50, 0);
        for (let i = n; i < mesh.count; i++) mesh.setMatrixAt(i, m);
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    place(tufts, (y, sl) => y > .45 && sl < 1.3, () => .8 + r() * .7, i => GRASS_TONES[i % GRASS_TONES.length]);
    place(flowers, (y, sl) => y > .5 && sl < .9, () => .8 + r() * .6, i => FLOWER_TONES[i % FLOWER_TONES.length]);
    place(rocks, y => y > -.25 && y < .22, () => .6 + r() * 1.1, () => new THREE.Color(0xffffff));
    dressBeach(clear);
}
// ---------- the beach ----------
// On flat sand the island sets out parasols and towels, now and then a
// sandcastle or a ball, and shells along the wet sand.
const beach = new THREE.Group();
scene.add(beach);
let beachSpots: XZ[] = [];
const BEACH = {
    parasol: new THREE.ConeGeometry(.42, .16, 10), towel: new THREE.BoxGeometry(.3, .015, .55),
    castle: new THREE.CylinderGeometry(.09, .11, .12, 8), shell: new THREE.IcosahedronGeometry(.035, 0), ball: new THREE.SphereGeometry(.08, 12, 8),
};
const SANDY = mat(0xe8d4a4), SHELL = [mat(0xffe4ec), mat(0xfff8ee), mat(0xffd2b8)];
function dressBeach(clear: (x: number, z: number) => boolean) {
    for (const o of beach.children) release(o);
    beach.clear();
    const r = rng(23), g = new THREE.Group(), [hx, hz] = harbour(), spots: XZ[] = [];
    for (let tries = 0; tries < 2500 && spots.length < 5; tries++) {
        const a = r() * Math.PI * 2, d = 3 + r() * 6.8, x = Math.cos(a) * d, z = Math.sin(a) * d, y = heightAt(shaped, x, z);
        if (y < .1 || y > .48 || slopeAt(shaped, x, z) > .9 || !clear(x, z) || Math.hypot(x - hx, z - hz) < 2.2) continue;
        if (spots.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 2.2)) continue;
        spots.push([x, z]);
        const spot = new THREE.Group(), k = spots.length;
        beachSpots = spots;
        spot.position.set(x, y, z);
        spot.rotation.y = Math.atan2(x, z);
        const pole = new THREE.Mesh(PILLAR, M.curb); pole.scale.set(.25, .62, .25); pole.position.y = .31; pole.rotation.z = .12;
        const top = new THREE.Mesh(BEACH.parasol, BRIGHT[k % 6]); top.position.set(.04, .64, 0); top.rotation.z = .12;
        const towel = new THREE.Mesh(BEACH.towel, BRIGHT[(k + 2) % 6]); towel.position.set(.32, .01, .05); towel.rotation.y = .3;
        const tip = new THREE.Mesh(BEACH.parasol, M.curb); tip.scale.setScalar(.45); tip.position.set(.05, .7, 0); tip.rotation.z = .12;
        spot.add(pole, top, tip, towel);
        if (k % 2) for (let i = 0; i < 3; i++) {
            const c = new THREE.Mesh(BEACH.castle, SANDY); c.position.set(-.4 + i * .1, .06 + (i === 1 ? .1 : 0), .3); c.scale.setScalar(i === 1 ? .8 : 1); spot.add(c);
        } else { const b = new THREE.Mesh(BEACH.ball, W.patch[k % 2]); b.position.set(-.35, .08, .25); spot.add(b); }
        g.add(spot);
    }
    for (let n = 0, tries = 0; tries < 600 && n < 24; tries++) {
        const a = r() * Math.PI * 2, d = 4 + r() * 6, x = Math.cos(a) * d, z = Math.sin(a) * d, y = heightAt(shaped, x, z);
        if (y < .02 || y > .14 || !clear(x, z)) continue;
        const sh = new THREE.Mesh(BEACH.shell, SHELL[n % 3]); sh.position.set(x, y + .01, z); sh.scale.set(1, .5, 1.3); g.add(sh); n++;
    }
    beach.add(shadowy(merge(g)));
}
const CLOUD = mat(0xffffff, { roughness: 1, transparent: true, opacity: .92 });
const clouds = Array.from({ length: 5 }, (_, i) => {
    const r = rng(40 + i), g = new THREE.Group();
    for (let k = 0; k < 4; k++) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(.9 + r() * .7, 2), CLOUD);
        puff.position.set((k - 1.5) * .9, r() * .4, (r() - .5) * .8);
        puff.scale.y = .6;
        g.add(puff);
    }
    g.scale.setScalar(.55 + r() * .25);
    shadowy(g);
    scene.add(g);
    // They sail round the island over the sea, below the camera, never across the view of the town.
    return { g, angle: i / 5 * Math.PI * 2 + r(), radius: 14 + r() * 5, height: 4.5 + r() * 2, speed: .015 + r() * .01 };
});
const birds = Array.from({ length: 4 }, (_, i) => {
    const g = new THREE.Group();
    const wing = new THREE.BoxGeometry(.32, .02, .1);
    for (const side of [-1, 1]) { const w = new THREE.Mesh(wing, mat(0xffffff)); w.position.x = side * .16; w.name = side < 0 ? 'left' : 'right'; g.add(w); }
    scene.add(g);
    return { g, radius: 6 + i * 1.6, height: 6.5 + i * .7, speed: .18 + i * .04, phase: i * 1.7 };
});
// Out at sea: sailing boats going round the island, and buoys bobbing.
const sailboats = [0, 1].map(i => {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new RoundedBoxGeometry(.36, .16, .9, 2, .06), BRIGHT[i * 2 + 2]); hull.position.y = .06;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(.3, .02, .7), M.wood); deck.position.y = .15;
    const mast = new THREE.Mesh(PILLAR, M.curb); mast.scale.set(.3, 1.2, .3); mast.position.y = .75;
    const sailShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, 1), new THREE.Vector2(.55, 0)]);
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape).rotateY(Math.PI / 2), mat(i ? 0xffffff : 0xfff1d6, { side: THREE.DoubleSide }));
    sail.position.set(0, .22, -.05);
    g.add(hull, deck, mast, sail);
    scene.add(shadowy(g));
    return { g, radius: 10.6 + i * 1.4, speed: .05 - i * .012, angle: i * 2.6 + 1 };
});
const buoys = [0, 1, 2, 3].map(i => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(BEACH.ball, i % 2 ? BRIGHT[0] : BRIGHT[1]); body.scale.set(1.6, 1.2, 1.6);
    const band = new THREE.Mesh(new THREE.TorusGeometry(.12, .025, 6, 14).rotateX(Math.PI / 2), M.curb); band.position.y = .02;
    const pole = new THREE.Mesh(PILLAR, M.rail); pole.scale.set(.2, .3, .2); pole.position.y = .18;
    g.add(body, band, pole);
    scene.add(g);
    const a = i / 4 * Math.PI * 2 + .6;
    return { g, x: Math.cos(a) * 10.5, z: Math.sin(a) * 10.5, phase: i * 1.3 };
});
function moveSky(dt: number, now: number) {
    for (const b of sailboats) {
        b.angle += b.speed * dt;
        b.g.position.set(Math.cos(b.angle) * b.radius, Math.sin(now / 800 + b.angle * 9) * .04, Math.sin(b.angle) * b.radius);
        b.g.rotation.set(0, -b.angle, Math.sin(now / 1000 + b.radius) * .06);
    }
    for (const b of buoys) {
        b.g.position.set(b.x, .03 + Math.sin(now / 700 + b.phase) * .05, b.z);
        b.g.rotation.z = Math.sin(now / 900 + b.phase) * .15;
    }
    for (const c of clouds) {
        c.angle += c.speed * dt;
        c.g.position.set(Math.cos(c.angle) * c.radius, c.height, Math.sin(c.angle) * c.radius);
        c.g.visible = quality < 2;
    }
    for (const b of birds) {
        const a = now / 1000 * b.speed + b.phase;
        b.g.position.set(Math.cos(a) * b.radius, b.height + Math.sin(a * 3) * .4, Math.sin(a) * b.radius);
        b.g.rotation.y = -a;
        const flap = Math.sin(now / 140 + b.phase) * .5;
        b.g.getObjectByName('left')!.rotation.z = flap; b.g.getObjectByName('right')!.rotation.z = -flap;
    }
}

// ---------- きらきら ----------
// A small pool of sparkles: they fly up from whatever just happened and fade.
const SPARKS = 220;
const sparkPos = new Float32Array(SPARKS * 3), sparkCol = new Float32Array(SPARKS * 3);
const sparkVel = new Float32Array(SPARKS * 3), sparkLife = new Float32Array(SPARKS);
const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
// Each sparkle is a soft round glow, big enough to see from the whole-island view.
const GLOW_DOT = canvasTexture((c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.35, '#ffffffcc'); g.addColorStop(1, '#ffffff00');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
}, 64);
const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: .45, map: GLOW_DOT, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
sparks.frustumCulled = false;
scene.add(sparks);
let nextSpark = 0;
const SPARK_COLOURS = ['#ffe066', '#ff8fc4', '#7ff0c0', '#ffffff', '#c7a6ff'].map(c => new THREE.Color(c));
function burst(x: number, y: number, z: number, count: number, spread = 1) {
    for (let i = 0; i < count; i++) {
        const k = nextSpark++ % SPARKS, a = Math.random() * Math.PI * 2, up = .6 + Math.random();
        sparkPos.set([x, y, z], k * 3);
        sparkVel.set([Math.cos(a) * spread * (.4 + Math.random()), up * 2.2, Math.sin(a) * spread * (.4 + Math.random())], k * 3);
        const c = SPARK_COLOURS[k % SPARK_COLOURS.length];
        sparkCol.set([c.r, c.g, c.b], k * 3);
        sparkLife[k] = 1;
    }
}
function moveSparks(dt: number) {
    for (let k = 0; k < SPARKS; k++) {
        if (sparkLife[k] <= 0) continue;
        sparkLife[k] -= dt * 1.1;
        sparkVel[k * 3 + 1] -= dt * 3.2;
        for (let a = 0; a < 3; a++) sparkPos[k * 3 + a] += sparkVel[k * 3 + a] * dt;
        // Fading: colour toward black, which adds nothing.
        const f = Math.max(0, sparkLife[k]) / (sparkLife[k] + dt * 1.1 || 1);
        for (let a = 0; a < 3; a++) sparkCol[k * 3 + a] *= f;
        if (sparkLife[k] <= 0) sparkPos.set([0, -50, 0], k * 3);
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.attributes.color.needsUpdate = true;
}

// ---------- つぼみ: what learning brings, opened by the child's own finger ----------
// Finishing a learning session does not change the island by itself. Buds
// come up where it is ready to grow (the young seed, the busiest roadside),
// and the child taps each one open; then that growth happens, one thing after
// another, in front of them.
interface Bud { g: THREE.Group; x: number; z: number; steps: number; phase: number }
let buds: Bud[] = [];
const budsGroup = new THREE.Group();
scene.add(budsGroup);
const BUD = {
    bulb: new THREE.SphereGeometry(.2, 16, 12).scale(1, 1.25, 1),
    sepal: new THREE.ConeGeometry(.09, .28, 6).translate(0, .14, 0),
    stem: new THREE.CylinderGeometry(.025, .03, .3, 6).translate(0, .15, 0),
    reach: new THREE.SphereGeometry(.55, 8, 6),
    unseen: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    // Dotted like a ふしぎな木, and glowing a little, so it is found from far off.
    glow: mat(0xffffff, { map: (W.crown as THREE.MeshStandardMaterial).map, emissive: 0xffc8ec, emissiveIntensity: .45 }),
};
function makeBud(x: number, z: number, steps: number): Bud {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(BUD.stem, M.bush);
    const bulb = new THREE.Mesh(BUD.bulb, BUD.glow); bulb.position.y = .45; bulb.name = 'bulb';
    g.add(stem, bulb);
    for (let i = 0; i < 4; i++) {
        const sepal = new THREE.Mesh(BUD.sepal, M.bush);
        sepal.position.y = .3; sepal.rotation.set(.5, i * Math.PI / 2, 0, 'YXZ'); sepal.name = 'sepal';
        g.add(sepal);
    }
    // A generous invisible ball around it, so a small finger finds it.
    const reach = new THREE.Mesh(BUD.reach, BUD.unseen); reach.position.y = .4; g.add(reach);
    shadowy(g);
    // About as tall as a two-storey house: a bud is the thing to find on the island.
    g.scale.setScalar(2);
    g.position.set(x, heightAt(shown, x, z), z);
    budsGroup.add(g);
    return { g, x, z, steps, phase: Math.random() * 6 };
}
/** Where the next learning session's growth shows up, as up to two buds. */
function sprout(steps: number) {
    const young = specials.find(s => s.kind === 'home' && (s.stage ?? 3) < 3);
    const spots: XZ[] = [];
    if (young) spots.push([young.x + .9, young.z + .5]);
    const busy = busySpot(footfall, roads, rand);
    const line = roads.length ? roads[Math.floor(rand() * roads.length)].line : [];
    const any = line.length ? line[Math.floor(rand() * line.length)] : undefined;
    if (busy) spots.push([busy[0] + .7, busy[1] + .7]);
    else if (any) spots.push([any[0] + .7, any[2] + .7]);
    if (!spots.length) spots.push(landNear(0, 0));
    const share = Math.ceil(steps / spots.length);
    for (const [x, z] of spots.slice(0, 2)) { const [lx, lz] = landNear(x, z); buds.push(makeBud(lx, lz, share)); }
    updateStat();
}
/** Buds that have been tapped and are opening: the petals part, the bulb swells and is gone. */
let opening: { g: THREE.Group; t0: number }[] = [];
function moveOpening(now: number) {
    opening = opening.filter(o => {
        const t = (now - o.t0) / 650;
        if (t >= 1) { budsGroup.remove(o.g); return false; }
        for (const c of o.g.children) if (c.name === 'sepal') c.rotation.x = .5 + t * 1.6;
        const bulb = o.g.getObjectByName('bulb')!;
        bulb.scale.setScalar(t < .4 ? 1 + t * 1.2 : Math.max(.01, 1.48 * (1 - (t - .4) / .6)));
        return true;
    });
}
function openBud(b: Bud) {
    buds = buds.filter(o => o !== b);
    opening.push({ g: b.g, t0: performance.now() });
    burst(b.x, b.g.position.y + .9, b.z, 40, 1.2);
    // A little burst: the ring under it, and a rising chime for each thing that grows.
    cursor.x = b.x; cursor.z = b.z; cursor.shown = 1; cursor.pulse = 1;
    navigator.vibrate?.(12);
    for (let i = 0; i < b.steps; i++) window.setTimeout(() => { chime(620 + i * 90, .035, .25); grow(performance.now()); }, 120 + i * 380);
    window.setTimeout(() => { cursor.shown = 0; updateStat(); }, 300);
}

// ---------- the traveller at the pier ----------
// One resident who would like to live here waits at the end of the pier, a
// little house floating over their head. When a house the child grew from a
// seed stands empty, the house bobs to show it, and a tap sends the traveller
// walking up the roads to move in. Nobody hurries and nobody leaves.
const traveller = (() => {
    const g = new THREE.Group();
    const rig = makeResidentRig('rabbit', poko);
    g.add(rig.pose);
    g.scale.setScalar(FOLK_SCALE);
    const sign = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(.45, .35, .4), M.walls[1]); walls.position.y = .18;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(.38, .3, 4).rotateY(Math.PI / 4), M.walls[4]); roof.position.y = .5;
    sign.add(walls, roof);
    sign.position.y = 2.1;
    sign.scale.setScalar(2.2);
    g.add(sign);
    const reach = new THREE.Mesh(BUD.reach, BUD.unseen); reach.scale.setScalar(2.2); reach.position.y = 1; g.add(reach);
    scene.add(g);
    return { g, rig, sign, here: false, path: null as P3[] | null, s: 0, home: null as Special | null, next: 1 };
})();
/** A house grown from a seed (not the first, which is ぽこもこ's own) that nobody lives in yet. */
const emptyHome = () => specials.find((s, i) => s.kind === 'home' && i > specials.findIndex(o => o.kind === 'home') && (s.stage ?? 0) >= 1 && !s.lived);
function sendTraveller() {
    const home = emptyHome();
    if (!home || !traveller.here) { traveller.g.position.y += .1; chime(520, .03, .15); return; }
    // Up the roads, node by node, from the harbour to the house.
    const g = graphOf(roads);
    const a = nodeNear(g, harbour(), 2.4), b = nodeNear(g, [home.x, home.z], 2.4);
    const nodes = a !== undefined && b !== undefined ? pathBetween(g, a, b) ?? [] : [];
    const at = (k: number): P3 => { const x = -SIZE / 2 + (k % N) * RES, z = -SIZE / 2 + Math.floor(k / N) * RES; return [x, heightAt(shaped, x, z), z]; };
    traveller.path = [[pierEnd[0], .32, pierEnd[1]], ...nodes.map(at), [home.x, heightAt(shaped, home.x, home.z), home.z]];
    traveller.s = 0;
    traveller.home = home;
    traveller.here = false;
    chime(660, .04, .3);
}
function moveTraveller(dt: number, now: number) {
    if (!traveller.here && !traveller.path && sessions >= traveller.next) traveller.here = true;
    const t = traveller;
    t.g.visible = t.here || !!t.path;
    t.sign.visible = t.here;
    if (t.path) {
        // Walking: along the path at a stroll, then in at the door.
        t.s += dt * 2.2;
        const i = Math.floor(t.s), p = t.path;
        if (i >= p.length - 1) {
            t.home!.lived = true;
            movedIn++;
            t.path = null; t.home = null;
            t.next = sessions + 1;
            chime(880, .04, .4);
            updateStat();
            return;
        }
        const u = t.s - i, a = p[i], b = p[i + 1];
        t.g.position.set(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u);
        t.g.rotation.y = Math.atan2(b[0] - a[0], b[2] - a[2]);
        t.rig.feet.forEach((foot, k) => { foot.position.z = .12 + Math.sin(now / 120 + k * Math.PI) * .12; });
        return;
    }
    if (!t.here) return;
    // Waiting at the pier end, looking at the island. When a house is ready,
    // the little house over their head hops.
    t.g.position.set(pierEnd[0], .32 + Math.abs(Math.sin(now / 600)) * .02, pierEnd[1]);
    t.g.rotation.y = Math.PI;
    const ready = !!emptyHome();
    t.sign.position.y = 2.6 + (ready ? Math.abs(Math.sin(now / 220)) * .6 : Math.sin(now / 900) * .1);
    t.sign.rotation.y = now / 1500;
}

// ---------- residents out and about ----------
// Some of the trips residents make are walked where the child can see: from
// a house along the roads to the lighthouse, the harbour, the child's house.
// They hop when they arrive and go back in, so the roads they make busy are
// the roads the child sees them on.
const trippers = Array.from({ length: 4 }, (_, i) => {
    const g = new THREE.Group();
    const rig = makeResidentRig(SPECIES[(i + 1) % 3], poko);
    merge(rig.body);
    g.add(rig.pose);
    g.scale.setScalar(FOLK_SCALE);
    g.visible = false;
    scene.add(g);
    return { g, rig, path: null as P3[] | null, s: 0, arrived: 0 };
});
function setOff(route: number[]) {
    const t = trippers.find(o => !o.path && !o.arrived);
    if (!t || route.length < 3 || quality >= 2) return;
    t.path = route.map(k => { const x = -SIZE / 2 + (k % N) * RES, z = -SIZE / 2 + Math.floor(k / N) * RES; return [x, heightAt(shaped, x, z), z] as P3; });
    t.s = 0;
    t.g.visible = true;
}
function moveTrippers(dt: number, now: number) {
    for (const t of trippers) {
        if (t.arrived) {
            // A happy hop at the place, then back indoors.
            const a = (now - t.arrived) / 900;
            t.g.position.y = t.path![t.path!.length - 1][1] + Math.sin(Math.min(1, a) * Math.PI * 2) ** 2 * .25;
            t.g.scale.setScalar(FOLK_SCALE * (a > .7 ? Math.max(.01, 1 - (a - .7) / .3) : 1));
            if (a >= 1) { t.arrived = 0; t.path = null; t.g.visible = false; t.g.scale.setScalar(FOLK_SCALE); }
            continue;
        }
        if (!t.path) continue;
        t.s += dt * 4.5;
        const i = Math.floor(t.s), p = t.path;
        if (i >= p.length - 1) { t.arrived = now; burst(p[p.length - 1][0], p[p.length - 1][1] + .5, p[p.length - 1][2], 8, .4); continue; }
        const u = t.s - i, a = p[i], b = p[i + 1];
        t.g.position.set(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + rise(a[0], a[2]), a[2] + (b[2] - a[2]) * u);
        t.g.rotation.y = Math.atan2(b[0] - a[0], b[2] - a[2]);
        t.rig.feet.forEach((foot, k) => { foot.position.z = .12 + Math.sin(now / 110 + k * Math.PI) * .12; });
    }
}

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
    f.cool -= dt;
    f.bubble.visible = false;
    if (f.mode === 'sit' || f.mode === 'chat') {
        f.t += dt;
        const bench = f.bench;
        if (f.mode === 'sit' && bench && benches.includes(bench)) {
            // Sitting on the bench, swinging the feet, looking at the view.
            f.g.position.copy(bench.g.position); f.g.position.y += .06;
            f.g.rotation.y = bench.g.rotation.y;
            f.rig.feet.forEach((foot, k) => { foot.position.z = f.feet[k] + Math.sin(now / 300 + k * Math.PI) * .05; });
            f.rig.body.rotation.z = 0;
            if (f.t < 5 + (f.road % 4)) { f.g.visible = true; return; }
        } else if (f.mode === 'chat' && f.t < 3.2) {
            // Standing face to face with a neighbour, a bubble over one head.
            f.bubble.visible = f.dir > 0;
            f.bubble.position.copy(f.g.position); f.bubble.position.y += .62 + Math.sin(now / 250) * .03;
            f.rig.body.rotation.z = Math.sin(now / 200 + f.road) * .08;
            f.g.visible = true;
            return;
        }
        if (bench) bench.by = null;
        f.bench = null; f.mode = 'walk'; f.cool = 6 + (f.road % 5) * 2;
    }
    if (f.mode === 'walk' && f.cool < 0) {
        // Passing a free bench now and then, sit down for a while.
        const ri = roads.indexOf(road);
        const bench = benches.find(b => b.road === ri && !b.by && Math.abs(b.s - f.s) < .2);
        if (bench && f.rest > 0 && (f.road + bench.s) % 2 === 0) { bench.by = f; f.bench = bench; f.mode = 'sit'; f.t = 0; f.g.visible = true; return; }
        // Meeting a neighbour coming the other way: both stop to chat.
        const other = folk.find(q => q !== f && q.g.visible && q.mode === 'walk' && q.cool < 0 && q.dir !== f.dir && q.road % Math.max(1, roads.length) === f.road % Math.max(1, roads.length) && Math.abs(q.s - f.s) < .7);
        if (other) {
            for (const q of [f, other]) { q.mode = 'chat'; q.t = 0; }
            const face = Math.atan2(other.g.position.x - f.g.position.x, other.g.position.z - f.g.position.z);
            f.g.rotation.y = face; other.g.rotation.y = face + Math.PI;
            return;
        }
    }
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
/** The みち stroke being drawn, as a dotted line on the ground. */
let draft: XZ[] | null = null;
const draftLine = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xffffff, size: .18, depthTest: false }));
draftLine.renderOrder = 5;
scene.add(draftLine);
function showDraft() {
    const pts = draft ?? [];
    draftLine.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap(([x, z]) => [x, heightAt(shown, x, z) + .15, z]), 3));
    draftLine.visible = !!draft;
}
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
    history.push({ base: base.slice(), specials: specials.map(s => ({ ...s })), houses: houses.slice(), trees: trees.slice(), drawn: drawn.slice() });
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
    // A bud or the traveller under the finger answers before the ground does.
    const bud = buds.find(b => ray.intersectObject(b.g, true).length);
    if (bud) { if (audio?.state === 'suspended') void audio.resume(); openBud(bud); return; }
    if (traveller.g.visible && ray.intersectObject(traveller.g, true).length) { if (audio?.state === 'suspended') void audio.resume(); sendTraveller(); return; }
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
    if (tool === 'road') {
        draft = [[p.x, p.z]];
        showDraft();
        renderer.domElement.setPointerCapture(e.pointerId);
        return;
    }
    painting = true;
    cursor.shown = 1;
    paint(p, .5);
    lastPaint = performance.now();
    renderer.domElement.setPointerCapture(e.pointerId);
}, { capture: true });
renderer.domElement.addEventListener('pointermove', e => {
    if (draft) {
        const p = hit(e);
        const last = draft[draft.length - 1];
        if (p && Math.hypot(p.x - last[0], p.z - last[1]) > .3) { draft.push([p.x, p.z]); showDraft(); }
        return;
    }
    const now = performance.now();
    if (!painting || now - lastPaint < 16) return;
    const p = hit(e);
    // Every move counts, in proportion to the time since the last one, so a
    // slow stroke and a quick one pile up the same earth per second.
    if (p) { paint(p, .22 * Math.min(1, (now - lastPaint) / 90)); lastPaint = now; }
});
const end = () => {
    if (draft) {
        // The drawn line becomes stops for a road, about every 1.3 units; the
        // island finds the way between them (zigzags, steps, bridges).
        const stops: XZ[] = [];
        let gone = 0;
        draft.forEach((q, i) => {
            if (i) gone += Math.hypot(q[0] - draft![i - 1][0], q[1] - draft![i - 1][1]);
            if (!i || gone >= 1.3 || i === draft!.length - 1) { stops.push(q); gone = 0; }
        });
        draft = null;
        showDraft();
        drawn.push(...stops);
        chime(440, .03, .2);
        think();
    }
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
    base = prev.base; specials = prev.specials; houses = prev.houses; trees = prev.trees; drawn = prev.drawn;
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
 * Stands in for finishing a learning session in the app: buds come up, and
 * the island grows when the child opens them.
 */
function learn() {
    sessions++;
    sprout(PER_SESSION);
}
// ---------- しまの しゃしん ----------
// A card to show someone: the island as it is now, in a dotted frame, with
// how far it has come. Saved as a picture, nothing else is kept or sent.
const card = root.querySelector<HTMLDivElement>('#card')!;
function photo() {
    renderer.render(scene, camera);
    const shot = new Image();
    shot.onload = () => {
        const c = document.createElement('canvas');
        c.width = 1080; c.height = 1350;
        const x = c.getContext('2d')!;
        x.fillStyle = '#fffdf9'; x.fillRect(0, 0, c.width, c.height);
        // The ふしぎ frame: pokomoko dots all round the edge.
        const r = rng(sessions + houses.length);
        for (let i = 0; i < 90; i++) {
            const t = i / 90, side = Math.floor(t * 4), u = (t * 4) % 1;
            const [px, py] = [[u * 1080, 22], [1058, u * 1350], [(1 - u) * 1080, 1328], [22, (1 - u) * 1350]][side];
            x.fillStyle = POKO[i % POKO.length]; x.beginPath(); x.arc(px + (r() - .5) * 10, py + (r() - .5) * 10, 9 + r() * 9, 0, Math.PI * 2); x.fill();
        }
        // The island, cropped to fill the picture window.
        const w = 960, h = 980, scale = Math.max(w / shot.width, h / shot.height);
        const sw = w / scale, sh = h / scale;
        x.save(); x.beginPath(); x.roundRect(60, 60, w, h, 36); x.clip();
        x.drawImage(shot, (shot.width - sw) / 2, (shot.height - sh) / 2, sw, sh, 60, 60, w, h);
        x.restore();
        x.fillStyle = '#30364f'; x.font = '700 64px system-ui, sans-serif'; x.fillText('わたしの しま', 70, 1130);
        x.fillStyle = '#606980'; x.font = '500 38px system-ui, sans-serif';
        x.fillText(`いえ ${houses.length}  ·  すむ ${townsfolk()}  ·  き ${trees.length}${byLearning ? `  ·  まなんだ ${sessions}かい` : ''}`, 70, 1200);
        x.fillText(new Date().toLocaleDateString('ja-JP'), 70, 1260);
        const url = c.toDataURL('image/png');
        card.querySelector('img')!.src = url;
        card.querySelector<HTMLAnchorElement>('#save')!.href = url;
        card.hidden = false;
        chime(990, .03, .3);
    };
    shot.src = renderer.domElement.toDataURL('image/png');
}
root.querySelector('#photo')!.addEventListener('click', photo);
root.querySelector('#close')!.addEventListener('click', () => { card.hidden = true; });
const learnButton = root.querySelector<HTMLButtonElement>('#learn')!;
learnButton.hidden = !byLearning;
learnButton.addEventListener('click', () => learn());
root.querySelector('#seed')!.addEventListener('click', () => {
    placing = 'home';
    showSwatches();
    updateStat();
});
const TIMES: Time[] = ['day', 'dusk', 'night'];
const timeButton = root.querySelector<HTMLButtonElement>('#time')!;
timeButton.addEventListener('click', () => { time = TIMES[(TIMES.indexOf(time) + 1) % 3]; light(); });
root.querySelector<HTMLButtonElement>('[data-tool="stack"]')!.setAttribute('aria-pressed', 'true');
root.querySelector<HTMLButtonElement>('[data-tool="road"]')!.hidden = !drawMode;
root.querySelector('#tool')!.classList.toggle('three', drawMode);

// ---------- sky and light ----------
// The sky is a dome painted from the horizon up, with the sun or moon glowing
// low in it; at night stars come out and the town's windows and lamps light.
const SKY = {
    top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
    glow: { value: new THREE.Color() }, toward: { value: new THREE.Vector3(0, 1, 0) },
};
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(240, 32, 16), new THREE.ShaderMaterial({
    uniforms: { uTop: SKY.top, uHorizon: SKY.horizon, uGlow: SKY.glow, uToward: SKY.toward },
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vDir; uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uGlow; uniform vec3 uToward;
void main() {
    float up = clamp(vDir.y, 0.0, 1.0);
    vec3 c = mix(uHorizon, uTop, pow(up, 0.55));
    float near = max(dot(vDir, normalize(uToward)), 0.0);
    c += uGlow * (pow(near, 8.0) * 0.6 + pow(near, 600.0) * 1.2);
    gl_FragColor = vec4(c, 1.0);
}`,
    side: THREE.BackSide, depthWrite: false, fog: false,
}));
skyDome.renderOrder = -1;
scene.add(skyDome);
const stars = (() => {
    const r = rng(99), pos: number[] = [];
    for (let i = 0; i < 420; i++) {
        const a = r() * Math.PI * 2, up = .12 + Math.pow(r(), .7) * .88, flat = Math.sqrt(1 - up * up);
        pos.push(Math.cos(a) * flat * 230, up * 230, Math.sin(a) * flat * 230);
    }
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, map: GLOW_DOT, color: 0xfff6dc, transparent: true, depthWrite: false, fog: false }));
})();
scene.add(stars);
/** At night small lights drift over the meadow, like fireflies. */
const GLIMMERS = 50;
const glimmers = (() => {
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(GLIMMERS * 3), 3));
    const p = new THREE.Points(geo, new THREE.PointsMaterial({ size: .32, map: GLOW_DOT, color: 0xd8ff9a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    p.frustumCulled = false;
    p.userData.home = Array.from({ length: GLIMMERS }, () => [0, 0, 0]);
    scene.add(p);
    return p;
})();
/** Glimmers keep to land that has no house or road, near the ground. */
function placeGlimmers() {
    const r = rng(5 + houses.length), home = glimmers.userData.home as number[][];
    for (let i = 0, tries = 0; i < GLIMMERS && tries < 2000; tries++) {
        const x = (r() - .5) * SIZE * .8, z = (r() - .5) * SIZE * .8, y = heightAt(shaped, x, z);
        if (y < .4) continue;
        home[i++] = [x, y + .3 + r() * .5, z];
    }
}
function moveGlimmers(now: number) {
    if (!glimmers.visible) return;
    const pos = glimmers.geometry.attributes.position as THREE.BufferAttribute, home = glimmers.userData.home as number[][];
    const t = now / 1000;
    for (let i = 0; i < GLIMMERS; i++) {
        const [x, y, z] = home[i];
        pos.setXYZ(i, x + Math.sin(t * .4 + i) * .5, y + rise(x, z) + Math.sin(t * .9 + i * 2.1) * .15, z + Math.cos(t * .33 + i * 1.3) * .5);
    }
    pos.needsUpdate = true;
    (glimmers.material as THREE.PointsMaterial).opacity = .75 + Math.sin(t * 2.3) * .2;
}
const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture((c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, s * .12, s / 2, s / 2, s / 2);
    g.addColorStop(0, '#fffbe8'); g.addColorStop(.25, '#fff6d088'); g.addColorStop(1, '#fff6d000');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    c.fillStyle = '#fffbea'; c.beginPath(); c.arc(s / 2, s / 2, s * .13, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#efe6c8'; for (const [x, y, r] of [[.47, .46, .025], [.54, .53, .018], [.5, .55, .012]]) { c.beginPath(); c.arc(s * x, s * y, s * r, 0, Math.PI * 2); c.fill(); }
}), fog: false, depthWrite: false }));
moon.scale.setScalar(42);
scene.add(moon);
/** Everything that changes with the time of day, in one table. */
const LOOK: Record<Time, {
    top: number; horizon: number; glow: number; fog: number; sun: number; sunAt: [number, number, number]; sunPower: number;
    sky: number; groundBounce: number; skyPower: number; deep: number; shallow: number; foam: number;
    early: number; late: number; lamps: number; halo: number; beam: number; exposure: number; clouds: number;
}> = {
    day: {
        top: 0x4fa6e2, horizon: 0xcdeffa, glow: 0xfff3d0, fog: 0xc2e6f6, sun: 0xfff4e2, sunAt: [-9, 18, 12], sunPower: 2.5,
        sky: 0xffffff, groundBounce: 0x6d7a5a, skyPower: 1.2, deep: 0x1a76b8, shallow: 0x46d0c8, foam: 0xffffff,
        early: 0, late: 0, lamps: .5, halo: 0, beam: 0, exposure: 1, clouds: 0xffffff,
    },
    dusk: {
        top: 0x5b5fa8, horizon: 0xffb48a, glow: 0xffa36a, fog: 0xf1b39b, sun: 0xffb98e, sunAt: [-16, 6, 10], sunPower: 2.1,
        sky: 0xe8dcff, groundBounce: 0x6a5a6a, skyPower: 1.05, deep: 0x5d5fa6, shallow: 0xe0a39a, foam: 0xffe6d6,
        early: 1.6, late: 0, lamps: 1.6, halo: .55, beam: .18, exposure: 1, clouds: 0xffd8c8,
    },
    night: {
        top: 0x0a1433, horizon: 0x2a4378, glow: 0x6f86c8, fog: 0x22345e, sun: 0xb4c4ff, sunAt: [7, 15, 9], sunPower: 1,
        sky: 0x9fb2ec, groundBounce: 0x26304a, skyPower: .95, deep: 0x10295a, shallow: 0x2a6f8f, foam: 0xb8caf0,
        early: 2.6, late: 2.2, lamps: 3, halo: 1, beam: .32, exposure: 1.25, clouds: 0xc4cdec,
    },
};
function light() {
    const l = LOOK[time];
    SKY.top.value.set(l.top); SKY.horizon.value.set(l.horizon); SKY.glow.value.set(l.glow);
    SKY.toward.value.set(...l.sunAt).normalize();
    scene.background = new THREE.Color(l.horizon);
    scene.fog = new THREE.Fog(l.fog, 40, 110);
    sun.color.set(l.sun);
    sun.intensity = l.sunPower;
    sun.position.set(...l.sunAt);
    hemi.color.set(l.sky);
    hemi.groundColor.set(l.groundBounce);
    hemi.intensity = l.skyPower;
    renderer.toneMappingExposure = l.exposure;
    SEA.deep.value.set(l.deep);
    SEA.shallow.value.set(l.shallow);
    SEA.foam.value.set(l.foam);
    WINDOW.early.emissiveIntensity = l.early;
    WINDOW.late.emissiveIntensity = l.late;
    LAMP_GLOW.emissiveIntensity = l.lamps;
    LIGHTHOUSE.emissiveIntensity = l.lamps;
    for (const h of [...Object.values(HALO), POOL]) { h.opacity = l.halo; h.visible = l.halo > 0; }
    POOL.opacity = l.halo * .3;
    glimmers.visible = time === 'night';
    BEAM.opacity = l.beam;
    BEAM.visible = l.beam > 0;
    CLOUD.color.set(l.clouds);
    stars.visible = time === 'night';
    moon.visible = time === 'night';
    moon.position.copy(SKY.toward.value).multiplyScalar(200);
    timeButton.textContent = { day: '☀️', dusk: '🌅', night: '🌙' }[time];
    timeButton.setAttribute('aria-label', { day: 'ひる', dusk: 'ゆうがた', night: 'よる' }[time]);
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

let last = performance.now(), lastGrow = 0, frames = 0, frameSum = 0, slowChecks = 0, checkedAt = performance.now();
renderer.setAnimationLoop(now => {
    SEA.time.value = now / 1000;
    const frame = now - last;
    const dt = Math.min(.05, frame / 1000);
    last = now;
    // Raise the resolution while frames stay quick; drop it back if they do not.
    frames++; frameSum += frame;
    // Judged every second and a half (and at least ten frames), so even a very slow phone is noticed soon.
    if (frames >= 10 && now - checkedAt > 1500) {
        checkedAt = now;
        const avg = frameSum / frames, most = Math.min(devicePixelRatio, 1.5);
        const next = avg < 18 && pixelRatio < most ? Math.min(most, pixelRatio + .25) : avg > 30 && pixelRatio > 1 ? Math.max(1, pixelRatio - .25) : pixelRatio;
        if (next !== pixelRatio) { pixelRatio = next; renderer.setPixelRatio(next); renderer.setSize(viewport.clientWidth, viewport.clientHeight, false); }
        // Still slow at the lowest resolution twice running: draw less.
        slowChecks = avg > 30 && pixelRatio <= 1 ? slowChecks + 1 : 0;
        if (slowChecks >= 2 && quality < 2) {
            quality++;
            slowChecks = 0;
            if (quality >= 1) sun.castShadow = false;
            if (quality >= 2) for (const t of trippers) { t.path = null; t.arrived = 0; t.g.visible = false; }
        }
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
        f.bubble.visible = false;
        if (i >= living || !road || road.line.length < 3) { f.g.visible = false; return; }
        // The first residents stand where the road comes nearest a place it
        // does not reach, looking that way: a hint, with no words.
        const spot = gazing[i >> 1];
        if (spot && f.mode === 'walk') {
            f.g.visible = true;
            f.g.position.set(spot.at[0] + (i % 2 ? .25 : -.25), spot.at[1] + rise(spot.at[0], spot.at[2]) - .05, spot.at[2]);
            f.g.rotation.y = Math.atan2(spot.look[0] - spot.at[0], spot.look[1] - spot.at[2]);
            f.g.position.y += Math.abs(Math.sin(now / 400 + i)) * .03;
            return;
        }
        walk(f, road, dt, now);
    });
    perf.folk.push(performance.now() - tf);
    const home = specials.find(s => s.kind === 'home');
    for (const b of buds) {
        b.g.position.y = heightAt(shown, b.x, b.z) + Math.sin(now / 500 + b.phase) * .04;
        const bulb = b.g.getObjectByName('bulb')!;
        bulb.scale.setScalar(1 + Math.sin(now / 350 + b.phase) * .06);
    }
    moveTraveller(dt, now);
    moveOpening(now);
    moveTrippers(dt, now);
    moveSparks(dt);
    moveSky(dt, now);
    moveGlimmers(now);
    if (BEAM.visible) for (const g of specialsGroup.children) { const beam = g.getObjectByName('beam'); if (beam) beam.rotation.y = now / 1400; }
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

const onScreen = (v: THREE.Vector3) => {
    const p = v.project(camera), r = renderer.domElement.getBoundingClientRect();
    return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height];
};
// For checks from the outside: the same strokes and taps a finger makes.
Object.assign(window, {
    growLab: {
        get roads() { return roads; }, get houses() { return houses; }, get trees() { return trees; }, get specials() { return specials; },
        get moved() { return lastMoved; },
        get pixelRatio() { return pixelRatio; },
        get drawCalls() { return renderer.info.render.calls; },
        get quality() { return quality; },
        get walkingOut() { return trippers.filter(t => t.path).length; },
        get sparkling() { let n = 0; for (const l of sparkLife) if (l > 0) n++; return n; },
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
        get beachSpots() { return beachSpots; },
        get chatAt() { const f = folk.find(q => q.mode === 'chat' && q.g.visible); return f ? [f.g.position.x, f.g.position.z] : null; },
        get beach() { return { parasols: beachSpots.length, benches: benches.length, sitting: benches.filter(b => b.by).length, chatting: folk.filter(f => f.mode === "chat").length }; },
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
            const paved = [0, 0, 0, 0];
            for (const r of roads) for (const st of stagesAlong(footfall, r)) paved[st]++;
            return { land: +(land * RES * RES).toFixed(0), top: +top.toFixed(1), roads: roads.length, kinds, houses: houses.length, trees: trees.length, folk: townsfolk(), specials: specials.map(s => `${s.kind}${s.stage ?? ''}`), paved };
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
        /** One learning session as the app would end it: buds come up, nothing grows yet. */
        study() { learn(); },
        get buds() { return buds.map(b => ({ x: b.x, z: b.z, steps: b.steps })); },
        get budScale() { return buds[0]?.g.scale.x ?? 0; },
        get traveller() { return { here: traveller.here, walking: !!traveller.path, movedIn, ready: !!emptyHome() }; },
        /** Where the traveller and each bud show on screen, in page pixels, to aim a real tap. */
        travellerOnScreen() { return onScreen(traveller.g.position.clone().add(new THREE.Vector3(0, .35, 0))); },
        budsOnScreen() { return buds.map(b => onScreen(b.g.position.clone().add(new THREE.Vector3(0, .8, 0)))); },
        learn(n = 1) { for (let i = 0; i < n; i++) { sessions++; for (let k = 0; k < PER_SESSION; k++) grow(-1e6); } updateStat(); },
        get sessions() { return sessions; },
        /** Show every road at one stage of use (0 worn path … 3 tiles), to compare. */
        roadStage(n: number | null) { roadStage = n; drawRoads(); },
        /** A みち stroke through these points, as the finger would draw it. */
        drawRoad(path: [number, number][]) { remember(); drawn.push(...path); recompute(); },
        get gazing() { return gazing.length; },
        get footfall() { return Array.from(footfall).reduce((a, b) => a + b, 0); },
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
