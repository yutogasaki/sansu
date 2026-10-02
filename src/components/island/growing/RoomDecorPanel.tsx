import { useMemo, useState } from 'react';
import { IslandToyIcon } from '../IslandToyIcon';
import { patternOpen, RUG_COLORS, WALL_PATTERNS, WORD_GROUPS, type LearnedWord, type RoomDecor, type WordGroupId } from '../../../domain/growingIsland/room';
import type { Command } from '../../../domain/growingIsland';
import './growingLoading.css';

/** もようがえ: the wall is drawn with the words the child learned; shapes open with math. */
export function RoomDecorPanel({ room, words, mathLevel, vocabLevel = 0, error, onDecorate }: {
    room: RoomDecor; words: readonly LearnedWord[]; mathLevel: number; vocabLevel?: number; error?: string;
    onDecorate: (command: Extract<Command, { type: 'decorate' }>) => void;
}) {
    const [open, setOpen] = useState(false);
    const counts = useMemo(() => Object.fromEntries(WORD_GROUPS.map(g => [g.id, words.filter(w => w.group === g.id).length])) as Record<WordGroupId, number>, [words]);
    const hidden = new Set(room.hidden ?? []);
    if (!open) return <button className="island-secondary room-decor-open" data-room-entry="decor" onClick={() => setOpen(true)}>
        <span className="room-entry-icon" aria-hidden="true"><IslandToyIcon kind="palette" size={32} /></span>
        <strong>もようがえ</strong><small>{words.length ? `おぼえた ことば ${words.length}こが かべの もように` : 'ことばを おぼえると かべに みずたまが ふえるよ'}</small>
    </button>;
    return <section className="room-decor" data-room-panel="decor" aria-label="もようがえ">
        <header><strong>もようがえ</strong><button className="island-secondary" onClick={() => setOpen(false)}>とじる</button></header>
        <p className="room-decor-note">かべの みずたまは、おぼえた えいごの ことば。さわると よみあげるよ</p>
        <h3>もようの かたち</h3>
        <div className="room-decor-row">{WALL_PATTERNS.map(pattern => {
            const available = patternOpen(pattern.id, mathLevel, vocabLevel);
            const need = 'vocabLevel' in pattern ? `えいご Lv${pattern.vocabLevel}で` : `さんすう Lv${pattern.mathLevel}で`;
            return <button key={pattern.id} className="island-secondary" aria-pressed={room.pattern === pattern.id} disabled={!available}
                onClick={() => onDecorate({ type: 'decorate', pattern: pattern.id })}>
                {pattern.name}{!available && <small>{need}</small>}</button>;
        })}</div>
        <h3>つかう いろ</h3>
        <div className="room-decor-row">{WORD_GROUPS.filter(g => counts[g.id] > 0).map(group =>
            <button key={group.id} className="island-secondary room-decor-color" aria-pressed={!hidden.has(group.id)} style={{ borderColor: group.color }}
                onClick={() => {
                    const next = new Set(hidden); if (next.has(group.id)) next.delete(group.id); else next.add(group.id);
                    onDecorate({ type: 'decorate', hidden: [...next] });
                }}><span style={{ background: group.color }} aria-hidden="true" />{group.name} {counts[group.id]}</button>)}
            {!words.length && <small>まだ ないよ。まなぶと ふえるよ</small>}</div>
        <h3>ラグ</h3>
        <div className="room-decor-row">{RUG_COLORS.map((color, index) => <button key={color} className="room-decor-swatch" style={{ background: color }}
            aria-label={`ラグの いろ ${index + 1}`} aria-pressed={room.rug === index} onClick={() => onDecorate({ type: 'decorate', rug: index })} />)}</div>
        {error && <p role="alert">{error}</p>}
    </section>;
}
