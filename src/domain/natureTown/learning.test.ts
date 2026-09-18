import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { openIsland, startIslandPlan } from '../island/repository';
import { commitIslandLearning } from '../island/commit';
import { parkHissanGrid } from '../park/learning';
import { completedCheckpoints } from './learning';
import { applyProgressCommand, balanceUnits, newProgress } from './progress';
const databases: SansuDatabase[]=[];
async function setup() {
    const d=new SansuDatabase(`nature-learning-${crypto.randomUUID()}`);databases.push(d);
    const p={...createInitialProfile('test',2,1,1,'math'),id:'p',soundEnabled:false};
    await d.profiles.put(p);await d.appData.put({id:'app',schemaVersion:1,activeProfileId:p.id,profiles:{[p.id]:p}});await openIsland(p.id,d);return d;
}
afterEach(async()=>{await Promise.all(databases.splice(0).map(d=>d.delete()));});
describe('durable completed-section adapter',()=> {
    it('EDU-04 preserves an earned unit and partial work across wrong answer, skip and database reopen',async()=> {
        const d=await setup();let plan=await startIslandPlan('p',d);
        while(plan.status==='active') {
            plan=(await commitIslandLearning('p',plan.id,plan.revision,{type:'support_opened'},d)).plan;
            plan=(await commitIslandLearning('p',plan.id,plan.revision,{type:'model_opened'},d)).plan;
            plan=(await commitIslandLearning('p',plan.id,plan.revision,{type:'supported_completed'},d)).plan;
        }
        const earned=await completedCheckpoints('p',d);
        expect(earned).toHaveLength(1);
        let progress=applyProgressCommand(newProgress('p'),{type:'applyCheckpoint',event:earned[0]}).progress;
        plan=await startIslandPlan('p',d);
        plan=(await commitIslandLearning('p',plan.id,plan.revision,{type:'answer',answer:'wrong'},d)).plan;
        expect(await completedCheckpoints('p',d)).toEqual(earned);
        plan=(await commitIslandLearning('p',plan.id,plan.revision,{type:'skipped'},d)).plan;
        expect(plan.status).toBe('active');
        expect(plan.slots[plan.cursor].completed).toBe(false);
        expect(await completedCheckpoints('p',d)).toEqual(earned);
        const logs=await d.logs.toArray();
        expect(logs.map(l=>l.result)).toEqual(['incorrect','skipped']);
        d.close();await d.open();
        expect(await startIslandPlan('p',d)).toEqual(plan);
        expect(await d.logs.toArray()).toEqual(logs);
        for(const event of await completedCheckpoints('p',d)) progress=applyProgressCommand(progress,{type:'applyCheckpoint',event}).progress;
        expect(balanceUnits(progress)).toBe(1);
        plan=(await commitIslandLearning('p',plan.id,plan.revision,{type:'model_opened'},d)).plan;
        plan=(await commitIslandLearning('p',plan.id,plan.revision,{type:'supported_completed'},d)).plan;
        expect(plan.slots[0].completed).toBe(true);
        expect(plan.status).toBe('active');
        expect(await completedCheckpoints('p',d)).toEqual(earned);
    });
    it.each([false,true])('EDU-01/03/04 replays committed completion (supported=%s) exactly once',async supported=> {
        const d=await setup();let plan=await startIslandPlan('p',d);
        expect(await completedCheckpoints('p',d)).toEqual([]);
        while(plan.status==='active') {
            const slot=plan.slots[plan.cursor];
            if(supported) {
                plan=(await commitIslandLearning('p',plan.id,plan.revision,{type:'support_opened'},d)).plan;
                plan=(await commitIslandLearning('p',plan.id,plan.revision,{type:'model_opened'},d)).plan;
                plan=(await commitIslandLearning('p',plan.id,plan.revision,{type:'supported_completed'},d)).plan;
            } else {
                const grid=parkHissanGrid(slot.problem);
                plan=(await commitIslandLearning('p',plan.id,plan.revision,{type:'answer',answer:grid?grid.steps[slot.hissanStep??0].correctValues:slot.problem.correctAnswer},d)).plan;
            }
        }
        const before=await d.logs.toArray(), events=await completedCheckpoints('p',d);
        expect(events).toHaveLength(1);expect(events[0].completion).toBe(supported?'supported':'independent');
        let progress=newProgress('p');
        for(const event of [...events,...await completedCheckpoints('p',d)]) progress=applyProgressCommand(progress,{type:'applyCheckpoint',event}).progress;
        expect(balanceUnits(progress)).toBe(1);expect(await d.logs.toArray()).toEqual(before);
        expect(await completedCheckpoints('other',d)).toEqual([]);
    });
});
