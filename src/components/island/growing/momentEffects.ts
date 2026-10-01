import * as T from 'three';
import type { Moment } from '../../../domain/growingIsland';

interface Live { root: T.Object3D; start: number; life: number; tick?: (t: number, age: number) => void }
const basic = (color: string, opacity = 1) => new T.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });

/**
 * The small surprises of §11.2 and the night's shooting stars. They only decorate the scene
 * for a few seconds and own every geometry and material they create.
 */
export class MomentEffects {
    private live: Live[] = [];
    private nextStar = 0;
    constructor(private readonly parent: T.Object3D) {}

    private add(root: T.Object3D, start: number, life: number, tick?: Live['tick']) {
        this.parent.add(root); this.live.push({ root, start, life, tick });
    }

    play(moment: Moment, at: T.Vector3, now: number, reduced: boolean) {
        if (moment === 'rainbow') this.rainbow(at, now);
        else if (moment === 'butterflies') this.butterflies(at, now, reduced);
        else if (moment === 'guest-water' || moment === 'guest-grove') this.guest(moment, at, now, reduced);
        else if (moment === 'whale') this.whale(now, reduced);
        else if (moment === 'rainbow-bird') this.rainbowBird(at, now, reduced);
        else if (moment === 'moon-rabbit') this.moonRabbit(at, now, reduced);
        else this.hearts(at, now);
    }

    private rainbow(center: T.Vector3, now: number) {
        const root = new T.Group(); root.name = 'moment-rainbow';
        ['#f19a9a', '#f5c27a', '#f3e38a', '#a9d79a', '#95c6e8', '#b8a3dc'].forEach((color, i) => {
            const arc = new T.Mesh(new T.TorusGeometry(4.2 - i * .16, .08, 6, 48, Math.PI), basic(color, 0));
            root.add(arc);
        });
        root.position.set(center.x, -.2, center.z - 3.5);
        this.add(root, now, 9000, (t) => {
            const fade = Math.min(1, t * 6, (1 - t) * 4);
            root.children.forEach(c => { ((c as T.Mesh).material as T.MeshBasicMaterial).opacity = .55 * fade; });
        });
    }

    private butterflies(center: T.Vector3, now: number, reduced: boolean) {
        const root = new T.Group(); root.name = 'moment-butterflies';
        const colors = ['#f6c6d4', '#fff1b0', '#b9d9ef', '#f5c27a'];
        for (let i = 0; i < 7; i++) {
            const fly = new T.Group();
            for (const side of [-1, 1]) {
                const wing = new T.Mesh(new T.CircleGeometry(.07, 10), basic(colors[i % 4], .95));
                wing.material.side = T.DoubleSide; wing.position.x = side * .06; wing.name = side < 0 ? 'l' : 'r'; fly.add(wing);
            }
            fly.userData.phase = i * 1.3; root.add(fly);
        }
        root.position.copy(center);
        this.add(root, now, 10000, (_t, age) => {
            root.children.forEach((fly, i) => {
                const p = fly.userData.phase as number, a = age / 1400 + p;
                fly.position.set(Math.cos(a) * (.6 + i * .12), .5 + Math.sin(a * 2.3) * .2 + i * .04, Math.sin(a * 1.3) * (.6 + i * .1));
                const flap = reduced ? .3 : Math.sin(age / 60 + p) * .9;
                fly.children[0].rotation.y = flap; fly.children[1].rotation.y = -flap;
            });
        });
    }

    /** Two friends who love the same thing: small hearts rise between their homes. */
    private hearts(center: T.Vector3, now: number) {
        const root = new T.Group(); root.name = 'moment-friends';
        for (let i = 0; i < 5; i++) {
            const heart = new T.Mesh(new T.OctahedronGeometry(.06), basic('#f19aae', .9)); heart.userData.phase = i * .7; root.add(heart);
        }
        root.position.copy(center);
        this.add(root, now, 6000, (t, age) => root.children.forEach((h, i) => {
            const rise = ((age / 1800 + h.userData.phase) % 1);
            h.position.set(Math.sin(i * 2.1) * .35, .5 + rise * 1.1, Math.cos(i * 1.7) * .25);
            ((h as T.Mesh).material as T.MeshBasicMaterial).opacity = (1 - rise) * Math.min(1, (1 - t) * 5);
        }));
    }

