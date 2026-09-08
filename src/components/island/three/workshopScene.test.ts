import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createIsland } from '../../../domain/island/catalog';
import { getIslandWorkshop, reduceIslandWorkshop, WORKSHOP_SPECIMENS, WORKSHOP_SPECIMEN_IDS,
    type IslandWorkshopAction, type WorkshopSpecimenId } from '../../../domain/island/workshop';
import { simulateWorkshop, WORKSHOP_PART_IDS } from '../../../domain/island/workshopLayout';
import type { IslandRecord } from '../../../domain/island/types';
import { IslandWorkshopScene, type WorkshopSceneCommand, type WorkshopSceneState } from './workshopScene';
import { WORKSHOP_BOARD_Y, WORKSHOP_STATIONS, WORKSHOP_WATER_BOTTOM_Y, WORKSHOP_WATER_SURFACE_Y, workshopAnchorToWorld } from './workshopGeometry';

const scenes: IslandWorkshopScene[] = [];
afterEach(() => { scenes.splice(0).forEach(scene => scene.dispose()); });
const ready = () => ({ ...createIsland('scene-test', 0), completedSets: 1 });
function clean(island: IslandRecord, specimenId: WorkshopSpecimenId, identify = false) {
    for (let section = 0; section < 6; section++) island = reduceIslandWorkshop(island, { type: 'brush', specimenId, section }, 1);
    island = reduceIslandWorkshop(island, { type: 'observe-specimen', specimenId, result: 'clean', cleanedMask: 63 }, 2);
    if (identify) island = reduceIslandWorkshop(island, { type: 'observe-specimen', specimenId,
        result: WORKSHOP_SPECIMENS[specimenId].identityResult, cleanedMask: 63 }, 3);
    return island;
}
function materials() { return WORKSHOP_SPECIMEN_IDS.reduce((island, id) => clean(island, id, true), ready()); }
function layoutIsland(variant: 'A' | 'B') {
    let island = materials();
    const ids = variant === 'A' ? ['straight', 'wheel', 'bell'] as const : ['elbow', 'wheel', 'bell'] as const;
    ids.forEach((partId, index) => {
        island = reduceIslandWorkshop(island, { type: 'edit-draft', edit: { type: 'assemble', partId } }, 4);
        island = reduceIslandWorkshop(island, { type: 'edit-draft', edit: { type: 'move', partId,
            position: variant === 'A' ? { col: index, row: 1 } : { col: 0, row: index + 1 } } }, 5);
        if (variant === 'B' && index > 0) island = reduceIslandWorkshop(island, { type: 'edit-draft', edit: { type: 'rotate', partId, rotation: 1 } }, 6);
    });
    return island;
}
function harness(island = ready(), mode: WorkshopSceneState['mode'] = 'observe', reduced = false) {
    let current = island, now = 0, serial = 0;
    const actions: IslandWorkshopAction[] = [], feedback: string[] = [];
    const scene = new IslandWorkshopScene({ onAction: action => { actions.push(action); }, onFeedback: kind => feedback.push(kind) }); scenes.push(scene);
    let state: WorkshopSceneState = { workshop: getIslandWorkshop(current), active: true, mode, selectedToolId: 'brush' };
    const update = (ms = 0, changes: Partial<WorkshopSceneState> = {}) => {
        now += ms; state = { ...state, ...changes }; return scene.update(state, now, reduced);
    };
    const save = (action: IslandWorkshopAction) => {
        current = reduceIslandWorkshop(current, action, now); state = { ...state, workshop: getIslandWorkshop(current) }; update();
    };
    const command = (command: WorkshopSceneCommand, id = `test-${++serial}`) => scene.command({ id, command }, now);
    update();
    return { scene, actions, feedback, update, save, command, state: () => state, island: () => current,
        render: (visible = true) => scene.afterRender(() => visible) };
}
const down = (point: THREE.Vector3) => new THREE.Ray(new THREE.Vector3(point.x, 8, point.z), new THREE.Vector3(0, -1, 0));

