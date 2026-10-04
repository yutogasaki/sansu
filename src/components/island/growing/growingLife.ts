import * as T from 'three';
import type { IslandMaterials } from '../three/primitives';
import { homeCellOf } from '../../../domain/growingIsland/community';
import { HOME_CELL, key, reachableFromHome, walkableCells } from '../../../domain/growingIsland/space';
import type { Cell, GrowingState, Villager } from '../../../domain/growingIsland';
import { makeVillagerActor, type Actor } from './actors';
import type { ObjectLayer, Seat } from './objectLayer';
import type { SceneLayout } from './sceneLayout';
import { besideOpen, nearestOpen, walkRoute } from './walkers';

type Mode = 'idle' | 'walk' | 'seat' | 'held' | 'boat' | 'pier' | 'sailing' | 'sleep';
interface Walker {
    actor: Actor; at: { x: number; z: number }; path: Cell[]; mode: Mode; until: number;
    seat?: { cell: Cell; kind: Seat }; hopAt?: number; heading: number; home: Cell;
    /** How a friend answers a touch: lively ones spin, shy ones turn away, others wave. */
    react?: { kind: 'wave' | 'spin' | 'shy'; at: number };
}

export const VISIBLE_WALKERS = 12;
const SPEED = 1.15 / 1000; // cells per millisecond

/**
 * The visible daily life: friends stroll between home, seats and open ground, Pokomoko
 * wanders too, and a picked-up friend follows the finger. None of this is saved.
 */
export class GrowingLife {
    readonly root = new T.Group();
    private walkers = new Map<string, Walker>();
    private walkable = new Set<string>();
    private seats = new Map<string, Seat>();
    private homePaths = new Set<string>();
    private state?: GrowingState;
    private layout?: SceneLayout;
    private layer?: ObjectLayer;
    private concert?: { cell: Cell; until: number };

    constructor(private readonly m: IslandMaterials, pokomoko: Actor) {
        this.root.name = 'growing-life';
        this.walkers.set('pokomoko', { actor: pokomoko, at: { ...HOME_CELL, z: HOME_CELL.z + 1 }, path: [], mode: 'idle', until: 0, heading: 0, home: HOME_CELL });
        this.root.add(pokomoko.root);
    }

    actorIds() { return [...this.walkers.keys()]; }
    objects() { return [...this.walkers.values()].filter(w => w.actor.root.visible).map(w => w.actor.root); }

    sync(state: GrowingState, layout: SceneLayout, layer: ObjectLayer) {
        this.state = state; this.layout = layout; this.layer = layer;
        this.walkable = walkableCells(state); this.seats = layer.seats;
        this.homePaths = new Set([...reachableFromHome(state, this.walkable)].filter(cell => this.walkable.has(cell)));
        const shown = [...state.villagers].filter(v => !v.away).sort((a, b) => b.arrivedAt - a.arrivedAt).slice(0, VISIBLE_WALKERS);
        const keep = new Set(['pokomoko', 'visitor', ...shown.map(v => v.id), ...state.arrivals]);
        for (const [id, walker] of this.walkers) if (!keep.has(id) || id === 'visitor') {
            if (id === 'pokomoko') continue;
            walker.actor.root.removeFromParent(); this.walkers.delete(id);
        }
        const villagers = new Map(state.villagers.map(v => [v.id, v]));
        for (const id of keep) {
            if (id === 'pokomoko' || id === 'visitor' || this.walkers.has(id)) continue;
            const villager = villagers.get(id); if (!villager) continue;
            this.add(villager, state.arrivals.includes(id) ? 'boat' : 'idle');
        }
        for (const id of this.walkers.keys()) {
            const walker = this.walkers.get(id)!, villager = villagers.get(id);
            if (villager) walker.home = homeCellOf(state, villager);
            if (walker.mode === 'boat' && !state.arrivals.includes(id)) {
                // Step off at the pier, then walk home along open ground.
                walker.at = { ...(nearestOpen(this.walkable, layout.cellAt(layout.pierEnd)) ?? HOME_CELL) };
                this.goHome(walker);
            }
        }
        const visitor = state.pier.visitor;
        const visitorVillager: Villager = { id: 'visitor', species: visitor.species, variant: visitor.variant, trait: visitor.trait, home: 'pokomoko', arrivedAt: 0 };
        this.add(visitorVillager, state.town.clock >= state.pier.dockAt ? 'pier' : 'sailing');
    }

