import * as THREE from 'three';
import { getIslandLandAccess, getIslandLands } from '../../../domain/island/catalog';
import { getIslandSharedMemories, isSharedResidentAvailable, isValidSharedDisplayPlacement, sharedDestinationKey, sharedDisplayKey,
    sharedIlluminationResult, sharedTargetVisualKey, resolveSharedTarget, SHARED_DISPLAY_RADII, sharedDisplayObstacles,
    type IslandSharedMemoriesAction, type SharedDisplay, type SharedDisplayId, type SharedRequest, type SharedTarget, type SharedVisibleResult } from '../../../domain/island/sharedMemories';
import { sharedCarryRouteIsClear } from './sharedCarryRoute';
import { WORKSHOP_SPECIMENS } from '../../../domain/island/workshop';
import type { IslandRecord } from '../../../domain/island/types';
import type { IslandSharedSceneRequest, IslandSharedStageState } from './types';
import { IslandSharedDisplayScene, type SharedDisplayTargetVisual } from './sharedDisplayScene';
import { SharedJobActor, type SharedContactPose } from './sharedJobActor';
import { SharedJobVisuals } from './sharedJobVisuals';
import type { IslandResident } from './animals';
import { planResidentPointRoute, residentObstacles, RESIDENT_FOOTPRINT, type ResidentRoute } from './navigation';
import type { SharedJobFrame } from './sharedDisplayFraming';

interface Step { name: string; duration: number; pose: (fraction: number) => void; points: () => THREE.Vector3[]; finish?: () => void }
interface Execution {
    id: string; target: SharedTarget; displayId: SharedDisplayId; targetVisual: SharedDisplayTargetVisual;
    request?: SharedRequest; action?: IslandSharedMemoriesAction; actor?: SharedJobActor;
    sourceId?: SharedDisplayId; ownTarget: boolean; committed: boolean; emitted: boolean;
    fromPreview?: boolean; scene?: IslandSharedDisplayScene; table?: SharedDisplay;
    route?: ResidentRoute;
    steps: Step[]; index: number; started: number; ready: boolean; phase: string;
    initialItems: string; initialDisplays: string; result?: SharedVisibleResult;
}
const smooth = (value: number) => { const t = THREE.MathUtils.clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const shown = (object: THREE.Object3D) => { for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return false; return true; };
const routeLength = (route: ResidentRoute) => route.points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - route.points[index].x, point.z - route.points[index].z), 0);

/** Explicit, cancellable optional work. Timers stage actual geometry; only a
 * visible rendered step can advance contact, release, or a saved result. */
