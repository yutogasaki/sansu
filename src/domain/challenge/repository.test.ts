import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { createLearningProblemContext } from '../learning/context';
import { learningEvidenceForProblem } from '../learning/attemptContext';
import type { Problem } from '../types';
import { startChallenge, markShown, finishChallenge, interruptChallenge, readChallengeHome, recoverChallenge, setChallengeAwardDisplayed } from './repository';
import type { ChallengeAnswer } from './types';
const databases: SansuDatabase[] = [];
let profileId: string;
beforeEach(() => {
 profileId = `child-${crypto.randomUUID()}`;
 const held = new Set<string>();
 vi.stubGlobal('navigator', { locks: { request: async (name: string, _options: unknown, callback: (lock: object | null) => Promise<void>) => {
  if (held.has(name)) return callback(null);
  held.add(name); try { await callback({}); } finally { held.delete(name); }
 } } });
});
async function setup() {
 const d = new SansuDatabase(`challenge-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange }); databases.push(d);
 const child = { ...createInitialProfile('test', 2, 8, 1, 'math'), id: profileId, mathMaxUnlocked: 8 };
 await d.appData.put({id:'app',schemaVersion:1,activeProfileId:profileId,profiles:{[profileId]:child}});
 const problem: Problem = {id:'p',subject:'math',categoryId:'add_1d_1',questionText:'1 + 2 =',correctAnswer:'3',inputType:'number',isReview:false};
 problem.learningContext = createLearningProblemContext('math',problem);
 await d.logs.add({profileId:profileId,subject:'math',itemId:'add_1d_1',result:'correct',timestamp:'2026-09-01T00:00:00Z',learningEvidence:learningEvidenceForProblem(problem,'independent')});
 return d;
}
afterEach(async()=> { vi.unstubAllGlobals(); for(const d of databases.splice(0)) await d.delete(); });
async function finish(d:SansuDatabase,count:number) {
 const run=await startChallenge(profileId,d); const events:ChallengeAnswer[]=[];
 await markShown(run.id,0,d);
 for(let i=0;i<count;i++) { if(i) await markShown(run.id,i,d); const q=run.questions[i]; events.push({questionId:q.id,questionIndex:i,answer:q.answer,outcome:'correct',elapsedMs:i*500}); }
 return {run,events,result:await finishChallenge(run.id,events,60000,d)};
}
describe('challenge persistence',()=> {
 it.each([0,9,10,11])('awards exactly once at %i and leaves learning untouched',async(count)=> {
 const d=await setup(); const before=await d.logs.toArray(); const {run,events,result}=await finish(d,count);
 expect(result.newAwards).toEqual(count>=10?['certificate','trophy']:['certificate']);
 expect(await finishChallenge(run.id,events,60000,d)).toEqual(result);
 expect((await readChallengeHome(profileId,d)).summary.completedCount).toBe(1);
 expect(await d.logs.toArray()).toEqual(before); expect(await d.memoryMath.count()).toBe(0);
 });
 it('rejects duplicate active starts, interrupted awards and unknown legacy qualification',async()=> {
 const d=await setup(); const run=await startChallenge(profileId,d); await expect(startChallenge(profileId,d)).rejects.toThrow('already-active');
 expect((await interruptChallenge(run.id,'hidden',d)).official).toBe(false);
 await expect(setChallengeAwardDisplayed(profileId,'trophy',true,d)).rejects.toThrow('unowned');
 await d.logs.clear(); expect((await readChallengeHome(profileId,d)).eligible).toBe(false);
 });
 it('recovers incomplete reservations as reference and preserves best provenance through pruning',async()=> {
 const d=await setup(); const run=await startChallenge(profileId,d); await interruptChallenge(run.id,'reload',d); await d.challengeRuns.update(run.id,{status:'running',result:undefined}); expect((await recoverChallenge(profileId,d))?.result?.official).toBe(false);
 expect((await d.challengeRuns.get(run.id))?.status).toBe('interrupted');
 const earned = await finish(d,10);
 const earnedSnapshot = (await d.challengeRuns.get(earned.run.id))!;
 // Seed old completed receipts directly: pruning needs retained history, not 21 source generations.
 await d.challengeRuns.update(earned.run.id, { createdAt: '2026-01-01T00:00:00.000Z' });
 await d.challengeRuns.bulkPut(Array.from({length:20}, (_,i) => ({ ...earnedSnapshot,
  id: `historical-${i}`, questions: [], createdAt: new Date(Date.UTC(2026,0,2+i)).toISOString(),
  result: { ...earned.result, correct: 0, newAwards: [], improved: false },
 })));
 await d.challengeSummaries.update(profileId, { completedCount: 21 });
 await finish(d,0);
 expect(await d.challengeRuns.count()).toBe(20); const summary=(await readChallengeHome(profileId,d)).summary;
 expect(summary.best).toBe(10); expect(summary.completedCount).toBe(22); expect(summary.awards).toHaveLength(2);
 expect(summary.bestRunId).toBe(earned.run.id); expect(summary.awards.every(award => award.runId === earned.run.id)).toBe(true);
 expect(await d.challengeRuns.get(earned.run.id)).toBeUndefined();
 });
 it('never transfers results after profile switch',async()=> {const d=await setup(); const run=await startChallenge(profileId,d); await markShown(run.id,0,d); await d.appData.update('app',{activeProfileId:'other'}); await expect(finishChallenge(run.id,[],60000,d)).rejects.toThrow('profile-conflict'); expect((await interruptChallenge(run.id,'profile-switch',d)).official).toBe(false);});
});

describe('challenge migration and contact boundaries', () => {
 it('preserves v8 stores and deletes all challenge-owned rows', async () => {
  const { default: Dexie } = await import('dexie');
  const { SANSU_V8_STORES } = await import('../../db');
  const { deleteProfileOwnedIndexedDbRows } = await import('../user/repository');
  const name = `challenge-v8-${crypto.randomUUID()}`;
  const old = new Dexie(name, { indexedDB, IDBKeyRange }); old.version(8).stores(SANSU_V8_STORES);
  await old.table('appData').put({ id: 'sentinel', payload: ['keep', 16] }); old.close();
  const upgraded = new SansuDatabase(name, { indexedDB, IDBKeyRange }); databases.push(upgraded);
  expect(await upgraded.appData.get('sentinel')).toEqual({ id: 'sentinel', payload: ['keep', 16] });
  expect(upgraded.verno).toBe(9);
  const d = await setup(); await finish(d,10);
  await d.transaction('rw', d.tables, () => deleteProfileOwnedIndexedDbRows(d,profileId));
  expect(await d.challengeRuns.count()).toBe(0); expect(await d.challengeEvents.count()).toBe(0);
  expect(await d.challengeSummaries.count()).toBe(0); expect(await d.challengeContacts.count()).toBe(0);
 });
 it('blocks delayed SRS credit after contact or uncertain contact without rewriting the existing state',async()=> {
  const { updateMemoryState } = await import('../algorithms/srs');
  const prior = { id:'add_1d_1',profileId:profileId,strength:2,totalAnswers:5,correctAnswers:5,incorrectAnswers:0,updatedAt:'2026-09-01T00:00:00Z',lastIndependentCorrectAt:'2026-09-01T00:00:00Z',nextReview:'2026-09-03T00:00:00Z' };
  const now = new Date('2026-09-09T00:00:00Z');
  expect(updateMemoryState(prior,true,false,now,{independence:'independent'}).strength).toBe(3);
  expect(updateMemoryState(prior,true,false,now,{independence:'independent',latestChallengeContactAt:'2026-09-08T23:59:00Z'}).strength).toBe(2);
  expect(updateMemoryState(prior,true,false,now,{independence:'independent',challengeContactUncertain:true}).strength).toBe(2);
  expect(prior.nextReview).toBe('2026-09-03T00:00:00Z');
 });
});


it('does not recover or start against a live origin-wide session lease', async () => {
 let held = false;
 vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: unknown, callback: (lock: object | null) => Promise<void>) => {
  if (held) return callback(null);
  held = true;
  try { await callback({}); } finally { held = false; }
 } } });
 const d = await setup(); const run = await startChallenge(profileId, d);
 await expect(recoverChallenge(profileId, d)).rejects.toThrow('already-active');
 expect((await d.challengeRuns.get(run.id))?.result).toBeUndefined();
 await interruptChallenge(run.id, 'closed', d);
 expect((await recoverChallenge(profileId, d))?.result?.official).toBe(false);
});


it('records contact for both addition scopes and their sibling representations', async () => {
 const d = await setup(); const run = await startChallenge(profileId,d); await markShown(run.id,0,d);
 for (const id of ['add_1d_1','add_1d_2','add_1d_1_bridge','add_1d_2_bridge','add_finger']) {
  expect((await d.challengeContacts.get([profileId,id]))?.uncertain).toBe(true);
 }
 await interruptChallenge(run.id,'closed',d);
 const { updateMemoryState } = await import('../algorithms/srs');
 const now = new Date();
 for (const id of ['add_1d_1','add_1d_2','add_1d_1_bridge','add_1d_2_bridge']) {
  const contact = (await d.challengeContacts.get([profileId,id]))!;
  const prior = { id,profileId:profileId,strength:2,totalAnswers:5,correctAnswers:5,incorrectAnswers:0,updatedAt:'2026-01-01T00:00:00Z',lastIndependentCorrectAt:'2026-01-01T00:00:00Z',nextReview:'2026-01-03T00:00:00Z' };
  expect(updateMemoryState(prior,true,false,now,{independence:'independent',latestChallengeContactAt:contact.latestAt}).strength).toBe(2);
 }
});
it('refuses a formal reservation when Web Locks are unsupported', async () => {
 const d = await setup(); vi.stubGlobal('navigator', {});
 await expect(startChallenge(profileId,d)).rejects.toThrow('locks-unavailable');
 expect(await d.challengeRuns.count()).toBe(0);
});

it('contains new challenge starts while preserving owned prizes when the flag is disabled', async () => {
 const d = await setup(); await finish(d, 10);
 vi.stubEnv('VITE_HOME_CHALLENGE_ENABLED', 'false');
 try {
  await expect(startChallenge(profileId, d)).rejects.toThrow('challenge-disabled');
  await setChallengeAwardDisplayed(profileId, 'trophy', true, d);
  expect((await readChallengeHome(profileId, d)).summary.displayed).toEqual(['trophy']);
 } finally { vi.unstubAllEnvs(); }
});


it('releases only the owned session lease when its profile and reservation were deleted', async () => {
 const d = await setup(); const run = await startChallenge(profileId, d);
 await expect(interruptChallenge('unknown-run', 'closed', d)).rejects.toThrow('owner-conflict');
 await expect(recoverChallenge(profileId, d)).rejects.toThrow('already-active');
 await d.appData.update('app', { profiles: {}, activeProfileId: '' });
 await d.challengeRuns.delete(run.id);
 await expect(interruptChallenge(run.id, 'profile-switch', d)).rejects.toThrow('challenge-profile-deleted');
 expect(await recoverChallenge(profileId, d)).toBeNull();
 expect(await d.challengeSummaries.count()).toBe(0);
 expect(await d.challengeRuns.count()).toBe(0);
});
