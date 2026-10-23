import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { patternOpen, RUG_COLORS, WALL_PATTERNS, WORD_GROUPS, type LearnedWord, type RoomDecor, type WordGroupId } from '../../../domain/growingIsland/room';
import type { Command } from '../../../domain/growingIsland';
import './growingLoading.css';

/** もようがえ: the wall is drawn with the words the child learned; shapes open with math. */
export function RoomDecorPanel({ room, words, mathLevel, vocabLevel = 0, error, status, busy = false, onDecorate, onRetry, onClose }: {
    room: RoomDecor; words: readonly LearnedWord[]; mathLevel: number; vocabLevel?: number; error?: string; status: string; busy?: boolean; onRetry: () => void; onClose: () => void;
    onDecorate: (command: Extract<Command, { type: 'decorate' }>) => void;
}) {
    const workspace = useRef<HTMLElement>(null);
    const [reflow, setReflow] = useState(false);
    useEffect(() => {
        const root = workspace.current;
        if (!root || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => {
            const scroll = root.querySelector<HTMLElement>('.room-decor-scroll');
            if (scroll && scroll.clientHeight < 80) setReflow(true);
        });
        observer.observe(root);
        for (const child of root.children) observer.observe(child);
        return () => observer.disconnect();
    }, []);
    const heading = useRef<HTMLHeadingElement>(null);
    useEffect(() => { const frame = requestAnimationFrame(() => heading.current?.focus({ preventScroll: true })); return () => cancelAnimationFrame(frame); }, []);
    const locked = busy || status === 'saving' || status === 'loading' || status === 'unknown';
    const counts = useMemo(() => Object.fromEntries(WORD_GROUPS.map(g => [g.id, words.filter(w => w.group === g.id).length])) as Record<WordGroupId, number>, [words]);
    const hidden = new Set(room.hidden ?? []);
    return <section ref={workspace} data-room-reflow={reflow ? 'wide' : undefined} className="room-decor room-decor-workspace" data-room-panel="decor" aria-label="もようがえ">
        <header><h2 ref={heading} tabIndex={-1}>もようがえ</h2><button className="island-secondary" onClick={onClose}><X size={18} aria-hidden="true" />とじる</button></header>
        <div className="room-decor-save" role="status" aria-live="polite">{status === 'loading' ? 'いえを よみこんでいるよ' : status === 'saving' ? 'のこしているよ…' : status === 'saved' ? (busy ? 'のこしたよ。つぎの じゅんびを しているよ' : 'のこしたよ') : 'えらぶと へやに のこるよ'}
            {error && <p>{error}</p>}{(error || status === 'error' || status === 'unknown' || (status === 'saved' && busy)) && <button className="island-secondary" onClick={onRetry}>もういちど たしかめる</button>}</div>
        <div className="room-decor-scroll">
        <h3>ラグ</h3>
        <div className="room-decor-row">{RUG_COLORS.map((color, index) => <button key={color} className="room-decor-swatch" style={{ background: color }}
            disabled={locked} aria-label={`ラグの いろ ${index + 1}・${['あおみどり', 'あか', 'きいろ', 'あお', 'むらさき', 'ももいろ'][index]}`} aria-pressed={room.rug === index} onClick={() => onDecorate({ type: 'decorate', rug: index })}>
            {room.rug === index && <Check size={24} aria-hidden="true" />}<span className="room-swatch-label">{['あおみどり', 'あか', 'きいろ', 'あお', 'むらさき', 'ももいろ'][index]}</span></button>)}</div>
        <p className="room-decor-note">かべの みずたまは、おぼえた えいごの ことば。さわると よみあげるよ</p>
        <h3>もようの かたち</h3>
        <div className="room-decor-row">{WALL_PATTERNS.map(pattern => {
            const available = patternOpen(pattern.id, mathLevel, vocabLevel);
            const need = 'vocabLevel' in pattern ? `えいご Lv${pattern.vocabLevel}で` : `さんすう Lv${pattern.mathLevel}で`;
            return <button key={pattern.id} className="island-secondary" aria-pressed={room.pattern === pattern.id} disabled={locked || !available}
                onClick={() => onDecorate({ type: 'decorate', pattern: pattern.id })}>
                {pattern.name}{!available && <small>{need}</small>}</button>;
        })}</div>
        <h3>つかう いろ</h3>
        <div className="room-decor-row">{WORD_GROUPS.filter(g => counts[g.id] > 0).map(group =>
            <button key={group.id} className="island-secondary room-decor-color" disabled={locked} aria-pressed={!hidden.has(group.id)} style={{ borderColor: group.color }}
                onClick={() => {
                    const next = new Set(hidden); if (next.has(group.id)) next.delete(group.id); else next.add(group.id);
                    onDecorate({ type: 'decorate', hidden: [...next] });
                }}><span style={{ background: group.color }} aria-hidden="true" />{group.name} {counts[group.id]} {hidden.has(group.id) ? 'つかわない' : 'つかう'}</button>)}
            {!words.length && <small>ことばが ふえると、かべの もように なるよ。ラグは かえられるよ</small>}</div>

        </div>
    </section>;
}
