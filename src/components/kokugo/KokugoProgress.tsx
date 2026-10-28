import { KokugoKanjiProgress } from './KokugoKanjiProgress';
import { confirmed } from '../../domain/kokugo/evaluation';
import { kokugoUnit } from '../../domain/kokugo/curriculum';
import { SurfacePanel, SurfacePanelHeader } from '../ui/SurfacePanel';
import { useKokugoOverview } from '../progress/useKokugoOverview';
import './kokugo.css';

export function KokugoProgressCard({ profileId, parent = false, easy = false }: { profileId?: string; parent?: boolean; easy?: boolean }) {
    const data = useKokugoOverview(profileId);
    const t = (simple: string, normal: string) => easy ? simple : normal;
    if (!data) return null;
    if (data.error) return <p role="alert">{t('こくごの きろくを よめなかったよ。ひらきなおしてね。', '国語の記録を読みこめませんでした。開き直してください。')}</p>;
    if (!data.progress.length && !data.works.length) return null;
    const answers = data.events.filter(event => event.action === 'answer');
    const savedWorks = data.works.filter(work => work.saved || work.revisions?.length);
    return <SurfacePanel className="kokugo-progress" aria-label={t('こくごの きろく', '国語の きろく')}>
        <SurfacePanelHeader title={t('こくごの きろく', '国語の きろく')} />
        <p>{t('こたえた もんだい', '答えた問題')} {answers.length} · {t('ひとりで できた', '初めの答えで自分でできた')} {answers.filter(event => event.independent).length} · {t('ほん・さくひん', '読書・作品')} {savedWorks.length}</p>
        <p>{t('まなんだ ひは、きろくの カレンダーでも みられるよ。', '学習した日は、記録のカレンダーでも見られます。')}</p>
        <KokugoKanjiProgress progress={data.progress} easy={easy} parent={parent} />
        <details><summary>{t('ないようごとの きろく', '内容ごとの きろく')}</summary>{data.progress.filter(p => !p.target.startsWith('kanji:')).map(p => <div key={p.id}><strong>{kokugoUnit(p.unitId).title}</strong>
            <p>{confirmed(p) ? p.delayedCount ? t('ひを あけても できた', '日をあけても確認できた') : t('べつの れいでも できた', '別の例でも確認できた') : t('れんしゅうちゅう', '練習中')}{p.nextReview ? ` · ${t('つぎの ふくしゅう', '次の復習')} ${new Date(p.nextReview).toLocaleDateString('ja-JP')}` : ''}</p>
            {parent && <p>独力の初答 {p.independentItems.length}例・{p.independentFamilies.length}文脈 · {p.independentConditions.join('・')}{p.familiarReviewCount ? ` · 前の例の後日復習 ${p.familiarReviewCount}回` : ''}</p>}
        </div>)}</details>
        {!!data.works.length && <details><summary>{t('さくひんと よんだ ほん', '作品と 読んだ本')}</summary>{data.works.map(work => <article key={work.id}>
            <strong>{work.id.startsWith(`${profileId}:reading:`) ? t('よんだ ほん', '読書') : kokugoUnit(work.unitId).title} · {work.saved ? t('のこした さくひん', '保存した作品') : t('かきかけ', '下書き')}</strong>
            <p className="kokugo-work-text">{work.text}</p>{!!work.revisions?.length && <details><summary>{t('これまでの さくひん', 'これまでの作品')}</summary>{work.revisions.map((revision, index) => <p key={index} className="kokugo-work-text">{new Date(revision.at).toLocaleDateString('ja-JP')}\n{revision.text}</p>)}</details>}
        </article>)}</details>}
        {parent && <details><summary>評価と提供範囲について</summary><p>読む・聞く・書くは別の取り組みです。この課題での確認を、単元全体や国語全体の習得と同じには扱いません。</p><p>6領域46単元の初期教材、全配当漢字1,026字、読書6作品。初期教材は採点372問・自由活動15件。漢字は用語例2,052語と場面文2,052本です。全音訓・全語義、筆記の自動採点、専門家の校閲、実機の音声・児童の理解や再訪は別の確認が必要です。</p></details>}
    </SurfacePanel>;
}
