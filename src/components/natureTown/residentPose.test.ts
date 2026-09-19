import { expect, it } from 'vitest';
import { newWorld, context } from '../../domain/natureTown/world';
import { stepWorld } from '../../domain/natureTown/simulation';
import { residentPose } from './residentPose';
it('uses committed pickup/dropoff without replaying gestures after movement, expiry or reload', () => {
    let world = newWorld('acting');
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
        const result = stepWorld(world, context()); world = result.state;
        for (const event of result.events) {
            if (event.type !== 'FoodTransferred' || !event.transfer) continue;
            const resident = world.residents.find(r => r.id === event.transfer!.toId || r.id === event.transfer!.fromId);
            if (!resident) continue;
            const pose = resident.carriedFood > 0 ? 'receiving' : 'giving';
            seen.add(pose);
            expect(residentPose(resident, [event], world.tick)).toBe(pose);
            const resting = resident.carriedFood > 0 ? 'carrying' : 'idle';
            expect(residentPose(resident, [], world.tick)).toBe(resting);
            expect(residentPose(resident, [event], world.tick + 2)).toBe(resting);
            expect(residentPose({ ...resident, position: [99, 99] }, [event], world.tick)).toBe(resting);
        }
    }
    expect([...seen].sort()).toEqual(['giving', 'receiving']);
});
