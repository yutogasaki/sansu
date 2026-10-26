import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { KOKUGO_ITEMS, itemsForUnit, READING_BOOKS } from './catalog';
import { KOKUGO_STARTER_UNITS } from './curriculum';
import { actKokugo } from './actions';
import { chooseKokugo, presentKokugo, reserveKokugo, verifyKokugoCompletion } from './repository';
import { adoptEditorialPolicy, confirmed, DAY, emptyProgress, hasExposure, independentEligible, progressId, retrievalEligible } from './evaluation';
import { KANJI_ENTRIES, kanjiEntry } from './kanji/data';
import { previewKanji } from './kanji/progress';
import type { KokugoPlan, KokugoProgress, KokugoSlot } from './types';
const T = Date.UTC(2026, 9, 26), databases: SansuDatabase[] = [];
async function setup() {
    const d = new SansuDatabase(`editorial-${crypto.randomUUID()}`); databases.push(d);
    const child = { ...createInitialProfile('test', 2, 1, 1, 'math'), id: 'kid' };
    await d.profiles.put(child); await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'kid', profiles: { kid: child } }); return d;
}
async function ready(d: SansuDatabase, unit = 'H01', now = T) {
    await chooseKokugo('kid', unit, 2, true, d);
    let plan = await reserveKokugo('kid', unit, d, now);
    if (!plan.introDone) plan = await actKokugo({ profileId: 'kid', planId: plan.id, revision: plan.revision, action: 'intro' }, d, now);
    return presentKokugo('kid', plan.id, d, now);
}
const act = (d: SansuDatabase, plan: KokugoPlan, action: 'answer' | 'hint' | 'model' | 'next', now: number, answer?: string) => actKokugo({ profileId: 'kid', planId: plan.id, revision: plan.revision, action, ...(answer === undefined ? {} : { answer }) }, d, now);
afterEach(async () => { await Promise.all(databases.splice(0).map(d => d.delete())); });
describe('editorial second edition', () => {
    it('supplies 126 additional starter examples, six books and coherent condition coverage', () => {
        expect(KOKUGO_ITEMS.filter(i => i.form !== 'activity')).toHaveLength(372);
        expect(KOKUGO_ITEMS.filter(i => i.form === 'activity')).toHaveLength(15);
        expect(READING_BOOKS).toHaveLength(6);
        for (const unit of KOKUGO_STARTER_UNITS) {
            const items = itemsForUnit(unit.id);
            expect(items.length).toBe(items[0].form === 'activity' ? 3 : unit.id === 'K01' ? 12 : 9);
            expect(items.every(i => i.version === 'kokugo-starter-2')).toBe(true);
        }
        for (const target of ['あの音と字', 'いの音と字', 'うの音と字']) {
            const items = KOKUGO_ITEMS.filter(i => i.target === target);
            expect(items.length).toBeGreaterThanOrEqual(3); expect(new Set(items.map(i => i.family)).size).toBeGreaterThanOrEqual(2);
            expect(items.every(i => i.audio && i.audioSha256?.length === 64)).toBe(true);
        }
        expect(KOKUGO_ITEMS.filter(i => i.unitId === 'K04').slice(-3).map(i => i.condition)).toEqual(['促音', '拗音', '長音']);
        expect(KOKUGO_ITEMS.find(i => i.id === 'H02-3')?.prompt).toContain('部分');
    });
    it('gives every kanji two unique meaningful scenes, three exposures and two families in each assessed form', () => {
        const passages = new Set<string>();
        for (const entry of KANJI_ENTRIES) {
            expect(entry.scenes).toHaveLength(2);
            for (const scene of entry.scenes) {
                const passage = scene.passage.replace('~', entry.words[scene.wordIndex].text);
                expect(passage).toContain(entry.character); expect(passages.has(passage)).toBe(false); passages.add(passage);
            }
            for (const kind of ['R', 'T', 'S']) {
                const items = itemsForUnit(`H${kind}${entry.grade}`, entry.target);
                expect(new Set(items.map(i => i.exposureGroup)).size).toBeGreaterThanOrEqual(3);
                expect(new Set(items.map(i => i.family)).size).toBeGreaterThanOrEqual(2);
                expect(items.filter(i => i.passage)).toHaveLength(2);
                for (const item of items.filter(i => i.passage)) {
                    expect(item.id).toMatch(/scene-s[12]$/);
                    if (kind === 'S') { expect(item.passage).not.toContain(entry.character); expect(item.passage).toContain('□'); }
                }
            }
        }
        expect(passages.size).toBe(2052);
    });
    it('retains unchanged IDs, revises replaced words, shares suffix roots and excludes matching compound readings', () => {
        const ear = kanjiEntry('耳')!, cherry = kanjiEntry('桜')!;
        expect(itemsForUnit('HR1', ear.target).some(i => i.id === 'HR1-8033-2-r2' && i.prompt.includes('耳たぶ'))).toBe(true);
        expect(itemsForUnit('HR1', kanjiEntry('山')!.target)[0].id).toBe('HR1-5c71-0');
        const cherryItems = itemsForUnit('HR5', cherry.target).filter(i => !i.passage);
        expect(new Set(cherryItems.map(i => i.exposureGroup)).size).toBe(1);
        // 印象 and 印章 must not be treated as one correct and one incorrect spelling.
        for (const item of itemsForUnit('HS5', kanjiEntry('象')!.target).filter(i => i.prompt.includes('いんしょう'))) expect(item.choices).not.toContain('章');
    });
    it('compares historical root spellings in both directions without creating a fresh exposure', () => {
        for (const [character, historicalRoot, currentRoot] of [['桜', '桜', 'isolated'], ['丁', '一丁目', '丁目']]) {
            const entry = kanjiEntry(character)!, item = itemsForUnit(`HR${entry.grade}`, entry.target)[0];
            for (const [seen, next] of [[historicalRoot, currentRoot], [currentRoot, historicalRoot]]) {
                const row = { ...emptyProgress('kid', item), seenExposures: [`${entry.target}:${seen}`] };
                expect(hasExposure(row, `${entry.target}:${next}`)).toBe(true);
                expect(row.seenExposures).toEqual([`${entry.target}:${seen}`]);
                expect(hasExposure(row, `${entry.target}:scene:s1`)).toBe(false);
            }
        }
    });
    it('resumes a frozen legacy root against current progress as familiar retrieval, preserving its exact item', async () => {
        const d = await setup(), entry = kanjiEntry('桜')!;
        await chooseKokugo('kid', 'HR5', 6, true, d, { focusTarget: entry.target });
        const plan = await reserveKokugo('kid', 'HR5', d, T);
        const slot = structuredClone(plan.slots.find(s => s.item.id === 'HR5-685c-2')!);
        slot.item.version = 'kokugo-kanji-1'; slot.item.exposureGroup = `${entry.target}:桜`;
        plan.slots = [slot, ...plan.slots.filter(s => s.item.id !== slot.item.id)]; plan.introDone = true;
        await d.kokugoPlans.put(plan);
        await d.kokugoProgress.put({ ...emptyProgress('kid', slot.item), introduced: true, seenExposures: [`${entry.target}:isolated`], lastContactAt: T, nextReview: T + DAY });
        const shown = await presentKokugo('kid', plan.id, d, T + 2 * DAY);
        expect(shown.slots[0].presentation).toMatchObject({ novel: false, delayedEligible: false, reviewEligible: true });
        const done = await act(d, shown, 'answer', T + 2 * DAY + 1, slot.item.answer);
        expect(done.slots[0].item).toEqual(slot.item); expect(done.slots[0].retrieved).toBe('familiar');
        const row = (await d.kokugoProgress.get(['kid', progressId(slot.item)]))!;
        expect(row.independentItems).toEqual([]); expect(row.familiarReviewCount).toBe(1); expect(row.delayedCount).toBe(0);
    });
    it('retains an old reserved plan verbatim instead of replacing its text or choice order', async () => {
        const d = await setup(), plan = await ready(d);
        const old = structuredClone(plan); old.slots[0].item.version = 'kokugo-starter-1'; old.slots[0].item.prompt = '旧版の固定された問い';
        delete old.slots[0].presentation!.reviewEligible; await d.kokugoPlans.put(old);
        d.close(); await d.open(); expect(await reserveKokugo('kid', 'HR6', d, T + DAY)).toEqual(old);
    });
});
describe('separate delayed retrieval from new-context evidence', () => {
    it('reviews exhausted material at 1/3/7/14/30-day intervals without inventing new independent facts', async () => {
        const d = await setup(), item = itemsForUnit('H01')[0];
        let row: KokugoProgress = { ...emptyProgress('kid', item), introduced: true, lastContactAt: T,
            nextReview: T + DAY, seenExposures: itemsForUnit('H01').map(i => i.exposureGroup),
            independentItems: ['legacy-a', 'legacy-b'], independentFamilies: ['one'], independentConditions: ['基本例'] };
        await d.kokugoProgress.put(row);
        let now = T + DAY;
        for (const days of [3, 7, 14, 30, 30]) {
            const plan = await ready(d, 'H01', now);
            expect(plan.repeatedPractice).toBe(true); expect(plan.slots[0].presentation).toMatchObject({ novel: false, reviewEligible: true, delayedEligible: false });
            const input = { profileId: 'kid', planId: plan.id, revision: plan.revision, action: 'answer' as const, answer: plan.slots[0].item.answer };
            const done = await actKokugo(input, d, now + 1); expect(await actKokugo(input, d, now + 2)).toEqual(done);
            expect(done.slots[0].retrieved).toBe('familiar');
            const proof = (await d.kokugoOutbox.toArray()).at(-1)!; expect(await verifyKokugoCompletion(proof, d)).toBe(true);
            row = (await d.kokugoProgress.get(['kid', progressId(item)]))!;
            expect(row.nextReview).toBe(now + 1 + days * DAY); expect(row.independentItems).toEqual(['legacy-a', 'legacy-b']);
            expect(row.independentFamilies).toEqual(['one']); expect(row.delayedCount).toBe(0); expect(confirmed(row)).toBe(false);
            await d.kokugoPlans.put({ ...done, status: 'completed' });
            now = row.nextReview!;
        }
        expect(row.familiarReviewCount).toBe(5); expect(await d.kokugoOutbox.count()).toBe(5);
    });
    it('keeps the due date for same-day practice, support, wrong-first retries and clock rollback', async () => {
        for (const mode of ['early', 'hint', 'model', 'wrong', 'rollback'] as const) {
            const d = await setup(), item = itemsForUnit('H01')[0];
            const due = T + DAY, now = mode === 'early' ? T + 10 : T + 2 * DAY;
            await d.kokugoProgress.put({ ...emptyProgress('kid', item), introduced: true, lastContactAt: T, nextReview: due,
                seenExposures: itemsForUnit('H01').map(i => i.exposureGroup) });
            let plan = await ready(d, 'H01', now);
            if (mode === 'hint' || mode === 'model') plan = await act(d, plan, mode, now + 1);
            if (mode === 'wrong') plan = await act(d, plan, 'answer', now + 1, plan.slots[0].item.choices.find(c => c !== item.answer));
            plan = await act(d, plan, 'answer', mode === 'rollback' ? T - 1 : now + 2, plan.slots[0].item.answer);
            const row = (await d.kokugoProgress.get(['kid', progressId(item)]))!;
            expect(plan.slots[0].retrieved).toBeUndefined(); expect(row.nextReview).toBe(due); expect(row.familiarReviewCount ?? 0).toBe(0);
        }
    });
    it('gates unseen scenes for 24h after reference and shares that boundary across answer forms', async () => {
        const d = await setup(), entry = kanjiEntry('媛')!;
        await previewKanji('kid', entry.target, d, T);
        for (const kind of ['R', 'T', 'S']) {
            const scene = itemsForUnit(`H${kind}4`, entry.target).find(i => i.passage)!;
            const row = (await d.kokugoProgress.get(['kid', progressId(scene)]))!;
            expect(row.seenExposures).not.toContain(scene.exposureGroup); expect(row.independentAfter).toBe(T + DAY);
            const slot: KokugoSlot = { item: scene, support: 'none', draft: '', heard: false,
                presentation: { at: T, novel: true, contactRevision: row.contactRevision, delayedEligible: false } };
            expect(independentEligible(slot, row, T + DAY - 1)).toBe(false); expect(independentEligible(slot, row, T + DAY)).toBe(true);
        }
    });
    it('starts the teaching cooldown again when a model kept open for days is completed', async () => {
        const d = await setup(); let plan = await ready(d, 'H01', T);
        plan = await act(d, plan, 'model', T + 1);
        await actKokugo({ profileId: 'kid', planId: plan.id, revision: plan.revision, action: 'complete-supported' }, d, T + 2 * DAY);
        const row = (await d.kokugoProgress.get(['kid', progressId(plan.slots[0].item)]))!;
        expect(row.independentAfter).toBe(T + 3 * DAY); expect(row.independentItems).toEqual([]);
    });
    it('conservatively adopts legacy contacts, preserves old evidence and does not retrofit review eligibility', () => {
        const item = itemsForUnit('H01')[0], row = emptyProgress('kid', item);
        delete row.evidencePolicy; row.seenExposures = [item.exposureGroup]; row.lastContactAt = T; row.independentItems = ['old']; row.nextReview = T - 1;
        adoptEditorialPolicy(row); expect(row.independentAfter).toBe(T + DAY); expect(row.independentItems).toEqual(['old']); expect(row.nextReview).toBe(T - 1);
        const slot: KokugoSlot = { item, support: 'none', draft: '', heard: false, presentation: { at: T, contactRevision: row.contactRevision, novel: false, delayedEligible: false } };
        expect(retrievalEligible(slot, row, T + 2 * DAY)).toBe(false);
    });
});
