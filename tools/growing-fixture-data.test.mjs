import 'fake-indexeddb/auto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GrowingIslandDatabase, syncGrowingIsland } from '../src/domain/growingIsland/repository';
import { EPOCH, hash, loadDomain, main, makePack, ownedState, stableJSON, validatePack } from './growing-fixture-data.mjs';
import { parseOptions } from './e2e-growing-fixtures.mjs';

let pack, loaded;
const directories = [], databases = [];
beforeAll(async () => { loaded = await loadDomain(); pack = await makePack(); });
afterEach(async () => {
    await Promise.all(databases.splice(0).map(database => database.delete()));
    await Promise.all(directories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })));
});
const changed = mutate => { const copy = structuredClone(pack); mutate(copy); copy.payloadHash = hash(stableJSON(copy.cases)); return copy; };

describe('fixed Growing QA saves', () => {
    it('is deterministic across fresh profile UUIDs and timestamps', async () => {
        expect(stableJSON(await makePack())).toBe(stableJSON(pack));
        expect(pack.cases.map(item => item.island.state.villagers.length)).toEqual([0, 2, 13]);
        expect(pack.cases.map(item => item.island.state.plots.length + item.island.state.landmarks.length)).toEqual([2, 10, 40]);
    });
    it('keeps the same provenance in another checkout with shared dependencies', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sansu-fixture-checkout-')); directories.push(root);
        for (const file of ['src', 'node_modules', 'package-lock.json']) await fs.symlink(path.resolve(file), path.join(root, file));
        const other = await loadDomain(root);
        expect(other.sourceHash).toBe(loaded.sourceHash);
        expect(validatePack(pack, other)).toBe(pack);
    });
    it('can be opened by the current real repository without changing ownership or learning', async () => {
        const database = new GrowingIslandDatabase(`qa-pack-${crypto.randomUUID()}`); databases.push(database);
        await database.islands.bulkPut(pack.cases.map(item => item.island));
        for (const item of pack.cases) {
            const result = await syncGrowingIsland(item.profile.id, [], EPOCH, database);
            expect(ownedState(result.record.state)).toEqual(ownedState(item.island.state));
            expect(result.record.version).toBe(3);
            expect(result.learned).toBe(0);
        }
    });
    it('rejects corrupted payloads and a changed source/lock or clock condition', () => {
        const corrupt = structuredClone(pack); corrupt.cases[0].island.state.drops++;
        expect(() => validatePack(corrupt, loaded)).toThrow('payload hash');
        expect(() => validatePack(pack, { ...loaded, sourceHash: 'changed' })).toThrow('domain/lock');
        expect(() => validatePack({ ...pack, timezone: 'UTC' }, loaded)).toThrow();
    });
    it('rejects mixed owners, old versions and invented learning records even with a renewed hash', () => {
        expect(() => validatePack(changed(copy => { copy.cases[1].island.profileId = 'another-child'; }), loaded)).toThrow();
        expect(() => validatePack(changed(copy => { copy.cases[1].island.version = 1; }), loaded)).toThrow();
        expect(() => validatePack(changed(copy => { copy.cases[1].island.state.learned.push('fake-answer'); }), loaded)).toThrow();
        expect(() => validatePack(changed(copy => { copy.cases[1].profile.todayCount = 20; }), loaded)).toThrow();
    });
    it('rejects unreachable/dangling housing and invalid coordinates', () => {
        expect(() => validatePack(changed(copy => { copy.cases[2].island.state.villagers[0].home = 'missing'; }), loaded)).toThrow('Dangling');
        expect(() => validatePack(changed(copy => { copy.cases[2].island.state.plots[0].cell.x = 999; }), loaded)).toThrow('outside');
        expect(() => validatePack(changed(copy => { copy.cases[1].island.state.villagers.push({ ...copy.cases[1].island.state.villagers[0], id: 'overflow' }); }), loaded)).toThrow('overflow');
    });
    it('does not overwrite an existing output or accept unknown CLI flags', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sansu-fixture-test-')); directories.push(root);
        const output = path.join(root, 'pack');
        await main(['--output-dir', output]);
        const before = await fs.readFile(path.join(output, 'fixtures.json'), 'utf8');
        await expect(main(['--output-dir', output])).rejects.toThrow('EEXIST');
        expect(await fs.readFile(path.join(output, 'fixtures.json'), 'utf8')).toBe(before);
        await expect(main(['--overwrite'])).rejects.toThrow('Usage');
    });
    it('limits capture to loopback and keeps evidence outside the build', () => {
        const args = ['--url', 'http://127.0.0.1:5298', '--build-dir', '/tmp/dist', '--fixtures', '/tmp/fixtures.json', '--output-dir', '/tmp/captures'];
        expect(parseOptions(args).base).toBe('http://127.0.0.1:5298');
        expect(() => parseOptions(args.map(value => value === 'http://127.0.0.1:5298' ? 'https://sansu.example' : value))).toThrow('loopback');
        expect(() => parseOptions(args.map(value => value === '/tmp/captures' ? '/tmp/dist/captures' : value))).toThrow('outside');
        expect(() => parseOptions([...args, '--overwrite', 'yes'])).toThrow('once each');
    });
});
