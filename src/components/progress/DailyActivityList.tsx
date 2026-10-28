import { useState } from 'react';
import type { DailyActivity } from '../../domain/stats/activity';

export function DailyActivityList({ days, easy }: { days: DailyActivity[]; easy: boolean }) {
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const selected = days.find(day => day.dateKey === selectedKey);
    const t = (simple: string, standard: string) => easy ? simple : standard;
    const number = (value: number) => value.toLocaleString('ja-JP');
    const date = (value: Date) => value.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });
    const time = (value: string) => new Date(value).toLocaleString('ja-JP', {
        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const months = new Map<string, DailyActivity[]>();
    for (const day of [...days].reverse()) {
        const key = `${day.date.getFullYear()}-${day.date.getMonth()}`;
        const month = months.get(key) ?? [];
        month.push(day);
        months.set(key, month);
    }
    return <section className="stats-calendar" aria-label={t('ひづけごとの きろく', '日付ごとの記録')}>
        {[...months].map(([key, month]) => <section key={key} aria-label={month[0].date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })}>
            <h3 className="stats-calendar-month">{month[0].date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })}</h3>
            <div className="stats-calendar-weekdays" aria-hidden="true">{['日', '月', '火', '水', '木', '金', '土'].map(day => <span key={day}>{day}</span>)}</div>
            <div className="stats-calendar-grid">
                {Array.from({ length: month[0].date.getDay() }, (_, index) => <span key={`blank-${index}`} />)}
                {month.map(day => <button key={day.dateKey} type="button" data-activity-date={day.dateKey}
                    aria-label={`${date(day.date)} ${number(day.answered)}${t('もん', '問')}${day.books ? ` ${day.books}さつ` : ''}${day.works ? ` ${day.works}さくひん` : ''}${day.practice ? ` ${day.practice}かい たしかめた` : ''}${day.skipped ? ` スキップ ${day.skipped}${t('かい', '回')}` : ''}`}
                    aria-pressed={selectedKey === day.dateKey} aria-controls="stats-calendar-detail"
                    className={`stats-calendar-day${day.answered > 0 || day.works || day.books || day.practice ? ' has-answers' : ''}`}
                    onClick={() => setSelectedKey(selectedKey === day.dateKey ? null : day.dateKey)}>
                    <span>{day.date.getDate()}</span><strong>{number(day.answered)}<small>{t('もん', '問')}</small></strong>{(day.works || day.books || day.practice) ? <small>＋{t('かつどう', '活動')}</small> : null}
                </button>)}
            </div>
        </section>)}
        <div id="stats-calendar-detail" aria-live="polite">
            {selected && <section className="stats-calendar-detail" aria-label={`${date(selected.date)} ${t('くわしい きろく', '詳しい記録')}`}>
                <h3>{date(selected.date)} <strong>{number(selected.answered)}{t('もん', '問')}</strong></h3>
                {selected.logs.length === 0 && !selected.entries?.length ? <p className="text-sm text-pokomoko-muted">{t('このひの きろくは まだないよ。', 'この日の記録はまだありません。')}</p> : <>
                    <p className="stats-daily-breakdown">{t('さんすう', '算数')} {number(selected.math)}{t('もん', '問')} ・ {t('えいたんご', '英単語')} {number(selected.vocab)}{t('もん', '問')}
                        ・ {t('こくご', '国語')} {number(selected.kokugo ?? 0)}{t('もん', '問')}
                        {selected.skipped > 0 && <> / スキップ {number(selected.skipped)}{t('かい', '回')}</>}
                    </p>
                    <ol aria-label={t('とりくんだ じこく', '取り組んだ時刻')}>
                        {[
                            ...selected.logs.map((log, index) => ({ id: `log:${log.id ?? index}`, at: Date.parse(log.timestamp), subject: log.subject === 'math' ? t('さんすう', '算数') : t('えいたんご', '英単語'),
                                result: log.result === 'skipped' || log.skipped ? 'スキップ' : log.result === 'correct' ? t('せいかい', '正答') : t('もういちど れんしゅう', '誤答') })),
                            ...(selected.entries ?? []).map(entry => ({ id: entry.id, at: entry.at, subject: t('こくご', '国語'),
                                result: entry.kind === 'reading' ? t('ほんを よんだ', '読書を保存') : entry.kind === 'work' ? t('さくひんを のこした', '作品を保存') : entry.kind === 'practice' ? t('おてほんで たしかめた', '手本で確認') : entry.kind === 'skip' ? 'スキップ' : entry.correct === undefined ? t('こたえた', '回答') : entry.correct ? t('せいかい', '正答') : t('もういちど れんしゅう', '誤答') })),
                        ].sort((a, b) => b.at - a.at).map(row => <li key={row.id}><time dateTime={new Date(row.at).toISOString()}>{time(new Date(row.at).toISOString())}</time><span>{row.subject}</span><span>{row.result}</span></li>)}
                    </ol>
                </>}
            </section>}
        </div>
    </section>;
}