    private add(villager: Villager, mode: Mode) {
        const actor = makeVillagerActor(this.m, villager);
        const home = this.state ? homeCellOf(this.state, villager) : HOME_CELL;
        const start = besideOpen(this.walkable, home, this.homePaths) ?? nearestOpen(this.homePaths, home) ?? HOME_CELL;
        this.walkers.set(villager.id, { actor, at: { ...start }, path: [], mode, until: 0, heading: Math.random() * 6, home });
        this.root.add(actor.root);
    }

    private goHome(walker: Walker) {
        walker.mode = 'idle'; walker.until = 0;
        const from = nearestOpen(this.walkable, walker.at) ?? HOME_CELL;
        walker.at = { ...from };
        const target = besideOpen(this.walkable, walker.home, this.homePaths);
        walker.path = target ? walkRoute(this.walkable, from, target) ?? [] : [];
        if (walker.path.length) walker.mode = 'walk';
    }

    private chooseTarget(walker: Walker): Cell | undefined {
        const roll = Math.random();
        if (roll < .35) return besideOpen(this.walkable, walker.home, this.homePaths);
        if (roll < .75 && this.seats.size) {
            const seats = [...this.seats.keys()], pick = seats[Math.floor(Math.random() * seats.length)];
            const [x, z] = pick.split(',').map(Number);
            return besideOpen(this.walkable, { x, z });
        }
        const open = [...this.walkable], pick = open[Math.floor(Math.random() * open.length)];
        if (!pick) return undefined;
        const [x, z] = pick.split(',').map(Number); return { x, z };
    }

    /** Seats next to where a walk ended: bench or swing to sit, table to eat. */
    private seatBeside(cell: Cell) {
        for (const [text, kind] of this.seats) {
            const [x, z] = text.split(',').map(Number);
            if (Math.abs(x - cell.x) + Math.abs(z - cell.z) === 1) return { cell: { x, z }, kind };
        }
    }

    /** えんそうかい: everyone visible gathers in a ring around the bandstand for a while. */
    startConcert(cell: Cell, now: number, length = 30000) { this.concert = { cell, until: now + length }; }
    concertActive(now: number) { return Boolean(this.concert && now < this.concert.until); }

    hop(id: string, now: number) {
        const w = this.walkers.get(id); if (!w) return;
        w.hopAt = now;
        const trait = w.actor.trait;
        w.react = { kind: trait === 'lively' ? 'spin' : trait === 'shy' ? 'shy' : 'wave', at: now };
    }

    /** Arms follow what a friend is doing: swing while walking, wave or cheer when touched. */
    private poseArms(w: Walker, now: number, reduced: boolean, concert: boolean) {
        const arms = w.actor.arms; if (!arms?.length) return;
        const react = w.react && now - w.react.at < 1400 ? w.react : undefined;
        if (!react && w.react) w.react = undefined;
        arms.forEach((arm, i) => {
            const side = i === 0 ? -1 : 1;
            let x = 0, z = 0;
            if (w.mode === 'walk' && !reduced) x = Math.sin(now / 110 + i * Math.PI) * .6;
            if (w.mode === 'seat' && w.seat?.kind === 'eat' && !reduced) x = Math.max(0, Math.sin(now / 350 + i * Math.PI)) * -1.7;
            if (w.mode === 'seat' && w.seat?.kind === 'tend') x = reduced ? -.8 : -.8 + Math.sin(now / 300 + i) * .4;
            if (w.mode === 'seat' && w.seat?.kind === 'slide') z = side * .9;
            // Rotating a hanging arm about z by side × angle lifts it outward on its own side.
            if (concert) z = side * (1.2 + (reduced ? 0 : Math.sin(now / 260 + i) * .5));
            if (react?.kind === 'wave' && side > 0) z = 2.4 + (reduced ? 0 : Math.sin((now - react.at) / 90) * .45);
            if (react?.kind === 'spin') z = side * 2.6;
            if (react?.kind === 'shy') { x = -1.4; z = -side * .3; }
            arm.rotation.x = x; arm.rotation.z = z;
        });
    }

    /** Everyone visible jumps in turn: the festival of a new island level (§8). */
    celebrate(now: number) {
        [...this.walkers.values()].forEach((w, i) => { w.hopAt = now + i * 180; });
    }

    positionOf(id: string) { const w = this.walkers.get(id); return w?.actor.root.visible ? w.actor.root.position.clone() : undefined; }

    positions() { return [...this.walkers.values()].filter(w => w.actor.root.visible).map(w => w.actor.root.position.clone()); }

