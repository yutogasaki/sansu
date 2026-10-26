import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SansuDatabase } from '../../../db';
import { createInitialProfile } from '../../user/profile';
import { actKokugo } from '../actions';
import { itemsForUnit } from '../catalog';
import { DAY, delayedEligible, emptyProgress, grade, progressId } from '../evaluation';
import { chooseKokugo, presentKokugo, reserveKokugo, verifyKokugoCompletion } from '../repository';
import { KANJI_ENTRIES, kana, kanjiEntry, wordReadings } from './data';
import allocation from './allocation.json';
import { KANJI_GRADE_COUNTS, KANJI_UNITS } from './curriculum';
import { kanjiItems } from './catalog';
import { previewKanji } from './progress';
import type { KokugoPlan } from '../types';
const T = Date.UTC(2026, 9, 25), databases: SansuDatabase[] = [];
async function setup() {
    const d = new SansuDatabase(`kanji-${crypto.randomUUID()}`); databases.push(d);
    const child = { ...createInitialProfile('test', 2, 1, 1, 'math'), id: 'kid' };
    await d.profiles.put(child);
    await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: child.id, profiles: { kid: child } });
    return d;
}
const target = (character: string) => kanjiEntry(character)!.target;
async function ready(d: SansuDatabase, unit: string, character?: string, now = T) {
    await chooseKokugo('kid', unit, 2, true, d, { focusTarget: character ? target(character) : undefined });
    let plan = await reserveKokugo('kid', unit, d, now);
    if (!plan.introDone) plan = await actKokugo({ profileId: 'kid', planId: plan.id, revision: plan.revision, action: 'intro' }, d, now + 1);
    return presentKokugo('kid', plan.id, d, now + 2);
}
async function finish(d: SansuDatabase, initial: KokugoPlan, now = T + 3) {
    let plan = initial;
    while (plan.status === 'pending') {
        plan = await presentKokugo('kid', plan.id, d, now++);
        plan = await actKokugo({ profileId: 'kid', planId: plan.id, revision: plan.revision, action: 'answer', answer: plan.slots[plan.cursor].item.answer }, d, now++);
        plan = await actKokugo({ profileId: 'kid', planId: plan.id, revision: plan.revision, action: 'next' }, d, now++);
    }
    return plan;
}
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(databases.splice(0).map(d => d.delete())); });
describe('complete elementary allocation', () => {
    it('matches the independent government allocation with 1026 unique entries and two authored examples each', () => {
        expect(KANJI_ENTRIES).toHaveLength(1026); expect(new Set(KANJI_ENTRIES.map(e => e.character)).size).toBe(1026);
        expect(KANJI_ENTRIES.map(e => e.character).sort()).toEqual(Object.keys(allocation).sort());
        expect(KANJI_UNITS).toHaveLength(24);
        for (const entry of KANJI_ENTRIES) {
            expect(entry.words).toHaveLength(2);
            for (const word of entry.words) { expect(word.text).toContain(entry.character); expect(word.reading).toMatch(/^[ぁ-ゖー]+$/); }
        }
        for (const [character, g] of Object.entries({ 賀: 4, 航: 5, 告: 5, 胃: 6, 城: 4, 士: 5, 象: 5, 腸: 6 })) expect(kanjiEntry(character)?.grade).toBe(g);
    });
    it.each([1, 2, 3, 4, 5, 6])('provides consistent, uniquely keyed materials and unambiguous readings for grade %i', g => {
        const entries = KANJI_ENTRIES.filter(e => e.grade === g); expect(entries).toHaveLength(KANJI_GRADE_COUNTS[g - 1]);
        const all = ['R', 'T', 'S', 'P'].flatMap(kind => itemsForUnit(`H${kind}${g}`));
        expect(new Set(all.map(i => i.id)).size).toBe(all.length);
        for (const entry of entries) for (const kind of ['R', 'T', 'S', 'P']) {
            const items = kanjiItems(`H${kind}${g}`, entry.target); expect(items.length).toBeGreaterThanOrEqual(kind === 'P' ? 1 : 2);
            for (const item of items) {
                expect(item.target).toBe(entry.target); expect(item.model).toBeTruthy();
                expect(grade(item, item.answer)).toBe(kind === 'P' ? null : true);
                if (kind === 'R' || kind === 'S') expect(new Set(item.choices).size).toBe(3);
                if (kind === 'R') {
                    const aliases = item.exposureGroup.endsWith(':isolated') ? entry.allReadings.map(kana) : entry.words.flatMap(word => word.text === item.exposureGroup.split(':').at(-1) ? wordReadings(word) : []);
                    for (const distractor of item.choices.filter(c => c !== item.answer)) expect(aliases).not.toContain(distractor);
                }
                if (kind === 'S' && item.exposureGroup.endsWith(':isolated')) for (const choice of item.choices.filter(c => c !== item.answer)) expect(kanjiEntry(choice)!.allReadings.map(kana)).not.toContain(item.prompt.match(/「([^」]+)」/)![1]);
            }
        }
    }, 60000);
    it('never uses a valid later-school reading as a wrong choice', () => {
        for (const [character, reading, alternate] of [['時', 'じ', '滋'], ['苦', 'く', '久'], ['港', 'こう', '香'], ['指', 'し', '示'], ['島', 'とう', '道'], ['最', 'さい', '殺'], ['城', 'じょう', '盛'], ['選', 'せん', '川']]) {
            const g = kanjiEntry(character)!.grade; const item = kanjiItems(`HS${g}`, target(character))[0];
            expect(item.choices).not.toContain(alternate);
            expect(kanjiEntry(alternate)!.allReadings.map(kana)).toContain(reading);
        }
        const forgotten = kanjiItems(`HT${kanjiEntry('忘')!.grade}`, target('忘'))[0];
        expect(grade(forgotten, 'ボウ')).toBe(true);
    });
    it('keeps prefecture-specific readings in words and accepts legitimate alternate readings in short responses', () => {
        for (const character of ['媛', '岐', '滋', '阪']) {
            expect(kanjiEntry(character)?.readings).toEqual([]);
            expect(kanjiItems('HR4', target(character)).some(i => i.exposureGroup.endsWith(':isolated'))).toBe(false);
        }
        const doctor = kanjiItems('HT4', target('博')).find(i => i.prompt.includes('博士'))!;
        expect(grade(doctor, 'はくし')).toBe(true); expect(grade(doctor, 'ハカセ')).toBe(true);
        expect(grade(doctor, '別の言い方')).toBeNull();
        const right = kanjiItems('HT1', target('右'))[0]; expect(grade(right, 'みぎ')).toBe(true); expect(grade(right, 'ユウ')).toBe(true);
        const ehime = kanjiItems('HR4', target('媛')); expect(ehime[0].exposureGroup).toBe(ehime[1].exposureGroup);
        const bone = kanjiItems('HR6', target('骨')); expect(bone[0].exposureGroup).toBe(bone[1].exposureGroup);
    });
});
describe('kanji reservations, contact and review', () => {
    it('freezes a focused character across restart, keeps an older reservation and rejects switching its focus', async () => {
        const d = await setup(), plan = await ready(d, 'HR1', '山');
        expect(plan.slots.every(s => s.item.target === target('山'))).toBe(true);
        await expect(chooseKokugo('kid', 'HR1', 2, true, d, { focusTarget: target('川') })).rejects.toThrow();
        await chooseKokugo('kid', 'HR1', 2, false, d);
        expect((await d.kokugoCourses.get('kid'))?.focusTarget).toBe(target('山'));
        d.close(); await d.open(); expect(await reserveKokugo('kid', 'R01', d)).toEqual(plan);
        await expect(chooseKokugo('kid', 'R01', 2, true, d, { focusTarget: target('山') })).rejects.toThrow();
    });
    it('retains the saved focused course when leaving after a completed section', async () => {
        const d = await setup(); await finish(d, await ready(d, 'HR1', '山'));
        await chooseKokugo('kid', 'HR1', 2, false, d);
        expect((await d.kokugoCourses.get('kid'))?.focusTarget).toBe(target('山'));
        await chooseKokugo('kid', 'HR1', 2, true, d, {});
        expect((await d.kokugoCourses.get('kid'))?.focusTarget).toBeUndefined();
    });
    it('rotates grade practice across uncontacted characters and prioritizes due unseen material', async () => {
        const d = await setup(), plan = await ready(d, 'HR1');
        const first = new Set(plan.slots.map(s => s.item.target)); expect(first.size).toBe(3);
        await finish(d, plan);
        const next = await ready(d, 'HR1', undefined, T + 100);
        expect(next.slots.every(s => !first.has(s.item.target))).toBe(true);
        await finish(d, next, T + 110);
        const delayed = await ready(d, 'HR1', undefined, T + 2 * DAY);
        expect(delayed.slots.every(s => first.has(s.item.target))).toBe(true);
        expect(delayed.slots[0].presentation?.delayedEligible).toBe(true);
    });
    it('records reference exposure across answer forms without fabricating completion or postponing due', async () => {
        const d = await setup();
        const item = kanjiItems('HR1', target('山'))[0], p = emptyProgress('kid', item); p.nextReview = T - 1;
        await d.kokugoProgress.put(p);
        await previewKanji('kid', target('山'), d, T);
        const rows = await d.kokugoProgress.toArray(); expect(rows).toHaveLength(3);
        for (const row of rows) { expect(row.independentItems).toEqual([]); expect(row.lastContactAt).toBe(T); expect(row.seenExposures.length).toBeGreaterThan(0); }
        expect((await d.kokugoProgress.get(['kid', progressId(item)]))?.nextReview).toBe(T - 1);
        expect(await d.kokugoOutbox.count()).toBe(0);
        const plan = await ready(d, 'HT1', '山', T + 10);
        expect(plan.slots[0].presentation?.novel).toBe(true);
        expect(plan.slots[0].item.passage).toBeTruthy();
        expect((await d.kokugoProgress.get(['kid', progressId(plan.slots[0].item)]))?.independentAfter).toBe(T + DAY);
        const completed = await finish(d, plan, T + 20);
        expect(completed.slots.every(s => s.completionKind === 'assisted')).toBe(true);
        expect((await d.kokugoOutbox.toArray()).every(c => c.completionKind === 'assisted')).toBe(true);
    });
    it('protects the active question from new preview exposure and rolls back incomplete previews', async () => {
        const d = await setup(); const put = vi.spyOn(d.kokugoProgress, 'put'); put.mockRejectedValueOnce(new Error('disk'));
        await expect(previewKanji('kid', target('山'), d, T)).rejects.toThrow('disk'); expect(await d.kokugoProgress.count()).toBe(0); put.mockRestore();
        const plan = await ready(d, 'R01');
        await expect(previewKanji('kid', target('山'), d, T)).rejects.toThrow();
        expect(await d.kokugoPlans.get(plan.id)).toEqual(plan);
    });
    it('shares lexical exposure across forms and verifies actual completions for reward delivery', async () => {
        const d = await setup(), plan = await ready(d, 'HR1', '山'); await finish(d, plan);
        const proofs = await d.kokugoOutbox.toArray(); expect(proofs).toHaveLength(3);
        for (const proof of proofs) expect(await verifyKokugoCompletion(proof, d)).toBe(true);
        const spelling = await ready(d, 'HS1', '山', T + 2 * DAY);
        expect(spelling.slots[0].presentation?.novel).toBe(true);
        expect(spelling.slots[0].item.passage).toBeTruthy();
        const lexical = kanjiItems('HS1', target('山')).filter(item => !item.passage);
        const row = await d.kokugoProgress.get(['kid', progressId(spelling.slots[0].item)]);
        expect(lexical.every(item => row!.seenExposures.includes(item.exposureGroup))).toBe(true);
        expect(delayedEligible(row!, spelling.slots[0].item, T + 3 * DAY)).toBe(false);
    });
    it('fences preview writes for inactive and deleting profiles', async () => {
        const d = await setup(); await d.foundationOwners.put({ profileId: 'kid', status: 'deleting', updatedAt: T });
        await expect(previewKanji('kid', target('山'), d, T)).rejects.toThrow(); expect(await d.kokugoProgress.count()).toBe(0);
    });
});