describe('workshop physical specimens and rendered observation boundary', () => {
    it('owns three distinct objects with six removable surfaces, preserving object identity across saved cleaning', () => {
        const h = harness(), meshes = WORKSHOP_SPECIMEN_IDS.map(id => h.scene.visuals.specimens[id].group);
        expect(new Set(meshes).size).toBe(3);
        expect(h.scene.diagnostic().visibleSand).toEqual({ driftwood: 6, seaglass: 6, 'striped-shell': 6 });
        h.save({ type: 'brush', specimenId: 'driftwood', section: 2 });
        expect(h.scene.visuals.specimens.driftwood.group).toBe(meshes[0]);
        expect(h.scene.visuals.specimens.driftwood.patches.map(patch => patch.visible)).toEqual([true, true, false, true, true, true]);
        expect(h.scene.diagnostic().visibleSand.seaglass).toBe(6);
        const before = h.scene.anchors.specimens.driftwood.sand[0];
        h.scene.group.position.set(9, 0, 4);
        const after = h.scene.anchors.specimens.driftwood.sand[0];
        expect(after.clone().sub(before).toArray()).toEqual([9, 0, 4]);
    });

    it('brushing finishes after placing even when requested during travel, then changes only the rendered section', () => {
        const h = harness();
        h.command({ type: 'place-specimen', specimenId: 'driftwood', station: 'brush' }); h.update(100);
        h.command({ type: 'brush', specimenId: 'driftwood', section: 4 }); h.update(400);
        expect(h.scene.visuals.brush.visible).toBe(true); expect(h.actions).toEqual([]);
        h.update(600); h.render(false); expect(h.actions).toEqual([]);
        expect(h.scene.visuals.specimens.driftwood.group.position.distanceTo(WORKSHOP_STATIONS.brush)).toBeLessThan(.00001);
        h.render(); expect(h.actions).toEqual([{ type: 'brush', specimenId: 'driftwood', section: 4 }]);
        h.save(h.actions[0]); h.render(); h.update(1000); h.render();
        expect(h.actions).toHaveLength(1); expect(h.scene.visuals.specimens.driftwood.patches[4].visible).toBe(false);
        expect(h.scene.visuals.brush.visible).toBe(true);
        expect(h.scene.visuals.brush.position.x).toBeCloseTo(WORKSHOP_STATIONS.brush.x - .25);
        expect(h.scene.diagnostic().activeTool).toBeNull(); expect(h.feedback).toEqual(['sand']);
    });

    it('does not brush without the brush tool or while busy; an interrupted clean reveal can resume', () => {
        const h = harness(); h.update(0, { selectedToolId: 'lamp' });
        h.command({ type: 'brush', specimenId: 'seaglass', section: 0 }); h.update(2000); h.render(); expect(h.actions).toEqual([]);
        h.update(0, { selectedToolId: 'brush', busy: true });
        h.command({ type: 'brush', specimenId: 'seaglass', section: 0 }, 'busy'); h.update(2000); h.render(); expect(h.actions).toEqual([]);
        h.update(0, { busy: false }); h.command({ type: 'brush', specimenId: 'seaglass', section: 0 }, 'busy');
        h.update(2000); h.render(); expect(h.actions).toEqual([]);
        for (let section = 0; section < 6; section++) h.save({ type: 'brush', specimenId: 'seaglass', section });
        h.command({ type: 'stop' }); h.update(); h.render(false); expect(h.actions).toEqual([]);
        h.render(); expect(h.actions).toEqual([{ type: 'observe-specimen', specimenId: 'seaglass', result: 'clean', cleanedMask: 63 }]);
    });

    it('captures a fast stroke through six real ray contacts, then visibly sweeps each once across save latency', () => {
        const h = harness(), points = h.scene.anchors.specimens.driftwood.sand;
        expect(h.scene.pointerDown(down(points[0]), 41, 0)).toBe(true);
        for (const [index, point] of points.entries()) h.scene.pointerMove(down(point), 41, index * 2);
        h.scene.pointerMove(down(points[2]), 41, 14);
        h.update(5000); h.render(); expect(h.actions).toEqual([]);
        expect(h.scene.diagnostic().visibleSand.driftwood).toBe(6);
        h.scene.pointerUp(down(points[5]), 41, 5016);
        h.update(1000); h.render(); expect(h.actions).toHaveLength(1);
        h.save(h.actions[0]); h.update(600, { busy: true }); h.render(); expect(h.actions).toHaveLength(1);
        h.update(0, { busy: false }); h.render(); expect(h.actions).toHaveLength(2); h.save(h.actions[1]);
        for (let i = 2; i < 6; i++) { h.update(600); h.render(); h.save(h.actions[i]); }
        expect(h.actions.filter(action => action.type === 'brush').map(action => action.section)).toEqual([0, 1, 2, 3, 4, 5]);
        expect(h.scene.diagnostic().visibleSand.driftwood).toBe(0);
        h.render(); expect(h.actions.at(-1)).toEqual({ type: 'observe-specimen', specimenId: 'driftwood', result: 'clean', cleanedMask: 63 });
    });

    it('discards a cancelled sand stroke without changing any section or moving its owned specimen', () => {
        const h = harness(), point = h.scene.anchors.specimens.seaglass.sand[0], before = h.scene.anchors.specimens.seaglass.center;
        expect(h.scene.pointerDown(down(point), 51, 0)).toBe(true);
        h.scene.pointerMove(down(h.scene.anchors.specimens.seaglass.sand[4]), 51, 2);
        h.scene.pointerMove(down(new THREE.Vector3(25, 0, 25)), 51, 4); h.scene.pointerCancel(51);
        h.update(10000); h.render();
        expect(h.actions).toEqual([]); expect(h.scene.diagnostic().visibleSand.seaglass).toBe(6);
        expect(h.scene.anchors.specimens.seaglass.center.toArray()).toEqual(before.toArray());
        expect(h.scene.visuals.brush.visible).toBe(true); expect(h.scene.diagnostic().activeTool).toBeNull();
    });

    it('uses the same glass body for blocked light and visibly transmitted light after cleaning', () => {
        const h = harness(), body = h.scene.visuals.specimens.seaglass.group;
        h.command({ type: 'lamp', specimenId: 'seaglass', angle: -.7 }); h.update(1200); h.render();
        expect(h.actions).toEqual([]); expect(h.scene.visuals.beam.visible).toBe(true);
        expect(h.scene.visuals.transmittedBeam.visible).toBe(false); expect(h.scene.visuals.shadow.visible).toBe(true);
        for (let section = 0; section < 6; section++) h.save({ type: 'brush', specimenId: 'seaglass', section });
        h.render(); h.save(h.actions[0]); h.actions.length = 0;
        h.command({ type: 'lamp', specimenId: 'seaglass', angle: .8 }); h.update(1200);
        expect(h.scene.visuals.specimens.seaglass.group).toBe(body);
        expect(h.scene.visuals.transmittedBeam.visible).toBe(true); expect(h.scene.visuals.lightPool.visible).toBe(true);
        expect(h.scene.visuals.shadow.visible).toBe(false); expect(h.actions).toEqual([]);
        h.render(false); expect(h.actions).toEqual([]); h.render();
        expect(h.actions).toEqual([{ type: 'observe-specimen', specimenId: 'seaglass', result: 'transmit', cleanedMask: 63 }]);
    });

    it.each(WORKSHOP_SPECIMEN_IDS)('%s physically floats or sinks before its water observation', specimenId => {
        const h = harness(clean(ready(), specimenId));
        h.command({ type: 'place-specimen', specimenId, station: 'water' }); h.update(1200);
        const position = h.scene.visuals.specimens[specimenId].group.position;
        expect(position.y).toBeCloseTo(specimenId === 'driftwood' ? WORKSHOP_WATER_SURFACE_Y - .12 : WORKSHOP_WATER_BOTTOM_Y + .045);
        expect(h.scene.visuals.ripple.visible).toBe(true); expect(h.actions).toEqual([]);
        h.render(); expect(h.actions).toEqual([{ type: 'observe-specimen', specimenId,
            result: specimenId === 'driftwood' ? 'float' : 'sink', cleanedMask: 63 }]);
    });

    it('consumes paused commands, accepts stop while busy, and restores held specimens without ownership writes', () => {
        const h = harness(); const before = h.scene.anchors.specimens.driftwood.center;
        h.command({ type: 'pick-specimen', specimenId: 'driftwood' }); h.update(300);
        expect(h.scene.anchors.specimens.driftwood.center.y).toBeCloseTo(before.y + .65);
        h.update(0, { busy: true }); h.command({ type: 'stop' });
        expect(h.scene.diagnostic().heldSpecimenId).toBeNull(); expect(h.scene.anchors.specimens.driftwood.center.toArray()).toEqual(before.toArray());
        h.update(0, { busy: false, active: false });
        h.command({ type: 'lamp', specimenId: 'driftwood', angle: 0 }, 'paused');
        h.update(1000, { active: true }); h.command({ type: 'lamp', specimenId: 'driftwood', angle: 0 }, 'paused');
        h.update(2000); h.render(); expect(h.actions).toEqual([]); expect(h.scene.diagnostic().phase).toBe('idle');
        h.command({ type: 'brush', specimenId: 'driftwood', section: 0 }); h.update(1000);
        h.update(0, { active: false }); h.render(); h.update(0, { active: true }); h.render();
        expect(h.actions).toEqual([]); expect(h.island().workshop).toBeUndefined();
    });
});

