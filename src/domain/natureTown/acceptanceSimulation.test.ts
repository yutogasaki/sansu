import { describe, expect, it } from 'vitest';
import { applyWorldCommand } from './commands';
import { channelSources, environment } from './environment';
import { at, cells, graph, key } from './grid';
import { deliver, meals } from './transport';
import { assertWorld } from './validation';
import { context, makeResident, newWorld } from './world';
import type { WorldCommandPayload, WorldState } from './types';

const ctx = context(new Set([...context().capabilities, 'irrigation']));
function edit(w: WorldState, payload: WorldCommandPayload) {
    const result = applyWorldCommand(w, {commandId: `acceptance:${w.revision}`, profileId: w.profileId,
        worldId: w.worldId, expectedRevision: w.revision, payload}, ctx);
    expect(result.rejection).toBeUndefined();
    assertWorld(result.state, 'p');
    return result.state;
}
function inventory(w: WorldState, kind: 'farm' | 'hub') {
    return w.props.find(p => p.kind === kind)! as Extract<WorldState['props'][number], {kind: 'farm' | 'hub'}>;
}
function deliveryFixture(food = 3) {
    const w = newWorld('p');
    const home = w.props.find(p => p.kind === 'home')!;
    if (home.kind !== 'home') throw Error('home');
    // Six people deliberately exercise two simultaneous transport slots.
    home.beds = 6;
    for (let i = 3; i < 6; i++) w.residents.push(makeResident(`resident-${i}`, i, home.id, 'hub-0', [8, 9]));
    inventory(w, 'farm').inventory.food = food;
    inventory(w, 'hub').inventory.food = 0;
    w.foodAccounting.initialized = food;
    return w;
}
function transportTicks(w: WorldState, n: number) {
    for (let i = 0; i < n; i++) { w.tick++; deliver(w, ctx); assertWorld(w, 'p'); }
}

