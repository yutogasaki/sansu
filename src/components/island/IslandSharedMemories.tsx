import { IslandPanelHeading } from './IslandPanelHeading';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, Flower2, Hand, Heart, Lightbulb, Play, RotateCw, X } from 'lucide-react';
import { findSharedDisplayPosition } from './islandSharedPlacement';
import { getIslandExperience, ISLAND_RESIDENT_IDS, type IslandResidentId } from '../../domain/island/experience';
import { getIslandSharedMemories, isSharedResidentAvailable, isValidSharedDisplayPlacement, resolveSharedTarget,
    SHARED_DISPLAY_IDS, SHARED_RESIDENT_JOBS, sharedDisplayKey, sharedRequestIdentity, sharedTargetName, sharedWorkCaptureKey,
    type IslandSharedMemoriesAction, type SharedDisplayId, type SharedTarget, type SharedTargetRef } from '../../domain/island/sharedMemories';
import type { IslandPosition, IslandRecord } from '../../domain/island/types';
import { getIslandWorkshop, getWorkshopSpecimenName, WORKSHOP_SPECIMEN_IDS, WORKSHOP_WORK_IDS } from '../../domain/island/workshop';
import { WORKSHOP_PART_IDS } from '../../domain/island/workshopLayout';
import type { IslandSharedSceneRequest, IslandSharedStageState } from './three/types';
import './IslandSharedMemories.css';

