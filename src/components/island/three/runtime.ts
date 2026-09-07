import * as THREE from 'three';
import { IslandMaterials, disposeGeometry, star } from './primitives';
import { applyTreeLife, getTreeLightAnchor, makeExpansion, makeLighthouse, makeOcean, makeScenery, makeStarTree } from './scenery';
import { applyFurnitureLife, applyFurnitureUse, getFurnitureAnchors, makeFurniture, makeLightArrival, makeSelection } from './furniture';
import { IslandPlacementPreview } from './placementPreview';
import { ISLAND_ITEMS } from '../../../domain/island/catalog';
import { ISLAND_VISUAL_CANDIDATE } from '../../../domain/island/feature';
import { IslandResident, RESIDENT_NAMES } from './animals';
import { chooseReachableResident, residentNeedsInitialSpawn, savedResidentLayoutChanged, suggestReachablePlacement } from './residentInteraction';
import { findSafeResidentSpawn } from './navigation';
import type { IslandPlacementSuggestion, IslandPlayResult, IslandStageItem, IslandStageState } from './types';
import { learningBeat, normalizedLearningProgress, reconcileLearningProgress, sampleLearningReaction, type LearningBeat, type LearningProgress,
    type LearningReactionKind, type LearningReactionPhase } from './learningReaction';

interface RuntimeCallbacks {
    ground: (point: { x: number; z: number }) => void;
    select: (id: string) => void;
    caption: (caption: string) => void;
    failure: () => void;
    playResult?: (result: IslandPlayResult) => void;
    placementSuggestion?: (suggestion: IslandPlacementSuggestion) => void;
}
interface ItemModel { item: IslandStageItem; group: THREE.Group }
interface LightTarget { id: string; point: THREE.Vector3; group?: THREE.Group; kind: 'flower' | 'lantern' | 'tree' | 'resident' | 'fountain' }
interface SceneReaction {
    id: string; kind: LearningReactionKind; startedAt: number; settledAt: number; phase: LearningReactionPhase;
    target: LightTarget; resident?: IslandResident; beat: LearningBeat; arrived: boolean; reduced: boolean;
}
const samePlacement = (a: IslandStageItem, b: IslandStageItem) => a.kind === b.kind && a.rotation === b.rotation
    && a.position?.x === b.position?.x && a.position?.z === b.position?.z;

export class IslandScene {
    private readonly scene = new THREE.Scene();
    private readonly camera = new THREE.OrthographicCamera(-7, 7, 5, -5, .1, 100);
    private readonly renderer: THREE.WebGLRenderer;
    private readonly materials = new IslandMaterials();
    private readonly tree: THREE.Group;
    private readonly expansion: THREE.Group;
    private readonly lighthouse: THREE.Group;
    private readonly arrival: THREE.Group;
    private readonly selection = makeSelection();
    private readonly cycleLights = new THREE.Group();
    private readonly cycleSeeds: THREE.Mesh[] = [];
    private readonly items = new Map<string, ItemModel>();
    private readonly residents: IslandResident[];
    private readonly residentShadows: THREE.Mesh[] = [];
    private readonly pendingSpawns = new Set<number>();
    private pendingSpawnRetry = false;
    private readonly shadowMaterial = new THREE.MeshBasicMaterial({ color: '#536f54', transparent: true, opacity: .16, depthWrite: false });
    private readonly observer: ResizeObserver;
    private readonly visibilityObserver: IntersectionObserver;
    private readonly motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    private state?: IslandStageState;
    private readonly placementPreview = new IslandPlacementPreview(this.materials);
    private previewItem?: IslandStageItem;
    private raycaster = new THREE.Raycaster();
    private frame = 0;
    private idleTimer = 0;
    private disposed = false;
    private lost = false;
    private onscreen = true;
    private pulseRecipient?: LightTarget;
    private drawCount = 0;
    private reaction?: SceneReaction;
    private displayedProgress?: LearningProgress;
    private pendingProgress?: LearningProgress;
    private readonly learningFocus = new THREE.Vector3(.8, .55, 1);
    private readonly lightOrigin = new THREE.Vector3(.1, .22, 3.45);
    private lastFrame = 0;
    private lastResident?: IslandResident;
    private lastChosenResident = -1;
    private lastPlayRequestId?: string;
    private playResult?: IslandPlayResult;
    private consumedSuggestionId?: string;
    private idleStart = -Infinity;
    private pointerStart?: { x: number; y: number; id: number };
    private liftedResidents?: { item: IslandStageItem; residents: IslandResident[] };

