import * as THREE from 'three';
import { getWorkshopAssemblableParts, getWorkshopToolResult, workshopLayoutKey, WORKSHOP_CLEAN_MASK, WORKSHOP_SHELF_IDS,
    WORKSHOP_SPECIMEN_IDS, type IslandWorkshopAction, type IslandWorkshopState, type WorkshopShelfId, type WorkshopSpecimenId, type WorkshopToolId } from '../../../domain/island/workshop';
import { getWorkshopPartPorts, isWorkshopCell, simulateWorkshop, WORKSHOP_PART_IDS, type WorkshopBeat, type WorkshopCell, type WorkshopPartId, type WorkshopLayout } from '../../../domain/island/workshopLayout';
import { createWorkshopGeometry, WORKSHOP_BOARD_Y, WORKSHOP_CELL_SIZE, WORKSHOP_HOME_POINTS, WORKSHOP_STATIONS,
    WORKSHOP_WATER_BOTTOM_Y, WORKSHOP_WATER_SURFACE_Y, workshopAnchorToWorld, type WorkshopGeometryHit } from './workshopGeometry';

export type WorkshopStationId = 'home' | 'brush' | 'lamp' | 'water' | WorkshopShelfId;
export interface WorkshopSceneState {
    workshop: IslandWorkshopState;
    active: boolean;
    mode: 'observe' | 'build';
    selectedSpecimenId?: WorkshopSpecimenId;
    selectedPartId?: WorkshopPartId;
    selectedToolId?: WorkshopToolId;
    residentId?: 'otter' | 'rabbit' | 'fox';
    busy?: boolean;
    /** Immutable exhibition capture; replay never mutates the current draft. */
    replayLayout?: WorkshopLayout;
}
export type WorkshopSceneCommand =
    | { type: 'pick-specimen'; specimenId: WorkshopSpecimenId }
    | { type: 'place-specimen'; specimenId: WorkshopSpecimenId; station: WorkshopStationId }
    | { type: 'brush'; specimenId: WorkshopSpecimenId; section: number }
    | { type: 'lamp'; specimenId: WorkshopSpecimenId; angle: number }
    | { type: 'assemble'; partId: WorkshopPartId }
    | { type: 'run' }
    | { type: 'stop' };
export interface WorkshopSceneRequest { id: string; command: WorkshopSceneCommand }
export type WorkshopFeedbackKind = 'pick' | 'wood' | 'sand' | 'water' | 'glass' | 'shell' | 'assemble' | 'discovery';
export interface WorkshopSceneCallbacks {
    onAction?: (action: IslandWorkshopAction) => void;
    onSelectSpecimen?: (specimenId: WorkshopSpecimenId) => void;
    onSelectPart?: (partId: WorkshopPartId) => void;
    onFeedback?: (kind: WorkshopFeedbackKind) => void;
}
export interface WorkshopSceneCamera { position: THREE.Vector3; target: THREE.Vector3; worldWidth: number }
export interface WorkshopSourceHandle { position: THREE.Vector3; approach: THREE.Vector3 }

type SpecimenOperation = { kind: 'pick' | 'place' | 'brush' | 'lamp'; id: string; specimenId: WorkshopSpecimenId;
    from: THREE.Vector3; to: THREE.Vector3; started: number; duration: number; station?: WorkshopStationId; section?: number; angle?: number };
type AssemblyOperation = { kind: 'assemble'; id: string; partId: WorkshopPartId; started: number; duration: number; layoutKey: string };
type Operation = SpecimenOperation | AssemblyOperation;
type Pending = { id: string; action: IslandWorkshopAction; points: THREE.Vector3[] };
type BrushContact = { specimenId: WorkshopSpecimenId; section: number };
type Pointer = { id: number; kind: 'specimen'; specimenId: WorkshopSpecimenId; from: THREE.Vector3; moved: boolean }
    | { id: number; kind: 'part'; partId: WorkshopPartId; from: THREE.Vector3; moved: boolean }
    | { id: number; kind: 'brush'; contacts: BrushContact[] } | { id: number; kind: 'command' };
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

/** A group/controller for the existing Island renderer, never a second canvas.
 * Tick stages the geometry; only afterRender can issue a visible observation. */
export class IslandWorkshopScene {
    readonly visuals = createWorkshopGeometry();
    readonly group = this.visuals.group;
    private state?: WorkshopSceneState;
    private now = 0;
    private reduced = false;
    private scope = '';
    private disposed = false;
    private operation?: Operation;
    private run?: { id: string; beats: WorkshopBeat[]; index: number; started: number; layoutKey: string; advance: boolean };
    private pointer?: Pointer;
    private brushStroke?: { id: string; contacts: BrushContact[]; index: number };
    private readonly stations = new Map<WorkshopSpecimenId, WorkshopStationId>();
    private readonly held = new Set<WorkshopSpecimenId>();
    private readonly requests = new Set<string>();
    private readonly issued = new Set<string>();
    private pending: Pending[] = [];
    private feedback: WorkshopFeedbackKind[] = [];
    private serial = 0;
    private layoutKey = '';
    private lastRun?: { reached: WorkshopPartId[]; stop?: string; complete: boolean };