    pick(id: string) {
        const w = this.walkers.get(id);
        if (!w || id === 'visitor' || w.mode === 'boat' || w.mode === 'sailing') return false;
        w.mode = 'held'; w.path = []; w.seat = undefined; return true;
    }

    drag(id: string, point: T.Vector3) {
        const w = this.walkers.get(id), layout = this.layout; if (!w || w.mode !== 'held' || !layout) return;
        w.at = { x: point.x + layout.center, z: point.z + 2 };
    }

    /** Dropped on a seat, a friend uses it; otherwise they land on the nearest open cell. */
    drop(id: string, now: number) {
        const w = this.walkers.get(id); if (!w || w.mode !== 'held') return;
        const cell = { x: Math.round(w.at.x), z: Math.round(w.at.z) }, seat = this.seats.get(key(cell));
        if (seat) { w.mode = 'seat'; w.seat = { cell, kind: seat }; w.at = { ...cell }; w.until = now + 7000; return; }
        const open = nearestOpen(this.walkable, w.at) ?? HOME_CELL;
        w.at = { ...open }; w.mode = 'idle'; w.until = now + 2500;
    }

    tick(now: number, delta: number, reduced: boolean, night: boolean) {
        const layout = this.layout, layer = this.layer; if (!layout || !layer) return;
        if (import.meta.env.DEV && typeof location !== 'undefined' && location.hash.includes('lineup')) {
            // Development only: everyone stands in a row facing the camera, to compare silhouettes.
            [...this.walkers.values()].forEach((w, i) => {
                w.actor.root.visible = true;
                w.actor.root.position.copy(layout.point({ x: i % 6, z: 3 + Math.floor(i / 6) }));
                w.actor.root.rotation.set(0, .35, 0);
            });
            return;
        }
        if (this.concert && now >= this.concert.until) {
            // The concert ends: each friend steps off onto the nearest open ground.
            for (const w of this.walkers.values()) if (w.mode === 'seat' || w.mode === 'idle' || w.mode === 'walk') { w.mode = 'idle'; w.path = []; w.until = now + 1500; }
            this.concert = undefined;
        }
        const players = this.concert ? [...this.walkers.entries()].filter(([id, w]) => id !== 'visitor' && w.mode !== 'boat' && w.mode !== 'sailing' && w.mode !== 'held') : [];
        for (const [id, w] of this.walkers) {
            const { actor } = w;
            actor.root.visible = true;
            const seat = players.findIndex(([player]) => player === id);
            if (this.concert && seat >= 0) {
                const center = layout.point(this.concert.cell), a = seat / players.length * Math.PI * 2;
                const ring = .75 + (players.length > 8 ? .25 : 0);
                const x = center.x + Math.sin(a) * ring, z = center.z + Math.cos(a) * ring;
                let y = reduced ? 0 : Math.abs(Math.sin(now / 260 + seat)) * .05;
                if (w.hopAt !== undefined && now >= w.hopAt) { const t = (now - w.hopAt) / 520; if (t >= 1) w.hopAt = undefined; else y += Math.sin(Math.PI * t) * (reduced ? .08 : .35); }
                actor.root.position.set(x, center.y + y, z);
                actor.root.rotation.set(0, Math.atan2(center.x - x, center.z - z) + (reduced ? 0 : Math.sin(now / 400 + seat) * .15), 0);
                this.poseArms(w, now, reduced, true);
                w.at = { x: x + layout.center, z: z + 2 };
                continue;
            }
            if (id !== 'pokomoko' && id !== 'visitor' && night && w.mode !== 'held' && w.mode !== 'boat') { actor.root.visible = false; continue; }
            let y = 0;
            if (w.mode === 'sailing' || w.mode === 'boat') {
                const boat = w.mode === 'boat' ? layer.arrivalBoat : layer.visitorBoat;
                actor.root.position.copy(boat.position).add(new T.Vector3(0, .12, 0)); actor.root.rotation.y = -.7;
                continue;
            }
            if (w.mode === 'pier') {
                actor.root.position.copy(layout.pierEnd); actor.root.rotation.y = Math.PI + Math.sin(now / 1800) * .4;
                y = reduced ? 0 : Math.abs(Math.sin(now / 900)) * .02;
                if (w.hopAt !== undefined && now >= w.hopAt) {
                    // The waiting friend jumps for joy when a home seed is planted (§3.3).
                    const t = (now - w.hopAt) / 520;
                    if (t >= 1.6) w.hopAt = undefined; else y += Math.abs(Math.sin(Math.PI * t * 1.25)) * (reduced ? .08 : .4);
                }
                actor.root.position.y += y; continue;
            }
            if (w.mode === 'idle' && now > w.until) {
                const target = this.chooseTarget(w), from = nearestOpen(this.walkable, w.at);
                const path = target && from ? walkRoute(this.walkable, from, target) : undefined;
                if (path && path.length > 1) { w.path = path.slice(1); w.mode = 'walk'; } else w.until = now + 3000;
            }
            if (w.mode === 'walk') {
                let budget = delta * SPEED;
                while (budget > 0 && w.path.length) {
                    const next = w.path[0], dx = next.x - w.at.x, dz = next.z - w.at.z, d = Math.hypot(dx, dz);
                    if (d <= budget) { w.at = { ...next }; w.path.shift(); budget -= d; }
                    else { w.at = { x: w.at.x + dx / d * budget, z: w.at.z + dz / d * budget }; budget = 0; }
                    if (d > 1e-6) w.heading = Math.atan2(dx, dz);
                }
                if (!w.path.length) {
                    const seat = this.seatBeside({ x: Math.round(w.at.x), z: Math.round(w.at.z) });
                    if (seat && Math.random() < .6) { w.mode = 'seat'; w.seat = seat; w.until = now + 6000; }
                    else { w.mode = 'idle'; w.until = now + 2500 + Math.random() * 5000; }
                }
            }
            if (w.mode === 'seat' && now > w.until) { w.mode = 'idle'; w.seat = undefined; w.until = now + 1500; }
            const position = w.mode === 'seat' && w.seat ? layout.point(w.seat.kind === 'tend' ? w.at : w.seat.cell) : layout.point(w.at);
            let lean = 0;
            if (w.mode === 'seat' && w.seat?.kind === 'slide' && !reduced) {
                // Up the steps at the back, then whoosh down the chute.
                const t = (now / 2600 + (w.actor.id.length % 5) * .2) % 1;
                const climb = t < .45, u = climb ? t / .45 : (t - .45) / .55;
                position.z += climb ? -.35 : -.35 + u * .85;
                position.y += climb ? u * .5 : .5 * (1 - u);
                lean = climb ? 0 : -.5;
            }
            if (w.mode === 'seat' && w.seat?.kind === 'tend') lean = reduced ? .35 : .35 + Math.sin(now / 400) * .12;
            if (w.mode === 'seat' && w.seat) y = w.seat.kind === 'sit' ? .16 : w.seat.kind === 'swing' ? .2 : w.seat.kind === 'slide' || w.seat.kind === 'tend' ? 0
                : w.seat.kind === 'bounce' ? .2 + (reduced ? 0 : Math.abs(Math.sin(now / 260)) * .4) : .05;
            if (w.mode === 'held') y = .55 + (reduced ? 0 : Math.sin(now / 120) * .03);
            if (w.mode === 'walk' && !reduced) y = Math.abs(Math.sin(now / 110)) * .035;
            if (w.hopAt !== undefined && now >= w.hopAt) {
                const t = (now - w.hopAt) / 520;
                if (t >= 1) w.hopAt = undefined; else y += Math.sin(Math.PI * t) * (reduced ? .08 : .35);
            }
            actor.root.position.set(position.x, position.y + y, position.z);
            actor.root.rotation.y = w.mode === 'seat' ? (w.seat?.kind === 'tend' && w.seat ? Math.atan2(w.seat.cell.x - w.at.x, w.seat.cell.z - w.at.z) : 0) : w.heading;
            if (w.react && now - w.react.at < 1400 && !reduced) {
                const t = (now - w.react.at) / 1400;
                if (w.react.kind === 'spin') actor.root.rotation.y += t * Math.PI * 2;
                else if (w.react.kind === 'shy') actor.root.rotation.y += Math.PI * .6 + Math.sin(t * Math.PI * 4) * .12;
            }
            this.poseArms(w, now, reduced, false);
            if (w.mode === 'seat' && w.seat?.kind === 'swing' && !reduced) actor.root.rotation.x = Math.sin(now / 500) * .18;
            else actor.root.rotation.x = lean;
            const swing = w.mode === 'walk' && !reduced ? Math.sin(now / 110) * .5 : 0;
            actor.feet.forEach((foot, i) => { foot.rotation.x = i ? swing : -swing; });
            if (actor.sparkle) actor.sparkle.rotation.y = now / 600;
        }
    }

    dispose() { this.root.removeFromParent(); this.walkers.clear(); }
}
