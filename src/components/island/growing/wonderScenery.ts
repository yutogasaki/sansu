import * as T from 'three';
import { BLOOM_HOURS, dugWater } from '../../../domain/growingIsland/environment';
import { landCells } from '../../../domain/growingIsland/space';
import { TERRAIN_SEA_LEVEL } from '../../../domain/growingIsland/editableTerrainWorld';
import { boatCell, floatingIsle, shipCove, waterfalls } from '../../../domain/growingIsland/discoveries';
import { moonPhase } from '../../../domain/growingIsland/sky';
import { finaleLit, type ThemeId } from '../../../domain/growingIsland/journey';
import { constellations, echoGroves, gearChain, lightFlows, mechanismProgress, tideLevel, windAngle } from '../../../domain/growingIsland/mechanisms';

/** A toothed gear wheel, flat in its own XY plane (ぜんまい島). */
function gear(radius: number, thick: number, color: string, teeth = 12) {
    const g = new T.Group(), metal = new T.MeshStandardMaterial({ color, metalness: .6, roughness: .35 });
    const rim = new T.Mesh(new T.CylinderGeometry(radius, radius, thick, 28), metal); rim.rotation.x = Math.PI / 2; g.add(rim);
    const hub = new T.Mesh(new T.CylinderGeometry(radius * .3, radius * .3, thick * 1.6, 16), new T.MeshStandardMaterial({ color: '#5a4a3c', metalness: .5, roughness: .4 })); hub.rotation.x = Math.PI / 2; g.add(hub);
    for (let i = 0; i < teeth; i++) {
        const a = i / teeth * Math.PI * 2, tooth = new T.Mesh(new T.BoxGeometry(radius * .26, radius * .26, thick), metal);
        tooth.position.set(Math.cos(a) * radius * 1.08, Math.sin(a) * radius * 1.08, 0); tooth.rotation.z = a; g.add(tooth);
    }
    for (let i = 0; i < 4; i++) { const spoke = new T.Mesh(new T.BoxGeometry(radius * 1.5, radius * .12, thick * 1.1), new T.MeshStandardMaterial({ color: '#7a6248', metalness: .5, roughness: .4 })); spoke.rotation.z = i * Math.PI / 4; g.add(spoke); }
    return g;
}

