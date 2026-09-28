import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { IslandLifeDatabase, updateLife } from './repository';
import { commandLife, replayLife } from './simulation';
import { newLife, type LifeState } from './model';
import { inviteFriend, noticeFriendPlace, noticeSharedMeals, validateResidency } from './residency';
import { clearLifeReplayCache } from './replayCache';
import { buildLifeScene } from '../../components/island/life/scene';
const databases: IslandLifeDatabase[] = [];
const database = () => { const d = new IslandLifeDatabase(`friends-${crypto.randomUUID()}`); databases.push(d); return d; };
afterEach(async () => { clearLifeReplayCache(); await Promise.all(databases.splice(0).map(d => d.delete())); });

it('starts new owners with Pokomoko, preserves existing friends, and rejects a downgraded record', async () => {
    const d = database();
    const fresh = await updateLife('new', [], undefined, 100, d);
    expect(fresh.version).toBe(21); expect(replayLife(fresh).residents.map(r => r.id)).toEqual(['pokomoko']);
    await d.worlds.put(newLife('old', 0));
    const old = await updateLife('old', [], undefined, 100, d);
    expect(replayLife(old).residents.map(r => r.id)).toEqual(['pokomoko', 'rabbit', 'otter']);
    expect(() => validateResidency({ ...fresh, version: 20 })).toThrow();
    const again = await updateLife('new', [], undefined, 200, d);
    expect(again.residencyCutover).toEqual(fresh.residencyCutover);
});

it('keeps invitation rights after rearrangement and does not invent them for an idle timer', () => {
    const s = replayLife(newLife('child', 0)); s.residents = s.residents.slice(0, 1); s.residency = { joined: [], invitations: {} };
    const flower = { id: 'f', kind: 'flower' as const, cell: { x: 0, z: 3 }, growth: 6, style: 'original' as const };
    const bench = { ...flower, id: 'b', kind: 'bench' as const, cell: { x: 1, z: 3 } };
    s.items = [flower, bench]; const visit = { itemId: 'b', from: { x: 1, z: 4 }, path: [{ x: 1, z: 4 }], start: 0, end: 100 };
    noticeFriendPlace(s, 'pokomoko', bench, visit, false); expect(s.residency.invitations).toEqual({});
    noticeFriendPlace(s, 'pokomoko', bench, visit, true); expect(s.residency.invitations.rabbit?.reason).toBe('flowers');
    s.items = []; inviteFriend(s, 'rabbit'); inviteFriend(s, 'rabbit'); expect(s.residency.joined).toEqual(['rabbit']); expect(s.residents.map(r => r.id)).toEqual(['pokomoko', 'rabbit']);
});

it('requires real deliveries and meals before the shared-meal invitation', () => {
    const s = replayLife(newLife('child', 0)); s.residency = { joined: ['rabbit'], invitations: {} };
    s.food = { plots: {}, tables: {}, pantry: 0, harvested: 3, delivered: 2, eaten: 3 };
    noticeSharedMeals(s, 'table'); expect(s.residency.invitations).toEqual({});
    s.food.delivered = 3; noticeSharedMeals(s, 'table'); expect(s.residency.invitations.otter?.reason).toBe('shared-meal');
    expect(s.drops).toBe(0); expect(s.expanded).toBeUndefined();
});

it('renders an otter-first island with the correct rig and hidden uninvited rabbit', () => {
    const s: LifeState = replayLife(newLife('child', 0)); s.residents = s.residents.filter(r => r.id !== 'rabbit');
    s.worldStyle = 'fantasy-garden-v1'; const scene = buildLifeScene(s);
    try {
        scene.animate(0, true); expect(scene.audit().map(r => r.id)).toEqual(['pokomoko', 'otter']);
        expect(scene.root.getObjectByName('life-resident-rabbit')?.visible).toBe(false);
        expect(scene.root.getObjectByName('life-resident-otter')?.visible).toBe(true);
    } finally { scene.dispose(); }
});

