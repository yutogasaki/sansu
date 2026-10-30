import * as THREE from 'three';
import type { Point, Village, Walk } from './stackRules';

// Small round residents who wander the village along its walks: terraces,
// stairs, bridges, and in one door and out another of the same building. When the ground changes under them they hop to the
// nearest floor, so a tap never strands one inside a wall.

interface Step { point: Point; node?: string }
interface Resident {
    body: THREE.Group;
    at: string;
    path: Step[];
    rest: number;
    from: THREE.Vector3;
    hop?: { from: THREE.Vector3; to: THREE.Vector3; t: number };
}

const COLORS = [0xfff1d6, 0xffc7d9, 0xc9f0dc, 0xcfe0ff, 0xffe08a, 0xffd2b0, 0xe2d4ff, 0xbfeef2];
const SPEED = 1.1;

export class Residents {
    readonly group = new THREE.Group();
    private list: Resident[] = [];

    private spot(k: string) { return new THREE.Vector3(...this.village.spots.get(k) ?? [0, 0, 0]); }

    constructor(count: number, private village: Village) {
        const body = new THREE.SphereGeometry(.17, 20, 14);
        const eye = new THREE.SphereGeometry(.025, 8, 6);
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2a2320 });
        const homes = this.ground(village);
        for (let i = 0; i < count; i++) {
            const g = new THREE.Group();
            g.scale.setScalar(1.45);
            const b = new THREE.Mesh(body, new THREE.MeshStandardMaterial({ color: COLORS[i % COLORS.length], roughness: .7 }));
            b.scale.set(1, .86, 1);
            b.position.y = .15;
            b.castShadow = true;
            const l = new THREE.Mesh(eye, eyeMat), r = new THREE.Mesh(eye, eyeMat);
            l.position.set(-.06, .19, .15); r.position.set(.06, .19, .15);
            g.add(b, l, r);
            const at = homes[(i * 7 + 3) % homes.length];
            g.position.copy(this.spot(at));
            this.group.add(g);
            this.list.push({ body: g, at, path: [], rest: .4 + i * .5, from: g.position.clone() });
        }
    }

    /** Floors joined to the ground, where residents can live. */
    private ground(village: Village): string[] {
        const start = [...village.walks.keys()].filter(k => village.spots.get(k)?.[1] === 0);
        const seen = new Set(start);
        const todo = [...start];
        while (todo.length) for (const w of village.walks.get(todo.pop()!) ?? []) if (!seen.has(w.to)) { seen.add(w.to); todo.push(w.to); }
        const out = [...seen];
        return out.length ? out : [...village.walks.keys()];
    }

    /** The ground changed: anyone whose floor is gone hops to the nearest one. */
    update(village: Village) {
        this.village = village;
        const floors = [...village.walks.keys()];
        if (!floors.length) return;
        for (const r of this.list) {
            const still = village.walks.has(r.at) && r.path.every(s => !s.node || village.walks.has(s.node));
            if (still) continue;
            const here = r.body.position;
            const near = floors.reduce((a, b) => (this.spot(a).distanceToSquared(here) < this.spot(b).distanceToSquared(here) ? a : b));
            r.path = [];
            r.at = near;
            r.rest = .5;
            r.body.visible = true;
            r.hop = { from: here.clone(), to: this.spot(near), t: 0 };
        }
    }

    tick(dt: number) {
        for (const r of this.list) {
            const p = r.body.position;
            if (r.hop) {
                r.hop.t = Math.min(1, r.hop.t + dt * 2.4);
                p.lerpVectors(r.hop.from, r.hop.to, r.hop.t);
                p.y += Math.sin(r.hop.t * Math.PI) * .6;
                if (r.hop.t >= 1) r.hop = undefined;
                continue;
            }
            if (!r.path.length) {
                r.rest -= dt;
                r.body.children[0].scale.y = .86 + Math.sin(performance.now() / 300 + p.x) * .02;
                if (r.rest <= 0) this.wander(r);
                continue;
            }
            const [nx, ny, nz, indoors] = r.path[0].point;
            const next = new THREE.Vector3(nx, ny, nz);
            // Indoors the resident is out of sight, and climbs faster.
            r.body.visible = !indoors;
            const to = next.clone().sub(p);
            const far = to.length();
            const step = SPEED * dt * (indoors ? 2.2 : 1);
            if (far > .001) r.body.rotation.y = Math.atan2(to.x, to.z);
            if (far <= step) {
                p.copy(next);
                const done = r.path.shift()!;
                if (done.node) r.at = done.node;
            } else p.addScaledVector(to.normalize(), step);
            // A little bounce in every step.
            r.body.children[0].position.y = .15 + Math.abs(Math.sin(performance.now() / 110)) * .04;
        }
    }

    /**
     * Set out for somewhere: a door, chosen at random, reached by the cheapest
     * way there. Streets cost least, open terraces more, and the inside of a
     * building most, so residents keep to the streets and stay in sight.
     * At the door they sometimes go in and come out of another.
     */
    private wander(r: Resident) {
        const { walks, places } = this.village;
        const streets = this.paved;
        const goal = places[Math.floor(Math.random() * places.length)];
        if (!goal || goal === r.at) { r.rest = 1; return; }
        const cost = new Map([[r.at, 0]]);
        const via = new Map<string, { from: string; walk: Walk }>();
        const open = [r.at];
        while (open.length) {
            open.sort((a, b) => cost.get(a)! - cost.get(b)!);
            const at = open.shift()!;
            if (at === goal) break;
            for (const w of walks.get(at) ?? []) {
                const step = w.points.some(p => p[3] === 1) ? 8 : streets.has(`${at}|${w.to}`) ? 1 : 3;
                const c = cost.get(at)! + step;
                if (c >= (cost.get(w.to) ?? Infinity)) continue;
                cost.set(w.to, c);
                via.set(w.to, { from: at, walk: w });
                open.push(w.to);
            }
        }
        if (!via.has(goal)) { r.rest = 1; return; }
        const route: Walk[] = [];
        for (let k = goal; k !== r.at; k = via.get(k)!.from) route.unshift(via.get(k)!.walk);
        for (const w of route) w.points.forEach((point, j) => r.path.push({ point, node: j === w.points.length - 1 ? w.to : undefined }));
        // Now and then, step inside at the door and come out of another one.
        const inside = (walks.get(goal) ?? []).filter(w => w.points.some(p => p[3] === 1));
        if (inside.length && Math.random() < .35) {
            const w = inside[Math.floor(Math.random() * inside.length)];
            w.points.forEach((point, j) => r.path.push({ point, node: j === w.points.length - 1 ? w.to : undefined }));
        }
        r.rest = .8 + Math.random() * 2.2;
    }

    private get paved() {
        if (this.pavedFor !== this.village) {
            this.pavedFor = this.village;
            this.pavedSet = new Set(this.village.streets.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));
        }
        return this.pavedSet;
    }
    private pavedFor?: Village;
    private pavedSet = new Set<string>();
}
