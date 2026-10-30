import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { D, DIRS, H, W, changed, derive, fromHeights, setBlock, solid, type Block, type Bridge, type Dir, type Grid, type Stair, type Village } from './stackRules';
import { buildShell } from './organicShell';
import { Residents } from './residents';
import './style.css';

// A whitebox for "つむ / けずる": tap stacks or carves one block, the rules
// decide what every block looks like. ?look=sample shows the finished look.

type Tool = 'stack' | 'carve';
type Look = 'white' | 'sample';
type Time = 'day' | 'dusk' | 'night';

// A walled town on a terrace two levels up: an open square with streets,
// tall buildings standing in it (twin towers bridged near the top, a spire),
// a rim of houses around, and steps down to the harbour. Heights are base 36.
const SAMPLE = [
    '4444555444',
    '4222222224',
    '42aa22c2c4',
    '42ab2dc224',
    '4222222224',
    '4223322224',
    '422e322724',
    '4222222224',
    '2222112222',
    '0000000000',
];

const root = document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML = `<div id="viewport"></div>
<div class="top"><span>DEVELOPMENT · つむ／けずる 試作</span><div class="seg" id="look"><button data-look="white">whitebox</button><button data-look="sample">見本</button></div></div>
<div class="time" id="time"><button data-time="day">ひる</button><button data-time="dusk">ゆうがた</button><button data-time="night">よる</button></div>
<p class="stat" id="stat" aria-live="polite"></p>
<div class="tools"><button id="undo" aria-label="もどす">↶</button><div class="seg big" id="tool"><button data-tool="stack">つむ</button><button data-tool="carve">けずる</button></div><button id="reset" aria-label="はじめから">⟲</button></div>`;

const viewport = root.querySelector<HTMLDivElement>('#viewport')!;
const stat = root.querySelector<HTMLParagraphElement>('#stat')!;
const params = new URLSearchParams(location.search);
let look: Look = params.get('look') === 'sample' ? 'sample' : 'white';
let time: Time = (params.get('time') as Time) || 'dusk';
let tool: Tool = 'stack';
const sample = () => fromHeights(SAMPLE);
let grid: Grid = sample();
let village: Village = derive(grid);
const history: Grid[] = [];

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
viewport.append(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, .1, 200);
camera.position.set(W * .5 + 9, 15, D + 17);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(W / 2, 4, D / 2);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * .46;
controls.minDistance = 8;
controls.maxDistance = 60;
controls.enablePan = false;

const hemi = new THREE.HemisphereLight(0xffffff, 0x8a7f70, 1.2);
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 18, bottom: -14, near: 1, far: 80 });
sun.shadow.bias = -.0008;
sun.target.position.set(W / 2, 0, D / 2);
scene.add(hemi, sun, sun.target);

const sea = new THREE.Mesh(new THREE.CircleGeometry(80, 48), new THREE.MeshStandardMaterial({ color: 0x2f7fb8, roughness: .35 }));
sea.rotation.x = -Math.PI / 2;
sea.position.set(W / 2, -.08, D / 2);
sea.userData.base = true;
sea.receiveShadow = true;
const base = new THREE.Mesh(new RoundedBoxGeometry(W + 1.4, .9, D + 1.4, 4, .35), new THREE.MeshStandardMaterial({ color: 0xd9c79f, roughness: .9 }));
// The base stays just under the water: carving down to it gives sea.
base.position.set(W / 2, -.62, D / 2);
base.receiveShadow = true;
base.userData.base = true;
scene.add(sea, base);