    constructor(private readonly host: HTMLDivElement, private readonly callbacks: RuntimeCallbacks) {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = .9;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.shadowMap.autoUpdate = false;
        this.scene.background = new THREE.Color(this.materials.color('#76cdd3'));
        const canvas = this.renderer.domElement;
        canvas.setAttribute('data-art-candidate', ISLAND_VISUAL_CANDIDATE);
        canvas.setAttribute('data-visual-candidate', ISLAND_VISUAL_CANDIDATE);
        canvas.setAttribute('aria-hidden', 'true');
        this.host.append(canvas);
        const hemisphere = new THREE.HemisphereLight('#f4fbef', '#b7b184', 1.7);
        this.scene.add(hemisphere);
        const sun = new THREE.DirectionalLight('#fff1d1', 2.6);
        sun.position.set(-3, 9, 7);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.left = -9; sun.shadow.camera.right = 10;
        sun.shadow.camera.top = 7; sun.shadow.camera.bottom = -8;
        sun.shadow.camera.near = 1; sun.shadow.camera.far = 25;
        sun.shadow.bias = -.0006; sun.shadow.normalBias = .055;
        this.scene.add(sun);
        this.scene.add(makeOcean(this.materials), makeScenery(this.materials));
        this.tree = makeStarTree(this.materials);
        this.expansion = makeExpansion(this.materials);
        this.lighthouse = makeLighthouse(this.materials);
        this.arrival = makeLightArrival(this.materials);
        this.expansion.visible = false;
        this.lighthouse.visible = false;
        this.arrival.visible = false;
        this.selection.visible = false;
        this.scene.add(this.tree, this.expansion, this.lighthouse, this.arrival, this.selection);
        this.scene.add(this.cycleLights, this.placementPreview.group);
        for (let i = 0; i < 6; i++) {
            const seed = star(this.cycleLights, this.materials.get('#899b6f'), [0, 0, 0], .065);
            seed.castShadow = false; seed.receiveShadow = false;
            this.cycleSeeds.push(seed);
        }
        this.cycleLights.visible = false;
        this.residents = [
            new IslandResident('otter', this.materials, [.1, 0, 1.6], callbacks.caption),
            new IslandResident('rabbit', this.materials, [2.45, 0, 1.45], callbacks.caption),
            new IslandResident('fox', this.materials, [6.26, 0, .83], callbacks.caption),
        ];
        for (const resident of this.residents) {
            this.scene.add(resident.group);
            const shadow = new THREE.Mesh(new THREE.CircleGeometry(.41, 24), this.shadowMaterial);
            shadow.rotation.x = -Math.PI / 2;
            shadow.position.set(resident.group.position.x, .02, resident.group.position.z);
            shadow.scale.y = .83;
            this.scene.add(shadow);
            this.residentShadows.push(shadow);
        }
        this.residents[2].group.visible = false;
        this.residentShadows[2].visible = false;
        canvas.addEventListener('pointerup', this.pointerUp);
        canvas.addEventListener('pointerdown', this.pointerDown);
        canvas.addEventListener('pointermove', this.pointerMove);
        canvas.addEventListener('pointercancel', this.pointerCancel);
        canvas.addEventListener('webglcontextlost', this.contextLost);
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(host);
        this.visibilityObserver = new IntersectionObserver(entries => {
            this.onscreen = entries[0]?.isIntersecting ?? true;
            if (this.onscreen) this.requestFrame(); else this.pause();
        });
        this.visibilityObserver.observe(host);
        document.addEventListener('visibilitychange', this.visibilityChanged);
        this.motion.addEventListener('change', this.motionChanged);
        this.resize();
    }