describe('workshop sockets, typed mechanical run and direct manipulation', () => {
    it.each(WORKSHOP_PART_IDS)('tapping the visible center of the %s cavity fits its material', partId => {
        const h = harness(materials(), 'build');
        const target = h.scene.anchors.parts[partId].socket;
        const origin = h.scene.camera.position;
        const ray = new THREE.Ray(origin.clone(), target.clone().sub(origin).normalize());
        expect(h.scene.pointerDown(ray, 73, 0)).toBe(true);
        h.scene.pointerUp(ray, 73, 16);
        h.update(1000); h.render(false);
        expect(h.actions).toEqual([]);
        h.render();
        expect(h.actions).toEqual([{ type: 'edit-draft', edit: { type: 'assemble', partId } }]);
    });

    it('inserts discovered material into a socket before emitting assembly, and cancels without consuming it', () => {
        const locked = harness(ready(), 'build'); locked.command({ type: 'assemble', partId: 'straight' }); locked.update(1000); locked.render();
        expect(locked.actions).toEqual([]);
        const h = harness(materials(), 'build'), part = h.scene.visuals.parts.straight;
        h.command({ type: 'assemble', partId: 'straight' }); h.update(200);
        expect(part.insert.visible).toBe(true); expect(part.insert.position.y).toBeGreaterThan(0); expect(part.finished.visible).toBe(false);
        h.command({ type: 'stop' }); h.update(1000); h.render(); expect(h.actions).toEqual([]);
        h.command({ type: 'assemble', partId: 'straight' }); h.update(1000); h.render(false);
        expect(part.insert.position.y).toBe(0); expect(h.actions).toEqual([]);
        h.render(); expect(h.actions).toEqual([{ type: 'edit-draft', edit: { type: 'assemble', partId: 'straight' } }]);
        h.update(); expect(part.insert.visible).toBe(true); expect(h.scene.diagnostic().phase).toBe('awaiting-save');
        h.save(h.actions[0]); expect(part.finished.visible).toBe(true); expect(part.frame.visible).toBe(false); expect(part.insert.visible).toBe(false);
    });

    it.each(['A', 'B'] as const)('runs layout %s along actual anchors, renders wheel then bell, and retains the completed run diagnostic', variant => {
        const h = harness(layoutIsland(variant), 'build');
        const layout = h.state().workshop.draftCheckpoint.draft.layout, expected = simulateWorkshop(layout);
        h.command({ type: 'run' });
        for (const beat of expected.beats) {
            h.update(1000);
            if (beat.type === 'flow') {
                const height = WORKSHOP_BOARD_Y + (beat.channel === 'shaft' ? .3 : .12);
                expect(h.scene.visuals.flow.position.toArray()).toEqual(workshopAnchorToWorld(beat.to, height).toArray());
            }
            if (beat.type === 'wheel') expect(h.scene.visuals.parts.wheel.rotor!.rotation.x).not.toBe(0);
            if (beat.type === 'bell') expect(h.scene.visuals.parts.bell.bell!.rotation.z).not.toBe(0);
            h.render();
        }
        h.update(1);
        expect(h.actions.map(action => action.type === 'observe-creation' ? action.partId : '')).toEqual(['wheel', 'bell']);
        expect(h.scene.diagnostic().run).toEqual({ reached: expected.reachedPartIds, complete: true });
        expect(h.scene.diagnostic().phase).toBe('idle');
        for (const id of WORKSHOP_PART_IDS) {
            if (!layout.parts[id].position) continue;
            expect(h.scene.visuals.parts[id].group.position.toArray()).toEqual(workshopAnchorToWorld(layout.parts[id].position!, WORKSHOP_BOARD_Y).toArray());
            expect(h.scene.visuals.parts[id].group.rotation.y).toBe(-layout.parts[id].rotation * Math.PI / 2);
        }
    });

    it('holds a hidden run beat, stops on draft change, and performs the same causal sequence with reduced motion', () => {
        const h = harness(layoutIsland('A'), 'build', true);
        h.command({ type: 'run' }); h.update(1000); h.render(false); expect(h.scene.diagnostic().run?.index).toBe(0);
        const beats = simulateWorkshop(h.state().workshop.draftCheckpoint.draft.layout).beats;
        for (let i = 0; i < beats.length; i++) { h.update(200); h.render(); }
        expect(h.actions.map(action => action.type === 'observe-creation' ? action.partId : '')).toEqual(['wheel', 'bell']);
        h.actions.length = 0; h.command({ type: 'run' }); h.update(250);
        h.save({ type: 'edit-draft', edit: { type: 'rotate', partId: 'wheel', rotation: 1 } });
        h.update(10000); h.render(); expect(h.actions).toEqual([]); expect(h.scene.diagnostic().phase).toBe('idle');
        h.command({ type: 'run' });
        for (let i = 0; i < 15; i++) { h.update(250); h.render(); }
        expect(h.actions).toEqual([]); expect(h.scene.diagnostic().run).toMatchObject({ complete: false, stop: 'misaligned', reached: ['straight'] });
    });

    it.each([false, true])('replays immutable A over draft B without edits or first observations (reduced=%s)', reduced => {
        const h = harness(layoutIsland('B'), 'build', reduced);
        const before = structuredClone(h.state().workshop), capture = getIslandWorkshop(layoutIsland('A')).draftCheckpoint.draft.layout;
        h.update(0, { replayLayout: capture });
        expect(h.scene.diagnostic().replay).toBe(true);
        for (const id of WORKSHOP_PART_IDS) {
            const saved = capture.parts[id];
            if (saved.position) expect(h.scene.visuals.parts[id].group.position.toArray()).toEqual(workshopAnchorToWorld(saved.position, WORKSHOP_BOARD_Y).toArray());
        }
        const center = h.scene.anchors.parts.wheel.center;
        expect(h.scene.pointerDown(down(center), 70, 0)).toBe(false);
        h.command({ type: 'assemble', partId: 'straight' }); h.update(1000); h.render(); expect(h.actions).toEqual([]);
        h.command({ type: 'run' });
        const simulation = simulateWorkshop(capture);
        for (const beat of simulation.beats) {
            h.update(1000);
            if (beat.type === 'flow') expect(h.scene.visuals.flow.position.toArray()).toEqual(workshopAnchorToWorld(beat.to, WORKSHOP_BOARD_Y + (beat.channel === 'shaft' ? .3 : .12)).toArray());
            h.render();
        }
        h.update(1); expect(h.scene.diagnostic().run).toEqual({ reached: simulation.reachedPartIds, complete: true });
        expect(h.actions).toEqual([]); expect(h.state().workshop).toEqual(before);
        h.update(0, { replayLayout: undefined });
        const wheelB = before.draftCheckpoint.draft.layout.parts.wheel;
        expect(h.scene.visuals.parts.wheel.group.position.toArray()).toEqual(workshopAnchorToWorld(wheelB.position!, WORKSHOP_BOARD_Y).toArray());
        expect(h.scene.visuals.parts.wheel.group.rotation.y).toBe(-wheelB.rotation * Math.PI / 2);
    });

    it('cancels invalid or interrupted drags and prevents a second pointer taking ownership', () => {
        const h = harness(materials(), 'build');
        h.save({ type: 'edit-draft', edit: { type: 'assemble', partId: 'straight' } });
        const start = h.scene.anchors.parts.straight.center.clone(), ray = down(start);
        expect(h.scene.pointerDown(ray, 11, 0)).toBe(true); expect(h.scene.pointerDown(ray, 12, 0)).toBe(false);
        h.scene.pointerMove(down(new THREE.Vector3(20, .3, 20)), 11, 100); h.scene.pointerCancel(12);
        expect(h.scene.visuals.parts.straight.group.position.x).toBe(20);
        h.scene.pointerCancel(11); expect(h.scene.visuals.parts.straight.group.position.toArray()).toEqual(start.toArray()); expect(h.actions).toEqual([]);
        h.scene.pointerDown(ray, 13, 200); h.scene.pointerMove(down(new THREE.Vector3(20, .3, 20)), 13, 250);
        h.scene.pointerUp(down(new THREE.Vector3(20, .3, 20)), 13, 300);
        expect(h.actions).toEqual([]); expect(h.scene.visuals.parts.straight.group.position.toArray()).toEqual(start.toArray());
        h.scene.pointerDown(ray, 14, 400); const destination = workshopAnchorToWorld({ col: 0, row: 1 });
        h.scene.pointerMove(down(destination), 14, 450); h.scene.pointerUp(down(destination), 14, 500);
        expect(h.actions).toEqual([{ type: 'edit-draft', edit: { type: 'move', partId: 'straight', position: { col: 0, row: 1 } } }]);
    });

    it('reuses its geometry during updates and disposes every owned geometry exactly once', () => {
        const h = harness(), geometries = new Set<THREE.BufferGeometry>();
        h.scene.group.traverse(object => { if (object instanceof THREE.Mesh) geometries.add(object.geometry); });
        const counts = new Map<THREE.BufferGeometry, number>();
        geometries.forEach(geometry => geometry.addEventListener('dispose', () => counts.set(geometry, (counts.get(geometry) ?? 0) + 1)));
        for (let i = 0; i < 100; i++) h.update(16);
        const after = new Set<THREE.BufferGeometry>(); h.scene.group.traverse(object => { if (object instanceof THREE.Mesh) after.add(object.geometry); });
        expect(after).toEqual(geometries); h.scene.dispose(); h.scene.dispose();
        expect(counts.size).toBe(geometries.size); expect([...counts.values()].every(count => count === 1)).toBe(true);
        expect(h.scene.active).toBe(false);
    });
});
