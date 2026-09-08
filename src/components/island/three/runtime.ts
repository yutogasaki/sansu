import * as THREE from 'three';
import { IslandMaterials, disposeGeometry, star } from './primitives';
import { applyTreeLife, getTreeLightAnchor, ISLAND_SHORE_RIM } from './scenery';
import { shoreContour } from './geometry';
import { applyFurnitureGrowth, IslandNatureVisuals } from './growthVisuals';
import { DEFAULT_ISLAND_COSMETICS, ISLAND_CUSTOMIZATION_CANDIDATE, IslandCosmeticScenery, sameIslandCosmetics } from './cosmeticScenery';
import { canRunLivingActivities, canStartGrownSharing, livingCandidates, livingVisitHasSetting, livingVisitsForItem, sharedLivingDiscovery, type LivingVisit } from './livingActivities';
import { applyFurnitureInterest, applyFurnitureLife, applyFurnitureUse, getFurnitureAnchors, makeFurniture, makeLightArrival, makeSelection } from './furniture';
import { IslandPlacementPreview } from './placementPreview';
import { IslandPlacementOcclusion } from './placementOcclusion';
import { boxCorners, fitLearningFrame } from './sceneFraming';
import { getIslandLandAccess, getIslandLands, ISLAND_EAST_LAND, ISLAND_ITEMS, ISLAND_WEST_LAND } from '../../../domain/island/catalog';
import { getIslandExpansionLevel } from '../../../domain/island/expansion';
import { ISLAND_VISUAL_CANDIDATE } from '../../../domain/island/feature';
import { IslandResident, RESIDENT_NAMES } from './animals';
import { canShowOrdinaryInterest, isResidentInterestItem, residentInterestVerb, sampleResidentInterest,
    type ResidentInterestSample } from './residentInterest';
import { chooseReachableResident, residentNeedsInitialSpawn, savedResidentLayoutChanged, suggestReachablePlacement } from './residentInteraction';
import { findSafeResidentSpawn, planResidentPointRoute, planResidentRoute } from './navigation';
import { chooseSharedActivity, sharedActivityDeliveryPlans, type SharedActivityPlan, type SharedActivityReplayPreference } from './sharedActivities';
import { SharedActivityVisuals } from './sharedActivityVisuals';
import { SharedActivityController } from './sharedActivityController';
import { FurnitureClearanceController } from './furnitureClearanceController';
import { chooseSharedActivityPresentation, fitSharedActivityFrame, type SharedActivityFrame } from './sharedActivityFraming';
import type { IslandPlacementSuggestion, IslandPlayResult, IslandStageItem, IslandStageState } from './types';
import { learningBeat, normalizedLearningProgress, reconcileLearningProgress, sampleLearningReaction, type LearningBeat, type LearningProgress,
    type LearningReactionKind, type LearningReactionPhase } from './learningReaction';

interface RuntimeCallbacks {
    ground: (point: { x: number; z: number }) => void;
    select: (id: string) => void;
    caption: (caption: string) => void;
    failure: () => void;
    ready?: () => void;
    playResult?: (result: IslandPlayResult) => void;
    placementSuggestion?: (suggestion: IslandPlacementSuggestion) => void;
    discovery?: (id: string, itemId: string) => void;
}
interface ItemModel { item: IslandStageItem; group: THREE.Group }
interface LightTarget { id: string; point: THREE.Vector3; group?: THREE.Group; kind: 'flower' | 'lantern' | 'tree' | 'resident' | 'fountain' | 'growth'; habitatId?: IslandStageState['growthTarget'] }
const GROWTH_PLACE_NAMES = { garden: 'にわ', waterside: 'みずべ', grove: 'こかげ', village: 'いえの まわり' } as const;
interface SceneReaction {
    id: string; kind: LearningReactionKind; startedAt: number; settledAt: number; phase: LearningReactionPhase;
    target: LightTarget; resident?: IslandResident; beat: LearningBeat; arrived: boolean; reduced: boolean;
}
const samePlacement = (a: IslandStageItem, b: IslandStageItem) => a.kind === b.kind && a.rotation === b.rotation
    && a.position?.x === b.position?.x && a.position?.z === b.position?.z;

/** Album pairs share a world-space framing contract. Neither saved land size,
 * object count nor maturity can zoom one side and hide the actual growth. */
export function fitIslandComparisonCamera(camera: THREE.OrthographicCamera,
    habitat: NonNullable<IslandStageState['comparisonHabitat']>, aspect: number) {
    const frames = {
        garden: { target: [.6, .6, .95], width: 3.8, height: 3.4 },
        waterside: { target: [4.9, .65, 1.15], width: 5.8, height: 4.4 },
        grove: { target: [-6.4, 1.3, -.15], width: 5.3, height: 5.3 },
        village: { target: [-2.5, 1.25, -1.1], width: 4.3, height: 4.5 },
        all: { target: [0, 1, -.03], width: (ISLAND_EAST_LAND.x + ISLAND_EAST_LAND.radiusX
            - ISLAND_WEST_LAND.x + ISLAND_WEST_LAND.radiusX) * 1.18, height: 10.3 },
    };
    const frame = frames[habitat], target = new THREE.Vector3(...frame.target);
    camera.position.copy(target).add(new THREE.Vector3(habitat === 'garden' ? -4.7 : 4.7, 8.8, 13.5));
    camera.lookAt(target); camera.updateMatrixWorld(true);
    const height = Math.max(frame.height, frame.width / aspect);
    camera.left = -height * aspect / 2; camera.right = height * aspect / 2;
    camera.top = height / 2; camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
}

export class IslandScene {
    private readonly scene = new THREE.Scene();
    private readonly camera = new THREE.OrthographicCamera(-7, 7, 5, -5, .1, 100);
    private readonly renderer: THREE.WebGLRenderer;
    private readonly materials = new IslandMaterials();
    private world!: IslandCosmeticScenery;
    private tree!: THREE.Group;
    private scenery!: THREE.Group;
    private expansion!: THREE.Group;
    private westExpansion!: THREE.Group;
    private readonly nature = new IslandNatureVisuals(this.materials);
    private lighthouse!: THREE.Group;
    private readonly arrival: THREE.Group;
    private readonly selection = makeSelection();
    private readonly cycleLights = new THREE.Group();
    private readonly cycleSeeds: THREE.Mesh[] = [];
    private readonly items = new Map<string, ItemModel>();
    private readonly residents: IslandResident[];
    private readonly sharedVisuals = new SharedActivityVisuals(this.materials);
    private readonly sharedActivity: SharedActivityController;
    private readonly furnitureClearance: FurnitureClearanceController;
    private clearanceDirty = false;
    private clearanceCaptionPending = false;
    private pendingVisitId?: string;
    private deferredPlay?: IslandStageState['playRequest'];
    private sharedCamera?: { pairId: string; startedAt: number; from: SharedActivityFrame; to: SharedActivityFrame };
    private sharedPresentation?: { pairId: string; attemptedPlans: number; satisfied: boolean;
        handoffPoint: SharedActivityPlan['handoffPoint']; deliveryRoute: SharedActivityPlan['deliveryRoute']; fallback?: 'ordinary' };
    private readonly residentShadows: THREE.Mesh[] = [];
    private readonly pendingSpawns = new Set<number>();
    private pendingSpawnRetry = false;
    private readonly shadowMaterial = new THREE.MeshBasicMaterial({ color: '#536f54', transparent: true, opacity: .16, depthWrite: false });
    private readonly observer: ResizeObserver;
    private readonly visibilityObserver: IntersectionObserver;
    private readonly motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    private state?: IslandStageState;
    private get landAccess() { return getIslandLandAccess(this.state ?? { completedSets: 0 }); }
    private readonly placementPreview = new IslandPlacementPreview(this.materials);
    private readonly placementOcclusion = new IslandPlacementOcclusion();
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
    private learningBounds: THREE.Box3[] = [];
    private readonly lightOrigin = new THREE.Vector3(.1, .22, 3.45);
    private lastFrame = 0;
    private lastResident?: IslandResident;
    private ordinaryInterest?: { resident: IslandResident; model: ItemModel; target: THREE.Vector3 };
    private interestObservation?: { context: 'visit' | 'learning'; itemId: string; species: IslandResident['species'];
        phase: number; reduced: boolean; sample: ResidentInterestSample; target: number[]; head: number[];
        hands: { left: number[]; right: number[] } };
    private lastChosenResident = -1;
    private lastPlayRequestId?: string;
    private playResult?: IslandPlayResult;
    private consumedSuggestionId?: string;
    private idleStart = -Infinity;
    private pointerStart?: { x: number; y: number; id: number };
    private liftedResidents?: { item: IslandStageItem; seated: IslandResident[]; walking: IslandResident[] };
    private livingVisit?: LivingVisit;
    private livingResidents: IslandResident[] = [];
    private livingHomeVisit = false;
    private homePending?: { resident: IslandResident; route: NonNullable<ReturnType<typeof planResidentPointRoute>> };
    private livingStartedAt = 0;
    private livingArrivedAt = 0;
    private livingTurn = 0;
    private nextLivingAt = 0;
    private readonly reportedDiscoveries = new Set<string>();

