import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IslandScene } from './runtime';
import { IslandExpressionEnvironment } from './expressionEnvironment';
import { IslandCosmeticScenery } from './cosmeticScenery';
import { IslandPersonalScenery } from './personalScenery';
import { IslandPlacementOcclusion } from './placementOcclusion';
import { IslandHomePresentation, ISLAND_HOME_INTERIOR } from './homePresentation';
import { IslandLearningKeepsakeScenery } from './learningKeepsakeScenery';
import { IslandResident } from './animals';
import { ExpressionResidentWalk } from './expressionResidentWalk';
import { ExpressionFootTrails } from './expressionFootTrails';
import { IslandMaterials, disposeGeometry } from './primitives';
import { createIsland } from '../../../domain/island/catalog';
import { createIslandExpressionSelection } from '../../../domain/island/expression';
import { getIslandExperience } from '../../../domain/island/experience';
import type { IslandStageState } from './types';

afterEach(() => vi.unstubAllGlobals());

/** Execute the real runtime update/disposal boundary with real world/rig/material
 * objects. Only unrelated controllers and the browser/GPU scheduler are inert. */
function fixture() {
    vi.stubGlobal('document', { hidden: false, removeEventListener: vi.fn() });
    const state: IslandStageState = { ...createIsland('runtime-environment-fixture', 1), items: [], completedSets: 6, pulse: 0, learning: false, readOnly: true };
    state.growth = { ...state.growth!, expansionLevel: 1, progress: { garden: 6, waterside: 0, grove: 0, village: 0 } };
    const scene = new THREE.Scene(), world = new IslandCosmeticScenery(), materials = new IslandMaterials();
    scene.add(world.group); scene.background = world.background;
    const sun = new THREE.DirectionalLight('#fff1d1', 2.6), hemisphere = new THREE.HemisphereLight('#f4fbef', '#b7b184', 1.7);
    sun.position.set(-3, 9, 7); scene.add(sun, hemisphere);
    const environment = new IslandExpressionEnvironment(scene, sun, hemisphere), occlusion = new IslandPlacementOcclusion();
    const personal = new IslandPersonalScenery(() => ({ getContext: () => null } as unknown as HTMLCanvasElement)); scene.add(personal.group);
    const homePresentation = new IslandHomePresentation(), keepsakeRoom = new IslandLearningKeepsakeScenery();
    keepsakeRoom.group.position.set(...ISLAND_HOME_INTERIOR.position); keepsakeRoom.group.scale.setScalar(ISLAND_HOME_INTERIOR.scale);
    scene.add(keepsakeRoom.group);
    const residents = (['otter', 'rabbit', 'fox'] as const).map(id => new IslandResident(id, materials, [0, 0, 0], vi.fn()));
    residents.forEach(resident => scene.add(resident.group));
    const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .1, 100); camera.position.set(4, 8, 12); camera.lookAt(0, 1, 0); camera.updateMatrixWorld(true);
    const renderer = { shadowMap: { needsUpdate: false }, dispose: vi.fn(), forceContextLoss: vi.fn(), domElement: { removeEventListener: vi.fn(), remove: vi.fn() } };
    const runtime = Object.create(IslandScene.prototype) as { update(state: IslandStageState): void; dispose(): void; writeExpressionEnvironmentDiagnostics(): void };
    const host = { dataset: {} as Record<string, string> }, order: string[] = [];
    const groupController = () => ({ group: new THREE.Group(), update: vi.fn(), dispose: vi.fn() });
    Object.assign(runtime, { scene, world, materials, residents, personal, homePresentation, keepsakeRoom, expressionEnvironment: environment, placementOcclusion: occlusion, host, renderer, camera,
        state, tree: world.tree, scenery: world.scenery, expansion: world.expansion, westExpansion: world.westExpansion, lighthouse: world.lighthouse,
        motion: { matches: false, removeEventListener: vi.fn() }, workshopPresentation: { restore: vi.fn(), cancel: vi.fn() },
        workshop: { group: new THREE.Group(), stop: vi.fn(), dispose: vi.fn() }, optionalFurniture: { cancel: vi.fn() }, optionalAutonomousUntil: 0,
        sharedActivity: { cancel: vi.fn() }, furnitureClearance: { cancel: vi.fn(), active: false, learningFrameBounds: () => [] },
        sharedJobs: { beforeUpdate: vi.fn(), afterUpdate: vi.fn(), dispose: vi.fn() }, sharedDisplays: groupController(), sharedPreview: groupController(),
        nature: groupController(), sharedVisuals: groupController(), optionalPlacement: { update: vi.fn(), dispose: vi.fn() },
        expressionWalk: { set: vi.fn(), cancel: vi.fn(), dispose: vi.fn() }, expressionTrails: { clear: vi.fn(), dispose: vi.fn() },
        items: new Map(), pendingSpawns: new Set(), residentShadows: residents.map(() => new THREE.Group()),
        selection: new THREE.Group(), placementPreview: { update: vi.fn(), dispose: vi.fn() }, cameraControls: { reset: vi.fn(), view: {} },
        callbacks: { caption: vi.fn(), cameraView: vi.fn() }, learningFocus: new THREE.Vector3(),
        clearReaction: vi.fn(), clearOrdinaryInterest: vi.fn(), cancelLivingActivity: vi.fn(), updateFurnitureTrial: vi.fn(),
        finishPendingActivity: vi.fn(), setCycleProgress: vi.fn(), placeCycleAccent: vi.fn(), resize: vi.fn(), pointerCancel: vi.fn(), requestFrame: vi.fn(),
        pause: vi.fn(), observer: { disconnect: vi.fn() }, visibilityObserver: { disconnect: vi.fn() } });
    const originalRestore = occlusion.restore.bind(occlusion), originalEnvironmentRestore = environment.restore.bind(environment);
    vi.spyOn(occlusion, 'restore').mockImplementation(() => { order.push('occlusion'); originalRestore(); });
    vi.spyOn(environment, 'restore').mockImplementation(() => { order.push('environment'); originalEnvironmentRestore(); });
    const originalAppearance = world.updateAppearance.bind(world), originalGrowth = world.updateGrowth.bind(world);
    vi.spyOn(world, 'updateAppearance').mockImplementation(cosmetics => { order.push('appearance'); return originalAppearance(cosmetics); });
    vi.spyOn(world, 'updateGrowth').mockImplementation(next => { order.push('growth'); return originalGrowth(next); });
    return { runtime, state, scene, world, environment, occlusion, personal, camera, renderer, residents, host, order,
        clean() { environment.dispose(); homePresentation.dispose(); keepsakeRoom.dispose(); personal.dispose(); world.dispose(); residents.forEach(resident => { resident.disposeAppearance(); disposeGeometry(resident.group); }); materials.dispose(); } };
}

