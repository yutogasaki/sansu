import balance from './balance.json';
import type { Capability, ProfileProgress, ProgressCommand } from './types';
export const newProgress = (profileId: string): ProfileProgress => ({profileId,revision:0,awards:[],unlocks:[],initialCapabilities:balance.learning.initialCapabilities as Capability[]});
export const balanceUnits = (p: ProfileProgress) => p.awards.reduce((s,a)=>s+a.units,0)-p.unlocks.reduce((s,u)=>s+u.spentUnits,0);
export const capabilities = (p: ProfileProgress) => new Set([...p.initialCapabilities,...p.unlocks.map(u=>u.capability)]);
export function applyProgressCommand(progress: ProfileProgress, command: ProgressCommand): {progress: ProfileProgress; duplicate: boolean; rejection?: string} {
    const rejected=(rejection: string)=>({progress,duplicate:false,rejection});
    const next=structuredClone(progress);
    if(command.type==='applyCheckpoint') {
        const e=command.event, awardKey=JSON.stringify([e.profileId,e.assignmentId,e.checkpointId]);
        if(e.profileId!==progress.profileId||!e.eventId||!e.assignmentId||!e.checkpointId||!e.learningRecordRef||!e.issuerVersion||!['independent','supported'].includes(e.completion)||!['math','english'].includes(e.subject)||!Number.isSafeInteger(e.issuedUnits)||e.issuedUnits<=0) return rejected('invalid-checkpoint');
        if(progress.awards.some(a=>a.eventId===e.eventId||a.awardKey===awardKey)) return {progress,duplicate:true};
        next.awards.push({eventId:e.eventId,awardKey,units:e.issuedUnits,learningRecordRef:e.learningRecordRef});
    } else {
        if(command.profileId!==progress.profileId) return rejected('profile-mismatch');
        if(command.capability!=='irrigation'&&command.capability!=='handcart') return rejected('invalid-capability');
        if(capabilities(progress).has(command.capability)) return {progress,duplicate:true};
        const cost=progress.target?.capability===command.capability?progress.target.quotedCost:balance.learning.unlockCosts[command.capability];
        if(command.type==='chooseTarget') next.target={capability:command.capability,quotedCost:cost,priceVersion:balance.specVersion};
        else {
            if(progress.revision!==command.expectedRevision) return rejected('revision-conflict');
            if(balanceUnits(progress)<cost) return rejected('まだ ひらける ところまで とどいていないよ。');
            next.unlocks.push({transactionId:command.commandId,capability:command.capability,spentUnits:cost,priceVersion:progress.target?.priceVersion??balance.specVersion});
            if(next.target?.capability===command.capability) delete next.target;
        }
    }
    next.revision++; return {progress:next,duplicate:false};
}
