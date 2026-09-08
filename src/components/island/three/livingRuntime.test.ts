import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIsland } from '../../../domain/island/catalog';
import { getIslandGrowthTarget, growIslandAfterCompletedSet } from '../../../domain/island/growth';
import { IslandResident } from './animals';
import { fitIslandComparisonCamera, IslandScene } from './runtime';
import { findSafeResidentSpawn } from './navigation';
import { livingVisitsForItem, type LivingVisit } from './livingActivities';
import { IslandNatureVisuals } from './growthVisuals';
import { disposeGeometry, IslandMaterials } from './primitives';
import type { IslandStageState } from './types';

interface LivingHarness {
    state: IslandStageState;
    livingVisit?: LivingVisit;
    livingResidents: IslandResident[];
    livingStartedAt: number;
    livingArrivedAt: number;
    homePending?: unknown;
    reportedDiscoveries: Set<string>;
    visitHome(visit: LivingVisit): IslandResident | undefined;
    performPlay(play: NonNullable<IslandStageState['playRequest']>): unknown;
    updateLivingActivity(now: number): boolean;
    recordRenderedDiscoveries(): void;
    cancelLivingActivity(now: number): void;
}

interface GrowthLightHarness {
    currentGrowthLight(targets: { id: string; kind: string; point: THREE.Vector3; group?: THREE.Group }[], earnedTarget?: IslandStageState['growthTarget']):
        { id: string; kind: string; point: THREE.Vector3; group?: THREE.Group };
    finishPendingActivity(): void;
}

const resources: { materials: IslandMaterials; residents: IslandResident[]; nature: IslandNatureVisuals }[] = [];
afterEach(() => {
    vi.unstubAllGlobals();
    for (const resource of resources.splice(0)) {
        resource.residents.forEach(resident => disposeGeometry(resident.group));
        resource.nature.dispose(); resource.materials.dispose();
    }
});

function harness() {
    vi.stubGlobal('document', { hidden: false });
    let island = createIsland('living-runtime', 1);
    for (let section = 1; section <= 24; section++) island = growIslandAfterCompletedSet({ ...island, completedSets: section }, getIslandGrowthTarget(island), section + 1);
    const materials = new IslandMaterials(), occupied: THREE.Vector3[] = [];
    const residents = (['otter', 'rabbit', 'fox'] as const).map((species, i) => {
        const point = findSafeResidentSpawn([{ x: .1, z: 1.6 }, { x: 2.45, z: 1.45 }, { x: 6.26, z: .83 }][i], island.items, 24, occupied)!;
        const resident = new IslandResident(species, materials, [point.x, 0, point.z], () => undefined);
        occupied.push(resident.group.position); return resident;
    });
    const nature = new IslandNatureVisuals(materials), discovery = vi.fn();
    resources.push({ materials, residents, nature });
    const scene = Object.create(IslandScene.prototype) as LivingHarness;
    Object.assign(scene, { state: { items: island.items, growth: island.growth, completedSets: 24, learning: false, pulse: 0 },
        residents, nature, callbacks: { caption: vi.fn(), discovery }, motion: { matches: true }, onscreen: true,
        sharedActivity: { cancel: vi.fn(), continuesFor: () => false }, furnitureClearance: { active: false },
        reportedDiscoveries: new Set(), livingResidents: [], livingStartedAt: performance.now(), livingArrivedAt: 0,
        visiblePoint: () => true, items: new Map() });
    return { scene, residents, discovery };
}

