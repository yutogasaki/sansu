import type { DailyActivity } from '../../domain/stats/activity';

export function DailyActivityList({ days, easy }: { days: DailyActivity[]; easy: boolean }) {
    const t = (simple: string, standard: string) => easy ? simple : standard;
    const number = (value: number) => value.toLocaleString('ja-JP');
    const date = (value: Date) => value.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });
    const time = (value: string) => new Date(value).toLocaleString('ja-JP', {
        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    });
    return <section className="stats-daily" aria-label={t('ひづけごとの きろく', '日付ごとの記録')}>
        <h3 className="sr-only">{t('ひごと', '日別')}</h3>
        <ul className="stats-daily-list">
            {days.map(day => <li key={day.dateKey} data-activity-date={day.dateKey}>
                {day.logs.length === 0 ? <div className="stats-daily-empty">
                    <span>{date(day.date)}</span><span>0{t('もん', '問')}</span>
                </div> : <details className="stats-daily-detail">
                    <summary>
                        <span className="stats-daily-date">{date(day.date)}</span>
                        <strong>{number(day.answered)}{t('もん', '問')}</strong>
                        {day.skipped > 0 && <small className="stats-daily-skip">スキップ {number(day.skipped)}{t('かい', '回')}</small>}
                    </summary>
                    <p className="stats-daily-breakdown">{t('さんすう', '算数')} {number(day.math)}{t('もん', '問')} ・ {t('えいたんご', '英単語')} {number(day.vocab)}{t('もん', '問')}</p>
                    <ol aria-label={`${date(day.date)} ${t('かいとうの じこく', '回答の時刻')}`}>
                        {day.logs.map((log, index) => <li key={log.id ?? index}>
                            <time dateTime={log.timestamp}>{time(log.timestamp)}</time>
                            <span>{log.subject === 'math' ? t('さんすう', '算数') : t('えいたんご', '英単語')}</span>
                            <span>{log.result === 'skipped' || log.skipped ? 'スキップ' : log.result === 'correct' ? t('せいかい', '正答') : t('まちがい', '誤答')}</span>
                        </li>)}
                    </ol>
                </details>}
            </li>)}
        </ul>
    </section>;
}