    update(state: IslandStageState) {
        if (this.disposed || this.lost) return;
        const previous = this.state;
        this.state = state;
        let shadowChanged = !previous || this.expansion.visible !== (state.completedSets >= 2)
            || this.lighthouse.visible !== (state.completedSets >= 6);
        this.expansion.visible = state.completedSets >= 2;
        this.residents[2].group.visible = state.completedSets >= 4 && !this.pendingSpawns.has(2);
        this.residentShadows[2].visible = this.residents[2].group.visible;
        this.lighthouse.visible = state.completedSets >= 6;
        if (previous && this.pendingSpawns.size && savedResidentLayoutChanged(previous.items, state.items)) this.pendingSpawnRetry = true;
        // A live saved record may arrive before its placement sheet closes.
        const savedLayoutChanged = this.pendingSpawnRetry && !state.preview;
        this.residents.forEach((resident, index) => {
            if ((index === 2 && state.completedSets < 4) || !residentNeedsInitialSpawn(resident.species, state.completedSets,
                previous?.completedSets, this.pendingSpawns.has(index), savedLayoutChanged)) return;
            const occupied = this.residents.filter(other => other !== resident && other.group.visible).map(other => other.group.position);
            const spawn = findSafeResidentSpawn(resident.group.position, state.items, state.completedSets, occupied);
            if (spawn) {
                this.pendingSpawns.delete(index);
                resident.group.position.set(spawn.x, 0, spawn.z);
                resident.group.visible = true; this.residentShadows[index].visible = true;
            }
            else {
                this.pendingSpawns.add(index);
                resident.group.visible = false; this.residentShadows[index].visible = false;
                this.callbacks.caption('もちものを うごかして、どうぶつの ばしょを あけよう');
            }
            shadowChanged = true;
        });
        if (savedLayoutChanged) this.pendingSpawnRetry = false;
        const placed = state.items.filter(item => item.position);
        const ids = new Set(placed.map(item => item.id));
        let visit: IslandStageItem | undefined;
        for (const [id, model] of this.items) if (!ids.has(id)) {
            shadowChanged = true;
            model.group.removeFromParent(); disposeGeometry(model.group); this.items.delete(id);
            for (const resident of this.residents) if (resident.itemId === id) resident.release();
        }
        for (const item of placed) {
            let model = this.items.get(item.id);
            if (model && model.item.kind !== item.kind) {
                shadowChanged = true;
                model.group.removeFromParent(); disposeGeometry(model.group); this.items.delete(item.id); model = undefined;
            }
            if (!model) {
                shadowChanged = true;
                const group = makeFurniture(item.kind, this.materials);
                group.traverse(child => { child.userData.itemId = item.id; });
                model = { group, item }; this.items.set(item.id, model); this.scene.add(group);
                visit = item;
            } else if (!samePlacement(model.item, item)) { visit = item; shadowChanged = true; }
            model.item = item;
            model.group.position.set(item.position!.x, 0, item.position!.z);
            model.group.rotation.y = item.rotation;
            const visible = item.id !== state.preview?.id;
            shadowChanged ||= model.group.visible !== visible;
            model.group.visible = visible;
        }
        if (this.liftedResidents && this.liftedResidents.item.id !== state.preview?.id) {
            const lifted = this.liftedResidents;
            const restored = this.items.get(lifted.item.id);
            // Cancel/same-position save restores the seat as well as its resident.
            // Otherwise an idle root would remain inside the reappearing furniture.
            if (restored && samePlacement(lifted.item, restored.item)) {
                for (const resident of lifted.residents) if (!resident.itemId) {
                    resident.visit(restored.item, performance.now(), true, state.items, state.completedSets);
                }
            }
            this.liftedResidents = undefined;
        }
        if (visit && previous) this.visitItem(visit);
        if (!previous) {
            // Returning to the island restores an inhabited scene immediately.
            const seat = [...placed].reverse().find(item => ['bench', 'mushroom'].includes(item.kind));
            if (seat) {
                this.visitItem(seat, true);
            }
        }
        if (state.preview?.id !== previous?.preview?.id && state.preview) {
            const residents = this.residents.filter(resident => resident.itemId === state.preview!.id);
            this.liftedResidents = { item: this.items.get(state.preview.id)?.item ?? state.preview, residents };
            residents.forEach(resident => resident.release());
        }
        this.previewItem = state.preview;
        this.placementPreview.update(state.preview, state.previewValid ?? true);
        if (!state.placementSuggestionId) this.consumedSuggestionId = undefined;
        else if (state.placementSuggestionId !== this.consumedSuggestionId) {
            this.consumedSuggestionId = state.placementSuggestionId;
            const saved = state.items.find(item => item.id === state.placementSuggestionId);
            if (!state.learning && saved && !saved.position && state.preview?.id === saved.id) {
                const position = suggestReachablePlacement(state, state.preview, this.residentCandidates());
                if (position) this.callbacks.placementSuggestion?.({ itemId: saved.id, position });
            }
        }
        const selected = state.selectedId ? this.items.get(state.selectedId) : undefined;
        this.selection.visible = Boolean(selected && !state.preview);
        if (selected) {
            this.selection.position.set(selected.group.position.x, .045, selected.group.position.z);
            this.selection.scale.setScalar((ISLAND_ITEMS[selected.item.kind].radius + .05) / .72);
        }
        const progress = normalizedLearningProgress(state.learningProgress);
        const entering = state.learning && (!previous?.learning || previous.learningProgress?.sectionId !== progress?.sectionId);
        if (entering) {
            const nearby = this.residents.find(resident => resident.group.visible && resident.group.position.x > -1.8
                && resident.group.position.x < 3.2 && resident.group.position.z > -.2 && resident.group.position.z < 2.35);
            const resident = this.residents.find(candidate => candidate.group.visible && candidate.group.position.x < 4.5) ?? this.residents[0];
            if (nearby) this.learningFocus.set(.8, .55, 1);
            else this.learningFocus.copy(resident.group.position).add(new THREE.Vector3(.25, .55, -.6));
        }
        if (!previous || previous.completedSets !== state.completedSets || previous.learning !== state.learning || entering) this.resize();
        const event = state.reaction;
        const freshReaction = previous && event && event.id !== previous.reaction?.id;
        const cycle = reconcileLearningProgress(this.displayedProgress, this.pendingProgress, progress, freshReaction ? event.kind : undefined);
        this.pendingProgress = cycle.pending;
        this.setCycleProgress(cycle.displayed);
        if (!event && (previous?.reaction || entering)) this.clearReaction();
        if (entering || !previous) this.placeCycleAccent();
        if (freshReaction) this.startReaction(event.id, event.kind, learningBeat(progress, normalizedLearningProgress(previous.learningProgress)));
        // Old callers keep pulse support. A saved-progress caller uses only receipt reactions.
        else if (previous && !state.learningProgress && !event && state.pulse !== previous.pulse) this.startReaction(`legacy-${state.pulse}`, 'correct', 'step');
        const play = state.playRequest;
        if (play && play.id !== this.lastPlayRequestId) {
            this.lastPlayRequestId = play.id;
            const item = state.items.find(candidate => candidate.id === play.itemId);
            const reason = state.learning ? 'learning' : state.preview ? 'editing' : !item?.position ? 'not-placed' : undefined;
            let result: IslandPlayResult;
            if (reason) result = { requestId: play.id, itemId: play.itemId, status: 'unavailable', reason };
            else {
                const resident = this.visitItem(item!);
                result = resident ? { requestId: play.id, itemId: play.itemId, status: 'playing', resident: resident.species }
                    : { requestId: play.id, itemId: play.itemId, status: 'blocked', reason: 'unreachable' };
            }
            this.playResult = result;
            if (reason) this.callbacks.caption(reason === 'not-placed' ? 'しまに おいてから、あそぼう'
                : reason === 'editing' ? 'ばしょを きめたら、あそぼう' : 'しまに もどったら、あそぼう');
            this.callbacks.playResult?.(result);
        }
        // Answer/caption changes do not alter shadow-casting geometry. Preserve
        // the cached shadow map while the independent light reaction plays.
        if (shadowChanged) this.renderer.shadowMap.needsUpdate = true;
        this.requestFrame();
    }

