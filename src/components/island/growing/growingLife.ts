import * as T from 'three';
import type { IslandMaterials } from '../three/primitives';
import { homeCellOf } from '../../../domain/growingIsland/community';
import { HOME_CELL, bridgeEnd, key, reachableFromHome, walkableCells } from '../../../domain/growingIsland/space';
import type { Cell, GrowingState, Villager } from '../../../domain/growingIsland';
import { disposeActor, makeVillagerActor, type Actor } from './actors';
import { DROP_PLAY_MS, sampleDropPlay, type DropPlayKind } from './growingDropPlay';
import type { ObjectLayer, Seat } from './objectLayer';
import type { SceneLayout } from './sceneLayout';
import { besideOpen, nearestOpen, walkRoute } from './walkers';
import type { DerivedPlace, PlacePoint, PlaceUseTarget } from '../../../domain/growingIsland/placeTypes';

type Mode = 'idle' | 'walk' | 'seat' | 'held' | 'boat' | 'pier' | 'sailing' | 'sleep' | 'gallery' | 'shore';
export interface PlaceUseReceipt { ruleId: DerivedPlace['ruleId']; placeId: string; revision: string; actorId: string; targetId: string }
interface Walker {
    actor: Actor; at: { x: number; z: number }; path: Cell[]; mode: Mode; until: number;
    seat?: { cell: Cell; kind: Seat }; hopAt?: number; heading: number; home: Cell;
    /** How a friend answers a touch: lively ones spin, shy ones turn away, others wave. */
    react?: { kind: 'wave' | 'spin' | 'shy'; at: number };
    play?: { kind: DropPlayKind; cell: Cell; exit: Cell; at: number };
    placeTarget?: { place: DerivedPlace; target: PlaceUseTarget };
    gallery?: { route: PlacePoint[]; index: number; point: PlacePoint };
    useAt?: number;
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
    private uses: PlaceUseReceipt[] = [];
    private observedUses = new Set<string>();

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
            disposeActor(walker.actor); this.walkers.delete(id);
        }
        const villagers = new Map(state.villagers.map(v => [v.id, v]));
        for (const id of keep) {
            if (id === 'pokomoko' || id === 'visitor' || this.walkers.has(id)) continue;
            const villager = villagers.get(id); if (!villager) continue;
            this.add(villager, state.arrivals.includes(id) ? 'boat' : 'idle');
        }
        for (const id of this.walkers.keys()) {
            const walker = this.walkers.get(id)!, villager = villagers.get(id);
            if (walker.placeTarget) {
                const current = layer.places.find(p => p.id === walker.placeTarget!.place.id && p.revision === walker.placeTarget!.place.revision);
                if (!current) {
                    // Exit before the old topology is closed. No actor remains on an
                    // invisible gallery, even if its tree was moved while climbing.
                    const oldEntry = walker.placeTarget.place.entrances[0] ?? walker.at;
                    walker.at = nearestOpen(this.homePaths, oldEntry) ?? { ...HOME_CELL };
                    walker.gallery = undefined; walker.placeTarget = undefined; walker.path = [];
                    walker.seat = undefined; walker.play = undefined; walker.mode = 'idle'; walker.until = 0; walker.useAt = undefined;
                }
            }
            if (walker.play && this.seats.get(key(walker.play.cell)) !== (walker.play.kind === 'bench' ? 'sit' : 'swing')) {
                walker.play = undefined; walker.seat = undefined; walker.mode = 'idle'; walker.until = 0;
            }
            if (walker.play && !this.walkable.has(key(walker.play.exit))) {
                walker.play.exit = this.playExit(walker.play.cell, walker.play.kind);
            }
            if (villager) walker.home = homeCellOf(state, villager);
            const seatedOnExisting = walker.mode === 'seat' && walker.seat && this.seats.get(key(walker.seat.cell)) === walker.seat.kind;
            if ((!this.walkable.has(key({ x: Math.round(walker.at.x), z: Math.round(walker.at.z) }))
                || walker.path.some(cell => !this.walkable.has(key(cell))))
                && walker.mode !== 'boat' && walker.mode !== 'sailing' && walker.mode !== 'pier' && walker.mode !== 'held' && walker.mode !== 'gallery' && !seatedOnExisting) {
                walker.at = nearestOpen(this.walkable, walker.at) ?? { ...HOME_CELL };
                walker.path = []; walker.mode = 'idle'; walker.until = 0;
            }
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
        walker.gallery = undefined; walker.placeTarget = undefined;
        walker.mode = 'idle'; walker.until = 0;
        const from = nearestOpen(this.walkable, walker.at) ?? HOME_CELL;
        walker.at = { ...from };
        const target = besideOpen(this.walkable, walker.home, this.homePaths);
        walker.path = target ? walkRoute(this.walkable, from, target) ?? [] : [];
        if (walker.path.length) walker.mode = 'walk';
    }

    private chooseTarget(walker: Walker): Cell | undefined {
        const roll = Math.random();
        if (roll < .45 && this.layer) {
            const targets = this.layer.places.filter(p => p.stage === 'grown' || p.stage === 'lived')
                .flatMap(place => place.useTargets.map(target => ({ place, target })));
            // Prefer places this real actor has not used yet. This only changes its
            // destination, never creates residents or increments a simulation count.
            const fresh = targets.filter(({ place, target }) => !this.observedUses.has(this.receiptKey(place, walker.actor.id, target.id)));
            const choices = fresh.length ? fresh : targets;
            const chosen = choices[Math.floor(Math.random() * choices.length)];
            if (chosen) {
                const cell = chosen.target.kind === 'gallery' || chosen.target.kind === 'shore' ? chosen.target.cell
                    : besideOpen(this.walkable, chosen.target.cell, this.homePaths);
                if (cell && this.homePaths.has(key(cell))) { walker.placeTarget = chosen; return cell; }
            }
        }
        walker.placeTarget = undefined;
        if (this.state?.bridge && roll < .15) return bridgeEnd(this.state);
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
            if (Math.abs(x - cell.x) + Math.abs(z - cell.z) === 1 && !this.seatOccupied({ x, z })) return { cell: { x, z }, kind };
        }
    }

    private seatOccupied(cell: Cell, except?: Walker) {
        return [...this.walkers.values()].some(w => w !== except && w.mode === 'seat' && w.seat && key(w.seat.cell) === key(cell));
    }

    private playExit(cell: Cell, kind: DropPlayKind): Cell {
        const front = { x: cell.x, z: cell.z + 1 };
        if (kind === 'swing' && this.walkable.has(key(front))) return front;
        return besideOpen(this.walkable, cell) ?? nearestOpen(this.walkable, cell) ?? HOME_CELL;
    }

    /** えんそうかい: everyone visible gathers in a ring around the bandstand for a while. */
    startConcert(cell: Cell, now: number, length = 30000) { this.concert = { cell, until: now + length }; }
    concertActive(now: number) { return Boolean(this.concert && now < this.concert.until); }

    hop(id: string, now: number) {
        const w = this.walkers.get(id); if (!w) return;
        if (w.play) {
            w.at = { ...w.play.exit };
            w.play = undefined; w.seat = undefined; w.mode = 'idle'; w.until = now + 1500;
        }
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
            if ((w.mode === 'walk' || w.mode === 'gallery') && !reduced) x = Math.sin(now / 110 + i * Math.PI) * .6;
            if (w.mode === 'seat' && w.seat?.kind === 'eat' && !reduced) x = Math.max(0, Math.sin(now / 350 + i * Math.PI)) * -1.7;
            if (w.mode === 'seat' && w.seat?.kind === 'tend') x = reduced ? -.8 : -.8 + Math.sin(now / 300 + i) * .4;
            if (w.mode === 'seat' && w.seat?.kind === 'play') z = side * (.55 + (reduced ? 0 : Math.sin(now / 240 + i) * .22));
            if (w.mode === 'shore') x = reduced ? -.25 : -.25 + Math.sin(now / 550 + i) * .18;
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

    /** Every real resident remains findable, including friends indoors or away. */
    focusPositionOf(id: string) {
        const visible = this.positionOf(id);
        if (visible) return visible;
        const friend = this.state?.villagers.find(v => v.id === id);
        return friend && this.state && this.layout ? this.layout.point(homeCellOf(this.state, friend)) : undefined;
    }

    positions() { return [...this.walkers.values()].filter(w => w.actor.root.visible).map(w => w.actor.root.position.clone()); }

    /** Resume the normal walk from the actual lookout after the one-time building scene. */
    finishBridgeBuild(id: string, end: Cell) {
        for (const name of ['pokomoko', id]) {
            const walker = this.walkers.get(name); if (!walker) continue;
            walker.at = { ...end }; walker.path = []; walker.seat = undefined;
            walker.mode = 'idle'; walker.until = performance.now() + 1800;
        }
    }

    pick(id: string) {
        const w = this.walkers.get(id);
        if (!w || id === 'visitor' || w.mode === 'boat' || w.mode === 'sailing') return false;
        w.mode = 'held'; w.path = []; w.seat = undefined; w.play = undefined; w.placeTarget = undefined; w.gallery = undefined; w.useAt = undefined; return true;
    }

    drag(id: string, point: T.Vector3) {
        const w = this.walkers.get(id), layout = this.layout; if (!w || w.mode !== 'held' || !layout) return;
        w.at = { x: point.x + layout.center, z: point.z + 2 };
    }

    /** Dropped on a seat, a friend uses it; otherwise they land on the nearest open cell. */
    drop(id: string, now: number): { kind: DropPlayKind; cell: Cell } | undefined {
        const w = this.walkers.get(id); if (!w || w.mode !== 'held') return;
        const cell = { x: Math.round(w.at.x), z: Math.round(w.at.z) }, seat = this.seats.get(key(cell));
        const gallery = this.layer?.places.filter(p => p.stage === 'grown' || p.stage === 'lived')
            .flatMap(place => place.useTargets.filter(target => target.kind === 'gallery' && key(target.cell) === key(cell)).map(target => ({ place, target })))[0];
        if (gallery?.target.route?.length) { w.at = { ...cell }; w.placeTarget = gallery; this.enterPlace(w, now); return; }
        if (seat && !this.seatOccupied(cell, w)) {
            w.mode = 'seat'; w.seat = { cell, kind: seat }; w.at = { ...cell };
            const kind = seat === 'sit' ? 'bench' : seat === 'swing' ? 'swing' : undefined;
            const exit = kind ? this.playExit(cell, kind) : HOME_CELL;
            w.play = kind ? { kind, cell, exit, at: now } : undefined;
            w.until = now + (kind ? DROP_PLAY_MS : 7000);
            w.useAt = now;
            return kind ? { kind, cell } : undefined;
        }
        const open = nearestOpen(this.walkable, w.at) ?? HOME_CELL;
        w.at = { ...open }; w.mode = 'idle'; w.play = undefined; w.until = now + 2500;
    }

    /** A cancelled gesture lands safely without pretending the object was used. */
    cancelCarry(id: string, now: number) {
        const w = this.walkers.get(id); if (!w || w.mode !== 'held') return;
        const open = nearestOpen(this.walkable, w.at) ?? HOME_CELL;
        w.at = { ...open }; w.mode = 'idle'; w.seat = undefined; w.play = undefined; w.until = now + 1500;
    }

    private receiptKey(place: DerivedPlace, actorId: string, targetId: string) { return `${place.id}:${place.revision}:${actorId}:${targetId}`; }

    private observeUse(walker: Walker, place: DerivedPlace, target: PlaceUseTarget) {
        if (walker.actor.id === 'visitor' || !walker.actor.root.visible || !this.state) return;
        if (walker.actor.id !== 'pokomoko' && !this.state.villagers.some(v => v.id === walker.actor.id && !v.away)) return;
        const receipt = this.receiptKey(place, walker.actor.id, target.id);
        if (this.observedUses.has(receipt)) return;
        this.observedUses.add(receipt);
        this.uses.push({ ruleId: place.ruleId, placeId: place.id, revision: place.revision, actorId: walker.actor.id, targetId: target.id });
    }

    /** Drained only after the frame containing the action was successfully rendered. */
    takePlaceUses() { const uses = this.uses; this.uses = []; return uses; }

    /** A use outside the camera was real life, but it was not a shown action. Permit
     * a fresh receipt when this target is actually used in a visible frame. */
    deferPlaceUse(receipt: PlaceUseReceipt) {
        const place = this.layer?.places.find(p => p.id === receipt.placeId && p.revision === receipt.revision);
        if (place) this.observedUses.delete(this.receiptKey(place, receipt.actorId, receipt.targetId));
    }

    retryPlaceUse(receipt: PlaceUseReceipt) {
        const place = this.layer?.places.find(p => p.id === receipt.placeId && p.revision === receipt.revision);
        if (place && this.walkers.get(receipt.actorId)?.actor.root.visible) this.uses.push(receipt);
    }

    /** Touching a real gallery sends the existing hero to its reachable stair foot. */
    visitGallery(actorId: string, placeId: string, now: number) {
        const walker = this.walkers.get(actorId), place = this.layer?.places.find(p => p.id === placeId), target = place?.useTargets.find(t => t.kind === 'gallery');
        if (!walker || !place || !target || walker.mode === 'boat' || walker.mode === 'sailing' || walker.mode === 'held') return false;
        const from = nearestOpen(this.homePaths, walker.at), path = from ? walkRoute(this.homePaths, from, target.cell) : undefined;
        if (!path?.length) return false;
        walker.at = { ...from! }; walker.seat = undefined; walker.play = undefined; walker.gallery = undefined;
        walker.placeTarget = { place, target }; walker.path = path.slice(1);
        if (walker.path.length) walker.mode = 'walk'; else this.enterPlace(walker, now);
        return true;
    }

    private enterPlace(walker: Walker, now: number) {
        const destination = walker.placeTarget; if (!destination) return false;
        const { target } = destination;
        if (target.kind === 'gallery' && target.route?.length) {
            walker.mode = 'gallery'; walker.gallery = { route: target.route, index: 1, point: { ...target.route[0] } }; walker.path = []; walker.useAt = now; return true;
        }
        if (target.kind === 'shore') { walker.mode = 'shore'; walker.path = []; walker.until = now + 4200; walker.useAt = now; return true; }
        return false;
    }

    tick(now: number, delta: number, reduced: boolean, night: boolean) {
        const layout = this.layout, layer = this.layer; if (!layout || !layer) return;
        for (const pivot of layer.swingPivots.values()) pivot.rotation.x = 0;
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
                if (path && path.length > 1) { w.path = path.slice(1); w.mode = 'walk'; }
                else if (!path || !this.enterPlace(w, now)) w.until = now + 3000;
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
                    if (this.enterPlace(w, now)) continue;
                    const seat = this.seatBeside({ x: Math.round(w.at.x), z: Math.round(w.at.z) });
                    if (seat && Math.random() < .6) { w.mode = 'seat'; w.seat = seat; w.until = now + 6000; w.useAt = now; }
                    else { w.mode = 'idle'; w.until = now + 2500 + Math.random() * 5000; }
                }
            }
            if (w.mode === 'gallery' && w.gallery) {
                let budget = delta * SPEED;
                const gallery = w.gallery;
                while (budget > 0 && gallery.index < gallery.route.length) {
                    const next = gallery.route[gallery.index], dx = next.x - gallery.point.x, dz = next.z - gallery.point.z, dy = next.y - gallery.point.y;
                    const distance = Math.hypot(dx, dy, dz);
                    if (distance <= budget) { gallery.point = { ...next }; gallery.index++; budget -= distance; }
                    else { const t = budget / distance; gallery.point = { x: gallery.point.x + dx * t, z: gallery.point.z + dz * t, y: gallery.point.y + dy * t }; budget = 0; }
                    if (Math.hypot(dx, dz) > 1e-5) w.heading = Math.atan2(dx, dz);
                }
                w.at = { x: gallery.point.x, z: gallery.point.z };
                if (w.placeTarget && gallery.point.y - layout.heightAt(gallery.point) > .8) this.observeUse(w, w.placeTarget.place, w.placeTarget.target);
                actor.root.position.copy(layout.floorPoint(gallery.point)); actor.root.rotation.set(0, w.heading, 0);
                actor.body.rotation.x = 0;
                actor.feet.forEach((foot, i) => { foot.rotation.x = reduced ? 0 : Math.sin(now / 110 + i * Math.PI) * .5; });
                this.poseArms(w, now, reduced, false);
                if (gallery.index >= gallery.route.length) { w.gallery = undefined; w.placeTarget = undefined; w.mode = 'idle'; w.until = now + 3000; }
                continue;
            }
            if (w.mode === 'shore' && w.useAt !== undefined && now - w.useAt >= 700 && w.placeTarget) this.observeUse(w, w.placeTarget.place, w.placeTarget.target);
            if (w.mode === 'shore' && now > w.until) { w.mode = 'idle'; w.placeTarget = undefined; w.useAt = undefined; w.until = now + 2000; }
            if (w.mode === 'seat' && now > w.until) {
                if (w.play) w.at = { ...w.play.exit };
                w.mode = 'idle'; w.seat = undefined; w.play = undefined; w.placeTarget = undefined; w.useAt = undefined; w.until = now + 1500;
            }
            const position = w.mode === 'seat' && w.seat ? layout.point(w.seat.kind === 'tend' ? w.at : w.seat.cell) : layout.point(w.at);
            const play = w.play && w.mode === 'seat' ? sampleDropPlay(w.play.kind, now - w.play.at, reduced) : undefined;
            const leaving = w.play && w.mode === 'seat' ? Math.max(0, Math.min(1, (now - w.play.at - (DROP_PLAY_MS - 650)) / 650)) : 0;
            if (w.play && leaving) {
                const from = w.play.cell, to = w.play.exit, step = leaving * leaving * (3 - 2 * leaving);
                position.lerp(layout.point(to), step);
                w.at = { x: from.x + (to.x - from.x) * step, z: from.z + (to.z - from.z) * step };
            }
            if (play && w.play?.kind === 'swing') {
                const pivot = layer.swingPivots.get(key(w.play.cell));
                if (pivot) pivot.rotation.x = play.rootPitch;
            }
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
                : w.seat.kind === 'bounce' ? .2 + (reduced ? 0 : Math.abs(Math.sin(now / 260)) * .4) : w.seat.kind === 'play' ? .04 : .05;
            if (play) y *= 1 - leaving * leaving * (3 - 2 * leaving);
            if (w.mode === 'held') y = .55 + (reduced ? 0 : Math.sin(now / 120) * .03);
            if (w.mode === 'walk' && !reduced) y = Math.abs(Math.sin(now / 110)) * .035;
            if (w.hopAt !== undefined && now >= w.hopAt) {
                const t = (now - w.hopAt) / 520;
                if (t >= 1) w.hopAt = undefined; else y += Math.sin(Math.PI * t) * (reduced ? .08 : .35);
            }
            actor.root.position.set(position.x, position.y + y + (play?.lift ?? 0), position.z + (play?.travel ?? 0));
            if (w.mode === 'seat' && w.seat && w.useAt !== undefined && now - w.useAt >= 700 && !leaving) {
                for (const place of layer.places.filter(p => p.stage === 'grown' || p.stage === 'lived')) {
                    const target = place.useTargets.find(t => (t.kind === 'seat' || t.kind === 'play') && key(t.cell) === key(w.seat!.cell));
                    if (target) this.observeUse(w, place, target);
                }
            }
            actor.root.rotation.y = w.mode === 'seat' ? (w.seat?.kind === 'tend' && w.seat ? Math.atan2(w.seat.cell.x - w.at.x, w.seat.cell.z - w.at.z) : 0) : w.heading;
            if (w.react && now - w.react.at < 1400 && !reduced) {
                const t = (now - w.react.at) / 1400;
                if (w.react.kind === 'spin') actor.root.rotation.y += t * Math.PI * 2;
                else if (w.react.kind === 'shy') actor.root.rotation.y += Math.PI * .6 + Math.sin(t * Math.PI * 4) * .12;
            }
            this.poseArms(w, now, reduced, false);
            if (play) actor.root.rotation.x = play.rootPitch;
            else if (w.mode === 'seat' && w.seat?.kind === 'swing' && !reduced) actor.root.rotation.x = Math.sin(now / 500) * .18;
            else actor.root.rotation.x = lean;
            actor.root.rotation.z = play?.roll ?? 0;
            actor.body.rotation.x = play?.bodyPitch ?? 0;
            const swing = w.mode === 'walk' && !reduced ? Math.sin(now / 110) * .5 : 0;
            actor.feet.forEach((foot, i) => { foot.rotation.x = play ? (i ? play.rightFoot : play.leftFoot) : i ? swing : -swing; });
            if (actor.sparkle) actor.sparkle.rotation.y = now / 600;
        }
    }

    dispose() {
        for (const walker of this.walkers.values()) disposeActor(walker.actor);
        this.root.removeFromParent(); this.walkers.clear();
    }
}
