import { describe, expect, it } from 'vitest';
import { HOUR, learningDay, newLife } from './model';
import { occupiedCells, occupiesCell } from './footprint';
import { prepareEconomyMigration } from './economyMigration';
import { prepareTourMigration } from './tourMigration';
import { advanceLifeState, commandLife, replayLife } from './simulation';
import { pathToActivity, route, vacant } from './space';
async function source() {
    const record = newLife('facilities', 0); record.credits = Array.from({ length: 100 }, (_, i) => ({ id: `qa-${i}`, at: 0, day: learningDay(0) }));
    return prepareTourMigration(await prepareEconomyMigration(record, []));
}
describe('two-cell facilities and existing land', () => {
    it('occupies four saved cells, uses one reachable entrance and rejects overlap from either direction', async () => {
        const record = commandLife(await source(), {type:'buy',kind:'garden-hut',cell:{x:0,z:0}},'hut',0), state = replayLife(record), hut = state.items[0];
        expect(occupiedCells(hut)).toEqual([{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}]);
        expect(occupiedCells(hut).every(p=>!vacant(state,p))).toBe(true);
        expect(pathToActivity(state,{x:2,z:1},hut)?.at(-1)).toEqual({x:0,z:2});
        expect(state.residents.filter(r=>r.visit?.itemId==='hut')).toHaveLength(1);
        expect(route(state,{x:2,z:1},{x:0,z:3})?.every(p=>!occupiesCell(hut,p))).toBe(true);
        for (const cell of occupiedCells(hut)) expect(()=>commandLife(record,{type:'buy',kind:'flower',cell},'overlap',0)).toThrow();
        const flower = commandLife(await source(),{type:'buy',kind:'flower',cell:{x:1,z:1}},'flower',0);
        expect(()=>commandLife(flower,{type:'buy',kind:'garden-hut',cell:{x:0,z:0}},'hut',0)).toThrow();
        for (const cell of [{x:5,z:0},{x:0,z:4},{x:1,z:0},{x:1.5,z:2}]) expect(()=>commandLife(record,{type:'move',itemId:'hut',cell},'invalid',0)).toThrow();
        expect(()=>commandLife(record,{type:'buy',kind:'flower',cell:{x:0,z:2}},'door',0)).toThrow();
    });
    it('keeps unique ownership while stored, free relocation and half-price removal with version 10 receipts', async () => {
        let record = commandLife(await source(),{type:'buy',kind:'garden-hut',cell:{x:0,z:0}},'hut',0);
        record = commandLife(record,{type:'buy',kind:'library',cell:{x:4,z:0}},'library',0);
        expect(record.version).toBe(10); expect(replayLife(record).drops).toBe(92);
        expect(record.actions.map(a=>a.purchaseReceipt?.actualPaidDrops)).toEqual([36,72]);
        expect(record.actions.every(a=>a.purchaseReceipt?.priceVersion==='life-v3-facilities-v1')).toBe(true);
        expect(()=>replayLife({...record,version:9})).toThrow();
        const missing=structuredClone(record);delete missing.actions[1].purchaseReceipt;expect(()=>replayLife(missing)).toThrow();
        const changed=structuredClone(record);changed.actions[0].purchaseReceipt!.actualPaidDrops=2;expect(()=>replayLife(changed)).toThrow();
        const old = structuredClone(record.actions); record = commandLife(record,{type:'expand',side:'east'},'land',0);expect(record.actions.slice(0,2)).toEqual(old);expect(record.version).toBe(10);
        record=commandLife(record,{type:'store',itemId:'hut'},'store',0);
        expect(()=>commandLife(record,{type:'buy',kind:'garden-hut',cell:{x:0,z:0}},'duplicate',0)).toThrow();
        record=commandLife(record,{type:'move',itemId:'hut',cell:{x:6,z:0}},'move',0);expect(replayLife(record).drops).toBe(80);
        expect(commandLife(record,{type:'move',itemId:'hut',cell:{x:6,z:0}},'move',10)).toBe(record);
        expect(replayLife(commandLife(record,{type:'remove',itemId:'hut'},'remove',0)).drops).toBe(98);
        const split=replayLife(record);for(const at of [5000,HOUR,3*HOUR])advanceLifeState(split,at);expect(split).toEqual(replayLife(record,3*HOUR));
    });
});
