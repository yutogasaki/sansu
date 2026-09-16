import { db, type SansuDatabase } from '../../db';
import type { LearningCheckpointCompleted } from './types';
/** One completed, durably reserved section is one checkpoint. Never grade in the game. */
export async function completedCheckpoints(profileId: string, database: SansuDatabase=db): Promise<LearningCheckpointCompleted[]> {
    return database.transaction('r',[database.islandPlans,database.islandEvents],async()=> {
        const plans=await database.islandPlans.where('profileId').equals(profileId).toArray();
        const events=await database.islandEvents.where('profileId').equals(profileId).toArray();
        return plans.filter(p=>p.status==='completed'&&p.slots.length>0&&p.slots.every(s=>s.completed)).flatMap(p=> {
            const terminal=p.slots.map((_,i)=>events.filter(e=>e.planId===p.id&&e.slotIndex===i&&['answer','supported_completed'].includes(e.type)&&['correct','assisted-correct','supported-completion'].includes(e.result??'')).sort((a,b)=>b.timestamp-a.timestamp||a.id.localeCompare(b.id))[0]);
            const receipt=events.find(e=>e.planId===p.id&&e.type==='plan_completed');
            if(!receipt||terminal.some(e=>!e)) return [];
            return [{eventId:`nature:${receipt.id}`,profileId,assignmentId:p.id,checkpointId:'completed-section',subject:p.subject==='vocab'?'english' as const:'math' as const,completion:terminal.some(e=>e.result!=='correct')?'supported' as const:'independent' as const,issuedUnits:1,learningRecordRef:`islandPlans:${p.id}`,issuerVersion:'island-section-v1'}];
        }).sort((a,b)=>a.eventId.localeCompare(b.eventId));
    });
}
