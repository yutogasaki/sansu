import { expect, it } from 'vitest';
import { footstepWalker, inLanternGround, lanternGround } from './footstepMagic';
import { evaluateDiscovery } from './discovery';
import { createDiscoveryScene, replayDiscoveryScene, sceneDigest } from './discoveryJournal';
import { newLife } from './model';
import { replayLife } from './simulation';
import { route } from './space';

it('lights exactly two reachable steps from actual access points and excludes occupied ground', () => {
    const s = replayLife(newLife('light', 0));
    s.items = [{ id: 'lamp', kind: 'lantern', cell: { x: 0, z: 2 }, growth: 0, style: 'original', access: 'front' },
        { id: 'wall', kind: 'bench', cell: { x: 1, z: 3 }, growth: 0, style: 'original' }];
    const cells = lanternGround(s, s.items[0]);
    expect(cells).toContainEqual({ x: 0, z: 3 });
    expect(cells).not.toContainEqual({ x: 1, z: 3 });
    expect(cells).not.toContainEqual({ x: 2, z: 3 });
    for (const c of cells) expect(route(s, { x: 0, z: 3 }, c)!.length - 1).toBeLessThanOrEqual(2);
    expect(inLanternGround(cells, [0, 3])).toBe(true);
    expect(inLanternGround(cells, [1, 3])).toBe(false);
    s.items[0].cell = undefined;
    expect(lanternGround(s, s.items[0])).toEqual([]);
});

it('shares exact tile boundaries with light geometry and rejects malformed points', () => {
    const cells = [{ x: 1, z: 2 }];
    expect(inLanternGround(cells, [.5, 1.5])).toBe(true);
    for (const p of [[1.5, 2], [1, 2.5], [NaN, 2], [1], [1, 2, 3]]) expect(inLanternGround(cells, p)).toBe(false);
});

it('requires explicit destination input and real walking; preserves the original path and free economy', async () => {
    const s = replayLife(newLife('walking', 0)); s.now = 600; s.footstepMagicVersion = 1; s.target = 'bench';
    s.items = [{ id: 'lamp', kind: 'lantern', cell: { x: 2, z: 3 }, growth: 0, style: 'original' },
        { id: 'bench', kind: 'bench', cell: { x: 5, z: 2 }, growth: 0, style: 'original' }];
    s.residents[0].visit = { itemId: 'bench', from: { x: 2, z: 1 }, path: [{ x: 2, z: 1 }, { x: 3, z: 1 }, { x: 4, z: 1 }, { x: 4, z: 2 }, { x: 4, z: 3 }, { x: 5, z: 3 }], start: 0, end: 30000 };
    expect(footstepWalker(s, 'bench')?.id).toBe('pokomoko');
    expect(evaluateDiscovery(s, 'walking').some(r => r.ruleId === 'M1')).toBe(false);
    s.footstepTouch = { targetId: 'bench', lampId: 'lamp', visitStart: 0, point: [3, 1] };
    const before = structuredClone(s), rule = evaluateDiscovery(s, 'walking').find(r => r.ruleId === 'M1')!;
    expect(rule).toBeDefined();
    const event = await createDiscoveryScene('walking', s, rule, 'live', 'step', 0, ['pokomoko']);
    expect(s).toEqual(before);
    s.items[0].cell = undefined; s.residents[0].visit = undefined;
    expect(evaluateDiscovery(s, 'walking').some(r => r.ruleId === 'M1')).toBe(false);
    const again = replayDiscoveryScene(event, 'replay', 1);
    expect(again.snapshot.scene.residents[0].visit).toEqual(before.residents[0].visit);
    expect(await sceneDigest(again.snapshot.scene)).toBe(event.snapshot.immutableHash);
    const ended = { ...before, now: 6000 }; expect(footstepWalker(ended, 'bench')).toBeUndefined();
    expect(footstepWalker({ ...before, footstepMagicVersion: undefined }, 'bench')).toBeUndefined();
});