export class IslandSharedJobController {
    readonly group = new THREE.Group();
    readonly props = new SharedJobVisuals();
    readonly preparation = new IslandSharedDisplayScene();
    readonly destination = new IslandSharedDisplayScene();
    private state?: IslandSharedStageState;
    private execution?: Execution;
    private reduced = false;
    private now = 0;
    private failure?: string;
    private disposed = false;
    private readonly consumed = new Set<string>();
    constructor(private readonly displays: IslandSharedDisplayScene, private readonly preview: IslandSharedDisplayScene,
        private readonly residents: readonly IslandResident[], private readonly callbacks: {
            action?: (action: IslandSharedMemoriesAction) => void; feedback?: (text: string) => void;
        }) {
        this.group.name = 'shared-job'; this.group.add(this.props.group, this.preparation.group, this.destination.group);
    }
    get active() { return Boolean(this.execution); }
    get actor() { return this.execution?.actor?.resident; }
    get phase() { return this.execution?.phase ?? 'idle'; }
    get bounds() {
        const execution = this.execution;
        if (!execution) return undefined;
        const bounds = execution.targetVisual.bounds();
        const table = (execution.scene ?? this.displays).describe().find(display => display.displayId === (execution.sourceId ?? execution.displayId));
        if (table) bounds.union(table.tableBounds);
        if (execution.request?.jobId === 'carry' && !execution.emitted) this.destination.describe().forEach(display => bounds.union(display.tableBounds));
        if (execution.actor) bounds.union(new THREE.Box3().setFromObject(execution.actor.resident.group, true));
        this.props.group.traverseVisible(object => { if (object instanceof THREE.Mesh) bounds.union(new THREE.Box3().setFromObject(object)); });
        return bounds;
    }
    /** Borrow actual meshes for viewing; never solve a different contact pose
     * or create visible stand-ins for a framing test. */
    get framing(): SharedJobFrame | undefined {
        const e = this.execution, resident = e?.actor?.resident, bounds = this.bounds;
        if (!e || !resident || !bounds || !this.state?.active || !shown(resident.group) || !shown(e.targetVisual.group)) return;
        const channels: SharedJobFrame['channels'][number][] = [];
        const target = e.targetVisual;
        if (target.specimen) channels.push({ name: 'target', objects: [target.specimen.group] });
        else for (const [id, part] of Object.entries(target.parts)) channels.push({ name: `target-${id}`, objects: [part.group] });
        channels.push({ name: 'head', objects: [resident.head], identity: true },
            { name: 'body', objects: resident.body.children.filter(child => child instanceof THREE.Mesh), identity: true });
        for (const side of resident.species === 'otter' ? ['left', 'right'] : ['left']) {
            const handContact = resident.group.getObjectByName(`hand-contact-${side}`), paw = handContact?.parent;
            if (paw) channels.push({ name: `paw-${side}`, objects: [paw], handContact });
        }
        const origin = resident.head.getWorldPosition(new THREE.Vector3());
        const direction = new THREE.Vector3(0, 0, 1).transformDirection(resident.head.matrixWorld);
        const light = this.props.lightContact;
        let illumination: SharedJobFrame['light'];
        if (shown(this.props.lamp)) channels.push({ name: 'lamp', objects: [this.props.lamp] });
        if (light) {
            const scene = e.scene ?? this.displays;
            const slot = scene.group.getObjectByName(`shared-${e.sourceId ?? e.displayId}`);
            const table = slot?.getObjectByName('shared-display-table');
            const receiverSamples: THREE.Vector3[] = [];
            if (table) {
                table.updateWorldMatrix(true, true);
                const above = new THREE.Box3().setFromObject(table, true).max.y + .05;
                for (const [x, z] of [[0, 0], [-.04, 0], [.04, 0], [0, -.04], [0, .04]]) {
                    const origin = light.receiver.clone().add(new THREE.Vector3(x, 0, z)); origin.y = above;
                    const hit = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0), 0, above - light.receiver.y + .05).intersectObject(table, true)[0];
                    if (hit) receiverSamples.push(hit.point.clone());
                }
            }
            illumination = { source: light.source.clone(), surface: light.surface.clone(), receiver: light.receiver.clone(), receiverSamples };
        }
        return { key: e.id, phase: e.phase, bounds, channels, facing: { origin, direction }, light: illumination };
    }
    /** Called before static slots can be removed by a profile/tab update. */
    beforeUpdate(next?: IslandSharedStageState) {
        if (this.disposed) return;
        const execution = this.execution;
        if (execution && (!next?.active || next.island.profileId !== this.state?.island.profileId)) this.stop();
        if (execution && this.execution && next) {
            const request = next.island.sharedMemories?.activeRequest;
            const committed = execution.emitted && next.island.sharedMemories?.displays[execution.displayId]?.target.targetKey === execution.target.targetKey
                && (!execution.request || request?.requestId === execution.request.requestId && request.status === 'result-seen');
            if (JSON.stringify(next.island.items) !== execution.initialItems
                || execution.request && sharedTargetVisualKey(next.island, execution.target) !== execution.request.visualKey
                || !committed && (JSON.stringify(next.island.sharedMemories?.displays ?? {}) !== execution.initialDisplays
                    || execution.request && (request?.requestId !== execution.request.requestId || request.status !== 'prepared'))) this.stop();
        }
        this.state = next;
    }
    afterUpdate() {
        const execution = this.execution, state = this.state;
        if (!execution || !state || !execution.emitted || execution.committed) return;
        const saved = state.island.sharedMemories?.displays[execution.displayId];
        if (saved?.target.targetKey !== execution.target.targetKey) return;
        if (execution.request && (state.island.sharedMemories?.activeRequest?.requestId !== execution.request.requestId
            || state.island.sharedMemories.activeRequest.status !== 'result-seen')) return;
        if (execution.ownTarget) {
            if (!this.displays.adoptTarget(execution.displayId, execution.targetVisual)) return;
            execution.ownTarget = false;
        }
        this.displays.restoreTarget(execution.displayId); execution.committed = true;
        this.props.petals.forEach(petal => { petal.visible = false; }); this.destination.group.visible = false;
    }
    stop() {
        const execution = this.execution;
        if (execution) {
            if (execution.committed) this.displays.restoreTarget(execution.displayId);
            else if (execution.sourceId) this.displays.restoreTarget(execution.sourceId);
            if (execution.ownTarget) {
                if (execution.fromPreview && this.preview.adoptTarget(execution.displayId, execution.targetVisual)) this.preview.restoreTarget(execution.displayId);
                else execution.targetVisual.dispose();
            }
            if (execution.sourceId && execution.action?.type === 'place-display') {
                const preview = this.preview.targetObject(execution.displayId); if (preview) preview.visible = true;
            }
            execution.actor?.restore();
        }
        this.execution = undefined; this.props.reset(); this.preparation.group.visible = false; this.destination.group.visible = false;
        if (this.state) {
            const empty: IslandRecord = { ...this.state.island, sharedMemories: { version: 1, memories: [], nextMemoryOrder: 1, displays: {} } };
            this.preparation.update(empty, { active: false }); this.destination.update(empty, { active: false });
        }
    }
    command(request: IslandSharedSceneRequest, now: number, reduced: boolean) {
        if (this.disposed || this.consumed.has(request.id)) return;
        this.consumed.add(request.id); if (this.consumed.size > 128) this.consumed.delete(this.consumed.values().next().value!);
        if (request.command.type === 'stop') { this.stop(); return; }
        if (!this.state?.active) return;
        this.stop(); this.failure = undefined; this.now = now; this.reduced = reduced;
        try {
            const command = request.command, state = this.state, island = state.island;
            if (command.type === 'place-preview') {
                const p = state.preview, action = command.action;
                if (!p?.valid || p.displayId !== action.displayId || p.position.x !== action.position.x || p.position.z !== action.position.z
                    || p.rotation !== action.rotation || !isValidSharedDisplayPlacement(island, p.displayId, p.target, p.position)
                    || sharedDisplayKey(island.sharedMemories?.displays[p.displayId]) !== action.expectedDisplayKey) return;
                if (resolveSharedTarget(island, action.target).targetKey !== p.target.targetKey) return;
                const previewVisual = this.preview.targetVisual(p.displayId); if (!previewVisual) return;
                const finish = previewVisual.group.getWorldPosition(new THREE.Vector3());
                const finishRotation = previewVisual.group.getWorldQuaternion(new THREE.Quaternion());
                const source = this.displays.describe().find(display => display.targetKey === p.target.targetKey);
                const visual = source ? this.displays.targetVisual(source.displayId) : this.preview.releaseTarget(p.displayId);
                if (!visual) return;
                this.group.attach(visual.group);
                const execution = this.begin(request.id, p.target, p.displayId, visual, !source); execution.action = action;
                execution.sourceId = source?.displayId; execution.fromPreview = !source;
                previewVisual.group.visible = !source;
                const start = visual.group.position.clone(), startRotation = visual.group.quaternion.clone();
                execution.steps.push({ name: 'person-placing', duration: 620,
                    pose: t => {
                        visual.group.position.copy(start).lerp(finish, smooth(t)).y += Math.sin(Math.PI * t) * .3;
                        visual.group.quaternion.copy(startRotation).slerp(finishRotation, smooth(t));
                    }, points: () => [visual.anchors().center] });
                this.result(execution); return this.update(now, reduced);
            }
            if (command.type === 'run') {
                const prepared = island.sharedMemories?.activeRequest;
                if (prepared?.status !== 'prepared' || prepared.requestId !== command.requestId || !isSharedResidentAvailable(island, prepared.residentId)) return;
                return this.startResident(request.id, prepared, now);
            }
            if (command.type === 'memory') return this.startMemory(request.id, command.memoryKey, now);
            const display = island.sharedMemories?.displays[command.displayId], visual = this.displays.targetVisual(command.displayId);
            if (!display || !visual) return;
            if (command.type === 'arrange' && sharedDisplayKey(display) !== command.expectedDisplayKey) return;
            const execution = this.begin(request.id, display.target, command.displayId, visual, false);
            execution.sourceId = command.displayId;
            if (command.type === 'arrange') {
                execution.action = { type: 'arrange-display', displayId: command.displayId, expectedDisplayKey: command.expectedDisplayKey };
                this.arrangeSteps(execution);
            } else this.illuminationSteps(execution);
            this.result(execution); return this.update(now, reduced);
        } catch (error) { this.stop(); this.failure = error instanceof Error ? error.message : 'Unknown work error'; this.callbacks.feedback?.('ばしょを かえて ためそう'); }
    }
    private begin(id: string, target: SharedTarget, displayId: SharedDisplayId, targetVisual: SharedDisplayTargetVisual, ownTarget: boolean) {
        const execution: Execution = { id, target, displayId, targetVisual, ownTarget, committed: false, emitted: false, steps: [], index: 0,
            started: this.now, ready: false, phase: 'preparing', initialItems: JSON.stringify(this.state!.island.items),
            initialDisplays: JSON.stringify(this.state!.island.sharedMemories?.displays ?? {}) };
        this.execution = execution; this.props.group.visible = true; return execution;
    }
    private result(execution: Execution) {
        execution.steps.push({ name: 'result-visible', duration: 140, pose: () => {}, points: () => [execution.targetVisual.anchors().center], finish: () => {
            if (execution.emitted) return;
            const request = execution.request, current = this.state?.island.sharedMemories?.activeRequest;
            if (request) {
                if (current?.requestId !== request.requestId || current.status !== 'prepared' || current.target.targetKey !== execution.target.targetKey
                    || sharedTargetVisualKey(this.state!.island, current.target) !== current.visualKey || !execution.result) return;
                execution.action = { type: 'complete-request', requestId: request.requestId, targetKey: request.target.targetKey,
                    visualKey: request.visualKey, destinationKey: sharedDestinationKey(request.destination), result: execution.result };
            }
            execution.emitted = true;
            if (execution.action) this.callbacks.action?.(execution.action);
        } });
    }
    update(now: number, reduced: boolean) {
        this.now = now; this.reduced = reduced;
        const execution = this.execution; if (!execution) return false;
        const step = execution.steps[execution.index];
        if (!step) { execution.phase = 'settled'; return false; }
        execution.phase = step.name;
        const duration = reduced ? Math.min(step.duration, 240) : step.duration;
        const fraction = THREE.MathUtils.clamp((now - execution.started) / Math.max(1, duration), 0, 1);
        step.pose(reduced ? fraction >= 1 ? 1 : 0 : fraction); execution.ready = fraction >= 1; this.group.updateWorldMatrix(true, true); return true;
    }
    afterRender(visible: (point: THREE.Vector3) => boolean) {
        const execution = this.execution;
        if (!execution?.ready || !this.state?.active || !shown(execution.targetVisual.group) || execution.actor && !shown(execution.actor.resident.group)) return;
        const step = execution.steps[execution.index], points = step?.points() ?? [];
        if (!points.length || !points.every(point => [point.x, point.y, point.z].every(Number.isFinite) && visible(point))) return;
        step.finish?.(); execution.index++; execution.started = this.now; execution.ready = false;
    }
    get lastFailure() { return this.failure; }
    diagnostic() {
        const e = this.execution;
        const anchors = e?.targetVisual.anchors(), actor = e?.actor?.resident;
        const hands = actor ? ['left', 'right'].map(side => actor.handAnchor(new THREE.Vector3(), side as 'left' | 'right')) : [];
        return e ? { id: e.id, phase: e.phase, targetKey: e.target.targetKey, targetUuid: e.targetVisual.group.uuid,
            actorId: e.actor?.resident.species, actorUuid: e.actor?.resident.group.uuid, actorPosition: e.actor?.resident.group.position.toArray(), requestId: e.request?.requestId, sourceId: e.sourceId,
            route: e.route, hands: hands.map(hand => hand.toArray()), grips: anchors ? [anchors.gripLeft.toArray(), anchors.gripRight.toArray()] : [],
            gripDistances: anchors ? hands.map(hand => Math.min(hand.distanceTo(anchors.gripLeft), hand.distanceTo(anchors.gripRight))) : [],
            hand: e.actor?.resident.handAnchor(new THREE.Vector3(), 'left').toArray(), targetPosition: e.targetVisual.group.getWorldPosition(new THREE.Vector3()).toArray(),
            petals: this.props.petals.map(petal => ({ uuid: petal.uuid, visible: petal.visible, position: petal.getWorldPosition(new THREE.Vector3()).toArray() })),
            light: this.props.lightContact, emitted: e.emitted, committed: e.committed } : null;
    }
    private route(actor: SharedJobActor, from: THREE.Vector3, pose: SharedContactPose, extra: { x: number; z: number; radius: number }[] = []) {
        const island = this.state!.island;
        return planResidentPointRoute(from, pose.root, island.items, getIslandLandAccess(island), {
            departingId: actor.resident.itemId || actor.resident.departingId, yaw: pose.yaw,
            occupied: this.residents.filter(resident => resident !== actor.resident && resident.group.visible).map(resident => resident.group.position),
            obstacles: [...sharedDisplayObstacles(island), ...extra, ...(this.execution?.scene === this.preparation && this.execution.table
                ? [{ ...this.execution.table.position, radius: SHARED_DISPLAY_RADII[this.execution.target.kind] }] : [])] });
    }
    private walkStep(execution: Execution, route: ResidentRoute, lean = 0, carried?: SharedDisplayTargetVisual, follow?: () => void, carryYaw?: number) {
        execution.steps.push({ name: carried ? 'carrying' : 'walking', duration: Math.max(500, routeLength(route) * 740),
            pose: t => {
                execution.route = route;
                const facing = carried && carryYaw !== undefined ? carryYaw + Math.atan2(Math.sin(route.yaw - carryYaw), Math.cos(route.yaw - carryYaw)) * smooth(t) : undefined;
                execution.actor!.walk(route, t, getIslandLandAccess(this.state!.island), this.reduced, lean, facing);
                if (carried) {
                    const a = carried.anchors(); execution.actor!.aimHands([a.gripLeft, a.gripRight]);
                }
                follow?.();
            }, points: () => [execution.actor!.resident.group.position.clone().add(new THREE.Vector3(0, .6, 0))] });
    }
    private contactStep(execution: Execution, pose: SharedContactPose, points: () => THREE.Vector3[], name: string, finish?: () => void) {
        execution.steps.push({ name, duration: 320, pose: () => execution.actor!.pose(pose.root, pose.yaw, pose.lean, points()),
            points: () => {
                const targets = points(), hands = targets.map((_, index) => execution.actor!.resident.handAnchor(new THREE.Vector3(), index === 0 ? 'left' : 'right'));
                const matches = hands.every(hand => targets.some(point => hand.distanceTo(point) < .04));
                return matches ? [...hands, ...targets] : [];
            }, finish });
    }
    private anchors(execution: Execution) { return (execution.scene ?? this.displays).anchors(execution.displayId)!; }
    private table(execution: Execution) { return execution.table ?? this.state!.island.sharedMemories!.displays[execution.displayId]!; }
    private arrangeSteps(execution: Execution) {
        const anchors = this.anchors(execution); if (!anchors) throw new Error('No display');
        this.props.petals.forEach((petal, index) => { petal.visible = true; petal.position.copy(this.props.group.worldToLocal(anchors.preparation[index].clone())); });
        for (let index = 0; index < 3; index++) {
            const petal = this.props.petals[index], from = anchors.preparation[index], to = anchors.petals[index];
            execution.steps.push({ name: `petal-${index + 1}`, duration: 520, pose: t => {
                petal.position.copy(this.props.group.worldToLocal(from.clone().lerp(to, smooth(t)).add(new THREE.Vector3(0, Math.sin(Math.PI * t) * .25, 0))));
            }, points: () => [petal.getWorldPosition(new THREE.Vector3()), to] });
        }
        execution.result = { kind: 'petals-arranged', count: 3 };
    }
    private *lightingGrips(execution: Execution, surface: THREE.Vector3, normal: THREE.Vector3, effect: 'shadow' | 'transmit') {
        const display = this.table(execution), table = new THREE.Vector3(display.position.x, 0, display.position.z);
        const tangent = normal.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
        for (const shift of [0, -.3, .3, -.55, .55]) for (const distance of [.55, .75, .95, 1.15]) for (const height of [.36, .5, .7]) {
            const grip = surface.clone().addScaledVector(normal, distance).addScaledVector(tangent, shift).add(new THREE.Vector3(0, height - .18, -.065));
            this.props.lamp.position.copy(this.props.group.worldToLocal(grip.clone()));
            if (this.props.illuminate(execution.targetVisual, surface, .525, table, SHARED_DISPLAY_RADII[display.target.kind], effect)) yield grip;
        }
    }
    private illuminationSteps(execution: Execution) {
        const anchors = this.anchors(execution); if (!anchors) throw new Error('No display');
        const display = this.table(execution);
        const result = sharedIlluminationResult(execution.target, execution.targetVisual.appearance?.cleanedMask);
        if (result.kind !== 'illuminated') throw new Error('No material');
        const part = result.partId && execution.targetVisual.parts[result.partId];
        const normal = part && result.effect === 'transmit' ? new THREE.Vector3(1, 0, 0).applyQuaternion(part.group.getWorldQuaternion(new THREE.Quaternion()))
            : new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), display.rotation);
        const surface = result.partId ? anchors.partSurfaces[result.partId]! : anchors.surface;
        const candidate = this.lightingGrips(execution, surface, normal, result.effect).next();
        this.props.reset(); this.props.group.visible = true;
        if (candidate.done) throw new Error('No visible lighting surface');
        const grip = candidate.value;
        this.props.lamp.visible = true; const from = anchors.preparation[1];
        execution.steps.push({ name: 'lamp-lifting', duration: 480, pose: t => this.props.lamp.position.copy(this.props.group.worldToLocal(from.clone().lerp(grip, smooth(t)))),
            points: () => [this.props.emitter()] });
        execution.steps.push({ name: 'illuminating', duration: 850, pose: () => {
            this.props.lamp.position.copy(this.props.group.worldToLocal(grip.clone()));
            this.props.illuminate(execution.targetVisual, surface, .525, new THREE.Vector3(display.position.x, 0, display.position.z), SHARED_DISPLAY_RADII[display.target.kind], result.effect);
        }, points: () => this.props.lightContact ? [this.props.lightContact.source, this.props.lightContact.surface, this.props.lightContact.receiver] : [] });
        execution.result = result;
    }
    private sceneIsland(island: IslandRecord, displayId: SharedDisplayId, target: SharedTarget, position: { x: number; z: number }, rotation: number): IslandRecord {
        return { ...island, sharedMemories: { version: 1, memories: [], nextMemoryOrder: 1,
            displays: { [displayId]: { target, position, rotation, arrangement: 'plain', placedAt: 0 } } } };
    }
    private preparationPoint(target: SharedTarget, actor: IslandResident, destination?: { x: number; z: number }) {
        const island = this.state!.island, radius = SHARED_DISPLAY_RADII[target.kind];
        const points: THREE.Vector3[] = [];
        for (const land of getIslandLands(getIslandLandAccess(island))) {
            for (let x = Math.ceil(land.x - land.radiusX); x <= land.x + land.radiusX; x += .5) for (let z = Math.ceil(land.z - land.radiusZ); z <= land.z + land.radiusZ; z += .5) {
                if (destination && Math.hypot(x - destination.x, z - destination.z) < radius * 2 + .25
                    || this.residents.some(resident => resident.group.visible && Math.hypot(resident.group.position.x - x, resident.group.position.z - z) < radius + .5)) continue;
                if (sharedDisplayObstacles(island).every(other => Math.hypot(x - other.x, z - other.z) >= radius + other.radius + .15)
                    && isValidSharedDisplayPlacement(island, 'display-1', target, { x, z })) points.push(new THREE.Vector3(x, 0, z));
            }
        }
        points.sort((a, b) => a.distanceToSquared(actor.group.position) - b.distanceToSquared(actor.group.position));
        return points[0];
    }
    private contactRoute(actor: SharedJobActor, from: THREE.Vector3, targets: THREE.Vector3[], center: THREE.Vector3,
        extra: { x: number; z: number; radius: number }[] = []) {
        const point = targets.reduce((sum, target) => sum.add(target), new THREE.Vector3()).multiplyScalar(1 / targets.length);
        const yaw = Math.atan2(center.x - point.x, center.z - point.z);
        for (const offset of [0, -.18, .18, -.35, .35, -.6, .6]) {
            for (const pose of actor.contactCandidates(targets, yaw + offset)) {
                const route = this.route(actor, from, pose, extra); if (route) return { pose, route };
            }
        }
        return undefined;
    }
    private startResident(id: string, request: SharedRequest, now: number) {
        const island = this.state!.island, resident = this.residents.find(resident => resident.species === request.residentId && resident.group.visible);
        if (!resident || request.visualKey !== sharedTargetVisualKey(island, request.target)
            || sharedDisplayKey(island.sharedMemories?.displays[request.destination.displayId]) !== request.destination.expectedDisplayKey) return;
        if (request.source.kind === 'display' && sharedDisplayKey(island.sharedMemories?.displays[request.source.displayId]) !== request.source.expectedDisplayKey) return;
        const actor = new SharedJobActor(resident);
        if (request.jobId === 'carry') {
            this.destination.update(this.sceneIsland(island, request.destination.displayId, request.target, request.destination.position, request.destination.rotation));
            const landing = this.destination.targetVisual(request.destination.displayId)!; landing.group.visible = false;
            let visual: SharedDisplayTargetVisual, sourcePosition: THREE.Vector3, sourceRotation: number;
            if (request.source.kind === 'display') {
                visual = this.displays.targetVisual(request.source.displayId)!;
                const source = island.sharedMemories!.displays[request.source.displayId]!;
                sourcePosition = new THREE.Vector3(source.position.x, 0, source.position.z); sourceRotation = source.rotation;
            } else {
                const point = this.preparationPoint(request.target, resident, request.destination.position); if (!point) throw new Error('No preparation space');
                this.preparation.update(this.sceneIsland(island, request.destination.displayId, request.target, point, request.destination.rotation));
                visual = this.preparation.targetVisual(request.destination.displayId)!; sourcePosition = point; sourceRotation = request.destination.rotation;
            }
            const source = visual.anchors(), destination = landing.anchors(), radius = SHARED_DISPLAY_RADII[request.target.kind];
            const extra = [{ x: request.destination.position.x, z: request.destination.position.z, radius }, ...(request.source.kind === 'tray' ? [{ x: sourcePosition.x, z: sourcePosition.z, radius }] : [])];
            let plan: { pickup: SharedContactPose; lifted: SharedContactPose; landing: SharedContactPose; raisedLanding: SharedContactPose; approach: ResidentRoute; carry: ResidentRoute } | undefined;
            const liftHeight = .14; let collision: unknown;
            for (const pickup of actor.contactCandidates([source.gripLeft, source.gripRight], sourceRotation + Math.PI)) {
                const end = actor.contactCandidates([destination.gripLeft, destination.gripRight], request.destination.rotation + Math.PI).find(pose => pose.lean === pickup.lean);
                if (!end) continue;
                const lifted = actor.contactCandidates([source.gripLeft.clone().add(new THREE.Vector3(0, liftHeight, 0)), source.gripRight.clone().add(new THREE.Vector3(0, liftHeight, 0))], pickup.yaw).find(pose => pose.lean === pickup.lean);
                const raisedLanding = actor.contactCandidates([destination.gripLeft.clone().add(new THREE.Vector3(0, liftHeight, 0)), destination.gripRight.clone().add(new THREE.Vector3(0, liftHeight, 0))], end.yaw).find(pose => pose.lean === pickup.lean);
                if (!lifted || !raisedLanding) continue;
                const liftRoute = this.route(actor, pickup.root, lifted, extra), lowerRoute = this.route(actor, raisedLanding.root, end, extra);
                if (!liftRoute || !lowerRoute || routeLength(liftRoute) > .5 || routeLength(lowerRoute) > .5) continue;
                const approach = this.route(actor, resident.group.position, pickup, extra);
                if (!approach) continue;
                const sweptObstacles = [...residentObstacles(island.items, ''),
                    ...sharedDisplayObstacles(island).filter(other => other.displayId !== request.destination.displayId
                        && !(request.source.kind === 'display' && other.displayId === request.source.displayId)),
                    ...this.residents.filter(other => other !== resident && other.group.visible).map(other => ({ x: other.group.position.x, z: other.group.position.z, radius: RESIDENT_FOOTPRINT }))];
                const liftedBounds = visual.bounds().translate(new THREE.Vector3(0, liftHeight, 0));
                let carry: ResidentRoute | undefined;
                for (const margin of [0, .2, .4, .6]) {
                    const wider = sweptObstacles.filter(obstacle => Math.min(Math.hypot(obstacle.x - lifted.root.x, obstacle.z - lifted.root.z),
                        Math.hypot(obstacle.x - raisedLanding.root.x, obstacle.z - raisedLanding.root.z)) >= obstacle.radius + RESIDENT_FOOTPRINT + margin)
                        .map(obstacle => ({ ...obstacle, radius: obstacle.radius + margin }));
                    const candidate = this.route(actor, lifted.root, raisedLanding, [...extra, ...wider]);
                    if (candidate && sharedCarryRouteIsClear(candidate, liftedBounds, lifted.root, lifted.yaw, sweptObstacles, blocked => { collision = blocked; })) { carry = candidate; break; }
                }
                if (carry) { plan = { pickup, lifted, landing: end, raisedLanding, approach, carry }; break; }
            }
            if (!plan) throw new Error(`No clear carrying route: ${JSON.stringify(collision)}`);
            const execution = this.begin(id, request.target, request.destination.displayId, visual, false);
            execution.request = request; execution.actor = actor;
            execution.sourceId = request.source.kind === 'display' ? request.source.displayId : undefined;
            this.walkStep(execution, plan.approach);
            this.contactStep(execution, plan.pickup, () => { const a = visual.anchors(); return [a.gripLeft, a.gripRight]; }, 'pickup-contact', () => {
                if (request.source.kind === 'tray') { this.preparation.releaseTarget(request.destination.displayId); execution.ownTarget = true; }
                this.group.attach(visual.group);
            });
            const pickup = plan.pickup, lifted = plan.lifted;
            const sourcePoint = visual.group.getWorldPosition(new THREE.Vector3());
            const contacts = () => {
                const a = visual.anchors(), hands = ['left', 'right'].map(side => resident.handAnchor(new THREE.Vector3(), side as 'left' | 'right'));
                return hands.every(hand => [a.gripLeft, a.gripRight].some(point => point.distanceTo(hand) < .04)) ? [...hands, a.gripLeft, a.gripRight] : [];
            };
            execution.steps.push({ name: 'lifting', duration: 480, pose: t => {
                visual.group.position.copy(this.group.worldToLocal(sourcePoint.clone().add(new THREE.Vector3(0, liftHeight * smooth(t), 0))));
                const a = visual.anchors(); actor.pose(pickup.root.clone().lerp(lifted.root, smooth(t)), pickup.yaw, pickup.lean, [a.gripLeft, a.gripRight]);
            }, points: contacts, finish: () => resident.group.attach(visual.group) });
            this.walkStep(execution, plan.carry, plan.pickup.lean, visual, undefined, plan.pickup.yaw);
            const end = plan.landing, raised = plan.raisedLanding, landingPoint = this.destination.anchors(request.destination.displayId)!.destination;
            execution.steps.push({ name: 'lowering', duration: 480, pose: t => {
                this.group.attach(visual.group);
                visual.group.position.copy(this.group.worldToLocal(landingPoint.clone().add(new THREE.Vector3(0, liftHeight * (1 - smooth(t)), 0))));
                const a = visual.anchors(); actor.pose(raised.root.clone().lerp(end.root, smooth(t)), end.yaw, end.lean, [a.gripLeft, a.gripRight]);
            }, points: contacts });
            execution.steps.push({ name: 'hands-released', duration: 420, pose: t => actor.pose(end.root, end.yaw, end.lean * (1 - smooth(t))),
                points: () => visual.group.getWorldPosition(new THREE.Vector3()).distanceTo(landingPoint) < .04
                    && resident.handAnchor(new THREE.Vector3(), 'left').distanceTo(visual.anchors().gripRight) > .06
                    ? [visual.anchors().center, landingPoint] : [] });
            execution.result = { kind: 'placed' }; this.result(execution); this.restStep(execution, end);
        } else {
            const visual = this.displays.targetVisual(request.destination.displayId);
            if (!visual || visual.group.userData.targetKey !== request.target.targetKey) throw new Error('Missing target');
            const execution = this.begin(id, request.target, request.destination.displayId, visual, false);
            execution.request = request; execution.actor = actor; execution.sourceId = request.destination.displayId;
            if (request.jobId === 'gather') this.residentPetals(execution);
            else this.residentLight(execution);
        }
        return this.update(now, this.reduced);
    }
    private restStep(execution: Execution, pose: SharedContactPose) {
        execution.steps.push({ name: 'together-resting', duration: 1300, pose: t => {
            execution.actor!.pose(pose.root, pose.yaw, .12); execution.actor!.resident.pose.position.y = -smooth(t) * .10;
            execution.actor!.look(execution.targetVisual.anchors().center);
        }, points: () => [execution.targetVisual.anchors().center, execution.actor!.resident.head.getWorldPosition(new THREE.Vector3())],
            finish: () => this.callbacks.feedback?.('いっしょに ひとやすみ') });
    }
    private residentPetals(execution: Execution) {
        const anchors = this.anchors(execution)!, actor = execution.actor!, center = this.table(execution).position;
        const table = new THREE.Vector3(center.x, 0, center.z);
        let origin = actor.resident.group.position.clone(), last: SharedContactPose | undefined;
        const legs = anchors.preparation.map((point, index) => {
            const pickup = this.contactRoute(actor, origin, [point], table); if (!pickup) throw new Error(`No petal pickup route ${index}: ${origin.toArray()}`);
            const place = this.contactRoute(actor, pickup.pose.root, [anchors.petals[index]], table); if (!place) throw new Error(`No petal placement route ${index}`);
            origin = place.pose.root; last = place.pose; return { pickup, place };
        });
        this.props.petals.forEach((petal, index) => { petal.visible = true; petal.position.copy(this.props.group.worldToLocal(anchors.preparation[index].clone())); });
        legs.forEach(({ pickup, place }, index) => {
            const petal = this.props.petals[index]; let localHold: THREE.Vector3 | undefined;
            this.walkStep(execution, pickup.route);
            this.contactStep(execution, pickup.pose, () => [petal.getWorldPosition(new THREE.Vector3())], `petal-${index + 1}-pickup`, () => {
                localHold = actor.resident.group.worldToLocal(petal.getWorldPosition(new THREE.Vector3()));
            });
            this.walkStep(execution, place.route, pickup.pose.lean, undefined, () => {
                if (!localHold) return;
                const point = actor.resident.group.localToWorld(localHold.clone());
                actor.aimHands([point]);
                petal.position.copy(this.props.group.worldToLocal(actor.resident.handAnchor(new THREE.Vector3(), 'left')));
            });
            execution.steps.push({ name: `petal-${index + 1}-placing`, duration: 420, pose: () => {
                actor.pose(place.pose.root, place.pose.yaw, place.pose.lean, [anchors.petals[index]]);
                petal.position.copy(this.props.group.worldToLocal(actor.resident.handAnchor(new THREE.Vector3(), 'left')));
            }, points: () => petal.getWorldPosition(new THREE.Vector3()).distanceTo(anchors.petals[index]) < .04 ? [anchors.petals[index]] : [],
                finish: () => petal.position.copy(this.props.group.worldToLocal(anchors.petals[index].clone())) });
        });
        execution.steps.push({ name: 'three-petals-visible', duration: 260, pose: () => actor.pose(last!.root, last!.yaw),
            points: () => this.props.petals.every((petal, index) => petal.getWorldPosition(new THREE.Vector3()).distanceTo(anchors.petals[index]) < .04)
                ? this.props.petals.map(petal => petal.getWorldPosition(new THREE.Vector3())) : [] });
        execution.result = { kind: 'petals-arranged', count: 3 };
        this.result(execution); this.offerSnack(execution, last!);
    }
    private residentLight(execution: Execution) {
        const actor = execution.actor!, anchors = this.anchors(execution)!;
        const display = this.table(execution), table = new THREE.Vector3(display.position.x, 0, display.position.z);
        const result = sharedIlluminationResult(execution.target, execution.targetVisual.appearance?.cleanedMask);
        if (result.kind !== 'illuminated') throw new Error('No surface');
        const part = result.partId && execution.targetVisual.parts[result.partId];
        const normal = part && result.effect === 'transmit' ? new THREE.Vector3(1, 0, 0).applyQuaternion(part.group.getWorldQuaternion(new THREE.Quaternion()))
            : new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), display.rotation);
        const surface = result.partId ? anchors.partSurfaces[result.partId]! : anchors.surface;
        const pickup = this.contactRoute(actor, actor.resident.group.position, [anchors.preparation[1]], table);
        if (!pickup) throw new Error('No lamp route');
        let selected: { grip: THREE.Vector3; shine: { pose: SharedContactPose; route: ResidentRoute } } | undefined;
        for (const grip of this.lightingGrips(execution, surface, normal, result.effect)) {
            const shine = this.contactRoute(actor, pickup.pose.root, [grip], table); if (!shine) continue;
            selected = { grip, shine }; break;
        }
        this.props.reset(); this.props.group.visible = true;
        if (!selected) throw new Error(`No reachable lighting surface: ${JSON.stringify(this.props.lastProbe)}`);
        const { grip, shine } = selected;
        this.props.lamp.visible = true; this.props.lamp.position.copy(this.props.group.worldToLocal(anchors.preparation[1].clone()));
        this.walkStep(execution, pickup.route);
        let localHold: THREE.Vector3 | undefined;
        this.contactStep(execution, pickup.pose, () => [this.props.lamp.getWorldPosition(new THREE.Vector3())], 'lamp-pickup', () => {
            localHold = actor.resident.group.worldToLocal(this.props.lamp.getWorldPosition(new THREE.Vector3()));
        });
        this.walkStep(execution, shine.route, pickup.pose.lean, undefined, () => {
            if (!localHold) return;
            const point = actor.resident.group.localToWorld(localHold.clone()); actor.aimHands([point]);
            this.props.lamp.position.copy(this.props.group.worldToLocal(actor.resident.handAnchor(new THREE.Vector3(), 'left')));
        });
        execution.steps.push({ name: 'surface-illuminated', duration: 1000, pose: () => {
            actor.pose(shine.pose.root, shine.pose.yaw, shine.pose.lean, [grip]); this.props.lamp.position.copy(this.props.group.worldToLocal(actor.resident.handAnchor(new THREE.Vector3(), 'left')));
            actor.look(surface);
            this.props.illuminate(execution.targetVisual, surface, .525, table, SHARED_DISPLAY_RADII[display.target.kind], result.effect);
        }, points: () => this.props.lightContact ? [this.props.lightContact.source, this.props.lightContact.surface, this.props.lightContact.receiver] : [] });
        execution.result = result;
        this.result(execution);
        execution.steps.push({ name: 'looking-together', duration: 850, pose: t => {
            actor.pose(shine.pose.root, shine.pose.yaw, shine.pose.lean, [grip]); actor.look(t < .5 ? surface : shine.pose.root.clone().add(new THREE.Vector3(0, 1, 2)), true);
        }, points: () => [surface, actor.resident.head.getWorldPosition(new THREE.Vector3())] });
    }
    private offerSnack(execution: Execution, from: SharedContactPose) {
        const actor = execution.actor!, anchors = this.anchors(execution)!;
        const p = this.table(execution).position;
        const contact = this.contactRoute(actor, from.root, [anchors.returnPlate], new THREE.Vector3(p.x, 0, p.z));
        if (!contact) throw new Error('No plate route');
        this.props.snack.visible = true; this.props.snack.position.copy(this.props.group.worldToLocal(anchors.returnPlate.clone()));
        this.walkStep(execution, contact.route);
        this.contactStep(execution, contact.pose, () => [this.props.snack.getWorldPosition(new THREE.Vector3())], 'snack-contact');
        execution.steps.push({ name: 'snack-offered', duration: 1100, pose: t => {
            const toward = contact.pose.root.clone().add(new THREE.Vector3(Math.sin(contact.pose.yaw) * .36, .9, Math.cos(contact.pose.yaw) * .36));
            const point = anchors.returnPlate.clone().lerp(toward, smooth(t));
            actor.pose(contact.pose.root, contact.pose.yaw, contact.pose.lean * (1 - smooth(t)), [point]);
            this.props.snack.position.copy(this.props.group.worldToLocal(actor.resident.handAnchor(new THREE.Vector3(), 'left')));
            actor.look(t < .55 ? execution.targetVisual.anchors().center : toward.clone().add(new THREE.Vector3(0, .3, 1)), true);
        }, points: () => [this.props.snack.getWorldPosition(new THREE.Vector3()), actor.resident.handAnchor(new THREE.Vector3(), 'left')],
            finish: () => this.callbacks.feedback?.('ひとくち どうぞ。いっしょに やすもう') });
    }
    private startMemory(id: string, memoryKey: string, now: number) {
        const island = this.state!.island, memory = getIslandSharedMemories(island).memories.find(memory => memory.memoryKey === memoryKey);
        if (!memory || !isSharedResidentAvailable(island, memory.residentId)) return;
        const display = this.displays.describe().find(display => display.targetKey === memory.target.targetKey);
        const resident = this.residents.find(resident => resident.species === memory.residentId && resident.group.visible);
        if (!resident) return;
        let scene = this.displays; const displayId: SharedDisplayId = display?.displayId ?? 'display-1';
        let table = display ? island.sharedMemories!.displays[displayId]! : undefined;
        if (!table) {
            const point = this.preparationPoint(memory.target, resident); if (!point) throw new Error('No remembered display space');
            const rememberedIsland = this.sceneIsland(island, displayId, memory.target, point, 0);
            table = rememberedIsland.sharedMemories!.displays[displayId]!;
            this.preparation.update(rememberedIsland); scene = this.preparation;
            if (memory.specimenSnapshot) scene.targetVisual(displayId)!.updateAppearance({ cleanedMask: memory.specimenSnapshot.cleanedMask,
                name: memory.targetName, identified: memory.target.kind === 'specimen' && memory.specimenSnapshot.knownResults.includes('clean')
                    && memory.specimenSnapshot.knownResults.includes(WORKSHOP_SPECIMENS[memory.target.specimenId].identityResult) });
        }
        const visual = scene.targetVisual(displayId)!, actor = new SharedJobActor(resident);
        const execution = this.begin(id, memory.target, displayId, visual, false); execution.actor = actor; execution.scene = scene; execution.table = table;
        execution.sourceId = display?.displayId;
        if (memory.jobId === 'illuminate') this.residentLight(execution);
        else {
            const anchors = this.anchors(execution), center = this.table(execution).position;
            const contact = this.contactRoute(actor, resident.group.position, [anchors.returnPlate], new THREE.Vector3(center.x, 0, center.z));
            if (!contact) throw new Error('No remembered route');
            this.walkStep(execution, contact.route);
            if (memory.jobId === 'gather') {
                this.offerSnack(execution, contact.pose);
            } else this.restStep(execution, contact.pose);
        }
        return this.update(now, this.reduced);
    }
    dispose() { if (this.disposed) return; this.stop(); this.disposed = true; this.state = undefined; this.preparation.dispose(); this.destination.dispose(); this.props.dispose(); this.group.removeFromParent(); }
}
