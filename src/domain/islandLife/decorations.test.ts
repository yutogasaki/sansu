import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {IslandLifeDatabase,updateLife} from './repository';
import {commandLife,replayLife} from './simulation';
import {placementUndo} from './placementUndo';
import {route,isolatedItems} from './space';
import {canStand} from './walkingSpace';
import type {LifeCommand} from './model';
async function fixture() {
    const db=new IslandLifeDatabase('decor-'+crypto.randomUUID());
    const record=await updateLife('owner',Array.from({length:8},(_,i)=>({id:'credit-'+i,at:100})),undefined,100,db);
    return {db,record};
}
describe('placeable decoration contract',()=>{
    it('issues v19 receipts without rewriting old history and deduplicates purchase and absolute rotation',async()=>{
        const {db,record}=await fixture();
        try{
            const old=structuredClone(record),buy={id:'fence',revision:record.revision,command:{type:'buy' as const,kind:'fence' as const,cell:{x:0,z:3}}};
            const bought=await updateLife('owner',[],buy,100,db);
            expect(bought.version).toBe(19);expect(bought.diagonalCutover).toEqual(old.diagonalCutover);
            expect(bought.actions.slice(0,old.actions.length)).toEqual(old.actions);
            expect(bought.actions.at(-1)?.purchaseReceipt).toMatchObject({priceVersion:'life-v19-decorations-v1',actualPaidDrops:4});
            expect(await updateLife('owner',[],buy,100,db)).toEqual(bought);
            const rotate={id:'turn',revision:bought.revision,command:{type:'rotate' as const,itemId:'fence',rotation:1 as const}};
            const turned=await updateLife('owner',[],rotate,100,db);
            expect(await updateLife('owner',[],rotate,100,db)).toEqual(turned);
            const state=replayLife(turned);expect(state.items[0].rotation).toBe(1);
            expect(state.drops).toBe(replayLife(record).drops-4);
            expect(state.residents).toEqual(replayLife(bought).residents);
            expect((await updateLife('owner',[],undefined,100,db)).version).toBe(19);
            const corrupt=structuredClone(turned);corrupt.actions.find(a=>a.id==='fence')!.purchaseReceipt!.actualPaidDrops=0;
            expect(()=>replayLife(corrupt)).toThrow('購入の記録');
            expect(()=>replayLife({...turned,version:18})).toThrow('保存版');
        }finally{await db.delete();}
    });
    it('preserves orientation across move/store/re-place, supports undo, and rejects malformed or stale retries',async()=>{
        const {db,record}=await fixture();
        try{
            let r=commandLife(record,{type:'buy',kind:'planter',cell:{x:0,z:3}},'pot',100);
            r=commandLife(r,{type:'rotate',itemId:'pot',rotation:1},'r1',100);
            r=commandLife(r,{type:'move',itemId:'pot',cell:{x:1,z:4}},'move',100);
            r=commandLife(r,{type:'rotate',itemId:'pot',rotation:2},'r2',100);
            const undo=placementUndo(r,'r2')!;expect(undo).toEqual({type:'rotate',itemId:'pot',rotation:1});
            r=commandLife(r,undo,'undo',100,'r2');
            r=commandLife(r,{type:'store',itemId:'pot'},'store',100);
            expect(placementUndo(r,'store')).toEqual({type:'move',itemId:'pot',cell:{x:1,z:4}});
            expect(replayLife(r).items[0]).toMatchObject({rotation:1,paidDrops:6});expect(replayLife(r).items[0].cell).toBeUndefined();
            r=commandLife(r,{type:'move',itemId:'pot',cell:{x:0,z:4}},'replace',100);
            expect(replayLife(r).items[0]).toMatchObject({rotation:1,cell:{x:0,z:4}});
            expect(()=>commandLife(r,{type:'rotate',itemId:'pot',rotation:3},'r1',100)).toThrow('同じ操作');
            expect(()=>commandLife(r,{type:'rotate',itemId:'pot',rotation:99} as unknown as LifeCommand,'bad',100)).toThrow('むき');
            expect(()=>commandLife(r,{type:'visit',itemId:'pot'},'visit',100)).toThrow('あそべない');
            const removed=commandLife(r,{type:'remove',itemId:'pot'},'remove',100);
            expect(replayLife(removed).drops).toBe(replayLife(r).drops+3);
        }finally{await db.delete();}
    });
    it('blocks its cell at every rotation without becoming a resident activity or isolating itself',async()=>{
        const {db,record}=await fixture();
        try{
            let r=commandLife(record,{type:'buy',kind:'fence',cell:{x:0,z:3}},'fence',100);
            for(const rotation of [0,1,2,3] as const){
                r=commandLife(r,{type:'rotate',itemId:'fence',rotation},'r'+rotation,100);
                const s=replayLife(r);expect(canStand(s,{x:0,z:3})).toBe(false);
                expect(route(s,{x:1,z:3},{x:1,z:4})).toBeDefined();expect(isolatedItems(s)).toEqual([]);
                expect(s.residents.some(resident=>resident.visit?.itemId==='fence')).toBe(false);
            }
            expect(()=>commandLife(r,{type:'buy',kind:'planter',cell:{x:0,z:3}},'overlap',100)).toThrow();
            expect(()=>commandLife(r,{type:'buy',kind:'fence',cell:{x:2,z:1}},'entrance',100)).toThrow();
        }finally{await db.delete();}
    });
});
it('requires a new save version even when a placement-clearance precedes the purchase',async()=>{
    const {db,record}=await fixture();
    try{
        const next=commandLife(record,{type:'clear-placement',kind:'fence',cell:{x:0,z:3}},'clear',100);
        expect(next.version).toBe(19);expect(replayLife(next).items).toHaveLength(0);
        expect(()=>replayLife({...next,version:18})).toThrow('保存版');
    }finally{await db.delete();}
});