    private residentCandidates() {
        return this.residents.map(resident => ({ position: resident.group.position, visible: resident.group.visible, itemId: resident.itemId }));
    }

    private visitItem(item: IslandStageItem, reduced = this.motion.matches) {
        const items = this.state?.items ?? [], completedSets = this.state?.completedSets ?? 0;
        const choice = chooseReachableResident(this.residentCandidates(), item, items, completedSets, this.lastChosenResident);
        if (!choice) { this.callbacks.caption('どうぶつが とおれる すきまを あけて みよう'); return undefined; }
        const resident = this.residents[choice.index], now = performance.now();
        const visiting = choice.replay ? resident.replayUse(now, reduced)
            : resident.visit(item, now, reduced, items, completedSets, choice.route);
        if (!visiting) return undefined;
        this.lastChosenResident = choice.index;
        this.lastResident = resident;
        if (resident.action === 'walk') this.callbacks.caption(`${RESIDENT_NAMES[resident.species]}が あそびに とことこ`);
        return resident;
    }

    private visiblePoint(point: THREE.Vector3, margin = .12) {
        const projected = point.clone().project(this.camera);
        return Math.abs(projected.x) < 1 - margin && projected.y > -.91 && projected.y < 1 - margin;
    }

    private lightTargets(): LightTarget[] {
        const targets: LightTarget[] = [...this.items.values()].filter(model => model.group.visible
            && ['flower', 'lantern', 'fountain'].includes(model.item.kind)).map(model => {
                model.group.updateWorldMatrix(true, false);
                const anchor = getFurnitureAnchors(model.item.kind).light!;
                return { id: model.item.id, group: model.group, kind: model.item.kind as 'flower' | 'lantern' | 'fountain',
                    point: model.group.localToWorld(new THREE.Vector3(anchor.x, anchor.y, anchor.z)) };
            });
        this.tree.updateWorldMatrix(true, false);
        targets.push({ id: 'tree', kind: 'tree', group: this.tree, point: this.tree.localToWorld(getTreeLightAnchor(this.tree)) });
        if (this.expansion.visible) targets.push({ id: 'east-garden', kind: 'flower', point: new THREE.Vector3(6.98, .35, .82) });
        const visible = targets.filter(target => this.visiblePoint(target.point));
        if (!visible.length) {
            const roots = { id: 'tree', kind: 'tree' as const, group: this.tree, point: new THREE.Vector3(1.6, .22, -1.0) };
            if (this.visiblePoint(roots.point)) visible.push(roots);
        }
        return visible;
    }

