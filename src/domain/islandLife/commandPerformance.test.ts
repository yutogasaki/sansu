import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { HOUR, type LifeCommand } from './model';
import { IslandLifeDatabase, updateLife } from './repository';
import { cachedLifeState, cadenceReplayKey, clearLifeReplayCache } from './replayCache';
import { restoreLifeSnapshot } from './replaySnapshot';
import { commandLife, replayLife } from './simulation';
import { routeDuration } from './walkingSpace';

it('reuses a storage command after a day of history and persists the cold-replay state', async () => {
    const db = new IslandLifeDatabase(`command-performance-${crypto.randomUUID()}`);
    try {
        let record = await updateLife('owner', [{ id: 'credit', at: 100 }], undefined, 100, db);
        record = await updateLife('owner', [], {
            id: 'flower', revision: record.revision, command: { type: 'buy', kind: 'flower', cell: { x: 0, z: 3 } },
        }, 100, db);
        record = { ...record, actions: [...record.actions, ...Array.from({ length: 1000 }, (_, i) => ({
            id: `prior-call-${i}`, at: 101 + i * 60000,
            command: { type: 'visit' as const, itemId: 'flower' },
        }))], now: 100 + 24 * HOUR, realAt: 100 + 24 * HOUR, replaySnapshot: undefined };
        await db.worlds.put(record);
        record = await updateLife('owner', [], undefined, record.realAt, db);
        clearLifeReplayCache();
        expect(await restoreLifeSnapshot(record)).toBe(true);
        const intent = { id: 'store', revision: record.revision, command: { type: 'store' as const, itemId: 'flower' } };
        const start = performance.now();
        const next = commandLife(record, intent.command, intent.id, record.now);
        // Structural performance assertion: a hit must exist before any replay of next.
        const applied = cachedLifeState(cadenceReplayKey(next, next.now), next.now);
        expect(applied).toBeDefined();
        const warm = replayLife(next);
        console.info('store warm command + replay ms', performance.now() - start);
        clearLifeReplayCache();
        const coldStart = performance.now();
        expect(replayLife(next)).toEqual(warm);
        console.info('store cold replay ms', performance.now() - coldStart);
        expect(applied).toEqual(warm);
        expect(warm.items.find(item => item.id === 'flower')?.cell).toBeUndefined();

        // Exercise the actual owner transaction starting with only the prior snapshot.
        clearLifeReplayCache();
        const saved = await updateLife('owner', [], intent, record.realAt, db);
        expect(await db.worlds.get('owner')).toEqual(saved);
        expect(saved.revision).toBe(record.revision + 2);
        expect(replayLife(saved)).toEqual(warm);
        expect(await updateLife('owner', [], intent, record.realAt, db)).toEqual(saved);
        clearLifeReplayCache();
        expect(await restoreLifeSnapshot(saved)).toBe(true);
        expect(replayLife(saved)).toEqual(warm);
    } finally { await db.delete(); clearLifeReplayCache(); }
}, 120000);

const commands: LifeCommand[] = [
    { type: 'buy', kind: 'planter', cell: { x: 0, z: 4 } },
    { type: 'move', itemId: 'flower', cell: { x: 0, z: 4 } },
    { type: 'store', itemId: 'flower' },
    { type: 'remove', itemId: 'flower' },
    { type: 'style', itemId: 'flower', style: 'original' },
    { type: 'expand', side: 'east' },
    { type: 'clear-placement', kind: 'planter', cell: { x: 0, z: 4 } },
    { type: 'rotate', itemId: 'fence', rotation: 1 },
];

it.each(commands.flatMap(command => [100, 101].map(at => ({ command, type: command.type, at }))))(
    '$type at $at preserves cold replay and only caches after cutover', async ({ command, at }) => {
    const db = new IslandLifeDatabase(`command-cache-${crypto.randomUUID()}`);
    try {
        let record = await updateLife('owner', Array.from({ length: 20 }, (_, i) => ({ id: `credit-${i}`, at: 100 })), undefined, 100, db);
        record = commandLife(record, { type: 'buy', kind: 'flower', cell: { x: 0, z: 3 } }, 'flower', 100);
        // Decoration purchase below also tests the v18 -> v19 version change.
        if (command.type === 'rotate') record = commandLife(record, { type: 'buy', kind: 'fence', cell: { x: 5, z: 4 } }, 'fence', 100);
        const before = structuredClone(replayLife(record, at));
        const next = commandLife(record, command, 'edit', at);
        const applied = cachedLifeState(cadenceReplayKey(next, next.now), next.now);
        if (at === record.diagonalCutover!.at) expect(applied).toBeUndefined();
        else expect(applied).toBeDefined();
        const warm = replayLife(next);
        const later = replayLife(next, 30101);
        expect(replayLife(record, at)).toEqual(before);
        clearLifeReplayCache();
        expect(replayLife(next)).toEqual(warm);
        if (applied) expect(applied).toEqual(warm);
        clearLifeReplayCache();
        expect(replayLife(next, 30101)).toEqual(later);
    } finally { await db.delete(); clearLifeReplayCache(); }
});

it.each(['observe', 'observe-relation'] as const)('caches %s without changing the resident or replay', async type => {
    const db = new IslandLifeDatabase(`observation-cache-${crypto.randomUUID()}`);
    try {
        let record = await updateLife('owner', [{ id: 'a', at: 100 }, { id: 'b', at: 100 }], undefined, 100, db);
        record = commandLife(record, { type: 'buy', kind: 'bench', cell: { x: 0, z: 3 } }, 'bench', 100);
        const resident = replayLife(record).residents.find(r => r.visit?.itemId === 'bench')!;
        const now = resident.visit!.start + routeDuration(resident.visit!.path) + 1000;
        const next = commandLife(record, { type, itemId: 'bench', residentId: resident.id }, 'observe', now);
        const applied = cachedLifeState(cadenceReplayKey(next, now), now);
        expect(applied).toBeDefined();
        const warm = replayLife(next);
        clearLifeReplayCache();
        expect(replayLife(next)).toEqual(warm);
        expect(applied).toEqual(warm);
    } finally { await db.delete(); clearLifeReplayCache(); }
});

it('does not hide invalid commands or tampered purchases behind a warm cache', async () => {
    const db = new IslandLifeDatabase(`invalid-command-cache-${crypto.randomUUID()}`);
    try {
        const record = await updateLife('owner', [{ id: 'credit', at: 100 }], undefined, 100, db);
        const command: LifeCommand = { type: 'buy', kind: 'flower', cell: { x: 0, z: 3 } };
        const next = commandLife(record, command, 'flower', 101);
        const warm = replayLife(next);
        for (const invalid of [
            { type: 'store', itemId: 'missing' },
            { type: 'buy', kind: 'library', cell: { x: 0, z: 4 } },
            { type: 'rotate', itemId: 'flower', rotation: 1 },
        ] satisfies LifeCommand[]) expect(() => commandLife(next, invalid, 'invalid', 101)).toThrow();
        expect(replayLife(next)).toEqual(warm);
        const receipt = structuredClone(next);
        receipt.actions.at(-1)!.purchaseReceipt!.actualPaidDrops = 0;
        expect(() => replayLife(receipt)).toThrow('購入の記録');
        // The key must detect mutations even when the caller retains the command object.
        command.cell = { x: 99, z: 99 };
        expect(() => replayLife(next)).toThrow();
    } finally { await db.delete(); clearLifeReplayCache(); }
});
