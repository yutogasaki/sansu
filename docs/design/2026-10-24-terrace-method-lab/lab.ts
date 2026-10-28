import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadKit, type Kit } from './assets';
import { sampleIsland } from './fixture';
import { apply, canPlace, derive, footprint, key, level, occupant, shortest, unkey, type Bridge, type Command, type Derived, type Island, type Method, type Stair } from './model';
import { CELL, fieldGeometry, oceanGeometry, pathGeometry, poolGeometry, stairGeometry, surfaceY, terraceGeometry, top, world, COLORS } from './terrain';

const GLB = new URL('../2026-10-10-island-final-3d/whole-island.glb', import.meta.url).href;
const STORE = 'sansu-terrace-lab-v1';
const params = new URLSearchParams(location.search);
const canvas = document.querySelector<HTMLCanvasElement>('#view')!;
const info = document.querySelector<HTMLElement>('#info')!;
const toast = document.querySelector<HTMLElement>('#toast')!;

const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.NeutralToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
const scene = new T.Scene(); scene.background = new T.Color('#b4c7df');
// Same lights and orthographic direction as the adopted native05 viewer.
scene.add(new T.HemisphereLight('#d5e6ff', '#b9afb6', 1.4));
const sun = new T.DirectionalLight('#ffdbc3', 1.8); sun.position.set(-16, 32, 22); sun.target.position.set(3, 2, -6);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
sun.shadow.bias = -.00035; sun.shadow.normalBias = .03; sun.shadow.intensity = .55; scene.add(sun, sun.target);
const fill = new T.DirectionalLight('#b9d6ff', 1.1); fill.position.set(12, 18, -14); scene.add(fill);
{
    const px = new Float32Array(64 * 32 * 4), horizon = new T.Color('#e8c4d0'), zenith = new T.Color('#91bada'), lower = new T.Color('#9fbed1');
    for (let y = 0; y < 32; y++) { const e = Math.cos(y / 31 * Math.PI), c = horizon.clone().lerp(e > 0 ? zenith : lower, Math.pow(Math.abs(e), .5)); for (let x = 0; x < 64; x++) px.set([c.r, c.g, c.b, 1], (y * 64 + x) * 4); }
    const sky = new T.DataTexture(px, 64, 32, T.RGBAFormat, T.FloatType); sky.mapping = T.EquirectangularReflectionMapping; sky.needsUpdate = true;
    const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(sky).texture; scene.environmentIntensity = .4;
}
const camera = new T.OrthographicCamera(-20, 20, 15, -15, .1, 220);
const DIRECTION = new T.Vector3(39, 43, 46).normalize();
const views: Record<string, { target: T.Vector3; half: number }> = {
    whole: { target: new T.Vector3(0, .8, 0), half: 13.5 },
    near: { target: new T.Vector3(1, 1, 0), half: 6.5 },
    hill: { target: new T.Vector3(4, 1.4, -5), half: 6 },
};
// The adopted viewer's whole-island framing; 'scale' puts this island at the same world scale.
const native = { whole: { target: new T.Vector3(3, 3.2, -6.3), half: 17.5 }, near: { target: new T.Vector3(5.6, 3.1, -4.2), half: 6.5 }, hill: { target: new T.Vector3(3.1, 4.9, -15.8), half: 6 } };
views.scale = { target: new T.Vector3(0, .8, 0), half: 17.5 };
let view = params.get('view') ?? 'whole';
function frame() {
    const set = method === ('N' as Method) ? native as typeof views : views;
    const v = set[view] ?? set.whole, aspect = canvas.clientWidth / canvas.clientHeight;
    Object.assign(camera, { left: -v.half * aspect, right: v.half * aspect, top: v.half, bottom: -v.half });
    camera.position.copy(v.target).addScaledVector(DIRECTION, 80); camera.lookAt(v.target); camera.updateProjectionMatrix();
}

