import { useState } from 'react';
import type { KokugoProgress } from '../../domain/kokugo/types';
import { KANJI_ENTRIES } from '../../domain/kokugo/kanji/data';
import { confirmed } from '../../domain/kokugo/evaluation';
export function KokugoKanjiProgress({ progress, easy = false, parent = false }: { progress: KokugoProgress[]; easy?: boolean; parent?: boolean }) {
    const t = (simple: string, normal: string) => easy ? simple : normal;
    const [open, setOpen] = useState(false), [grade, setGrade] = useState(1);
    const rows = progress.filter(p => p.target.startsWith('kanji:'));
    const practiced = new Set(rows.filter(p => p.nextReview !== undefined).map(p => p.target));
    const due = new Set(rows.filter(p => p.nextReview !== undefined && p.nextReview <= Date.now()).map(p => p.target));
    if (!rows.length) return null;
    return <div><p>{t('かんじ：やってみた じ', '漢字：取り組んだ字')} {practiced.size} / 1,026{t('じ', '字')} · {t('ふくしゅうの めやす', '復習のめやす')} {due.size}{t('じ', '字')}</p>
        <details onToggle={event => setOpen(event.currentTarget.open)}><summary>{t('かんじごとの きろく', '漢字ごとの きろく')}</summary>
            {open && <><label htmlFor="kokugo-record-grade">{t('がくねん', '学年')}</label> <select id="kokugo-record-grade" value={grade} onChange={e => setGrade(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6].map(g => <option key={g} value={g}>{t('しょうがく', '小学')}{g}{t('ねん', '年')}</option>)}</select>
                {KANJI_ENTRIES.filter(e => e.grade === grade && rows.some(p => p.target === e.target)).map(entry => <div key={entry.target}><strong>{entry.character}</strong>
                    {rows.filter(p => p.target === entry.target).map(p => <p key={p.id}>{p.mode === 'expression-structured' ? t('かんじを えらぶ', '漢字を選ぶ') : p.form === 'short' ? t('よみを にゅうりょく', '読みを入力') : t('よみを えらぶ', '読みを選ぶ')}{parent ? `：独力の初答 ${p.independentItems.length}例` : ''}
                        {confirmed(p) ? p.delayedCount ? t(' · あとでも たしかめた', ' · 後日も確認') : t(' · べつの れいで たしかめた', ' · 異なる例で確認') : t(' · れんしゅうちゅう', ' · れんしゅう中')}{p.familiarReviewCount ? ` · ${t('まえの れいを あとで ふくしゅう', '前の例の後日復習')} ${p.familiarReviewCount}${t('かい', '回')}` : ''}</p>)}
                </div>)}<p>{t('よむ・えらぶ・かみに かくは べつべつの とりくみだよ。', '読む・選ぶ・紙に書くは 別々の取り組みだよ。')}</p></>}
        </details></div>;
}
