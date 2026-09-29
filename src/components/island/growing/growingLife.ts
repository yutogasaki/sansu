import * as T from 'three';
import type { IslandMaterials } from '../three/primitives';
import { homeCellOf } from '../../../domain/growingIsland/community';
import { HOME_CELL, key, walkableCells } from '../../../domain/growingIsland/space';
import type { Cell, GrowingState, Villager } from '../../../domain/growingIsland';
import { makeVillagerActor, type Actor } from './actors';
import type { ObjectLayer, Seat } from './objectLayer';
import type { SceneLayout } from './sceneLayout';
import { besideOpen, nearestOpen, walkRoute } from './walkers';

type Mode = 'idle' | 'walk' | 'seat' | 'held' | 'boat' | 'pier' | 'sailing' | 'sleep';
interface Walker {
    actor: Actor; at: { x: number; z: number }; path: Cell[]; mode: Mode; until: number;
    seat?: { cell: Cell; kind: Seat }; hopAt?: number; heading: number; home: Cell;
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
    private state?: GrowingState;
    private layout?: SceneLayout;
    private layer?: ObjectLayer;

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
        const start = besideOpen(this.walkable, home) ?? nearestOpen(this.walkable, home) ?? HOME_CELL;
        this.walkers.set(villager.id, { actor, at: { ...start }, path: [], mode, until: 0, heading: Math.random() * 6, home });
        this.root.add(actor.root);
    }

    private goHome(walker: Walker) {
        walker.mode = 'idle'; walker.until = 0;
        const from = nearestOpen(this.walkable, walker.at) ?? HOME_CELL;
        walker.at = { ...from };
        const target = besideOpen(this.walkable, walker.home);
        walker.path = target ? walkRoute(this.walkable, from, target) ?? [] : [];
        if (walker.path.length) walker.mode = 'walk';
    }

    private chooseTarget(walker: Walker): Cell | undefined {
        const roll = Math.random();
        if (roll < .35) return besideOpen(this.walkable, walker.home);
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

    hop(id: string, now: number) { const w = this.walkers.get(id); if (w) w.hopAt = now; }

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
        for (const [id, w] of this.walkers) {
            const { actor } = w;
            actor.root.visible = true;
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
            const position = w.mode === 'seat' && w.seat ? layout.point(w.seat.cell) : layout.point(w.at);
            if (w.mode === 'seat' && w.seat) y = w.seat.kind === 'sit' ? .16 : w.seat.kind === 'swing' ? .2 : .05;
            if (w.mode === 'held') y = .55 + (reduced ? 0 : Math.sin(now / 120) * .03);
            if (w.mode === 'walk' && !reduced) y = Math.abs(Math.sin(now / 110)) * .035;
            if (w.hopAt !== undefined && now >= w.hopAt) {
                const t = (now - w.hopAt) / 520;
                if (t >= 1) w.hopAt = undefined; else y += Math.sin(Math.PI * t) * (reduced ? .08 : .35);
            }
            actor.root.position.set(position.x, position.y + y, position.z);
            actor.root.rotation.y = w.mode === 'seat' ? 0 : w.heading;
            if (w.mode === 'seat' && w.seat?.kind === 'swing' && !reduced) actor.root.rotation.x = Math.sin(now / 500) * .18;
            else actor.root.rotation.x = 0;
            const swing = w.mode === 'walk' && !reduced ? Math.sin(now / 110) * .5 : 0;
            actor.feet.forEach((foot, i) => { foot.rotation.x = i ? swing : -swing; });
            if (actor.sparkle) actor.sparkle.rotation.y = now / 600;
        }
    }

    dispose() { this.root.removeFromParent(); this.walkers.clear(); }
}
