import { speakJapanese } from '../../../utils/tts';
import { useEffect, useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import type { Letter } from './letters';

const readKey = (profileId: string) => `sansu-growing-letters-read:${profileId}`;
function readIds(profileId: string): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem(readKey(profileId)) ?? '[]')); } catch { return new Set(); }
}

/** Select one letter to read; audio and read marks remain an explicit action. */
export function LettersPanel({ profileId, letters }: { profileId: string; letters: Letter[] }) {
    const [open, setOpen] = useState(false), [read, setRead] = useState(() => readIds(profileId));
    const [selected, setSelected] = useState<string>();
    const panelHeading = useRef<HTMLElement>(null);
    const heading = useRef<HTMLHeadingElement>(null);
    const list = useRef<HTMLUListElement>(null);
    const letter = letters.find(item => item.id === selected);
    const voice = useRef<(() => void) | undefined>(undefined);
    useEffect(() => {
        const stop = () => voice.current?.();
        const hidden = () => { if (document.hidden) stop(); };
        document.addEventListener('visibilitychange', hidden);
        const menu = document.querySelector('dialog.island-house-menu');
        menu?.addEventListener('close', stop);
        return () => { document.removeEventListener('visibilitychange', hidden); menu?.removeEventListener('close', stop); stop(); };
    }, [profileId]);
    const entry = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (open) panelHeading.current?.focus({ preventScroll: true });
    }, [open]);
    useEffect(() => {
        if (selected) heading.current?.focus({ preventScroll: true });
    }, [selected]);
    const unread = letters.filter(l => !read.has(l.id)).length;
    const mark = (id: string) => {
        const next = new Set(read).add(id); setRead(next);
        try { localStorage.setItem(readKey(profileId), JSON.stringify([...next].slice(-400))); } catch { /* Read marks are only a convenience. */ }
    };
    if (!open) return <button ref={entry} className="island-secondary room-decor-open" data-room-entry="letters" onClick={() => setOpen(true)}>
        <span className="room-entry-icon" aria-hidden="true"><Mail size={28} /></span>
        <strong>なかまの てがみ</strong>
        {unread > 0 && <span className="room-entry-badge">あたらしい {unread}つう</span>}
        <small>{letters.length ? `${letters.length}つう とどいているよ` : 'まだ とどいていないよ'}</small>
    </button>;
    return <section className="room-decor" data-room-panel="letters" aria-label="なかまの てがみ">
        <header><strong ref={panelHeading} tabIndex={-1}>なかまの てがみ</strong><button className="island-secondary" onClick={() => { voice.current?.(); setSelected(undefined); setOpen(false); requestAnimationFrame(() => entry.current?.focus()); }}>とじる</button></header>
        {!letters.length && <p className="room-decor-note">しまの できごとが、てがみで とどくよ</p>}
        {letter ? <>
            <h3 ref={heading} tabIndex={-1}>{letter.from}より</h3>
            <div className="room-letter-body"><p>{letter.text}</p></div>
            <div className="room-letter-actions">
                <button className="island-secondary" onClick={() => { mark(letter.id); voice.current?.(); voice.current = speakJapanese(`${letter.from}より。${letter.text}`); }}>よみあげる</button>
                <button className="island-secondary" onClick={() => voice.current?.()}>よみあげを とめる</button>
                <button className="island-secondary" onClick={() => {
                    voice.current?.(); setSelected(undefined);
                    requestAnimationFrame(() => Array.from(list.current?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(button => button.dataset.letterId === letter.id)?.focus());
                }}>いちらんへ もどる</button>
            </div>
        </> : <ul ref={list} className="room-letters">{letters.map(letter => <li key={letter.id}>
            <button data-letter-id={letter.id} data-unread={!read.has(letter.id) ? 'true' : undefined} onClick={() => { voice.current?.(); setSelected(letter.id); }}>
                <small>{letter.from}より{!read.has(letter.id) && '・あたらしい'}</small><span>{Array.from(letter.text).slice(0, 24).join('')}{Array.from(letter.text).length > 24 ? '…' : ''}</span>
            </button>
        </li>)}</ul>}
    </section>;
}
