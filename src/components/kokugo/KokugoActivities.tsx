import { previewKanji, previewKanjiCharacters } from '../../domain/kokugo/kanji/progress';
import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { itemsForUnit, READING_BOOKS } from '../../domain/kokugo/catalog';
import { saveKokugoWork } from '../../domain/kokugo/repository';
import { kokugoUnit } from '../../domain/kokugo/curriculum';
export function KokugoActivities({ profileId, unitId, focusTarget, busy, onError, onSaving }: { profileId: string; unitId: string; focusTarget?: string; busy: boolean; onError: (message: string) => void; onSaving: (saving: boolean) => void }) {
    const items = itemsForUnit(unitId, focusTarget), [index, setIndex] = useState(0);
    const item = items[index];
    // Every character in the H06 topic menu is disclosed, but its unshown words/readings are not.
    const teachingTargets = items.flatMap(item => item.teachingTarget ? [item.teachingTarget] : []).join('|');
    const [modelFor, setModelFor] = useState(''), [showModel, setShowModel] = useState(true), [modelSaving, setModelSaving] = useState(false);
    useEffect(() => {
        if (!item.kanji && !teachingTargets) return;
        let active = true; setModelSaving(true);
        const contact = item.kanji ? previewKanji(profileId, item.target)
            : previewKanjiCharacters(profileId, teachingTargets.split('|'));
        void contact.then(() => { if (active) { setModelFor(item.id); setShowModel(true); } }).catch(error => { if (active) onError(error instanceof Error ? error.message : String(error)); }).finally(() => { if (active) setModelSaving(false); });
        return () => { active = false; };
    }, [profileId, item.id, item.kanji, item.target, teachingTargets, onError]);
    const workId = `${profileId}:${item.id}`;
    const result = useLiveQuery(async () => ({ workId, work: await db.kokugoWorks.get(workId) }), [workId], null);
    const work = result?.workId === workId ? result.work : undefined;
    const [text, setText] = useState(''), [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);
    // Wait for each saved draft before allowing edits, so an async read cannot replace typing.
    const [loadedId, setLoadedId] = useState('');
    useEffect(() => { if (result?.workId !== workId || loadedId === workId) return; setText(result.work?.text ?? ''); setLoadedId(workId); setMessage(''); }, [result, workId, loadedId]);
    const ready = result?.workId === workId && loadedId === workId;
    const modelReady = (!item.kanji && !teachingTargets) || modelFor === item.id;
    const modelVisible = modelReady && (!item.kanji || showModel);
    const queue = useRef(Promise.resolve()), pendingWrites = useRef(0);
    useEffect(() => { onSaving(!ready || saving || modelSaving || text !== (work?.text ?? '')); }, [ready, saving, modelSaving, text, work?.text, onSaving]);
    useEffect(() => () => onSaving(false), [onSaving]);
    const persist = (nextText: string, saved: boolean) => {
        if (!ready || !modelReady || busy) return;
        pendingWrites.current += 1; setSaving(true);
        queue.current = queue.current.catch(() => undefined).then(async () => {
            try {
                await saveKokugoWork({ id: workId, profileId, unitId, text: nextText, saved, updatedAt: Date.now() });
                setMessage(saved ? '作品に のこしたよ。' : '下書きを 保存したよ。');
            } catch (error) { onError(error instanceof Error ? error.message : String(error)); }
            finally { pendingWrites.current -= 1; setSaving(pendingWrites.current > 0); }
        });
    };
    return <section><p className="kokugo-eyebrow">書く・話す 活動</p><h1>{kokugoUnit(unitId).title}</h1>
        {modelVisible && <><label htmlFor="kokugo-topic">お題</label> <select id="kokugo-topic" value={index} disabled={!ready || saving || busy || text !== (work?.text ?? '')} onChange={e => setIndex(Number(e.target.value))}>{items.map((item, i) => <option key={item.id} value={i}>{i + 1}. {item.prompt}</option>)}</select></>}
        {modelVisible ? <><h2>{item.prompt}</h2>{item.kanji && <div className="kokugo-kanji-writing" aria-label="漢字の手本">{item.kanji}</div>}<p className="kokugo-work-text">{item.model}</p></> : <h2>{modelReady ? '手本を 閉じて、紙に 書いてみよう。' : '手本を じゅんびしているよ…'}</h2>}
        {item.kanji && <button disabled={busy || modelFor !== item.id} onClick={() => { if (showModel) setShowModel(false); else { setModelSaving(true); void previewKanji(profileId, item.target).then(() => setShowModel(true)).catch(error => onError(error instanceof Error ? error.message : String(error))).finally(() => setModelSaving(false)); } }}>{showModel ? '手本を 閉じる' : '手本と 見くらべる'}</button>}<p>書いたことや、やってみたことを のこせるよ。自動で まる・ばつは つけないよ。</p>
        <div className="kokugo-draft"><label htmlFor="kokugo-work">作品・メモ</label><textarea id="kokugo-work" maxLength={5000} value={ready ? text : ''} disabled={busy || !ready || !modelReady} onChange={e => { setText(e.target.value); setMessage(''); persist(e.target.value, false); }} placeholder="ここに 書けるよ" /></div>
        <p className="kokugo-save" aria-live="polite">{!ready ? '下書きを よみこんでいるよ…' : saving ? '保存しているよ…' : message || (text !== (work?.text ?? '') ? '下書きを 保存しているよ…' : work?.saved ? '作品に 保存済み' : '下書きは この端末に 保存するよ。')}</p>
        <button className="kokugo-primary" disabled={busy || !ready || !modelReady || saving || !text.trim()} onClick={() => persist(text, true)}>作品に のこす</button>
        <p>話した音や、紙の文字は 送信・録音しないよ。</p>
    </section>;
}
export function KokugoReading({ profileId, busy, onError, onSaving }: { profileId: string; busy: boolean; onError: (message: string) => void; onSaving: (saving: boolean) => void }) {
    const [index, setIndex] = useState(0), [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);
    useEffect(() => { onSaving(saving); }, [saving, onSaving]);
    useEffect(() => () => onSaving(false), [onSaving]);
    const book = READING_BOOKS[index];
    const save = async () => {
        if (busy || savingRef.current) return;
        savingRef.current = true; setSaving(true); setMessage('');
        try {
            await saveKokugoWork({ id: `${profileId}:reading:${book.id}`, profileId, unitId: 'R01', text: `読んだ本：${book.title}`, saved: true, updatedAt: Date.now() });
            setMessage('読んだ本に のこしたよ。');
        } catch (error) { onError(String(error)); }
        finally { savingRef.current = false; setSaving(false); }
    };
    return <section><p className="kokugo-eyebrow">お話を よむ</p><h1>{book.title}</h1>
        <label htmlFor="kokugo-book">お話</label> <select id="kokugo-book" value={index} disabled={busy || saving} onChange={e => { setIndex(Number(e.target.value)); setMessage(''); }}>{READING_BOOKS.map((book, i) => <option key={book.id} value={i}>{book.title}</option>)}</select>
        <div className="kokugo-passage kokugo-book">{book.text}</div>
        <button disabled={busy || saving} onClick={() => void save()}>読んだ本に のこす</button>
        <p aria-live="polite">{message || '何度でも、すきな ところから 読めるよ。'}</p></section>;
}
