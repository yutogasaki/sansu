import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { lifeCatalogKinds, lifeDiscoveryEnabled, lifeDiscoveryPresentation } from './capabilities';
import { CATALOG } from './model';
import { IslandLifeDatabase, updateLife } from './repository';
import { replayLife } from './simulation';
afterEach(()=>vi.unstubAllEnvs());
function production(enabled: boolean) {
    vi.stubEnv('DEV',false);vi.stubEnv('VITE_ISLAND_LIFE_ENABLED','true');
    vi.stubEnv('VITE_ISLAND_LIFE_PREVIEW','true');vi.stubEnv('VITE_ISLAND_LIFE_DISCOVERY_ENABLED',String(enabled));
}
it('requires explicit production capability, without DEV art or preview access',()=>{
    production(false);expect(lifeCatalogKinds()).toEqual(['flower','bench','swing','lantern','fence','planter']);expect(lifeDiscoveryPresentation()).toEqual({});
    production(true);expect(lifeCatalogKinds()).toEqual(Object.keys(CATALOG));expect(lifeDiscoveryPresentation().waterMagicVersion).toBe(1);
    expect(lifeDiscoveryPresentation()).not.toHaveProperty('worldStyle');
    vi.stubEnv('VITE_ISLAND_LIFE_ENABLED','false');expect(lifeDiscoveryEnabled()).toBe(false);
    vi.stubEnv('DEV',true);expect(lifeDiscoveryEnabled()).toBe(true);
});
it('retains already-owned extra item presentations when new purchases are disabled',()=>{
    production(false);expect(lifeDiscoveryPresentation([{kind:'library'}]).facilityPresentation).toBe('carry-care-v1');
    expect(lifeDiscoveryPresentation([{kind:'flower'}])).toEqual({});expect(lifeCatalogKinds()).not.toContain('library');
});
it('checks production capability at purchase commit but preserves earlier receipts and ownership',async()=>{
    production(true);const db=new IslandLifeDatabase('capability-'+crypto.randomUUID());
    try {
        let record=await updateLife('owner',[],undefined,100,db);
        record=await updateLife('owner',Array.from({length:3},(_,i)=>({id:'credit-'+i,at:101+i})),undefined,104,db);
        const intent={id:'sapling',revision:record.revision,command:{type:'buy' as const,kind:'sapling' as const,cell:{x:0,z:3}}};
        const bought=await updateLife('owner',[],intent,105,db);expect(replayLife(bought).items.some(i=>i.kind==='sapling')).toBe(true);
        production(false);expect(await updateLife('owner',[],intent,106,db)).toEqual(bought);
        await expect(updateLife('owner',[],{...intent,id:'another',revision:bought.revision},107,db)).rejects.toThrow('えらべない');
        expect(await db.worlds.get('owner')).toEqual(bought);
        const item=replayLife(bought).items.find(i=>i.kind==='sapling')!;
        const stored=await updateLife('owner',[],{id:'store',revision:bought.revision,command:{type:'store',itemId:item.id}},108,db);
        expect(replayLife(stored).items.find(i=>i.id===item.id)).toMatchObject({kind:'sapling',paidDrops:4});
        expect(replayLife(stored).items.find(i=>i.id===item.id)?.cell).toBeUndefined();
    } finally {await db.delete();}
});