// ---------- materials ----------
const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, ...extra });
const M = {
    house: mat(0xe6e6e6), rock: mat(0xb4ada6), arch: mat(0xe0e0e0), stair: mat(0xd2d2d2), parapet: mat(0xececec),
    dome: mat(0xc9c9c9), door: mat(0x666666), window: mat(0x8a8a8a), cave: mat(0x4a4a4a), flower: mat(0xbdbdbd),
    domeDots: mat(0xc9c9c9), facade: mat(0xeeeeee), ochre: mat(0xe6e6e6), rose: mat(0xe6e6e6),
    paving: mat(0xbdbdbd),
    ghost: new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
};
// Volcanic strata: each layer of the cliff has its own colour.
const STRATA = [0x4b3b37, 0x6f5045, 0x8c6250, 0x5d4a44, 0x9a7460, 0x725a4e, 0x86604c, 0x5a463f].map(c => mat(c));
function dotTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#e8473f'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#fff7e0';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.beginPath(); g.arc(x * 32 + (y % 2) * 16 + 8, y * 32 + 16, 7, 0, Math.PI * 2); g.fill(); }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 1.5);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
const dots = dotTexture();
function applyLook() {
    const s = look === 'sample';
    const night = s && time === 'night';
    M.house.color.set(s ? 0xf6f1e6 : 0xe6e6e6);
    M.arch.color.set(s ? 0xf3ede1 : 0xe0e0e0);
    M.rock.color.set(0xb4ada6);
    STRATA.forEach((m, i) => m.color.set(s ? [0x4b3b37, 0x6f5045, 0x8c6250, 0x5d4a44, 0x9a7460, 0x725a4e, 0x86604c, 0x5a463f][i] : 0xb4ada6));
    M.facade.color.set(s ? 0xf8f4ea : 0xdedede);
    M.ochre.color.set(s ? 0xedbd74 : 0xe6e6e6);
    M.rose.color.set(s ? 0xeba7a2 : 0xe6e6e6);
    glows.forEach(g => (g.visible = night));
    M.stair.color.set(s ? 0xece4d4 : 0xd2d2d2);
    M.paving.color.set(s ? 0xc49a6c : 0x8f8f8f);
    M.parapet.color.set(s ? 0xfbf8f0 : 0xececec);
    M.dome.color.set(s ? 0x2a63c9 : 0xc9c9c9);
    M.domeDots.color.set(s ? 0xffffff : 0xc9c9c9);
    M.domeDots.map = s ? dots : null;
    M.domeDots.needsUpdate = true;
    M.door.color.set(s ? 0x2a63c9 : 0x666666);
    M.window.color.set(s ? (night ? 0x3a2a10 : 0x2a63c9) : 0x8a8a8a);
    M.window.emissive.set(night ? 0xff9a2e : 0x000000);
    M.window.emissiveIntensity = night ? 1.1 : 0;
    M.cave.color.set(s ? 0x2a211d : 0x4a4a4a);
    M.cave.emissive.set(night ? 0xff9a4a : 0x000000);
    M.cave.emissiveIntensity = night ? 1.2 : 0;
    M.flower.color.set(s ? 0xe8589a : 0xbdbdbd);
    (base.material as THREE.MeshStandardMaterial).color.set(s ? 0x5f4a42 : 0xcfcfcf);
    const seaMat = sea.material as THREE.MeshStandardMaterial;
    seaMat.color.set(s ? (night ? 0x162c55 : time === 'dusk' ? 0x6d86c4 : 0x2a8fcf) : 0xa9c4d6);
    seaMat.emissive.set(s ? (night ? 0x0a1430 : time === 'dusk' ? 0x3a3a6a : 0x0d3a66) : 0x55606a);
    const sky = !s ? 0xf1f1ee : time === 'day' ? 0xa9dcf5 : time === 'dusk' ? 0xf7b9a4 : 0x1b2546;
    scene.background = new THREE.Color(sky);
    scene.fog = s ? new THREE.Fog(sky, 30, 75) : null;
    if (!s || time === 'day') {
        sun.color.set(0xffffff); sun.intensity = s ? 2.6 : 2.0; sun.position.set(W / 2 - 8, 18, D / 2 + 10);
        hemi.color.set(0xffffff); hemi.groundColor.set(0x8a7f70); hemi.intensity = s ? 1.1 : 1.4;
    } else if (time === 'dusk') {
        // Dusk only blushes the white walls; it must not turn them orange.
        sun.color.set(0xffc2a6); sun.intensity = 2.3; sun.position.set(W / 2 - 14, 7, D / 2 + 12);
        hemi.color.set(0xe6dcff); hemi.groundColor.set(0x8a6a78); hemi.intensity = 1.25;
    } else {
        // Moonlight keeps the white walls readable; the windows carry the warmth.
        sun.color.set(0x9fb4ff); sun.intensity = .9; sun.position.set(W / 2 + 4, 16, D / 2 + 12);
        hemi.color.set(0x8a9ad8); hemi.groundColor.set(0x2a2840); hemi.intensity = .95;
    }
    root.querySelector<HTMLDivElement>('#time')!.hidden = !s;
    for (const b of root.querySelectorAll<HTMLButtonElement>('[data-look]')) b.setAttribute('aria-pressed', String(b.dataset.look === look));
    for (const b of root.querySelectorAll<HTMLButtonElement>('[data-time]')) b.setAttribute('aria-pressed', String(b.dataset.time === time));
    flowers.forEach(f => (f.visible = s));
    reskin();
}

