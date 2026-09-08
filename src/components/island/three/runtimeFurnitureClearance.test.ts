import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IslandScene } from './runtime';
import { IslandResident } from './animals';
import { FurnitureClearanceController } from './furnitureClearanceController';
import { OptionalFurnitureController } from './optionalFurnitureController';
import type { OptionalFurnitureTrialResolution } from './optionalFurnitureTrial';
import { optionalFootprintClearsCircle, optionalFootprintsAreSeparate, optionalResidentFootprint } from './optionalFurnitureNavigation';
import { IslandCosmeticScenery } from './cosmeticScenery';
import { IslandExpressionEnvironment } from './expressionEnvironment';
import { IslandPersonalScenery } from './personalScenery';
import { IslandPlacementOcclusion } from './placementOcclusion';
import { IslandHomePresentation, ISLAND_HOME_INTERIOR } from './homePresentation';
import { IslandLearningKeepsakeScenery } from './learningKeepsakeScenery';
import { IslandMaterials, disposeGeometry } from './primitives';
import { createIsland, getIslandLandAccess, ISLAND_ITEMS } from '../../../domain/island/catalog';
import type { IslandStageItem, IslandStageState } from './types';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

interface RuntimeBoundary {
    state: IslandStageState;
    update(state: IslandStageState): void;
    updateFurnitureTrial(state: IslandStageState): void;
    advanceTrialSearch(): void;
    furnitureTrial?: { item: IslandStageItem; group: THREE.Group };
    trialSearch?: { checked: number };
    trialResolution?: OptionalFurnitureTrialResolution;
    clearanceDirty: boolean;
}

/** Fixed16 furniture-05 saved items/root positions. Child poses are generated
 * by the real rig and real escape animation, not claimed as recorded poses.
 * Only unrelated presentation controllers and WebGL scheduling are inert. */
