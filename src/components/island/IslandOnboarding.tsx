import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Leaf } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { completeOnboardingProfile, OnboardingAlreadyCompleted, ONBOARDING_ENGLISH_RANGES, ONBOARDING_GRADES,
    ONBOARDING_MATH_RANGES, ONBOARDING_SUBJECTS, type OnboardingEnglishRange, type OnboardingMathRange,
    type OnboardingSelection, type OnboardingSubject } from '../../domain/user/onboarding';
import { profileStorage } from '../../utils/storage';
import { holdPwaUpdateForCriticalPersistence } from '../../pwa';
import IslandWelcome, { ISLAND_ONBOARDING_CANDIDATE } from './IslandWelcome';
import './IslandOnboarding.css';

type Step = 'welcome' | 'grade' | 'subject' | 'math' | 'english';
const titles = { grade: 'いまの がくねん', subject: 'なにを まなぶ？', math: 'さんすう どこまで？', english: 'えいご どれくらい？' };

export default function IslandOnboarding() {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>('welcome');
    const [selection, setSelection] = useState<OnboardingSelection>({ name: '', grade: null, subject: null, mathRange: null, englishRange: null });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(false);
    const [completionId] = useState(() => crypto.randomUUID());
    const saving = useRef(false);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const finish = async (chosen: OnboardingSelection) => {
        if (saving.current) return;
        saving.current = true; setBusy(true); setError(false);
        const release = holdPwaUpdateForCriticalPersistence();
        try {
            const receipt = await completeOnboardingProfile(chosen, completionId, 'first');
            profileStorage.setActiveId(receipt.activeProfileId);
            if (mounted.current) navigate(`/island?start=learn&profile=${encodeURIComponent(receipt.activeProfileId)}`, { replace: true });
        } catch (failure) {
            if (!mounted.current) return;
            if (failure instanceof OnboardingAlreadyCompleted) navigate('/', { replace: true });
            else { saving.current = false; setBusy(false); setError(true); }
        } finally { release(); }
    };
    const chooseGrade = (grade: number) => { setSelection(current => ({ ...current, grade })); setStep('subject'); setError(false); };
    const chooseSubject = (subject: OnboardingSubject) => {
        setSelection(current => ({ ...current, subject, mathRange: null, englishRange: null }));
        setStep(subject === 'vocab' ? 'english' : 'math'); setError(false);
    };
    const chooseMath = (mathRange: OnboardingMathRange) => {
        const chosen = { ...selection, mathRange }; setSelection(chosen);
        if (chosen.subject === 'math') void finish(chosen); else setStep('english');
    };
    const chooseEnglish = (englishRange: OnboardingEnglishRange) => {
        const chosen = { ...selection, englishRange }; setSelection(chosen); void finish(chosen);
    };
    const back = () => {
        setError(false);
        setStep(step === 'grade' ? 'welcome' : step === 'subject' ? 'grade'
            : step === 'english' && selection.subject === 'mix' ? 'math' : 'subject');
    };
    if (step === 'welcome') return <IslandWelcome onStart={() => setStep('grade')} />;
    return <main className="island-page island-first-setup" data-onboarding-step={step} data-profile-created="false" data-onboarding-candidate={ISLAND_ONBOARDING_CANDIDATE}>
        <header className="island-setup-header">
            <button className="island-icon-button" type="button" aria-label="もどる" disabled={busy} onClick={back}><ArrowLeft size={22} /></button>
            <span><Leaf size={20} aria-hidden="true" />まなぶ じゅんび</span>
        </header>
        <section className="island-setup-sheet" aria-labelledby="island-setup-title" aria-busy={busy}>
            <h1 id="island-setup-title">{titles[step]}</h1>
            {step === 'grade' && <>
                <label className="island-setup-name">なまえ <span>あとでOK</span>
                    <input value={selection.name} maxLength={40} disabled={busy} autoComplete="nickname"
                        onChange={event => setSelection(current => ({ ...current, name: event.target.value }))} />
                </label>
                <div className="island-setup-options island-setup-grades">{ONBOARDING_GRADES.map(option =>
                    <button type="button" key={option.value} disabled={busy} onClick={() => chooseGrade(option.value)}>{option.label}</button>)}</div>
            </>}
            {step === 'subject' && <div className="island-setup-options">{ONBOARDING_SUBJECTS.map(option =>
                <button type="button" key={option.value} disabled={busy} onClick={() => chooseSubject(option.value)}>{option.label}</button>)}</div>}
            {step === 'math' && <div className="island-setup-options">{ONBOARDING_MATH_RANGES.map(option =>
                <button type="button" key={option.value} disabled={busy} onClick={() => chooseMath(option.value)}>{option.label}</button>)}</div>}
            {step === 'english' && <div className="island-setup-options">{ONBOARDING_ENGLISH_RANGES.map(option =>
                <button type="button" key={option.value} disabled={busy} onClick={() => chooseEnglish(option.value)}>{option.label}</button>)}</div>}
            <p className="island-setup-status" role="status">{busy ? 'ほぞんしているよ…' : error ? 'ほぞんできなかったよ。もういちど えらんでね。' : ''}</p>
        </section>
    </main>;
}
