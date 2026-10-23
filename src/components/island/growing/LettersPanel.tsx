import { speakJapanese } from '../../../utils/tts';
import { useEffect, useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import type { Letter } from './letters';

const readKey = (profileId: string) => `sansu-growing-letters-read:${profileId}`;
function readIds(profileId: string): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem(readKey(profileId)) ?? '[]')); } catch { return new Set(); }
}

/** Letters from island friends on Pokomoko's board; tapping one reads it aloud. */
export function LettersPanel({ profileId, letters }: { profileId: string; letters: Letter[] }) {
    const [open, setOpen] = useState(false), [read, setRead] = useState(() => readIds(profileId));
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
    const unread = letters.filter(l => !read.has(l.id)).length;
    const mark = (id: string) => {
        const next = new Set(read).add(id); setRead(next);
        try { localStorage.setItem(readKey(profileId), JSON.stringify([...next].slice(-400))); } catch { /* Read marks are only a convenience. */ }
    };
    if (!open) return <button ref={entry} className="island-secondary room-decor-open" data-room-entry="letters" onClick={() => setOpen(true)}>
        <span className="room-entry-icon" aria-hidden="true"><Mail size={28} /></span>
        <strong>なかまの てがみ</strong>
        {unread > 0 && <span className="room-entry-badge">あたらしい {unread}つう</span>}
        <small>{letters.length ? 'しまの なかまから てがみが とどいているよ' : 'なかまが すむと てがみが とどくよ'}</small>
    </button>;
    return <section className="room-decor" data-room-panel="letters" aria-label="なかまの てがみ">
        <header><strong>なかまの てがみ</strong><button className="island-secondary" onClick={() => { voice.current?.(); setOpen(false); requestAnimationFrame(() => entry.current?.focus()); }}>とじる</button></header>
        <p className="room-decor-note">てがみに さわると きけるよ</p>
        {!letters.length && <p className="room-decor-note">しまに なかまが すむと、てがみが とどくよ</p>}
        <ul className="room-letters">{letters.map(letter => <li key={letter.id}>
            <button data-unread={!read.has(letter.id) ? 'true' : undefined} onClick={() => { mark(letter.id); voice.current?.(); voice.current = speakJapanese(`${letter.from}より。${letter.text}`); }}>
                <small>{letter.from}より</small><span>{letter.text}</span>
            </button>
        </li>)}</ul>
    </section>;
}