    constructor(private readonly host: HTMLDivElement, private readonly callbacks: RuntimeCallbacks, consumedPlayRequestId?: string) {
        this.lastPlayRequestId = consumedPlayRequestId;
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
        this.installCosmeticScenery(new IslandCosmeticScenery());
        this.arrival = makeLightArrival(this.materials);
        this.expansion.visible = false;
        this.westExpansion.visible = false;
        this.lighthouse.visible = false;
        this.arrival.visible = false;
        this.selection.visible = false;
        this.scene.add(this.arrival, this.selection, this.nature.group);
        this.scene.add(this.cycleLights, this.placementPreview.group, this.sharedVisuals.group);
        for (let i = 0; i < 6; i++) {
            const seed = star(this.cycleLights, this.materials.get('#899b6f'), [0, 0, 0], .065);
            seed.castShadow = false; seed.receiveShadow = false;
            this.cycleSeeds.push(seed);
        }
        this.cycleLights.visible = false;
        const residentCaption = (caption: string) => { if (!this.sharedActivity?.plan && !this.furnitureClearance?.active) callbacks.caption(caption); };
        this.residents = [
            new IslandResident('otter', this.materials, [.1, 0, 1.6], residentCaption),
            new IslandResident('rabbit', this.materials, [2.45, 0, 1.45], residentCaption),
            new IslandResident('fox', this.materials, [6.26, 0, .83], residentCaption),
        ];
        this.sharedActivity = new SharedActivityController(this.residents, this.sharedVisuals, callbacks.caption);
        this.furnitureClearance = new FurnitureClearanceController(this.residents, caption => {
            this.clearanceCaptionPending = caption === 'すこし よけるね';
            callbacks.caption(caption);
        });
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

    private installCosmeticScenery(world: IslandCosmeticScenery) {
        this.world = world;
        this.tree = world.tree; this.scenery = world.scenery;
        this.expansion = world.expansion; this.westExpansion = world.westExpansion;
        this.lighthouse = world.lighthouse;
        this.scene.add(world.group);
        this.scene.background = new THREE.Color(world.materials.color('#76cdd3'));
    }

    update(state: IslandStageState) {
        if (this.disposed || this.lost) return;
        const previous = this.state;
        const cosmeticsChanged = !sameIslandCosmetics(this.world.cosmetics, state.cosmetics);
        if (cosmeticsChanged) {
            // Restore any temporary cloned materials before the old scenery dies.
            // Actors and their routes, items and controllers retain their identity.
            this.placementOcclusion.restore();
            this.clearReaction();
            const nextWorld = new IslandCosmeticScenery(state.cosmetics ?? DEFAULT_ISLAND_COSMETICS);
            const oldWorld = this.world;
            this.installCosmeticScenery(nextWorld);
            oldWorld.dispose();
        }
        if (!previous) this.nextLivingAt = performance.now() + 1500;
        const layoutChanged = Boolean(previous && savedResidentLayoutChanged(previous.items, state.items));
        if (state.learning || state.preview || state.readOnly || layoutChanged
            || previous?.districtFocus !== state.districtFocus) this.cancelLivingActivity(performance.now());
        if (state.learning || state.preview || state.readOnly || layoutChanged || (previous?.playRequest && !state.playRequest)) this.clearOrdinaryInterest();
        if (layoutChanged || state.preview) {
            this.clearanceDirty ||= layoutChanged || this.furnitureClearance.active;
            this.furnitureClearance.cancel(performance.now());
        }
        // A newly saved obstacle invalidates every old route, including routes
        // belonging to a different item. Editing a preview alone does not.
        if (layoutChanged) this.residents.forEach(resident => resident.stopWalking(performance.now()));
        if (state.learning || state.preview || !state.playRequest) this.deferredPlay = undefined;
        if (state.learning) this.pendingVisitId = undefined;
        const cancelSharing = state.learning || state.preview || state.readOnly || (!state.playRequest && !this.livingVisit)
            || (previous && savedResidentLayoutChanged(previous.items, state.items));
        const restoringWorldFrame = cancelSharing && Boolean(this.sharedCamera);
        if (cancelSharing) { this.sharedActivity.cancel(performance.now()); this.sharedCamera = undefined; this.sharedPresentation = undefined; }
        // Keep edit-only material clones through a drag; restore before a saved
        // item can be removed/disposed, or when the placement sheet closes.
        if (!state.preview || state.preview.id !== previous?.preview?.id
            || (previous && savedResidentLayoutChanged(previous.items, state.items))) this.placementOcclusion.restore();
        this.state = state;
        const expansionLevel = getIslandExpansionLevel(state), eastOpen = expansionLevel >= 1;
        const landChanged = !previous || getIslandExpansionLevel(previous) !== expansionLevel;
        const foxAvailable = eastOpen && state.completedSets >= 4, lighthouseAvailable = eastOpen && state.completedSets >= 6;
        let shadowChanged = !previous || landChanged || cosmeticsChanged || this.lighthouse.visible !== lighthouseAvailable;
        this.expansion.visible = eastOpen;
        this.westExpansion.visible = expansionLevel >= 2;
        shadowChanged = this.world.updateGrowth(state) || shadowChanged;
        this.residents[2].group.visible = foxAvailable && !this.pendingSpawns.has(2);
        this.residentShadows[2].visible = this.residents[2].group.visible;
        this.lighthouse.visible = lighthouseAvailable;
        if (previous && this.pendingSpawns.size && savedResidentLayoutChanged(previous.items, state.items)) this.pendingSpawnRetry = true;
        // A live saved record may arrive before its placement sheet closes.
        const savedLayoutChanged = this.pendingSpawnRetry && !state.preview;
        this.residents.forEach((resident, index) => {
            if ((index === 2 && !foxAvailable) || !residentNeedsInitialSpawn(resident.species, state.completedSets,
                previous?.completedSets, this.pendingSpawns.has(index), savedLayoutChanged,
                Boolean(previous && getIslandExpansionLevel(previous) === 0 && eastOpen))) return;
            const occupied = this.residents.filter(other => other !== resident && other.group.visible).map(other => other.group.position);
            const spawn = findSafeResidentSpawn(resident.group.position, state.items, this.landAccess, occupied);
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
            } else if (!samePlacement(model.item, item)) {
                // Live changes (including another tab) invalidate the old target
                // even when its id is unchanged. Replaying it would use the old seat.
                for (const resident of this.residents) if (resident.itemId === item.id) resident.release();
                visit = item; shadowChanged = true;
            }
            model.item = item;
            shadowChanged = applyFurnitureGrowth(model.group, item, this.materials,
                item.habitatId ? state.growth?.progress[item.habitatId] : 0) || shadowChanged;
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
                for (const resident of lifted.seated) if (!resident.itemId) {
                    resident.visit(restored.item, performance.now(), true, state.items, this.landAccess);
                }
                for (const resident of lifted.walking) if (!resident.itemId) {
                    const occupied = this.residents.filter(other => other !== resident && other.group.visible).map(other => other.group.position);
                    const route = planResidentRoute(resident.group.position, restored.item, state.items, this.landAccess,
                        resident.departingId, { occupied });
                    if (route) resident.visit(restored.item, performance.now(), this.motion.matches, state.items, this.landAccess, route);
                }
            }
            this.liftedResidents = undefined;
        }
        if (visit && previous && !state.learning && !state.readOnly && !state.growth) this.pendingVisitId = visit.id;
        if (this.clearanceDirty && !state.preview) {
            this.clearanceDirty = false;
            this.furnitureClearance.start(state.items, this.landAccess, performance.now(), this.motion.matches);
        }
        if (!state.preview && !state.learning && !this.furnitureClearance.active
            && (!state.playRequest || state.playRequest.id === this.lastPlayRequestId)) this.finishPendingActivity();
        if (!previous && !state.readOnly && !state.learning) {
            // Returning to the island restores an inhabited scene immediately.
            const seat = [...placed].reverse().find(item => ['bench', 'mushroom'].includes(item.kind));
            if (seat) {
                this.visitItem(seat, true);
            }
        }
        if (state.preview?.id !== previous?.preview?.id && state.preview) {
            const residents = this.residents.filter(resident => resident.itemId === state.preview!.id);
            this.liftedResidents = { item: this.items.get(state.preview.id)?.item ?? state.preview,
                seated: residents.filter(resident => ['sit', 'rest', 'swing'].includes(resident.action)),
                walking: residents.filter(resident => resident.action === 'walk') };
            residents.forEach(resident => resident.release());
        }
        this.previewItem = state.preview;
        this.placementPreview.update(state.preview, state.previewValid ?? true);
        if (!state.placementSuggestionId) this.consumedSuggestionId = undefined;
        else if (state.placementSuggestionId !== this.consumedSuggestionId) {
            this.consumedSuggestionId = state.placementSuggestionId;
            const saved = state.items.find(item => item.id === state.placementSuggestionId);
            if (!state.learning && !state.readOnly && saved && !saved.position && state.preview?.id === saved.id) {
                const position = suggestReachablePlacement(state, state.preview, this.residentCandidates());
                if (position) this.callbacks.placementSuggestion?.({ itemId: saved.id, position });
            }
        }
        const selected = state.selectedId ? this.items.get(state.selectedId) : undefined;
        this.selection.visible = Boolean(selected && !state.preview && !state.readOnly);
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
            const habitat = state.growthTarget ?? state.growth?.focus;
            const target = state.items.find(item => item.habitatId === habitat && item.position);
            if (!previous?.learning && target?.position) this.learningFocus.set(target.position.x, .55, target.position.z);
            // Auto-continuation can reserve a different habitat; the current
            // learning view still stays exactly where the child began.
            else if (previous?.learning && state.growth) this.learningFocus.copy(this.camera.userData.frozenLearningFocus ?? this.learningFocus);
            this.camera.userData.frozenLearningFocus = this.learningFocus.clone();
        }
        if (state.learning && (entering || layoutChanged)) {
            // Include future serial departures before the first learning frame.
            // Answer feedback never has to move the camera or wait for a walk.
            this.learningBounds = [...this.residents.filter(candidate => candidate.group.visible).map(candidate => candidate.learningFrameBounds()),
                ...this.furnitureClearance.learningFrameBounds()];
        }
        if (!previous || landChanged || previous.completedSets !== state.completedSets || previous.learning !== state.learning || previous.districtFocus !== state.districtFocus
            || previous.comparisonHabitat !== state.comparisonHabitat || entering || restoringWorldFrame
            || (state.learning && layoutChanged)) this.resize();
        const event = state.reaction;
        const freshReaction = previous && event && event.id !== previous.reaction?.id;
        const cycle = reconcileLearningProgress(this.displayedProgress, this.pendingProgress, progress, freshReaction ? event.kind : undefined);
        this.pendingProgress = cycle.pending;
        this.setCycleProgress(cycle.displayed);
        if (!event && (previous?.reaction || entering)) this.clearReaction();
        if (entering || !previous) this.placeCycleAccent();
        if (freshReaction) this.startReaction(event.id, event.kind, learningBeat(progress, normalizedLearningProgress(previous.learningProgress)), event.growthTarget);
        // Old callers keep pulse support. A saved-progress caller uses only receipt reactions.
        else if (previous && !state.learningProgress && !event && state.pulse !== previous.pulse) this.startReaction(`legacy-${state.pulse}`, 'correct', 'step');
        const play = state.playRequest;
        if (play && play.id !== this.lastPlayRequestId) {
            this.lastPlayRequestId = play.id;
            if (this.furnitureClearance.active && !state.learning && !state.preview) {
                // A single latest invitation is retained; repeated taps create no queue.
                this.deferredPlay = play;
                this.pendingVisitId = undefined;
            } else this.performPlay(play);
        }
        // Answer/caption changes do not alter shadow-casting geometry. Preserve
        // the cached shadow map while the independent light reaction plays.
        if (shadowChanged) this.renderer.shadowMap.needsUpdate = true;
        this.requestFrame();
    }

    private performPlay(play: NonNullable<IslandStageState['playRequest']>, autonomous = false) {
        const state = this.state;
        if (!state) return;
        if (state.readOnly) return;
        if (!autonomous) this.cancelLivingActivity(performance.now());
        this.deferredPlay = undefined;
        this.pendingVisitId = undefined;
        const item = state.items.find(candidate => candidate.id === play.itemId);
        const requestedVisit = item && livingVisitsForItem(item).find(visit => visit.discoveryId === play.discoveryId && livingVisitHasSetting(state, visit));
        const reason = state.readOnly ? 'renderer' : state.learning ? 'learning' : state.preview ? 'editing' : !item?.position ? 'not-placed' : undefined;
        let result: IslandPlayResult;
        if (reason) result = { requestId: play.id, itemId: play.itemId, status: 'unavailable', reason };
        else {
            const now = performance.now();
            // Repeated clicks on either member of an active pair continue
            // its current handoff. A new invitation replaces old movement.
            const continuingSingle = !this.sharedActivity.plan && this.residents.some(resident => resident.group.visible
                && resident.itemId === item!.id && resident.action === 'walk');
            if (!continuingSingle && !this.sharedActivity.continuesFor(item!.id)) {
                this.clearOrdinaryInterest();
                const settled = this.sharedActivity.phase === 'settled' ? this.sharedActivity.plan : undefined;
                const previous: SharedActivityReplayPreference | undefined = settled && {
                    kind: settled.kind, source: settled.source, seat: settled.seat,
                    receiver: settled.receiver, carrier: settled.carrier,
                };
                this.sharedActivity.cancel(now);
                this.sharedPresentation = undefined;
                if (this.sharedCamera) { this.sharedCamera = undefined; this.resize(); }
                this.residents.forEach(resident => resident.stopWalking(now));
                const possible = !requestedVisit || requestedVisit.shared ? chooseSharedActivity(state.items, this.residentCandidates(), this.landAccess, item!.id,
                    this.lastChosenResident, previous) : undefined;
                const plan = possible && canStartGrownSharing(state, possible) ? possible : undefined;
                // Reduced motion has already reached its outcome when start
                // returns, so choose its legal staging before any actor moves.
                const presentation = plan && this.motion.matches ? this.chooseSharedPresentation(plan) : undefined;
                const selected = this.motion.matches ? presentation?.satisfied ? presentation.plan : undefined : plan;
                if (selected && this.sharedActivity.start(selected, now, this.motion.matches, state.items, this.landAccess,
                    presentation?.frame.presentationHands)) {
                    this.lastChosenResident = selected.carrier;
                    this.lastResident = this.residents[selected.carrier];
                    if (presentation) this.installSharedCamera(selected, presentation.frame, now);
                }
            }
            const shared = this.sharedActivity.plan;
            const ordinaryVisit = requestedVisit && !requestedVisit.shared ? requestedVisit
                : livingVisitsForItem(item!).find(visit => !visit.shared && !visit.nature && livingVisitHasSetting(state, visit));
            const home = !shared && ordinaryVisit && ['home-visit', 'terrace-time'].includes(ordinaryVisit.discoveryId);
            const resident = shared ? this.residents[shared.carrier] : home ? this.visitHome(ordinaryVisit)
                : this.visitItem(item!, this.motion.matches, true);
            if (resident && state.growth) {
                this.livingVisit = shared ? sharedLivingDiscovery(shared) : ordinaryVisit;
                if (!home) this.livingResidents = [resident];
                this.livingStartedAt = now; this.livingArrivedAt = 0;
            }
            result = resident ? { requestId: play.id, itemId: play.itemId, status: 'playing', resident: resident.species,
                ...(shared ? { activity: shared.kind, partner: this.residents[shared.receiver].species } : {}) }
                : { requestId: play.id, itemId: play.itemId, status: 'blocked', reason: 'unreachable' };
        }
        if (!autonomous) this.playResult = result;
        if (reason) this.callbacks.caption(reason === 'not-placed' ? 'しまに おいてから、あそぼう'
            : reason === 'editing' ? 'ばしょを きめたら、あそぼう' : 'しまに もどったら、あそぼう');
        if (!autonomous) this.callbacks.playResult?.(result);
        return result;
    }

    private visitHome(visit: LivingVisit) {
        const state = this.state!;
        this.clearOrdinaryInterest(); this.sharedActivity.cancel(performance.now());
        if (this.sharedCamera) { this.sharedCamera = undefined; this.resize(); }
        this.residents.forEach(resident => resident.stopWalking(performance.now()));
        const wanted = visit.discoveryId === 'terrace-time' ? 2 : 1;
        const choices: { resident: IslandResident; route: NonNullable<ReturnType<typeof planResidentPointRoute>> }[] = [];
        const points = [{ x: -2.45, z: -.04 }, { x: -3.32, z: -.2 }];
        for (const point of points.slice(0, wanted)) {
            const chosen = this.residents.filter(resident => resident.group.visible && !choices.some(choice => choice.resident === resident))
                .map(resident => ({ resident, route: planResidentPointRoute(resident.group.position, point, state.items, this.landAccess,
                    { departingId: resident.itemId || resident.departingId,
                        occupied: [...this.residents.filter(other => other !== resident && other.group.visible
                            && !choices.some(choice => choice.resident === other)).map(other => other.group.position),
                        ...choices.map(choice => choice.route.points[choice.route.points.length - 1])], yaw: Math.PI }) }))
                .find(choice => choice.route);
            if (!chosen?.route) return undefined;
            choices.push({ resident: chosen.resident, route: chosen.route });
        }
        const now = performance.now();
        const first = choices[0];
        first?.resident.walkToPoint(first.route, now, this.motion.matches, this.landAccess);
        this.homePending = choices[1];
        this.livingResidents = choices.map(choice => choice.resident);
        this.livingHomeVisit = true;
        this.lastResident = choices[0]?.resident;
        this.callbacks.caption(wanted === 2 ? 'いえの まえで、ふたりの ひとやすみ' : 'いえへ あそびに とことこ');
        return this.lastResident;
    }

    private cancelLivingActivity(now: number) {
        if (this.livingVisit) {
            this.livingResidents.forEach(resident => { resident.stopWalking(now); resident.clearLearningPose(); });
            this.sharedActivity.cancel(now);
            if (this.sharedCamera) { this.sharedCamera = undefined; this.sharedPresentation = undefined; this.resize(); }
        }
        this.livingVisit = undefined; this.livingResidents = []; this.livingHomeVisit = false; this.homePending = undefined; this.livingArrivedAt = 0;
        this.nature.clear(); this.nextLivingAt = now + 2500;
    }

    private updateLivingActivity(now: number) {
        const state = this.state;
        if (!state || !canRunLivingActivities(state, !document.hidden && this.onscreen)
            || this.furnitureClearance.active) return false;
        if (this.livingVisit) {
            if (now - this.livingStartedAt > 30000 || this.livingArrivedAt && now - this.livingArrivedAt > 6000) {
                this.cancelLivingActivity(now); this.nextLivingAt = now + 6500; return false;
            }
            if (this.homePending && this.livingResidents[0]?.action !== 'walk') {
                this.homePending.resident.walkToPoint(this.homePending.route, now, this.motion.matches, this.landAccess);
                this.homePending = undefined;
            }
            const arrived = this.sharedActivity.plan ? ['enjoy', 'settled'].includes(this.sharedActivity.phase ?? '')
                : this.livingResidents.length > 0 && this.livingResidents.every(resident => resident.action !== 'walk');
            if (!arrived) return true;
            if (!this.livingArrivedAt) this.livingArrivedAt = now;
            const visit = this.livingVisit, source = this.items.get(visit.item.id);
            if (visit.nature && source) return this.nature.update(visit.nature, source.group, now - this.livingArrivedAt, this.motion.matches);
            if (['home-visit', 'terrace-time'].includes(visit.discoveryId)) {
                const target = new THREE.Vector3(-2.75, .9, -.77);
                this.livingResidents.forEach(resident => resident.respondToInterest(sampleResidentInterest(resident.species,
                    this.motion.matches ? 1 : Math.min(1, (now - this.livingArrivedAt) / 1600), this.motion.matches), target));
            }
            if (visit.discoveryId === 'water-gazing' && visit.item.kind === 'swing') {
                const water = state.items.find(item => item.kind === 'fountain' && item.position
                    && Math.hypot(item.position.x - visit.item.position!.x, item.position.z - visit.item.position!.z) <= 2.9);
                if (water?.position) this.livingResidents.forEach(resident => resident.respondToInterest(
                    sampleResidentInterest(resident.species, this.motion.matches ? 1 : .5, this.motion.matches),
                    new THREE.Vector3(water.position!.x, .45, water.position!.z)));
            }
            return false;
        }
        if (now < this.nextLivingAt || this.sharedActivity.active || this.residents.some(resident => resident.action === 'walk')) return false;
        const candidates = livingCandidates(state, this.livingTurn++);
        // Deterministic rotation gives every available behavior a turn. An
        // unreachable composition falls back to its independent ordinary visit.
        for (const visit of candidates) {
            const result = this.performPlay({ id: `living-${this.livingTurn}`, itemId: visit.item.id, discoveryId: visit.discoveryId }, true);
            if (result?.status === 'playing') return true;
        }
        this.nextLivingAt = now + 6500;
        return false;
    }

    private recordRenderedDiscoveries() {
        const state = this.state;
        if (!canRunLivingActivities(state, this.onscreen && !document.hidden)) return;
        const shared = this.sharedActivity.plan;
        let visit = shared && ['enjoy', 'settled'].includes(this.sharedActivity.phase ?? '') ? sharedLivingDiscovery(shared)
            : this.livingArrivedAt ? this.livingVisit : undefined;
        // Direct legacy-style item invitations can also discover an earned
        // ordinary activity, but a level alone never creates a record.
        if (!visit && this.ordinaryInterest && this.ordinaryInterest.resident.action !== 'walk') {
            visit = livingVisitsForItem(this.ordinaryInterest.model.item).find(choice => !choice.shared && !choice.nature
                && !['home-visit', 'terrace-time'].includes(choice.discoveryId));
        }
        if (!visit || !state || !livingVisitHasSetting(state, visit) || visit.shared && !shared || this.reportedDiscoveries.has(visit.discoveryId)) return;
        if (['home-visit', 'terrace-time'].includes(visit.discoveryId)
            && (!this.livingHomeVisit || this.homePending || this.livingResidents.length < (visit.discoveryId === 'terrace-time' ? 2 : 1))) return;
        const actors = shared ? [this.residents[shared.carrier], this.residents[shared.receiver]]
            : this.livingResidents.length ? this.livingResidents : this.ordinaryInterest ? [this.ordinaryInterest.resident] : [];
        if (!actors.length || actors.some(resident => !resident.group.visible
            || !this.visiblePoint(resident.group.position.clone().add(new THREE.Vector3(0, .65, 0)), .015))) return;
        if (visit.nature) {
            const visibleNature = this.nature.group.children.find(child => child.visible);
            if (!this.nature.group.visible || !visibleNature
                || !this.visiblePoint(visibleNature.getWorldPosition(new THREE.Vector3()), .015)) return;
        }
        this.reportedDiscoveries.add(visit.discoveryId);
        this.callbacks.discovery?.(visit.discoveryId, visit.item.id);
    }

    private finishPendingActivity() {
        if (this.clearanceCaptionPending && !this.furnitureClearance.active && !this.furnitureClearance.blocked.length) {
            this.clearanceCaptionPending = false;
            this.callbacks.caption('カワウソと ウサギが くらす しま');
        }
        const play = this.deferredPlay;
        this.deferredPlay = undefined;
        if (play && this.state?.playRequest?.id === play.id) {
            this.performPlay(play);
            return;
        }
        const item = this.state?.items.find(candidate => candidate.id === this.pendingVisitId && candidate.position);
        this.pendingVisitId = undefined;
        if (item) this.visitItem(item);
    }

    private residentCandidates() {
        return this.residents.map(resident => ({ position: resident.group.position, visible: resident.group.visible,
            itemId: resident.itemId, departingId: resident.departingId }));
    }

    private visitItem(item: IslandStageItem, reduced = this.motion.matches, continueWalking = false) {
        const items = this.state?.items ?? [], landAccess = this.landAccess;
        const now = performance.now();
        const walking = continueWalking && !this.sharedActivity.plan && this.residents.find(resident => resident.group.visible
            && resident.itemId === item.id && resident.action === 'walk');
        if (walking) {
            this.lastResident = walking;
            return walking;
        }
        this.clearOrdinaryInterest();
        this.sharedActivity.cancel(now);
        if (this.sharedCamera) { this.sharedCamera = undefined; this.resize(); }
        this.residents.forEach(resident => resident.stopWalking(now));
        const choice = chooseReachableResident(this.residentCandidates(), item, items, landAccess, this.lastChosenResident);
        if (!choice) { this.callbacks.caption('どうぶつが とおれる すきまを あけて みよう'); return undefined; }
        const resident = this.residents[choice.index];
        const visiting = choice.replay ? resident.replayUse(now, reduced)
            : resident.visit(item, now, reduced, items, landAccess, choice.route);
        if (!visiting) return undefined;
        this.lastChosenResident = choice.index;
        this.lastResident = resident;
        this.beginOrdinaryInterest(resident, item);
        if (resident.action === 'walk') this.callbacks.caption(`${RESIDENT_NAMES[resident.species]}が あそびに とことこ`);
        return resident;
    }

    private beginOrdinaryInterest(resident: IslandResident, item: IslandStageItem) {
        this.clearOrdinaryInterest();
        const model = this.items.get(item.id);
        if (!model || !isResidentInterestItem(item.kind) || this.state?.learning || this.state?.preview || this.sharedActivity.plan) return;
        const anchor = getFurnitureAnchors(item.kind).look;
        model.group.updateWorldMatrix(true, false);
        this.ordinaryInterest = { resident, model, target: model.group.localToWorld(new THREE.Vector3(anchor.x, anchor.y, anchor.z)) };
    }

    private clearOrdinaryInterest() {
        const interest = this.ordinaryInterest;
        if (interest) {
            interest.resident.clearLearningPose();
            applyFurnitureInterest(interest.model.group, 0);
        }
        this.ordinaryInterest = undefined;
        this.interestObservation = undefined;
    }

    private observeInterest(context: 'visit' | 'learning', resident: IslandResident, itemId: string,
        phase: number, sample: ResidentInterestSample, target: THREE.Vector3) {
        this.interestObservation = { context, itemId, species: resident.species, phase, reduced: this.motion.matches, sample,
            target: target.toArray(), head: [resident.head.rotation.x, resident.head.rotation.y, resident.head.rotation.z],
            hands: { left: resident.handAnchor(undefined, 'left').toArray(), right: resident.handAnchor(undefined, 'right').toArray() } };
    }

    private applyOrdinaryInterest() {
        const interest = this.ordinaryInterest;
        if (!interest) return false;
        const { resident, model, target } = interest;
        if (this.items.get(model.item.id) !== model || resident.itemId !== model.item.id) { this.clearOrdinaryInterest(); return false; }
        if (resident.action === 'walk') return false;
        if (!canShowOrdinaryInterest({ kind: model.item.kind, action: resident.action,
            visible: resident.group.visible && model.group.visible, learning: Boolean(this.state?.learning), editing: Boolean(this.state?.preview),
            shared: Boolean(this.sharedActivity.plan), clearing: this.furnitureClearance.active })) {
            this.clearOrdinaryInterest(); return false;
        }
        const sample = sampleResidentInterest(resident.species, resident.usePhase, this.motion.matches);
        resident.respondToInterest(sample, target);
        applyFurnitureInterest(model.group, sample.life, this.motion.matches);
        this.observeInterest('visit', resident, model.item.id, resident.usePhase, sample, target);
        return Boolean(sample.look || sample.lowPaw || sample.headPitch || sample.headRoll);
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
        if (this.westExpansion.visible) targets.push({ id: 'west-grove', kind: 'tree', point: new THREE.Vector3(-6.7, .7, -1.02) });
        const visible = targets.filter(target => this.visiblePoint(target.point));
        if (!visible.length) {
            const roots = { id: 'tree', kind: 'tree' as const, group: this.tree, point: new THREE.Vector3(1.6, .22, -1.0) };
            if (this.visiblePoint(roots.point)) visible.push(roots);
        }
        return visible;
    }

    private currentGrowthLight(targets: LightTarget[], earnedTarget?: IslandStageState['growthTarget']) {
        const habitat = earnedTarget ?? this.state?.growthTarget ?? this.state?.growth?.focus;
        if (!habitat) return undefined;
        const visible = targets.find(target => this.items.get(target.id)?.item.habitatId === habitat);
        if (visible) return visible;
        // The reserved place can be stored or outside this fixed learning view.
        // Show its earned light at one stable screen-edge marker instead of
        // falsely making an unrelated flower/tree respond or moving the camera.
        const depth = this.learningFocus.clone().project(this.camera).z;
        const point = new THREE.Vector3(.56, .35, depth).unproject(this.camera);
        return { id: `growth:${habitat}`, kind: 'growth' as const, habitatId: habitat, point };
    }

    private placeCycleAccent() {
        const targets = this.lightTargets();
        const target = this.currentGrowthLight(targets) ?? targets.find(candidate => candidate.id === 'tree') ?? targets.find(candidate => candidate.kind === 'lantern') ?? targets[0];
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

    private startReaction(id: string, kind: LearningReactionKind, beat: LearningBeat, earnedTarget?: IslandStageState['growthTarget']) {
        this.clearOrdinaryInterest();
        this.clearReaction();
        const targets = this.lightTargets(), count = this.state?.learningProgress?.completed ?? this.state?.pulse ?? 0;
        const preferred = beat === 'complete' ? 'tree' : count % 3 === 1 ? 'flower' : count % 3 === 2 ? 'lantern' : 'tree';
        const residents = this.residents.filter(resident => resident.group.visible
            && this.visiblePoint(resident.group.position.clone().add(new THREE.Vector3(0, .85, 0)), .04));
        const fallbackResident = residents[0];
        const target = this.currentGrowthLight(targets, earnedTarget) ?? targets.find(candidate => candidate.kind === preferred) ?? targets[0] ?? (fallbackResident ? {
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
        if (this.state?.readOnly && this.state.comparisonHabitat) {
            fitIslandComparisonCamera(this.camera, this.state.comparisonHabitat, aspect);
            this.requestFrame(); return;
        }
        const expanded = this.expansion.visible, western = this.westExpansion.visible;
        const district = this.state?.districtFocus ?? 'all';
        const districtX = district === 'east' && expanded ? ISLAND_EAST_LAND.x - .5 : district === 'west' && western ? ISLAND_WEST_LAND.x : district === 'home' ? 0 : western ? 0 : expanded ? 1.3 : -.08;
        const target = this.state?.learning ? this.learningFocus.clone() : new THREE.Vector3(districtX, .85, -.03);
        if (this.state?.learning && height < 130) target.y -= .18;
        this.camera.position.copy(target).add(new THREE.Vector3(4.7, 8.8, 13.5));
        this.camera.lookAt(target); this.camera.updateMatrixWorld(true);
        if (this.state?.learning) {
            const widthInWorld = width < 600 ? 7.2 : 9.5;
            fitLearningFrame(this.camera, this.learningBounds, aspect, widthInWorld);
            this.placeCycleAccent(); this.requestFrame(); return;
        }
        if (this.sharedCamera && this.sharedActivity.plan) {
            const frame = this.fitSharedFrame();
            if (frame) {
                this.sharedCamera.from = this.sharedCamera.to = frame;
                this.applySharedFrame(frame); this.requestFrame(); return;
            }
        }
        if (district !== 'all') {
            const land = district === 'east' ? ISLAND_EAST_LAND : ISLAND_WEST_LAND;
            const widthInWorld = district === 'home' ? 9.9 : land.radiusX * 2.6;
            const fitHeight = Math.max(district === 'home' ? 7.2 : land.radiusZ * 2.2, widthInWorld / aspect);
            this.camera.left = -fitHeight * aspect / 2; this.camera.right = fitHeight * aspect / 2;
            this.camera.top = fitHeight / 2; this.camera.bottom = -fitHeight / 2;
            this.camera.updateProjectionMatrix(); this.requestFrame(); return;
        }
        const points: THREE.Vector3[] = [];
        const lands = getIslandLands(this.landAccess);
        for (let i = 0; i < ISLAND_SHORE_RIM.segments; i++) {
            const a = i / ISLAND_SHORE_RIM.segments * Math.PI * 2, rim = shoreContour(a) + ISLAND_SHORE_RIM.offset;
            for (const land of lands) points.push(new THREE.Vector3(land.x + Math.cos(a) * land.radiusX * rim,
                ISLAND_SHORE_RIM.height + Math.sin(a * 4 + .2) * ISLAND_SHORE_RIM.ripple,
                land.z + Math.sin(a) * land.radiusZ * rim));
        }
        points.push(new THREE.Vector3(-3.1, 2.75, -2), new THREE.Vector3(1.3, 4.8, -1.65),
            new THREE.Vector3(-1.4, 0, 4.45), new THREE.Vector3(3.46, 3.3, -1.65));
        if (western) points.push(new THREE.Vector3(-6.7, 3.2, -1.2));
        for (const model of this.items.values()) points.push(...boxCorners(new THREE.Box3().setFromObject(model.group, true)));
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

    private fitSharedFrame(plan = this.sharedActivity.plan) {
        const source = plan && this.items.get(plan.source.id), seat = plan && this.items.get(plan.seat.id);
        if (!plan || !source || !seat) return undefined;
        return fitSharedActivityFrame(plan, { carrier: this.residents[plan.carrier].group, receiver: this.residents[plan.receiver].group,
            source: source.group, seat: seat.group, residents: this.residents, completedSets: this.state?.completedSets ?? 0, landAccess: this.landAccess,
            viewportWidth: Math.max(1, this.host.clientWidth),
            presentationHands: plan === this.sharedActivity.plan ? this.sharedActivity.presentationHands : undefined,
            occluders: [this.scenery, this.tree, this.expansion, this.lighthouse,
                ...this.residents.filter((resident, index) => resident.group.visible && index !== plan.carrier && index !== plan.receiver)
                    .map(resident => resident.group),
                ...[...this.items.values()].filter(model => model.item.id !== plan.source.id && model.item.id !== plan.seat.id)
                    .map(model => model.group)] }, Math.max(1, this.host.clientWidth) / Math.max(1, this.host.clientHeight));
    }

    private chooseSharedPresentation(plan: SharedActivityPlan) {
        const first = this.fitSharedFrame(plan);
        if (!first) return undefined;
        // Keep an already-readable path without even searching other routes.
        const plans = first.visibilityDiagnostics?.readabilitySatisfied ? [plan] as [SharedActivityPlan]
            : sharedActivityDeliveryPlans(plan, this.state?.items ?? [], this.residentCandidates(), this.landAccess);
        const chosen = chooseSharedActivityPresentation(plans, candidate => candidate === plan ? first : this.fitSharedFrame(candidate)!);
        this.sharedPresentation = { pairId: plan.pairId, attemptedPlans: chosen.attemptedPlans, satisfied: chosen.satisfied,
            handoffPoint: chosen.plan.handoffPoint, deliveryRoute: chosen.plan.deliveryRoute,
            ...(!chosen.satisfied ? { fallback: 'ordinary' as const } : {}) };
        return chosen;
    }

    private installSharedCamera(plan: SharedActivityPlan, to: SharedActivityFrame, now: number) {
        this.sharedCamera = { pairId: plan.pairId, startedAt: now, to, from: { position: this.camera.position.clone(),
            quaternion: this.camera.quaternion.clone(), left: this.camera.left, right: this.camera.right,
            top: this.camera.top, bottom: this.camera.bottom } };
    }

    private fallbackSharedToOrdinary(plan: SharedActivityPlan, now: number) {
        const resident = this.residents[plan.carrier];
        this.sharedActivity.cancel(now);
        // The carrier has actually arrived at the source. Resume that ordinary
        // use in place. A motion-preference change can arrive earlier; in that
        // case preflight an ordinary visit from everyone's actual stopped roots.
        const visitor = resident.itemId === plan.source.id && resident.replayUse(now, this.motion.matches)
            ? resident : this.visitItem(plan.source, this.motion.matches, true);
        if (visitor) this.beginOrdinaryInterest(visitor, plan.source);
        if (this.livingVisit && this.state?.growth) {
            this.livingVisit = livingVisitsForItem(plan.source).find(visit => !visit.shared && !visit.nature
                && !['home-visit', 'terrace-time'].includes(visit.discoveryId));
            this.livingResidents = visitor ? [visitor] : []; this.livingArrivedAt = 0;
        }
        const request = this.state?.playRequest;
        if (request) {
            this.playResult = visitor
                ? { requestId: request.id, itemId: request.itemId, status: 'playing', resident: visitor.species }
                : { requestId: request.id, itemId: request.itemId, status: 'blocked', reason: 'unreachable' };
            this.callbacks.playResult?.(this.playResult);
        }
        if (!visitor) this.callbacks.caption('どうぶつが とおれる すきまを あけて みよう');
    }

    private applySharedFrame(frame: SharedActivityFrame) {
        this.camera.position.copy(frame.position); this.camera.quaternion.copy(frame.quaternion);
        this.camera.left = frame.left; this.camera.right = frame.right; this.camera.top = frame.top; this.camera.bottom = frame.bottom;
        this.camera.updateMatrixWorld(true); this.camera.updateProjectionMatrix();
    }

    private updateSharedCamera(now: number) {
        const plan = this.sharedActivity.plan, phase = this.sharedActivity.phase;
        if (!plan || !phase || phase === 'receiver-walk' || phase === 'gather-walk') return false;
        if (!this.sharedCamera) {
            const chosen = this.chooseSharedPresentation(plan);
            if (!chosen?.satisfied || !chosen.frame.presentationHands
                || !this.sharedActivity.setPresentation(chosen.plan, chosen.frame.presentationHands)) {
                this.fallbackSharedToOrdinary(plan, now);
                return false;
            }
            this.sharedActivity.update(now, this.motion.matches);
            this.installSharedCamera(chosen.plan, chosen.frame, now);
        }
        const camera = this.sharedCamera;
        if (!camera) return false;
        const { from, to, startedAt } = camera;
        const t = this.motion.matches ? 1 : Math.min(1, (now - startedAt) / 350), eased = t * t * (3 - 2 * t);
        this.camera.position.lerpVectors(from.position, to.position, eased);
        this.camera.quaternion.slerpQuaternions(from.quaternion, to.quaternion, eased);
        this.camera.left = THREE.MathUtils.lerp(from.left, to.left, eased);
        this.camera.right = THREE.MathUtils.lerp(from.right, to.right, eased);
        this.camera.top = THREE.MathUtils.lerp(from.top, to.top, eased);
        this.camera.bottom = THREE.MathUtils.lerp(from.bottom, to.bottom, eased);
        this.camera.updateMatrixWorld(true); this.camera.updateProjectionMatrix();
        return t < 1;
    }

    private pointerDown = (event: PointerEvent) => {
        if (event.button !== 0 || this.state?.readOnly) return;
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
        if (!this.state?.preview || this.state.readOnly || this.pointerStart?.id !== event.pointerId) return;
        if (Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y) > 3) this.movePreviewToPointer(event);
    };
    private pointerUp = (event: PointerEvent) => {
        const start = this.pointerStart;
        this.pointerStart = undefined;
        if (this.renderer.domElement.hasPointerCapture(event.pointerId)) this.renderer.domElement.releasePointerCapture(event.pointerId);
        if (!start || start.id !== event.pointerId || event.button !== 0 || !this.state || this.state.readOnly) return;
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
        event.preventDefault(); this.sharedActivity.cancel(performance.now()); this.furnitureClearance.cancel(performance.now());
        this.deferredPlay = undefined; this.lost = true; this.pause();
        this.host.dataset.renderer = 'fallback'; this.callbacks.failure();
    };
    private motionChanged = () => {
        const ordinary = this.ordinaryInterest;
        this.clearOrdinaryInterest();
        if (this.motion.matches) {
            const now = performance.now(), plan = this.sharedActivity.plan;
            if (plan && !this.sharedActivity.presentationHands) {
                const chosen = this.chooseSharedPresentation(plan);
                const hands = chosen?.frame.presentationHands;
                if (chosen?.satisfied && hands && (this.sharedActivity.prepareReducedPresentation(chosen.plan, hands)
                    || this.sharedActivity.setPresentation(chosen.plan, hands))) this.installSharedCamera(chosen.plan, chosen.frame, now);
                else this.fallbackSharedToOrdinary(plan, now);
            }
            for (const resident of this.residents) resident.update(now + 10000);
        }
        if (ordinary) this.beginOrdinaryInterest(ordinary.resident, ordinary.model.item);
        this.requestFrame();
    };
    private visibilityChanged = () => { if (document.hidden) this.pause(); else this.requestFrame(); };
    private pause() { this.cancelLivingActivity(performance.now()); this.clearOrdinaryInterest(); cancelAnimationFrame(this.frame); this.frame = 0; window.clearTimeout(this.idleTimer); }
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
        this.interestObservation = undefined;
        let moving = false;
        for (const resident of this.residents) {
            if (!resident.group.visible) continue;
            if (this.state?.readOnly) continue;
            resident.clearSharedPose();
            resident.clearLearningPose();
            moving = resident.update(now) || moving;
        }
        const wasClearing = this.furnitureClearance.active;
        moving = this.furnitureClearance.update(now, this.motion.matches) || moving;
        if (wasClearing && !this.furnitureClearance.active) {
            if (!this.state?.learning && !this.state?.preview) this.finishPendingActivity();
        }
        // A drained invitation can begin an ordinary walk after the base loop.
        // Keep drawing it immediately instead of waiting for the idle timer.
        moving = this.residents.some(resident => resident.group.visible && resident.action === 'walk') || moving;
        moving = this.sharedActivity.update(now, this.motion.matches) || moving;
        this.residents.forEach((resident, index) => this.residentShadows[index].position.set(resident.group.position.x, .025, resident.group.position.z));
        moving = this.updateSharedCamera(now) || moving;
        for (const model of this.items.values()) applyFurnitureUse(model.group, 0);
        for (const resident of this.residents) {
            const model = resident.itemId ? this.items.get(resident.itemId) : undefined;
            if (model && resident.action === 'swing') applyFurnitureUse(model.group, resident.usePhase);
        }
        const ordinaryInterestActive = this.applyOrdinaryInterest();
        moving = this.updateLivingActivity(now) || moving;
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
                if (reaction.kind === 'correct') {
                    const arrival = reaction.target.kind === 'growth' && reaction.target.habitatId
                        ? `${GROWTH_PLACE_NAMES[reaction.target.habitatId]}に ひかり${reaction.beat === 'complete' ? 'が そろった' : 'が とどいた'}`
                        : reaction.beat === 'complete' ? 'ひかりが そろった' : reaction.target.kind === 'flower' ? 'おはなに ひかり'
                        : reaction.target.kind === 'lantern' ? 'あかりが きらり' : reaction.target.kind === 'fountain' ? 'みずが きらり'
                            : reaction.target.kind === 'resident' ? 'ひかりが とどいた' : 'きに ひかり';
                    this.callbacks.caption(reaction.resident ? `${arrival}。${RESIDENT_NAMES[reaction.resident.species]}が ${residentInterestVerb(reaction.resident.species, this.motion.matches)}` : arrival);
                }
            }
            this.applyLife(sampled.paw);
            if (reaction.resident && (sampled.paw || sampled.look)) {
                if (reaction.kind === 'correct') {
                    const interest = sampleResidentInterest(reaction.resident.species, sampled.reply, this.motion.matches);
                    reaction.resident.respondToInterest(interest, reaction.target.point);
                    this.observeInterest('learning', reaction.resident, reaction.target.id, sampled.reply, interest, reaction.target.point);
                } else reaction.resident.respondToLearning(reaction.kind, sampled.paw, sampled.look, reaction.target.point);
                residentReply = reaction.kind === 'correct' ? 'delight' : 'listen';
            }
            moving = sampled.moving || moving;
        }
        if (!this.motion.matches && !this.state?.learning && !this.state?.readOnly && !this.sharedActivity.plan && !ordinaryInterestActive) {
            const idleElapsed = now - this.idleStart;
            if (idleElapsed < 1350 && this.residents[1].action !== 'walk') {
                this.residents[1].head.rotation.z = Math.sin(idleElapsed / 1350 * Math.PI * 2) * .095;
                moving = true;
            }
        }
        this.placementOcclusion.update(this.placementPreview.group,
            [...this.residents.map(resident => resident.group), ...[...this.items.values()].map(model => model.group)], this.camera,
            [this.tree, ...(this.westExpansion.visible ? [this.westExpansion] : [])]);
        this.renderer.render(this.scene, this.camera);
        this.recordRenderedDiscoveries();
        this.host.dataset.drawCount = String(++this.drawCount);
        this.host.dataset.residentCandidate = this.residents[0].pose.userData.visualCandidate ?? 'original-animals-v1';
        this.renderer.domElement.dataset.residentCandidate = this.host.dataset.residentCandidate;
        this.host.dataset.frameTimestamp = String(now);
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
        const observed = new Set(['starter-flower', 'starter-lantern', ...(this.state?.growth ? this.state.items.map(item => item.id) : []), this.previewItem?.id,
            this.reaction?.target.id, this.lastResident?.itemId, this.sharedActivity.plan?.source.id, this.sharedActivity.plan?.seat.id]);
        this.host.dataset.furnitureState = JSON.stringify([...this.items.values()].filter(model => observed.has(model.item.id)).map(({item, group}) => {
            let emissive: number | undefined;
            group.getObjectByName('lantern-light')?.traverse(child => {
                if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial && child.material.userData.islandOwned) {
                    emissive = child.material.emissiveIntensity;
                }
            });
            return { id: item.id, kind: item.kind, visible: group.visible, rootScale: group.scale.toArray(),
                growthLevel: item.growthLevel, appearanceLevel: item.appearanceLevel ?? item.growthLevel,
                growthVisualKey: group.userData.growthVisualKey,
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
        const cosmetics = this.world.cosmetics;
        for (const element of [this.host, this.renderer.domElement]) {
            element.dataset.islandTheme = cosmetics.themeId;
            element.dataset.islandAccent = cosmetics.accentId ?? 'none';
            element.dataset.customizationCandidate = ISLAND_CUSTOMIZATION_CANDIDATE;
        }
        this.host.dataset.expanded = String(this.expansion.visible);
        this.host.dataset.westExpanded = String(this.westExpansion.visible);
        this.host.dataset.districtFocus = this.state?.districtFocus ?? 'all';
        this.host.dataset.comparisonHabitat = this.state?.comparisonHabitat ?? '';
        this.host.dataset.readOnly = String(Boolean(this.state?.readOnly));
        this.host.dataset.livingActivity = JSON.stringify(this.livingVisit ? { discoveryId: this.livingVisit.discoveryId,
            itemId: this.livingVisit.item.id, startedAt: this.livingStartedAt, arrivedAt: this.livingArrivedAt,
            residents: this.livingResidents.map(resident => resident.species), natureVisible: this.nature.group.visible } : null);
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
            departingId: resident.departingId,
            frameBounds: this.state?.learning ? (() => {
                const points = boxCorners(new THREE.Box3().setFromObject(resident.group)).map(point => point.project(this.camera));
                const bounds = new THREE.Box3().setFromPoints(points);
                return { left: bounds.min.x, right: bounds.max.x, bottom: bounds.min.y, top: bounds.max.y };
            })() : undefined,
        })));
        this.host.dataset.playRequestId = this.playResult?.requestId ?? '';
        this.host.dataset.playStatus = this.playResult?.status ?? '';
        this.host.dataset.playReason = this.playResult?.reason ?? '';
        this.host.dataset.sharedActivity = JSON.stringify(this.sharedActivity.snapshot());
        this.host.dataset.furnitureClearance = JSON.stringify(this.furnitureClearance.snapshot());
        this.host.dataset.sharedCamera = this.sharedCamera?.pairId ?? '';
        this.host.dataset.sharedCameraDiagnostics = JSON.stringify(this.sharedCamera?.to.visibilityDiagnostics ?? null);
        this.host.dataset.sharedPresentation = JSON.stringify(this.sharedPresentation ?? null);
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
        this.host.dataset.residentInterest = JSON.stringify(this.interestObservation ?? null);
        this.host.dataset.sectionId = this.displayedProgress?.sectionId ?? '';
        this.host.dataset.sectionCompleted = String(this.displayedProgress?.completed ?? 0);
        this.host.dataset.sectionTotal = String(this.displayedProgress?.total ?? 0);
        this.host.dataset.cameraFrame = [...this.camera.matrixWorld.elements, ...this.camera.projectionMatrix.elements].map(value => value.toFixed(5)).join(',');
        this.host.dataset.frameCpuMs = (performance.now() - drawStarted).toFixed(3);
        if (this.drawCount === 1) this.callbacks.ready?.();
        if (moving && !this.motion.matches && !this.state?.readOnly) this.requestFrame();
        else if (!this.state?.learning && !this.state?.readOnly && (!this.motion.matches || this.state?.growth)) {
            const due = this.livingVisit ? this.livingArrivedAt ? this.livingArrivedAt + 6100 : performance.now() + 200
                : this.state?.growth ? this.nextLivingAt : performance.now() + 9000;
            this.idleTimer = window.setTimeout(() => { this.idleStart = performance.now(); this.requestFrame(); }, Math.max(100, due - performance.now()));
        }
    };

    dispose() {
        this.disposed = true; this.pause();
        this.sharedActivity.cancel(performance.now());
        this.furnitureClearance.cancel(performance.now());
        this.deferredPlay = undefined;
        this.observer.disconnect(); this.visibilityObserver.disconnect();
        document.removeEventListener('visibilitychange', this.visibilityChanged);
        this.motion.removeEventListener('change', this.motionChanged);
        this.renderer.domElement.removeEventListener('pointerup', this.pointerUp);
        this.renderer.domElement.removeEventListener('pointerdown', this.pointerDown);
        this.renderer.domElement.removeEventListener('pointermove', this.pointerMove);
        this.renderer.domElement.removeEventListener('pointercancel', this.pointerCancel);
        this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
        this.placementOcclusion.restore();
        this.placementPreview.dispose();
        this.sharedVisuals.dispose();
        this.nature.dispose();
        this.world.dispose();
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
