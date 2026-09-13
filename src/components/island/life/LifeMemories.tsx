import type { RuleEligibility } from '../../../domain/islandLife/discovery';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { LifeState, ResidentId } from '../../../domain/islandLife/model';
import type { DiscoveryScene } from '../../../domain/islandLife/discoveryJournal';
import { discoveryParticipants, discoverySubject, discoveryTitle } from '../../../domain/islandLife/discoveryRecall';
import { editDiscoveryMemory } from '../../../domain/islandLife/discoveryRepository';
import { holdPwaUpdateForCriticalPersistence } from '../../../pwa';
import { useDiscoveryJournal } from './useDiscoveryJournal';
import LifeProductPreview from './LifeProductPreview';
import LifeSceneReplay from './LifeSceneReplay';
import './life-observation.css';
import './life-memories.css';

export default function LifeMemories({ profileId, state, close, observe, observeGathering }: {
    profileId: string; state: LifeState; close: () => void; observe: (itemId: string, residentId?: ResidentId) => void; observeGathering?: (group: { ruleId: RuleEligibility['ruleId']; participantIds: string[] }) => void;
}) {
    const { journal, error: readError, retry } = useDiscoveryJournal(profileId);
    const [tab, setTab] = useState<'saved' | 'history'>('saved');
    const [selected, setSelected] = useState<DiscoveryScene>();
    const [confirmUnpin, setConfirmUnpin] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const panel = useRef<HTMLDivElement>(null), alive = useRef(true), working = useRef(false), exit = useRef(close);
    useEffect(() => { exit.current = close; }, [close]);
    useEffect(() => {
        alive.current = true; panel.current?.focus();
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') exit.current(); };
        window.addEventListener('keydown', escape);
        return () => { alive.current = false; window.removeEventListener('keydown', escape); };
    }, []);
    const changeMemory = async (action: 'save' | 'unpin') => {
        if (!selected || !journal || working.current) return;
        working.current = true; setBusy(true); setError('');
        const release = holdPwaUpdateForCriticalPersistence();
        try {
            await editDiscoveryMemory(profileId, selected.eventId, action, journal.revision);
            if (alive.current) { setConfirmUnpin(false); if (action === 'unpin') setSelected(undefined); }
        } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'きろくを かえられなかったよ。'); }
        finally { release(); working.current = false; if (alive.current) setBusy(false); }
    };
    const saved = Boolean(selected && journal?.savedIds.includes(selected.eventId));
    const participants = selected ? discoveryParticipants(selected) : [];
    const gathering = selected?.ruleId.startsWith('G') ? { ruleId: selected.ruleId, participantIds: participants.map(item => item.id) } : undefined;
    const currentGathering = gathering && participants.length > 0 && participants.every(participant => state.items.some(item => item.id === participant.id && item.kind === participant.kind && item.cell));
    const subject = selected && discoverySubject(selected);
    const current = subject && state.items.find(item => item.id === subject.id && item.kind === subject.kind && item.cell);
    const ids = journal ? tab === 'saved' ? [...journal.savedIds].reverse() : journal.historyIds : [];
    const reset = () => { setSelected(undefined); setConfirmUnpin(false); setError(''); };
    return <div ref={panel} tabIndex={-1} className="life-observation life-memories" role="dialog" aria-modal="false" aria-label="しまの おもいで" data-life-memories>
        <header><b>{selected ? 'おもいでを みる' : 'しまの おもいで'}</b><button type="button" aria-label="おもいでを とじる" onClick={close}><X size={20} /></button></header>
        <div className="life-observation-body">
            {readError ? <div role="alert"><p>{readError}</p><button type="button" onClick={retry}>よみなおす</button></div> : !journal ? <p role="status">ひらいているよ…</p> : <>
                {selected ? <>
                    <button className="life-memory-back" type="button" disabled={busy} onClick={reset}>← おもいでの 一覧へ</button>
                    <h3>{discoveryTitle(selected)}</h3>
                    <LifeSceneReplay key={selected.eventId} original={selected} />
                    <div className="life-memory-actions">
                        {gathering ? currentGathering && observeGathering ? <button type="button" onClick={() => observeGathering(gathering)}>いまの島でみる</button> : <p>いまは しまに おいていないものが あるよ</p> : current ? <button type="button" onClick={() => observe(current.id, selected.snapshot.scene.observationResidentId ?? selected.focalResidentIds[0])}>いまの島でみる</button> : subject && <p>いまは しまに おいていないよ</p>}
                        {!confirmUnpin && <button type="button" disabled={busy} onClick={() => saved ? setConfirmUnpin(true) : void changeMemory('save')}>{saved ? 'のこすのを やめる' : 'のこす'}</button>}
                    </div>
                    {confirmUnpin && <div className="life-memory-confirm"><p>この おもいでを、のこす ばしょから はずす？</p>
                        <button type="button" disabled={busy} onClick={() => void changeMemory('unpin')}>この おもいでを はずす</button><button type="button" onClick={() => setConfirmUnpin(false)}>やめる</button></div>}
                </> : <>
                    <div className="life-memory-tabs" role="group" aria-label="おもいでの えらびかた">
                        <button type="button" aria-pressed={tab === 'saved'} onClick={() => setTab('saved')}>のこした おもいで</button>
                        <button type="button" aria-pressed={tab === 'history'} onClick={() => setTab('history')}>みえた ばめん</button>
                    </div>
                    {!ids.length && <p className="life-memory-empty">{tab === 'saved' ? 'のこした おもいでが ここに ならぶよ' : 'みえた ばめんが ここに ならぶよ'}</p>}
                    <div className="life-memory-list">{ids.flatMap(id => {
                        const entry = journal.entries.find(entry => entry.event.eventId === id); if (!entry) return [];
                        const item = discoveryParticipants(entry.event)[0];
                        return [<button type="button" key={id} data-life-memory={id} onClick={() => { setSelected(structuredClone(entry.event)); setError(''); }}>
                            {item && <LifeProductPreview kind={item.kind} growth={item.growth} style={item.style} />}
                            <span><b>{discoveryTitle(entry.event)}</b><small>{new Date(entry.event.createdAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} · {entry.event.source === 'replay' ? 'もういちど みた' : entry.event.source === 'current-context-test' ? 'ためした ばめん' : entry.event.source === 'simulated' ? 'もしもの ばめん' : 'しまの ばめん'}</small></span>
                        </button>];
                    })}</div>
                </>}
                {busy && <p role="status">きろくを かえているよ…</p>}
                {error && <div role="alert"><p>{error}</p></div>}
            </>}
        </div>
    </div>;
}
