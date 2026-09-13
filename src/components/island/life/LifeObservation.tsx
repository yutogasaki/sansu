import WaterObservationView from './WaterObservationView';
import { displayedGatherings } from './gatheringVisibility';
import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { CATALOG, type LifeItem, type LifeRecord, type LifeState } from '../../../domain/islandLife/model';
import { benchRelation, evaluateDiscovery } from '../../../domain/islandLife/discovery';
import { createDiscoveryScene, emptyDiscoveryJournal, type DiscoveryScene, type PresentationEvidence } from '../../../domain/islandLife/discoveryJournal';
import { recordPresentedScene, editDiscoveryMemory } from '../../../domain/islandLife/discoveryRepository';
import { holdPwaUpdateForCriticalPersistence } from '../../../pwa';
import RelationObservationView from './RelationObservationView';
import type { RuleEligibility } from '../../../domain/islandLife/discovery';
import type { ResidentId } from '../../../domain/islandLife/model';
import PlantObservationView from './PlantObservationView';
import './life-observation.css';

export default function LifeObservation({ record, state, item, close, memories, tryVisit, gathering }: {
    record: LifeRecord; state: LifeState; item: LifeItem; close: () => void; memories: () => void; tryVisit?: () => void; gathering?: { ruleId: RuleEligibility['ruleId']; participantIds: string[] };
}) {
    const [targetId, setTargetId] = useState<string>(), [status, setStatus] = useState<'bench' | 'walking' | 'busy'>('busy');
    const isBench = item.kind === 'bench' || item.kind === 'picnic-table';
    const viewState = useMemo(() => targetId ? { ...state, relationTarget: { benchId: item.id, targetId } } : state, [state, item.id, targetId]);
    const panel = useRef<HTMLDivElement>(null), alive = useRef(true), working = useRef(false);
    const latest = useRef({ record, state });
    const closeLatest = useRef(close);
    const pending = useRef<{ event: DiscoveryScene; evidence: PresentationEvidence } | undefined>(undefined);
    const [journal, setJournal] = useState(record.discoveryJournal ?? emptyDiscoveryJournal());
    const [shown, setShown] = useState<DiscoveryScene>();
    const [error, setError] = useState(''), [busy, setBusy] = useState(false);
    useEffect(() => {
        closeLatest.current = close;
        latest.current = { record, state };
        if (record.discoveryJournal) setJournal(previous => record.discoveryJournal!.revision > previous.revision ? record.discoveryJournal! : previous);
    }, [record, state, close]);
    useEffect(() => {
        alive.current = true; panel.current?.focus();
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeLatest.current(); };
        window.addEventListener('keydown', escape);
        return () => { alive.current = false; window.removeEventListener('keydown', escape); };
    }, []);
    const persistShown = async () => {
        const request = pending.current; if (!request || working.current) return;
        working.current = true; setBusy(true); setError('');
        const release = holdPwaUpdateForCriticalPersistence();
        try {
            const result = await recordPresentedScene(record.profileId, request.event, request.evidence);
            if (alive.current && result) { setJournal(result); setShown(request.event); pending.current = undefined; }
        } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'きろくを ほぞんできなかったよ。'); }
        finally { release(); working.current = false; if (alive.current) setBusy(false); }
    };
    const saveMemory = async () => {
        if (!shown || working.current) return;
        working.current = true; setBusy(true); setError('');
        const release = holdPwaUpdateForCriticalPersistence();
        try {
            const result = await editDiscoveryMemory(record.profileId, shown.eventId, 'save', journal.revision);
            if (alive.current) setJournal(result);
        } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'おもいでを ほぞんできなかったよ。'); }
        finally { release(); working.current = false; if (alive.current) setBusy(false); }
    };
    const prepare = async () => {
        if (!alive.current || pending.current) return undefined;
        setError(''); setShown(undefined);
        const current = latest.current;
        const rule = evaluateDiscovery(current.state, current.record.profileId).find(rule => rule.ruleId === 'M2' && rule.participantIds.includes(item.id));
        if (!rule) return undefined;
        try { return await createDiscoveryScene(current.record.profileId, current.state, rule, 'current-context-test', crypto.randomUUID(), Date.now()); }
        catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'もういちど ためしてね。'); return undefined; }
    };
    const prepareRelation = async (visible: LifeState, _rule: RuleEligibility, residents: ResidentId[]) => {
        if (!alive.current || pending.current) return undefined;
        const rule = benchRelation(visible, record.profileId, item.id, visible.relationTarget?.targetId);
        if (!rule) return undefined;
        try { return await createDiscoveryScene(record.profileId, visible, rule, 'current-context-test', crypto.randomUUID(), Date.now(), residents); }
        catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'もういちど ためしてね。'); return undefined; }
    };
    const prepareGathering = async (visible: LifeState) => {
        if (!alive.current || pending.current || !gathering) return undefined;
        const rule = displayedGatherings(visible, record.profileId).find(rule => rule.ruleId === gathering.ruleId
            && rule.participantIds.length === gathering.participantIds.length && rule.participantIds.every(id => gathering.participantIds.includes(id)));
        if (!rule) return undefined;
        return createDiscoveryScene(record.profileId, visible, rule, 'current-context-test', crypto.randomUUID(), Date.now());
    };
    const presented = (event: DiscoveryScene, evidence: PresentationEvidence) => { if (!pending.current) { pending.current = { event, evidence }; void persistShown(); } };
    const saved = shown && journal.savedIds.includes(shown.eventId);
    return <div ref={panel} tabIndex={-1} className="life-observation" role="dialog" aria-modal="false" aria-label={gathering ? 'いまの あつまり' : isBench ? 'いまの ベンチ' : item.kind === 'sapling' ? 'いまの 木' : item.kind === 'water-bowl' ? 'いまの 水ばち' : 'いまの おはな'} data-life-observation={item.id}>
        <header><b>{gathering ? 'いまの あつまり' : isBench ? 'いまの ベンチ' : item.kind === 'sapling' ? 'いまの 木' : item.kind === 'water-bowl' ? 'いまの 水ばち' : 'いまの おはな'}</b><button type="button" aria-label="みてみるを とじる" onClick={close}><X size={20} /></button></header>
        <div className="life-observation-body">
            {gathering ? <RelationObservationView state={state} gathering={gathering} prepare={prepareGathering} presented={presented} /> : isBench ? <>
                <RelationObservationView state={viewState} benchId={item.id} prepare={prepareRelation} presented={presented} status={setStatus} target={id => { if (!busy && !pending.current) { setTargetId(id); setShown(undefined); setError(''); } }} />
                <p className="life-observation-hint" role="status">{status === 'bench' ? 'ここで ひとやすみ' : status === 'walking' ? 'みちを とおって くるよ' : 'いまは、ほかのことを しているよ'}</p>
                <label className="life-observation-target">みるもの <select aria-label="ベンチから みるもの" value={targetId ?? ''} disabled={busy || Boolean(pending.current)} onChange={event => { setTargetId(event.target.value || undefined); setShown(undefined); setError(''); }}>
                    <option value="">いまの ようす</option>{state.items.filter(i => i.cell && ['flower', 'sapling', 'swing', 'sandbox', 'water-bowl'].includes(i.kind)).map((i, index) => <option key={i.id} value={i.id}>{CATALOG[i.kind].label} {index + 1}</option>)}
                </select></label>
                {status === 'busy' && <button type="button" onClick={tryVisit}>もういちど みてみる</button>}
            </> : item.kind === 'water-bowl' ? <WaterObservationView item={item} /> : <><PlantObservationView item={item} prepare={prepare} presented={presented} />
                <p className="life-observation-hint">{item.kind === 'sapling' ? '木に ふれてみよう' : 'おはなに ふれてみよう'}</p></>}
            {busy && <p role="status">きろくを のこしているよ…</p>}
            {shown && <div className="life-observation-save"><span>{saved ? 'おもいでに のこしたよ' : 'いまの、のこす？'}</span>
                <button type="button" disabled={busy || saved} onClick={() => void saveMemory()}>{saved ? 'のこした' : 'のこす'}</button></div>}
            {(shown || error) && <button className="life-memory-entry" type="button" onClick={memories}>しまの おもいで</button>}
            {error && <div role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={() => pending.current ? void persistShown() : void saveMemory()}>ほぞんを もういちど</button></div>}
        </div>
    </div>;
}
