import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { SurfacePanel, SurfacePanelHeader } from '../ui/SurfacePanel';

const labels = { shape: '形の照合', 'letter-name': '文字名と形', 'word-listening': '音と絵' };
export function FoundationProgress({ profileId, parent = false }: { profileId: string; parent?: boolean }) {
    const data = useLiveQuery(async () => {
        try {
            const [progress, plans] = await Promise.all([db.foundationProgress.where('profileId').equals(profileId).toArray(), db.foundationPlans.where('profileId').equals(profileId).toArray()]);
            return { progress, slots: plans.flatMap(plan => plan.slots).filter(slot => slot.completedAt !== undefined) };
        } catch { return null; }
    }, [profileId]);
    if (data === undefined) return null;
    if (data === null) return <p role="alert">えいごの きろくを よみこめなかったよ。</p>;
    if (!data.progress.length) return null;
    return <SurfacePanel className="space-y-3 p-5" data-foundation-progress="true">
        <SurfacePanelHeader title={parent ? '英語の基礎' : 'もじと おとの えいご'} description={parent ? '既存の英単語・算数の記録とは別の証拠です。' : 'であった もじや おとが ふえていくよ'} />
        <p>{parent ? `有効完了 ${data.slots.length}問（独力 ${data.slots.filter(slot => slot.completionKind === 'independent').length}問・支援つき ${data.slots.filter(slot => slot.completionKind === 'assisted').length}問）` : `${data.slots.length}この ひかりが とどいたよ`}</p>
        {!parent && <p>{[...new Set(data.progress.filter(p => p.introduced).map(p => p.target))].join('・')}に あえたね</p>}
        {parent && <><p>音と絵の選択は、読字・発話・書字の確認ではありません。遅延再確認は24時間以上とDueの両方を満たす別の記録です。</p>
            <div className="overflow-x-auto"><table className="w-full text-sm text-left"><caption className="sr-only">対象と課題形式ごとの記録</caption><thead><tr><th>対象 / 形式</th><th>独力</th><th>支援</th><th>遅延</th><th>次の復習</th></tr></thead><tbody>{data.progress.map(p => <tr key={p.id}><th className="py-2">{p.target} / {labels[p.form]}</th><td>{p.independentCount}</td><td>{data.slots.filter(s => s.target === p.target && s.form === p.form && s.completionKind === 'assisted').length}</td><td>{p.delayedCount}</td><td>{p.nextReview ? new Date(p.nextReview).toLocaleDateString('ja-JP') : '未確認'}</td></tr>)}</tbody></table></div></>}
    </SurfacePanel>;
}
