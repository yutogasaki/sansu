import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { KANJI_ENTRIES, kana, kanjiEntry } from '../../domain/kokugo/kanji/data';
import { KANJI_GRADE_COUNTS, KANJI_PRACTICES, type KanjiPractice } from '../../domain/kokugo/kanji/curriculum';
import { previewKanji } from '../../domain/kokugo/kanji/progress';
export function KokugoKanjiCatalog({ profileId, band, busy, onChoose, easy = false, onSaving }: {
    easy?: boolean; onSaving?: (saving: boolean) => void;
    profileId: string; band: number; busy: boolean; onChoose: (unit: string, target?: string) => void;
}) {
    const t = (simple: string, normal: string) => easy ? simple : normal;
    const gradeLabel = (value: number) => easy ? `しょうがく${value}ねん` : `小学${value}年`;
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
    useEffect(() => { onSaving?.(saving); }, [saving, onSaving]);
    useEffect(() => () => onSaving?.(false), [onSaving]);
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
    return <section className="kokugo-kanji" aria-label={t('がくねんべつの かんじ', '学年別の 漢字')}>
        <h2>{t('1,026じの かんじ', '1,026字の 漢字')}</h2><p>{gradeLabel(grade)}の {KANJI_GRADE_COUNTS[grade - 1]}{t('じ。がくねんの めやすを かえて、ほかの がくねんも えらべるよ。', '字。学年の めやすを 変えて、ほかの学年も えらべるよ。')}</p>
        <div className="kokugo-actions"><button className="kokugo-primary" disabled={locked} onClick={() => onChoose(`HR${grade}`)}>{gradeLabel(grade)}の{t('かんじを 3もん', '漢字を 3もん')}</button>
            <button disabled={locked} onClick={() => onChoose(`HS${grade}`)}>{gradeLabel(grade)}の{t('かんじを えらぶ', '漢字を えらぶ')}</button></div>
        <label htmlFor="kokugo-kanji-search">{t('じ・ことば・よみで さがす（ぜんがくねん）', '字・ことば・読みで さがす（全学年）')}</label>
        <input id="kokugo-kanji-search" type="search" value={query} maxLength={40} disabled={locked}
            onChange={event => { setQuery(event.target.value); setSelected(''); setRevealed(''); }} placeholder={t('れい：山、やま、山道', '例：山、やま、山道')} />
        <p role="status">{entries.length}{t('じ', '字')}{query.trim() ? t(' みつかったよ。', ' 見つかったよ。') : ` · ${t('やってみた じ', '取り組んだ字')} ${entries.filter(e => done.has(e.target)).length}${t('じ', '字')}`}</p>
        {entry && <div ref={detail} className="kokugo-panel kokugo-kanji-detail" aria-label={`${entry.character}の れんしゅう`}>
            <h3><span className="kokugo-kanji-glyph">{entry.character}</span><span>{gradeLabel(entry.grade)}の{t('かんじ', '漢字')}</span></h3>
            <div className="kokugo-actions">{(Object.keys(KANJI_PRACTICES) as KanjiPractice[]).map(kind => <button key={kind} disabled={locked} onClick={() => void start(kind)}>{easy ? ({ R: 'よみを えらぶ', T: 'よみを にゅうりょく', S: 'かんじを えらぶ', P: 'かみに かく' })[kind] : KANJI_PRACTICES[kind]}</button>)}</div>
            {revealed === entry.character ? <div className="kokugo-kanji-model"><p>{entry.readings.length ? `${t('よみの れい', '読みの例')}：${entry.readings.join('・')}` : t('ちめいの なかで よんでみよう。', '地名の中で 読んでみよう。')}</p>
                {entry.words.map(word => <p key={word.text}><ruby>{word.text}<rt>{word.reading}</rt></ruby></p>)}
                <p>{t('この れいを みたことを きろくしたよ。おなじ れいは、たしかめながらの れんしゅうに なるよ。', 'この例を 見たことを きろくしたよ。同じ例は、たしかめながらの 練習になるよ。')}</p></div>
                : <button disabled={locked} onClick={() => void reveal()}>{t('よみと ことばの れいを みる', '読みと ことばの例を 見る')}</button>}
            {due.has(entry.target) && <p>{t('ふくしゅうの めやすだよ。おなじ れいでも、また れんしゅうできるよ。', '復習の めやすだよ。同じ例でも、また れんしゅうできるよ。')}</p>}
            <button disabled={locked} onClick={() => { setSelected(''); setRevealed(''); }}>{t('じの いちらんに もどる', '字の一覧に もどる')}</button>
        </div>}
        {error && <p role="alert">{error}</p>}
        <div className="kokugo-kanji-grid">{entries.map(e => <button key={e.target} disabled={locked} aria-pressed={selected === e.character}
            aria-label={`${e.character} · ${gradeLabel(e.grade)}${due.has(e.target) ? ` · ${t('ふくしゅうの めやす', '復習のめやす')}` : done.has(e.target) ? ` · ${t('やってみた じ', '取り組んだ字')}` : ''}`}
            onClick={() => { setSelected(e.character); setRevealed(''); setError(''); }}>
            <span>{e.character}</span><small>{due.has(e.target) ? t('ふくしゅう', '復習') : done.has(e.target) ? t('れんしゅうちゅう', 'れんしゅう中') : `${e.grade}${t('ねん', '年')}`}</small>
        </button>)}</div>
        <p>{t('かんじの かたちを かみに かく ちからは、じどうで さいてんしないよ。', '漢字の形を 紙に書く力は、自動で 採点しないよ。')}</p>
    </section>;
}