    constructor(private readonly callbacks: WorkshopSceneCallbacks = {}) { this.group.visible = false; }

    get camera(): WorkshopSceneCamera {
        const build = this.state?.mode === 'build';
        const target = new THREE.Vector3(build ? -.35 : 0, build ? .3 : .38, build ? .15 : -.2);
        return { target, position: target.clone().add(new THREE.Vector3(build ? 1.8 : .8, 7.8, 9.6)), worldWidth: build ? 7.15 : 6.8 };
    }
    get sourceHandle(): WorkshopSourceHandle {
        this.visuals.handle.updateWorldMatrix(true, false);
        const position = this.group.worldToLocal(this.visuals.handle.localToWorld(new THREE.Vector3(0, .23, 0)));
        return { position, approach: this.visuals.source.position.clone().add(new THREE.Vector3(-.35, -.28, 1.12)) };
    }
    get active() { return Boolean(this.state?.active && this.group.visible && !this.disposed); }
    private get shownLayout() { return this.state!.replayLayout ?? this.state!.workshop.draftCheckpoint.draft.layout; }

    /** Live geometry anchors in world coordinates, suitable for camera projection
     * and pointer verification. These are the same surfaces used by hit testing. */
    get anchors() {
        this.group.updateMatrixWorld(true);
        const world = (point: THREE.Vector3) => this.group.localToWorld(point.clone());
        return {
            specimens: Object.fromEntries(WORKSHOP_SPECIMEN_IDS.map(id => [id, {
                center: this.visuals.specimens[id].group.getWorldPosition(new THREE.Vector3()), sand: this.specimenPoints(id),
            }])),
            stations: Object.fromEntries(Object.entries(WORKSHOP_STATIONS).map(([id, point]) => [id, world(point)])),
            parts: Object.fromEntries(WORKSHOP_PART_IDS.map(id => [id, {
                center: this.visuals.parts[id].group.getWorldPosition(new THREE.Vector3()),
                socket: this.visuals.parts[id].group.localToWorld(new THREE.Vector3(0, .13, 0)),
                ports: this.state ? getWorkshopPartPorts(id, this.shownLayout.parts[id])
                    .map(port => ({ ...port, world: world(workshopAnchorToWorld(port.anchor, WORKSHOP_BOARD_Y + (port.channel === 'shaft' ? .3 : .12))) })) : [],
            }])),
            grid: Array.from({ length: 16 }, (_, i) => ({ col: i % 4, row: Math.floor(i / 4),
                world: world(workshopAnchorToWorld({ col: i % 4, row: Math.floor(i / 4) }, WORKSHOP_BOARD_Y)) })),
            sourceHandle: world(this.sourceHandle.position), sourceApproach: world(this.sourceHandle.approach),
        };
    }

    diagnostic() {
        const anchors = this.anchors;
        return {
            active: this.active, mode: this.state?.mode, busy: Boolean(this.state?.busy), replay: Boolean(this.state?.replayLayout),
            heldSpecimenId: [...this.held][0] ?? null,
            stations: Object.fromEntries(WORKSHOP_SPECIMEN_IDS.map(id => [id, this.stations.get(id)
                ?? WORKSHOP_SHELF_IDS.find(shelf => this.state?.workshop.shelves[shelf] === id) ?? 'home'])),
            specimenPositions: Object.fromEntries(WORKSHOP_SPECIMEN_IDS.map(id => [id, anchors.specimens[id].center.toArray()])),
            cleanedMask: Object.fromEntries(WORKSHOP_SPECIMEN_IDS.map(id => [id, this.state?.workshop.specimens[id].cleanedMask ?? 0])),
            visibleSand: Object.fromEntries(WORKSHOP_SPECIMEN_IDS.map(id => [id, this.visuals.specimens[id].patches.filter(patch => patch.visible).length])),
            activeTool: this.operation?.kind === 'brush' || this.pointer?.kind === 'brush' ? 'brush' : this.visuals.beam.visible ? 'lamp' : this.visuals.ripple.visible ? 'water' : null,
            phase: !this.active ? 'paused' : this.pointer ? `pointer-${this.pointer.kind}` : this.pending.length ? 'awaiting-render'
                : this.operation ? this.issued.has(this.operation.id) ? 'awaiting-save' : this.operation.kind : this.run ? `run-${this.run.beats[this.run.index]?.type ?? 'end'}` : 'idle',
            run: this.run ? { index: this.run.index, beat: this.run.beats[this.run.index]?.type, ...this.lastRun } : this.lastRun ?? null,
            partPositions: Object.fromEntries(WORKSHOP_PART_IDS.map(id => [id, anchors.parts[id].center.toArray()])),
            sourceHandle: anchors.sourceHandle.toArray(),
        };
    }

