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
