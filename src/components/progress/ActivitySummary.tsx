import { useMemo, useState } from 'react';
import type { KokugoActivityEntry } from '../../domain/stats/kokugoActivity';
import type { AttemptLog } from '../../db';
import { summarizeActivity, type ActivityPeriod } from '../../domain/stats/activity';
import { InsetPanel, SegmentedControl, SurfacePanel } from '../ui/SurfacePanel';
import { DailyActivityList } from './DailyActivityList';

export function ActivitySummary({ logs, profileId, now, easy, entries = [] }: {
    logs: AttemptLog[]; profileId: string; now: Date; easy: boolean; entries?: readonly KokugoActivityEntry[];
}) {
    const [period, setPeriod] = useState<ActivityPeriod>('7');
    const summary = useMemo(() => summarizeActivity(logs, profileId, period, now, entries), [logs, profileId, period, now, entries]);
    const t = (simple: string, standard: string) => easy ? simple : standard;
    const date = (value: Date, year = true) => value.toLocaleDateString('ja-JP', { ...(year ? { year: 'numeric' as const } : {}), month: 'numeric', day: 'numeric' });
    return (
        <SurfacePanel className="stats-activity space-y-4 p-5" data-testid="activity-summary">
            <h2 className="sr-only">{t('まなびの きろく', '学びの記録')}</h2>
            <SegmentedControl aria-label={t('きろくの きかん', '記録の期間')} value={period} onChange={setPeriod}
                options={[
                    { value: '7', label: t('7にちかん', 'この7日間') },
                    { value: '30', label: t('30にちかん', 'この30日間') },
                ]} />
            <div aria-live="polite" aria-atomic="true" className="space-y-3">
                <p className="text-xs text-pokomoko-muted">{date(summary.start)}〜{date(summary.lastDay, summary.start.getFullYear() !== summary.lastDay.getFullYear())}</p>
                <dl className="grid grid-cols-2 gap-2.5">
                    <InsetPanel className="stats-metric text-center">
                        <dt className="text-sm font-bold text-pokomoko-muted">{t('もんだい', '問題')}</dt>
                        <dd className="text-2xl font-black text-slate-800" data-testid="activity-count">{summary.answered.toLocaleString('ja-JP')}<span className="ml-1 text-sm">{t('もん', '問')}</span></dd>
                    </InsetPanel>
                    <InsetPanel className="stats-metric text-center">
                        <dt className="text-sm font-bold text-pokomoko-muted">{t('まなんだ ひ', '学習日')}</dt>
                        <dd className="text-2xl font-black text-slate-800" data-testid="activity-days">{summary.activeDays}<span className="ml-1 text-sm">{t('にち', '日')}</span></dd>
                    </InsetPanel>
                </dl>
            </div>
            {(summary.savedWorks > 0 || summary.savedBooks > 0 || summary.supported > 0) && <p className="text-sm text-pokomoko-muted">{t('こくご', '国語')}：{t('ほんの きろく', '読書の保存')} {summary.savedBooks}{t('かい', '回')} · {t('さくひんの ほぞん', '作品の保存')} {summary.savedWorks}{t('かい', '回')} · {t('たしかめた もんだい', '手本で確認')} {summary.supported}</p>}
            <DailyActivityList key={period} days={summary.daily} easy={easy} />
            <details className="stats-counting-notes">
                <summary>{t('うちわけ・かぞえかた', '内訳・数え方')}</summary>
                <div className="space-y-2 text-sm text-pokomoko-muted">
                    <p>{t('さんすう', '算数')} {summary.answeredMath.toLocaleString('ja-JP')}{t('もん', '問')} ・ {t('えいたんご', '英単語')} {summary.answeredVocab.toLocaleString('ja-JP')}{t('もん', '問')} ・ {t('こくご', '国語')} {summary.answeredKokugo.toLocaleString('ja-JP')}{t('もん', '問')} / スキップ {summary.skipped}{t('かい', '回')}</p>
                    <p>{t('1にちは あさ4じから。スキップは もんだいの かずに ふくまないよ。', '1日は朝4時から。問題数にスキップは含みません。')}</p>
                    <p>{t('ときなおしも ふくむよ。ほんや さくひんは もんだいと わけて かぞえるよ。えいごの きそは べつの きろくだよ。', '解き直しを含みます。読書・作品・手本での確認は回答数に含めません。英語基礎は別の記録です。')}</p>
                </div>
            </details>
        </SurfacePanel>
    );
}
