import { useMemo, useState } from 'react';
import type { AttemptLog } from '../../db';
import { summarizeActivity, type ActivityPeriod } from '../../domain/stats/activity';
import { InsetPanel, SegmentedControl, SurfacePanel, SurfacePanelHeader } from '../ui/SurfacePanel';

export function ActivitySummary({ logs, profileId, now, easy }: {
    logs: AttemptLog[]; profileId: string; now: Date; easy: boolean;
}) {
    const [period, setPeriod] = useState<ActivityPeriod>('7');
    const summary = useMemo(() => summarizeActivity(logs, profileId, period, now), [logs, profileId, period, now]);
    const t = (simple: string, standard: string) => easy ? simple : standard;
    const date = (value: Date) => value.toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' });
    return (
        <SurfacePanel className="stats-activity space-y-4 p-5" data-testid="activity-summary">
            <SurfacePanelHeader title={t('まなびの きろく', '学びの記録')} />
            <SegmentedControl aria-label={t('きろくの きかん', '記録の期間')} value={period} onChange={setPeriod}
                options={[
                    { value: '7', label: t('7にちかん', 'この7日間') },
                    { value: '30', label: t('30にちかん', 'この30日間') },
                ]} />
            <div aria-live="polite" aria-atomic="true" className="space-y-3">
                <p className="text-xs text-pokomoko-muted">{date(summary.start)}〜{date(summary.lastDay)}</p>
                <dl className="grid grid-cols-2 gap-2.5">
                    <InsetPanel className="stats-metric text-center">
                        <dt className="text-sm font-bold text-pokomoko-muted">{t('かいとう', '回答回数')}</dt>
                        <dd className="text-2xl font-black text-slate-800" data-testid="activity-count">{summary.count.toLocaleString('ja-JP')}<span className="ml-1 text-sm">{t('かい', '回')}</span></dd>
                    </InsetPanel>
                    <InsetPanel className="stats-metric text-center">
                        <dt className="text-sm font-bold text-pokomoko-muted">{t('まなんだ ひ', '学習した日')}</dt>
                        <dd className="text-2xl font-black text-slate-800" data-testid="activity-days">{summary.days}<span className="ml-1 text-sm">{t('にち', '日')}</span></dd>
                    </InsetPanel>
                </dl>
                <p className="text-sm text-slate-700">{t('さんすう', '算数')} {summary.math.toLocaleString('ja-JP')}{t('かい', '回')} ・ {t('えいたんご', '英単語')} {summary.vocab.toLocaleString('ja-JP')}{t('かい', '回')}</p>
                {summary.count === 0 && <p className="text-sm text-pokomoko-muted">{t('この きかんの きろくは まだないよ。', 'この期間の記録はまだありません。')}</p>}
            </div>
            <p className="text-xs text-pokomoko-muted">{t('きょうを ふくむ きろく。1にちは あさ4じから。', '今日を含む記録です。1日は朝4時から数えます。')}</p>
            <p className="text-xs text-pokomoko-muted">{t('スキップも ふくむよ。えいごの きそは べつの きろくだよ。', 'スキップを含む回答記録です。英語基礎の記録とは別です。')}</p>
        </SurfacePanel>
    );
}
