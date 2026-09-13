import { expect, it } from 'vitest';
import { evaluateDiscovery } from './discovery';
import { groupEncounters } from './groupEncounters';
import { createDiscoveryScene, replayDiscoveryScene, sceneDigest } from './discoveryJournal';
import { newLife, type LifeItem } from './model';
import { replayLife } from './simulation';

function fixture(tree = false) {
    const s = replayLife(newLife('encounter', 0)); s.encounterVersion = 1; s.landscapeVersion = 'groves-water-v1';
    s.items = Array.from({ length: tree ? 3 : 6 }, (_, i): LifeItem => ({ id: `plant-${i}`, kind: tree ? 'sapling' : 'flower',
        cell: { x: i % 3, z: 2 + Math.floor(i / 3) }, growth: 18, style: 'original' }));
    s.items.push({ id: 'water', kind: 'water-bowl', cell: { x: 4, z: 2 }, growth: 0, style: 'original' });
    return s;
}
for (const tree of [false, true]) it(`${tree ? 'X2' : 'X1'} uses mature real perimeter access and preserves original participants without a reward`, async () => {
    const s = fixture(tree), id = tree ? 'X2' : 'X1', normalId = tree ? 'GT3' : 'GF6';
    const rules = evaluateDiscovery(s, 'encounter'), candidate = groupEncounters(s, rules)[0];
    expect(candidate.distance).toBe(0); expect(candidate.path).toEqual([{ x: 3, z: 2 }]);
    const rule = rules.find(r => r.ruleId === id)!; expect(rule).toBeDefined();
    await expect(createDiscoveryScene('encounter', s, rule, 'current-context-test', 'without-input', 0)).rejects.toThrow();
    s.encounterTouch = { ruleId: id, normalRuleId: normalId, normalGroupIds: candidate.group.participantIds, waterId: 'water', plantId: candidate.plant.id };
    const before = structuredClone(s), event = await createDiscoveryScene('encounter', s, rule, 'current-context-test', 'seen', 0);
    expect(s).toEqual(before);
    s.items.find(i => i.id === 'water')!.cell = undefined;
    expect(evaluateDiscovery(s, 'encounter').some(r => r.ruleId === id)).toBe(false);
    const again = replayDiscoveryScene(event, 'replay', 1); expect(await sceneDigest(again.snapshot.scene)).toBe(event.snapshot.immutableHash);
    expect(again.snapshot.scene.encounterTouch).toEqual(before.encounterTouch);
});

it('has no hint condition for an immature group, insufficient group, distant water, or legacy snapshot', () => {
    const s = fixture(); const has = () => evaluateDiscovery(s, 'encounter').some(r => r.ruleId === 'X1');
    s.items[0].growth = 0; expect(has()).toBe(false); s.items[0].growth = 18;
    s.expanded = 'east'; s.items.at(-1)!.cell = { x: 8, z: 4 }; expect(has()).toBe(false);
    s.items.at(-1)!.cell = { x: 4, z: 2 }; expect(has()).toBe(true);
    s.encounterVersion = undefined; expect(has()).toBe(false);
});
