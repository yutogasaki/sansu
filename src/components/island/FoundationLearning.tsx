import { useEffect, useRef, useState } from 'react';
import { FOUNDATION_UNITS, foundationAudio, foundationPicture } from '../../domain/englishFoundation/catalog';
import { commitFoundationAction, finishFoundationIntroduction, presentFoundationSlot, recordFoundationExposure } from '../../domain/englishFoundation/repository';
import type { FoundationAction, FoundationPlan, FoundationTarget } from '../../domain/englishFoundation/types';
import { holdPwaUpdateForCriticalPersistence } from '../../pwa';
import { createFoundationAudio } from './foundationAudio';
import './FoundationLearning.css';

const pictureNames = { apple: 'りんご', cat: 'ねこ', dog: 'いぬ', A: 'A', B: 'B', C: 'C' };
const isLetter = (target: FoundationTarget) => ['A', 'B', 'C'].includes(target);
function Target({ target, described = false }: { target: FoundationTarget; described?: boolean }) {
    return isLetter(target) ? <span className="foundation-letter" lang="en">{target}</span>
        : <><img className="foundation-picture" src={foundationPicture(target)} alt="" />{described && <span>{pictureNames[target]}</span>}</>;
}

/** A failed asset never silently changes the frozen problem or manufactures an answer. */
async function checkAssets(plan: FoundationPlan, signal: AbortSignal) {
    const paths = [...new Set(plan.slots.flatMap(slot => [slot.audio, ...slot.choices.filter(t => !isLetter(t)).map(foundationPicture)]))];
    const manifestResponse = await fetch('/foundation/v1/manifest.json', { signal });
    if (!manifestResponse.ok) throw new Error('catalog unavailable');
    const manifest = await manifestResponse.json() as { version: string; assets: { path: string; sha256: string }[] };
    if (manifest.version !== 'foundation-assets-v1') throw new Error('catalog changed');
    await Promise.all(paths.map(async path => {
        const response = await fetch(path, { signal });
        const expected = manifest.assets.find(asset => asset.path === path);
        const bytes = await response.arrayBuffer();
        if (!response.ok || !expected || bytes.byteLength < 64) throw new Error('asset unavailable');
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
        if (hash !== expected.sha256) throw new Error('asset changed');
    }));
}
export function FoundationLearning({ initialPlan, onPlan, onNext, onClose, onSwitch, onBusyChange, soundEnabled, active = true }: {
    initialPlan: FoundationPlan; onPlan: (plan: FoundationPlan) => void; onNext: () => Promise<void>; onClose: () => void;
    onSwitch: () => void; onBusyChange: (busy: boolean) => void; soundEnabled: boolean; active?: boolean;
}) {
    const [plan, setPlan] = useState(initialPlan), [busy, setBusy] = useState(false), [error, setError] = useState<string>();
    const [ready, setReady] = useState(false), [retry, setRetry] = useState(0), [heard, setHeard] = useState(false);
    const [alternative, setAlternative] = useState(false), [feedback, setFeedback] = useState<string>();
    const [audio] = useState(createFoundationAudio), locked = useRef(false), alive = useRef(true);
    const slot = plan.slots[plan.cursor];
    const apply = (updated: FoundationPlan) => { setPlan(updated); onPlan(updated); };
    useEffect(() => { alive.current = true; return () => { alive.current = false; audio.stop(); }; }, [audio]);
    useEffect(() => {
        const stop = () => { if (document.visibilityState !== 'visible') audio.stop(); };
        if (!active || !soundEnabled) audio.stop();
        document.addEventListener('visibilitychange', stop);
        return () => document.removeEventListener('visibilitychange', stop);
    }, [active, soundEnabled, audio]);
    useEffect(() => {
        audio.stop(); setHeard(false); setAlternative(false); setReady(false);
        if (!active || !plan.introDone || plan.status === 'completed') return;
        const controller = new AbortController(), release = holdPwaUpdateForCriticalPersistence();
        void checkAssets(plan, controller.signal).then(() => presentFoundationSlot(plan.profileId, plan.id)).then(updated => {
            if (!controller.signal.aborted) { apply(updated); setReady(true); setError(undefined); }
        }).catch(() => { if (!controller.signal.aborted) setError('おとや えを よみこめなかったよ。もういちど ためそう。'); }).finally(release);
        return () => { controller.abort(); audio.stop(); };
        // A presentation write changes revision, but cannot re-present its own stimulus.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plan.id, plan.cursor, plan.introDone, plan.status, active, retry, audio]);
    const run = async (operation: () => Promise<void>) => {
        if (locked.current) return; locked.current = true; setBusy(true); onBusyChange(true); setError(undefined);
        const release = holdPwaUpdateForCriticalPersistence();
        try { await operation(); }
        catch { if (alive.current) setError('ほぞんを たしかめられなかったよ。もういちど ためしてね。'); }
        finally { release(); locked.current = false; onBusyChange(false); if (alive.current) setBusy(false); }
    };
    const play = async (target: FoundationTarget, intro = false) => {
        if (busy || !soundEnabled) return;
        try {
            const playing = audio.play(foundationAudio(target), () => { setHeard(false); setError('おとを ならせなかったよ。「きこえない」から えらんでね。'); });
            if (intro) await Promise.all([playing, recordFoundationExposure(plan.profileId, [target], 'introduction')]);
            else await Promise.all([playing, recordFoundationExposure(plan.profileId, [target], 'replay', undefined, Date.now(), slot?.presentation?.id)]); setHeard(true); setError(undefined);
        } catch { setError('おとを ならせなかったよ。「きこえない」から えらんでね。'); }
    };
    const act = (action: FoundationAction['action'], answer?: FoundationTarget) => void run(async () => {
        audio.stop();
        const result = await commitFoundationAction({ profileId: plan.profileId, planId: plan.id, revision: plan.revision, action, answer });
        apply(result.plan);
        if (action === 'alternative') { setAlternative(true); setHeard(true); }
        setFeedback(action === 'answer' && !result.completion ? 'もういちど やってみよう' : result.completion ? 'ひとつ とどいたね' : undefined);
    });
    const unit = FOUNDATION_UNITS.find(u => u.id === plan.unit)!;
    return <section className="foundation-learning island-sheet" aria-labelledby="foundation-title" data-learning-candidate="foundation-v1"
        data-foundation-screen={!plan.introDone ? 'introduction' : plan.status === 'completed' ? 'completed' : 'question'}
        data-plan-id={plan.id} data-plan-revision={plan.revision} data-cursor={plan.cursor} aria-busy={busy}>
        <div className="foundation-top"><span className="foundation-eyebrow">もじと おとの えいご</span><button className="island-text-button" disabled={busy} onClick={() => { audio.stop(); onSwitch(); }}>コースを かえる</button></div>
        <h2 id="foundation-title">{unit.title}</h2>
        <button className="island-text-button" disabled={busy || !soundEnabled} onClick={() => { void audio.play(`/foundation/v1/audio/${!plan.introDone ? 'explore' : plan.status === 'completed' ? 'finish' : slot?.form === 'shape' ? 'shape' : 'listen'}.mp3`).catch(() => setError('おとを ならせなかったよ。')); }}>♪ せつめいを きく</button>
        {!plan.introDone ? <>
            <p>さわって きいてみよう</p>
            <div className="foundation-choices">{unit.targets.map(target => <button className="foundation-choice" key={target} disabled={busy || !soundEnabled} onClick={() => void play(target, true)} aria-label={`${pictureNames[target]}の おとを きく`}><Target target={target} /></button>)}</div>
            <button className="island-primary" disabled={busy} onClick={() => void run(async () => { audio.stop(); apply(await finishFoundationIntroduction(plan.profileId, plan.id, plan.revision)); })}>いっしょに やってみよう</button>
        </> : plan.status === 'completed' ? <div className="foundation-completed">
            <p className="foundation-fact">{plan.unit === 'F01' ? 'A・B・Cに あえたね' : 'えいごの おとに あえたね'}</p>
            <p>しまへ ひかりが とどいたよ</p>
            <button className="island-primary" disabled={busy} onClick={() => void run(onNext)}>もうすこし やってみる</button>
            <button className="island-text-button" disabled={busy} onClick={onClose}>きょうは ここまで</button>
        </div> : slot && <>
            <p className="foundation-progress" aria-label={`${plan.cursor + 1}もんめ、ぜんぶで ${plan.slots.length}もん`}>{plan.slots.map((_, index) => <span key={index} data-completed={index < plan.cursor} data-current={index === plan.cursor}>{index < plan.cursor ? '●' : '○'}</span>)}</p>
            <h3>{alternative ? 'いっしょに えらぼう' : slot.form === 'shape' ? 'おなじ かたちは どれ？' : 'きいて えらぼう'}</h3>
            {!ready ? <p role="status">じゅんびしているよ…</p> : <>
            {slot.form === 'shape' || alternative ? <div className="foundation-reference"><Target target={slot.target} described={alternative} /></div> :
                <button className="island-primary foundation-listen" disabled={!ready || busy || !soundEnabled} onClick={() => void play(slot.target)}>♪ {heard ? 'もういちど きく' : 'おとを きく'}</button>}
            <div className="foundation-choices">{slot.choices.map((target, index) => <button key={target} className="foundation-choice" data-model={slot.support === 'model' && target === slot.target}
                disabled={!ready || busy || slot.form !== 'shape' && !heard} onClick={() => act('answer', target)} aria-label={isLetter(target) ? target : alternative ? pictureNames[target] : `${index + 1}ばんの え`}>
                <Target target={target} described={alternative} /></button>)}</div>
            <p className="foundation-feedback" role="status">{feedback ?? (!ready ? 'じゅんびしているよ…' : slot.support === 'model' ? 'おなじ ものを えらんでみよう' : slot.support === 'hint' ? 'いっしょに もういちど みてみよう' : 'えらんでみよう')}</p>
            <div className="foundation-support">
                {slot.support === 'none' ? <button className="island-text-button" disabled={!ready || busy} onClick={() => act('hint')}>いまは むずかしい</button>
                    : slot.support === 'hint' ? <button className="island-text-button" disabled={!ready || busy} onClick={() => act('model')}>おてほんを みよう</button>
                    : <button className="island-primary" disabled={!ready || busy} onClick={() => act('supported_completed')}>つぎへ すすむ</button>}
                <button className="island-text-button" disabled={!ready || busy} onClick={() => act('alternative')}>きこえない・もじで みる</button>
            </div>
            </>}
        </>}
        {error && <div role="alert" className="foundation-error"><p>{error}</p><button className="island-text-button" disabled={busy} onClick={() => { setError(undefined); setRetry(n => n + 1); }}>もういちど ためす</button></div>}
        {plan.status !== 'completed' && <button className="island-text-button foundation-later" disabled={busy} onClick={() => { audio.stop(); onClose(); }}>あとで・しまへ もどる</button>}
    </section>;
}
