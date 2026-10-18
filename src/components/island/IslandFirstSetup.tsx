import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, X } from 'lucide-react';
import { ONBOARDING_ENGLISH_RANGES, ONBOARDING_GRADES, ONBOARDING_MATH_RANGES, ONBOARDING_SUBJECTS,
    type OnboardingSelection } from '../../domain/user/onboarding';
import type { FirstPlaySession, FirstPlayStep } from '../../domain/user/firstPlay';
import { islandEnabled, ISLAND_DELIVERY_ID } from '../../domain/island/feature';

const titles = { grade: 'いまの がくねんは？', subject: 'なにを まなぶ？', math: 'さんすう どこまで？', english: 'えいご どれくらい？' };
export function IslandFirstSetup({ session, busy, error, onMove, onFinish, onName }: {
    session: FirstPlaySession; busy: boolean; error?: string;
    onMove: (step: FirstPlayStep, selection: OnboardingSelection) => void;
    onFinish: (selection: OnboardingSelection) => void;
    onName: (name: string) => void;
}) {
    const [name, setName] = useState(session.selection.name);
    const heading = useRef<HTMLHeadingElement>(null);
    const step = session.step === 'island' ? 'grade' : session.step;
    const selection = { ...session.selection, name };
    const back = () => onMove(step === 'grade' ? 'island' : step === 'subject' ? 'grade'
        : step === 'english' && selection.subject === 'mix' ? 'math' : 'subject', selection);
    useEffect(() => { heading.current?.focus(); }, [step]);
    const index = step === 'grade' ? 1 : step === 'subject' ? 2 : step === 'math' ? 3 : selection.subject === 'mix' ? 4 : 3;
    const total = selection.subject === 'mix' ? 4 : 3;
    return <main className="island-page island-first-setup" data-onboarding-step={step} data-profile-created="false" data-onboarding-candidate="island-first-play-v2" data-visual-candidate-id="island-first-play-v2"
        data-delivery-id={ISLAND_DELIVERY_ID} data-island-feature-enabled={String(islandEnabled())} data-build-revision={__BUILD_REVISION__} data-build-version={__APP_VERSION__}>
        <header className="island-setup-header">
            <button className="island-icon-button" type="button" aria-label="もどる" disabled={busy} onClick={back}><ArrowLeft size={22} /></button>
            <span><BookOpen size={19} aria-hidden="true" />まなぶ じゅんび</span>
            <button className="island-icon-button first-setup-close" type="button" aria-label="しまへ もどる" disabled={busy} onClick={() => onMove('island', selection)}><X size={22} /></button>
        </header>
        <section className="island-setup-sheet" aria-labelledby="island-setup-title" aria-busy={busy}>
            <p className="first-setup-progress" aria-label={`${total}つのうち ${index}つめ`}>{Array.from({ length: total }, (_, n) => <span key={n} data-current={n < index} />)}</p>
            <h1 id="island-setup-title" ref={heading} tabIndex={-1}>{titles[step]}</h1>
            {step === 'grade' && <label className="island-setup-name">なまえ <span>あとでOK</span>
                <input value={name} maxLength={20} autoComplete="nickname" disabled={busy} onChange={event => { setName(event.target.value); onName(event.target.value); }} />
            </label>}
            <div className={`island-setup-options${step === 'grade' ? ' island-setup-grades' : ''}`}>
                {step === 'grade' && ONBOARDING_GRADES.map(option => <button key={option.value} disabled={busy} onClick={() => onMove('subject', { ...selection, grade: option.value })}>{option.label}</button>)}
                {step === 'subject' && ONBOARDING_SUBJECTS.map(option => <button key={option.value} disabled={busy} onClick={() => onMove(option.value === 'vocab' ? 'english' : 'math', { ...selection, subject: option.value, mathRange: null, englishRange: null })}>{option.label}</button>)}
                {step === 'math' && ONBOARDING_MATH_RANGES.map(option => <button key={option.value} disabled={busy} onClick={() => {
                    const chosen = { ...selection, mathRange: option.value };
                    if (selection.subject === 'math') onFinish(chosen); else onMove('english', chosen);
                }}>{option.label}</button>)}
                {step === 'english' && ONBOARDING_ENGLISH_RANGES.map(option => <button key={option.value} disabled={busy} onClick={() => onFinish({ ...selection, englishRange: option.value })}>{option.label}</button>)}
            </div>
            <p className="island-setup-status" role={error ? 'alert' : 'status'}>{error ?? (busy ? 'ほぞんしているよ…' : 'あとで かえられるよ')}</p>
        </section>
    </main>;
}