function fixture() {
    vi.stubGlobal('document', { hidden: false });
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const state: IslandStageState = { ...createIsland('furniture-clearance-runtime', 0), completedSets: 25,
        pulse: 0, learning: false, items: [
            { id: 'starter-flower', kind: 'flower', position: { x: 1.5, z: .8 }, rotation: 0, habitatId: 'garden', growthLevel: 3 },
            { id: 'starter-lantern', kind: 'lantern', position: { x: -1, z: .25 }, rotation: 0, habitatId: 'village', growthLevel: 0 },
            { id: 'living-bench', kind: 'bench', position: { x: -.1, z: 1 }, rotation: 1.6951513213416582, habitatId: 'garden', growthLevel: 3 },
            { id: 'living-fountain', kind: 'fountain', position: { x: 3.4, z: 1.3 }, rotation: 0, habitatId: 'waterside', growthLevel: 2 },
            { id: 'living-swing', kind: 'swing', position: { x: 6.2, z: 1.15 }, rotation: -1.5172760583355815, habitatId: 'waterside', growthLevel: 2 },
        ] };
    state.growth = { ...state.growth!, expansionLevel: 1, focus: 'waterside', progress: { garden: 6, waterside: 4, grove: 0, village: 0 } };
    const scene = new THREE.Scene(), materials = new IslandMaterials(), world = new IslandCosmeticScenery();
    scene.add(world.group); scene.background = world.background;
    const sun = new THREE.DirectionalLight(), hemisphere = new THREE.HemisphereLight(); scene.add(sun, hemisphere);
    const environment = new IslandExpressionEnvironment(scene, sun, hemisphere), occlusion = new IslandPlacementOcclusion();
    const personal = new IslandPersonalScenery(() => ({ getContext: () => null } as unknown as HTMLCanvasElement)); scene.add(personal.group);
    const homePresentation = new IslandHomePresentation(), keepsakeRoom = new IslandLearningKeepsakeScenery();
    keepsakeRoom.group.position.set(...ISLAND_HOME_INTERIOR.position); keepsakeRoom.group.scale.setScalar(ISLAND_HOME_INTERIOR.scale);
    scene.add(keepsakeRoom.group);
    const residents = [new IslandResident('otter', materials, [-1, 0, 2], vi.fn()),
        new IslandResident('rabbit', materials, [2.45, 0, 1.45], vi.fn()), new IslandResident('fox', materials, [6.75, 0, 0], vi.fn())];
    residents.forEach(resident => scene.add(resident.group));
    const clearance = new FurnitureClearanceController(residents, vi.fn()), optional = new OptionalFurnitureController(residents);
    const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .1, 100);
    const runtime = Object.create(IslandScene.prototype) as RuntimeBoundary;
    const groupController = () => ({ group: new THREE.Group(), update: vi.fn() });
    const items = new Map<string, { item: IslandStageItem; group: THREE.Group }>();
    Object.assign(runtime, { scene, materials, world, residents, personal, homePresentation, keepsakeRoom, expressionEnvironment: environment, placementOcclusion: occlusion,
        state, camera, host: { dataset: {} }, renderer: { shadowMap: { needsUpdate: false } },
        tree: world.tree, scenery: world.scenery, expansion: world.expansion, westExpansion: world.westExpansion, lighthouse: world.lighthouse,
        motion: { matches: false }, onscreen: true, clearanceDirty: false, furnitureClearance: clearance, optionalFurniture: optional,
        optionalAutonomousUntil: 0, workshopPresentation: { restore: vi.fn(), cancel: vi.fn() }, workshop: { group: new THREE.Group(), stop: vi.fn() },
        sharedActivity: { cancel: vi.fn() }, sharedJobs: { beforeUpdate: vi.fn(), afterUpdate: vi.fn() },
        sharedDisplays: groupController(), sharedPreview: groupController(), nature: groupController(), sharedVisuals: groupController(),
        optionalPlacement: { update: vi.fn() }, expressionWalk: { set: vi.fn(), cancel: vi.fn() }, expressionTrails: { clear: vi.fn() },
        items, pendingSpawns: new Set(), residentShadows: residents.map(() => new THREE.Group()), selection: new THREE.Group(),
        placementPreview: { update: vi.fn() }, cameraControls: { reset: vi.fn(), view: {} }, learningFocus: new THREE.Vector3(),
        callbacks: { caption: vi.fn(), cameraView: vi.fn() }, clearReaction: vi.fn(), clearOrdinaryInterest: vi.fn(), cancelLivingActivity: vi.fn(),
        finishPendingActivity: vi.fn(), setCycleProgress: vi.fn(), placeCycleAccent: vi.fn(), resize: vi.fn(), pointerCancel: vi.fn(), requestFrame: vi.fn() });
    runtime.update(state);
    const trial: IslandStageState = { ...state, furnitureTrial: { id: 'trial-telescope', kind: 'telescope', position: { x: -1, z: 2.5 }, rotation: 0 },
        furnitureTrialChoice: { residentId: 'rabbit' } };
    return { state, trial, runtime, residents, clearance, optional,
        tick(now: number) { residents.forEach(resident => resident.update(now)); clearance.update(now, false); },
        finish() {
            for (let now = 400; now <= 1600; now += 20) { this.tick(now); runtime.advanceTrialSearch(); }
            expect(clearance.snapshot()).toMatchObject({ active: false, phase: 'settled', blocked: [], completed: [1] });
            for (let i = 0; runtime.trialSearch && i < 1000; i++) runtime.advanceTrialSearch();
            expect(runtime.trialSearch).toBeUndefined();
        },
        clean() {
            optional.cancel(30000); clearance.cancel(30000); occlusion.restore(); environment.dispose(); homePresentation.dispose(); keepsakeRoom.dispose(); personal.dispose(); world.dispose();
            residents.forEach(resident => { resident.disposeAppearance(); disposeGeometry(resident.group); });
            items.forEach(model => disposeGeometry(model.group)); if (runtime.furnitureTrial) disposeGeometry(runtime.furnitureTrial.group); materials.dispose();
        } };
}

function beginEscape(f: ReturnType<typeof fixture>) {
    expect(f.clearance.start(f.state.items, getIslandLandAccess(f.state), 0, false)).toBe(true);
    expect(f.clearance.snapshot()?.current).toMatchObject({ index: 1, species: 'rabbit', action: 'walk',
        route: { points: [{ x: 2.45, z: 1.45 }, { x: 2.5, z: 2.5 }] } });
    // Solve the recorded along-route fraction through the animation's smoothstep.
    // This reaches the failed root by walking; no actor position is assigned.
    const fraction = (1.755846971443078 - 1.45) / 1.05;
    let low = 0, high = 1;
    for (let i = 0; i < 50; i++) { const middle = (low + high) / 2; if (middle * middle * (3 - 2 * middle) < fraction) low = middle; else high = middle; }
    f.tick((low + high) / 2 * 1050);
    expect(f.residents[1].group.position.x).toBeCloseTo(2.4645641414972896, 10);
    expect(f.residents[1].group.position.z).toBeCloseTo(1.755846971443078, 10);
    expect(f.residents[1].departingId).toBeUndefined();
}

