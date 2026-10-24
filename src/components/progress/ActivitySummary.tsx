import { useMemo, useState } from 'react';
import type { AttemptLog } from '../../db';
import { summarizeActivity, type ActivityPeriod } from '../../domain/stats/activity';
import { InsetPanel, SegmentedControl, SurfacePanel } from '../ui/SurfacePanel';
import { DailyActivityList } from './DailyActivityList';

export function ActivitySummary({ logs, profileId, now, easy }: {
    logs: AttemptLog[]; profileId: string; now: Date; easy: boolean;
}) {
    const [period, setPeriod] = useState<ActivityPeriod>('7');
    const summary = useMemo(() => summarizeActivity(logs, profileId, period, now), [logs, profileId, period, now]);
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
                        <dt className="text-sm font-bold text-pokomoko-muted">{t('かいとうした ひ', '回答日')}</dt>
                        <dd className="text-2xl font-black text-slate-800" data-testid="activity-days">{summary.answeredDays}<span className="ml-1 text-sm">{t('にち', '日')}</span></dd>
                    </InsetPanel>
                </dl>
            </div>
            <DailyActivityList key={period} days={summary.daily} easy={easy} />
            <details className="stats-counting-notes">
                <summary>{t('うちわけ・かぞえかた', '内訳・数え方')}</summary>
                <div className="space-y-2 text-sm text-pokomoko-muted">
                    <p>{t('さんすう', '算数')} {summary.answeredMath.toLocaleString('ja-JP')}{t('もん', '問')} ・ {t('えいたんご', '英単語')} {summary.answeredVocab.toLocaleString('ja-JP')}{t('もん', '問')} / スキップ {summary.skipped}{t('かい', '回')}</p>
                    <p>{t('1にちは あさ4じから。スキップは もんだいの かずに ふくまないよ。', '1日は朝4時から。問題数にスキップは含みません。')}</p>
                    <p>{t('ときなおしも ふくむよ。えいごの きそは べつの きろくだよ。', '解き直しを含みます。英語基礎の記録とは別です。')}</p>
                </div>
            </details>
        </SurfacePanel>
    );
}