let kit: Kit, reference: T.Object3D | undefined;
let island: Island = load() ?? sampleIsland();
let method: Method = (params.get('method') as Method) ?? 'T';
let derived: Derived, stairs: Stair[] = island.hints?.stairs ?? [], bridges: Bridge[] = island.hints?.bridges ?? [];
const undo: Command[] = [], redo: Command[] = [];
const timings: { derive: number; terrain: number; total: number }[] = [];
const root = new T.Group(); scene.add(root);
const ownerMeshes = new Map<string, T.Object3D>();
let ocean: T.Mesh | undefined, oceanKey = '';
let tool: 'up' | 'down' | 'move' = 'up', selected: string | undefined;

function load(): Island | undefined {
    if (params.has('fresh')) return undefined;
    try { const raw = localStorage.getItem(STORE); return raw ? JSON.parse(raw) : undefined; } catch { return undefined; }
}
const hash = (x: number, z: number, s = 0) => { const v = Math.sin(x * 127.1 + z * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };

function material(color?: T.Color) { return new T.MeshStandardMaterial({ vertexColors: !color, color: color ?? 0xffffff, roughness: .92 }); }
const groundMaterial = material(), pathMaterial = new T.MeshStandardMaterial({ color: COLORS.path, roughness: .9, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
const stairMaterial = new T.MeshStandardMaterial({ color: COLORS.stair, roughness: .85 });
const oceanMaterial = new T.MeshStandardMaterial({ vertexColors: true, roughness: .35, metalness: 0 });
// Mineral spring water from native05: jade-blue with a little glow of its own.
const poolMaterial = new T.MeshStandardMaterial({ color: '#5ec3dc', emissive: '#1d6f8f', emissiveIntensity: .35, roughness: .2 });
const fallMaterial = new T.MeshStandardMaterial({ color: '#9fe6e6', emissive: '#3aa7b5', emissiveIntensity: .4, roughness: .3, side: T.DoubleSide, transparent: true, opacity: .9 });

function place(object: T.Object3D, x: number, z: number, y: number, rot: number, footprintSize = 1) {
    const p = world(island, x, z); const off = (footprintSize - 1) * CELL / 2;
    object.position.set(p.x + off, y, p.z + off); object.rotation.y = rot * Math.PI / 2;
}

function rebuild(record = true) {
    const t0 = performance.now();
    derived = derive(island, method, stairs, bridges); stairs = derived.stairs; bridges = derived.bridges;
    const t1 = performance.now();
    for (const child of [...root.children]) { root.remove(child); child.traverse(o => { if (o instanceof T.Mesh && o.userData.own) o.geometry.dispose(); }); }
    ownerMeshes.clear();
    const terrain = new T.Mesh(method === 'T' ? terraceGeometry(island) : fieldGeometry(island), groundMaterial);
    terrain.receiveShadow = terrain.castShadow = true; terrain.userData.own = true; terrain.name = 'terrain'; root.add(terrain);
    const t2 = performance.now();
    const landKey = island.land.join(';') + JSON.stringify(island.heights);
    if (oceanKey !== landKey) { ocean?.geometry.dispose(); ocean = new T.Mesh(oceanGeometry(island), oceanMaterial); oceanKey = landKey; }
    root.add(ocean!);
    const path = pathGeometry(island, derived, method); if (path) { const m = new T.Mesh(path, pathMaterial); m.receiveShadow = true; m.userData.own = true; root.add(m); }
    for (const br of bridges) {
        const template = kit['bridge']; if (!template) break;
        const object = template.root.clone(true), a = world(island, ...br.a), b = world(island, ...br.b);
        object.position.copy(a.clone().lerp(b, .5)).setY(top(0) - .05);
        object.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) - Math.PI / 2;
        object.scale.set(CELL * 2 / template.size.x * .95, 1, 1); root.add(object);
    }
    if (method === 'T') { const s = stairGeometry(island, derived); if (s) { const m = new T.Mesh(s, stairMaterial); m.castShadow = m.receiveShadow = true; m.userData.own = true; root.add(m); } }
    const pools = poolGeometry(island, method);
    if (pools.water) { const m = new T.Mesh(pools.water, poolMaterial); m.userData.own = true; m.receiveShadow = true; root.add(m); }
    if (pools.falls) { const m = new T.Mesh(pools.falls, fallMaterial); m.userData.own = true; root.add(m); }
    for (const o of island.owners) {
        if (o.kind === 'pool') continue;
        const template = kit[o.variant] ?? kit[o.kind === 'house' ? kit._houses[0] : kit._species[0]];
        if (!template) continue;
        const object = template.root.clone(true); object.userData.owner = o.id;
        const size = o.kind === 'bigtree' || o.kind === 'canopy' ? 2 : 1;
        const [x, z] = o.cell, y = Math.min(...footprint(o).map(([a, b]) => surfaceY(island, method, a, b)));
        place(object, x, z, y - .03, o.rot, size);
        if (o.kind === 'bigtree') object.scale.setScalar(.62);
        if (o.kind === 'canopy') object.scale.setScalar(.55);
        if (o.kind === 'house') object.scale.setScalar(.92);
        if (o.kind === 'bench') { object.scale.setScalar(.9); }
        if (selected === o.id) object.traverse(m => { if (m instanceof T.Mesh) { m.material = (m.material as T.MeshStandardMaterial).clone(); (m.material as T.MeshStandardMaterial).emissive = new T.Color('#665500'); } });
        root.add(object); ownerMeshes.set(o.id, object);
    }
    decorate();
    const t3 = performance.now();
    if (record) timings.push({ derive: t1 - t0, terrain: t2 - t1, total: t3 - t0 });
    resident.reroute();
    sun.shadow.needsUpdate = true;
    report();
}

/** Ground cover follows rules from the same data: ferns at terrace lips, wildflowers on open meadow, rocks on the coast. */
function decorate() {
    const pathCells = new Set(derived.paths.flat()), stairCells = new Set(stairs.flatMap(s => [key(...s.upper), key(...s.lower)]));
    const doors = new Set(derived.doors.values());
    const ferns = Object.keys(kit).filter(k => k.startsWith('fern:')), wild = Object.keys(kit).filter(k => k.startsWith('wildflower:'));
    const rocks = Object.keys(kit).filter(k => k.startsWith('rock:')), leaves = Object.keys(kit).filter(k => k.startsWith('leaf:'));
    const pick = (list: string[], h: number) => list[Math.floor(h * list.length) % list.length];
    for (const k of island.land) {
        const [x, z] = unkey(k), l = level(island, x, z)!;
        if (l < 0 || stairCells.has(k) || doors.has(k)) continue;
        const o = occupant(island, x, z);
        if (o && (o.kind === 'pool' || o.kind === 'house' || o.kind === 'bench')) continue;
        const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => level(island, x + dx, z + dz));
        const lip = neighbours.some(n => n !== undefined && n >= 0 && n < l), coast = neighbours.some(n => n === undefined || n < 0);
        const count = (lip ? 2 : 0) + (coast ? 1 : 0) + (o && o.kind === 'tree' ? 2 : 0) + (hash(x, z) > .55 ? 1 : 0);
        for (let i = 0; i < count; i++) {
            const a = hash(x, z, i + 1) * Math.PI * 2, r = (pathCells.has(k) ? .78 : .35 + hash(x, z, i + 7) * .45) * CELL / 2;
            const list = o?.kind === 'tree' ? (i % 2 ? leaves : ferns) : lip ? ferns : (hash(x, z, i + 3) > .5 ? wild : leaves);
            const id = pick(list, hash(x, z, i + 9)); if (!id) continue;
            const object = kit[id].root.clone(true), p = world(island, x, z);
            object.position.set(p.x + Math.cos(a) * r, surfaceY(island, method, x, z) - .02, p.z + Math.sin(a) * r);
            object.rotation.y = hash(x, z, i + 5) * 6.28; object.scale.setScalar(.75 + hash(x, z, i + 11) * .4);
            if (method === 'G') object.position.y = surfaceAt(object.position.x, object.position.z);
            root.add(object);
        }
        if (coast && rocks.length && hash(x, z, 40) > .55) {
            const dir = neighbours.findIndex(n => n === undefined || n < 0), d = [[1, 0], [-1, 0], [0, 1], [0, -1]][dir], p = world(island, x, z);
            const object = kit[pick(rocks, hash(x, z, 41))].root.clone(true);
            object.position.set(p.x + d[0] * CELL * .62, -.05, p.z + d[1] * CELL * .62); object.scale.setScalar(.8 + hash(x, z, 42) * .5);
            root.add(object);
        }
    }
}
function surfaceAt(wx: number, wz: number) {
    const x = Math.floor(wx / CELL + island.width / 2), z = Math.floor(wz / CELL + island.depth / 2);
    if (method === 'G') {
        // Height-field: sample the derived mesh's own function.
        return fieldY(wx, wz);
    }
    return top(island.heights[key(x, z)] ?? 0);
}
import { fieldHeight } from './terrain';
const fieldY = (wx: number, wz: number) => fieldHeight(island, wx, wz);

// ---------- one resident walking the real graph ----------
const resident = (() => {
    let mesh: T.Object3D | undefined, route: string[] = [], index = 0, t = 0, wait = 0, at = key(...island.hub), goal = '';
    const log: { at: string; target: string; via: number; ms: number }[] = [];
    const targets = () => island.owners.filter(o => o.kind === 'bench' || o.kind === 'canopy' || o.kind === 'bigtree' || o.kind === 'house');
    const next = () => {
        const options = targets().map(o => ({ o, door: derived.doors.get(o.id) ?? [[1, 0], [-1, 0], [0, 1], [0, -1]].flatMap(([dx, dz]) => footprint(o).map(([x, z]) => key(x + dx, z + dz))).find(k => derived.reachable.has(k)) }))
            .filter(v => v.door && derived.reachable.has(v.door) && v.door !== at);
        if (!options.length) { route = []; return; }
        const choice = options[Math.floor(Math.random() * options.length)];
        route = shortest(derived.edges, at, choice.door); index = 0; t = 0; goal = choice.o.id;
    };
    return {
        log,
        get cell() { return at; },
        goTo(id: string, fromHub = false) {
            const o = island.owners.find(v => v.id === id); if (!o) return false;
            if (fromHub) at = key(...island.hub);
            const door = derived.doors.get(o.id) ?? [[1, 0], [-1, 0], [0, 1], [0, -1]].flatMap(([dx, dz]) => footprint(o).map(([x, z]) => key(x + dx, z + dz))).find(k => derived.reachable.has(k));
            if (!door) return false;
            route = shortest(derived.edges, at, door); index = 0; t = 0; goal = id; wait = 0; return route.length > 0;
        },
        reroute() {
            if (!mesh && kit.resident) { mesh = kit.resident.root.clone(true); mesh.scale.setScalar(1.15); scene.add(mesh); }
            if (!derived.reachable.has(at)) at = key(...island.hub);
            const current = route[index]; route = []; if (current && derived.reachable.has(current)) at = current;
            wait = .3;
        },
        tick(dt: number) {
            if (!mesh) return;
            if (wait > 0) { wait -= dt; if (wait <= 0 && !route.length) next(); }
            else if (!route.length) next();
            if (route.length > 1 && index < route.length - 1) {
                const a = unkey(route[index]), b = unkey(route[index + 1]);
                const pa = world(island, ...a), pb = world(island, ...b);
                t += dt * 2.2 / (CELL * Math.hypot(a[0] - b[0], a[1] - b[1]));
                const p = pa.clone().lerp(pb, Math.min(1, t));
                const ya = surfaceY(island, method, ...a), yb = surfaceY(island, method, ...b);
                const bridged = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 2;
                p.y = bridged ? top(0) + .38 * Math.sin(Math.PI * Math.min(1, t)) : method === 'G' ? fieldY(p.x, p.z) : ya + (yb - ya) * T.MathUtils.smoothstep(t, .1, .9);
                mesh.position.copy(p); mesh.rotation.y = Math.atan2(pb.x - pa.x, pb.z - pa.z);
                if (t >= 1) { t = 0; index++; at = route[index]; }
                if (index >= route.length - 1) {
                    const climbs = route.slice(1).filter((k, i) => (island.heights[k] ?? 0) !== (island.heights[route[i]] ?? 0)).length;
                    log.unshift({ at: new Date().toISOString().slice(11, 19), target: goal, via: climbs, ms: route.length }); log.length = Math.min(log.length, 8);
                    route = []; wait = 1.6;
                }
            } else if (route.length <= 1) {
                const p = world(island, ...unkey(at)); p.y = surfaceY(island, method, ...unkey(at)); mesh.position.copy(p);
            }
        },
    };
})();

function report() {
    const last = timings.at(-1);
    const owners = island.owners.length, lost = island.owners.filter(o => (o.kind === 'house' || o.kind === 'bench') && !derived.doors.has(o.id)).map(o => o.id);
    info.innerHTML = `<b>方式 ${method === 'T' ? 'T：段丘の輪郭から組む' : method === 'G' ? 'G：連続した高さ場（現行）' : '参照 native05'}</b><br>
        所有物 ${owners}・自動階段 ${stairs.length}・橋 ${bridges.length}・行けない区画 ${derived.unreachable.length}${lost.length ? `・入口なし ${lost.join(',')}` : ''}<br>
        直近の再生成 ${last ? `${last.total.toFixed(1)}ms（経路 ${last.derive.toFixed(1)} / 地形 ${last.terrain.toFixed(1)}）` : '-'}<br>
        住人の利用：${resident.log.slice(0, 3).map(l => `${l.at} ${l.target}${l.via ? `（段差${l.via}回）` : ''}`).join(' / ') || 'まだ'}`;
    document.body.dataset.state = JSON.stringify({ method, owners, stairs: stairs.length, bridges: bridges.length, unreachable: derived.unreachable.length, lost, timing: last });
}
function say(text: string) { toast.textContent = text; toast.hidden = false; clearTimeout((say as any).t); (say as any).t = setTimeout(() => toast.hidden = true, 1800); }

/** Same protection as the game: an edit that newly strands a home or bench door is refused. */
function guarded(command: Command): ReturnType<typeof apply> {
    const result = apply(island, command, stairs);
    if (typeof result === 'string') return result;
    const before = new Set(derived.doors.keys()), after = derive(result.island, method, stairs, bridges);
    const lost = [...before].filter(id => !after.doors.has(id));
    return lost.length ? 'いえや ベンチに いけなくなるよ' : result;
}
function run(command: Command, history = true) {
    const result = guarded(command);
    if (typeof result === 'string') { say(result); return false; }
    island = result.island; if (history) { undo.push(result.inverse); redo.length = 0; }
    rebuild(); return true;
}

// ---------- input ----------
const ray = new T.Raycaster();
canvas.addEventListener('pointerdown', event => {
    if (method === ('N' as Method)) return;
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new T.Vector2((event.clientX - r.left) / r.width * 2 - 1, -(event.clientY - r.top) / r.height * 2 + 1), camera);
    const hits = ray.intersectObjects(root.children, true);
    const ownerHit = hits.find(h => { let o: T.Object3D | null = h.object; while (o && !o.userData.owner) o = o.parent; return !!o; });
    const ground = hits.find(h => h.object.name === 'terrain') ?? hits[0];
    if (!ground && !ownerHit) return;
    const point = (ownerHit && tool === 'move' && !selected ? ownerHit : ground ?? ownerHit)!.point;
    const x = Math.floor(point.x / CELL + island.width / 2), z = Math.floor(point.z / CELL + island.depth / 2);
    if (tool === 'move') {
        if (!selected) {
            let o: T.Object3D | null = ownerHit?.object ?? null; while (o && !o.userData.owner) o = o.parent;
            const id = o?.userData.owner ?? occupant(island, x, z)?.id;
            if (id) { selected = id; rebuild(false); say('おきたい ばしょを タップしてね'); }
            return;
        }
        const id = selected; selected = undefined;
        if (!run({ type: 'move', id, cell: [x, z] })) rebuild(false);
        return;
    }
    run({ type: 'height', cell: [x, z], delta: tool === 'up' ? 1 : -1 });
});
document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(b => b.addEventListener('click', () => {
    tool = b.dataset.tool as typeof tool; selected = undefined;
    document.querySelectorAll('[data-tool]').forEach(x => x.classList.toggle('on', x === b));
}));
document.querySelectorAll<HTMLButtonElement>('[data-method]').forEach(b => b.addEventListener('click', () => setMethod(b.dataset.method as Method)));
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b => b.addEventListener('click', () => { view = b.dataset.view!; frame(); }));
const actions: Record<string, () => void> = {
    undo: () => { const c = undo.pop(); if (!c) return; const r = apply(island, c, stairs); if (typeof r === 'string') { say(r); undo.push(c); return; } island = r.island; redo.push(r.inverse); rebuild(); },
    redo: () => { const c = redo.pop(); if (!c) return; const r = apply(island, c, stairs); if (typeof r === 'string') { say(r); redo.push(c); return; } island = r.island; undo.push(r.inverse); rebuild(); },
    save: () => { try { localStorage.setItem(STORE, JSON.stringify({ ...island, hints: { stairs, bridges } })); say('ほぞんしたよ'); } catch { say('ほぞんできなかったよ'); } },
    reset: () => { island = sampleIsland(); stairs = []; bridges = []; undo.length = redo.length = 0; rebuild(); },
    stress: () => stress(12, Date.now() % 1000),
};
document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b => b.addEventListener('click', () => actions[b.dataset.action!]()));

