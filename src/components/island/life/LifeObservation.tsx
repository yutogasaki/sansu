import { observationVisit } from '../../../domain/islandLife/observationVisit';
import { isFacility } from '../../../domain/islandLife/footprint';
import WaterObservationView from './WaterObservationView';
import { displayedGatherings } from './gatheringVisibility';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { CATALOG, type LifeItem, type LifeRecord, type LifeState } from '../../../domain/islandLife/model';
import { evaluateDiscovery } from '../../../domain/islandLife/discovery';
import { createDiscoveryScene, emptyDiscoveryJournal, type DiscoveryScene, type PresentationEvidence } from '../../../domain/islandLife/discoveryJournal';
import { recordPresentedScene, editDiscoveryMemory } from '../../../domain/islandLife/discoveryRepository';
import { holdPwaUpdateForCriticalPersistence } from '../../../pwa';
import RelationObservationView from './RelationObservationView';
import type { ShadowRequest } from './shadowObservation';
import type { RuleEligibility } from '../../../domain/islandLife/discovery';
import type { ResidentId } from '../../../domain/islandLife/model';
import PlantObservationView from './PlantObservationView';
import './life-observation.css';

export default function LifeObservation({ record, state, item, initialResidentId, initialShadowRequest, close, memories, tryVisit, tryRelation, selectionFailure, gathering }: {
    record: LifeRecord; state: LifeState; item: LifeItem; initialResidentId?: ResidentId; initialShadowRequest?: ShadowRequest; close: () => void; memories: () => void; tryVisit?: () => void; tryRelation?: (targetId: string | undefined, residentId: ResidentId) => Promise<boolean>; selectionFailure?: string; gathering?: { ruleId: RuleEligibility['ruleId']; participantIds: string[] };
}) {
    const [status, setStatus] = useState<'bench' | 'walking' | 'busy' | 'target-busy'>('busy');
    const [residentId, setResidentId] = useState<ResidentId | undefined>(() => {
        if (initialResidentId) return initialResidentId;
        const plan = observationVisit(state, item.id); return 'residentId' in plan ? plan.residentId : undefined;
    });
    const [selecting, setSelecting] = useState(false), [selectionError, setSelectionError] = useState(false);
    const isBench = item.kind === 'bench' || item.kind === 'picnic-table';
    const isRelation = isBench || isFacility(item.kind);
    const [targetId, setTargetId] = useState<string>();
    const cancelledShadowRequest = useRef(false);
    useEffect(() => {
        if (!residentId) { const plan = observationVisit(state, item.id); if ('residentId' in plan) setResidentId(plan.residentId); }
    }, [state, item.id, residentId]);
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
        const rule = evaluateDiscovery(visible, record.profileId).find(rule => rule.ruleId === _rule.ruleId
            && rule.participantIds.length === _rule.participantIds.length && rule.participantIds.every(id => _rule.participantIds.includes(id)));
        if (!rule) return undefined;
        try { return await createDiscoveryScene(record.profileId, visible, rule, 'current-context-test', crypto.randomUUID(), Date.now(), residents); }
        catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'もういちど ためしてね。'); return undefined; }
    };
    const prepareEncounter = async (visible: LifeState, candidate: RuleEligibility) => {
        if (!alive.current || pending.current) return undefined;
        const rule = evaluateDiscovery(visible, record.profileId).find(r => r.ruleId === candidate.ruleId
            && r.participantIds.length === candidate.participantIds.length && candidate.participantIds.every(id => r.participantIds.includes(id)));
        if (!rule) return undefined;
        setShown(undefined); setError('');
        return createDiscoveryScene(record.profileId, visible, rule, 'current-context-test', crypto.randomUUID(), Date.now());
    };
    const prepareShadow = async (visible: LifeState, candidate: RuleEligibility, residents: ResidentId[]) => {
        if (!alive.current || pending.current) return undefined;
        const rule = evaluateDiscovery(visible, record.profileId).find(r => r.ruleId === 'M3' && candidate.participantIds.every(id => r.participantIds.includes(id)));
        if (!rule) return undefined;
        setShown(undefined); setError('');
        try { return await createDiscoveryScene(record.profileId, visible, rule, 'current-context-test', crypto.randomUUID(), Date.now(), residents); }
        catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'もういちど ためしてね。'); return undefined; }
    };
    const prepareReading = async (visible: LifeState) => {
        if (!alive.current || pending.current) return undefined;
        const rule = evaluateDiscovery(visible, record.profileId).find(r => r.ruleId === 'X3');
        if (!rule) return undefined;
        setShown(undefined); setError('');
        try { return await createDiscoveryScene(record.profileId, visible, rule, 'current-context-test', crypto.randomUUID(), Date.now(), ['otter']); }
        catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'もういちど ためしてね。'); return undefined; }
    };
    const waterRule = item.kind === 'water-bowl' ? evaluateDiscovery(state, record.profileId).filter(rule => rule.ruleId === 'M4' && rule.participantIds.includes(item.id))
        .sort((a, b) => a.distance! - b.distance! || a.semanticSignature.localeCompare(b.semanticSignature))[0] : undefined;
    const prepareWater = async (point: [number, number]) => {
        if (!alive.current || pending.current || !waterRule) return undefined;
        setError(''); setShown(undefined);
        const current = latest.current;
        try { return await createDiscoveryScene(record.profileId, { ...current.state, waterTouch: { itemId: item.id, point } }, waterRule, 'current-context-test', crypto.randomUUID(), Date.now()); }
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
    const selectTarget = async (id?: string) => {
        cancelledShadowRequest.current = true;
        if (!tryRelation || selecting || busy || pending.current || !residentId) return;
        setSelecting(true); setSelectionError(false); setShown(undefined); setError('');
        try { const ok = await tryRelation(id, residentId); if (alive.current) setSelectionError(!ok); }
        finally { if (alive.current) setSelecting(false); }
    };
    const saved = shown && journal.savedIds.includes(shown.eventId);
    return <div ref={panel} tabIndex={-1} className="life-observation" role="dialog" aria-modal="false" aria-label={gathering ? 'いまの あつまり' : isFacility(item.kind) ? `${CATALOG[item.kind].label}の ようす` : isBench ? 'いまの ベンチ' : item.kind === 'sapling' ? 'いまの 木' : item.kind === 'water-bowl' ? 'いまの 水ばち' : 'いまの おはな'} data-life-observation={item.id} data-life-observation-resident={residentId}>
        <header><b>{gathering ? 'いまの あつまり' : isFacility(item.kind) ? `${CATALOG[item.kind].label}の ようす` : isBench ? 'いまの ベンチ' : item.kind === 'sapling' ? 'いまの 木' : item.kind === 'water-bowl' ? 'いまの 水ばち' : 'いまの おはな'}</b><button type="button" aria-label="みてみるを とじる" onClick={close}><X size={20} /></button></header>
        <div className="life-observation-body">
            {gathering ? <RelationObservationView state={state} gathering={gathering} encounterPrepare={prepareEncounter} encounterPresented={presented} prepare={prepareGathering} presented={presented} /> : isRelation ? <>
                <RelationObservationView state={state} benchId={item.id} residentId={residentId} shadowRequest={initialShadowRequest} shadowRequestCancelled={cancelledShadowRequest.current} selectedTarget={setTargetId} readingPrepare={prepareReading} readingPresented={presented} shadowPrepare={item.kind === 'bench' ? prepareShadow : undefined} shadowPresented={presented} prepare={prepareRelation} presented={presented} status={setStatus} target={!selecting && !busy && !pending.current && residentId ? id => { void selectTarget(id); } : undefined} />
                <p className="life-observation-hint" role="status">{status === 'target-busy' ? 'いまは ほかのこが つかっているよ' : status === 'bench' ? item.kind === 'garden-hut' ? 'ここで おていれ' : item.kind === 'library' ? 'ここで よんでいる' : 'ここで ひとやすみ' : status === 'walking' ? 'みちを とおって くるよ' : 'いまは、ほかのことを しているよ'}</p>
                {isRelation && <label className="life-observation-target">みるもの <select aria-label={isBench ? "ベンチから みるもの" : "たてものから みるもの"} value={targetId ?? ''} disabled={selecting || busy || Boolean(pending.current) || !residentId} onChange={event => { void selectTarget(event.target.value || undefined); }}>
                    <option value="">いまの ようす</option>{state.items.filter(i => i.cell && i.id !== item.id).map((i, index) => <option key={i.id} value={i.id}>{CATALOG[i.kind].label} {index + 1}</option>)}
                </select></label>}
                {(status === 'busy' || status === 'target-busy') && <button type="button" onClick={() => residentId ? void selectTarget(targetId) : tryVisit?.()}>もういちど みてみる</button>}
            </> : item.kind === 'water-bowl' ? <WaterObservationView item={item} conditionKey={waterRule?.semanticSignature} prepare={prepareWater} presented={presented} /> : <><PlantObservationView item={item} prepare={prepare} presented={presented} />
                <p className="life-observation-hint">{item.kind === 'sapling' ? '木に ふれてみよう' : 'おはなに ふれてみよう'}</p></>}
            {selecting && <p role="status">ようすを みているよ…</p>}
            {selectionError && <p role="alert">{selectionFailure ?? 'いまは ためせなかったよ。もういちど えらんでね。'}</p>}
            {busy && <p role="status">きろくを のこしているよ…</p>}
            {shown && <div className="life-observation-save"><span>{saved ? 'おもいでに のこしたよ' : 'いまの、のこす？'}</span>
                <button type="button" disabled={busy || saved} onClick={() => void saveMemory()}>{saved ? 'のこした' : 'のこす'}</button></div>}
            {(shown || error) && <button className="life-memory-entry" type="button" onClick={memories}>しまの おもいで</button>}
            {error && <div role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={() => pending.current ? void persistShown() : void saveMemory()}>ほぞんを もういちど</button></div>}
        </div>
    </div>;
}
