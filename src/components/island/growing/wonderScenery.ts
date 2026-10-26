import * as T from 'three';
import { BLOOM_HOURS } from '../../../domain/growingIsland/environment';
import { TERRAIN_SEA_LEVEL } from '../../../domain/growingIsland/editableTerrainWorld';
import { boatCell, floatingIsle, shipCove, waterfalls } from '../../../domain/growingIsland/discoveries';
import { moonPhase } from '../../../domain/growingIsland/sky';
import type { GrowingState } from '../../../domain/growingIsland';
import type { SceneLayout } from './sceneLayout';

const basic = (color: string, opacity = 1) => new T.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });

/** A soft round dot, drawn once and shared by the night lights. */
let glowTexture: T.Texture | undefined;
function glow() {
    if (glowTexture || typeof document === 'undefined') return glowTexture;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const g = canvas.getContext('2d'); if (!g) return undefined;
    const fill = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    fill.addColorStop(0, 'rgba(255,255,255,1)'); fill.addColorStop(.35, 'rgba(255,255,255,.55)'); fill.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = fill; g.fillRect(0, 0, 64, 64);
    return glowTexture = new T.CanvasTexture(canvas);
}

/** The moon as the sea reflects it: a disc lit by the real phase, drawn on a canvas. */
function moonTexture(phase: number) {
    if (typeof document === 'undefined') return undefined;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const g = canvas.getContext('2d'); if (!g) return undefined;
    const lit = (1 - Math.cos(phase * Math.PI * 2)) / 2, waxing = phase < .5;
    g.fillStyle = 'rgba(255,248,214,.95)';
    g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.fill();
    // The shadow slides off the disc as the moon fills: waxing from the right, waning from the left.
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(64 + (waxing ? -1 : 1) * 100 * lit, 64, 50, 0, Math.PI * 2); g.fill();
    return new T.CanvasTexture(canvas);
}

/** Stripes that scroll down a waterfall. */
function fallTexture() {
    if (typeof document === 'undefined') return undefined;
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 64;
    const g = canvas.getContext('2d'); if (!g) return undefined;
    g.fillStyle = '#9fd8f4'; g.fillRect(0, 0, 32, 64);
    g.fillStyle = 'rgba(255,255,255,.75)';
    for (let i = 0; i < 9; i++) g.fillRect((i * 7) % 30, (i * 13) % 64, 2, 14);
    const texture = new T.CanvasTexture(canvas); texture.wrapS = texture.wrapT = T.RepeatWrapping;
    return texture;
}