describe('NT-3 simulation acceptance (explicit diagnostic fixtures)', () => {
    it('SIM-02 connects and cuts a channel with gradual downstream relaxation only', () => {
        let w = newWorld('p');
        const unrelated = at(w, [1, 1])!.moisture;
        w = edit(w, {type: 'paintChannel', cells: [[11,3],[10,3],[9,3],[8,3],[7,3],[6,3],[5,3],[4,3]]});
        expect(at(w, [4,3])!.moisture).toBeCloseTo(.2);
        environment(w, ctx);
        expect(at(w, [4,3])!.moisture).toBeCloseTo(.24);
        for (let i = 0; i < 120; i++) environment(w, ctx);
        const wet = at(w, [4,3])!.moisture;
        expect(wet).toBeGreaterThan(.69);
        w = edit(w, {type: 'removeOverlay', kind: 'channel', cells: [[11,3]]});
        expect(at(w, [4,3])!.moisture).toBe(wet);
        environment(w, ctx);
        expect(at(w, [4,3])!.moisture).toBeCloseTo(wet + .08 * (.2 - wet));
        expect(at(w, [1,1])!.moisture).toBe(unrelated);
        expect(at(w, [11,3])!.moisture).toBeCloseTo(.7);
    });

    it('SIM-03 bounds uphill, loops and the ninth edge without duplicate water influence', () => {
        const w = newWorld('p');
        w.props = [];
        for (const c of cells(w)) { c.terrain = 'ground'; c.channel = false; }
        at(w, [1,1])!.terrain = 'water';
        for (let x = 2; x <= 10; x++) at(w, [x,1])!.channel = true;
        for (const p of [[2,2],[3,2]] as const) at(w,p)!.channel = true;
        const connected = channelSources(w, ctx);
        expect(connected.reached.has('9,1')).toBe(true);
        expect(connected.reached.has('10,1')).toBe(false);
        expect(connected.sources).toHaveLength(11);
        expect(new Set(connected.sources.map(c => key(c.position))).size).toBe(11);
        environment(w, ctx, true);
        expect(at(w, [3,2])!.moisture).toBeCloseTo(.7);
        at(w, [4,1])!.elevation = 1;
        expect(channelSources(w, ctx).reached.has('4,1')).toBe(false);
        expect(channelSources(w, ctx).reached.has('5,1')).toBe(false);
    });

    it('opening land preserves existing moisture mid-relaxation and initializes only new cells', () => {
        let w = newWorld('p');
        w = edit(w, {type: 'paintPath', cells: Array.from({length:7}, (_,i) => [9,9+i] as const)});
        at(w, [4,3])!.moisture = .43;
        const before = cells(w).map(c => c.moisture);
        w = edit(w, {type: 'openChunk', coordinate: [0,1]});
        expect(w.chunks[0].cells.map(c => c.moisture)).toEqual(before);
        expect(w.chunks[1].cells.every(c => c.moisture >= .2)).toBe(true);
        environment(w, ctx);
        expect(at(w, [4,3])!.moisture).toBeCloseTo(.43 + .08 * (.2 - .43));
    });

    it('SIM-07/11 reserves one shared stock across two carriers and respects a nearly full hub', () => {
        const w = deliveryFixture();
        deliver(w, ctx);
        expect(w.jobs.map(j => j.quantity).sort()).toEqual([1,2]);
        expect(inventory(w, 'farm').inventory.outgoingReserved).toBe(3);
        assertWorld(w, 'p');
        transportTicks(w, 80);
        expect(inventory(w, 'farm').inventory.food).toBe(0);
        expect(inventory(w, 'hub').inventory.food).toBe(3);
        expect(w.jobs).toHaveLength(0);
        // Isolate the receiving-capacity constraint from normal reserve demand.
        const full = deliveryFixture();
        inventory(full, 'hub').inventory.food = 23;
        full.foodAccounting.initialized += 23;
        const crowded = {...ctx, config: {...ctx.config, transport: {...ctx.config.transport, reserveMeals: 4}}};
        deliver(full, crowded);
        expect(full.jobs.map(j => j.quantity)).toEqual([1]);
        for (let i = 0; i < 80; i++) { full.tick++; deliver(full, crowded); assertWorld(full, 'p'); }
        expect(inventory(full, 'hub').inventory.food).toBe(24);
        expect(inventory(full, 'farm').inventory.food).toBe(2);
    });

    it('SIM-10/11 cancels changed reservations and preserves cargo across road, bridge and hub edits', () => {
        let w = deliveryFixture(4);
        deliver(w, ctx);
        w = edit(w, {type:'storeProp', propId:inventory(w, 'farm').id});
        expect(w.jobs).toHaveLength(0);
        expect(inventory(w, 'farm').inventory.outgoingReserved).toBe(0);
        expect(inventory(w, 'hub').inventory.incomingReserved).toBe(0);
        w = edit(w, {type:'restoreProp', propId:inventory(w, 'farm').id, position:[10,6], rotation:0});
        for (let i = 0; i < 80 && !w.residents.some(r => r.carriedFood); i++) transportTicks(w, 1);
        expect(w.residents.some(r => r.carriedFood)).toBe(true);
        const cargo = w.residents.reduce((n,r) => n + r.carriedFood, 0);
        w = edit(w, {type:'removeOverlay', kind:'path', cells:[[11,8]]});
        w = edit(w, {type:'placeBridge', cells:[[12,9]]});
        // Explicit diagnostic: carrier is on the bridge at the instant it is removed.
        const carrier = w.residents.find(r => r.carriedFood)!;
        carrier.position = [12,9];
        w = edit(w, {type:'removeOverlay', kind:'bridge', cells:[[12,9]]});
        expect(w.residents.find(r => r.id === carrier.id)!.position).not.toEqual([12,9]);
        expect(w.residents.every(r => graph(w).has(key(r.position)))).toBe(true);
        w = edit(w, {type:'moveProp', propId:'hub-0', position:[8,11], rotation:0});
        expect(w.residents.reduce((n,r) => n + r.carriedFood, 0)).toBe(cargo);
        transportTicks(w, 120);
        expect(inventory(w, 'hub').inventory.food).toBe(4);
        expect(w.residents.every(r => r.carriedFood === 0)).toBe(true);
    });

    it('SIM-12 disconnects and restores actual household service without removing residents', () => {
        let w = newWorld('p');
        const ids = w.residents.map(r => r.id);
        w = edit(w, {type:'placeBridge', cells:[[12,9]]});
        w = edit(w, {type:'moveProp', propId:'home-0', position:[13,8], rotation:0});
        w.tick = 120; meals(w, ctx);
        expect(w.hubMetrics[0].history.at(-1)).toMatchObject({requested:3, served:3});
        w = edit(w, {type:'removeOverlay', kind:'bridge', cells:[[12,9]]});
        const food = inventory(w,'hub').inventory.food;
        w.tick = 240; meals(w, ctx);
        expect(w.hubMetrics[0].history.at(-1)).toMatchObject({requested:3, served:0});
        expect(inventory(w,'hub').inventory.food).toBe(food);
        expect(w.residents.map(r => r.id)).toEqual(ids);
        w = edit(w, {type:'placeBridge', cells:[[12,9]]});
        w.tick = 360; meals(w, ctx);
        expect(w.hubMetrics[0].history.at(-1)).toMatchObject({requested:3, served:3});
        assertWorld(w, 'p');
    });
});
