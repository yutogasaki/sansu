import { KokugoKanjiProgress } from './KokugoKanjiProgress';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { confirmed } from '../../domain/kokugo/evaluation';
import { kokugoUnit } from '../../domain/kokugo/curriculum';
import './kokugo.css';
export function KokugoProgressCard({ profileId, parent = false }: { profileId?: string; parent?: boolean }) {
    const data = useLiveQuery(async () => {
        if (!profileId) return null;
        return { progress: await db.kokugoProgress.where('profileId').equals(profileId).toArray(),
            events: await db.kokugoEvents.where('profileId').equals(profileId).toArray(),
            works: await db.kokugoWorks.where('profileId').equals(profileId).toArray(),
            pending: await db.kokugoOutbox.where('profileId').equals(profileId).filter(row => row.acknowledgedAt === undefined).count() };
    }, [profileId]);
    if (!data || (!data.progress.length && !data.works.length)) return null;
    const answers = data.events.filter(event => event.action === 'answer');
    return <section className="kokugo-progress kokugo-panel" aria-label="国語の きろく"><h2>国語の きろく</h2>
        <p>答えた回数 {answers.length} · 自分でできた初答 {answers.filter(event => event.independent).length} · 前の例の後日復習 {answers.filter(event => event.retrieved === 'familiar').length} · 作品・読書 {data.works.filter(work => work.saved || work.revisions?.length).length}</p>
        {parent && <p>提供範囲：6領域46単元の初期教材と、学年別の配当漢字1,026字、読書6作品です。初期教材は採点できる372問と自由活動15件、漢字は用語例2,052語と場面文2,052本です。全音訓・全語義の網羅、筆記の自動採点、国語校閲者による審査、音声の実聴、児童の理解・再訪の確認は別工程です。</p>}
        <p>国語の取り組みは ここに まとまるよ。カレンダーは 算数・英単語の きろくだよ。</p><p>この課題での確認だよ。単元全体の習得とは 分けて見よう。</p>
        <KokugoKanjiProgress progress={data.progress} />
        <details><summary>内容ごとの きろく</summary>{data.progress.filter(p => !p.target.startsWith('kanji:')).map(p => <div key={p.id}><strong>{kokugoUnit(p.unitId).title}</strong>
            <p>{p.target === p.unitId ? '' : `${p.target} · `}{p.mode === 'listening' ? '聞く' : p.mode === 'decoding' ? '読む' : '読んで考える'} · 独力の初答 {p.independentItems.length}例・{p.independentFamilies.length}文脈 · {p.independentConditions.join('・')}</p>
            <p>{confirmed(p) ? p.delayedCount ? '後日も 確認できた' : '異なる例で 確認できた' : 'れんしゅう中'}{p.familiarReviewCount ? ` · 前の例の後日復習 ${p.familiarReviewCount}回` : ''}{p.nextReview ? ` · 復習のめやす ${new Date(p.nextReview).toLocaleDateString('ja-JP')}` : ''}</p>
            {confirmed(p) && p.nextReview && p.nextReview <= Date.now() && <p>前の例も、日を あけた復習に 使えるよ。新しい文脈での 確認とは 分けて 残すよ。</p>}</div>)}</details>
        {!!data.pending && <p>島で 受けとる きろくが {data.pending}件 あるよ。</p>}
        {!!data.works.length && <details><summary>作品と 読んだ本</summary>{data.works.map(work => <article key={work.id}><strong>{work.id.includes(':reading:') ? '読書' : kokugoUnit(work.unitId).title} · {work.saved ? '保存した作品' : '下書き'}</strong><p className="kokugo-work-text">{work.text}</p>{!!work.revisions?.length && <details><summary>これまでの 作品</summary>{work.revisions.map((revision, index) => <p key={index} className="kokugo-work-text">{new Date(revision.at).toLocaleDateString('ja-JP')}
{revision.text}</p>)}</details>}</article>)}</details>}
    </section>;
}