describe('runtime trial preparation waits for actual saved-furniture clearance', () => {
    it('keeps the recorded rabbit walking, then resolves and uses the same choice from the real endpoint', () => {
        const f = fixture(), saved = structuredClone(f.state), uuid = f.residents[1].group.uuid;
        try {
            beginEscape(f);
            const atEntry = f.residents.map(resident => resident.group.position.toArray());
            const preflight = vi.spyOn(f.optional, 'canStart');
            f.runtime.update(f.trial);
            expect(f.residents[1].action).toBe('walk'); expect(f.clearance.active).toBe(true);
            expect(f.residents.map(resident => resident.group.position.toArray())).toEqual(atEntry);
            expect(f.runtime.furnitureTrial?.group.visible).toBe(false);
            for (let i = 0; i < 5; i++) f.runtime.advanceTrialSearch();
            expect(f.runtime.trialSearch?.checked).toBe(0); expect(preflight).not.toHaveBeenCalled();
            f.finish();
            expect(f.residents[1].group.position.toArray()).toEqual([2.5, 0, 2.5]);
            expect(f.residents[1].group.uuid).toBe(uuid); expect(f.runtime.trialResolution?.ready).toBe(true);
            expect(preflight).toHaveBeenCalled(); expect(preflight.mock.calls.every(([input]) => input.residentId === 'rabbit')).toBe(true);
            const model = f.runtime.furnitureTrial!;
            expect(f.optional.start({ ...model, requestId: 'same-rabbit-after-escape', residentId: 'rabbit', borrowed: true,
                items: f.state.items, land: getIslandLandAccess(f.state), now: 2000, reduced: false }).status).toBe('playing');
            let walkingFrames = 0;
            for (let now = 2000; now <= 18000; now += 40) {
                f.optional.update(now, false); f.optional.afterRender(() => true, now);
                if (f.optional.describe()?.phase !== 'walking') continue;
                walkingFrames++;
                const body = optionalResidentFootprint(f.residents[1].group);
                for (const item of f.state.items) expect(optionalFootprintClearsCircle(body,
                    { ...item.position!, radius: ISLAND_ITEMS[item.kind].radius })).toBe(true);
                for (const other of [f.residents[0], f.residents[2]]) expect(optionalFootprintsAreSeparate(body, optionalResidentFootprint(other.group))).toBe(true);
            }
            expect(walkingFrames).toBeGreaterThan(0);
            expect(f.optional.describe()).toMatchObject({ phase: 'settled', contactSeen: true, actorIds: ['rabbit'] });
            expect(f.residents[1].group.uuid).toBe(uuid); expect(f.state).toEqual(saved);
        } finally { f.clean(); }
    });

    it('starts newly required clearance before trial preparation on the same runtime update', () => {
        const f = fixture(), start = vi.spyOn(f.clearance, 'start'), trial = vi.spyOn(f.runtime, 'updateFurnitureTrial');
        const preflight = vi.spyOn(f.optional, 'canStart');
        try {
            f.runtime.clearanceDirty = true; f.runtime.update(f.trial);
            expect(start).toHaveBeenCalledOnce(); expect(trial).toHaveBeenCalledOnce();
            expect(start.mock.invocationCallOrder[0]).toBeLessThan(trial.mock.invocationCallOrder[0]);
            expect(f.residents[1].action).toBe('walk');
            f.runtime.advanceTrialSearch(); expect(preflight).not.toHaveBeenCalled();
            f.finish(); expect(f.runtime.trialResolution?.ready).toBe(true);
        } finally { f.clean(); }
    });

    it.each(['learning', 'exit', 'reselection'] as const)('discards the old waiting iterator on %s without moving the rabbit to finish', boundary => {
        const f = fixture(), saved = structuredClone(f.state), preflight = vi.spyOn(f.optional, 'canStart');
        try {
            beginEscape(f); f.runtime.update(f.trial);
            const point = f.residents[1].group.position.toArray(), old = f.runtime.trialSearch;
            const next = boundary === 'learning' ? { ...f.trial, learning: true }
                : boundary === 'exit' ? f.state : { ...f.trial, furnitureTrialChoice: { residentId: 'fox' as const } };
            f.runtime.update(next);
            expect(f.residents[1].group.position.toArray()).toEqual(point);
            expect(f.residents[1].action).toBe('walk');
            // Comparing generator-bearing objects with matcher deep-equality
            // suggestions can consume both iterators. Compare identity only.
            expect(Object.is(f.runtime.trialSearch, old)).toBe(false);
            f.runtime.advanceTrialSearch(); expect(preflight).not.toHaveBeenCalled();
            f.finish();
            if (boundary === 'reselection') {
                expect(preflight).toHaveBeenCalled();
                expect(preflight.mock.calls.every(([input]) => input.residentId === 'fox')).toBe(true);
            } else { expect(preflight).not.toHaveBeenCalled(); expect(f.runtime.furnitureTrial).toBeUndefined(); }
            expect(f.state).toEqual(saved);
        } finally { f.clean(); }
    });
});