    private placeCycleAccent() {
        const targets = this.lightTargets();
        const target = targets.find(candidate => candidate.id === 'tree') ?? targets.find(candidate => candidate.kind === 'lantern') ?? targets[0];
        if (!target) return;
        const center = target.point.clone().add(new THREE.Vector3(0, .08, .07));
        // The whole small ring, rather than just its center, must fit the short learning window.
        for (let lower = 0; lower < 7; lower++) {
            if ([-.4, .4].every(y => [-.4, .4].every(x => this.visiblePoint(center.clone().add(new THREE.Vector3(x, y, 0)), .06)))) break;
            center.y = Math.max(.4, center.y - .12);
        }
        this.cycleLights.position.copy(center);
    }

    private setCycleProgress(progress?: LearningProgress) {
        this.displayedProgress = progress;
        this.cycleLights.visible = Boolean(progress && this.state?.learning);
        this.cycleSeeds.forEach((seed, i) => {
            seed.visible = Boolean(progress && i < progress.total);
            const angle = Math.PI / 2 + i / (progress?.total ?? 6) * Math.PI * 2;
            seed.position.set(Math.cos(angle) * .31, Math.sin(angle) * .31, 0);
            seed.material = this.materials.get(i < (progress?.completed ?? 0) ? '#ffd475' : '#899b6f', i < (progress?.completed ?? 0));
        });
    }

