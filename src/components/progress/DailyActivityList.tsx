import type { DailyActivity } from '../../domain/stats/activity';

export function DailyActivityList({ days, easy }: { days: DailyActivity[]; easy: boolean }) {
    const t = (simple: string, standard: string) => easy ? simple : standard;
    const number = (value: number) => value.toLocaleString('ja-JP');
    const date = (value: Date) => value.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
    const time = (value: string) => new Date(value).toLocaleString('ja-JP', {
        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    });
    return <section className="stats-daily" aria-label={t('ひづけごとの きろく', '日付ごとの記録')}>
        <h3 className="font-bold text-slate-800">{t('いつ・なんもん やった？', 'いつ・何問取り組んだ？')}</h3>
        <p className="text-xs text-pokomoko-muted">{t('ひづけを おすと、じこくまで みられるよ。もんだいの かずに スキップは ふくまないよ。', '日付を開くと、回答した時刻まで確認できます。問題数にスキップは含みません。')}</p>
        <ul className="stats-daily-list">
            {days.map(day => <li key={day.dateKey} data-activity-date={day.dateKey}>
                {day.logs.length === 0 ? <div className="stats-daily-empty">
                    <span>{date(day.date)}</span><span>0{t('もん', '問')}</span>
                    <small>{t('かいとうの きろくなし', '回答の記録なし')}</small>
                </div> : <details className="stats-daily-detail">
                    <summary>
                        <span className="stats-daily-date">{date(day.date)}</span>
                        <strong>{number(day.answered)}{t('もん', '問')}</strong>
                        <span className="stats-daily-breakdown">{t('さんすう', '算数')} {number(day.math)}{t('もん', '問')} ・ {t('えいたんご', '英単語')} {number(day.vocab)}{t('もん', '問')}
                            {day.skipped > 0 && <> / {t('スキップ', 'スキップ')} {number(day.skipped)}{t('かい', '回')}</>}
                        </span>
                    </summary>
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