    /** みなもの 旅鳥 / こもれびの お客 (spec 51 F-V01 / F-V02): a one-night guest of light. */
    private guest(kind: Moment, at: T.Vector3, now: number, reduced: boolean) {
        const root = new T.Group(); root.name = `moment-${kind}`;
        const water = kind === 'guest-water';
        const core = new T.Mesh(new T.SphereGeometry(.13, 16, 12), basic(water ? '#bfe8ff' : '#ffe0a0', .9)); root.add(core);
        const halo = new T.Mesh(new T.SphereGeometry(.26, 16, 12), basic(water ? '#8fd0f0' : '#b7d98a', .25)); root.add(halo);
        for (const side of [-1, 1]) {
            const wing = new T.Mesh(water ? new T.ConeGeometry(.08, .3, 8) : new T.SphereGeometry(.09, 10, 8), basic(water ? '#e6f7ff' : '#9cc47a', .75));
            wing.position.set(side * .2, .03, 0); wing.rotation.z = side * (water ? 1.2 : 0); wing.name = 'guest-wing'; root.add(wing);
        }
        const base = at.clone().add(new T.Vector3(0, .9, 0));
        this.add(root, now, 14000, (t, age) => {
            const fade = Math.min(1, t * 8, (1 - t) * 6);
            root.position.copy(base).add(new T.Vector3(Math.sin(age / 1500) * .5, reduced ? 0 : Math.sin(age / 600) * .12, Math.cos(age / 1700) * .4));
            (core.material as T.MeshBasicMaterial).opacity = .9 * fade; (halo.material as T.MeshBasicMaterial).opacity = (.2 + Math.sin(age / 300) * .06) * fade;
            root.children.filter(c => c.name === 'guest-wing').forEach((w, i) => {
                (((w as T.Mesh).material) as T.MeshBasicMaterial).opacity = .75 * fade;
                if (!reduced) w.rotation.x = Math.sin(age / 120 + i) * .5;
            });
        });
    }

    /** くじら: a whale rises from the sea beyond the pier and blows a spout, then dives. */
    private whale(now: number, reduced: boolean) {
        const root = new T.Group(); root.name = 'moment-whale';
        const body = new T.Mesh(new T.SphereGeometry(.9, 20, 14), new T.MeshStandardMaterial({ color: '#3d5f86', roughness: .6 }));
        body.scale.set(1.8, .55, .8); root.add(body);
        const belly = new T.Mesh(new T.SphereGeometry(.7, 16, 12), new T.MeshStandardMaterial({ color: '#dfe8f0', roughness: .7 }));
        belly.scale.set(1.5, .35, .62); belly.position.set(.2, -.18, 0); root.add(belly);
        const tail = new T.Mesh(new T.ConeGeometry(.35, .5, 3), new T.MeshStandardMaterial({ color: '#3d5f86', roughness: .6 }));
        tail.rotation.z = Math.PI / 2; tail.position.set(-1.8, .1, 0); tail.scale.z = .3; root.add(tail);
        const spout = new T.Mesh(new T.ConeGeometry(.18, .9, 10, 1, true), basic('#e6f7ff', 0)); spout.position.set(.7, .9, 0); root.add(spout);
        root.position.set(4.5, -1, 5.5); root.rotation.y = -.6;
        this.add(root, now, 12000, t => {
            const rise = Math.sin(Math.min(1, t * 1.15) * Math.PI);
            root.position.y = -1.1 + rise * (reduced ? .8 : 1.15);
            (spout.material as T.MeshBasicMaterial).opacity = t > .25 && t < .6 ? .7 * Math.sin((t - .25) / .35 * Math.PI) : 0;
            spout.scale.y = 1 + Math.sin(now / 120) * .1;
        });
        root.traverse(o => { if (o instanceof T.Mesh) o.castShadow = false; });
    }

