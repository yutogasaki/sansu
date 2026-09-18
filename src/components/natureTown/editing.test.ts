import { describe, expect, it } from 'vitest';
import { editIntent, extendStroke } from './editing';
import { residentDetails } from './residentDetails';
import { newWorld, context } from '../../domain/natureTown/world';
import { at } from '../../domain/natureTown/grid';
import { applyWorldCommand } from '../../domain/natureTown/commands';
import type { WorldState, WorldCommandPayload } from '../../domain/natureTown/types';
const apply = (world: WorldState, payload: WorldCommandPayload) => applyWorldCommand(world, {
    commandId: `test-${world.revision}`, profileId: world.profileId, worldId: world.worldId, expectedRevision: world.revision, payload,
}, context());
describe('Nature Town editing and resident inspection', () => {
    it('fills skipped samples, follows a revisited endpoint and separates new strokes', () => {
        let stroke = extendStroke([[4, 4]], [7, 4]);
        expect(stroke).toHaveLength(4);
        stroke = extendStroke(stroke, [5, 4]);
        stroke = extendStroke(stroke, [5, 6]);
        expect(stroke).toContainEqual([5, 5]);
        expect(stroke).not.toContainEqual([6, 5]);
        stroke = extendStroke(stroke, [9, 9], false);
        expect(stroke).not.toContainEqual([9, 8]);
        expect(new Set(stroke.map(String)).size).toBe(stroke.length);
    });
    it('undoes only newly painted roads and restores only roads actually erased', () => {
        const initial = newWorld('editing');
        at(initial, [7, 7])!.path = true; at(initial, [8, 7])!.path = false;
        const paint = editIntent(initial, [[7, 7], [8, 7]], 'path')!;
        const painted = apply(initial, paint.payload); expect(painted.rejection).toBeUndefined();
        const undone = apply(painted.state, paint.inverse!).state;
        expect(at(undone, [7, 7])!.path).toBe(true); expect(at(undone, [8, 7])!.path).toBe(false);
        const erase = editIntent(initial, [[7, 7], [8, 7]], 'erase')!;
        const erased = apply(initial, erase.payload);
        const restored = apply(erased.state, erase.inverse!).state;
        expect(at(restored, [7, 7])!.path).toBe(true); expect(at(restored, [8, 7])!.path).toBe(false);
    });
    it('uses the domain rejection for a whole invalid preview without changing the world', () => {
        const initial = newWorld('editing'), before = structuredClone(initial);
        const intent = editIntent(initial, [[7, 7], [100, 100]], 'path')!;
        expect(apply(initial, intent.payload).rejection).toBeDefined();
        expect(initial).toEqual(before);
    });
    it('shows reserved food separately from actual cargo and keeps stranded cargo visible', () => {
        const world = newWorld('inspection'), resident = world.residents[0];
        resident.jobId = 'delivery';
        world.jobs = [{ id: 'delivery', sourceId: 'farm-0', hubId: 'hub-0', residentId: resident.id, quantity: 4, usingCart: true, phase: 'toSource', createdTick: 0, lastProgressTick: 0 }];
        expect(residentDetails(world, resident)).toMatchObject({ carried: 0, reserved: 4, cart: true, destinationName: '畑' });
        world.jobs[0].phase = 'toHub'; resident.carriedFood = 4;
        expect(residentDetails(world, resident)).toMatchObject({ carried: 4, reserved: 0, destinationName: '食たく' });
        world.jobs = []; resident.path = [];
        expect(residentDetails(world, resident)).toMatchObject({ carried: 4, activity: '食べものを 持って、道を さがしているよ' });
    });
});
