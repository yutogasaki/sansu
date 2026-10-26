import { useState } from 'react';
import type { KokugoProgress } from '../../domain/kokugo/types';
import { KANJI_ENTRIES } from '../../domain/kokugo/kanji/data';
import { confirmed } from '../../domain/kokugo/evaluation';
export function KokugoKanjiProgress({ progress }: { progress: KokugoProgress[] }) {
    const [open, setOpen] = useState(false), [grade, setGrade] = useState(1);
    const rows = progress.filter(p => p.target.startsWith('kanji:'));
    const practiced = new Set(rows.filter(p => p.nextReview !== undefined).map(p => p.target));
    const due = new Set(rows.filter(p => p.nextReview !== undefined && p.nextReview <= Date.now()).map(p => p.target));
    if (!rows.length) return null;
    return <div><p>配当漢字：取り組んだ字 {practiced.size} / 1,026字 · 復習のめやす {due.size}字</p>
        <details onToggle={event => setOpen(event.currentTarget.open)}><summary>漢字ごとの きろく</summary>
            {open && <><label htmlFor="kokugo-record-grade">学年</label> <select id="kokugo-record-grade" value={grade} onChange={e => setGrade(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6].map(g => <option key={g} value={g}>小学{g}年</option>)}</select>
                {KANJI_ENTRIES.filter(e => e.grade === grade && rows.some(p => p.target === e.target)).map(entry => <div key={entry.target}><strong>{entry.character}</strong>
                    {rows.filter(p => p.target === entry.target).map(p => <p key={p.id}>{p.mode === 'expression-structured' ? '漢字を選ぶ' : p.form === 'short' ? '読みを入力' : '読みを選ぶ'}：独力の初答 {p.independentItems.length}例
                        {confirmed(p) ? p.delayedCount ? ' · 後日も確認' : ' · 異なる例で確認' : ' · れんしゅう中'}{p.familiarReviewCount ? ` · 前の例の後日復習 ${p.familiarReviewCount}回` : ''}</p>)}
                </div>)}<p>読む・選ぶ・紙に書くは 別々の取り組みだよ。</p></>}
        </details></div>;
}