// Walls are drawn from each level's plan as curves (organicShell.ts); the
// blocks themselves are only hidden boxes that catch taps.
const runs = new THREE.Group();
scene.add(runs);
function reskin() {
    runs.clear();
    runs.add(buildShell(village.blocks, { wall, rock: y => STRATA[y % STRATA.length], rim: M.parapet }));
    // Arches keep their own shape.
    for (const b of village.blocks) if (b.kind === 'arch') {
        const a = mesh(G.arch, wall(b));
        a.position.set(b.x + .5, b.y + .5, b.z + .5);
        if (b.archAxis === 'x') a.rotation.y = Math.PI / 2;
        runs.add(a);
    }
}
// ---------- geometry ----------
const G = {
    house: new RoundedBoxGeometry(1, 1, 1, 5, .2),
    rock: new RoundedBoxGeometry(1, 1, 1, 3, .14),
    arch: (() => {
        const s = new THREE.Shape();
        s.moveTo(-.5, -.5); s.lineTo(-.5, .5); s.lineTo(.5, .5); s.lineTo(.5, -.5); s.lineTo(.3, -.5); s.lineTo(.3, -.05);
        s.absarc(0, -.05, .3, 0, Math.PI, false);
        s.lineTo(-.3, -.5); s.closePath();
        const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: true, bevelSize: .04, bevelThickness: .04, bevelSegments: 2, curveSegments: 16 });
        g.translate(0, 0, -.5);
        return g;
    })(),
    parapet: new RoundedBoxGeometry(1, .2, .1, 2, .04),
    door: new THREE.BoxGeometry(.34, .5, .04),
    doorTop: new THREE.CylinderGeometry(.17, .17, .04, 16, 1, false, 0, Math.PI),
    window: new THREE.CylinderGeometry(.13, .13, .04, 20).rotateX(Math.PI / 2),
    facade: new RoundedBoxGeometry(.78, .7, .06, 2, .03),
    drum: new THREE.CylinderGeometry(.3, .3, .14, 24),
    // An onion dome: swells out past the drum, then draws up to a point.
    dome: new THREE.LatheGeometry([[0, 0], [.3, 0], [.37, .12], [.33, .28], [.2, .42], [.07, .54], [.02, .64], [0, .7]].map(([x, y]) => new THREE.Vector2(x, y)), 28),
    step: new THREE.BoxGeometry(.62, 1, 1),
    flower: new THREE.IcosahedronGeometry(.085, 1),
    paving: new THREE.BoxGeometry(.5, .03, 1),
    pavingEnd: new THREE.CylinderGeometry(.25, .25, .03, 18),
    ledge: new RoundedBoxGeometry(.62, .07, .34, 2, .02),
    rail: new RoundedBoxGeometry(.62, .22, .04, 2, .015),
    plank: new RoundedBoxGeometry(1.2, .08, .46, 2, .02),
    vault: new THREE.CylinderGeometry(.46, .46, .96, 20, 1, false, 0, Math.PI),
};

const angle = (d: Dir) => [Math.PI / 2, -Math.PI / 2, 0, Math.PI][d];
const mesh = (g: THREE.BufferGeometry, m: THREE.Material, pick?: object) => {
    const o = new THREE.Mesh(g, m);
    o.castShadow = o.receiveShadow = true;
    if (pick) o.userData.pick = pick;
    return o;
};
const flowers: THREE.Object3D[] = [];
const glows: THREE.Object3D[] = [];
// Mostly white, now and then an ochre or rose house as in Oia.
const wall = (b: Block) => { const h = (b.x * 11 + b.y * 7 + b.z * 5) % 9; return h === 0 ? M.ochre : h === 4 ? M.rose : M.house; };
const glowMat = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,200,120,.9)'); r.addColorStop(.35, 'rgba(255,170,80,.35)'); r.addColorStop(1, 'rgba(255,150,60,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: 0xffa24a, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
})();

// Something that sits on face d of a block: child of a pivot turned to face d.
function onFace(group: THREE.Group, d: Dir, items: THREE.Object3D[]) {
    const pivot = new THREE.Group();
    pivot.rotation.y = angle(d);
    for (const it of items) { it.position.z += .5; pivot.add(it); }
    group.add(pivot);
}