describe('runtime environment/flag ownership boundary', () => {
    it('restores occlusion then seasonal materials before appearance and growth rebuild, using the same camera and rig roots', () => {
        const f = fixture(), selection = createIslandExpressionSelection(); selection.environment = { period: 'evening', season: 'winter' };
        try {
            f.runtime.update({ ...f.state, expressionSelection: selection });
            expect(f.environment.describe().materialCount).toBeGreaterThan(0);
            const camera = f.camera.matrixWorld.toArray(), rigIds = f.residents.map(resident => resident.group.uuid);
            f.order.length = 0;
            f.runtime.update({ ...f.state, cosmetics: { themeId: 'candy', accentId: null }, expressionSelection: selection });
            expect(f.order.indexOf('occlusion')).toBeLessThan(f.order.indexOf('environment'));
            expect(f.order.indexOf('environment')).toBeLessThan(f.order.indexOf('appearance'));
            expect(f.order.indexOf('environment')).toBeLessThan(f.order.indexOf('growth'));
            expect(f.environment.describe()).toMatchObject({ period: 'evening', season: 'winter' });
            expect(f.camera.matrixWorld.toArray()).toEqual(camera); expect(f.residents.map(resident => resident.group.uuid)).toEqual(rigIds);
            f.runtime.update({ ...f.state, cosmetics: { themeId: 'candy', accentId: null } });
            expect(f.scene.background).toEqual(f.world.background); expect(f.environment.describe()).toMatchObject({ period: null, season: null, materialCount: 0 });
            expect(f.environment.describe().sun.position).toEqual([-3, 9, 7]);
        } finally { f.clean(); }
    });

    it('shows the actual trim even with default identity, reports its actual visibility, and keeps old memories bare', () => {
        const f = fixture(), selection = createIslandExpressionSelection(); selection.flagTrim = 'leaf-bird-flag-trim';
        try {
            f.runtime.update({ ...f.state, expressionSelection: selection }); f.runtime.writeExpressionEnvironmentDiagnostics();
            const trim = f.personal.group.getObjectByName('island-flag-leaf-bird-trim')!;
            expect(JSON.parse(f.host.dataset.islandExpressionFlag)).toEqual({ trim: 'leaf-bird-flag-trim', visible: true, uuid: trim.uuid });
            trim.visible = false; f.runtime.writeExpressionEnvironmentDiagnostics();
            expect(JSON.parse(f.host.dataset.islandExpressionFlag).visible).toBe(false);
            f.runtime.update({ ...f.state, cosmetics: { themeId: 'starry', accentId: null } }); f.runtime.writeExpressionEnvironmentDiagnostics();
            expect(f.personal.group.visible).toBe(false); expect(JSON.parse(f.host.dataset.islandExpressionFlag).trim).toBe(null);
            expect(JSON.parse(f.host.dataset.islandExpressionEnvironment).background).toBe(f.world.background.getHexString());
        } finally { f.clean(); }
    });

    it('does not overwrite captured look/flag/environment state or the learning camera when hidden learning receives a saved scene', () => {
        const f = fixture(), selection = createIslandExpressionSelection(); selection.environment = { period: 'morning', season: 'spring' }; selection.flagTrim = 'leaf-bird-flag-trim';
        const state = { ...f.state, learning: true, experience: getIslandExperience({}), expressionSelection: selection };
        const before = structuredClone(state); vi.stubGlobal('document', { hidden: true });
        try {
            f.runtime.update(state); const camera = f.camera.matrixWorld.toArray();
            f.runtime.update({ ...state, pulse: 1, learningProgress: { sectionId: 'same', completed: 1, total: 10 } });
            expect(state).toEqual(before); expect(f.camera.matrixWorld.toArray()).toEqual(camera);
            expect(f.environment.describe()).toMatchObject({ period: 'morning', season: 'spring' });
        } finally { f.clean(); }
    });

    it.each(['raincoat', 'star-beret'] as const)('restores each saved free look on the same three rigs after removing %s', outfit => {
        const f = fixture(), experience = getIslandExperience({}), selection = createIslandExpressionSelection();
        const rigIds = f.residents.map(resident => [resident.group.uuid, resident.body.uuid, resident.head.uuid]);
        try {
            for (const look of ['original', 'scarf', 'cap'] as const) {
                for (const resident of f.residents) {
                    experience.residents[resident.species].look = look;
                    selection.residents[resident.species] = { outfit, pattern: 'river-check', trail: null };
                }
                const saved = structuredClone({ experience, selection });
                f.runtime.update({ ...f.state, experience, expressionSelection: selection });
                for (const resident of f.residents) {
                    expect(resident.group.getObjectByName('resident-optional-scarf')!.visible).toBe(false);
                    expect(resident.group.getObjectByName('resident-optional-cap')!.visible).toBe(false);
                    expect(resident.group.getObjectByName(`expression-${outfit}`)!.visible).toBe(true);
                }
                const removed = structuredClone(selection);
                for (const resident of f.residents) removed.residents[resident.species].outfit = null;
                f.runtime.update({ ...f.state, experience, expressionSelection: removed });
                for (const resident of f.residents) {
                    expect(resident.group.getObjectByName('resident-optional-scarf')!.visible).toBe(look === 'scarf');
                    expect(resident.group.getObjectByName('resident-optional-cap')!.visible).toBe(look === 'cap');
                    expect(resident.group.getObjectByName('expression-raincoat')!.visible).toBe(false);
                    expect(resident.group.getObjectByName('expression-star-beret')!.visible).toBe(false);
                    expect(resident.group.getObjectByName('expression-pattern-cloth')!.visible).toBe(true);
                    expect(resident.expressionDiagnostic()).toMatchObject({ outfit: null, pattern: 'river-check' });
                }
                expect(f.residents.map(resident => [resident.group.uuid, resident.body.uuid, resident.head.uuid])).toEqual(rigIds);
                expect({ experience, selection }).toEqual(saved);
            }
        } finally { f.clean(); }
    });

    it.each(['learning', 'exit', 'selection-change'] as const)('cancels the actual walk and clears live foot marks on %s', boundary => {
        const f = fixture(), resident = f.residents[0], selection = createIslandExpressionSelection();
        resident.group.position.set(-1, 0, 2); selection.residents.otter.trail = 'leaf-trail';
        const walk = new ExpressionResidentWalk(f.residents), trails = new ExpressionFootTrails(f.residents);
        f.scene.add(trails.group); Object.assign(f.runtime, { expressionWalk: walk, expressionTrails: trails });
        const set = vi.spyOn(walk, 'set'), cancel = vi.spyOn(walk, 'cancel'), clear = vi.spyOn(trails, 'clear');
        const request = { id: `walk-before-${boundary}`, residentId: 'otter' as const };
        const active: IslandStageState = { ...f.state, expressionResidentId: 'otter', expressionWalkRequest: request, expressionSelection: selection };
        const saved = structuredClone(active), origin = resident.group.position.toArray(), rigId = resident.group.uuid;
        try {
            f.runtime.update(active);
            expect(set.mock.lastCall?.[0]?.request).toBe(request);
            for (let now = 0; now <= 700; now += 40) {
                walk.update(now, false);
                trails.update(selection, new Set(walk.walkingResidentId ? [walk.walkingResidentId] : []), 1, now, true, false);
            }
            expect(walk.describe()?.phase).toBe('walking');
            expect(trails.describe()[0].marks.some(mark => mark.visible)).toBe(true);
            expect(resident.group.position.toArray()).not.toEqual(origin);
            const marks = trails.describe(), poolIds = marks.flatMap(track => track.marks.map(mark => mark.uuid));
            cancel.mockClear(); clear.mockClear(); set.mockClear();
            // A read-only expression scene still permits its explicit walk;
            // an unrelated redraw must retain the same request and live marks.
            f.runtime.update({ ...active });
            expect(set.mock.lastCall?.[0]?.request).toBe(request);
            expect(cancel).not.toHaveBeenCalled(); expect(clear).not.toHaveBeenCalled();
            expect(trails.describe()).toEqual(marks);

            const next = { ...active };
            if (boundary === 'learning') next.learning = true;
            else if (boundary === 'exit') next.expressionResidentId = undefined;
            else { next.expressionSelection = structuredClone(selection); next.expressionSelection.residents.otter.outfit = 'raincoat'; }
            f.runtime.update(next);
            expect(cancel).toHaveBeenCalled(); expect(clear).toHaveBeenCalled();
            if (boundary !== 'selection-change') expect(set.mock.lastCall?.[0]).toBeUndefined();
            expect(walk.active).toBe(false);
            expect(trails.describe().every(track => !track.walking && track.marks.every(mark => !mark.visible))).toBe(true);
            expect(trails.describe().flatMap(track => track.marks.map(mark => mark.uuid))).toEqual(poolIds);
            expect(resident.group.uuid).toBe(rigId); expect(resident.group.position.toArray()).toEqual(origin);
            expect(active).toEqual(saved);
            // Returning with the stale request cannot silently restart a walk.
            f.runtime.update(active); expect(walk.active).toBe(false);
        } finally { walk.dispose(); trails.dispose(); f.clean(); }
    });

    it('does not pass a fresh walk request to the controller while the document is hidden', () => {
        const f = fixture(), set = vi.fn(); Object.assign(f.runtime, { expressionWalk: { set, cancel: vi.fn(), dispose: vi.fn() } });
        const request = { id: 'hidden-walk', residentId: 'otter' as const };
        try {
            vi.stubGlobal('document', { hidden: true });
            f.runtime.update({ ...f.state, expressionResidentId: 'otter', expressionWalkRequest: request });
            expect(set).toHaveBeenCalledOnce(); expect(set).toHaveBeenCalledWith(undefined);
        } finally { f.clean(); }
    });

    it('releases seasonal clones before the world can dispose their source materials', () => {
        const f = fixture(), selection = createIslandExpressionSelection(); selection.environment.season = 'autumn';
        f.runtime.update({ ...f.state, expressionSelection: selection });
        const originalDispose = f.world.dispose.bind(f.world);
        vi.spyOn(f.world, 'dispose').mockImplementation(() => {
            expect(f.environment.describe()).toMatchObject({ disposed: true, materialCount: 0, surfaceCount: 0 });
            originalDispose();
        });
        f.runtime.dispose();
        expect(f.renderer.dispose).toHaveBeenCalledOnce(); expect(f.environment.describe().disposed).toBe(true);
    });
});
