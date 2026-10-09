import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { AchievementId, GrowingState, GuidanceEvidence, StarterStepId } from '../../../domain/growingIsland';
import { achievementCatalog, achievementSuggestions, starterStep } from '../../../domain/growingIsland/guidance';
import { GrowingGuideArt } from './GrowingGuideArt';
import { GrowingFlowerPrice } from './GrowingFlowerPrice';
import { kindName, villagerName } from './growingCopy';
import { starterCopy } from './useGrowingGuide';
import { hasPurchasedFlower, starterPlayChoices } from './growingGuideTargets';
import './growingGuide.css';

const STARTER_ART: Record<StarterStepId, AchievementId> = { S1: 'A1', S2: 'A2', S3: 'A1', S4: 'A2', S5: 'A2' };

export interface GrowingGuideBookProps {
    state: GrowingState;
    busy: boolean;
    initialMemory?: AchievementId;
    onClose: () => void;
    onChoose: (id: AchievementId, play: boolean) => void;
    onClear: () => void;
    onTry: (id: AchievementId) => void;
    onResumeStarter: () => void;
    onStarterAction: () => void;
    onStarterChoose: (id: 'A3' | 'A4') => void;
    onTarget: (evidence: GuidanceEvidence) => void;
}

/** An optional, illustrated book leaves the actual island visible above the page. */
export function GrowingGuideBook({ state, busy, initialMemory, onClose, onChoose, onClear, onTry, onResumeStarter, onStarterAction, onStarterChoose, onTarget }: GrowingGuideBookProps) {
    const [tab, setTab] = useState<'try' | 'done'>(initialMemory ? 'done' : 'try');
    const [detail, setDetail] = useState<AchievementId | undefined>(initialMemory ?? state.guidance?.selected);
    const uid = useId(), heading = useRef<HTMLHeadingElement>(null);
    const callbacks = useRef({ onClose });
    useEffect(() => { callbacks.current = { onClose }; }, [onClose]);
    useEffect(() => {
        const previous = document.activeElement;
        heading.current?.focus();
        const escape = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); callbacks.current.onClose(); }
        };
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('keydown', escape);
            if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
        };
    }, []);
    const suggestions = achievementSuggestions(state);
    const available = suggestions.filter(item => item.available).slice(0, 3);
    const step = starterStep(state);
    const starter = step ? starterCopy(state, step) : undefined;
    const selected = state.guidance?.selected;
    const starterChoices = step === 'S4' && !state.guidance?.starter.legacy && !selected
        ? starterPlayChoices(state) : [];
    const achieved = achievementCatalog.filter(item => state.guidance?.achievements[item.id])
        .sort((a, b) => (state.guidance!.achievements[b.id]!.at ?? 0) - (state.guidance!.achievements[a.id]!.at ?? 0));
    const tryDetail = detail ?? selected;
    const opened = tab === 'done' ? (detail && state.guidance?.achievements[detail] ? detail : achieved[0]?.id)
        : tryDetail && !state.guidance?.achievements[tryDetail] ? tryDetail : undefined;
    const entry = achievementCatalog.find(item => item.id === opened);
    const proof = opened ? state.guidance?.achievements[opened] : undefined;
    const suggestion = suggestions.find(item => item.id === opened);
    const switchTab = (next: 'try' | 'done') => { setTab(next); setDetail(next === 'try' ? selected : undefined); };
    const tabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'try' : event.key === 'End' ? 'done' : tab === 'try' ? 'done' : 'try';
        switchTab(next);
        event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-guide-tab="${next}"]`)?.focus();
    };
    const goal = (id: AchievementId, compact = false) => {
        const item = achievementCatalog.find(item => item.id === id)!;
        const record = state.guidance?.achievements[id];
        return <button key={id} className={`growing-guide-card${compact ? ' growing-guide-card-small' : ''}`}
            data-guidance-goal={id} aria-pressed={opened === id} onClick={() => setDetail(id)}>
            <GrowingGuideArt id={id} />
            <strong>{item.title}</strong>
            {selected === id && !record && <span className="growing-guide-bookmark">えらんでいる あそび</span>}
            {record && <span className="growing-guide-memory">{record.snapshot.legacy ? 'これまでの しま' : 'しまの おもいで'}</span>}
        </button>;
    };
    return <section className="growing-guide-book" aria-label="しまの あそびかた" aria-labelledby={`${uid}-heading`} data-visual-candidate="guide-pop-toys-v6">
        <header className="growing-guide-header">
            <div><span className="growing-guide-kicker">ぽこもこと</span><h2 ref={heading} tabIndex={-1} id={`${uid}-heading`}>しまの あそびかた</h2></div>
            <button className="growing-guide-close" onClick={onClose}>とじる <span aria-hidden="true">×</span></button>
        </header>
        <div className="growing-guide-tabs" role="tablist" aria-label="ほんの ページ">
            {(['try', 'done'] as const).map(value => <button key={value} id={`${uid}-${value}-tab`} role="tab"
                aria-selected={tab === value} aria-controls={`${uid}-${value}-page`} tabIndex={tab === value ? 0 : -1}
                data-guide-tab={value} onKeyDown={tabKey} onClick={() => switchTab(value)}>{value === 'try' ? 'ためしてみる' : 'できたこと'}</button>)}
        </div>
        <div className="growing-guide-page" id={`${uid}-${tab}-page`} role="tabpanel" aria-labelledby={`${uid}-${tab}-tab`}>
            {tab === 'try' && <>
                {step && starter && !opened && <article className="growing-guide-starter" data-guidance-starter={step}>
                    <GrowingGuideArt id={STARTER_ART[step]} />
                    <div><span className="growing-guide-kicker">{state.guidance?.starter.legacy ? 'しまの あそび' : 'はじめの あそび'}</span><h3>{starter.title}</h3><p>{starter.hint}</p>
                        {step === 'S4' && starter.action === 'まなぶ' && !state.guidance?.starter.legacy
                            && !hasPurchasedFlower(state)
                            && state.unlocked.includes('landmark:flower') && <GrowingFlowerPrice drops={state.drops} />}
                        {starterChoices.length > 0 && <div className="growing-guide-starter-choices" aria-label="つぎの あそび">
                            {starterChoices.map(id => <button key={id} data-starter-play={id} disabled={busy} onClick={() => onStarterChoose(id)}>
                                <GrowingGuideArt id={id} /><strong>{id === 'A4' ? 'ベンチを うごかす' : 'はたの いろを かえる'}</strong><span>むりょう・いま できる</span>
                            </button>)}
                        </div>}
                        <div className="growing-guide-actions">{starterChoices.length === 0 && <button className="growing-guide-primary" disabled={busy} onClick={onStarterAction}>{starter.action}</button>}
                            {!state.guidance?.starter.automatic && <button disabled={busy} onClick={onResumeStarter}>しまで ヒントを みる</button>}</div>
                    </div>
                </article>}
                {entry && !proof && <article className="growing-guide-detail" aria-label={`${entry.title}の ヒント`}>
                    <GrowingGuideArt id={entry.id} />
                    <div><span className="growing-guide-kicker">{selected === entry.id ? 'えらんでいる あそび' : 'これを やってみる？'}</span>
                        <h3>{entry.title}</h3><p>{step === 'S4' && selected === 'A4' && entry.id === 'A4' ? starter?.hint : entry.hint}</p>{suggestion?.reason && <p className="growing-guide-note">{suggestion.reason}</p>}
                        <div className="growing-guide-actions">
                            {selected === entry.id ? <><button className="growing-guide-primary" disabled={busy || !suggestion?.available} onClick={() => onTry(entry.id)}>しまで やってみる</button><button disabled={busy} onClick={onClear}>えらぶのを やめる</button></>
                                : <button className="growing-guide-primary" disabled={busy} onClick={() => onChoose(entry.id, Boolean(suggestion?.available))}>{suggestion?.available ? 'これを やってみる' : 'あとで やることにする'}</button>}
                        </div>
                    </div>
                </article>}
                {!step && !opened && available.length > 0 && <><h3 className="growing-guide-section-title">どれで あそぶ？</h3><div className="growing-guide-candidates">{available.map(item => goal(item.id))}</div></>}
                {suggestions.length > 0 && <details className="growing-guide-all"><summary>ほかの あそびも みる</summary><div className="growing-guide-grid">{suggestions.map(item => goal(item.id, true))}</div></details>}
                {!suggestions.length && <p className="growing-guide-note">しまには いろいろな あそびが あるよ。すきな ばしょを かえてみよう</p>}
            </>}
            {tab === 'done' && <>
                {!achieved.length && <div className="growing-guide-empty"><GrowingGuideArt id="A1" /><h3>ここに おもいでが ふえていくよ</h3><p>しまに もどって、すきな あそびを ためしてみよう</p><button onClick={() => switchTab('try')}>ためしてみる</button></div>}
                {entry && proof && <article className="growing-guide-detail growing-guide-detail-memory" data-guidance-memory={entry.id}>
                    <GrowingGuideArt id={entry.id} evidence={proof} />
                    <div><span className="growing-guide-kicker">{proof.snapshot.legacy ? 'これまでの しま' : 'あのときの おもいで'}</span><h3>{entry.title}</h3>
                        <p>{memoryLine(proof)}</p>
                        <div className="growing-guide-actions">{targetStatus(state, proof) !== 'missing' && <button className="growing-guide-primary" disabled={busy} onClick={() => onTarget(proof)}>{targetStatus(state, proof) === 'stored' ? 'しまってある ものへ' : 'この場所へ'}</button>}
                            {targetStatus(state, proof) === 'missing' && <span className="growing-guide-note">ほんの なかに おもいでが のこっているよ</span>}</div>
                    </div>
                </article>}
                {achieved.length > 1 && <><h3 className="growing-guide-section-title">ほかの おもいで</h3>
                    <div className="growing-guide-memories">{achieved.filter(item => item.id !== opened).map(item => goal(item.id, true))}</div></>}
            </>}
        </div>
    </section>;
}

function memoryLine(evidence: GuidanceEvidence) {
    const target = evidence.snapshot.target;
    if (target && 'species' in target) return `${villagerName(target)}・${kindName(target.species)}を むかえたよ`;
    if (target && 'stage' in target) return 'あのときの いろと かたちを のこしたよ';
    return 'しまの できごとを ほんに のこしたよ';
}
function targetStatus(state: GrowingState, evidence: GuidanceEvidence): 'present' | 'stored' | 'missing' {
    if (!evidence.targetId || evidence.targetId === 'flag') return 'present';
    const item = [...state.plots, ...state.landmarks, ...state.keepsakes, ...state.villagers].find(item => item.id === evidence.targetId);
    if (!item) return 'missing';
    return 'cell' in item && !item.cell ? 'stored' : 'present';
}