    update(state: WorkshopSceneState, now: number, reduced: boolean): boolean {
        if (this.disposed) return false;
        const scope = state.workshop.specimens.driftwood.id, changedScope = this.scope !== scope;
        const previousMode = this.state?.mode, nextKey = workshopLayoutKey(state.replayLayout ?? state.workshop.draftCheckpoint.draft.layout);
        if (changedScope || previousMode !== state.mode || Boolean(this.state?.replayLayout) !== Boolean(state.replayLayout)
            || this.layoutKey && this.layoutKey !== nextKey) this.stop();
        if (changedScope) {
            this.scope = scope; this.requests.clear(); this.issued.clear(); this.stations.clear(); this.held.clear(); this.lastRun = undefined;
        }
        this.state = state; this.now = now; this.reduced = reduced; this.layoutKey = nextKey;
        if (!state.active) { this.stop(); this.group.visible = false; return false; }
        this.group.visible = true; this.visuals.observe.visible = state.mode === 'observe'; this.visuals.build.visible = state.mode === 'build';
        this.applySavedGeometry();
        const moving = this.tick(now);
        this.group.updateMatrixWorld(true);
        if (state.mode === 'observe') {
            for (const id of WORKSHOP_SPECIMEN_IDS) {
                const specimen = state.workshop.specimens[id];
                if (specimen.cleanedMask === WORKSHOP_CLEAN_MASK && !specimen.observations.some(entry => entry.result === 'clean')) {
                    this.queue(`clean:${specimen.id}`, { type: 'observe-specimen', specimenId: id, result: 'clean', cleanedMask: specimen.cleanedMask }, this.specimenPoints(id));
                }
            }
        }
        return moving || this.pending.length > 0 || this.feedback.length > 0;
    }

    private stationPoint(id: WorkshopSpecimenId, station?: WorkshopStationId) {
        const saved = WORKSHOP_SHELF_IDS.find(shelf => this.state?.workshop.shelves[shelf] === id);
        const selected = station ?? this.stations.get(id) ?? saved ?? 'home';
        const point = selected === 'home' ? WORKSHOP_HOME_POINTS[id].clone() : WORKSHOP_STATIONS[selected].clone();
        if (selected === 'water') point.y = id === 'driftwood' ? WORKSHOP_WATER_SURFACE_Y - .12 : WORKSHOP_WATER_BOTTOM_Y + .045;
        return point;
    }

    private applySavedGeometry() {
        const state = this.state!;
        if (this.operation?.kind !== 'brush' && this.pointer?.kind !== 'brush') this.parkBrush();
        for (const id of WORKSHOP_SPECIMEN_IDS) {
            const visual = this.visuals.specimens[id], moving = this.operation && 'specimenId' in this.operation && this.operation.specimenId === id;
            const dragging = this.pointer?.kind === 'specimen' && this.pointer.specimenId === id;
            if (!moving && !dragging) {
                visual.group.position.copy(this.stationPoint(id));
                if (this.held.has(id)) visual.group.position.y += .65;
            }
            visual.group.scale.setScalar(this.stations.get(id) === 'water' ? .78 : state.selectedSpecimenId === id ? 1.16 : .92);
            visual.patches.forEach((patch, section) => { patch.visible = !(state.workshop.specimens[id].cleanedMask & 1 << section); });
        }
        for (const [index, id] of WORKSHOP_PART_IDS.entries()) {
            const saved = this.shownLayout.parts[id], visual = this.visuals.parts[id];
            if (!(this.pointer?.kind === 'part' && this.pointer.partId === id)) {
                visual.group.position.copy(saved.position ? workshopAnchorToWorld(saved.position, WORKSHOP_BOARD_Y) : new THREE.Vector3(-1.75 + index * 1.15, .16, 2.7));
            }
            // THREE's positive yaw turns east toward north; board rotations are clockwise.
            visual.group.rotation.y = -saved.rotation * Math.PI / 2;
            visual.finished.visible = saved.assembled; visual.frame.visible = !saved.assembled;
            if (!(this.operation?.kind === 'assemble' && this.operation.partId === id)) visual.insert.visible = false;
        }
        const selected = state.selectedSpecimenId;
        const selectedStation = selected && this.stations.get(selected);
        this.visuals.selection.visible = state.mode === 'observe' && Boolean(selected) && selectedStation !== 'lamp' && selectedStation !== 'water';
        if (selected) this.visuals.selection.position.copy(this.visuals.specimens[selected].group.position).add(new THREE.Vector3(0, .012, 0));
        const selectedPart = state.selectedPartId;
        this.visuals.partSelection.visible = state.mode === 'build' && Boolean(selectedPart);
        if (selectedPart) this.visuals.partSelection.position.copy(this.visuals.parts[selectedPart].group.position).add(new THREE.Vector3(0, .018, 0));
    }