function setMethod(next: Method) {
    method = next; document.querySelectorAll('[data-method]').forEach(x => x.classList.toggle('on', (x as HTMLElement).dataset.method === next));
    const showReference = next === ('N' as Method);
    root.visible = !showReference; if (reference) reference.visible = showReference; frame();
    if (!showReference) rebuild(false); else report();
    if (showReference && !reference) new GLTFLoader().loadAsync(GLB).then(g => { reference = g.scene; reference.traverse(o => { if (o instanceof T.Mesh) { o.castShadow = o.receiveShadow = true; } }); scene.add(reference); sun.shadow.needsUpdate = true; });
}

/** Unadjusted legal edits: random height changes and owner moves, accepted only when the rules allow. */
function stress(count: number, seed: number) {
    let accepted = 0, rejected = 0, s = seed; const reasons: Record<string, number> = {};
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = 0; accepted < count && i < count * 20; i++) {
        let command: Command;
        if (rnd() < .6) { const k = island.land[Math.floor(rnd() * island.land.length)]; command = { type: 'height', cell: unkey(k), delta: rnd() < .5 ? 1 : -1 }; }
        else { const o = island.owners[Math.floor(rnd() * island.owners.length)]; const k = island.land[Math.floor(rnd() * island.land.length)]; command = { type: 'move', id: o.id, cell: unkey(k) }; }
        const r = guarded(command);
        if (typeof r === 'string') { rejected++; reasons[r] = (reasons[r] ?? 0) + 1; continue; }
        island = r.island; undo.push(r.inverse); accepted++; rebuild();
    }
    say(`${accepted}かい へんしゅう（ことわり ${rejected}）`);
    return { accepted, rejected, reasons };
}

function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); frame(); }
new ResizeObserver(resize).observe(canvas);
let last = performance.now();
function loop(now: number) { const dt = Math.min(.05, (now - last) / 1000); last = now; resident.tick(dt); renderer.render(scene, camera); if (Math.floor(now / 500) !== Math.floor((now - dt * 1000) / 500)) report(); requestAnimationFrame(loop); }

(async () => {
    kit = await loadKit(GLB);
    document.querySelector('#loading')?.remove();
    resize(); setMethod(method); requestAnimationFrame(loop);
    Object.assign(window, { lab: { get island() { return island; }, get derived() { return derived; }, get timings() { return timings; }, get log() { return resident.log; },
        load: (json: string) => { island = JSON.parse(json); stairs = island.hints?.stairs ?? []; bridges = island.hints?.bridges ?? []; undo.length = redo.length = 0; rebuild(false); },
        run, stress, setMethod, rebuild, goTo: (id: string, fromHub = false) => resident.goTo(id, fromHub), save: () => actions.save(), get resident() { return resident.cell; }, get stairs() { return stairs; }, get bridges() { return bridges; }, canPlace: (o: any) => canPlace(island, o, stairs), setView: (v: string) => { view = v; frame(); }, kit: () => Object.keys(kit) } });
})();
