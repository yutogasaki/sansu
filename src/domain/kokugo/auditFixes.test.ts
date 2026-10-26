import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { itemsForUnit } from './catalog';
import { DAY, emptyProgress, grade, progressId } from './evaluation';
import { actKokugo } from './actions';
import { chooseKokugo, presentKokugo, reserveKokugo } from './repository';
import { KANJI_ENTRIES, kana, kanjiEntry, wordReadings } from './kanji/data';
import { previewKanjiCharacters } from './kanji/progress';
const T = Date.UTC(2026, 9, 26), databases: SansuDatabase[] = [];
async function setup() {
    const d = new SansuDatabase(`audit-fix-${crypto.randomUUID()}`); databases.push(d);
    const child = { ...createInitialProfile('test', 2, 1, 1, 'math'), id: 'kid' };
    await d.profiles.put(child); await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'kid', profiles: { kid: child } }); return d;
}
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(databases.splice(0).map(d => d.delete())); });
describe('audit regressions: material meaning and teaching contact', () => {
    it('asks extended words as words without manufacturing a new lexical exposure', () => {
        for (const [character, word, reading, mask] of [['桜', '桜色', 'さくらいろ', '□色'], ['頭', '頭の上', 'あたまのうえ', '□の上']]) {
            const entry = kanjiEntry(character)!;
            const item = itemsForUnit(`HS${entry.grade}`, entry.target).find(i => !i.passage && i.prompt.includes(reading))!;
            expect(item.prompt).toBe(`「${reading}」と読む「${mask}」。□に 入る漢字は？`);
            expect(item.exposureGroup).toBe(`${entry.target}:isolated`);
            expect(item.answer).toBe(character); expect(item.model).toContain(word);
        }
    });
    it('only calls actual character readings on-yomi/kun-yomi across all spelling materials', () => {
        for (let g = 1; g <= 6; g++) for (const item of itemsForUnit(`HS${g}`)) {
            if (!item.prompt.startsWith('音読み・訓読みが')) continue;
            const reading = item.prompt.match(/「([^」]+)」/)![1];
            expect(kanjiEntry(item.kanji!)!.allReadings.map(kana)).toContain(reading);
        }
    }, 60000);
    it('scopes alternative readings to their scene while retaining unrestricted legitimate lexical readings', () => {
        const entry = kanjiEntry('何')!, items = itemsForUnit('HT2', entry.target);
        const scene = items.find(i => i.id.endsWith('scene-s2'))!, word = items.find(i => !i.passage && i.prompt.includes('何人'))!;
        expect(scene.passage).toContain('かぞえる'); expect(grade(scene, 'なんにん')).toBe(true); expect(grade(scene, 'なにじん')).toBeNull();
        expect(grade(word, 'なにじん')).toBe(true);
        for (const e of KANJI_ENTRIES) for (const s of e.scenes) {
            const readings = wordReadings(e.words[s.wordIndex]);
            if (readings.length > 1) { expect(s.acceptedReadings?.length).toBeGreaterThan(0); expect(s.acceptedReadings!.every(r => readings.includes(r))).toBe(true); }
        }
        const doctor = itemsForUnit('HT4', kanjiEntry('博')!.target).find(i => i.id.endsWith('scene-s2'))!;
        expect(grade(doctor, 'はくし')).toBe(true); expect(grade(doctor, 'はかせ')).toBe(true);
    });
    it('keeps H06 work IDs stable and registers only the disclosed menu characters in every response form', async () => {
        const d = await setup(), items = itemsForUnit('H06');
        expect(items.map(i => i.id)).toEqual(['H06-1', 'H06-2', 'H06-3']);
        expect(items.map(i => i.teachingTarget)).toEqual(['川', '花', '空'].map(c => kanjiEntry(c)!.target));
        const first = itemsForUnit('HS1', items[0].teachingTarget)[0], p = { ...emptyProgress('kid', first), nextReview: T - 1 };
        await d.kokugoProgress.put(p);
        await previewKanjiCharacters('kid', items.map(i => i.teachingTarget!), d, T);
        const rows = await d.kokugoProgress.toArray(); expect(rows).toHaveLength(9);
        for (const row of rows) { expect(row.independentAfter).toBe(T + DAY); expect(row.seenExposures).toEqual([`${row.target}:isolated`]); expect(row.independentItems).toEqual([]); }
        expect((await d.kokugoProgress.get(['kid', progressId(first)]))?.nextReview).toBe(T - 1);
        expect(await d.kokugoOutbox.count()).toBe(0);
        await chooseKokugo('kid', 'HS1', 2, true, d, { focusTarget: first.target });
        let plan = await reserveKokugo('kid', 'HS1', d, T + 1);
        plan = await actKokugo({ profileId: 'kid', planId: plan.id, revision: plan.revision, action: 'intro' }, d, T + 2);
        plan = await presentKokugo('kid', plan.id, d, T + 3);
        plan = await actKokugo({ profileId: 'kid', planId: plan.id, revision: plan.revision, action: 'answer', answer: plan.slots[0].item.answer }, d, T + 4);
        expect(plan.slots[0].completionKind).toBe('assisted');
    });
    it('rolls back a partial H06 contact batch and fences inactive/deleting owners and pending lessons', async () => {
        const d = await setup(), targets = itemsForUnit('H06').map(i => i.teachingTarget!);
        const original = d.kokugoProgress.put.bind(d.kokugoProgress), put = vi.spyOn(d.kokugoProgress, 'put'); let writes = 0;
        put.mockImplementation((...args) => { if (++writes === 4) throw new Error('disk'); return original(...args); });
        await expect(previewKanjiCharacters('kid', targets, d, T)).rejects.toThrow('disk'); expect(await d.kokugoProgress.count()).toBe(0); put.mockRestore();
        await d.foundationOwners.put({ profileId: 'kid', status: 'deleting', updatedAt: T });
        await expect(previewKanjiCharacters('kid', targets, d, T)).rejects.toThrow(); await d.foundationOwners.delete('kid');
        await chooseKokugo('kid', 'R01', 2, true, d); await reserveKokugo('kid', 'R01', d, T);
        await expect(previewKanjiCharacters('kid', targets, d, T)).rejects.toThrow(); expect(await d.kokugoProgress.count()).toBe(0);
    });
    it('applies revised readings to new items while preserving a frozen second-edition reservation', async () => {
        const d = await setup(), entry = kanjiEntry('何')!, current = itemsForUnit('HT2', entry.target).find(i => i.id.endsWith('scene-s2'))!;
        expect(current.version).toBe('kokugo-kanji-3');
        await chooseKokugo('kid', 'HT2', 2, true, d, { focusTarget: entry.target });
        const plan = await reserveKokugo('kid', 'HT2', d, T);
        plan.slots[0].item = { ...current, version: 'kokugo-kanji-2', acceptedAnswers: ['なんにん', 'なにじん'] };
        await d.kokugoPlans.put(plan); d.close(); await d.open();
        const resumed = await reserveKokugo('kid', 'HT2', d, T + DAY);
        expect(resumed).toEqual(plan); expect(grade(resumed.slots[0].item, 'なにじん')).toBe(true); expect(grade(current, 'なにじん')).toBeNull();
    });
});
