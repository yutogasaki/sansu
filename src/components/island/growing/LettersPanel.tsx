import { useState } from 'react';
import type { Letter } from './letters';

const readKey = (profileId: string) => `sansu-growing-letters-read:${profileId}`;
function readIds(profileId: string): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem(readKey(profileId)) ?? '[]')); } catch { return new Set(); }
}

function speak(text: string) {
    try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'ja-JP'; utterance.rate = .95;
        window.speechSynthesis.speak(utterance);
    } catch { /* The letter stays on screen. */ }
}

/** Letters from island friends on Pokomoko's board; tapping one reads it aloud. */
export function LettersPanel({ profileId, letters }: { profileId: string; letters: Letter[] }) {
    const [open, setOpen] = useState(false), [read, setRead] = useState(() => readIds(profileId));
    const unread = letters.filter(l => !read.has(l.id)).length;
    const mark = (id: string) => {
        const next = new Set(read).add(id); setRead(next);
        try { localStorage.setItem(readKey(profileId), JSON.stringify([...next].slice(-400))); } catch { /* Read marks are only a convenience. */ }
    };
    if (!open) return <button className="island-secondary room-decor-open" onClick={() => setOpen(true)}>
        <strong>✉️ なかまの てがみ{unread > 0 ? ` （あたらしい ${unread}つう）` : ''}</strong>
        <small>{letters.length ? 'しまの なかまから てがみが とどいているよ' : 'なかまが すむと てがみが とどくよ'}</small>
    </button>;
    return <section className="room-decor" aria-label="なかまの てがみ">
        <header><strong>なかまの てがみ</strong><button className="island-secondary" onClick={() => setOpen(false)}>とじる</button></header>
        {!letters.length && <p className="room-decor-note">しまに なかまが すむと、てがみが とどくよ</p>}
        <ul className="room-letters">{letters.map(letter => <li key={letter.id}>
            <button data-unread={!read.has(letter.id) ? 'true' : undefined} onClick={() => { mark(letter.id); speak(`${letter.from}より。${letter.text}`); }}>
                <small>{letter.from}より</small><span>{letter.text}</span>
            </button>
        </li>)}</ul>
    </section>;
}