it('rejects unearned membership and preserves version21 across other actions and reload', async () => {
    const d = database(); const first = await updateLife('new', [], undefined, 100, d);
    await expect(updateLife('new', [], { id: 'unearned', revision: first.revision, command: { type: 'invite-friend', friend: 'otter' } }, 101, d)).rejects.toThrow();
    expect(await d.worlds.get('new')).toEqual(first);
    const funded = await updateLife('new', [{ id: 'one', at: 102 }], undefined, 102, d);
    const bought = commandLife(funded, { type: 'buy', kind: 'flower', cell: { x: 0, z: 3 } }, 'flower', 102);
    expect(bought.version).toBe(21); clearLifeReplayCache(); expect(replayLife(bought).items).toHaveLength(1);
});

async function qualifiedOtter(d: IslandLifeDatabase) {
    let record = await updateLife('child', [], undefined, 100, d);
    record = await updateLife('child', Array.from({ length: 3 }, (_, i) => ({ id: `lesson-${i}`, at: 101 })), undefined, 102, d);
    for (const [id, kind, x] of [['flower', 'flower', 0], ['bowl', 'water-bowl', 1]] as const) {
        record = await updateLife('child', [], { id, revision: record.revision, command: { type: 'buy', kind, cell: { x, z: 3 } } }, 103, d);
    }
    record = await updateLife('child', [], { id: 'call', revision: record.revision, command: { type: 'visit', itemId: 'bowl' } }, 104, d);
    return updateLife('child', [], undefined, 60104, d);
}
it('earns a real completed visit, persists the invitation and makes retries, CAS and abort safe', async () => {
    const d = database(), qualified = await qualifiedOtter(d);
    expect(replayLife(qualified).residency?.invitations.otter?.reason).toBe('water');
    const intent = { id: 'invite', revision: qualified.revision, command: { type: 'invite-friend' as const, friend: 'otter' as const } };
    const put = vi.spyOn(d.worlds, 'put').mockRejectedValueOnce(new Error('abort'));
    await expect(updateLife('child', [], intent, qualified.realAt + 1, d)).rejects.toThrow('abort');
    put.mockRestore(); expect(await d.worlds.get('child')).toEqual(qualified);
    const results = await Promise.allSettled([updateLife('child', [], intent, qualified.realAt + 2, d),
        updateLife('child', [], { ...intent, id: 'other-tab' }, qualified.realAt + 2, d)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const saved = (await d.worlds.get('child'))!;
    expect(saved.actions.filter(a => a.command.type === 'invite-friend')).toHaveLength(1);
    expect(await updateLife('child', [], intent, qualified.realAt + 3, d)).toEqual(saved);
    const warm = replayLife(saved); clearLifeReplayCache(); const cold = replayLife(saved);
    // Replaying soil relaxation in smaller intervals differs only by float rounding.
    for (const [cell, value] of Object.entries(cold.soilMoisture ?? {})) expect(value).toBeCloseTo(warm.soilMoisture![cell], 12);
    expect({ ...cold, soilMoisture: undefined }).toEqual({ ...warm, soilMoisture: undefined }); expect(cold.residents.map(r => r.id)).toEqual(['pokomoko', 'otter']);
    expect(cold.drops).toBe(replayLife(qualified).drops);
    expect(saved.credits).toEqual(qualified.credits);
    const stored = commandLife(saved, { type: 'store', itemId: 'bowl' }, 'store', saved.now);
    clearLifeReplayCache(); expect(replayLife(stored).residency?.joined).toEqual(['otter']);
});
it('rejects forged ownership and cutover payloads before changing the stored world', async () => {
    const d = database(), record = await updateLife('child', [], undefined, 100, d);
    for (const patch of [{ profileId: 'other' }, { validationHash: '0'.repeat(64), initialFriends: ['rabbit'] as const }, { at: NaN }]) {
        const broken = structuredClone(record); Object.assign(broken.residencyCutover!, patch);
        await d.worlds.put(broken);
        await expect(updateLife('child', [], undefined, 200, d)).rejects.toThrow();
        expect(await d.worlds.get('child')).toEqual(broken);
    }
});