function boat() {
    const root = new T.Group(); root.name = 'wonder-cove-boat';
    // The lower half of a squashed sphere makes a round little hull.
    const hull = new T.Mesh(new T.SphereGeometry(.3, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new T.MeshBasicMaterial({ color: '#b97a4f', side: T.DoubleSide }));
    hull.scale.set(1.3, .5, .62); root.add(hull);
    const rim = new T.Mesh(new T.TorusGeometry(.3, .025, 6, 24), basic('#8a5a3a')); rim.rotation.x = Math.PI / 2; rim.scale.set(1.3, .62, 1); root.add(rim);
    const seat = new T.Mesh(new T.BoxGeometry(.07, .025, .34), basic('#e6c79a')); seat.position.y = -.03; root.add(seat);
    for (const side of [-1, 1]) {
        const oar = new T.Mesh(new T.BoxGeometry(.03, .02, .5), basic('#d8b483'));
        oar.position.set(.05, .02, side * .22); oar.rotation.y = Math.PI / 2 + side * .5; root.add(oar);
    }
    return root;
}

function isle() {
    const root = new T.Group(); root.name = 'wonder-floating-isle';
    const rock = new T.Mesh(new T.ConeGeometry(.6, .9, 7), basic('#b8a6cf')); rock.rotation.x = Math.PI; rock.position.y = -.45; root.add(rock);
    const top = new T.Mesh(new T.CylinderGeometry(.64, .6, .12, 9), basic('#a8d68f')); root.add(top);
    const trunk = new T.Mesh(new T.CylinderGeometry(.04, .06, .4, 6), basic('#8a6146')); trunk.position.set(.08, .26, 0); root.add(trunk);
    const crown = new T.Mesh(new T.IcosahedronGeometry(.26, 0), basic('#7cc49a')); crown.position.set(.08, .55, 0); root.add(crown);
    // A thread of water spills from the island's edge, as if the sky kept a spring.
    const drip = new T.Mesh(new T.CylinderGeometry(.015, .03, .9, 6, 1, true), basic('#cdeeff', .55)); drip.position.set(-.48, -.4, .1); root.add(drip);
    const dots = ['#e23b3b', '#ffd23f', '#3fb8e8'];
    dots.forEach((color, i) => { const dot = new T.Mesh(new T.SphereGeometry(.05, 8, 6), basic(color)); dot.position.set(Math.cos(i * 2.1) * .45, .08, Math.sin(i * 2.1) * .45); root.add(dot); });
    return root;
}

/**
 * しまの ふしぎ in the scene (§1.4): waterfalls off the child's hills, the little boat in a
 * cove, the island floating over a lord tree, and the night: fireflies over flowers, glowing
 * ふしぎの品 and the real moon's reflection with its path of light on the sea.
 */
export class WonderScenery {
    readonly root = new T.Group();
    private falls: { mesh: T.Mesh; texture?: T.Texture }[] = [];
    private floater?: { object: T.Object3D; base: T.Vector3 };
    private bobber?: { object: T.Object3D; base: T.Vector3 };
    private flies?: { points: T.Points; seeds: T.Vector3[] };
    private halos?: T.Points;
    private moon?: { disc: T.Mesh; path: T.Mesh[]; lit: number };
    private readonly aim = new T.Raycaster();
    private readonly sea = new T.Plane(new T.Vector3(0, 1, 0), -(TERRAIN_SEA_LEVEL + .05));

    constructor(parent: T.Object3D) { this.root.name = 'wonder-scenery'; parent.add(this.root); }

    build(state: GrowingState, layout: SceneLayout, now = Date.now()) {
        this.clear();
        if (layout.editable) {
            const texture = fallTexture();
            for (const { from, to } of waterfalls(state)) {
                const top = layout.point(from, 0), low = layout.point(to, 0), height = Math.max(.2, top.y - TERRAIN_SEA_LEVEL);
                const edge = new T.Vector3((top.x + low.x) / 2, TERRAIN_SEA_LEVEL + height / 2, (top.z + low.z) / 2).lerp(low.clone().setY(TERRAIN_SEA_LEVEL + height / 2), .12);
                const map = texture?.clone(); if (map) { map.needsUpdate = true; map.repeat.set(1, height * 2); }
                const mesh = new T.Mesh(new T.PlaneGeometry(.5, height), new T.MeshBasicMaterial({ color: '#ffffff', map, transparent: true, opacity: .88, side: T.DoubleSide, depthWrite: false }));
                mesh.position.copy(edge); mesh.lookAt(edge.clone().add(new T.Vector3(low.x - top.x, 0, low.z - top.z))); mesh.name = 'wonder-waterfall';
                const foam = new T.Mesh(new T.RingGeometry(.12, .3, 18), basic('#f4fbff', .7)); foam.rotation.x = -Math.PI / 2;
                foam.position.copy(low).setY(TERRAIN_SEA_LEVEL + .02).lerp(edge.clone().setY(TERRAIN_SEA_LEVEL + .02), .5); mesh.userData.foam = foam;
                this.root.add(mesh, foam); this.falls.push({ mesh, texture: map });
            }
            texture?.dispose();
            // Where the next ship already waits in the cove, the little boat gives it room.
            const cell = shipCove(state) ? undefined : boatCell(state);
            if (cell) { const object = boat(), base = layout.point(cell, 0).setY(TERRAIN_SEA_LEVEL + .06); object.position.copy(base); object.rotation.y = .6; this.root.add(object); this.bobber = { object, base }; }
            const lord = floatingIsle(state);
            if (lord) {
                const object = isle(), base = layout.point(lord, 0).add(new T.Vector3(1.3, 2.4, -.9));
                object.position.copy(base); this.root.add(object); this.floater = { object, base };
            }
        }
        // Fireflies over bloomed flowers and wild plants; ふしぎの品 glow warmly at night.
        const sprite = glow();
        const blooms = [...state.landmarks.filter(l => l.cell && l.kind === 'flower' && l.growth >= BLOOM_HOURS).map(l => l.cell!),
            ...state.plots.filter(p => p.cell && p.kind === 'wild' && p.growth >= BLOOM_HOURS).map(p => p.cell!)].slice(0, 24);
        if (blooms.length && sprite) {
            const seeds = blooms.map(cell => layout.point(cell, .35));
            const geometry = new T.BufferGeometry().setFromPoints(seeds.map(p => p.clone()));
            const points = new T.Points(geometry, new T.PointsMaterial({ map: sprite, color: '#fff3a0', size: 14, sizeAttenuation: false, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
            points.name = 'wonder-fireflies'; points.visible = false; this.root.add(points); this.flies = { points, seeds };
        }
        const wonders = state.plots.filter(p => p.cell && p.kind === 'wonder' && p.stage > 0).map(p => layout.point(p.cell!, .7));
        if (wonders.length && sprite) {
            this.halos = new T.Points(new T.BufferGeometry().setFromPoints(wonders), new T.PointsMaterial({ map: sprite, color: '#ffb7e0', size: 70, sizeAttenuation: false, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
            this.halos.name = 'wonder-halos'; this.halos.visible = false; this.root.add(this.halos);
        }
        // The moon's reflection lies on the open sea at the top of the view, shaped by today's phase.
        const phase = moonPhase(now), lit = (1 - Math.cos(phase * Math.PI * 2)) / 2;
        if (lit > .08) {
            const far = new T.Vector3(0, TERRAIN_SEA_LEVEL + .05, 0);
            const disc = new T.Mesh(new T.PlaneGeometry(1.4, 1.4), new T.MeshBasicMaterial({ map: moonTexture(phase), transparent: true, depthWrite: false }));
            disc.rotation.x = -Math.PI / 2; disc.position.copy(far); disc.name = 'wonder-moon'; disc.visible = false; disc.renderOrder = 2; this.root.add(disc);
            const path: T.Mesh[] = [];
            for (let i = 1; i <= 7; i++) {
                const streak = new T.Mesh(new T.PlaneGeometry(.9 - i * .06, .08), basic('#fff6cf', .4)); streak.rotation.x = -Math.PI / 2; streak.renderOrder = 2;
                streak.visible = false; this.root.add(streak); path.push(streak);
            }
            this.moon = { disc, path, lit };
        }
    }

    tick(now: number, night: boolean, reduced: boolean, camera?: T.Camera) {
        for (const { mesh, texture } of this.falls) {
            if (texture && !reduced) texture.offset.y = (now / 900) % 1;
            const foam = mesh.userData.foam as T.Mesh | undefined;
            if (foam && !reduced) foam.scale.setScalar(1 + Math.sin(now / 260) * .12);
        }
        if (this.bobber) {
            this.bobber.object.position.y = this.bobber.base.y + (reduced ? 0 : Math.sin(now / 700) * .025);
            this.bobber.object.rotation.z = reduced ? 0 : Math.sin(now / 900) * .06;
        }
        if (this.floater) {
            this.floater.object.position.y = this.floater.base.y + (reduced ? 0 : Math.sin(now / 1600) * .12);
            if (!reduced) this.floater.object.rotation.y = now / 9000;
        }
        if (this.flies) {
            this.flies.points.visible = night;
            if (night && !reduced) {
                const position = this.flies.points.geometry.getAttribute('position') as T.BufferAttribute;
                this.flies.seeds.forEach((seed, i) => position.setXYZ(i, seed.x + Math.sin(now / 1300 + i * 1.7) * .25, seed.y + Math.sin(now / 900 + i) * .12, seed.z + Math.cos(now / 1500 + i * 2.3) * .25));
                position.needsUpdate = true;
                (this.flies.points.material as T.PointsMaterial).opacity = .65 + Math.sin(now / 400) * .3;
            }
        }
        if (this.halos) {
            this.halos.visible = night;
            if (night && !reduced) (this.halos.material as T.PointsMaterial).opacity = .45 + Math.sin(now / 800) * .15;
        }
        if (this.moon && night && camera) {
            // Wherever the child turns or zooms, the moon lies on the sea near the top right (land in front hides it),
            // and its path of light runs toward the middle of the view.
            this.aim.setFromCamera(new T.Vector2(.55, .8), camera);
            const at = this.aim.ray.intersectPlane(this.sea, new T.Vector3());
            this.aim.setFromCamera(new T.Vector2(0, 0), camera);
            const middle = this.aim.ray.intersectPlane(this.sea, new T.Vector3());
            if (at && middle) {
                this.moon.disc.position.copy(at);
                const toward = middle.sub(at).setY(0).normalize(), angle = Math.atan2(toward.x, toward.z);
                this.moon.path.forEach((streak, i) => { streak.position.copy(at).addScaledVector(toward, (i + 1) * .5); streak.rotation.set(-Math.PI / 2, 0, angle); });
            }
        }
        if (this.moon) {
            this.moon.disc.visible = night;
            this.moon.path.forEach((streak, i) => {
                streak.visible = night;
                (streak.material as T.MeshBasicMaterial).opacity = this.moon!.lit * (.25 + (reduced ? .15 : Math.max(0, Math.sin(now / 500 + i * 1.3)) * .35));
            });
        }
    }

    private clear() {
        for (const child of [...this.root.children]) {
            child.removeFromParent();
            child.traverse(o => {
                if (o instanceof T.Mesh || o instanceof T.Points) {
                    o.geometry.dispose();
                    const material = o.material as T.Material & { map?: T.Texture | null };
                    if (material.map && material.map !== glowTexture) material.map.dispose();
                    material.dispose();
                }
            });
        }
        this.falls = []; this.floater = undefined; this.bobber = undefined; this.flies = undefined; this.halos = undefined; this.moon = undefined;
    }

    dispose() { this.clear(); this.root.removeFromParent(); }
}