    private startReaction(id: string, kind: LearningReactionKind, beat: LearningBeat) {
        this.clearReaction();
        const targets = this.lightTargets(), count = this.state?.learningProgress?.completed ?? this.state?.pulse ?? 0;
        const preferred = beat === 'complete' ? 'tree' : count % 3 === 1 ? 'flower' : count % 3 === 2 ? 'lantern' : 'tree';
        const residents = this.residents.filter(resident => resident.group.visible
            && this.visiblePoint(resident.group.position.clone().add(new THREE.Vector3(0, .85, 0)), .04));
        const fallbackResident = residents[0];
        const target = targets.find(candidate => candidate.kind === preferred) ?? targets[0] ?? (fallbackResident ? {
            id: `resident:${fallbackResident.species}`, kind: 'resident' as const,
            point: fallbackResident.group.position.clone().add(new THREE.Vector3(0, .8, 0)),
        } : undefined);
        if (!target) { this.setCycleProgress(this.pendingProgress ?? this.displayedProgress); this.pendingProgress = undefined; return; }
        const resident = residents.sort((a, b) => a.group.position.distanceTo(target.point) - b.group.position.distanceTo(target.point))[0];
        this.pulseRecipient = kind === 'correct' ? target : undefined;
        this.raycaster.setFromCamera(new THREE.Vector2(0, -.88), this.camera);
        this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -.14), this.lightOrigin);
        const actualTarget = kind === 'correct' ? target : { ...target, id: resident ? `resident:${resident.species}` : 'input-edge', point: this.lightOrigin.clone() };
        this.reaction = { id, kind, startedAt: performance.now(), settledAt: 0, phase: kind === 'correct' ? 'travel' : 'contact',
            target: actualTarget, resident, beat, arrived: false, reduced: this.motion.matches };
        if (kind !== 'correct') this.callbacks.caption(kind === 'retry' ? 'あわてず もういちど みてみよう' : 'いっしょに たしかめよう');
    }

    private applyLife(amount: number) {
        const target = this.pulseRecipient;
        if (!target?.group) return;
        if (target.kind === 'tree') applyTreeLife(target.group, amount, this.motion.matches);
        else applyFurnitureLife(target.group, amount, this.motion.matches);
    }

    private clearReaction() {
        this.applyLife(0); this.pulseRecipient = undefined;
        this.arrival.visible = false; this.arrival.scale.setScalar(1);
        this.reaction = undefined;
    }

    private resize() {
        if (this.disposed || this.lost) return;
        const width = Math.max(1, this.host.clientWidth), height = Math.max(1, this.host.clientHeight), aspect = width / height;
        this.renderer.setSize(width, height, false);
        const expanded = this.expansion.visible;
        const target = this.state?.learning ? this.learningFocus.clone() : new THREE.Vector3(expanded ? 1.3 : -.08, .85, -.03);
        if (this.state?.learning && height < 130) target.y -= .18;
        this.camera.position.copy(target).add(new THREE.Vector3(4.7, 8.8, 13.5));
        this.camera.lookAt(target); this.camera.updateMatrixWorld(true);
        if (this.state?.learning) {
            const widthInWorld = width < 600 ? 7.2 : 9.5;
            this.camera.left = -widthInWorld / 2; this.camera.right = widthInWorld / 2;
            this.camera.top = widthInWorld / aspect / 2; this.camera.bottom = -widthInWorld / aspect / 2;
            this.camera.updateProjectionMatrix(); this.placeCycleAccent(); this.requestFrame(); return;
        }
        const points: THREE.Vector3[] = [];
        for (let i = 0; i < 36; i++) {
            const a = i / 36 * Math.PI * 2;
            points.push(new THREE.Vector3(Math.cos(a) * 5.1, -.7, Math.sin(a) * 3.83));
            if (expanded) points.push(new THREE.Vector3(6.2 + Math.cos(a) * 2.05, -.7, Math.sin(a) * 2.48));
        }
        points.push(new THREE.Vector3(-3.1, 2.75, -2), new THREE.Vector3(1.3, 4.35, -1.65),
            new THREE.Vector3(-1.4, 0, 4.45), new THREE.Vector3(3.46, 3.3, -1.65));
        for (const model of this.items.values()) {
            points.push(new THREE.Vector3(model.group.position.x, model.item.kind === 'swing' ? 1.9 : 1.3, model.group.position.z));
        }
        const bounds = new THREE.Box3().setFromPoints(points.map(point => point.applyMatrix4(this.camera.matrixWorldInverse)));
        const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
        const fitHeight = Math.max(size.y, size.x / aspect) * 1.09;
        this.camera.left = center.x - fitHeight * aspect / 2;
        this.camera.right = center.x + fitHeight * aspect / 2;
        this.camera.top = center.y + fitHeight / 2;
        this.camera.bottom = center.y - fitHeight / 2;
        this.camera.updateProjectionMatrix();
        this.requestFrame();
    }

    private pointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        this.pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
        if (this.state?.preview) this.renderer.domElement.setPointerCapture(event.pointerId);
    };
    private pointerCancel = () => { this.pointerStart = undefined; };
    private movePreviewToPointer(event: PointerEvent) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1,
            -(event.clientY - rect.top) / rect.height * 2 + 1), this.camera);
        const point = this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
        if (point) this.callbacks.ground({ x: point.x, z: point.z });
    }
    private pointerMove = (event: PointerEvent) => {
        if (!this.state?.preview || this.pointerStart?.id !== event.pointerId) return;
        if (Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y) > 3) this.movePreviewToPointer(event);
    };
    private pointerUp = (event: PointerEvent) => {
        const start = this.pointerStart;
        this.pointerStart = undefined;
        if (this.renderer.domElement.hasPointerCapture(event.pointerId)) this.renderer.domElement.releasePointerCapture(event.pointerId);
        if (!start || start.id !== event.pointerId || event.button !== 0 || !this.state) return;
        if (this.state.preview) { this.movePreviewToPointer(event); return; }
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 9) return;
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1,
            -(event.clientY - rect.top) / rect.height * 2 + 1), this.camera);
        const hits = this.raycaster.intersectObjects([...this.items.values()].map(model => model.group), true);
        const id = hits[0]?.object.userData.itemId as string | undefined;
        if (id) { this.callbacks.select(id); return; }
        this.movePreviewToPointer(event);
    };

    private contextLost = (event: Event) => {
        event.preventDefault(); this.lost = true; this.pause();
        this.host.dataset.renderer = 'fallback'; this.callbacks.failure();
    };
    private motionChanged = () => {
        if (this.motion.matches) for (const resident of this.residents) resident.update(performance.now() + 10000);
        this.requestFrame();
    };
    private visibilityChanged = () => { if (document.hidden) this.pause(); else this.requestFrame(); };
    private pause() { cancelAnimationFrame(this.frame); this.frame = 0; window.clearTimeout(this.idleTimer); }
    private requestFrame = () => {
        if (this.disposed || this.lost || document.hidden || !this.onscreen || this.frame) return;
        window.clearTimeout(this.idleTimer);
        this.frame = requestAnimationFrame(this.draw);
    };

    private draw = (now: number) => {
        this.frame = 0;
        if (this.disposed) return;
        // 30fps is sufficient for this small, calm world; answer UI is never tied to this loop.
        if (now - this.lastFrame < 28) { this.requestFrame(); return; }
        this.lastFrame = now;
        const drawStarted = performance.now();
        let moving = false;
        for (const [index, resident] of this.residents.entries()) {
            if (!resident.group.visible) continue;
            resident.clearLearningPose();
            moving = resident.update(now) || moving;
            this.residentShadows[index].position.set(resident.group.position.x, .025, resident.group.position.z);
        }
        for (const model of this.items.values()) applyFurnitureUse(model.group, 0);
        for (const resident of this.residents) {
            const model = resident.itemId ? this.items.get(resident.itemId) : undefined;
            if (model && resident.action === 'swing') applyFurnitureUse(model.group, resident.usePhase);
        }
        let residentReply = 'none';
        if (this.reaction) {
            const reaction = this.reaction;
            const sampled = sampleLearningReaction(reaction.kind, now - reaction.startedAt, this.motion.matches, reaction.beat);
            reaction.phase = sampled.phase; reaction.reduced = this.motion.matches;
            if (sampled.phase === 'settled' && !reaction.settledAt) reaction.settledAt = now;
            this.arrival.visible = sampled.earnedLight && (sampled.phase !== 'settled' || this.motion.matches);
            if (sampled.phase === 'travel') {
                this.arrival.position.lerpVectors(this.lightOrigin, reaction.target.point, sampled.travel);
                this.arrival.position.y += Math.sin(sampled.travel * Math.PI) * .35;
                this.arrival.rotation.z = sampled.travel * .45;
                this.arrival.scale.setScalar(1.15);
            } else {
                this.arrival.position.copy(reaction.target.point).add(new THREE.Vector3(0, .12, 0));
                this.arrival.scale.setScalar(this.motion.matches ? .8 : .35 + sampled.paw * .55);
            }
            if (sampled.arrived && !reaction.arrived) {
                reaction.arrived = true;
                if (this.pendingProgress?.sectionId === this.state?.learningProgress?.sectionId) this.setCycleProgress(this.pendingProgress);
                this.pendingProgress = undefined;
                if (reaction.kind === 'correct') this.callbacks.caption(reaction.beat === 'complete' ? 'ひかりが そろった。どうぶつも うれしそう'
                    : reaction.target.kind === 'flower' ? 'おはなに ひかり。どうぶつが てを ふった'
                        : reaction.target.kind === 'lantern' ? 'あかりが きらり。どうぶつが てを ふった'
                            : reaction.target.kind === 'resident' ? 'ひかりが とどいた。どうぶつが てを ふった'
                                : reaction.target.kind === 'fountain' ? 'みずが きらり。どうぶつが てを ふった' : 'きに ひかり。どうぶつが てを ふった');
            }
            this.applyLife(sampled.paw);
            if (reaction.resident && (sampled.paw || sampled.look)) {
                reaction.resident.respondToLearning(reaction.kind, sampled.paw, sampled.look, reaction.target.point);
                residentReply = reaction.kind === 'correct' ? 'delight' : 'listen';
            }
            moving = sampled.moving || moving;
        }
        if (!this.motion.matches && !this.state?.learning) {
            const idleElapsed = now - this.idleStart;
            if (idleElapsed < 1350 && this.residents[1].action !== 'walk') {
                this.residents[1].head.rotation.z = Math.sin(idleElapsed / 1350 * Math.PI * 2) * .095;
                moving = true;
            }
        }
        this.renderer.render(this.scene, this.camera);
        this.host.dataset.drawCount = String(++this.drawCount);
        this.host.dataset.triangles = String(this.renderer.info.render.triangles);
        this.host.dataset.geometries = String(this.renderer.info.memory.geometries);
        this.host.dataset.textures = String(this.renderer.info.memory.textures);
        this.host.dataset.previewBuildCount = String(this.placementPreview.buildCount);
        this.host.dataset.previewValid = this.state?.preview ? String(this.state.previewValid ?? true) : '';
        const preview = this.placementPreview.group;
        this.host.dataset.previewState = JSON.stringify(this.previewItem && preview.visible ? {
            id: this.previewItem.id, uuid: preview.children[0]?.uuid,
            position: preview.position.toArray(), rotationY: preview.rotation.y,
            sourceVisible: this.items.get(this.previewItem.id)?.group.visible ?? false,
            marker: this.state?.previewValid === false ? 'broken' : 'solid',
        } : null);
        const observed = new Set(['starter-flower', 'starter-lantern', this.previewItem?.id,
            this.reaction?.target.id, this.lastResident?.itemId]);
        this.host.dataset.furnitureState = JSON.stringify([...this.items.values()].filter(model => observed.has(model.item.id)).map(({item, group}) => {
            let emissive: number | undefined;
            group.getObjectByName('lantern-light')?.traverse(child => {
                if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial && child.material.userData.islandOwned) {
                    emissive = child.material.emissiveIntensity;
                }
            });
            return { id: item.id, kind: item.kind, visible: group.visible, rootScale: group.scale.toArray(),
                position: group.position.toArray(), rotationY: group.rotation.y,
                life: { bloomScale: group.getObjectByName('flower-blooms')?.scale.x,
                    leafScale: group.getObjectByName('flower-leaves')?.scale.x, emissive,
                    waterScaleY: group.getObjectByName('fountain-water')?.scale.y,
                    rippleScale: group.getObjectByName('fountain-ripple')?.scale.x },
                swingAngle: group.getObjectByName('swing-moving')?.rotation.x };
        }));
        this.host.dataset.residentUsePhase = String(this.lastResident?.usePhase ?? 0);
        this.host.dataset.renderer = 'three';
        this.host.dataset.artDirection = this.materials.artDirection;
        this.host.dataset.expanded = String(this.expansion.visible);
        this.host.dataset.residents = String(this.residents.filter(resident => resident.group.visible).length);
        this.host.dataset.lighthouse = String(this.lighthouse.visible);
        this.host.dataset.residentAction = this.lastResident?.action ?? 'idle';
        this.host.dataset.residentSpecies = this.lastResident?.species ?? '';
        this.host.dataset.residentItemId = this.lastResident?.itemId ?? '';
        this.host.dataset.residentTarget = this.lastResident?.itemId ?? '';
        this.host.dataset.residentX = String(this.lastResident?.group.position.x ?? '');
        this.host.dataset.residentY = String(this.lastResident?.group.position.y ?? '');
        this.host.dataset.residentZ = String(this.lastResident?.group.position.z ?? '');
        this.host.dataset.residentStates = JSON.stringify(this.residents.filter(resident => resident.group.visible).map(resident => ({
            species: resident.species, itemId: resident.itemId, action: resident.action, position: resident.group.position.toArray(), usePhase: resident.usePhase,
        })));
        this.host.dataset.playRequestId = this.playResult?.requestId ?? '';
        this.host.dataset.playStatus = this.playResult?.status ?? '';
        this.host.dataset.playReason = this.playResult?.reason ?? '';
        this.host.dataset.selectedItem = this.selection.visible ? this.state?.selectedId ?? '' : this.previewItem?.id ?? '';
        this.host.dataset.drawCalls = String(this.renderer.info.render.calls);
        this.host.dataset.reactionId = this.reaction?.id ?? '';
        this.host.dataset.reactionKind = this.reaction?.kind ?? '';
        this.host.dataset.reactionPhase = this.reaction?.phase ?? 'settled';
        this.host.dataset.reactionTarget = this.reaction?.target.id ?? '';
        this.host.dataset.reactionStartedAt = String(this.reaction?.startedAt ?? 0);
        this.host.dataset.reactionSettledAt = String(this.reaction?.settledAt ?? 0);
        this.host.dataset.reactionReduced = String(this.reaction?.reduced ?? this.motion.matches);
        this.host.dataset.residentReaction = residentReply;
        this.host.dataset.sectionId = this.displayedProgress?.sectionId ?? '';
        this.host.dataset.sectionCompleted = String(this.displayedProgress?.completed ?? 0);
        this.host.dataset.sectionTotal = String(this.displayedProgress?.total ?? 0);
        this.host.dataset.cameraFrame = [...this.camera.matrixWorld.elements, ...this.camera.projectionMatrix.elements].map(value => value.toFixed(5)).join(',');
        this.host.dataset.frameCpuMs = (performance.now() - drawStarted).toFixed(3);
        if (moving && !this.motion.matches) this.requestFrame();
        else if (!this.motion.matches && !this.state?.learning) {
            this.idleTimer = window.setTimeout(() => { this.idleStart = performance.now(); this.requestFrame(); }, 9000);
        }
    };

    dispose() {
        this.disposed = true; this.pause();
        this.observer.disconnect(); this.visibilityObserver.disconnect();
        document.removeEventListener('visibilitychange', this.visibilityChanged);
        this.motion.removeEventListener('change', this.motionChanged);
        this.renderer.domElement.removeEventListener('pointerup', this.pointerUp);
        this.renderer.domElement.removeEventListener('pointerdown', this.pointerDown);
        this.renderer.domElement.removeEventListener('pointermove', this.pointerMove);
        this.renderer.domElement.removeEventListener('pointercancel', this.pointerCancel);
        this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
        this.placementPreview.dispose();
        const materials = new Set<THREE.Material>();
        this.scene.traverse(child => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) child.material.forEach(material => materials.add(material)); else materials.add(child.material);
            }
        });
        materials.forEach(material => material.dispose());
        this.materials.dispose();
        this.renderer.dispose();
        this.renderer.forceContextLoss();
        this.renderer.domElement.remove();
    }
}
