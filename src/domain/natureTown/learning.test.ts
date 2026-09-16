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
