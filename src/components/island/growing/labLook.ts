import * as T from 'three';
import type { GardenTime } from '../three/garden/presentation';
import type { Cell, GrowingState } from '../../../domain/growingIsland';
import { RULES } from '../../../domain/growingIsland/rules';
import type { SceneLayout } from './sceneLayout';
import type { ObjectLayer } from './objectLayer';

/** DEV comparison only (?island-look=lab): the grow-lab's look-only parts on the real island.
 * Night glows, the lighthouse beam, beach things, boats and buoys, and fireworks when a
 * session's buds are all open. It reads the island and writes nothing (grow-lab integration.md, stage 1). */
export const labLookEnabled = () => import.meta.env.DEV && typeof location !== 'undefined'
    && new URLSearchParams(location.search).get('island-look') === 'lab';

const SEA_LEVEL = -.40;
/** Learning done on this island, from what is already saved: each completion adds the same town
 * hours to the bank, and the town only moves hours from the bank to the clock (spec 52 §10). */
export const learnedOnIsland = (state: Pick<GrowingState, 'town'>) =>
    Math.max(0, Math.floor((state.town.clock + state.town.bank) / RULES.townHoursPerCompletion));
const LANTERNS = 48, BOATS = 5;
/** What learning shows: a paper lantern for each completion (up to 48), one more boat for each town day of learning (12), up to 5. */
/** Lanterns last shown per island in this visit, so coming back from learning raises only the new ones. Never saved. */
const shownBefore = new Map<string, number>();
export const learningLook = (learned: number) => ({ lanterns: Math.min(LANTERNS, learned), boats: Math.min(BOATS, 1 + Math.floor(learned / 12)) });
const dot = (stops: [number, string][]) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const c = canvas.getContext('2d')!, g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    for (const [at, color] of stops) g.addColorStop(at, color);
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; return texture;
};
// Seeded, so the same island dresses its beach the same way every time.
const seeded = (text: string) => {
    let h = 2166136261; for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return () => { h = Math.imul(h ^ h >>> 15, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
};
// The island's own toy pastels (flowers, benches), not the lab's brighter set.
const BRIGHT = ['#f19aae', '#f5c84a', '#8fd3c0', '#99bddf', '#c9a8ec', '#f08a3c'];
const LANTERN_TONES = ['#ffd6e8', '#fff1b0', '#c9f0dc', '#d9c6ff', '#ffd9b0', '#c6e6ff'].map(c => new T.Color(c));
const LANTERN_GLOWS = ['#ff6fa8', '#ffcf3a', '#4fe0a0', '#a07cff', '#ff9a4a', '#5ab8ff'].map(c => new T.Color(c));
const FIREWORK = ['#ffe066', '#ff8fc4', '#7ff0c0', '#ffffff', '#c7a6ff'].map(c => new T.Color(c));
// How much each part shows at each time of day: window and lamp glow, the beam, fireflies.
const LOOK: Record<GardenTime, { halo: number; beam: number; glimmer: number }> = {
    morning: { halo: 0, beam: 0, glimmer: 0 }, day: { halo: 0, beam: 0, glimmer: 0 },
    dusk: { halo: .55, beam: .14, glimmer: 0 }, night: { halo: .85, beam: .24, glimmer: 1 },
};

export function createLabLook(scene: T.Scene) {
    const root = new T.Group(); root.name = 'lab-look'; scene.add(root);
    const owned: { dispose(): void }[] = [];
    const keep = <D extends { dispose(): void }>(d: D) => { owned.push(d); return d; };
    const warm = keep(dot([[0, '#fff4d0'], [.2, '#ffd27acc'], [.55, '#ffb24a33'], [1, '#ffa03000']]));
    const white = keep(dot([[0, '#ffffff'], [.35, '#ffffffcc'], [1, '#ffffff00']]));
    const haloMaterial = keep(new T.SpriteMaterial({ map: warm, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    const beamGeometry = keep((() => {
        // Narrow and tipped a little up, so from the front camera it reads as a sweep, not a spotlight on the grass.
        const geo = new T.ConeGeometry(.32, 3.4, 20, 1, true).translate(0, -1.7, 0).rotateZ(Math.PI / 2 + .1);
        const pos = geo.attributes.position, fade = new Float32Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) { const k = Math.max(0, 1 - pos.getX(i) / 3.4); fade.fill(k * k, i * 3, i * 3 + 3); }
        return geo.setAttribute('color', new T.BufferAttribute(fade, 3));
    })());
    const beamMaterial = keep(new T.MeshBasicMaterial({ color: '#ffd98a', vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
    const paint = (color: string) => keep(new T.MeshStandardMaterial({ color, roughness: .7 }));
    const bright = BRIGHT.map(paint), sandy = paint('#e8d4a4'), pole = paint('#f6f1e6'), shells = ['#ffe4ec', '#fff8ee', '#ffd2b8'].map(paint);
    // A soft striped dome, chunky like the island's benches and pots rather than a flat disc.
    const striped = keep(new T.MeshStandardMaterial({ vertexColors: true, roughness: .7 }));
    const domes = BRIGHT.map(color => keep((() => {
        const geo = new T.SphereGeometry(.21, 16, 5, 0, Math.PI * 2, 0, Math.PI * .36).scale(1, .62, 1);
        const pos = geo.attributes.position, tint = new Float32Array(pos.count * 3), a = new T.Color(color), b = new T.Color('#fbf6ee');
        for (let i = 0; i < pos.count; i++) (Math.floor((Math.atan2(pos.getZ(i), pos.getX(i)) + Math.PI) / (Math.PI / 4) + .001) % 2 ? b : a).toArray(tint, i * 3);
        return geo.setAttribute('color', new T.BufferAttribute(tint, 3));
    })()));
    const parts = {
        pole: keep(new T.CylinderGeometry(.02, .02, .34, 8)), knob: keep(new T.SphereGeometry(.025, 8, 6)), towel: keep(new T.BoxGeometry(.16, .022, .28)),
        castle: keep(new T.CylinderGeometry(.045, .055, .06, 8)), shell: keep(new T.IcosahedronGeometry(.032, 0)), ball: keep(new T.SphereGeometry(.05, 12, 8)),
        hull: keep(new T.BoxGeometry(.18, .08, .45)), sail: keep(new T.ShapeGeometry(new T.Shape([new T.Vector2(0, 0), new T.Vector2(0, .5), new T.Vector2(.28, 0)])).rotateY(Math.PI / 2)),
        mast: keep(new T.CylinderGeometry(.008, .008, .55, 5)), buoy: keep(new T.SphereGeometry(.07, 12, 8)),
    };
    const sailMaterial = keep(new T.MeshStandardMaterial({ color: '#fff8ec', side: T.DoubleSide, roughness: .8 }));

    // Fireflies over the meadow at night, and a small pool of firework sparks.
    const GLIMMERS = 36, SPARKS = 360;
    const glimmerGeometry = keep(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(new Float32Array(GLIMMERS * 3), 3)));
    const glimmers = new T.Points(glimmerGeometry, keep(new T.PointsMaterial({ size: 7, sizeAttenuation: false, map: white, color: '#d8ff9a', transparent: true, depthWrite: false, blending: T.AdditiveBlending })));
    glimmers.frustumCulled = false; root.add(glimmers);
    const sparkPos = new Float32Array(SPARKS * 3).fill(-50), sparkCol = new Float32Array(SPARKS * 3), sparkVel = new Float32Array(SPARKS * 3), sparkLife = new Float32Array(SPARKS);
    const sparkGeometry = keep(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(sparkPos, 3)).setAttribute('color', new T.BufferAttribute(sparkCol, 3)));
    const sparks = new T.Points(sparkGeometry, keep(new T.PointsMaterial({ size: 9, sizeAttenuation: false, map: white, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending })));
    sparks.frustumCulled = false; root.add(sparks);
    let nextSpark = 0, sparking = false;
    const fling = (at: T.Vector3, count: number, speed: number, rise: number, colour: T.Color, life: number) => {
        for (let i = 0; i < count; i++) {
            const k = nextSpark++ % SPARKS, a = Math.random() * Math.PI * 2, up = Math.random() * 2 - 1, flat = Math.sqrt(1 - up * up), s = speed * (.85 + Math.random() * .3);
            sparkPos.set([at.x, at.y, at.z], k * 3);
            sparkVel.set([Math.cos(a) * flat * s, up * s + rise, Math.sin(a) * flat * s], k * 3);
            sparkCol.set([colour.r, colour.g, colour.b], k * 3); sparkLife[k] = life;
        }
        sparking = true;
    };

    // Paper lanterns floating over the island, one for each learning completion.
    const lanternMesh = new T.InstancedMesh(keep(new T.LatheGeometry([[0, 0], [.05, 0], [.1, .05], [.115, .12], [.1, .19], [.05, .23], [0, .23]].map(([x, y]) => new T.Vector2(x, y)), 12)),
        keep(new T.MeshBasicMaterial({ color: '#ffffff' })), LANTERNS);
    lanternMesh.count = 0; lanternMesh.frustumCulled = false; root.add(lanternMesh);
    const lanternGlowGeometry = keep(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(new Float32Array(LANTERNS * 3), 3)).setAttribute('color', new T.BufferAttribute(new Float32Array(LANTERNS * 3), 3)));
    const lanternGlow = new T.Points(lanternGlowGeometry, keep(new T.PointsMaterial({ size: 22, sizeAttenuation: false, map: white, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending })));
    lanternGlow.frustumCulled = false; root.add(lanternGlow);
    for (let i = 0; i < LANTERNS; i++) {
        lanternMesh.setColorAt(i, LANTERN_TONES[i % LANTERN_TONES.length]);
        const c = LANTERN_GLOWS[i % LANTERN_GLOWS.length]; lanternGlowGeometry.attributes.color.setXYZ(i, c.r * .8, c.g * .8, c.b * .8);
    }
    let lanterns: { at: T.Vector3; phase: number; born: number }[] = [], learned = 0;
    const lanternAt = new T.Matrix4(), lanternPlace = new T.Vector3(), lanternScale = new T.Vector3(), lanternTurn = new T.Quaternion(), up = new T.Vector3(0, 1, 0);

    let dressed = new T.Group(); root.add(dressed);
    let halos: { sprite: T.Sprite; at: T.Vector3; reach: number }[] = [], beams: T.Mesh[] = [];
    let boats: { g: T.Group; angle: number; radius: number; speed: number }[] = [], buoys: { g: T.Group; phase: number; y: number }[] = [];
    const center = new T.Vector3(), ring = new T.Vector2(6, 6), timers: number[] = [];
    let glimmerHome: T.Vector3[] = [], reach = 6, look = LOOK.day, currentTime: GardenTime = 'day', parasols = 0;

    const clear = () => {
        dressed.removeFromParent(); dressed = new T.Group(); root.add(dressed);
        halos = []; beams = []; boats = []; buoys = [];
    };
    const halo = (at: T.Vector3, size: number, spread: number) => {
        const sprite = new T.Sprite(haloMaterial); sprite.scale.setScalar(size); sprite.position.copy(at); dressed.add(sprite);
        halos.push({ sprite, at: at.clone(), reach: spread });
    };

    return {
        root,
        /** Dress the island from what is already on it: homes and lights glow, shores get beach things, boats sail round. */
        build(state: GrowingState, layout: SceneLayout, layer: ObjectLayer) {
            clear();
            const { bounds } = layout, random = seeded(`${state.seed}:lab-look`);
            const land = (cell: Cell) => cell.x >= bounds.minX && cell.x <= bounds.maxX && cell.z >= 0 && cell.z < bounds.depth && layout.heightAt(cell) > SEA_LEVEL;
            const taken = new Set([...state.plots, ...state.landmarks].flatMap(o => o.cell ? [`${o.cell.x},${o.cell.z}`] : []));
            const box = new T.Box3(), size = new T.Vector3(), mid = new T.Vector3();
            for (const plot of state.plots) {
                const object = layer.objects.get(plot.id);
                if (!object || plot.kind !== 'home' || plot.stage < 2) continue;
                box.setFromObject(object); box.getSize(size); box.getCenter(mid);
                halo(new T.Vector3(mid.x, box.min.y + size.y * .4, mid.z), .75, Math.max(size.x, size.z) * .55);
            }
            for (const landmark of state.landmarks) {
                const object = layer.objects.get(landmark.id);
                if (!object || (landmark.kind !== 'lantern' && landmark.kind !== 'lighthouse')) continue;
                const lantern = object.localToWorld(new T.Vector3(0, landmark.kind === 'lighthouse' ? 1.3 : .5, 0));
                halo(lantern, landmark.kind === 'lighthouse' ? 1.3 : .8, 0);
                if (landmark.kind === 'lighthouse') {
                    const beam = new T.Mesh(beamGeometry, beamMaterial); beam.position.copy(lantern); beam.scale.setScalar(object.getWorldScale(new T.Vector3()).y);
                    dressed.add(beam); beams.push(beam);
                }
            }
            // Shore cells: land with sea beside it. Parasols go on free ones, shells along the edge.
            const shore: { cell: Cell; out: Cell }[] = [], meadow: Cell[] = [];
            for (let z = 0; z < bounds.depth; z++) for (let x = bounds.minX; x <= bounds.maxX; x++) {
                const cell = { x, z }; if (!land(cell)) continue;
                const out = [{ x: 0, z: 1 }, { x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: -1 }].find(d => !land({ x: x + d.x, z: z + d.z }));
                if (out) shore.push({ cell, out }); else if (!taken.has(`${x},${z}`)) meadow.push(cell);
            }
            const free = shore.filter(s => !taken.has(`${s.cell.x},${s.cell.z}`) && layout.heightAt(s.cell) < .4).sort(() => random() - .5);
            const spots: Cell[] = [];
            for (const s of free) if (spots.length < Math.min(4, Math.ceil(shore.length / 8)) && spots.every(o => Math.abs(o.x - s.cell.x) + Math.abs(o.z - s.cell.z) > 3)) {
                spots.push(s.cell);
                const spot = new T.Group(), k = spots.length;
                spot.position.copy(layout.point({ x: s.cell.x + s.out.x * .2, z: s.cell.z + s.out.z * .2 }, 0)); spot.rotation.y = Math.atan2(s.out.x, s.out.z); spot.scale.setScalar(1.6);
                const stick = new T.Mesh(parts.pole, pole); stick.position.y = .17; stick.rotation.z = .12;
                const top = new T.Mesh(domes[k % 6], striped); top.position.set(.03, .27, 0); top.rotation.z = .12;
                const knob = new T.Mesh(parts.knob, pole); knob.position.set(.05, .41, 0);
                const towel = new T.Mesh(parts.towel, bright[(k + 2) % 6]); towel.position.set(.17, .011, .03); towel.rotation.y = .3;
                spot.add(stick, top, knob, towel);
                if (k % 2) for (let c = 0; c < 3; c++) { const castle = new T.Mesh(parts.castle, sandy); castle.position.set(-.2 + c * .05, .03 + (c === 1 ? .05 : 0), .15); castle.scale.setScalar(c === 1 ? .8 : 1); spot.add(castle); }
                else { const ball = new T.Mesh(parts.ball, bright[(k + 4) % 6]); ball.position.set(-.18, .04, .12); spot.add(ball); }
                dressed.add(spot);
            }
            for (const [n, s] of shore.filter(() => random() < .45).slice(0, 18).entries()) {
                const shell = new T.Mesh(parts.shell, shells[n % 3]), side = random() - .5;
                shell.position.copy(layout.point({ x: s.cell.x + s.out.x * .38 + s.out.z * side * .7, z: s.cell.z + s.out.z * .38 + s.out.x * side * .7 }, .01));
                shell.scale.set(1, .5, 1.3); shell.rotation.y = random() * 6; dressed.add(shell);
            }
            // Boats sail round beyond the shore, buoys bob a little closer in.
            box.setFromObject(layer.root); box.getCenter(center); center.y = 0;
            reach = Math.max(layout.width, layout.depth) / 2 + 1.6;
            // Boats and buoys follow an oval round the island's own width and depth, so a long island keeps them in frame.
            ring.set(layout.width / 2 + 1.1, layout.depth / 2 + 1.1);
            boats = Array.from({ length: BOATS }, (_, i) => {
                const g = new T.Group(), hull = new T.Mesh(parts.hull, bright[(i * 2 + 4) % 6]); hull.position.y = .02;
                const mast = new T.Mesh(parts.mast, pole); mast.position.y = .3;
                const sail = new T.Mesh(parts.sail, sailMaterial); sail.position.set(0, .07, -.03);
                g.add(hull, mast, sail); g.scale.setScalar(1.5); dressed.add(g);
                return { g, angle: i * 2.5 + random() * 1.5, radius: .5 + (i % 3) * .6, speed: .07 - (i % 3) * .015 };
            });
            buoys = [0, 1, 2].map(i => {
                const g = new T.Group(), body = new T.Mesh(parts.buoy, bright[i % 2]); body.scale.set(1.4, 1.1, 1.4); g.add(body);
                const a = i / 3 * Math.PI * 2 + .6; g.position.set(center.x + Math.cos(a) * ring.x, SEA_LEVEL, center.z + Math.sin(a) * ring.y);
                dressed.add(g); return { g, phase: i * 1.3, y: SEA_LEVEL };
            });
            parasols = spots.length;
            glimmerHome = Array.from({ length: GLIMMERS }, () => {
                const cell = meadow.length ? meadow[Math.floor(random() * meadow.length)] : { x: 0, z: 0 };
                return layout.point({ x: cell.x + random() - .5, z: cell.z + random() - .5 }, .25 + random() * .35);
            });
            // Lanterns ring the things the child has grown, a few round each, always in the same places.
            learned = learnedOnIsland(state);
            const show = learningLook(learned), anchors = [...state.plots, ...state.landmarks].flatMap(o => o.cell ? [{ id: o.id, cell: o.cell }] : [])
                .sort((a, b) => a.id.localeCompare(b.id));
            if (!anchors.length) anchors.push({ id: 'middle', cell: { x: Math.round((bounds.minX + bounds.maxX) / 2), z: Math.floor(bounds.depth / 2) } });
            const now = performance.now(), before = Math.min(shownBefore.get(state.seed) ?? show.lanterns, show.lanterns);
            lanterns = Array.from({ length: show.lanterns }, (_, i) => {
                const { id, cell } = anchors[i % anchors.length], round = Math.floor(i / anchors.length), turn = seeded(`${state.seed}:${id}`)() * 6.3;
                const a = turn + round * 2.4, r = .55 + (round % 2) * .25;
                return { at: layout.point({ x: cell.x + Math.cos(a) * r, z: cell.z + Math.sin(a) * r }, 1.15 + (round % 3) * .18), phase: i * 1.7,
                    // New ones (learning since the island was last drawn) rise in one after another.
                    born: i < before ? -Infinity : now + (i - before) * 260 };
            });
            shownBefore.set(state.seed, show.lanterns); lanternMesh.count = show.lanterns; lanternGlowGeometry.setDrawRange(0, show.lanterns);
            if (lanternMesh.instanceColor) lanternMesh.instanceColor.needsUpdate = true;
            lanternGlowGeometry.attributes.color.needsUpdate = true;
            boats.forEach((b, i) => { b.g.visible = i < show.boats; });
            this.setTime(currentTime);
        },
        setTime(time: GardenTime) {
            currentTime = time; look = LOOK[time];
            haloMaterial.opacity = look.halo; beamMaterial.opacity = look.beam;
            for (const h of halos) h.sprite.visible = look.halo > 0;
            for (const b of beams) b.visible = look.beam > 0;
            glimmers.visible = look.glimmer > 0 && glimmerHome.length > 0;
            lanternGlow.visible = look.halo > 0; (lanternGlow.material as T.PointsMaterial).opacity = look.halo;
        },
        /** Every bud of a session is open: three fireworks go up over the sea, beyond the island. */
        celebrate(camera: T.Camera, reduced: boolean) {
            if (reduced) return;
            const away = center.clone().sub(camera.position).setY(0).normalize(), side = new T.Vector3(-away.z, 0, away.x);
            for (let n = 0; n < 3; n++) {
                // Out past the far shore and high, so from the front they open over the sea, not the town.
                const at = center.clone().addScaledVector(away, reach + 1).addScaledVector(side, (n - 1) * reach * .4);
                const top = 3 + reach * .35 + n % 2 * .8, colour = FIREWORK[(n * 2 + Math.floor(Math.random() * 5)) % FIREWORK.length];
                for (let t = 0; t < 6; t++) timers.push(window.setTimeout(() => fling(at.clone().setY(t * top / 6), 2, .05, 1.1, FIREWORK[3], .35), 700 * n + t * 70));
                timers.push(window.setTimeout(() => fling(at.clone().setY(top), 80, 1.5, .5, colour, 1.2), 700 * n + 450));
            }
        },
        tick(now: number, delta: number, reduced: boolean, camera: T.Camera) {
            const dt = delta / 1000, toward = new T.Vector3();
            // Window glows sit on the side of each house that faces the camera.
            if (look.halo > 0) for (const h of halos) {
                toward.copy(camera.position).sub(h.at).setY(0).normalize();
                h.sprite.position.copy(h.at).addScaledVector(toward, h.reach);
            }
            if (look.beam > 0 && !reduced) for (const b of beams) b.rotation.y = now / 1400;
            for (const b of boats) {
                if (!reduced) b.angle += b.speed * dt;
                b.g.position.set(center.x + Math.cos(b.angle) * (ring.x + b.radius), SEA_LEVEL + (reduced ? 0 : Math.sin(now / 800 + b.angle * 9) * .02), center.z + Math.sin(b.angle) * (ring.y + b.radius));
                b.g.rotation.set(0, Math.atan2(-Math.sin(b.angle) * (ring.x + b.radius), Math.cos(b.angle) * (ring.y + b.radius)), reduced ? 0 : Math.sin(now / 1000 + b.radius) * .06);
            }
            if (!reduced) for (const b of buoys) { b.g.position.y = b.y + Math.sin(now / 700 + b.phase) * .025; b.g.rotation.z = Math.sin(now / 900 + b.phase) * .15; }
            if (lanterns.length) {
                const glow = lanternGlowGeometry.attributes.position as T.BufferAttribute;
                lanterns.forEach((l, i) => {
                    const grown = reduced ? 1 : Math.max(0, Math.min(1, (now - l.born) / 700)), pop = grown < 1 ? grown * (1 + Math.sin(grown * Math.PI) * .4) : 1;
                    const y = l.at.y + (reduced ? 0 : Math.sin(now / 900 + l.phase) * .08) - (1 - grown) * .6;
                    lanternTurn.setFromAxisAngle(up, reduced ? l.phase : now / 3000 + l.phase);
                    lanternAt.compose(lanternPlace.set(l.at.x, y, l.at.z), lanternTurn, lanternScale.setScalar(Math.max(pop * 1.5, 1e-4)));
                    lanternMesh.setMatrixAt(i, lanternAt); glow.setXYZ(i, l.at.x, y + (grown > 0 ? .12 : -50), l.at.z);
                });
                lanternMesh.instanceMatrix.needsUpdate = true; glow.needsUpdate = true;
            }
            if (glimmers.visible) {
                const pos = glimmerGeometry.attributes.position as T.BufferAttribute, t = now / 1000;
                glimmerHome.forEach((home, i) => pos.setXYZ(i, home.x + (reduced ? 0 : Math.sin(t * .4 + i) * .3), home.y + (reduced ? 0 : Math.sin(t * .9 + i * 2.1) * .08), home.z + (reduced ? 0 : Math.cos(t * .33 + i * 1.3) * .3)));
                pos.needsUpdate = true;
                (glimmers.material as T.PointsMaterial).opacity = .75 + Math.sin(t * 2.3) * .2;
            }
            if (sparking) {
                sparking = false;
                for (let k = 0; k < SPARKS; k++) {
                    if (sparkLife[k] <= 0) continue;
                    sparking = true; sparkLife[k] -= dt * 1.1; sparkVel[k * 3 + 1] -= dt * 1.6;
                    for (let a = 0; a < 3; a++) { sparkPos[k * 3 + a] += sparkVel[k * 3 + a] * dt; sparkCol[k * 3 + a] *= Math.max(0, 1 - dt * 1.4); }
                    if (sparkLife[k] <= 0) sparkPos.set([0, -50, 0], k * 3);
                }
                sparkGeometry.attributes.position.needsUpdate = true; sparkGeometry.attributes.color.needsUpdate = true;
            }
        },
        /** For checking in the browser: what the island was dressed with. */
        summary: () => ({ learned, lanterns: lanterns.length, rising: lanterns.filter(l => l.born > -Infinity).length, halos: halos.length, beams: beams.length, parasols, boats: boats.filter(b => b.g.visible).length, buoys: buoys.length, glimmers: glimmers.visible }),
        dispose() { timers.forEach(clearTimeout); root.removeFromParent(); owned.forEach(d => d.dispose()); },
    };
}
export type LabLook = ReturnType<typeof createLabLook>;