/** Each special island's sea (island-journey.md §4). */
const THEME_SEA: Record<ThemeId, { deep: string; shallow: string }> = {
    shiokaze: { deep: '#25c2c6', shallow: '#c2f7ec' }, kodama: { deep: '#2c8c8a', shallow: '#93d6c2' },
    hikari: { deep: '#14d4f4', shallow: '#dcfdff' }, watagumo: { deep: '#cfdcf2', shallow: '#ffffff' },
    karakuri: { deep: '#2a2c24', shallow: '#7a6e44' }, hoshi: { deep: '#18286a', shallow: '#4c62b0' },
};
/** The light each sign shines with after Lv20 (island-journey.md §3.3). */
const FINALE_TINT: Record<ThemeId, string> = {
    shiokaze: '#ffd6e4', kodama: '#fff2a0', hikari: '#bff8ff', watagumo: '#ffe8f6', karakuri: '#ffe27a', hoshi: '#fff6c8',
};
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
    /** A special island's own air: little things that move only there (island-journey.md §4). */
    private ambience: ((now: number, night: boolean, reduced: boolean) => void)[] = [];
    private seaMesh?: T.Mesh<T.BufferGeometry, T.ShaderMaterial>;
    private seaTone?: { deep: string; shallow: string };
    /** Where the ぜんまい島's clock tower shows its face; the bell rings there. */
    private towerFace?: T.Vector3;
    /** Played when a forest grove rings (こだま); set by the world, which owns the sound. */
    chime?: () => void;

    /**
     * その島だけの仕掛け made visible (island-journey.md §4): the tide, ringing groves, shining
     * water, the wind, power running through joined things, and constellations of lights.
     */
    private mechanism(state: GrowingState, layout: SceneLayout) {
        const done = Boolean(mechanismProgress(state)?.done), sprite = glow();
        const add = <O extends T.Object3D>(object: O, name: string) => { object.name = name; this.root.add(object); return object; };
        switch (state.theme) {
            case 'shiokaze': {
                // The sea itself breathes with the tide; shells lie on the shore only at low tide.
                this.ambience.push((_now, _n, reduced) => {
                    const tide = tideLevel(Date.now());
                    if (this.seaMesh && !reduced) this.seaMesh.position.y = (this.seaMesh.userData.baseY ??= this.seaMesh.position.y) + (tide - .5) * .12;
                    this.root.children.forEach(o => { if (o.name === 'theme-shell') o.visible = tide < .55; });
                });
                break;
            }
            case 'kodama': {
                // Each grove of three or more grown trees lights up tree by tree and rings like bells.
                echoGroves(state).forEach((grove, g) => {
                    const tops = grove.map(cell => layout.point(cell, 2));
                    if (!sprite) return;
                    const lights = add(new T.Points(new T.BufferGeometry().setFromPoints(tops), new T.PointsMaterial({ map: sprite, color: '#fff2a0', size: 70, sizeAttenuation: false, transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending, opacity: 0 })), 'mechanism-echo');
                    let rang = -1;
                    this.ambience.push((now, _n, reduced) => {
                        const round = Math.floor((now / 1000 + g * 3) / 7), t = (now / 1000 + g * 3) % 7;
                        // A soft glow always marks a ringing grove; every few seconds it swells as the bells ring.
                        (lights.material as T.PointsMaterial).opacity = .25 + (t < 3 ? (reduced ? .4 : Math.sin(t / 3 * Math.PI)) * .7 : 0);
                        if (t < .2 && round !== rang) { rang = round; this.chime?.(); }
                    });
                });
                break;
            }
            case 'hikari': {
                // Water shines; the longer a joined flow, the brighter it is.
                lightFlows(state).forEach((flow, f) => {
                    if (!sprite) return;
                    const at = flow.map(cell => layout.point(cell, .08));
                    const shine = add(new T.Points(new T.BufferGeometry().setFromPoints(at), new T.PointsMaterial({ map: sprite, color: flow.length >= 4 ? '#bff8ff' : '#8fe6ff', size: 18 + Math.min(30, flow.length * 5), sizeAttenuation: false, transparent: true, depthWrite: false, blending: T.AdditiveBlending })), 'mechanism-light-water');
                    this.ambience.push((now, _n, reduced) => { (shine.material as T.PointsMaterial).opacity = .45 + (reduced ? 0 : Math.sin(now / 700 + f) * .2) + Math.min(.3, flow.length * .04); });
                });
                break;
            }
            case 'watagumo': {
                // A weathervane on the island's back corner points where today's wind blows.
                const vane = add(new T.Group(), 'mechanism-weathervane');
                vane.position.copy(layout.point({ x: 0, z: 0 }, 1.1));
                const pole = new T.Mesh(new T.CylinderGeometry(.02, .02, .8, 6), new T.MeshStandardMaterial({ color: '#8a6a4a' })); pole.position.y = -.4; vane.add(pole);
                const arrow = new T.Mesh(new T.ConeGeometry(.12, .5, 8), new T.MeshStandardMaterial({ color: '#f2c230', metalness: .4 })); arrow.rotation.z = -Math.PI / 2; vane.add(arrow);
                this.ambience.push(() => { vane.rotation.y = -windAngle(state, Date.now()); });
                break;
            }
            case 'karakuri': {
                // Every thing the power reaches wears a turning gear; all joined, the clock tower rings.
                gearChain(state).forEach((cell, i) => {
                    const cog = new T.Group(); const metal = new T.MeshStandardMaterial({ color: i % 2 ? '#c9a24a' : '#9aa3a8', metalness: .6, roughness: .3 });
                    const disc = new T.Mesh(new T.CylinderGeometry(.22, .22, .04, 16), metal); disc.rotation.x = Math.PI / 2; cog.add(disc);
                    for (let k = 0; k < 10; k++) { const tooth = new T.Mesh(new T.BoxGeometry(.08, .08, .04), metal); const a = k / 10 * Math.PI * 2; tooth.position.set(Math.cos(a) * .25, Math.sin(a) * .25, 0); cog.add(tooth); }
                    cog.position.copy(layout.point(cell, .95)); add(cog, 'mechanism-cog');
                    this.ambience.push((now, _n, reduced) => { if (!reduced) cog.rotation.z = (i % 2 ? -1 : 1) * now / 600; });
                });
                if (done && sprite) {
                    const bell = add(new T.Points(new T.BufferGeometry().setFromPoints([this.towerFace ?? new T.Vector3(layout.width / 2 + 2.6, 2.6, -2 - 2.3)]), new T.PointsMaterial({ map: sprite, color: '#ffe27a', size: 90, sizeAttenuation: false, transparent: true, depthWrite: false, blending: T.AdditiveBlending })), 'mechanism-bell');
                    this.ambience.push((now, _n, reduced) => { (bell.material as T.PointsMaterial).opacity = reduced ? .5 : .35 + Math.max(0, Math.sin(now / 500)) * .5; });
                }
                break;
            }
            case 'hoshi': {
                // The lights' constellations are drawn above the island in lines of starlight.
                constellations(state).forEach(group => {
                    const stars = group.map(cell => layout.point(cell, 2.3));
                    const lines: T.Vector3[] = [];
                    for (let i = 1; i < stars.length; i++) {
                        const nearest = stars.slice(0, i).sort((a, b) => a.distanceTo(stars[i]) - b.distanceTo(stars[i]))[0];
                        lines.push(nearest, stars[i]);
                    }
                    add(new T.LineSegments(new T.BufferGeometry().setFromPoints(lines), new T.LineBasicMaterial({ color: '#fff2b0', transparent: true, opacity: .7 })), 'mechanism-constellation');
                    if (sprite) add(new T.Points(new T.BufferGeometry().setFromPoints(stars), new T.PointsMaterial({ map: sprite, color: '#fff6c8', size: 26, sizeAttenuation: false, transparent: true, depthWrite: false, blending: T.AdditiveBlending })), 'mechanism-stars');
                });
                break;
            }
        }
    }

    /**
     * Each special island's big sign on the far side of its sea, seen the moment the island
     * opens: a giant conch, an ancient tree, a glowing arch, cloud islets, rock spires, a moon arch.
     */
    private landmark(theme: ThemeId, layout: SceneLayout, finale = false) {
        const far = -2 - 1.7, left = -layout.width / 2 - .6, right = layout.width / 2 + .4, sea = TERRAIN_SEA_LEVEL;
        const group = new T.Group(); group.name = `theme-landmark-${theme}`; this.root.add(group);
        const solid = (color: string, emissive?: string) => new T.MeshStandardMaterial({ color, roughness: .7, ...(emissive ? { emissive, emissiveIntensity: .6 } : {}) });
        const put = (geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number) => { const mesh = new T.Mesh(geometry, material); mesh.position.set(x, y, z); group.add(mesh); return mesh; };
        if (theme === 'shiokaze') {
            // A giant spiral conch rising from the shallows.
            for (let i = 0; i < 6; i++) put(new T.TorusGeometry(1.1 - i * .16, .28 - i * .03, 10, 28), solid(i % 2 ? '#fbe3ec' : '#fff4e6'), left, sea + .3 + i * .36, far).rotation.x = Math.PI / 2;
            put(new T.ConeGeometry(.22, .6, 12), solid('#f5c6d6'), left, sea + 2.5, far);
        } else if (theme === 'kodama') {
            // An ancient tree, far older than the island, standing behind it.
            group.scale.setScalar(.72); group.position.set(right * .28, 0, far * .28);
            put(new T.CylinderGeometry(.45, .8, 4.2, 12), solid('#7a5a40'), right, 2.1, far);
            for (const [x, y, z, r] of [[0, 4.4, 0, 1.9], [-1.2, 3.8, .4, 1.3], [1.2, 3.9, -.2, 1.4], [0, 5.4, -.3, 1.2]]) put(new T.IcosahedronGeometry(r, 1), solid('#3f8a55'), right + x, y, far + z);
            for (let i = 0; i < 6; i++) put(new T.ConeGeometry(.08, .14, 8), solid('#f2c230', '#8a6a00'), right + Math.cos(i) * 1.6, 3.6 + (i % 3) * .5, far + Math.sin(i) * 1.1);
        } else if (theme === 'hikari') {
            // An arch of clear, glowing glass standing in the sea.
            put(new T.TorusGeometry(1.5, .22, 14, 40, Math.PI), new T.MeshStandardMaterial({ color: '#bff6ff', emissive: '#4fd8f0', emissiveIntensity: .7, transparent: true, opacity: .75, roughness: .1 }), left, sea, far);
            for (let i = 0; i < 4; i++) put(new T.OctahedronGeometry(.18), solid('#e6fbff', '#7fe8ff'), left + (i - 1.5) * .9, sea + .2, far + .8);
        } else if (theme === 'watagumo') {
            // The island floats in the sky: a sea of cloud billows all around it.
            for (let i = 0; i < 26; i++) {
                const a = i / 26 * Math.PI * 2, r = Math.max(layout.width, layout.depth) / 2 + 1.4 + (i % 3) * .7;
                const puff = new T.Mesh(new T.SphereGeometry(.7 + (i % 4) * .25, 14, 10), solid('#ffffff')); puff.scale.y = .45;
                puff.position.set(Math.cos(a) * r, sea + .1, layout.depth / 2 - 2 + Math.sin(a) * r * .8); group.add(puff);
                this.ambience.push((now, _n, reduced) => { if (!reduced) puff.position.y = sea + .1 + Math.sin(now / 2400 + i) * .06; });
            }
            // Little cloud islets drifting in the sky above the far sea.
            for (let i = 0; i < 3; i++) {
                const islet = new T.Group(); islet.position.set(-2.5 + i * 3, 3.2 + (i % 2) * .7, far - .5 * i); group.add(islet);
                for (const [x, y, r] of [[0, 0, .7], [.6, .1, .5], [-.6, .05, .55], [.2, .35, .45]]) { const puff = new T.Mesh(new T.SphereGeometry(r, 14, 10), solid('#ffffff')); puff.position.set(x, y, 0); islet.add(puff); }
                const flower = new T.Mesh(new T.SphereGeometry(.22, 12, 10), solid('#c9b4f2')); flower.position.set(0, .9, 0); islet.add(flower);
                this.ambience.push((now, _n, reduced) => { if (!reduced) islet.position.y = 3.2 + (i % 2) * .7 + Math.sin(now / 1800 + i) * .2; });
            }
        } else if (theme === 'karakuri') {
            // Giant brass gears rising out of the sea, meshing and turning (the clock tower stands on the island).
            [[left, 1.7, '#c9a24a', 1], [left + 2.6, 1.1, '#8f9aa4', -1.55], [right + .3, 1.4, '#b8863c', 1.2]].forEach(([x, r, color, turn], i) => {
                const wheel = gear(r as number, .35, color as string, 14); wheel.position.set(x as number, sea + (r as number) * .55, far - i * .2); group.add(wheel);
                this.ambience.push((now, _n, reduced) => { if (!reduced) wheel.rotation.z = now / 1500 * (turn as number); });
            });
        } else if (theme === 'hoshi') {
            // A crescent moon arch standing in the sea, with star lanterns hanging from it.
            const moon = put(new T.TorusGeometry(1.6, .3, 12, 40, Math.PI * 1.3), new T.MeshStandardMaterial({ color: '#fff2b0', emissive: '#ffd860', emissiveIntensity: .8, roughness: .3 }), right, sea + 1.6, far);
            moon.rotation.z = -.6;
            for (let i = 0; i < 5; i++) put(new T.OctahedronGeometry(.12), solid('#fff6c8', '#ffe27a'), right - 1.2 + i * .6, sea + .8 + Math.sin(i) * .4, far + .5);
        }
        group.traverse(o => { if (o instanceof T.Mesh) o.castShadow = false; });
        // しあげ (island-journey.md §3.3): after Lv20 the sign shines, a pillar of light rising from the sea behind it.
        const sprite = glow();
        if (!finale || !sprite) return;
        group.updateMatrixWorld(true);
        // The sky island's cloud sea surrounds the land, so its sign is the cloud islets above the far sea.
        const box = new T.Box3();
        (theme === 'watagumo' ? group.children.filter(child => child instanceof T.Group) : [group]).forEach(part => box.expandByObject(part));
        const center = box.getCenter(new T.Vector3()), top = box.max.y;
        const tint = FINALE_TINT[theme];
        const halo = new T.Points(new T.BufferGeometry().setFromPoints([center]), new T.PointsMaterial({ map: sprite, color: tint, size: 260, sizeAttenuation: false, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
        halo.name = 'theme-finale-halo'; this.root.add(halo);
        const pillar = new T.Mesh(new T.CylinderGeometry(.18, .55, 9, 18, 1, true), new T.MeshBasicMaterial({ color: tint, transparent: true, opacity: .18, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending }));
        pillar.position.set(center.x, top + 4.5 - 1, center.z - .3); pillar.name = 'theme-finale-pillar'; this.root.add(pillar);
        // Sparks of the same light rise around the sign, so it reads as shining even from far away.
        const radius = Math.max(.8, box.getSize(new T.Vector3()).x / 2), seeds = Array.from({ length: 28 }, (_, i) => i);
        const sparks = new T.Points(new T.BufferGeometry().setFromPoints(seeds.map(() => center.clone())), new T.PointsMaterial({ map: sprite, color: tint, size: 16, sizeAttenuation: false, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
        sparks.name = 'theme-finale-sparks'; this.root.add(sparks);
        this.ambience.push((now, _n, reduced) => {
            const pulse = reduced ? .5 : .5 + Math.sin(now / 900) * .5;
            (halo.material as T.PointsMaterial).opacity = .45 + pulse * .35;
            (pillar.material as T.MeshBasicMaterial).opacity = .12 + pulse * .12;
            const position = sparks.geometry.getAttribute('position') as T.BufferAttribute;
            seeds.forEach(i => {
                const rise = reduced ? (i % 7) / 7 : (now / 3200 + i * .137) % 1, a = i * 2.4 + rise * 1.5;
                position.setXYZ(i, center.x + Math.cos(a) * radius * (1 - rise * .4), box.min.y + rise * (top - box.min.y + 2.5), center.z + Math.sin(a) * radius * .6);
            });
            position.needsUpdate = true;
            (sparks.material as T.PointsMaterial).opacity = .55 + pulse * .4;
        });
    }

    /**
     * Each special island's sides change its outline (island-journey.md §4): coral and shells,
     * arching roots and moss, crystal, a bed of cloud, star crystals. (The ぜんまい島's gears and pipes are with its ambience.)
     */
    private edges(theme: ThemeId, edge: { x: number; z: number }[], own: Set<string>, layout: SceneLayout, seeded: (i: number) => number) {
        const outward = (cell: { x: number; z: number }) => [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => !own.has(`${cell.x + dx},${cell.z + dz}`))!;
        const mat = (color: string, emissive?: string, extra: T.MeshStandardMaterialParameters = {}) => new T.MeshStandardMaterial({ color, roughness: .6, ...(emissive ? { emissive, emissiveIntensity: .8 } : {}), ...extra });
        const at = (cell: { x: number; z: number }, out: number, drop: number) => { const [dx, dz] = outward(cell), p = layout.point(cell, 0); return { p: new T.Vector3(p.x + dx * out, p.y - drop, p.z + dz * out), dx, dz }; };
        const place = (object: T.Object3D, name: string) => { object.name = name; this.root.add(object); return object; };
        edge.forEach((cell, i) => {
            if (theme === 'shiokaze') {
                if (i % 3 === 0) {
                    const coral = new T.Group(), { p } = at(cell, .52, .2), color = i % 2 ? '#ff8a7a' : '#ffb35c';
                    for (let k = 0; k < 4; k++) { const arm = new T.Mesh(new T.CylinderGeometry(.03, .05, .35 + seeded(i + k) * .25, 6), mat(color)); arm.position.set((k - 1.5) * .08, .18, (k % 2) * .06); arm.rotation.z = (k - 1.5) * .35; coral.add(arm); const tip = new T.Mesh(new T.SphereGeometry(.05, 8, 6), mat(color)); tip.position.set((k - 1.5) * .16, .38, (k % 2) * .06); coral.add(tip); }
                    coral.position.copy(p); place(coral, 'theme-coral');
                } else if (i % 3 === 1) {
                    const { p, dx, dz } = at(cell, .5, .25), shell = new T.Mesh(new T.SphereGeometry(.26, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#fff0f2', undefined, { roughness: .25, metalness: .2 }));
                    shell.scale.set(1, .5, 1); shell.position.copy(p); shell.rotation.set(dz * .9, 0, -dx * .9); place(shell, 'theme-big-shell');
                }
            } else if (theme === 'kodama') {
                if (i % 3 === 0) {
                    // A root arches out over the edge and back into the sea.
                    const { p, dx, dz } = at(cell, .3, -.02), root = new T.Mesh(new T.TorusGeometry(.42, .08, 8, 18, Math.PI), mat('#5a3e2a', undefined, { roughness: .95 }));
                    root.position.copy(p).setY(p.y - .25); root.rotation.y = Math.atan2(dx, dz) + Math.PI / 2; place(root, 'theme-root');
                } else if (i % 3 === 1) {
                    const { p } = at(cell, .47, .2), moss = new T.Mesh(new T.SphereGeometry(.3, 12, 8), mat('#4f8f3e', undefined, { roughness: 1 }));
                    moss.scale.set(1, .55, 1); moss.position.copy(p); place(moss, 'theme-moss');
                }
            } else if (theme === 'hikari') {
                if (i % 2 === 0) {
                    const cluster = new T.Group(), { p, dx, dz } = at(cell, .5, .1);
                    for (let k = 0; k < 3; k++) {
                        const shard = new T.Mesh(new T.OctahedronGeometry(.13), mat('#b8fff8', '#38d0d8', { transparent: true, opacity: .8, roughness: .05, metalness: .1 }));
                        shard.scale.set(.6, 2 + seeded(i + k) * 1.4, .6); shard.position.set((k - 1) * .12, .15 + k * .03, 0); shard.rotation.set(dz * .5, 0, -dx * .5 + (k - 1) * .3); cluster.add(shard);
                    }
                    cluster.position.copy(p); place(cluster, 'theme-crystal');
                    this.ambience.push((now, _n, reduced) => { if (!reduced) cluster.children.forEach((shard, k) => { ((shard as T.Mesh).material as T.MeshStandardMaterial).emissiveIntensity = .6 + Math.sin(now / 800 + i + k) * .3; }); });
                }
            } else if (theme === 'watagumo') {
                // The island sits on a bed of cloud that hides its sides.
                const { p } = at(cell, .42, .35);
                for (let k = 0; k < 2; k++) {
                    const puff = new T.Mesh(new T.SphereGeometry(.34 + seeded(i * 2 + k) * .18, 14, 10), mat('#ffffff', undefined, { roughness: 1 }));
                    puff.position.copy(p).add(new T.Vector3((seeded(i + k) - .5) * .5, -k * .18, (seeded(i + k + 7) - .5) * .5)); place(puff, 'theme-cloud-bed');
                    const base = puff.position.y; this.ambience.push((now, _n, reduced) => { if (!reduced) puff.position.y = base + Math.sin(now / 2400 + i + k) * .04; });
                }
            } else if (theme === 'hoshi') {
                if (i % 2 === 0) {
                    const { p } = at(cell, .5, -.12 - seeded(i) * .25), star = new T.Mesh(new T.OctahedronGeometry(.15), mat('#fff3b0', '#ffd860', { flatShading: true }));
                    star.scale.set(1, 1.7, 1); star.position.copy(p); place(star, 'theme-star-crystal');
                    this.ambience.push((now, _n, reduced) => { if (!reduced) { star.rotation.y = now / 1500 + i; (star.material as T.MeshStandardMaterial).emissiveIntensity = .6 + Math.sin(now / 500 + i) * .4; } });
                }
            }
        });
    }

    /** The island's own plants in place of the home meadow's tufts, on open land only. */
    private flora(state: GrowingState, layout: SceneLayout, seeded: (i: number) => number) {
        const taken = new Set([...state.plots, ...state.landmarks, ...state.keepsakes].filter(o => o.cell).map(o => `${o.cell!.x},${o.cell!.z}`));
        const open = landCells(state).filter(c => !taken.has(`${c.x},${c.z}`) && !(c.x >= 2 && c.x <= 3 && c.z <= 1));
        const mat = (color: string, emissive?: string) => new T.MeshStandardMaterial({ color, roughness: .8, ...(emissive ? { emissive, emissiveIntensity: .5 } : {}) });
        const kinds: Record<ThemeId, (g: T.Group, i: number) => void> = {
            shiokaze: (g, i) => { for (let k = 0; k < 4; k++) { const blade = new T.Mesh(new T.ConeGeometry(.025, .32, 4), mat('#e6d88f')); blade.position.set((k - 1.5) * .04, .16, (k % 2) * .03); blade.rotation.z = (k - 1.5) * .25; g.add(blade); } if (i % 3 === 0) { const shell = new T.Mesh(new T.SphereGeometry(.06, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat('#fbe3ec')); shell.position.x = .15; g.add(shell); } },
            kodama: (g, i) => { if (i % 2) { for (let k = 0; k < 5; k++) { const frond = new T.Mesh(new T.ConeGeometry(.05, .4, 4), mat('#4f9a5a')); frond.rotation.z = Math.PI / 2.6; frond.rotation.y = k * 1.26; frond.position.y = .12; g.add(frond); } } else { const cap = new T.Mesh(new T.SphereGeometry(.09, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#d85a4a')); cap.position.y = .12; const stem = new T.Mesh(new T.CylinderGeometry(.025, .03, .12, 6), mat('#f4ead6')); stem.position.y = .06; g.add(stem, cap); } },
            hikari: g => { const moss = new T.Mesh(new T.SphereGeometry(.11, 10, 8), mat('#7fe0c8', '#2fb8a0')); moss.scale.y = .55; moss.position.y = .04; g.add(moss); for (let k = 0; k < 3; k++) { const reed = new T.Mesh(new T.CylinderGeometry(.012, .012, .35, 4), mat('#9fd8b8')); reed.position.set(.1 + k * .03, .17, -.05); g.add(reed); } },
            watagumo: (g, i) => { const stem = new T.Mesh(new T.CylinderGeometry(.01, .01, .3, 4), mat('#8fbf6a')); stem.position.y = .15; const puff = new T.Mesh(new T.SphereGeometry(.07, 10, 8), mat(i % 3 ? '#ffffff' : '#ffd6ec')); puff.position.y = .32; g.add(stem, puff); },
            karakuri: (g, i) => {
                if (i % 3 === 0) { const pipe = new T.Mesh(new T.CylinderGeometry(.035, .035, .34, 8), new T.MeshStandardMaterial({ color: '#b8863c', metalness: .6, roughness: .35 })); pipe.position.y = .17; const cap = new T.Mesh(new T.CylinderGeometry(.06, .06, .05, 10), new T.MeshStandardMaterial({ color: '#8f9aa4', metalness: .6, roughness: .3 })); cap.position.y = .36; g.add(pipe, cap); }
                else { const cog = gear(.09, .03, i % 2 ? '#c9a24a' : '#9aa3a8', 8); cog.rotation.x = -Math.PI / 2; cog.position.y = .03; cog.name = 'theme-cog'; g.add(cog); }
            },
            hoshi: (g, i) => { const stem = new T.Mesh(new T.CylinderGeometry(.01, .012, .22, 4), mat('#5a7a8a')); stem.position.y = .11; const bloom = new T.Mesh(new T.OctahedronGeometry(.05), mat(i % 2 ? '#bcd8ff' : '#fff2b0', i % 2 ? '#5a8ad8' : '#d8b040')); bloom.position.y = .24; g.add(stem, bloom); },
        };
        open.forEach((cell, i) => {
            if (seeded(i + 40) < .35) return;
            for (let k = 0; k < 2; k++) {
                const g = new T.Group(); g.name = 'theme-flora';
                g.position.copy(layout.point({ x: cell.x + (seeded(i * 3 + k) - .5) * .7, z: cell.z + (seeded(i * 5 + k) - .5) * .7 }, 0));
                g.rotation.y = seeded(i + k) * 6; kinds[state.theme!](g, i + k); this.root.add(g);
            }
        });
    }
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
        if (state.theme) { this.themeAmbience(state, layout); this.mechanism(state, layout); }
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

    private themeAmbience(state: GrowingState, layout: SceneLayout) {
        const sprite = glow(), land = landCells(state), own = new Set(land.map(c => `${c.x},${c.z}`));
        const edge = land.filter(c => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !own.has(`${c.x + dx},${c.z + dz}`)));
        const seeded = (i: number) => { const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return x - Math.floor(x); };
        const points = (at: T.Vector3[], color: string, size: number, name: string) => {
            if (!sprite || !at.length) return undefined;
            const object = new T.Points(new T.BufferGeometry().setFromPoints(at), new T.PointsMaterial({ map: sprite, color, size, sizeAttenuation: false, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
            object.name = name; this.root.add(object); return object;
        };
        const drift = (object: T.Points | undefined, base: T.Vector3[], move: (p: T.Vector3, i: number, now: number) => void, flicker?: (now: number) => number) => {
            if (!object) return;
            this.ambience.push((now, _night, reduced) => {
                if (reduced) return;
                const position = object.geometry.getAttribute('position') as T.BufferAttribute, p = new T.Vector3();
                base.forEach((b, i) => { p.copy(b); move(p, i, now); position.setXYZ(i, p.x, p.y, p.z); });
                position.needsUpdate = true;
                if (flicker) (object.material as T.PointsMaterial).opacity = flicker(now);
            });
        };
        const sea = TERRAIN_SEA_LEVEL + .03;
        this.landmark(state.theme!, layout, finaleLit(state));
        this.flora(state, layout, seeded);
        this.edges(state.theme!, edge, own, layout, seeded);
        // The default meadow tufts belong to the home island; a special island grows its own plants.
        const details = this.root.parent?.getObjectByName('garden-ground-details'); if (details) details.visible = false;
        this.seaMesh = this.root.parent?.getObjectByName('life-sea') as T.Mesh<T.BufferGeometry, T.ShaderMaterial> | undefined;
        this.seaTone = THEME_SEA[state.theme!];
        switch (state.theme) {
            case 'shiokaze': {
                // Shells on the shore and foam rings riding the shallows.
                edge.slice(0, 10).forEach((cell, i) => {
                    const shell = new T.Mesh(new T.ConeGeometry(.05, .09, 7), basic(i % 2 ? '#fbe3ec' : '#fff7ea'));
                    shell.position.copy(layout.point({ x: cell.x + (seeded(i) - .5) * .6, z: cell.z + (seeded(i + 9) - .5) * .6 }, .04)); shell.rotation.z = Math.PI / 2; shell.rotation.y = seeded(i) * 6;
                    shell.name = 'theme-shell'; this.root.add(shell);
                });
                edge.slice(0, 6).forEach((cell, i) => {
                    const foam = new T.Mesh(new T.RingGeometry(.12, .2, 18), basic('#ffffff', .55)); foam.rotation.x = -Math.PI / 2; foam.name = 'theme-foam';
                    const out = layout.point(cell, 0); out.add(out.clone().setY(0).normalize().multiplyScalar(.9)).setY(sea); foam.position.copy(out); this.root.add(foam);
                    this.ambience.push((now, _n, reduced) => { if (!reduced) { const t = (now / 2200 + i * .37) % 1; foam.scale.setScalar(.6 + t * 1.2); (foam.material as T.MeshBasicMaterial).opacity = .55 * (1 - t); } });
                });
                break;
            }
            case 'kodama': {
                // Shafts of sunlight between the trees, and leaves drifting down.
                land.filter((_, i) => i % 7 === 3).slice(0, 4).forEach((cell, i) => {
                    const beam = new T.Mesh(new T.CylinderGeometry(.1, .28, 3.4, 12, 1, true), new T.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: .05, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending }));
                    beam.position.copy(layout.point(cell, 1.7)); beam.rotation.z = .25; beam.name = 'theme-sunbeam'; this.root.add(beam);
                    this.ambience.push((now, night) => { beam.visible = !night; (beam.material as T.MeshBasicMaterial).opacity = .04 + Math.sin(now / 1800 + i) * .02; });
                });
                const base = land.slice(0, 16).map((cell, i) => layout.point({ x: cell.x + seeded(i) - .5, z: cell.z + seeded(i + 3) - .5 }, 1.2 + seeded(i + 5) * 1.2));
                drift(points(base.map(p => p.clone()), '#9fd27a', 9, 'theme-leaves'), base, (p, i, now) => {
                    const fall = ((now / 4200 + seeded(i)) % 1); p.y -= fall * 1.4; p.x += Math.sin(now / 700 + i) * .15; p.z += Math.cos(now / 900 + i) * .1;
                });
                break;
            }
            case 'hikari': {
                // Light living in the clear water: drifting glints over every dug and shore cell.
                const water = [...dugWater(state), ...edge.slice(0, 8)];
                const base = water.map((cell, i) => layout.point({ x: cell.x + (seeded(i) - .5) * .7, z: cell.z + (seeded(i + 2) - .5) * .7 }, 0).setY(sea + .02));
                drift(points(base.map(p => p.clone()), '#9ff0ff', 12, 'theme-glints'), base, (p, i, now) => { p.x += Math.sin(now / 1500 + i * 2) * .12; p.z += Math.cos(now / 1700 + i) * .12; },
                    now => .55 + Math.sin(now / 500) * .3);
                break;
            }
            case 'watagumo': {
                // Cloud shadows sliding over the hills, and fluff rising on the wind.
                for (let i = 0; i < 3; i++) {
                    const shadow = new T.Mesh(new T.CircleGeometry(1.4 + i * .4, 28), new T.MeshBasicMaterial({ color: '#3a4a6a', transparent: true, opacity: .13, depthWrite: false, depthTest: false })); shadow.rotation.x = -Math.PI / 2; shadow.scale.y = .6; shadow.name = 'theme-cloud-shadow';
                    shadow.renderOrder = 2; this.root.add(shadow);
                    this.ambience.push((now, night, reduced) => {
                        shadow.visible = !night;
                        const t = ((reduced ? 0 : now / 26000) + i / 3) % 1;
                        shadow.position.set(-layout.width / 2 - 2 + t * (layout.width + 4), .05, layout.depth / 2 - 2 + (i - 1) * 1.6);
                    });
                }
                const base = land.slice(0, 14).map((cell, i) => layout.point(cell, .2 + seeded(i) * .3));
                drift(points(base.map(p => p.clone()), '#ffffff', 10, 'theme-fluff'), base, (p, i, now) => {
                    const rise = (now / 5200 + seeded(i)) % 1, wind = windAngle(state, Date.now());
                    p.y += rise * 2.2; p.x += Math.cos(wind) * rise * 1.6 + Math.sin(now / 900 + i) * .1; p.z += Math.sin(wind) * rise * 1.6;
                });
                break;
            }
            case 'karakuri': {
                // The ground is riveted steel plate: a seam around every cell and a rivet at each corner.
                const seams: T.Vector3[] = [], rivets: T.Vector3[] = [];
                land.forEach(c => {
                    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dz]) => layout.point({ x: c.x + dx * .47, z: c.z + dz * .47 }, .015));
                    corners.forEach((at, i) => { seams.push(at, corners[(i + 1) % 4]); rivets.push(at); });
                });
                const plate = new T.LineSegments(new T.BufferGeometry().setFromPoints(seams), new T.LineBasicMaterial({ color: '#3a3430', transparent: true, opacity: .55 }));
                plate.name = 'theme-plate-seams'; this.root.add(plate);
                const studs = new T.InstancedMesh(new T.SphereGeometry(.028, 8, 6), new T.MeshStandardMaterial({ color: '#d9a845', metalness: .7, roughness: .3 }), rivets.length);
                rivets.forEach((at, i) => studs.setMatrixAt(i, new T.Matrix4().makeTranslation(at.x, at.y, at.z)));
                studs.name = 'theme-rivets'; this.root.add(studs);
                // Big gears turn half sunk in the island's sides, and brass pipes run down into the sea.
                const outward = (c: { x: number; z: number }) => [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => !own.has(`${c.x + dx},${c.z + dz}`))!;
                edge.forEach((cell, i) => {
                    const [dx, dz] = outward(cell), at = layout.point(cell, 0);
                    if (i % 4 === 0) {
                        const wheel = gear(.46, .14, i % 8 ? '#8f9aa4' : '#c9a24a', 12); wheel.name = 'theme-edge-gear';
                        wheel.position.set(at.x + dx * .56, at.y - .3, at.z + dz * .56); wheel.rotation.y = Math.atan2(dx, dz); this.root.add(wheel);
                        const turn = (i % 8 ? -1 : 1) / 1300; this.ambience.push((now, _n, reduced) => { if (!reduced) wheel.rotation.z = now * turn; });
                    } else if (i % 4 === 2) {
                        const height = at.y - TERRAIN_SEA_LEVEL + .25, pipe = new T.Mesh(new T.CylinderGeometry(.06, .06, height, 10), new T.MeshStandardMaterial({ color: '#c08a3e', metalness: .6, roughness: .3 }));
                        pipe.position.set(at.x + dx * .52, TERRAIN_SEA_LEVEL + height / 2 - .1, at.z + dz * .52); pipe.name = 'theme-pipe'; this.root.add(pipe);
                    }
                });
                // The clock tower stands on a steel pier behind the house, off the back edge, where it hides nothing.
                const corner = [...land].sort((a, b) => a.z - a.x - (b.z - b.x))[0], foot = layout.point(corner, 0).add(new T.Vector3(-1.6, 0, -1.15));
                const tower = new T.Group(); tower.name = 'theme-clock-tower'; tower.position.set(foot.x, TERRAIN_SEA_LEVEL, foot.z); this.root.add(tower);
                const steel = new T.MeshStandardMaterial({ color: '#6c767d', metalness: .6, roughness: .35 }), brass = new T.MeshStandardMaterial({ color: '#d0a04a', metalness: .65, roughness: .3 });
                const top = foot.y - TERRAIN_SEA_LEVEL;
                const pier = new T.Mesh(new T.CylinderGeometry(.42, .5, top, 12), steel); pier.position.y = top / 2; tower.add(pier);
                const body = new T.Mesh(new T.BoxGeometry(.7, 2, .7), brass); body.position.y = top + 1; tower.add(body);
                const roof = new T.Mesh(new T.ConeGeometry(.6, .8, 4), steel); roof.position.y = top + 2.4; roof.rotation.y = Math.PI / 4; tower.add(roof);
                const hands: T.Mesh[] = [];
                for (const [x, z, turn] of [[0, .36, 0], [.36, 0, Math.PI / 2]] as const) {
                    const face = new T.Mesh(new T.CylinderGeometry(.27, .27, .04, 24), new T.MeshStandardMaterial({ color: '#fff6e0', emissive: '#ffe6a8', emissiveIntensity: .3 }));
                    face.rotation.set(Math.PI / 2, 0, turn); face.position.set(x, top + 1.45, z); tower.add(face);
                    const hand = new T.Mesh(new T.BoxGeometry(.035, .22, .02), new T.MeshStandardMaterial({ color: '#2e2622' }));
                    hand.position.set(x * 1.06, top + 1.45, z * 1.06); hand.rotation.y = turn; tower.add(hand); hands.push(hand);
                }
                this.towerFace = new T.Vector3(foot.x, top + TERRAIN_SEA_LEVEL + 1.45, foot.z);
                this.ambience.push((now, _n, reduced) => { if (!reduced) hands.forEach(hand => { hand.rotation.z = -now / 2000; }); });
                // Small cogs turn in the ground, and steam puffs from the vents along the edge.
                this.ambience.push((now, _n, reduced) => { if (!reduced) this.root.traverse(o => { if (o.name === 'theme-cog') o.rotation.z = now / 900; }); });
                const vents = edge.filter((_, i) => i % 3 === 1).slice(0, 5).map(cell => layout.point(cell, .1));
                vents.forEach(at => { const vent = new T.Mesh(new T.CylinderGeometry(.07, .09, .16, 10), new T.MeshStandardMaterial({ color: '#5f6f7a', metalness: .5, roughness: .4 })); vent.position.copy(at).setY(at.y - .02); vent.name = 'theme-vent'; this.root.add(vent); });
                const base = vents.flatMap(at => [0, 1, 2].map(() => at.clone()));
                drift(points(base.map(p => p.clone()), '#f4f4f4', 22, 'theme-steam'), base, (p, i, now) => {
                    const rise = (now / 1900 + i * .33) % 1; p.y += .1 + rise * 1.1; p.x += Math.sin(i + rise * 3) * .12 * rise;
                }, now => .55 + Math.sin(now / 600) * .1);
                break;
            }
            case 'hoshi': {
                // The sea holds the stars: a field of twinkling points all around the island.
                const base = Array.from({ length: 60 }, (_, i) => new T.Vector3((seeded(i) - .5) * (layout.width + 14), sea + .02, (seeded(i + 30) - .5) * (layout.depth + 14)))
                    .filter(p => Math.abs(p.x) > layout.width / 2 + .6 || Math.abs(p.z - (layout.depth / 2 - 2)) > layout.depth / 2 + .6);
                drift(points(base.map(p => p.clone()), '#fff6c8', 7, 'theme-sea-stars'), base, () => undefined, now => .45 + Math.sin(now / 350) * .35);
                break;
            }
        }
    }

    tick(now: number, night: boolean, reduced: boolean, camera?: T.Camera) {
        for (const step of this.ambience) step(now, night, reduced);
        // The special island's own sea, darkened at night like the home sea.
        if (this.seaMesh?.material.uniforms?.deep && this.seaTone) {
            const dim = night ? .5 : 0, dark = new T.Color('#1a2a55');
            this.seaMesh.material.uniforms.deep.value.set(this.seaTone.deep).lerp(dark, dim);
            this.seaMesh.material.uniforms.shallow.value.set(this.seaTone.shallow).lerp(dark, dim * .7);
        }
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
                if (o instanceof T.Mesh || o instanceof T.Points || o instanceof T.Line) {
                    o.geometry.dispose();
                    const material = o.material as T.Material & { map?: T.Texture | null };
                    if (material.map && material.map !== glowTexture) material.map.dispose();
                    material.dispose();
                }
            });
        }
        this.falls = []; this.ambience = []; this.seaMesh = undefined; this.seaTone = undefined; this.towerFace = undefined; this.floater = undefined; this.bobber = undefined; this.flies = undefined; this.halos = undefined; this.moon = undefined;
    }

    dispose() { this.clear(); this.root.removeFromParent(); }
}