    command(request: WorkshopSceneRequest, now: number): void {
        if (this.disposed || this.requests.has(request.id)) return;
        this.requests.add(request.id);
        if (this.requests.size > 256) this.requests.delete(this.requests.values().next().value!);
        if (request.command.type === 'stop') { this.stop(); return; }
        // A command received while paused is consumed, not replayed on return.
        if (!this.active || this.state?.busy) return;
        this.now = now;
        const command = request.command;
        if (this.state?.replayLayout && command.type !== 'run') return;
        if (command.type === 'brush' && (this.state!.selectedToolId !== 'brush' || !Number.isInteger(command.section) || command.section < 0 || command.section > 5)) return;
        this.cancelOperation();
        if (command.type === 'run') {
            if (this.state!.mode !== 'build') return;
            const result = simulateWorkshop(this.shownLayout);
            this.lastRun = { reached: [], complete: false };
            this.run = { id: request.id, beats: result.beats, index: 0, started: now, layoutKey: this.layoutKey, advance: false };
            this.feedback.push('wood'); return;
        }
        if (command.type === 'assemble') {
            if (this.state!.mode !== 'build' || !getWorkshopAssemblableParts(this.state!.workshop).includes(command.partId)
                || this.state!.workshop.draftCheckpoint.draft.layout.parts[command.partId].assembled) return;
            this.callbacks.onSelectPart?.(command.partId);
            this.operation = { kind: 'assemble', id: request.id, partId: command.partId, started: now, duration: this.reduced ? 140 : 700, layoutKey: this.layoutKey };
            return;
        }
        if (this.state!.mode !== 'observe') return;
        const id = command.specimenId;
        this.callbacks.onSelectSpecimen?.(id);
        const from = this.visuals.specimens[id].group.position.clone();
        if (command.type === 'pick-specimen') {
            if (this.held.has(id)) return;
            this.held.clear();
            this.held.add(id);
            this.operation = { kind: 'pick', id: request.id, specimenId: id, from, to: from.clone().add(new THREE.Vector3(0, .65, 0)), started: now, duration: this.reduced ? 1 : 260 };
            this.feedback.push(this.materialFeedback(id)); return;
        }
        const station = command.type === 'brush' ? 'brush' : command.type === 'lamp' ? 'lamp' : command.station;
        if (station.startsWith('shelf')) {
            const occupant = this.state!.workshop.shelves[station as WorkshopShelfId];
            if (occupant && occupant !== id) return;
        }
        this.held.delete(id); this.stations.set(id, station);
        for (const other of WORKSHOP_SPECIMEN_IDS) if (other !== id && this.stations.get(other) === station && !station.startsWith('shelf')) this.stations.set(other, 'home');
        this.operation = { kind: command.type === 'brush' ? 'brush' : command.type === 'lamp' ? 'lamp' : 'place', id: request.id,
            specimenId: id, from, to: this.stationPoint(id, station), started: now, duration: this.reduced ? 140 : command.type === 'brush' ? 750 : 850,
            station, ...(command.type === 'brush' ? { section: command.section } : {}), ...(command.type === 'lamp' ? { angle: Number.isFinite(command.angle) ? command.angle : 0 } : {}) };
        if (station === 'lamp' && command.type !== 'brush') this.operation.kind = 'lamp';
    }

    private cancelOperation() {
        this.operation = undefined; this.run = undefined; this.brushStroke = undefined; this.pending = []; this.feedback = [];
        this.visuals.brush.visible = this.visuals.beam.visible = this.visuals.transmittedBeam.visible = false;
        this.visuals.shadow.visible = this.visuals.lightPool.visible = this.visuals.ripple.visible = false;
        this.visuals.flow.visible = this.visuals.trail.visible = false;
        this.visuals.flow.scale.set(.095, .055, .085); this.visuals.handle.rotation.z = 0;
        for (const part of Object.values(this.visuals.parts)) { part.insert.visible = false; if (part.rotor) part.rotor.rotation.x = 0; if (part.bell) part.bell.rotation.z = 0; }
        this.parkBrush();
    }

    private parkBrush() {
        this.visuals.brush.visible = Boolean(this.state?.active && this.state.mode === 'observe');
        this.visuals.brush.position.copy(WORKSHOP_STATIONS.brush).add(new THREE.Vector3(-.25, .13, 0));
        this.visuals.brush.rotation.set(Math.PI / 2, 0, -.35); this.visuals.brush.scale.setScalar(1.2);
    }

    stop() {
        this.cancelOperation(); this.pointer = undefined; this.held.clear(); this.stations.clear();
        this.visuals.preview.visible = false;
        if (this.state) this.applySavedGeometry();
    }

