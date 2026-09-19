import type { DomainEvent, Resident } from '../../domain/natureTown/types';
export type ResidentPose = 'idle' | 'receiving' | 'carrying' | 'giving';
/** Feedback is ephemeral, local to the actual transfer, and subordinate to ownership. */
export function residentPose(resident: Resident, events: DomainEvent[], tick: number): ResidentPose {
    for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i], transfer = event.transfer;
        if (event.type !== 'FoodTransferred' || !transfer || !event.quantity || tick < event.tick || tick - event.tick > 1) continue;
        const receiving = transfer.toId === resident.id, giving = transfer.fromId === resident.id;
        if (!receiving && !giving) continue;
        const position = receiving ? transfer.to : transfer.from;
        if (position[0] !== resident.position[0] || position[1] !== resident.position[1]) continue;
        if (receiving && resident.carriedFood > 0) return 'receiving';
        if (giving && resident.carriedFood === 0) return 'giving';
    }
    return resident.carriedFood > 0 ? 'carrying' : 'idle';
}