describe('runtime life cancellation and actual observations', () => {
    it.each(['garden', 'waterside', 'grove', 'village', 'all'] as const)('uses exactly the same %s camera and world scale for past and present', habitat => {
        for (const aspect of [390 / 190, 1]) {
            const past = new THREE.OrthographicCamera(-10, 10, 6, -6, .1, 100);
            const present = new THREE.OrthographicCamera(-20, 20, 10, -10, .1, 100);
            past.position.set(-8, 3, 15); present.position.set(10, 7, 20);
            fitIslandComparisonCamera(past, habitat, aspect); fitIslandComparisonCamera(present, habitat, aspect);
            expect(present.matrixWorld.toArray()).toEqual(past.matrixWorld.toArray());
            expect(present.projectionMatrix.toArray()).toEqual(past.projectionMatrix.toArray());
        }
    });
    it('uses an honest fixed growth marker for offscreen or stored targets and preserves the captured target', () => {
        const scene = Object.create(IslandScene.prototype) as GrowthLightHarness;
        const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .1, 100);
        camera.position.set(4.7, 8.8, 13.5); camera.lookAt(0, .55, 0); camera.updateMatrixWorld(true);
        const matrix = camera.matrixWorld.toArray(), projection = camera.projectionMatrix.toArray();
        const flower = { id: 'flower', kind: 'flower', point: new THREE.Vector3(1.5, .5, .8), group: new THREE.Group() };
        Object.assign(scene, { camera, learningFocus: new THREE.Vector3(0, .55, 0),
            state: { growthTarget: 'village' }, items: new Map([[flower.id, { item: { habitatId: 'garden' } }]]) });
        for (const target of ['grove', 'waterside', 'village'] as const) {
            const light = scene.currentGrowthLight([flower], target);
            expect(light.id).toBe(`growth:${target}`); expect(light.kind).toBe('growth'); expect(light.group).toBeUndefined();
            const projected = light.point.clone().project(camera);
            expect(projected.x).toBeCloseTo(.56); expect(projected.y).toBeCloseTo(.35);
        }
        expect(scene.currentGrowthLight([], 'garden').id).toBe('growth:garden');
        expect(scene.currentGrowthLight([flower], 'garden')).toBe(flower);
        expect(scene.currentGrowthLight([flower]).id).toBe('growth:village');
        expect(camera.matrixWorld.toArray()).toEqual(matrix); expect(camera.projectionMatrix.toArray()).toEqual(projection);
    });

    it('clears a finished clearance caption before the next idle home view', () => {
        const scene = Object.create(IslandScene.prototype) as GrowthLightHarness;
        const caption = vi.fn();
        Object.assign(scene, { clearanceCaptionPending: true, furnitureClearance: { active: false, blocked: [] },
            callbacks: { caption }, state: { items: [] } });
        scene.finishPendingActivity();
        expect(caption).toHaveBeenCalledWith('カワウソと ウサギが くらす しま');
        scene.finishPendingActivity(); expect(caption).toHaveBeenCalledTimes(1);
    });

    it('ordinary play of a far-away village lamp takes a real house route before discovering home-visit', () => {
        const { scene, discovery } = harness();
        const lamp = scene.state.items.find(item => item.habitatId === 'village')!;
        lamp.position = { x: 7.3, z: 1 };
        expect(scene.performPlay({ id: 'ordinary-lamp', itemId: lamp.id })).toMatchObject({ status: 'playing' });
        expect(scene.livingVisit?.discoveryId).toBe('home-visit');
        expect(scene.livingResidents).toHaveLength(1);
        const resident = scene.livingResidents[0];
        expect(resident.group.position.distanceTo(new THREE.Vector3(lamp.position.x, 0, lamp.position.z))).toBeGreaterThan(8);
        expect(resident.group.position.x).toBeLessThan(-2);
        expect(resident.group.position.z).toBeLessThan(0);
        scene.recordRenderedDiscoveries(); expect(discovery).not.toHaveBeenCalled();
        scene.updateLivingActivity(performance.now() + 10);
        scene.recordRenderedDiscoveries();
        expect(discovery).toHaveBeenCalledTimes(1); expect(discovery).toHaveBeenCalledWith('home-visit', lamp.id);
    });

    it('cannot turn an ordinary lamp observation into a house discovery without a house visit', () => {
        const { scene, residents, discovery } = harness();
        const lamp = scene.state.items.find(item => item.habitatId === 'village')!;
        lamp.position = { x: 7.3, z: 1 };
        residents[0].group.position.set(7, 0, 1);
        scene.livingVisit = livingVisitsForItem(lamp)[0]; scene.livingResidents = [residents[0]]; scene.livingArrivedAt = 10;
        scene.recordRenderedDiscoveries();
        expect(discovery).not.toHaveBeenCalled();
    });

    it.each(['home-visit', 'terrace-time'])('walks real clear routes to the house for %s before recording it', id => {
        const { scene, residents, discovery } = harness();
        const lamp = scene.state.items.find(item => item.habitatId === 'village')!;
        const visit = livingVisitsForItem(lamp).find(candidate => candidate.discoveryId === id)!;
        scene.recordRenderedDiscoveries(); expect(discovery).not.toHaveBeenCalled();
        expect(scene.visitHome(visit)).toBeDefined();
        scene.livingVisit = visit;
        scene.updateLivingActivity(performance.now() + 10);
        const count = id === 'terrace-time' ? 2 : 1;
        expect(scene.livingResidents).toHaveLength(count);
        expect(scene.homePending).toBeUndefined();
        expect(scene.livingResidents.every(resident => resident.action !== 'walk')).toBe(true);
        expect(scene.livingResidents.every(resident => resident.group.position.x < -2 && resident.group.position.z < 0)).toBe(true);
        if (count === 2) expect(scene.livingResidents[0].group.position.distanceTo(scene.livingResidents[1].group.position)).toBeGreaterThan(.8);
        scene.recordRenderedDiscoveries();
        expect(discovery).toHaveBeenCalledTimes(1); expect(discovery).toHaveBeenCalledWith(id, lamp.id);
        scene.recordRenderedDiscoveries(); expect(discovery).toHaveBeenCalledTimes(1);
        expect(residents).toHaveLength(3);
    });

    it('does not discover a started or hidden outcome, and album and learning are side-effect free', () => {
        const { scene, residents, discovery } = harness();
        const lamp = scene.state.items.find(item => item.habitatId === 'village')!;
        scene.livingVisit = livingVisitsForItem(lamp)[0]; scene.livingResidents = [residents[0]];
        scene.recordRenderedDiscoveries(); expect(discovery).not.toHaveBeenCalled();
        scene.livingArrivedAt = 10;
        for (const update of [{ learning: true, readOnly: false }, { learning: false, readOnly: true }]) {
            Object.assign(scene.state, update); scene.recordRenderedDiscoveries();
            expect(scene.updateLivingActivity(100)).toBe(false);
            expect(discovery).not.toHaveBeenCalled();
        }
        Object.assign(scene.state, { learning: false, readOnly: false });
        residents[0].group.visible = false; scene.recordRenderedDiscoveries(); expect(discovery).not.toHaveBeenCalled();
        residents[0].group.visible = true;
        scene.cancelLivingActivity(200);
        expect(scene.livingVisit).toBeUndefined(); expect(scene.livingResidents).toEqual([]);
        scene.recordRenderedDiscoveries(); expect(discovery).not.toHaveBeenCalled();
    });
});