function buildBlock(b: Block): THREE.Group {
    const g = new THREE.Group();
    g.position.set(b.x + .5, b.y + .5, b.z + .5);
    const pick = { x: b.x, y: b.y, z: b.z };
    // The block itself is drawn by the curved shell; this box only catches taps.
    const body = mesh(G.rock, M.ghost, pick);
    body.castShadow = body.receiveShadow = false;
    g.add(body);
    for (const d of b.doors) {
        const door = mesh(G.door, M.door); door.position.y = -.22;
        const top = mesh(G.doorTop, M.door); top.rotation.x = Math.PI / 2; top.position.y = .03;
        onFace(g, d, [door, top]);
    }
    // A door high up opening onto a small ledge with a rail.
    for (const d of b.balconies) {
        const door = mesh(G.door, M.door); door.position.y = -.22;
        const top = mesh(G.doorTop, M.door); top.rotation.x = Math.PI / 2; top.position.y = .03;
        const ledge = mesh(G.ledge, M.parapet); ledge.position.set(0, -.47, .16);
        const rail = mesh(G.rail, M.parapet); rail.position.set(0, -.33, .31);
        onFace(g, d, [door, top, ledge, rail]);
    }
    for (const d of b.windows) {
        const w = mesh(G.window, M.window); w.position.y = .08;
        const glow = new THREE.Sprite(glowMat); glow.scale.setScalar(.9); glow.position.set(0, .08, .12); glows.push(glow);
        onFace(g, d, [w, glow]);
    }
    // A cave home: a white front carved into the rock with a blue door.
    for (const d of b.caves) {
        const front = mesh(G.facade, M.facade); front.position.set(0, -.08, .01);
        const c = mesh(G.door, M.door); c.position.set(-.1, -.2, .04);
        const top = mesh(G.doorTop, M.door); top.rotation.x = Math.PI / 2; top.position.set(-.1, .05, .04);
        const w = mesh(G.window, M.window); w.position.set(.2, .02, .04); w.scale.set(.7, .7, 1);
        onFace(g, d, [front, c, top, w]);
    }
    for (const d of [] as Dir[]) { // terrace rims are drawn by the shell
        const p = mesh(G.parapet, M.parapet, { ...pick, up: true }); p.position.set(0, .6, -.05);
        const items: THREE.Object3D[] = [p];
        if ((b.x * 7 + b.z * 3 + b.y + d) % 5 === 0) {
            for (let i = 0; i < 3; i++) {
                const f = mesh(G.flower, M.flower); f.position.set(-.3 + i * .28, .75 + (i % 2) * .05, -.03); f.scale.setScalar(.9 + (i % 2) * .3);
                flowers.push(f); items.push(f);
            }
        }
        onFace(g, d, items);
    }
    if (b.dome) {
        const dm = (b.x + b.z + b.y) % 4 === 0 ? M.domeDots : M.dome;
        const drum = mesh(G.drum, M.parapet, { ...pick, up: true }); drum.position.y = .57;
        const dome = mesh(G.dome, dm, { ...pick, up: true }); dome.position.y = .64;
        g.add(drum, dome);
    }
    return g;
}

// Each cell of a flight: a landing at its level, then half a cell of steps
// up toward the next cell (or the terrace it arrives at).
function buildStair(s: Stair): THREE.Group {
    const g = new THREE.Group();
    s.cells.forEach(([cx, cz], i) => {
        const [ex, ez] = i + 1 < s.cells.length ? [s.cells[i + 1][0] - cx, s.cells[i + 1][1] - cz] : DIRS[s.dir];
        const cell = new THREE.Group();
        cell.position.set(cx + .5, s.y, cz + .5);
        cell.rotation.y = Math.atan2(ex, ez);
        if (i > 0) {
            const landing = mesh(G.step, M.stair);
            landing.scale.set(1, i, 1);
            landing.position.set(0, i / 2, 0);
            cell.add(landing);
        }
        for (let k = 0; k < 4; k++) {
            const h = i + (k + 1) / 4;
            const st = mesh(G.step, M.stair);
            st.scale.set(1, h, .125);
            st.position.set(0, h / 2, k * .125 + .0625);
            cell.add(st);
        }
        g.add(cell);
    });
    return g;
}

