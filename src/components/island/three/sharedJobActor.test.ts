import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { IslandResident } from './animals';
import { IslandMaterials, disposeGeometry } from './primitives';
import { SharedJobActor } from './sharedJobActor';
import { makeSharedDisplayTarget, SHARED_DISPLAY_TARGET_Y, SHARED_DISPLAY_TARGET_Z } from './sharedDisplayScene';
import { RESIDENT_FOOTPRINT } from './navigation';
import { SHARED_DISPLAY_RADII, type SharedTarget } from '../../../domain/island/sharedMemories';
import { createIsland } from '../../../domain/island/catalog';
import { IslandSharedDisplayScene } from './sharedDisplayScene';
import { resolveSharedTarget } from '../../../domain/island/sharedMemories';
import { createEmptyWorkshopLayout } from '../../../domain/island/workshopLayout';

describe('shared work uses grounded actual hands', () => {
    it('reaches every rabbit preparation and return contact outside the actual table', () => {
        const materials = new IslandMaterials(), resident = new IslandResident('rabbit', materials, [3, 0, 2], () => {});
        const actor = new SharedJobActor(resident), scene = new IslandSharedDisplayScene(), island = createIsland('contact-fixture', 0);
        const target = resolveSharedTarget(island, { kind: 'specimen', specimenId: 'driftwood' });
        scene.update({ ...island, sharedMemories: { version: 1, memories: [], nextMemoryOrder: 1, displays: { 'display-1': { target, position: { x: 0, z: 0 }, rotation: 0, placedAt: 0, arrangement: 'plain' } } } });
        const a = scene.anchors('display-1')!;
        const results = [...a.preparation, ...a.petals, a.returnPlate].map(point => {
            const candidates = actor.contactCandidates([point], Math.atan2(-point.x, -point.z));
            return { point: point.toArray(), roots: candidates.map(p => ({ lean: p.lean, radius: Math.hypot(p.root.x, p.root.z) })) };
        });
        expect(results.every(result => result.roots.some(root => root.radius >= .72 + RESIDENT_FOOTPRINT)), JSON.stringify(results)).toBe(true);
        scene.dispose(); disposeGeometry(resident.group); materials.dispose();
    });
    it.each(['specimen', 'work'] as const)('holds both real %s tray handles without feet entering the table', kind => {
        const materials = new IslandMaterials(), resident = new IslandResident('otter', materials, [3, 0, 2], () => {});
        resident.setAppearance('cap');
        const actor = new SharedJobActor(resident);
        const target: SharedTarget = kind === 'specimen' ? { kind, specimenId: 'driftwood', targetKey: 'explicit-geometry-fixture' }
            : { kind, targetKey: 'explicit-geometry-fixture', name: '案', capturedAt: 1, sourceWorkId: 'work-1', layout: createEmptyWorkshopLayout() };
        const visual = makeSharedDisplayTarget(target, kind === 'specimen' ? { cleanedMask: 63, name: '流木', identified: true } : undefined);
        visual.group.position.set(0, SHARED_DISPLAY_TARGET_Y, SHARED_DISPLAY_TARGET_Z);
        const { gripLeft, gripRight } = visual.anchors();
        const candidates = actor.contactCandidates([gripLeft, gripRight], Math.PI);
        const pose = candidates.find(candidate => Math.hypot(candidate.root.x, candidate.root.z) >= SHARED_DISPLAY_RADII[kind] + RESIDENT_FOOTPRINT);
        expect(pose, JSON.stringify(candidates.map(candidate => ({ root: candidate.root.toArray(), lean: candidate.lean })))).toBeDefined();
        actor.pose(pose!.root, pose!.yaw, pose!.lean, [gripLeft, gripRight]);
        expect(resident.handAnchor(new THREE.Vector3(), 'left').distanceTo(gripRight)).toBeLessThan(.035);
        expect(resident.handAnchor(new THREE.Vector3(), 'right').distanceTo(gripLeft)).toBeLessThan(.035);
        actor.restore(); expect(resident.group.position.toArray()).toEqual([3, 0, 2]);
        expect(resident.action).toBe('idle'); expect(resident.itemId).toBe('');
        visual.dispose(); resident.disposeAppearance(); disposeGeometry(resident.group); materials.dispose();
    });
});