    private specimenPoints(id: WorkshopSpecimenId) {
        const visual = this.visuals.specimens[id]; visual.group.updateWorldMatrix(true, false);
        return visual.surfacePoints.map(point => visual.group.localToWorld(point.clone()));
    }
    private materialFeedback(id: WorkshopSpecimenId): WorkshopFeedbackKind {
        return id === 'driftwood' ? 'wood' : id === 'seaglass' ? 'glass' : 'shell';
    }
    private touchSand(hit: WorkshopGeometryHit, pointer: Extract<Pointer, { kind: 'brush' }>) {
        if (hit.kind !== 'sand' || hit.section === undefined) return;
        if (!pointer.contacts.some(contact => contact.specimenId === hit.specimenId && contact.section === hit.section)) {
            pointer.contacts.push({ specimenId: hit.specimenId, section: hit.section });
        }
        const specimen = this.visuals.specimens[hit.specimenId]; specimen.group.updateWorldMatrix(true, false);
        const point = this.group.worldToLocal(specimen.group.localToWorld(specimen.surfacePoints[hit.section].clone()));
        this.visuals.brush.visible = true; this.visuals.brush.position.copy(point).add(new THREE.Vector3(0, .14, 0));
        this.visuals.brush.rotation.set(0, 0, .1);
    }
    /** A released stroke is a bounded set of actual ray contacts. Its short
     * visible sweeps run in sequence; elapsed pointer-hold time awards nothing. */
    private nextBrushContact() {
        const stroke = this.brushStroke;
        if (!stroke || !this.active) return;
        let contact: BrushContact | undefined;
        while (stroke.index < stroke.contacts.length) {
            const candidate = stroke.contacts[stroke.index++];
            if (!(this.state!.workshop.specimens[candidate.specimenId].cleanedMask & 1 << candidate.section)) { contact = candidate; break; }
        }
        if (!contact) { this.brushStroke = undefined; this.parkBrush(); return; }
        const id = contact.specimenId;
        this.held.delete(id); this.stations.set(id, 'brush');
        for (const other of WORKSHOP_SPECIMEN_IDS) if (other !== id && this.stations.get(other) === 'brush') this.stations.set(other, 'home');
        this.callbacks.onSelectSpecimen?.(id);
        this.operation = { kind: 'brush', id: `${stroke.id}:${stroke.index}`, specimenId: id,
            section: contact.section, station: 'brush', from: this.visuals.specimens[id].group.position.clone(), to: this.stationPoint(id, 'brush'),
            started: this.now, duration: this.reduced ? 140 : 500 };
    }
    private queue(id: string, action: IslandWorkshopAction, points: THREE.Vector3[]) {
        if (this.state?.replayLayout) return;
        if (this.issued.has(id)) return;
        const existing = this.pending.find(entry => entry.id === id);
        if (existing) { existing.action = action; existing.points = points; }
        else this.pending.push({ id, action, points });
    }
    private worldPoints(points: THREE.Vector3[]) {
        this.group.updateWorldMatrix(true, false);
        return points.map(point => this.group.localToWorld(point.clone()));
    }
    private segment(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3) {
        const delta = to.clone().sub(from); mesh.visible = delta.length() > .001;
        mesh.position.copy(from).add(to).multiplyScalar(.5); mesh.scale.set(1, Math.max(.001, delta.length()), 1);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    }

    private showLamp(id: WorkshopSpecimenId, angle = 0) {
        const specimen = this.visuals.specimens[id].group, center = specimen.position.clone().add(new THREE.Vector3(0, .3, 0));
        const azimuth = Math.max(-1, Math.min(1, angle)) * .65;
        const tip = this.visuals.lampTip.clone().add(new THREE.Vector3(Math.sin(azimuth) * .25, 0, Math.cos(azimuth) * .2));
        const end = new THREE.Vector3(.62 + Math.sin(azimuth) * .18, .339, 1.35);
        this.segment(this.visuals.beam, tip, center);
        const transmit = getWorkshopToolResult(this.state!.workshop, id, 'lamp') === 'transmit';
        this.visuals.lightPool.visible = transmit; this.visuals.shadow.visible = !transmit;
        this.visuals.lightPool.position.copy(end); this.visuals.shadow.position.copy(end);
        this.visuals.shadow.scale.set(id === 'driftwood' ? .46 : .31, .008, id === 'driftwood' ? .18 : .25);
        if (transmit) this.segment(this.visuals.transmittedBeam, center, end); else this.visuals.transmittedBeam.visible = false;
        return [center, end, tip];
    }