// A plank with rails over the gap cell, at floor height.
function buildBridge(r: Bridge): THREE.Group {
    const g = new THREE.Group();
    g.position.set(r.x + .5 + DIRS[r.dir][0], r.y, r.z + .5 + DIRS[r.dir][1]);
    g.rotation.y = r.dir === 0 ? 0 : Math.PI / 2;
    const plank = mesh(G.plank, M.stair, { x: r.x, y: r.y - 1, z: r.z, up: true }); plank.position.y = -.04;
    const left = mesh(G.rail, M.parapet); left.scale.x = 1.9; left.position.set(0, .1, .21);
    const right = mesh(G.rail, M.parapet); right.scale.x = 1.9; right.position.set(0, .1, -.21);
    g.add(plank, left, right);
    return g;
}

// Paving along a street between two neighbouring floors: a strip from one
// centre to the other with a round stone at each end, so turns look worn in.
function buildStreet(a: string, b: string): THREE.Group | undefined {
    const pa = village.spots.get(a), pb = village.spots.get(b);
    if (!pa || !pb || pa[1] !== pb[1] || Math.hypot(pa[0] - pb[0], pa[2] - pb[2]) > 1.01) return;
    const g = new THREE.Group();
    g.position.set((pa[0] + pb[0]) / 2, pa[1] + .012, (pa[2] + pb[2]) / 2);
    const strip = mesh(G.paving, M.paving);
    strip.receiveShadow = true; strip.castShadow = false;
    strip.rotation.y = Math.atan2(pb[0] - pa[0], pb[2] - pa[2]);
    g.add(strip);
    for (const [x, , z] of [pa, pb]) {
        const stone = mesh(G.pavingEnd, M.paving);
        stone.castShadow = false;
        stone.position.set(x - g.position.x, 0, z - g.position.z);
        g.add(stone);
    }
    return g;
}

// ---------- scene sync ----------
const pieces = new Map<string, THREE.Group>();
const bouncing = new Map<THREE.Group, number>();
const town = new THREE.Group();
scene.add(town);

function rebuild(bounce: Set<string>) {
    flowers.length = 0;
    glows.length = 0;
    for (const g of pieces.values()) town.remove(g);
    pieces.clear();
    const now = performance.now();
    for (const b of village.blocks) pieces.set(b.key, buildBlock(b));
    for (const s of village.stairs) pieces.set(s.key, buildStair(s));
    for (const r of village.bridges) pieces.set(r.key, buildBridge(r));
    for (const [a, b] of village.streets) {
        const piece = buildStreet(a, b);
        if (piece) pieces.set(`p${[a, b].sort().join('|')}`, piece);
    }
    for (const [k, g] of pieces) {
        town.add(g);
        if (bounce.has(k)) { bouncing.set(g, now); g.scale.setScalar(.7); }
    }
    applyLook();
}

function commit(next: Grid, tapped: string) {
    const t0 = performance.now();
    const after = derive(next);
    const diff = changed(village, after);
    grid = next;
    village = after;
    rebuild(diff);
    residents.update(after);
    const others = [...diff].filter(k => k !== tapped).length;
    stat.textContent = `1タップで ${diff.size} か所が かわった（まわり ${others}）· ${Math.round(performance.now() - t0)}ms${away()}`;
}

// ---------- input ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let stroke: { visited: Set<string>; next: Grid; tapped: string; moved: boolean } | null = null;

function aim(e: PointerEvent) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
}

function target(e: PointerEvent): { x: number; y: number; z: number } | null {
    aim(e);
    const hit = ray.intersectObjects([...town.children, base, sea], true).find(h => h.object.userData.pick || h.object.userData.base);
    if (!hit) return null;
    if (hit.object.userData.base) {
        const x = Math.floor(hit.point.x), z = Math.floor(hit.point.z);
        return tool === 'stack' && x >= 0 && x < W && z >= 0 && z < D ? { x, y: 0, z } : null;
    }
    const p = hit.object.userData.pick as { x: number; y: number; z: number; up?: boolean };
    if (tool === 'carve') return p;
    const n = p.up ? new THREE.Vector3(0, 1, 0) : hit.face!.normal.clone().transformDirection(hit.object.matrixWorld);
    const ax = Math.abs(n.x) > Math.abs(n.y) && Math.abs(n.x) > Math.abs(n.z) ? [Math.sign(n.x), 0, 0]
        : Math.abs(n.z) > Math.abs(n.y) ? [0, 0, Math.sign(n.z)] : [0, Math.sign(n.y), 0];
    return { x: p.x + ax[0], y: p.y + ax[1], z: p.z + ax[2] };
}

