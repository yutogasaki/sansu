import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { KANJI_ENTRIES, kana, kanjiEntry } from '../../domain/kokugo/kanji/data';
import { KANJI_GRADE_COUNTS, KANJI_PRACTICES, type KanjiPractice } from '../../domain/kokugo/kanji/curriculum';
import { previewKanji } from '../../domain/kokugo/kanji/progress';
export function KokugoKanjiCatalog({ profileId, band, busy, onChoose }: {
    profileId: string; band: number; busy: boolean; onChoose: (unit: string, target?: string) => void;
}) {
    const detail = useRef<HTMLDivElement>(null);
    const grade = Math.min(6, Math.max(1, band - 1));
    const [query, setQuery] = useState(''), [selected, setSelected] = useState('');
    useEffect(() => { setQuery(''); setSelected(''); }, [band]);
    const [revealed, setRevealed] = useState(''), [saving, setSaving] = useState(false), [error, setError] = useState('');
    const progress = useLiveQuery(() => db.kokugoProgress.where('profileId').equals(profileId).toArray(), [profileId], []);
    const done = useMemo(() => new Set(progress.filter(p => p.target.startsWith('kanji:') && p.nextReview !== undefined).map(p => p.target)), [progress]);
    const due = useMemo(() => new Set(progress.filter(p => p.target.startsWith('kanji:') && p.nextReview !== undefined && p.nextReview <= Date.now()).map(p => p.target)), [progress]);
    const entries = KANJI_ENTRIES.filter(entry => query.trim() ? kana(`${entry.character} ${entry.words.map(w => `${w.text} ${w.reading}`).join(' ')} ${entry.readings.join(' ')}`).includes(kana(query)) : entry.grade === grade);
    useEffect(() => { if (selected) detail.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); }, [selected]);
    const entry = kanjiEntry(selected), locked = busy || saving;
    const reveal = async () => {
        if (!entry || locked) return;
        setSaving(true); setError('');
        try { await previewKanji(profileId, entry.target); setRevealed(entry.character); }
        catch (error) { setError(error instanceof Error ? error.message : String(error)); }
        finally { setSaving(false); }
    };
    const start = async (kind: KanjiPractice) => {
        if (!entry || locked) return;
        setSaving(true); setError('');
        try {
            // Search results can themselves disclose the spelling/readings relationship.
            if (query.trim()) await previewKanji(profileId, entry.target);
            onChoose(`H${kind}${entry.grade}`, entry.target);
        } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
        finally { setSaving(false); }
    };
    return <section className="kokugo-kanji" aria-label="学年別の 漢字">
        <h2>1,026字の 漢字</h2><p>小学{grade}年の {KANJI_GRADE_COUNTS[grade - 1]}字。学年の めやすを 変えて、ほかの学年も えらべるよ。</p>
        <div className="kokugo-actions"><button className="kokugo-primary" disabled={locked} onClick={() => onChoose(`HR${grade}`)}>小学{grade}年の漢字を 3もん</button>
            <button disabled={locked} onClick={() => onChoose(`HS${grade}`)}>小学{grade}年の漢字を えらぶ</button></div>
        <label htmlFor="kokugo-kanji-search">字・ことば・読みで さがす（全学年）</label>
        <input id="kokugo-kanji-search" type="search" value={query} maxLength={40} disabled={locked}
            onChange={event => { setQuery(event.target.value); setSelected(''); setRevealed(''); }} placeholder="例：山、やま、山道" />
        <p role="status">{entries.length}字{query.trim() ? ' 見つかったよ。' : ` · 取り組んだ字 ${entries.filter(e => done.has(e.target)).length}字`}</p>
        {entry && <div ref={detail} className="kokugo-panel kokugo-kanji-detail" aria-label={`${entry.character}の れんしゅう`}>
            <h3><span className="kokugo-kanji-glyph">{entry.character}</span><span>小学{entry.grade}年の漢字</span></h3>
            <div className="kokugo-actions">{(Object.keys(KANJI_PRACTICES) as KanjiPractice[]).map(kind => <button key={kind} disabled={locked} onClick={() => void start(kind)}>{KANJI_PRACTICES[kind]}</button>)}</div>
            {revealed === entry.character ? <div className="kokugo-kanji-model"><p>{entry.readings.length ? `読みの例：${entry.readings.join('・')}` : '地名の中で 読んでみよう。'}</p>
                {entry.words.map(word => <p key={word.text}><ruby>{word.text}<rt>{word.reading}</rt></ruby></p>)}
                <p>この例を 見たことを きろくしたよ。同じ例は、たしかめながらの 練習になるよ。</p></div>
                : <button disabled={locked} onClick={() => void reveal()}>読みと ことばの例を 見る</button>}
            {due.has(entry.target) && <p>復習の めやすだよ。同じ例でも、また れんしゅうできるよ。</p>}
            <button disabled={locked} onClick={() => { setSelected(''); setRevealed(''); }}>字の一覧に もどる</button>
        </div>}
        {error && <p role="alert">{error}</p>}
        <div className="kokugo-kanji-grid">{entries.map(e => <button key={e.target} disabled={locked} aria-pressed={selected === e.character}
            aria-label={`${e.character} · 小学${e.grade}年${due.has(e.target) ? ' · 復習のめやす' : done.has(e.target) ? ' · 取り組んだ字' : ''}`}
            onClick={() => { setSelected(e.character); setRevealed(''); setError(''); }}>
            <span>{e.character}</span><small>{due.has(e.target) ? '復習' : done.has(e.target) ? 'れんしゅう中' : `${e.grade}年`}</small>
        </button>)}</div>
        <p>漢字の形を 紙に書く力は、自動で 採点しないよ。</p>
    </section>;
}
