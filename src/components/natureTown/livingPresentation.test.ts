import { expect, it } from 'vitest';
import { newWorld, context } from '../../domain/natureTown/world';
import { stepWorld } from '../../domain/natureTown/simulation';
import { at, neighbors } from '../../domain/natureTown/grid';
import { supplyConnections } from './livingPresentation';
import { assertWorld } from '../../domain/natureTown/validation';
it('emits actual pickup and dropoff endpoints once, while preserving food conservation', () => {
    let world = newWorld('living-events');
    let pickups = 0, deliveries = 0, meals = 0;
    const ids = new Set<string>();
    for (let i = 0; i < 400; i++) {
        const before = world, result = stepWorld(world, context()); world = result.state;
        assertWorld(world, 'living-events');
        for (const event of result.events) {
            expect(ids.has(event.id)).toBe(false); ids.add(event.id);
            if (event.type === 'MealServed') meals += event.quantity ?? 0;
            if (event.type !== 'FoodTransferred') continue;
            expect(event.transfer).toBeDefined();
            const transfer = event.transfer!;
            const recipient = world.residents.find(r => r.id === transfer.toId);
            if (recipient) {
                pickups++;
                expect(recipient.carriedFood).toBe(event.quantity);
                expect(transfer.to).toEqual(recipient.position);
                const source = world.props.find(p => p.id === transfer.fromId)!;
                expect(source.kind).toBe('farm'); expect(transfer.from).toEqual(source.position);
                expect(before.residents.find(r => r.id === recipient.id)!.carriedFood).toBe(0);
            } else {
                deliveries++;
                const carrier = world.residents.find(r => r.id === transfer.fromId)!;
                expect(carrier.carriedFood).toBe(0); expect(transfer.from).toEqual(carrier.position);
                expect(world.props.find(p => p.id === transfer.toId)!.kind).toBe('hub');
            }
        }
    }
    expect(pickups).toBeGreaterThan(0); expect(deliveries).toBeGreaterThan(0);
    expect(meals).toBe(world.foodAccounting.consumed);
});
it('distinguishes walkable ground from disconnected supply and missing assignment', () => {
    const world = newWorld('connections');
    for (const chunk of world.chunks) for (const cell of chunk.cells) cell.path = false;
    const home = world.props.find(p => p.kind === 'home')!;
    if (home.kind !== 'home') throw Error();
    expect(supplyConnections(world).get(home.id)).toBe('connected');
    for (const p of neighbors(home.entrance)) { const cell = at(world, p); if (cell) {cell.terrain = 'water';cell.bridge = false;} }
    expect(supplyConnections(world).get(home.id)).toBe('blocked');
    home.hubId = '';
    expect(supplyConnections(world).get(home.id)).toBe('unassigned');
});