function apply(next: Grid, x: number, y: number, z: number) {
    return setBlock(next, x, y, z, tool === 'stack');
}

renderer.domElement.addEventListener('pointerdown', e => {
    if (!e.isPrimary) return;
    const t = target(e);
    if (!t) { controls.enabled = true; return; }
    controls.enabled = false;
    const next = grid.slice();
    if (!apply(next, t.x, t.y, t.z)) return;
    history.push(grid.slice());
    if (history.length > 60) history.shift();
    stroke = { visited: new Set([`${t.x},${t.z}`]), next, tapped: `b${t.x},${t.y},${t.z}`, moved: false };
    commit(next.slice(), stroke.tapped);
    renderer.domElement.setPointerCapture(e.pointerId);
}, { capture: true });

renderer.domElement.addEventListener('pointermove', e => {
    if (!stroke) return;
    aim(e);
    const hit = ray.intersectObjects([...town.children, base, sea], true).find(h => h.object.userData.pick || h.object.userData.base);
    if (!hit) return;
    const p = hit.object.userData.pick as { x: number; z: number } | undefined;
    const x = p ? p.x : Math.floor(hit.point.x), z = p ? p.z : Math.floor(hit.point.z);
    const k = `${x},${z}`;
    if (stroke.visited.has(k)) return;
    stroke.visited.add(k);
    // A stroke raises (or lowers) every column it crosses by one block.
    let top = -1;
    for (let y = H - 1; y >= 0; y--) if (solid(stroke.next, x, y, z)) { top = y; break; }
    const y = tool === 'stack' ? top + 1 : top;
    if (y < 0 || !apply(stroke.next, x, y, z)) return;
    commit(stroke.next.slice(), `b${x},${y},${z}`);
});

const end = () => { stroke = null; controls.enabled = true; };
renderer.domElement.addEventListener('pointerup', end);
renderer.domElement.addEventListener('pointercancel', end);

root.querySelector('#tool')!.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-tool]');
    if (!b) return;
    tool = b.dataset.tool as Tool;
    for (const x of root.querySelectorAll<HTMLButtonElement>('[data-tool]')) x.setAttribute('aria-pressed', String(x === b));
});
root.querySelector('#look')!.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-look]');
    if (b) { look = b.dataset.look as Look; applyLook(); }
});
root.querySelector('#time')!.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-time]');
    if (b) { time = b.dataset.time as Time; applyLook(); }
});
root.querySelector('#undo')!.addEventListener('click', () => {
    const prev = history.pop();
    if (prev) commit(prev, '');
});
root.querySelector('#reset')!.addEventListener('click', () => {
    history.push(grid.slice());
    commit(sample(), '');
});
root.querySelector<HTMLButtonElement>('[data-tool="stack"]')!.setAttribute('aria-pressed', 'true');

// ---------- loop ----------
function resize() {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Keep the whole island in a portrait phone by stepping back, not widening.
    const away = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(controls.target).addScaledVector(away, 19 * Math.max(1, 1.25 / camera.aspect * .8));
}
addEventListener('resize', resize);
resize();
rebuild(new Set());
const residents = new Residents(10, village);
scene.add(residents.group);
// Dev readout: terraces no resident can reach (three or more levels up).
const away = () => (village.stranded ? ` · いけない ばしょ ${village.stranded}` : '');
stat.textContent = away().replace(' · ', '');
let last = performance.now();

renderer.setAnimationLoop(now => {
    residents.tick(Math.min(.05, (now - last) / 1000));
    last = now;
    for (const [g, start] of bouncing) {
        const t = Math.min(1, (now - start) / 260);
        // Overshoot a little, then settle: the "ぽん".
        g.scale.setScalar(t >= 1 ? 1 : .7 + .3 * (1 - Math.cos(t * Math.PI)) / 2 + Math.sin(t * Math.PI) * .12);
        if (t >= 1) bouncing.delete(g);
    }
    controls.update();
    renderer.render(scene, camera);
});

Object.assign(window, { stackLab: { get grid() { return grid; }, get village() { return village; }, get residents() { return residents.group.children.map(c => [...c.position.toArray(), c.visible ? 1 : 0]); }, H, DIRS } });
