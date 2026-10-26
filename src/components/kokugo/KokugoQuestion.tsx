import { kokugoAudioBlob } from '../../domain/kokugo/media';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KokugoAction, KokugoPlan } from '../../domain/kokugo/types';
export function KokugoQuestion({ plan, busy, soundEnabled, onAction, onDraft }: {
    plan: KokugoPlan; busy: boolean; soundEnabled: boolean; onDraft: (answer: string) => Promise<void>; onAction: (action: KokugoAction['action'], answer?: string) => Promise<void>;
}) {
    const slot = plan.slots[plan.cursor], item = slot.item;
    const question = useRef<HTMLElement>(null);
    useLayoutEffect(() => {
        const content = question.current?.closest('.kokugo-content');
        if (content) content.scrollTop = 0;
        question.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
    }, [item.id]);
    const [order, setOrder] = useState<string[]>(() => slot.draft ? slot.draft.split('｜') : []), [audioError, setAudioError] = useState('');
    const audio = useRef<HTMLAudioElement | null>(null);
    const audioPending = useRef(false), audioUrl = useRef('');
    const generation = useRef(0), actionRef = useRef(onAction), active = useRef(true);
    useEffect(() => { actionRef.current = onAction; active.current = !slot.completedAt && !slot.skipped; if (!active.current) { audio.current?.pause(); audioPending.current = false; } }, [onAction, slot.completedAt, slot.skipped]);
    const completed = !!slot.completedAt || slot.skipped;
    const [text, setText] = useState(slot.draft), [composing, setComposing] = useState(false);
    useEffect(() => { setOrder(slot.draft ? slot.draft.split('｜') : []); setAudioError(''); return () => { audio.current?.pause(); audio.current = null; audioPending.current = false; generation.current += 1; if (audioUrl.current) URL.revokeObjectURL(audioUrl.current); }; }, [item.id, slot.draft]);
    const play = async () => {
        if (!item.audio || audioPending.current) return;
        audio.current?.pause();
        const currentGeneration = generation.current;
        audioPending.current = true;
        setAudioError('');
        try {
            const url = await kokugoAudioBlob(item);
            if (generation.current !== currentGeneration || !active.current) { URL.revokeObjectURL(url); return; }
            if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
            audioUrl.current = url;
            const voice = new Audio(url);
            audio.current = voice;
            voice.onended = () => { audioPending.current = false; if (generation.current === currentGeneration && active.current) void actionRef.current('heard'); };
            voice.onerror = () => { audioPending.current = false; setAudioError('音を よみこめなかったよ。コースから べつの内容へ 戻れるよ。'); };
            await voice.play();
        } catch { audioPending.current = false; setAudioError('音を たしかめられなかったよ。音を 出せるときに もう一度 きいてね。'); }
    };
    const disabled = busy || !slot.presentation || (item.mode === 'listening' && !slot.heard);
    return <section ref={question} className="kokugo-question" aria-label="国語の もんだい" key={item.id}>
        <p className="kokugo-eyebrow">{plan.cursor + 1} / {plan.slots.length} · {item.mode === 'listening' ? '音を きく' : item.mode === 'decoding' ? 'もじを 読む' : '読んで 考える'}</p>
        {item.passage && <div className="kokugo-passage" aria-label="読む文">{item.passage}</div>}
        <h2 tabIndex={-1}>{item.prompt}</h2>
        {item.audio && <div className="kokugo-audio"><button onClick={() => void play()} disabled={busy || completed}>▶ ことばを きく</button>
            {!soundEnabled && <p>音が オフでも、このボタンでは ことばの音が 出るよ。</p>}
            {slot.heard && <span>きいたよ</span>}{audioError && <p role="alert">{audioError}</p>}</div>}
        {item.form === 'short' ? <div className="kokugo-short"><label>こたえ<input value={text} maxLength={80} disabled={completed || !slot.presentation}
            onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}
            onChange={e => { setText(e.target.value); void onDraft(e.target.value); }}
            onKeyDown={e => { if (e.key === 'Enter' && !composing && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) { e.preventDefault(); if (!busy && text.trim() && !completed) void onAction('answer', text); } }} /></label>
            {!completed && <button className="kokugo-primary" disabled={disabled || composing || !text.trim()} onClick={() => void onAction('answer', text)}>たしかめる</button>}</div>
            : item.form === 'order' ? <div>
            <div className="kokugo-order" aria-label="ならべた文">{order.join(' ') || 'ことばを 順に えらぼう。'}</div>
            <div className="kokugo-choices">{item.choices.map(choice => <button key={choice} disabled={disabled || completed || order.includes(choice)} onClick={() => { const next = [...order, choice]; setOrder(next); void onAction('draft', next.join('｜')); }}>{choice}</button>)}</div>
            {!completed && <div className="kokugo-actions"><button disabled={busy || order.length === 0} onClick={() => { setOrder([]); void onAction('draft', ''); }}>ならべなおす</button>
                <button className="kokugo-primary" disabled={disabled || order.length !== item.choices.length} onClick={() => void onAction('answer', order.join('｜'))}>たしかめる</button></div>}
        </div> : <div className="kokugo-choices">{item.choices.map(choice => <button key={choice} disabled={disabled || completed} onClick={() => void onAction('answer', choice)}>{choice}</button>)}</div>}
        <div className="kokugo-feedback" aria-live="polite">
            {completed ? <p>{slot.skipped ? 'また あとで やってみよう。' : slot.retrieved === 'familiar' ? '前の例でも 思い出せたね。' : slot.completionKind === 'independent' ? 'できたね。' : 'たしかめながら できたね。'}</p>
                : slot.support === 'model' ? <p>{slot.firstAnswer?.correct === null && 'この言い方は 自動で たしかめられないよ。'}{item.model}</p> : slot.support === 'hint' ? <p>{item.hint}</p> : <p>ゆっくり 考えていいよ。</p>}
        </div>
        {completed ? <button className="kokugo-primary" disabled={busy} onClick={() => void onAction('next')}>{plan.cursor + 1 === plan.slots.length ? 'ここまで おわる' : 'つぎへ'}</button>
            : <div className="kokugo-actions">
                <button disabled={busy || !slot.presentation} onClick={() => void onAction('hint')}>ヒント</button>
                <button disabled={busy || !slot.presentation} onClick={() => void onAction('model')}>おてほん</button>
                {slot.support === 'model' && <button className="kokugo-primary" disabled={busy} onClick={() => void onAction('complete-supported')}>たしかめて おわる</button>}
                <button disabled={busy || !slot.presentation} onClick={() => void onAction('skip')}>あとで やる</button>
            </div>}
    </section>;
}