    private tick(now: number): boolean {
        if (!this.active) return false;
        const operation = this.operation;
        if (operation?.kind === 'assemble') {
            const part = this.visuals.parts[operation.partId], t = clamp((now - operation.started) / operation.duration);
            part.insert.visible = true; part.insert.position.set(0, (1 - smooth(t)) * .95, Math.sin(t * Math.PI) * .08);
            if (t >= 1) {
                part.group.updateWorldMatrix(true, true);
                this.queue(operation.id, { type: 'edit-draft', edit: { type: 'assemble', partId: operation.partId } }, [part.group.localToWorld(new THREE.Vector3(0, .2, 0))]);
            }
            return t < 1 || this.pending.length > 0;
        }
        if (operation) {
            const t = clamp((now - operation.started) / operation.duration), visual = this.visuals.specimens[operation.specimenId];
            const moveT = operation.kind === 'brush' || operation.kind === 'lamp' ? smooth(t / .45) : smooth(t);
            visual.group.position.lerpVectors(operation.from, operation.to, moveT);
            if (!this.reduced && operation.kind !== 'pick') visual.group.position.y += Math.sin(moveT * Math.PI) * .35;
            const id = operation.specimenId;
            if (operation.kind === 'brush' && t >= .4) {
                visual.group.updateWorldMatrix(true, false);
                const target = visual.group.localToWorld(visual.surfacePoints[operation.section!].clone());
                this.visuals.brush.visible = true; this.visuals.brush.position.copy(target).add(new THREE.Vector3(this.reduced ? 0 : Math.sin(t * Math.PI * 5) * .13, .14, 0));
                this.visuals.brush.rotation.set(0, 0, this.reduced ? .1 : Math.sin(t * Math.PI * 3) * .2);
            }
            if (operation.kind === 'lamp' && t >= .45) this.showLamp(id, operation.angle);
            if (operation.station === 'water' && t >= .5) {
                this.visuals.ripple.visible = true; this.visuals.ripple.scale.setScalar(this.reduced ? 1 : .45 + t * .6);
            }
            if (t >= 1) {
                const points = this.specimenPoints(id);
                if (operation.kind === 'brush') {
                    this.queue(operation.id, { type: 'brush', specimenId: id, section: operation.section! }, [...points, ...this.worldPoints([this.visuals.brush.position])]);
                } else if (operation.kind === 'lamp' || operation.station === 'water') {
                    const tool = operation.kind === 'lamp' ? 'lamp' : 'water', result = getWorkshopToolResult(this.state!.workshop, id, tool);
                    if (result) this.queue(operation.id, { type: 'observe-specimen', specimenId: id, result,
                        cleanedMask: this.state!.workshop.specimens[id].cleanedMask }, [...points,
                        ...this.worldPoints(tool === 'lamp' ? this.showLamp(id, operation.angle) : [new THREE.Vector3(2, WORKSHOP_WATER_SURFACE_Y, .7), new THREE.Vector3(2, WORKSHOP_WATER_BOTTOM_Y, .7)])]);
                    else this.operation = undefined;
                } else if (operation.station?.startsWith('shelf')) {
                    this.queue(operation.id, { type: 'shelve', specimenId: id, shelfId: operation.station as WorkshopShelfId }, points);
                } else if (operation.station === 'home' && WORKSHOP_SHELF_IDS.some(shelf => this.state!.workshop.shelves[shelf] === id)) {
                    this.queue(operation.id, { type: 'shelve', specimenId: id }, points);
                } else {
                    if (operation.kind === 'place') this.feedback.push(this.materialFeedback(id));
                    this.operation = undefined;
                }
            }
            return t < 1 || this.pending.length > 0;
        }
        const run = this.run;
        if (!run) return false;
        const beat = run.beats[run.index];
        if (!beat) { this.run = undefined; return false; }
        const duration = this.reduced ? 180 : beat.type === 'flow' ? 430 : 700, t = clamp((now - run.started) / duration);
        this.visuals.handle.rotation.z = Math.sin(Math.min(1, (now - run.started) / 600) * Math.PI * 1.5) * .3;
        if (this.lastRun?.reached.includes('wheel') && beat.type !== 'wheel') {
            this.visuals.parts.wheel.rotor!.rotation.x = this.reduced ? Math.PI / 2 : (run.index + t) * Math.PI;
        }
        if (beat.type === 'flow') {
            const color = beat.channel === 'shaft' ? '#f2bc59' : '#80e2de';
            (this.visuals.flow.material as THREE.MeshStandardMaterial).color.set(color);
            (this.visuals.trail.material as THREE.MeshStandardMaterial).color.set(color);
            const y = beat.channel === 'shaft' ? WORKSHOP_BOARD_Y + .3 : WORKSHOP_BOARD_Y + .12;
            const from = workshopAnchorToWorld(beat.from, y), to = workshopAnchorToWorld(beat.to, y), end = from.clone().lerp(to, smooth(t));
            this.visuals.flow.visible = true; this.visuals.flow.position.copy(end);
            this.segment(this.visuals.trail, from, end);
        } else if (beat.type === 'wheel' || beat.type === 'bell') {
            const part = this.visuals.parts[beat.partId];
            if (beat.type === 'wheel' && part.rotor) part.rotor.rotation.x = this.reduced ? Math.PI / 2 : t * Math.PI * 3.5;
            if (beat.type === 'bell' && part.bell) part.bell.rotation.z = this.reduced ? .2 : Math.sin(t * Math.PI * 3) * .35 + t * .15;
            if (t >= 1) this.queue(`${run.id}:${beat.type}`, { type: 'observe-creation', partId: beat.type, layoutKey: run.layoutKey },
                this.worldPoints([workshopAnchorToWorld(beat.at, WORKSHOP_BOARD_Y + (beat.type === 'wheel' ? .55 : .4))]));
        } else {
            this.visuals.flow.visible = true; this.visuals.flow.position.copy(workshopAnchorToWorld(beat.at));
            this.visuals.flow.scale.set(.13, .08, .13);
        }
        run.advance = t >= 1;
        return true;
    }

