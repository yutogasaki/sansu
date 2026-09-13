import { describe, expect, it } from 'vitest';
import { evaluateDiscovery, relationDistance } from './discovery';
import { createDiscoveryScene, replayDiscoveryScene, sceneDigest } from './discoveryJournal';
import { discoveryParticipants, discoverySubject, discoveryTitle } from './discoveryRecall';
import { newLife } from './model';
import { replayLife } from './simulation';
import { validWaterPoint, waterSurfacePoint } from './waterMagic';
function fixture() {
    const s = replayLife(newLife('water', 0)); s.waterMagicVersion = 1;
    s.items = [{ id: 'water', kind: 'water-bowl', cell: { x: 0, z: 2 }, growth: 0, style: 'original' },
        { id: 'lamp', kind: 'lantern', cell: { x: 4, z: 2 }, growth: 0, style: 'original' }]; return s;
}
describe('M4 actual water and lantern', () => {
    it('uses reachable access distance and keeps the ordinary water without the new presentation version', () => {
        const s = fixture(); expect(relationDistance(s, ...s.items as [typeof s.items[0], typeof s.items[0]])).toBe(2);
        expect(evaluateDiscovery(s, 'water').find(r => r.ruleId === 'M4')).toMatchObject({ distance: 2, participantIds: ['lamp', 'water'] });
        s.items[1].cell = { x: 5, z: 4 }; expect(evaluateDiscovery(s, 'water').some(r => r.ruleId === 'M4')).toBe(false);
        s.items[1].cell = { x: 4, z: 2 }; s.waterMagicVersion = undefined;
        expect(evaluateDiscovery(s, 'water').some(r => r.ruleId === 'M4')).toBe(false);
    });
    it('requires both placed objects, without a learning or currency condition', () => {
        const s = fixture(); s.drops = 0; s.light = 0; s.days = {};
        expect(evaluateDiscovery(s, 'water').some(r => r.ruleId === 'M4')).toBe(true);
        for (const index of [0, 1]) { const copy = structuredClone(s); copy.items[index].cell = undefined; expect(evaluateDiscovery(copy, 'water').some(r => r.ruleId === 'M4')).toBe(false); }
    });
    it('keeps the touched point and original pair in immutable replay after current placement changes', async () => {
        const s = fixture(), before = structuredClone(s); s.waterTouch = { itemId: 'water', point: [.1, -.08] };
        const rule = evaluateDiscovery(s, 'water').find(r => r.ruleId === 'M4')!;
        const event = await createDiscoveryScene('water', s, rule, 'current-context-test', 'touch', 0);
        s.items[1].cell = undefined; s.waterTouch.point[0] = -.1;
        const replay = replayDiscoveryScene(event, 'replay', 1);
        expect(replay.snapshot.scene.waterTouch).toEqual({ itemId: 'water', point: [.1, -.08] });
        expect(await sceneDigest(replay.snapshot.scene)).toBe(event.snapshot.immutableHash);
        expect(discoveryParticipants(replay).map(i => i.id)).toEqual(['lamp', 'water']);
        expect(discoverySubject(replay)?.id).toBe('water'); expect(discoveryTitle(replay)).toBe('水の なかの 星空');
        expect(s.drops).toBe(before.drops); expect(s.light).toBe(before.light); expect(s.residents).toEqual(before.residents);
    });
    it('rejects absent, wrong-object and off-surface touch evidence', async () => {
        const s = fixture(), rule = evaluateDiscovery(s, 'water').find(r => r.ruleId === 'M4')!;
        await expect(createDiscoveryScene('water', s, rule, 'current-context-test', 'bad', 0)).rejects.toThrow();
        for (const point of [[1,0], [NaN,0], [Infinity,0]] as [number,number][]) {
            s.waterTouch = { itemId: 'water', point }; await expect(createDiscoveryScene('water', s, rule, 'current-context-test', 'bad', 0)).rejects.toThrow();
        }
        s.waterTouch = { itemId: 'lamp', point: [0,0] }; await expect(createDiscoveryScene('water', s, rule, 'current-context-test', 'bad', 0)).rejects.toThrow();
        expect(validWaterPoint(undefined)).toBe(false); expect(validWaterPoint("water")).toBe(false);
        expect(validWaterPoint([.3,.3])).toBe(false); expect(validWaterPoint([.1,.1])).toBe(true);
    });
});

it('keeps actual water taps and maps the large bowl rim/body to the nearest surface edge', () => {
    expect(waterSurfacePoint(.1, -.1)).toEqual([.1, -.1]);
    const edge = waterSurfacePoint(.35, .35);
    expect(validWaterPoint(edge)).toBe(true); expect(edge[0]).toBeCloseTo(edge[1]);
    expect(Math.hypot(...edge)).toBeCloseTo(.312 * .98);
});
