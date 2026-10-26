import type { SansuDatabase } from '../../../db';
import { db } from '../../../db';
import { DAY, emptyProgress, hasExposure, progressId } from '../evaluation';
import { writeKokugo } from '../storage';
import type { KokugoItem, KokugoProgress } from '../types';
import { kanjiForTarget } from './data';
import { kanjiItems } from './catalog';
/** A word shown in another response form is still the same exposure. Keep that boundary durable. */
export async function shareKanjiContact(item: KokugoItem, owner: string, now: number, d: SansuDatabase, current?: KokugoProgress, taught = false) {
    const entry = item.kanji && kanjiForTarget(item.target);
    if (!entry) return;
    for (const [kind, form, mode] of [['R', 'choice', 'decoding'], ['T', 'short', 'decoding'], ['S', 'choice', 'expression-structured']] as const) {
        const peerItem = { ...item, unitId: `H${kind}${entry.grade}`, form, mode };
        if (current?.id === progressId(peerItem)) continue;
        const p = await d.kokugoProgress.get([owner, progressId(peerItem)]) ?? emptyProgress(owner, peerItem);
        p.contactRevision += 1;
        if (taught) p.independentAfter = Math.max(p.independentAfter ?? 0, now + DAY);
        p.lastContactAt = Math.max(p.lastContactAt ?? now, now);
        if (!hasExposure(p, item.exposureGroup)) p.seenExposures.push(item.exposureGroup);
        await d.kokugoProgress.put(p);
    }
}
export async function previewKanji(owner: string, target: string, d: SansuDatabase = db, now = Date.now()) {
    const entry = kanjiForTarget(target);
    if (!entry || !Number.isFinite(now)) throw new Error('漢字を えらびなおしてね。');
    return writeKokugo(owner, d, async () => {
        const pending = await d.kokugoPlans.where('[profileId+status]').equals([owner, 'pending']).first();
        if (pending) throw new Error('とちゅうの 3もんを 終えてから えらぼう。');
        for (const item of kanjiItems(`HR${entry.grade}`, target).filter(item => !item.passage)) await shareKanjiContact(item, owner, now, d, undefined, true);
    });
}
/** H06 discloses the characters in its topic menu, without revealing their example words/readings. */
export async function previewKanjiCharacters(owner: string, targets: string[], d: SansuDatabase = db, now = Date.now()) {
    const entries = [...new Set(targets)].map(kanjiForTarget);
    if (!Number.isFinite(now) || !entries.length || entries.some(entry => !entry)) throw new Error('漢字を えらびなおしてね。');
    return writeKokugo(owner, d, async () => {
        const pending = await d.kokugoPlans.where('[profileId+status]').equals([owner, 'pending']).first();
        if (pending) throw new Error('とちゅうの 3もんを 終えてから えらぼう。');
        for (const entry of entries) if (entry) {
            const item = kanjiItems(`HR${entry.grade}`, entry.target)[0];
            await shareKanjiContact({ ...item, exposureGroup: `${entry.target}:isolated` }, owner, now, d, undefined, true);
        }
    });
}
