import { useEffect, useState } from 'react';
import { Award, Trophy, X } from 'lucide-react';
import { TenKey } from '../domain/TenKey';
import { useChallengeSession } from './useChallengeSession';
import { setChallengeAwardDisplayed } from '../../domain/challenge/repository';
import { CHALLENGE_CANDIDATE } from '../../domain/challenge/feature';
import { holdPwaUpdateForCriticalPersistence } from '../../pwa';
import './Challenge.css';

export function ChallengePanel({ profileId, initialStart, onClose }: { profileId: string; initialStart: boolean; onClose: () => void }) {
    const session = useChallengeSession(profileId, initialStart);
    const [entry, setEntry] = useState({ key: '', text: '' });
    const [displaying, setDisplaying] = useState(false), [displayError, setDisplayError] = useState(false);
    const question = session.run?.questions[session.run.index];
    const key = `${session.run?.startedAt}:${question?.id}`;
    const input = entry.key === key ? entry.text : '';
    const ready = session.phase === 'running' && session.run?.phase === 'running' && session.run.feedbackUntil === null;
    const change = (text: string) => { if (ready) setEntry({ key, text: text.slice(0, 3) }); };
    const submit = () => { if (ready && input) session.answer(input); };
    useEffect(() => {
        const keydown = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || !ready) return;
            if (event.target instanceof HTMLElement && event.target.closest('button') && !event.target.closest('.challenge-keypad') && ['Enter', ' '].includes(event.key)) return;
            if (/^[0-9]$/.test(event.key)) { event.preventDefault(); change(input + event.key); }
            else if (event.key === 'Backspace') { event.preventDefault(); change(input.slice(0, -1)); }
            else if (event.key === 'Escape') { event.preventDefault(); change(''); }
            else if (event.key === 'Enter') { event.preventDefault(); submit(); }
        };
        window.addEventListener('keydown', keydown);
        return () => window.removeEventListener('keydown', keydown);
    });
    const close = async () => { await session.stop('closed'); onClose(); };
    const display = async () => {
        if (displaying || !session.result) return;
        const release = holdPwaUpdateForCriticalPersistence(); setDisplaying(true); setDisplayError(false);
        try {
            for (const id of session.result.newAwards) await setChallengeAwardDisplayed(profileId, id, true);
            onClose();
        } catch { setDisplayError(true); }
        finally { setDisplaying(false); release(); }
    };
    const last = session.run?.events[session.run.events.length - 1];
    const feedback = session.run?.feedbackUntil !== null && last && question
        ? last.outcome === 'correct' ? 'できた！' : `${question.a} + ${question.b} = ${question.answer}` : '';
    return <section className="challenge-panel" data-testid="challenge-panel" data-phase={session.phase} data-visual-candidate-id={CHALLENGE_CANDIDATE}>
        <header className="challenge-heading"><h2>10までの たしざん・1ぷん</h2>
            <button className="island-text-button" disabled={session.phase === 'saving' || displaying} onClick={() => void close()}><X size={20} />とじる</button></header>
        {session.phase === 'loading' || session.phase === 'saving' ? <p className="challenge-countdown" role="status">{session.phase === 'loading' ? 'じゅんびしているよ' : 'きろくを のこしているよ'}</p>
            : session.phase === 'countdown' ? <div className="challenge-countdown"><p>ようい</p><strong role="status">{session.countdown}</strong></div>
            : session.phase === 'running' ? <>
                <div className="challenge-clock"><div className="challenge-clock-label"><span>あと {session.remaining}びょう</span><span>{session.counts.correct}もん</span></div><progress max={60} value={session.remaining} aria-label="のこりじかん" /></div>
                <div className="challenge-active"><div className="challenge-problem">
                    <div className="challenge-equation">{question?.a} + {question?.b} = <output aria-label="こたえ" className="challenge-answer">{input || '？'}</output></div>
                    <p className="challenge-feedback" role="status">{feedback}</p>
                </div><div><div className="challenge-keypad"><TenKey onInput={value => change(input + value)} onDelete={() => change(input.slice(0, -1))} onClear={() => change('')} onEnter={submit}
                    disabled={!ready} enterDisabled={!input} confirmationMode="manual" minRowHeight={44} /></div>
                    <button className="island-text-button challenge-skip" disabled={!ready} onClick={() => session.answer(null)}>わからない</button></div></div>
            </> : <div className="challenge-result">
                <h3>{!session.result ? 'チャレンジ' : session.result.official ? 'ここまで！' : 'ここまでの きろく'}</h3>
                {session.result && <><output className="challenge-result-score">{session.result.correct}もん</output>
                    <p>{session.result.official ? 'できたね' : 'ここまでの さんこうきろく'}</p>
                    {session.result.improved && <p>じぶんの きろくを こうしん！</p>}
                    {session.result.best !== null && <p>じぶんの ベスト：{session.result.best}もん</p>}
                    {!session.result.official && <p>{session.result.reason === 'save-failed' ? 'きろくを すべて のこせなかったので、ほぞんできた ぶんだよ。' : session.result.reason === 'challenge-settings-changed' ? 'まなびの せっていが かわったので、さんこうきろくに したよ。' : 'とちゅうで おしまいにしたので、ベストには のこらないよ。'}</p>}
                    {session.result.newAwards.length > 0 && <div className="challenge-result-award">
                        {session.result.newAwards.includes('certificate') && <p><Award className="inline" />「1ぷんに ちょうせん」の しょうじょう</p>}
                        {session.result.newAwards.includes('trophy') && <p><Trophy className="inline" />「10までの たしざん」の トロフィー</p>}
                        <button className="island-primary" disabled={displaying} onClick={() => void display()}>いえに かざる</button>
                    </div>}
                </>}
                {(session.error || displayError) && <p role="alert">{session.error ?? 'かざれなかったよ。もういちど ためそう。'}</p>}
                <div className="challenge-result-actions">{session.error && !session.result ? <button className="island-primary" disabled={displaying} onClick={() => void session.retryRecovery()}>きろくを たしかめる</button> : <button className="island-primary" disabled={displaying} onClick={() => void session.restart()}>もういちど</button>}
                    <button className="island-secondary" disabled={displaying} onClick={onClose}>いえへ</button></div>
            </div>}
    </section>;
}