    /** Must be called after renderer.render, with the current camera's visible
     * point test. A background/hidden frame can never award an observation. */
    afterRender(isVisiblePoint: (point: THREE.Vector3) => boolean): void {
        if (!this.active) return;
        if (!this.state!.busy) {
            const index = this.pending.findIndex(entry => entry.points.length > 0 && entry.points.every(isVisiblePoint));
            if (index >= 0) {
                const entry = this.pending.splice(index, 1)[0];
                if (!this.issued.has(entry.id)) {
                    this.issued.add(entry.id);
                    if (this.issued.size > 256) this.issued.delete(this.issued.values().next().value!);
                    if (this.operation?.id === entry.id && this.operation.kind !== 'assemble') {
                        if (this.operation.kind === 'brush') this.visuals.brush.visible = false;
                        this.operation = undefined;
                    }
                    this.callbacks.onAction?.(entry.action);
                    this.callbacks.onFeedback?.(entry.action.type === 'brush' ? 'sand' : entry.action.type === 'edit-draft' ? 'assemble'
                        : entry.action.type === 'shelve' ? this.materialFeedback(entry.action.specimenId)
                        : entry.action.type === 'observe-creation' && entry.action.partId === 'bell' ? 'shell' : entry.action.type === 'observe-specimen' && ['float', 'sink'].includes(entry.action.result) ? 'water' : 'discovery');
                    if (entry.action.type === 'brush' && this.brushStroke) this.nextBrushContact();
                }
            }
        }
        if (this.feedback.length) this.callbacks.onFeedback?.(this.feedback.shift()!);
        if (this.run?.advance) {
            const beat = this.run.beats[this.run.index];
            const visibleAt = beat.type === 'flow' ? this.visuals.flow.getWorldPosition(new THREE.Vector3())
                : this.worldPoints([workshopAnchorToWorld(beat.at, WORKSHOP_BOARD_Y + .4)])[0];
            if (!isVisiblePoint(visibleAt)) return;
            if (this.lastRun && beat) {
                if (beat.type === 'flow' && beat.toId !== 'source' && !this.lastRun.reached.includes(beat.toId)) this.lastRun.reached.push(beat.toId);
                if (beat.type === 'stop') this.lastRun.stop = beat.reason;
            }
            this.run.index += 1; this.run.started = this.now; this.run.advance = false;
            if (this.lastRun && this.run.index >= this.run.beats.length) this.lastRun.complete = !this.lastRun.stop;
        }
    }