    /** にじいろの とり: a bird of seven colours circles the island with a short rainbow trail. */
    private rainbowBird(at: T.Vector3, now: number, reduced: boolean) {
        const root = new T.Group(); root.name = 'moment-rainbow-bird';
        const colors = ['#f19a9a', '#f5c27a', '#f3e38a', '#a9d79a', '#95c6e8', '#b8a3dc'];
        const bird = new T.Group(); root.add(bird);
        const body = new T.Mesh(new T.SphereGeometry(.12, 12, 10), basic('#ffffff', 1)); body.scale.set(1.4, 1, 1); bird.add(body);
        colors.forEach((color, i) => {
            const feather = new T.Mesh(new T.BoxGeometry(.3, .012, .05), basic(color, .9)); feather.position.set(-.18 - i * .02, 0, -.12 + i * .045); bird.add(feather);
        });
        const trail = colors.map((color, i) => { const dot = new T.Mesh(new T.SphereGeometry(.05, 8, 6), basic(color, .6)); root.add(dot); return { dot, i }; });
        const center = at.clone().add(new T.Vector3(0, 1.8, 0));
        this.add(root, now, 11000, (t, age) => {
            const a = age / (reduced ? 2600 : 1500), r = 2.2;
            bird.position.set(center.x + Math.cos(a) * r, center.y + Math.sin(a * 2) * .3, center.z + Math.sin(a) * r);
            bird.rotation.y = -a; bird.children.slice(1).forEach((f, i) => { f.rotation.x = Math.sin(age / 80 + i) * .4; });
            trail.forEach(({ dot, i }) => {
                const b = a - (i + 1) * .12; dot.position.set(center.x + Math.cos(b) * r, center.y + Math.sin(b * 2) * .3, center.z + Math.sin(b) * r);
                (dot.material as T.MeshBasicMaterial).opacity = .6 * Math.min(1, (1 - t) * 6);
            });
        });
    }

    /** つきの うさぎ: a glowing rabbit on a crescent moon drifts over the lights for one night. */
    private moonRabbit(at: T.Vector3, now: number, reduced: boolean) {
        const root = new T.Group(); root.name = 'moment-moon-rabbit';
        const moon = new T.Mesh(new T.TorusGeometry(.32, .09, 10, 24, Math.PI * 1.2), basic('#fff2a6', .9)); moon.rotation.z = -.4; root.add(moon);
        const glow = basic('#fdfbff', .95);
        const rabbit = new T.Group(); rabbit.position.set(.05, -.12, 0); root.add(rabbit);
        const body = new T.Mesh(new T.SphereGeometry(.11, 12, 10), glow); body.scale.y = 1.15; rabbit.add(body);
        const head = new T.Mesh(new T.SphereGeometry(.08, 12, 10), glow); head.position.set(0, .15, .02); rabbit.add(head);
        for (const side of [-1, 1]) { const ear = new T.Mesh(new T.SphereGeometry(.03, 8, 6), glow); ear.scale.set(1, 3.2, 1); ear.position.set(side * .035, .28, 0); rabbit.add(ear); }
        const base = at.clone().add(new T.Vector3(0, 1.6, 0));
        this.add(root, now, 14000, (t, age) => {
            const fade = Math.min(1, t * 8, (1 - t) * 6);
            root.position.copy(base).add(new T.Vector3(Math.sin(age / 2200) * .6, reduced ? 0 : Math.sin(age / 900) * .1, 0));
            root.traverse(o => { if (o instanceof T.Mesh) (o.material as T.MeshBasicMaterial).opacity = .92 * fade; });
            rabbit.rotation.y = Math.sin(age / 1300) * .5;
        });
    }

    /** Night with lights on the island: a shooting star now and then (§11.2). */
    ambient(now: number, night: boolean, lights: number, sky: T.Vector3, reduced: boolean) {
        if (!night || lights < 2 || reduced) { this.nextStar = now + 4000; return; }
        if (now < this.nextStar) return;
        this.nextStar = now + 9000 + Math.random() * 9000;
        const star = new T.Mesh(new T.CylinderGeometry(.01, .04, 1.4, 6), basic('#fff6c8', 0));
        star.rotation.z = Math.PI / 2.6; star.name = 'moment-shooting-star';
        const from = sky.clone().add(new T.Vector3(-3 + Math.random() * 3, 3.5, -4));
        this.add(star, now, 1300, t => {
            star.position.copy(from).add(new T.Vector3(t * 4, -t * 1.6, 0));
            (star.material as T.MeshBasicMaterial).opacity = Math.sin(t * Math.PI);
        });
    }

    tick(now: number) {
        this.live = this.live.filter(item => {
            const age = now - item.start, t = Math.min(1, age / item.life);
            item.tick?.(t, age);
            if (t < 1) return true;
            this.release(item.root); return false;
        });
    }

    private release(root: T.Object3D) {
        root.removeFromParent();
        root.traverse(o => { if (o instanceof T.Mesh) { o.geometry.dispose(); (o.material as T.Material).dispose(); } });
    }

    dispose() { this.live.forEach(item => this.release(item.root)); this.live = []; }
}
