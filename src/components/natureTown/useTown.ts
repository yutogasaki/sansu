import { useEffect, useRef, useState } from 'react';
import { getActiveProfile } from '../../domain/user/repository';
import { loadTown, persistTown, reconcileLearning, recoverTown, restoreTown, type Snapshot, type TownSave } from '../../domain/natureTown/repository';
import { applyWorldCommand } from '../../domain/natureTown/commands';
import { applyProgressCommand, capabilities } from '../../domain/natureTown/progress';
import { context } from '../../domain/natureTown/world';
import { stepWorld } from '../../domain/natureTown/simulation';
import type { DomainEvent, Capability, WorldCommandPayload } from '../../domain/natureTown/types';
import { holdPwaUpdateForCriticalPersistence } from '../../pwa';
export function useTown(paused: boolean, speed: number, learning: boolean) {
    const [save,setSave]=useState<TownSave>(), [error,setError]=useState(''), [notice,setNotice]=useState(''), [ready,setReady]=useState(false), [profileId,setProfileId]=useState('');
    const [events,setEvents]=useState<DomainEvent[]>([]);
    const current=useRef<TownSave | undefined>(undefined), generation=useRef(0), busy=useRef(false), active=useRef(false), ownsLease=useRef(false);
    const flags=useRef({paused,speed}); flags.current={paused,speed};
    const publish=(value: TownSave)=>{current.current=value;setSave(value);};
    useEffect(()=> {
        let disposed=false, release: (()=>void)|undefined, timer: ReturnType<typeof setInterval>|undefined;
        const abort=new AbortController();
        void getActiveProfile().then(async profile=> {
            if(!profile||disposed) return;
            setProfileId(profile.id);
            if(!navigator.locks) throw new Error('このブラウザーでは島を安全に保存できません。別のブラウザーを使ってください。');
            await new Promise<void>((resolve,reject)=> {
                void navigator.locks.request(`sansu-nature-town:${profile.id}`,{ifAvailable:true},async lock=> {
                    if(!lock||disposed) { reject(new Error('別のタブで この島を ひらいているよ。そちらを閉じてから戻ろう。'));return; }
                    await new Promise<void>(done=> {release=done;resolve();});
                }).catch(reject);
            });
            if(disposed) {release?.();return;}
            active.current=true; ownsLease.current=true;
            const loaded=await loadTown(profile.id), reconciled=await reconcileLearning(loaded.save);
            generation.current=loaded.generation;
            if(reconciled.progress.revision!==loaded.save.progress.revision) generation.current=await persistTown(reconciled,generation.current);
            if(disposed) return;
            publish(reconciled); setReady(true); setNotice('ほぞんできたよ');
            timer=setInterval(()=> {
                if(busy.current||!active.current||flags.current.paused||document.visibilityState!=='visible'||!current.current) return;
                const emitted: DomainEvent[]=[];
                void run(async s=> {
                    let world=s.world;
                    for(let i=0;i<flags.current.speed;i++) {
                        const result=stepWorld(world,context(capabilities(s.progress)));
                        world=result.state;emitted.push(...result.events);
                    }
                    return {...s,world};
                },emitted);
            },1000);
        }).catch(e=> {if(!disposed) setError(String(e.message??e));});
        return ()=>{disposed=true;active.current=false;ownsLease.current=false;abort.abort();if(timer)clearInterval(timer);release?.();};
        // All changing runtime inputs are refs; one writer lease per mounted owner.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    },[]);
    async function run(change: (s: TownSave)=>Promise<TownSave>, emitted?: DomainEvent[]) {
        if(!current.current||busy.current||!active.current) return false;
        busy.current=true; const hold=holdPwaUpdateForCriticalPersistence();
        try {
            const next=await change(current.current);
            if(next===current.current) return false;
            generation.current=await persistTown(next,generation.current);
            setEvents(previous=>emitted?[...previous,...emitted].filter(e=>next.world.tick-e.tick<6).slice(-24):[]);
            publish(next);setNotice('ほぞんできたよ');setError('');return true;
        } catch(e) { setError(e instanceof Error?e.message:String(e)); active.current=false;setReady(false);return false; }
        finally {busy.current=false;hold();}
    }
    async function command(payload: WorldCommandPayload) {
        return run(async s=> {
            const result=applyWorldCommand(s.world,{commandId:crypto.randomUUID(),profileId:s.world.profileId,worldId:s.world.worldId,expectedRevision:s.world.revision,payload},context(capabilities(s.progress)));
            if(result.rejection) {setNotice(result.rejection.childMessage);return s;}
            return {...s,world:result.state};
        });
    }
    async function unlock(capability: Capability, choose=false) {
        await run(async s=> {
            const result=applyProgressCommand(s.progress,choose?{type:'chooseTarget',commandId:crypto.randomUUID(),profileId:s.world.profileId,capability}:{type:'unlock',commandId:crypto.randomUUID(),profileId:s.world.profileId,expectedRevision:s.progress.revision,capability});
            if(result.rejection) {setNotice(result.rejection);return s;}
            return {...s,progress:result.progress};
        });
    }
    async function restore(snapshot: Snapshot) {
        if(busy.current||!active.current) return;
        busy.current=true;const release=holdPwaUpdateForCriticalPersistence();
        try {const result=await restoreTown(snapshot,profileId,generation.current);generation.current=result.generation;publish(result.save);setEvents([]);setNotice('書き出した島から もどしたよ。');setError('');}
        catch(e) {setError(e instanceof Error?e.message:String(e));}
        finally {busy.current=false;release();}
    }
    async function recovery() {
        if(!ownsLease.current || busy.current) {setError('この画面では復旧できません。島を開いているタブで操作してください。');return;}
        busy.current=true;const release=holdPwaUpdateForCriticalPersistence();
        try {const recovered=await recoverTown(profileId);generation.current=recovered.generation;publish(recovered.save);setEvents([]);setError('');setNotice('前の保存にもどしたよ。再読み込みして続けよう。');} catch(e) {setError(String(e));}
        finally {busy.current=false;release();}
    }
    // Re-read durable completions after returning from learning; the world clock stays paused throughout.
    const wasLearning=useRef(learning);
    useEffect(()=> {
        if(wasLearning.current&&!learning&&current.current) void run(reconcileLearning);
        wasLearning.current=learning;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    },[learning]);
    return {save,events,error,notice,ready,profileId,command,unlock,recovery,restore};
}