export interface IslandDisplayPreview extends NonNullable<IslandSharedStageState['preview']> {
    ref: SharedTargetRef;
    expectedDisplayKey: string | null;
}
interface Props {
    island: IslandRecord;
    selectedId?: SharedDisplayId;
    preview?: IslandDisplayPreview;
    disabled: boolean;
    error?: string;
    feedback?: string;
    onRetry?: () => Promise<IslandRecord | undefined>;
    onAction: (action: IslandSharedMemoriesAction) => Promise<IslandRecord | undefined>;
    onCommand: (command: IslandSharedSceneRequest['command']) => void;
    onSelect: (id?: SharedDisplayId) => void;
    onPreview: (preview?: IslandDisplayPreview) => void;
    onRevisit: (ref: SharedTargetRef, target: SharedTarget) => void;
    onPhoto: () => void;
    onClose: () => void;
    onLearn: () => void;
}
const JOB_NAMES = { carry: 'はこんで かざる', gather: 'はなびらを ならべる', illuminate: 'ひかりを あてる' } as const;
export function IslandSharedMemories({ island, selectedId, preview, disabled, error, feedback, onRetry, onAction,
    onCommand: emitCommand, onSelect, onPreview, onRevisit, onPhoto, onClose, onLearn }: Props) {
    const state = getIslandSharedMemories(island), workshop = getIslandWorkshop(island), experience = getIslandExperience(island);
    const [tab, setTab] = useState<'displays' | 'memories'>('displays');
    const [choosing, setChoosing] = useState(false);
    const [residentId, setResidentId] = useState<IslandResidentId>('otter');
    const [removeId, setRemoveId] = useState<string>();
    const [localError, setLocalError] = useState<string>();
    const continuation = useRef(0);
    useEffect(() => () => { continuation.current += 1; }, []);
    const onCommand = (command: IslandSharedSceneRequest['command']) => {
        if (command.type === 'stop') continuation.current += 1;
        emitCommand(command);
    };
    const display = selectedId ? state.displays[selectedId] : undefined;
    const selectedRef: SharedTargetRef | undefined = selectedId && display ? { kind: 'display', displayId: selectedId, targetKey: display.target.targetKey } : undefined;
    const request = state.activeRequest;
    const residents = ISLAND_RESIDENT_IDS.filter(id => isSharedResidentAvailable(island, id));
    const previewTarget = (ref: SharedTargetRef, slot = selectedId ?? SHARED_DISPLAY_IDS.find(id => !state.displays[id]) ?? 'display-1') => {
        onCommand({ type: 'stop' }); setLocalError(undefined);
        try {
            const target = resolveSharedTarget(island, ref), current = state.displays[slot];
            const point = current?.position ?? findSharedDisplayPosition(island, slot, target) ?? { x: 0, z: 1 };
            onSelect(slot); onPreview({ displayId: slot, target, ref, position: point, rotation: current?.rotation ?? 0,
                valid: isValidSharedDisplayPlacement(island, slot, target, point), expectedDisplayKey: sharedDisplayKey(current) });
            setChoosing(false);
        } catch (cause) { setLocalError(cause instanceof Error ? cause.message : 'この ものを もういちど えらんでね'); }
    };
    const movePreview = (position: IslandPosition) => { if (preview) onPreview({ ...preview, position, valid: isValidSharedDisplayPlacement(island, preview.displayId, preview.target, position) }); };
    const ask = async () => {
        const target = preview?.ref ?? selectedRef;
        const destination = preview ?? (selectedId && display ? { displayId: selectedId, ...display, expectedDisplayKey: sharedDisplayKey(display) } : undefined);
        if (!target || !destination) return;
        const requestId = sharedRequestIdentity(island.profileId, crypto.randomUUID());
        onCommand({ type: 'stop' });
        const epoch = continuation.current;
        const updated = await onAction({ type: 'prepare-request', requestId, residentId, jobId: SHARED_RESIDENT_JOBS[residentId], target,
            destination: { displayId: destination.displayId, position: destination.position, rotation: destination.rotation, expectedDisplayKey: destination.expectedDisplayKey },
            expectedRequestId: request?.requestId ?? null });
        if (continuation.current === epoch && updated?.sharedMemories?.activeRequest?.requestId === requestId && updated.sharedMemories.activeRequest.status === 'prepared') {
            onPreview(undefined); onCommand({ type: 'run', requestId });
        }
    };
    const cancelRequest = async () => {
        onCommand({ type: 'stop' });
        if (request) await onAction({ type: 'cancel-request', requestId: request.requestId });
    };
    return <section className="island-sheet island-shared" aria-label="かざりと なかまの きおく">
        <IslandPanelHeading title="かざりと きおく" onExit={onClose} disabled={disabled} exitAriaLabel="かざりと きおくから もどる" />
        <div className="island-shared-tabs"><button className="island-secondary" aria-pressed={tab === 'displays'} onClick={() => { setTab('displays'); onCommand({ type: 'stop' }); }}>しまに かざる</button>
            <button className="island-secondary" aria-pressed={tab === 'memories'} onClick={() => { setTab('memories'); onPreview(undefined); onCommand({ type: 'stop' }); }}><Heart size={17} />なかまの きおく</button></div>
        {(error || localError) && <div className="island-error" role="alert"><p>{error ?? localError}</p>{onRetry && <button className="island-secondary" disabled={disabled} onClick={() => void onRetry()}>もういちど のこす</button>}</div>}
        {feedback && <p className="island-shared-feedback" role="status">{feedback}</p>}
        {request && <aside className="island-shared-request" aria-label="いまの おねがい">
            <p>{experience.residents[request.residentId].name}と {sharedTargetName(island, request.target)}</p>
            {request.status === 'prepared' ? <><div className="island-shared-row"><button className="island-primary" disabled={disabled} onClick={() => onCommand({ type: 'run', requestId: request.requestId })}><Play size={17} />おねがいを つづける</button>
                <button className="island-secondary" onClick={() => onCommand({ type: 'stop' })}>いったん とめる</button></div>
                <button className="island-text-button" disabled={disabled} onClick={() => void cancelRequest()}>この おねがいを やめる</button></>
                : <><p>{request.memoryOutcome === 'not-stored-full' ? 'きおくの たなが いっぱい。いっしょに したことは、あとから のこせるよ。' : 'いっしょに したことが、きおくに のこったよ。'}</p>
                    {request.memoryOutcome === 'not-stored-full' && <button className="island-secondary" disabled={disabled} onClick={() => void onAction({ type: 'remember-result', requestId: request.requestId })}>この きおくを のこす</button>}</>}
        </aside>}
        {tab === 'displays' ? <>
            <div className="island-shared-slots" aria-label="しまの かざりばしょ">{SHARED_DISPLAY_IDS.map((id, index) => <button key={id} className="island-secondary" disabled={disabled} aria-pressed={selectedId === id}
                onClick={() => { onCommand({ type: 'stop' }); onPreview(undefined); onSelect(id); setChoosing(!state.displays[id]); setRemoveId(undefined); }}>
                <span>かざりだい {index + 1}</span><small>{state.displays[id] ? sharedTargetName(island, state.displays[id]!.target) : 'あいているよ'}</small></button>)}</div>
            {preview ? <div className="island-shared-preview" aria-label="かざる ばしょを ためす">
                <h3>{sharedTargetName(island, preview.target)}を どこへ？</h3>
                <p>しまを タップして おく ばしょを えらぼう。</p>
                <div className="island-shared-row" aria-label="ばしょを うごかす">{[
                    { dx: 0, dz: -.25, text: 'おくへ', Icon: ArrowUp }, { dx: -.25, dz: 0, text: 'ひだりへ', Icon: ArrowLeft },
                    { dx: .25, dz: 0, text: 'みぎへ', Icon: ArrowRight }, { dx: 0, dz: .25, text: 'てまえへ', Icon: ArrowDown },
                ].map(({ dx, dz, text, Icon }) => <button key={text} className="island-secondary" disabled={disabled} aria-label={text} onClick={() => movePreview({ x: preview.position.x + dx, z: preview.position.z + dz })}><Icon size={18} /></button>)}
                    <button className="island-secondary" disabled={disabled} onClick={() => onPreview({ ...preview, rotation: (preview.rotation + Math.PI / 2) % (Math.PI * 2) })}><RotateCw size={18} />まわす</button></div>
                <div className="island-shared-row">{SHARED_DISPLAY_IDS.map((id, i) => <button key={id} className="island-secondary" disabled={disabled} aria-pressed={preview.displayId === id}
                    onClick={() => previewTarget(preview.ref, id)}>だい {i + 1}へ</button>)}</div>
                {!preview.valid && <p role="status">ここは せまいみたい。すこし うごかしてみよう。</p>}
                {state.displays[preview.displayId] && state.displays[preview.displayId]!.target.targetKey !== preview.target.targetKey && <p>いまの かざりを はずして、これを おくよ。はずした ものも のこるよ。</p>}
                <div className="island-shared-row"><button className="island-primary" disabled={disabled || !preview.valid || request?.status === 'prepared'} onClick={() => onCommand({ type: 'place-preview', action: {
                    type: 'place-display', displayId: preview.displayId, target: preview.ref, position: preview.position, rotation: preview.rotation, expectedDisplayKey: preview.expectedDisplayKey } })}><Hand size={18} />じぶんで おく</button>
                    <button className="island-secondary" disabled={disabled} onClick={() => { onCommand({ type: 'stop' }); onPreview(undefined); }}>やめる</button></div>
            </div> : display && selectedId && selectedRef ? <div className="island-shared-focus"><h3>{sharedTargetName(island, display.target)}</h3>
                <div className="island-shared-row"><button className="island-secondary" disabled={disabled} onClick={() => onRevisit(selectedRef, display.target)}>いりえで ためす</button>
                    <button className="island-secondary" disabled={disabled} onClick={onPhoto}><Camera size={18} />この かざりを とる</button>
                    <button className="island-secondary" disabled={disabled} onClick={() => previewTarget(selectedRef)}>ばしょを かえる</button></div>
                <div className="island-shared-row"><button className="island-secondary" disabled={disabled || request?.status === 'prepared'} onClick={() => onCommand({ type: 'arrange', displayId: selectedId, expectedDisplayKey: sharedDisplayKey(display)! })}><Flower2 size={17} />じぶんで ならべる</button>
                    <button className="island-secondary" disabled={disabled || request?.status === 'prepared'} onClick={() => onCommand({ type: 'illuminate', displayId: selectedId })}><Lightbulb size={17} />ひかりを あてる</button></div>
                <button className="island-text-button" disabled={disabled} onClick={() => setRemoveId(selectedId)}>この かざりを はずす</button>
                {removeId === selectedId && <div className="island-shared-confirm"><p>だいから はずす？ しらべた ものと きおくは のこるよ。</p>
                    <button className="island-secondary" disabled={disabled} onClick={() => { onCommand({ type: 'stop' }); void onAction({ type: 'remove-display', displayId: selectedId, expectedDisplayKey: sharedDisplayKey(display)! }).then(updated => { if (updated) setRemoveId(undefined); }); }}>はずす</button>
                    <button className="island-text-button" onClick={() => setRemoveId(undefined)}>やめる</button></div>}
            </div> : <p className="island-shared-empty">みつけた ものや つくった ものを、しまに かざろう。</p>}
            {(preview || display) && <fieldset className="island-shared-residents"><legend>なかまに たのむ</legend>
                <div className="island-shared-row">{residents.map(id => <button key={id} className="island-secondary" disabled={disabled} aria-pressed={residentId === id} onClick={() => setResidentId(id)}>
                    <span>{experience.residents[id].name}</span><small>{JOB_NAMES[SHARED_RESIDENT_JOBS[id]]}</small></button>)}</div>
                {preview && residentId !== 'otter' ? <p>まず「じぶんで おく」で かざろう。かざったら、この なかまに たのめるよ。</p>
                    : <button className="island-primary" disabled={disabled || request?.status === 'prepared' || Boolean(preview && !preview.valid)} onClick={() => void ask()}>{experience.residents[residentId].name}に たのむ</button>}
            </fieldset>}
            {!preview && <button className="island-secondary" disabled={disabled} onClick={() => setChoosing(value => !value)}>{choosing ? 'えらぶのを とじる' : 'かざる ものを えらぶ'}</button>}
            {choosing && !preview && <div className="island-shared-sources" aria-label="かざる もの">{WORKSHOP_SPECIMEN_IDS.map(id => <button key={id} className="island-secondary" disabled={disabled}
                onClick={() => previewTarget({ kind: 'specimen', specimenId: id })}>{getWorkshopSpecimenName(workshop, id)}</button>)}
                {WORKSHOP_WORK_IDS.map(id => { const work = workshop.works[id]; return work && <button key={id} className="island-secondary"
                    disabled={disabled || !WORKSHOP_PART_IDS.some(part => work.layout.parts[part].assembled && work.layout.parts[part].position)}
                    onClick={() => previewTarget({ kind: 'work', workId: id, targetKey: sharedWorkCaptureKey(island.profileId, id, work) })}>{work.name}</button>; })}</div>}
        </> : <div className="island-shared-memories"><p>{state.memories.length} / 12 の きおく</p>
            {!state.memories.length && <p className="island-shared-empty">かざった ものを なかまと ためすと、いっしょに したことが ここに のこるよ。</p>}
            {[...state.memories].sort((a, b) => a.firstOrder - b.firstOrder || a.memoryKey.localeCompare(b.memoryKey)).map(memory => <article className="island-shared-memory" key={memory.memoryKey}>
                <h3>{memory.residentName}と {memory.targetName}</h3><p>{JOB_NAMES[memory.jobId]}・{new Date(memory.firstAt).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}</p>
                <div className="island-shared-row"><button className="island-secondary" disabled={disabled} onClick={() => { onSelect(SHARED_DISPLAY_IDS.find(id => state.displays[id]?.target.targetKey === memory.target.targetKey)); onCommand({ type: 'memory', memoryKey: memory.memoryKey }); }}>いっしょに みる</button>
                    <button className="island-secondary" disabled={disabled} onClick={() => onRevisit({ kind: 'memory', memoryKey: memory.memoryKey }, memory.target)}>おなじ ものを ためす</button></div>
                <button className="island-text-button" disabled={disabled} onClick={() => setRemoveId(memory.memoryKey)}>この きおくを たなから はずす</button>
                {removeId === memory.memoryKey && <div className="island-shared-confirm"><p>たなから はずす？ かざりと なかまは のこるよ。</p>
                    <button className="island-secondary" disabled={disabled} onClick={() => void onAction({ type: 'remove-memory', memoryKey: memory.memoryKey }).then(updated => { if (updated) setRemoveId(undefined); })}>はずす</button>
                    <button className="island-text-button" onClick={() => setRemoveId(undefined)}>やめる</button></div>}
            </article>)}
        </div>}
        <footer className="island-shared-row"><button className="island-secondary" onClick={() => onCommand({ type: 'stop' })}><X size={17} />うごきを とめる</button>
            <button className="island-primary" disabled={disabled} onClick={onLearn}>まなぶ<ArrowRight size={18} /></button></footer>
    </section>;
}
