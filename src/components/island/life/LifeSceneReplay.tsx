import { useEffect, useMemo, useRef, useState } from 'react';
import { discoveryParticipants, discoverySubject } from '../../../domain/islandLife/discoveryRecall';
import { replayDiscoveryScene, sceneDigest, type DiscoveryScene, type PresentationEvidence } from '../../../domain/islandLife/discoveryJournal';
import { recordPresentedScene } from '../../../domain/islandLife/discoveryRepository';
import { holdPwaUpdateForCriticalPersistence } from '../../../pwa';
import type { LifeState } from '../../../domain/islandLife/model';
import RelationObservationView from './RelationObservationView';
import WaterObservationView from './WaterObservationView';
import PlantObservationView from './PlantObservationView';

export default function LifeSceneReplay({ original }: { original: DiscoveryScene }) {
    const alive = useRef(true), working = useRef(false);
    const pending = useRef<{ event: DiscoveryScene; evidence: PresentationEvidence } | undefined>(undefined);
    const [error, setError] = useState(''), [busy, setBusy] = useState(false);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const frozen = useMemo<LifeState>(() => ({ ...original.snapshot.scene, drops: 0, light: 0, styles: [], days: {} }), [original]);
    const participants = discoveryParticipants(original);
    const gathering = original.ruleId.startsWith('G') ? { ruleId: original.ruleId, participantIds: participants.map(item => item.id) } : undefined;
    const bench = discoverySubject(original);
    const plant = discoveryParticipants(original).find(item => item.kind === 'flower' || item.kind === 'sapling');
    const prepare = async () => {
        if (!alive.current || pending.current) return undefined;
        setError('');
        if (original.snapshot.contentVersion !== 1 || await sceneDigest(original.snapshot.scene) !== original.snapshot.immutableHash) {
            if (alive.current) setError('この おもいでを ひらけなかったよ。'); return undefined;
        }
        return replayDiscoveryScene(original, crypto.randomUUID(), Date.now());
    };
    const persist = async () => {
        const request = pending.current; if (!request || working.current) return;
        working.current = true; setBusy(true); setError('');
        const release = holdPwaUpdateForCriticalPersistence();
        try {
            await recordPresentedScene(original.profileId, request.event, request.evidence);
            pending.current = undefined;
        } catch { if (alive.current) setError('みた きろくを のこせなかったよ。'); }
        finally { release(); working.current = false; if (alive.current) setBusy(false); }
    };
    return <div data-life-replay-origin={original.originEventId ?? original.eventId}>
        <p className="life-memory-time">あのときの すがた</p>
        {original.ruleId === 'M3' && bench ? <RelationObservationView state={frozen} benchId={bench.id} residentId={original.snapshot.scene.shadowTouch?.residentId} frozen prepare={async () => undefined} shadowPrepare={prepare} shadowPresented={(event, evidence) => { pending.current = { event, evidence }; void persist(); }} presented={() => {}} /> : original.ruleId === 'M4' && bench ? <WaterObservationView item={bench} conditionKey={original.semanticSignature} prepare={prepare} presented={(event, evidence) => { pending.current = { event, evidence }; void persist(); }} /> : original.ruleId === 'M2' && plant ? <>
            <PlantObservationView item={plant} prepare={prepare} presented={(event, evidence) => { pending.current = { event, evidence }; void persist(); }} />
            <p className="life-observation-hint">ふれると もういちど みられるよ</p>
        </> : gathering ? <RelationObservationView state={frozen} gathering={gathering} frozen prepare={prepare} presented={(event, evidence) => { pending.current = { event, evidence }; void persist(); }} /> : (original.ruleId === 'R2' || original.ruleId === 'R1' || original.ruleId === 'R3' || original.ruleId === 'R4' || original.ruleId === 'R5' || original.ruleId === 'R6') && bench ? <RelationObservationView state={frozen} benchId={bench.id} residentId={original.snapshot.scene.observationResidentId} frozen prepare={prepare} presented={(event, evidence) => { pending.current = { event, evidence }; void persist(); }} /> : <p>この ばめんの えを ひらけなかったよ。</p>}
        {error && <div role="alert"><p>{error}</p>{pending.current && <button type="button" disabled={busy} onClick={() => void persist()}>きろくを もういちど のこす</button>}</div>}
    </div>;
}