    private hit(ray: THREE.Ray): WorkshopGeometryHit | undefined {
        if (!this.active) return;
        this.group.updateMatrixWorld(true);
        const root = this.state!.mode === 'observe' ? this.visuals.observe : this.visuals.build;
        const hits = new THREE.Raycaster(ray.origin, ray.direction).intersectObject(root, true);
        for (const intersection of hits) {
            let object: THREE.Object3D | null = intersection.object, hit: WorkshopGeometryHit | undefined, visible = true;
            while (object && object !== this.group) {
                visible &&= object.visible;
                if (!hit && object.userData.workshopHit) hit = object.userData.workshopHit;
                object = object.parent;
            }
            if (visible && hit) return hit;
        }
    }
    private localGround(ray: THREE.Ray, y: number) {
        this.group.updateWorldMatrix(true, false);
        const local = ray.clone().applyMatrix4(this.group.matrixWorld.clone().invert());
        return local.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), new THREE.Vector3());
    }
    private direct(command: WorkshopSceneCommand, now: number) { this.command({ id: `pointer:${this.scope}:${++this.serial}`, command }, now); }

    pointerDown(ray: THREE.Ray, id: number, now: number): boolean {
        if (!this.active || this.state!.busy || this.pointer) return false;
        const hit = this.hit(ray);
        if (!hit) return false;
        if (hit.kind === 'source') { this.direct({ type: 'run' }, now); this.pointer = { id, kind: 'command' }; return true; }
        if (this.state?.replayLayout) return false;
        if (hit.kind === 'socket') { this.direct({ type: 'assemble', partId: hit.partId }, now); this.pointer = { id, kind: 'command' }; return true; }
        if (hit.kind === 'station') {
            if (this.state!.selectedSpecimenId) this.direct({ type: 'place-specimen', specimenId: this.state!.selectedSpecimenId, station: hit.station }, now);
            return true;
        }
        if (hit.kind === 'sand' && this.state!.selectedToolId === 'brush') {
            this.cancelOperation();
            const pointer: Extract<Pointer, { kind: 'brush' }> = { id, kind: 'brush', contacts: [] };
            this.pointer = pointer; this.touchSand(hit, pointer); this.callbacks.onSelectSpecimen?.(hit.specimenId); return true;
        }
        this.cancelOperation();
        if (hit.kind === 'specimen' || hit.kind === 'sand') {
            this.callbacks.onSelectSpecimen?.(hit.specimenId);
            this.pointer = { id, kind: 'specimen', specimenId: hit.specimenId, from: this.visuals.specimens[hit.specimenId].group.position.clone(), moved: false };
        } else if (hit.kind === 'part') {
            this.callbacks.onSelectPart?.(hit.partId);
            this.pointer = { id, kind: 'part', partId: hit.partId, from: this.visuals.parts[hit.partId].group.position.clone(), moved: false };
        }
        return true;
    }
    pointerMove(ray: THREE.Ray, id: number, now: number): void {
        const pointer = this.pointer;
        if (!this.active || !pointer || pointer.id !== id || this.state!.busy) return;
        this.now = now;
        if (pointer.kind === 'command') return;
        if (pointer.kind === 'brush') {
            const hit = this.hit(ray);
            if (hit && this.state!.selectedToolId === 'brush') this.touchSand(hit, pointer);
            return;
        }
        const point = this.localGround(ray, pointer.kind === 'part' ? WORKSHOP_BOARD_Y + .2 : .75);
        if (!point) return;
        pointer.moved ||= point.distanceTo(pointer.from) > .12;
        const object = pointer.kind === 'part' ? this.visuals.parts[pointer.partId].group : this.visuals.specimens[pointer.specimenId].group;
        object.position.copy(point);
        if (pointer.kind === 'part') {
            const cell = this.pointCell(point), valid = this.validDrop(pointer.partId, cell);
            this.visuals.preview.visible = true; this.visuals.preview.position.copy(workshopAnchorToWorld(cell, WORKSHOP_BOARD_Y + .015));
            this.visuals.previewMat.color.set(valid ? '#58b687' : '#cb997c');
        }
    }
    private pointCell(point: THREE.Vector3): WorkshopCell { return { col: Math.round(point.x / WORKSHOP_CELL_SIZE + 1.5), row: Math.round(point.z / WORKSHOP_CELL_SIZE + 1.5) }; }
    private validDrop(partId: WorkshopPartId, cell: WorkshopCell) {
        return isWorkshopCell(cell) && !WORKSHOP_PART_IDS.some(id => id !== partId
            && this.state!.workshop.draftCheckpoint.draft.layout.parts[id].position?.col === cell.col
            && this.state!.workshop.draftCheckpoint.draft.layout.parts[id].position?.row === cell.row);
    }
    pointerUp(ray: THREE.Ray, id: number, now: number): void {
        const pointer = this.pointer;
        if (!pointer || pointer.id !== id) return;
        this.pointer = undefined; this.visuals.preview.visible = false;
        if (!this.active || this.state!.busy) { this.applySavedGeometry(); return; }
        if (pointer.kind === 'brush') {
            this.visuals.brush.visible = false;
            if (this.state!.selectedToolId !== 'brush' || !pointer.contacts.length) return;
            this.now = now; this.brushStroke = { id: `stroke:${this.scope}:${++this.serial}`, contacts: pointer.contacts, index: 0 };
            this.nextBrushContact(); return;
        }
        if (pointer.kind === 'command') return;
        if (pointer.kind === 'part') {
            const point = this.localGround(ray, WORKSHOP_BOARD_Y + .2), cell = point && this.pointCell(point);
            if (pointer.moved && cell && this.validDrop(pointer.partId, cell)) {
                this.visuals.parts[pointer.partId].group.position.copy(workshopAnchorToWorld(cell, WORKSHOP_BOARD_Y));
                this.callbacks.onAction?.({ type: 'edit-draft', edit: { type: 'move', partId: pointer.partId, position: cell } }); this.feedback.push('wood');
            } else this.visuals.parts[pointer.partId].group.position.copy(pointer.from);
        } else {
            const point = this.localGround(ray, .36);
            const nearest = point && Object.entries(WORKSHOP_STATIONS).map(([station, target]) => ({ station: station as WorkshopStationId, distance: Math.hypot(point.x - target.x, point.z - target.z) }))
                .filter(candidate => candidate.distance <= .85).sort((a, b) => a.distance - b.distance)[0];
            if (pointer.moved && nearest) {
                this.visuals.specimens[pointer.specimenId].group.position.copy(pointer.from);
                this.direct({ type: 'place-specimen', specimenId: pointer.specimenId, station: nearest.station }, now);
            }
            else if (!pointer.moved) this.direct({ type: 'pick-specimen', specimenId: pointer.specimenId }, now);
            else this.visuals.specimens[pointer.specimenId].group.position.copy(pointer.from);
        }
    }
    pointerCancel(id?: number): void {
        if (!this.pointer || id !== undefined && this.pointer.id !== id) return;
        const pointer = this.pointer; this.pointer = undefined; this.visuals.preview.visible = false;
        if (pointer.kind === 'brush' || pointer.kind === 'command') this.cancelOperation();
        else if (pointer.kind === 'part') this.visuals.parts[pointer.partId].group.position.copy(pointer.from);
        else this.visuals.specimens[pointer.specimenId].group.position.copy(pointer.from);
    }
    dispose() { if (this.disposed) return; this.stop(); this.disposed = true; this.visuals.dispose(); this.requests.clear(); this.issued.clear(); }
}
