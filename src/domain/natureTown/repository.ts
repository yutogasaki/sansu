import Dexie, { type Table } from 'dexie';
import type { ProfileProgress, WorldState } from './types';
import { sha256 } from './random';
import { assertProgress, assertWorld } from './validation';
import { newWorld } from './world';
import { applyProgressCommand, newProgress } from './progress';
import { completedCheckpoints } from './learning';
export interface TownSave { world: WorldState; progress: ProfileProgress; baselineEventIds: string[] }
export interface Snapshot { payload: string; checksum: string }
export interface TownRow { profileId: string; generation: number; current: Snapshot; previous?: Snapshot }
export class TownDatabase extends Dexie {
    saves!: Table<TownRow,string>;
    constructor(name='SansuNatureTownV02') { super(name); this.version(1).stores({saves:'&profileId'}); }
}
export const townDb=new TownDatabase();
export function encode(save: TownSave): Snapshot { const payload=JSON.stringify(save); return {payload,checksum:sha256(payload)}; }
export function decode(snapshot: Snapshot, profileId: string): TownSave {
    if(!snapshot||sha256(snapshot.payload)!==snapshot.checksum) throw new Error('保存の検査で違いが見つかりました。前の保存から戻せます。');
    const save=JSON.parse(snapshot.payload) as TownSave;
    assertWorld(save.world,profileId); assertProgress(save.progress,profileId);
    if(!Array.isArray(save.baselineEventIds)||save.baselineEventIds.some(id=>typeof id!=='string')) throw new Error('学習接続の記録を確認できません。');
    return save;
}
export async function loadTown(profileId: string, database=townDb) {
    const existing=await database.saves.get(profileId);
    if(existing) return {save:decode(existing.current,profileId),generation:existing.generation};
    const baselineEventIds=(await completedCheckpoints(profileId)).map(e=>e.eventId);
    const save: TownSave={world:newWorld(profileId),progress:newProgress(profileId),baselineEventIds};
    return database.transaction('rw',database.saves,async()=> {
        const raced=await database.saves.get(profileId);
        if(raced) return {save:decode(raced.current,profileId),generation:raced.generation};
        await database.saves.add({profileId,generation:0,current:encode(save)}); return {save,generation:0};
    });
}
export async function reconcileLearning(save: TownSave): Promise<TownSave> {
    let progress=save.progress;
    for(const event of await completedCheckpoints(save.world.profileId)) if(!save.baselineEventIds.includes(event.eventId)) progress=applyProgressCommand(progress,{type:'applyCheckpoint',event}).progress;
    return {...save,progress};
}
export async function persistTown(save: TownSave, expectedGeneration: number, database=townDb) {
    const profileId=save.world.profileId;
    assertWorld(save.world,profileId); assertProgress(save.progress,profileId);
    const current=encode(save);
    return database.transaction('rw',database.saves,async()=> {
        const old=await database.saves.get(profileId);
        if(!old||old.generation!==expectedGeneration) throw new Error('別の画面で島が変わりました。再読み込みしてください。');
        decode(old.current,profileId); // Never replace corrupt data with a new world.
        const generation=old.generation+1;
        await database.saves.put({profileId,generation,current,previous:old.current}); return generation;
    });
}
export async function recoverTown(profileId: string, database=townDb) {
    return database.transaction('rw',database.saves,async()=> {
        const row=await database.saves.get(profileId); if(!row?.previous) throw new Error('前の保存が見つかりません。書き出したデータを保管してください。');
        const save=decode(row.previous,profileId), generation=row.generation+1;
        await database.saves.put({...row,generation,current:row.previous,previous:row.current}); return {save,generation};
    });
}
export async function importTown(snapshot: Snapshot, profileId: string, database=townDb) {
    const incoming=decode(snapshot,profileId);
    return database.transaction('rw',database.saves,async()=> {
        const row=await database.saves.get(profileId);
        // Restore is for a blank profile/world; replacing active progress would rewind rights.
        if(row) throw new Error('このプロフィールには島があります。先に書き出して保管してください。復元は島がない環境で使えます。');
        await database.saves.add({profileId,generation:0,current:encode(incoming)}); return {save:incoming,generation:0};
    });
}
export async function deleteTownOwner(profileId: string) { if(await Dexie.exists(townDb.name)) await townDb.saves.delete(profileId); }
/** Explicit parent restore: placement/time may return, earned progress never goes backwards. */
export async function restoreTown(snapshot: Snapshot, profileId: string, expectedGeneration: number, database=townDb) {
    const incoming=decode(snapshot,profileId);
    return database.transaction('rw',database.saves,async()=> {
        const row=await database.saves.get(profileId);
        if(!row||row.generation!==expectedGeneration) throw new Error('保存が変わりました。再読み込みしてください。');
        const current=decode(row.current,profileId), progress=structuredClone(current.progress);
        for(const award of incoming.progress.awards) if(!progress.awards.some(a=>a.eventId===award.eventId||a.awardKey===award.awardKey)) progress.awards.push(award);
        for(const unlock of incoming.progress.unlocks) if(!progress.unlocks.some(u=>u.capability===unlock.capability)) progress.unlocks.push(unlock);
        progress.revision=Math.max(progress.revision,incoming.progress.revision)+1;
        assertProgress(progress,profileId);
        const save={...incoming,progress,baselineEventIds:[...new Set([...current.baselineEventIds,...incoming.baselineEventIds])]};
        const generation=row.generation+1;
        await database.saves.put({profileId,generation,current:encode(save),previous:row.current});return {save,generation};
    });
}
