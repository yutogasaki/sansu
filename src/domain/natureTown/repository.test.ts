import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { decode, encode, importTown, persistTown, recoverTown, restoreTown, TownDatabase, type TownSave } from './repository';
import { context, newWorld } from './world';
import { newProgress } from './progress';
import { stepWorld } from './simulation';
const stores: TownDatabase[]=[];
const fresh=()=>{const d=new TownDatabase(`nature-test-${crypto.randomUUID()}`);stores.push(d);return d;};
const initial=(id='p'):TownSave=>({world:newWorld(id),progress:newProgress(id),baselineEventIds:[]});
afterEach(async()=>{await Promise.all(stores.splice(0).map(d=>d.delete()));});
describe('separate transactional Nature Town snapshots',()=> {
    it('SAFE-01/08 exports and restores the exact saved active tick, without wall-clock catchup',async()=> {
        const save=initial();save.world=stepWorld(save.world,context()).state;
        const db=fresh();await importTown(encode(save),'p',db);
        expect(decode((await db.saves.get('p'))!.current,'p')).toEqual(save);
        expect(()=>decode(encode(save),'another-profile')).toThrow();
    });
    it('SAFE-02 rejects corrupt data and preserves the previous valid snapshot',async()=> {
        const db=fresh(),save=initial();await importTown(encode(save),'p',db);
        const next={...save,world:stepWorld(save.world,context()).state};await persistTown(next,0,db);
        const row=(await db.saves.get('p'))!;await db.saves.put({...row,current:{...row.current,payload:'broken'}});
        await expect(persistTown(next,1,db)).rejects.toThrow();
        const recovered=await recoverTown('p',db);expect(recovered.save).toEqual(save);
        expect((await db.saves.get('p'))!.previous?.payload).toBe('broken');
    });
    it('SAFE-03 uses compare-and-swap and isolates owners',async()=> {
        const db=fresh(),save=initial();await importTown(encode(save),'p',db);await importTown(encode(initial('q')),'q',db);
        const results=await Promise.allSettled([persistTown(save,0,db),persistTown(save,0,db)]);
        expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((await db.saves.get('q'))!.generation).toBe(0);
    });
    it('SAFE-08 restores world state while preserving later earned rights',async()=> {
        const db=fresh(),save=initial();await importTown(encode(save),'p',db);
        const later=initial();later.progress.awards=[{eventId:'earned',awardKey:'key',units:3,learningRecordRef:'record'}];
        later.progress.unlocks=[{transactionId:'unlock',capability:'irrigation',spentUnits:3,priceVersion:'0.2.0'}];
        await persistTown(later,0,db);
        const restored=await restoreTown(encode(save),'p',1,db);
        expect(restored.save.progress.unlocks).toEqual(later.progress.unlocks);
        expect(restored.save.progress.awards).toEqual(later.progress.awards);
    });
    it('rejects forged inventory even with a recomputed checksum',()=> {
        const save=initial(),hub=save.world.props.find(p=>p.kind==='hub')!;if(hub.kind!=='hub')throw Error();hub.inventory.food=25;
        expect(()=>decode(encode(save),'p')).toThrow();
        const bad=initial();bad.world.residents[0].homeId='missing';expect(()=>decode(encode(bad),'p')).toThrow();
    });
});
