import * as THREE from 'three';
import type { IslandResident } from './animals';
import { planFurnitureClearance, type FurnitureClearancePlan } from './furnitureClearance';
import { residentGroundHeight } from './navigation';
import type { IslandStageItem } from './types';

type ClearanceMove = FurnitureClearancePlan['moves'][number];
interface ClearanceJob {
    moves: ClearanceMove[];
    cursor: number;
    current?: ClearanceMove;
    completed: number[];
    blocked: number[];
    completedSets: number;
    startedAt: number;
    reduced: boolean;
    stopped: boolean;
}
const BLOCKED_CAPTION = 'どうぶつが とおれる すきまを あけて みよう';
const AT_POINT_TOLERANCE = .001;

/** A saved placement can overlap a standing resident. Move along the preflighted
 * escape paths one at a time; never move the furniture or wait for learning. */
export class FurnitureClearanceController {
    private job?: ClearanceJob;

    constructor(private readonly residents: IslandResident[], private readonly caption: (text: string) => void) {}

    get active() { return Boolean(this.job && !this.job.stopped && (this.job.current || this.job.cursor < this.job.moves.length)); }
    get blocked() { return this.job ? [...this.job.blocked] : []; }

    start(items: IslandStageItem[], completedSets: number, now: number, reduced: boolean) {
        const candidates = () => this.residents.map(resident => ({ position: resident.group.position, visible: resident.group.visible,
            itemId: resident.itemId, departingId: resident.departingId }));
        let plan = planFurnitureClearance(items, candidates(), completedSets);
        this.cancel(now);
        // A harmless saved change must not interrupt an ordinary resumed visit.
        if (!plan.moves.length && !plan.blocked.length) return false;
        // Preflight includes stationary occupancy. A replaced invitation must
        // not leave an older actor continuing across the planned escape path.
        if (plan.moves.length) {
            for (const resident of this.residents) resident.stopWalking(now);
            plan = planFurnitureClearance(items, candidates(), completedSets);
        }
        if (!plan.moves.length && !plan.blocked.length) return false;
        this.job = { moves: plan.moves, cursor: 0, current: undefined, completed: [], blocked: [...plan.blocked],
            completedSets, startedAt: now, reduced, stopped: false };
        if (plan.moves.length) this.caption('すこし よけるね');
        return this.update(now, reduced);
    }

    /** Called after the residents' normal animation update. Reduced motion
     * finishes the same preflighted moves in order on this one frame. */
    update(now: number, reduced: boolean) {
        const job = this.job;
        if (!job || job.stopped) return false;
        job.reduced = reduced;
        while (job.current || job.cursor < job.moves.length) {
            if (job.current) {
                const resident = this.residents[job.current.index];
                if (reduced && resident.action === 'walk') resident.update(now + 20000);
                if (resident.action === 'walk') return true;
                const end = job.current.route.points[job.current.route.points.length - 1];
                // An unexpected external interruption invalidates the simulated
                // arrival positions used by all remaining moves. Do not continue
                // those stale paths or snap the interrupted actor to its end.
                if (Math.hypot(resident.group.position.x - end.x, resident.group.position.z - end.z) > AT_POINT_TOLERANCE) {
                    this.stopInvalidJob(job.current.index); return false;
                }
                job.completed.push(job.current.index);
                job.current = undefined;
                job.cursor++;
            }
            if (job.cursor >= job.moves.length) break;
            const move = job.moves[job.cursor], resident = this.residents[move.index];
            const start = move.route.points[0];
            if (!start || Math.hypot(resident.group.position.x - start.x, resident.group.position.z - start.z) > AT_POINT_TOLERANCE
                || !resident.walkToPoint(move.route, now, reduced, job.completedSets)) {
                this.stopInvalidJob(move.index); return false;
            }
            job.current = move;
        }
        job.stopped = true;
        if (job.blocked.length) this.caption(BLOCKED_CAPTION);
        return false;
    }

    private stopInvalidJob(index: number) {
        const job = this.job!;
        if (!job.blocked.includes(index)) job.blocked.push(index);
        job.current = undefined;
        job.stopped = true;
        this.caption(BLOCKED_CAPTION);
    }

    /** Only this job's current walk belongs to the controller. Future movers
     * and unrelated visits are untouched by cancellation. */
    cancel(now: number) {
        if (this.job?.current) this.residents[this.job.current.index].stopWalking(now);
        this.job = undefined;
    }

    /** Future movers have not begun their ordinary route yet, so their own
     * learning bounds cannot contain it. Include all remaining paths now. */
    learningFrameBounds() {
        const bounds = this.residents.filter(resident => resident.group.visible)
            .map(resident => new THREE.Box3().setFromObject(resident.group, true).expandByScalar(.2));
        const job = this.job;
        if (!job || !this.active) return bounds;
        for (let i = job.cursor; i < job.moves.length; i++) {
            const move = job.moves[i], resident = this.residents[move.index];
            if (!resident.group.visible) continue;
            const current = new THREE.Box3().setFromObject(resident.group, true);
            if (current.isEmpty()) continue;
            const root = resident.group.getWorldPosition(new THREE.Vector3());
            const radius = Math.hypot(Math.max(Math.abs(current.min.x - root.x), Math.abs(current.max.x - root.x)),
                Math.max(Math.abs(current.min.z - root.z), Math.abs(current.max.z - root.z))) + .2;
            const low = Math.min(-.08, current.min.y - root.y - .2), high = current.max.y - root.y + .2;
            const swept = current.clone().expandByScalar(.2);
            for (const point of move.route.points) {
                const ground = residentGroundHeight(point, job.completedSets >= 2);
                swept.expandByPoint(new THREE.Vector3(point.x - radius, ground + low, point.z - radius));
                swept.expandByPoint(new THREE.Vector3(point.x + radius, ground + high, point.z + radius));
            }
            bounds.push(swept);
        }
        return bounds;
    }

    snapshot() {
        const job = this.job;
        if (!job) return null;
        const actor = (move: ClearanceMove) => {
            const resident = this.residents[move.index];
            return { index: move.index, species: resident.species, action: resident.action, position: resident.group.position.toArray(),
                route: { points: move.route.points.map(point => ({ ...point })), yaw: move.route.yaw } };
        };
        return { active: this.active, phase: this.active ? 'moving' : job.blocked.length ? 'blocked' : 'settled',
            startedAt: job.startedAt, reduced: job.reduced, current: job.current ? actor(job.current) : null,
            queue: job.moves.slice(job.cursor + (job.current ? 1 : 0)).map(actor), completed: [...job.completed], blocked: [...job.blocked] };
    }
}
