import { IslandPanelHeading } from './IslandPanelHeading';
import { useState } from 'react';
import { ArrowRight, Brush, Camera, Check, Droplets, Hand, Lightbulb, Play, Redo2, RotateCw, Save, Undo2, Wrench } from 'lucide-react';
import { getWorkshopAssemblableParts, getWorkshopSpecimenName, WORKSHOP_SHELF_IDS, WORKSHOP_SPECIMEN_IDS, WORKSHOP_WORK_IDS,
    type IslandWorkshopAction, type IslandWorkshopState, type WorkshopSpecimenId, type WorkshopToolId, type WorkshopWorkId } from '../../domain/island/workshop';
import { WORKSHOP_PART_IDS, WORKSHOP_PARTS, type WorkshopPartId, type WorkshopRotation } from '../../domain/island/workshopLayout';
import type { WorkshopSceneCommand, WorkshopSceneState } from './three/workshopScene';
import type { IslandResidentId } from '../../domain/island/experience';
import './IslandWorkshop.css';
import './IslandPanel.css';

export interface IslandWorkshopView {
    mode: WorkshopSceneState['mode'];
    selectedSpecimenId: WorkshopSpecimenId;
    selectedPartId: WorkshopPartId;
    selectedToolId: WorkshopToolId;
    residentId?: IslandResidentId;
}
interface Props {
    workshop: IslandWorkshopState;
    view: IslandWorkshopView;
    onView: (view: IslandWorkshopView) => void;
    disabled: boolean;
    onCommand: (command: WorkshopSceneCommand) => void;
    onAction: (action: IslandWorkshopAction) => Promise<boolean>;
    onClose: () => void;
    onLearn: () => void;
    onPhoto?: () => void;
    onDisplay?: (id: WorkshopSpecimenId | WorkshopWorkId) => void;
    error?: string;
    onRetry?: () => Promise<boolean>;
    onGesture?: () => void;
    residents: { id: IslandResidentId; name: string }[];
}
const RESULT_LABELS = { clean: 'すなが とれた', transmit: 'ひかりを とおした', opaque: 'かげが できた', float: 'みずに ういた', sink: 'そこに しずんだ' } as const;
const TOOLS = [{ id: 'brush', name: 'ブラシ', Icon: Brush }, { id: 'lamp', name: 'ひかり', Icon: Lightbulb }, { id: 'water', name: 'みず', Icon: Droplets }] as const;
const MATERIAL_LABELS = { straight: 'ながれぎ', elbow: 'ながれぎ', wheel: 'いろガラス', bell: 'しまもようの かい' } as const;

function SpecimenName({ specimenId, name, disabled, onAction }: Pick<Props, 'disabled' | 'onAction'> & { specimenId: WorkshopSpecimenId; name?: string }) {
    const [draft, setDraft] = useState(name ?? '');
    return <form className="island-workshop-name" onSubmit={event => { event.preventDefault(); void onAction({ type: 'name-specimen', specimenId, name: draft.trim() || undefined }); }}>
        <label htmlFor="workshop-specimen-name">わたしの よびな</label>
        <div><input id="workshop-specimen-name" value={draft} onChange={event => setDraft(event.target.value)} disabled={disabled} autoComplete="off" placeholder="なまえを つけても いいよ" />
            <button className="island-secondary" disabled={disabled} type="submit">きめる</button></div>
    </form>;
}
function SavedWork({ workId, workshop, disabled, onAction, onDisplay }: Pick<Props, 'workshop' | 'disabled' | 'onAction' | 'onDisplay'> & { workId: WorkshopWorkId }) {
    const work = workshop.works[workId];
    const [name, setName] = useState(work?.name ?? `わたしの しかけ ${WORKSHOP_WORK_IDS.indexOf(workId) + 1}`);
    const [confirm, setConfirm] = useState(false);
    return <div className="island-workshop-work" data-work-id={workId}>
        <form className="island-workshop-name" onSubmit={event => { event.preventDefault(); void onAction({ type: 'save-work', workId, name }); }}>
            <label htmlFor={`workshop-${workId}`}>さくひん {WORKSHOP_WORK_IDS.indexOf(workId) + 1}{work ? `・${work.name}` : '・まだ あいているよ'}</label>
            <div><input id={`workshop-${workId}`} value={name} onChange={event => setName(event.target.value)} disabled={disabled} autoComplete="off" />
                <button className="island-secondary" disabled={disabled} type="submit"><Save size={16} />いまを のこす</button></div>
        </form>
        {work && <div className="island-workshop-row island-panel-actions"><button className="island-secondary" disabled={disabled} onClick={() => void onAction({ type: 'load-work', workId })}>この あんから つくる</button>
            {onDisplay && <button className="island-secondary" disabled={disabled} onClick={() => onDisplay(workId)}>しまに かざる</button>}
            <button className="island-text-button" disabled={disabled} onClick={() => setConfirm(value => !value)}>あける</button></div>}
        {confirm && <div className="island-workshop-confirm"><p>この さくひんの わくを あける？ つくりかけと ざいりょうは のこるよ。</p>
            <button className="island-secondary" disabled={disabled} onClick={() => { void onAction({ type: 'delete-work', workId }).then(ok => { if (ok) setConfirm(false); }); }}>わくを あける</button>
            <button className="island-text-button" onClick={() => setConfirm(false)}>やめる</button></div>}
    </div>;
}

export function IslandWorkshop({ workshop, view, onView, disabled, onCommand, onAction, onClose, onLearn, onPhoto, onDisplay, error, onRetry, onGesture, residents }: Props) {
    const [lampAngle, setLampAngle] = useState(0);
    const specimenId = view.selectedSpecimenId, specimen = workshop.specimens[specimenId];
    const partId = view.selectedPartId, part = workshop.draftCheckpoint.draft.layout.parts[partId];
    const assemblable = getWorkshopAssemblableParts(workshop);
    const selectTool = (tool: WorkshopToolId) => {
        onView({ ...view, selectedToolId: tool });
        onCommand({ type: 'place-specimen', specimenId, station: tool });
    };
    return <section className="island-sheet island-panel island-workshop" aria-label="おためしの いりえ" onPointerDownCapture={onGesture} onKeyDownCapture={onGesture}>
        <IslandPanelHeading title="おためしの いりえ" kind="close" onExit={onClose} disabled={disabled} exitAriaLabel="いりえを とじる" />
        <div className="island-workshop-tabs island-panel-choices" aria-label="いりえの あそび">
            <button className="island-secondary" disabled={disabled} aria-pressed={view.mode === 'observe'} onClick={() => onView({ ...view, mode: 'observe' })}><Hand size={18} />しらべる</button>
            <button className="island-secondary" disabled={disabled} aria-pressed={view.mode === 'build'} onClick={() => onView({ ...view, mode: 'build' })}><Wrench size={18} />つくる</button>
        </div>
        {error && <div className="island-workshop-error" role="alert"><p>{error}</p>{onRetry && <button className="island-secondary" disabled={disabled} onClick={() => void onRetry()}>もういちど のこす</button>}</div>}
        {view.mode === 'observe' ? <div className="island-workshop-section">
            <div className="island-workshop-specimens island-panel-choices" aria-label="しらべる もの">{WORKSHOP_SPECIMEN_IDS.map((id, index) => <button key={id} className="island-secondary" disabled={disabled}
                data-specimen-id={id} aria-pressed={specimenId === id} onClick={() => onView({ ...view, selectedSpecimenId: id })}>
                <span className={`island-workshop-sample island-workshop-sample--${id}${workshop.specimens[id].identity ? ' is-known' : ''}`} aria-hidden="true">{index + 1}</span>
                <span>{getWorkshopSpecimenName(workshop, id)}</span></button>)}</div>
            <div className="island-workshop-focus"><h3>{getWorkshopSpecimenName(workshop, specimenId)}</h3>
                <button className="island-secondary" disabled={disabled} onClick={() => onCommand({ type: 'pick-specimen', specimenId })}><Hand size={16} />もつ</button></div>
            {onDisplay && <button className="island-secondary" disabled={disabled} onClick={() => onDisplay(specimenId)}>しまに かざる</button>}
            <p className="island-workshop-hint">{view.selectedToolId === 'brush' ? 'すなを なぞって、したを みてみよう。' : view.selectedToolId === 'lamp' ? 'ひかりを あてると、どうなる？' : 'みずに おくと、どうなる？'}</p>
            <div className="island-workshop-tools island-panel-choices" aria-label="どうぐ">{TOOLS.map(({ id, name, Icon }) => <button key={id} className="island-secondary" disabled={disabled}
                aria-pressed={view.selectedToolId === id} onClick={() => selectTool(id)}><Icon size={18} />{name}へ おく</button>)}</div>
            {view.selectedToolId === 'brush' ? <div className="island-workshop-brush" aria-label="ブラシを あてる ばしょ">{Array.from({ length: 6 }, (_, section) => {
                const clean = Boolean(specimen.cleanedMask & (1 << section));
                return <button key={section} className="island-secondary" disabled={disabled || clean} aria-label={`すな ${section + 1}${clean ? ' は とれた' : ' を はらう'}`}
                    data-brush-section={section} onClick={() => onCommand({ type: 'brush', specimenId, section })}>{clean ? <Check size={16} /> : section + 1}</button>;
            })}</div> : view.selectedToolId === 'lamp' ? <div className="island-workshop-row island-panel-actions">
                {[-1, 1].map(direction => <button key={direction} className="island-secondary" disabled={disabled} onClick={() => {
                    const angle = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, lampAngle + direction * Math.PI / 12));
                    setLampAngle(angle); onCommand({ type: 'lamp', specimenId, angle });
                }}>{direction < 0 ? 'ひだりから' : 'みぎから'} てらす</button>)}
            </div> : <button className="island-secondary" disabled={disabled} onClick={() => onCommand({ type: 'place-specimen', specimenId, station: 'brush' })}>みずから とりだす</button>}
            <div className="island-workshop-observations" aria-label="じぶんで みつけたこと" data-observed-count={specimen.observations.length}>
                {specimen.observations.map(entry => <span key={entry.id}><Check size={14} />{RESULT_LABELS[entry.result]}</span>)}
                {specimen.identity && <strong>みつけた！ {getWorkshopSpecimenName({ ...workshop, specimens: { ...workshop.specimens, [specimenId]: { ...specimen, name: undefined } } }, specimenId)}</strong>}
            </div>
            <details className="island-workshop-details"><summary>たなに かざる・なまえを つける</summary>
                <div className="island-workshop-shelves island-panel-choices">{WORKSHOP_SHELF_IDS.map((shelfId, index) => <button key={shelfId} className="island-secondary"
                    disabled={disabled || Boolean(workshop.shelves[shelfId] && workshop.shelves[shelfId] !== specimenId)}
                    aria-pressed={workshop.shelves[shelfId] === specimenId} onClick={() => onCommand({ type: 'place-specimen', specimenId, station: shelfId })}>
                    たな {index + 1}<small>{workshop.shelves[shelfId] ? getWorkshopSpecimenName(workshop, workshop.shelves[shelfId]!) : 'あいているよ'}</small></button>)}</div>
                <button className="island-text-button" disabled={disabled} onClick={() => onCommand({ type: 'place-specimen', specimenId, station: 'home' })}>はまべへ もどす</button>
                <SpecimenName key={`${specimenId}:${specimen.name ?? ''}`} specimenId={specimenId} name={specimen.name} disabled={disabled} onAction={onAction} />
            </details>
        </div> : <div className="island-workshop-section">
            <p className="island-workshop-hint">みぞを つないで、みずを ながそう。まわった ちからは、どこへ とどく？</p>
            <div className="island-workshop-parts island-panel-choices" aria-label="ぶひん">{WORKSHOP_PART_IDS.map(id => <button key={id} className="island-secondary" disabled={disabled}
                data-part-id={id} aria-pressed={partId === id} onClick={() => onView({ ...view, selectedPartId: id })}>
                <span>{WORKSHOP_PARTS[id].name}</span><small>{workshop.draftCheckpoint.draft.layout.parts[id].assembled ? 'できているよ' : assemblable.includes(id) ? 'ざいりょうを はめよう' : `${MATERIAL_LABELS[id]}を しらべよう`}</small></button>)}</div>
            {!part.assembled ? <button className="island-primary" disabled={disabled || !assemblable.includes(partId)} onClick={() => onCommand({ type: 'assemble', partId })}>
                {MATERIAL_LABELS[partId]}を はめる</button> : <div className="island-workshop-row island-panel-actions island-panel-choices">
                <button className="island-secondary" disabled={disabled} onClick={() => void onAction({ type: 'edit-draft', edit: { type: 'rotate', partId, rotation: ((part.rotation + 1) % 4) as WorkshopRotation } })}><RotateCw size={17} />まわす</button>
                <button className="island-secondary" disabled={disabled || !part.position} onClick={() => void onAction({ type: 'edit-draft', edit: { type: 'remove', partId } })}>ばんから はずす</button></div>}
            <details className="island-workshop-details"><summary>タップで おく ばしょを えらぶ</summary><div className="island-workshop-board island-panel-choices" aria-label="しかけの ばん">{Array.from({ length: 16 }, (_, index) => {
                const col = index % 4, row = Math.floor(index / 4);
                const occupant = WORKSHOP_PART_IDS.find(id => { const pose = workshop.draftCheckpoint.draft.layout.parts[id].position; return pose?.col === col && pose.row === row; });
                return <button key={index} className="island-secondary" disabled={disabled || !part.assembled || Boolean(occupant && occupant !== partId)} aria-pressed={occupant === partId}
                    aria-label={`${row + 1}だんめ ${col + 1}ばん${occupant ? ` ${WORKSHOP_PARTS[occupant].name}` : ''}`} data-workshop-cell={`${col},${row}`}
                    onClick={() => void onAction({ type: 'edit-draft', edit: { type: 'move', partId, position: { col, row } } })}>{occupant ? WORKSHOP_PARTS[occupant].name : `${row + 1}·${col + 1}`}</button>;
            })}</div></details>
            <fieldset className="island-workshop-residents"><legend>だれと ためす？</legend><div className="island-workshop-row island-panel-actions island-panel-choices">
                <button className="island-secondary" disabled={disabled} aria-pressed={!view.residentId} onClick={() => onView({ ...view, residentId: undefined })}>じぶんで</button>
                {residents.map(resident => <button key={resident.id} className="island-secondary" disabled={disabled} aria-pressed={view.residentId === resident.id}
                    onClick={() => onView({ ...view, residentId: resident.id })}>{resident.name}</button>)}
            </div></fieldset>
            <div className="island-workshop-row island-panel-actions"><button className="island-primary" disabled={disabled} onClick={() => onCommand({ type: 'run' })}><Play size={18} />みずを ながす</button>
                <button className="island-secondary" onClick={() => onCommand({ type: 'stop' })}>とめる</button></div>
            <div className="island-workshop-row island-panel-actions"><button className="island-secondary" disabled={disabled || !workshop.draftCheckpoint.draft.undo.length} onClick={() => void onAction({ type: 'edit-draft', edit: { type: 'undo' } })}><Undo2 size={17} />ひとつ もどす</button>
                <button className="island-secondary" disabled={disabled || !workshop.draftCheckpoint.draft.redo.length} onClick={() => void onAction({ type: 'edit-draft', edit: { type: 'redo' } })}><Redo2 size={17} />やりなおす</button></div>
            <details className="island-workshop-details"><summary>さくひんを のこす・べつの あん</summary>
                <p className="island-workshop-hint">{error ? 'まだ のこせていない そうさが あるよ。' : disabled ? 'つくりかけを のこしているよ。' : 'つくりかけは のこっているよ。'}とっておく あんは、ここに のこそう。</p>
                {WORKSHOP_WORK_IDS.map(workId => <SavedWork key={workId} workId={workId} workshop={workshop} disabled={disabled} onAction={onAction} onDisplay={onDisplay} />)}
                <div className="island-workshop-row island-panel-actions"><button className="island-secondary" disabled={disabled} onClick={() => void onAction({ type: 'load-work' })}>あたらしい あん</button>
                    <button className="island-secondary" disabled={disabled} onClick={() => void onAction({ type: 'cancel-draft' })}>この あんの はじめに もどす</button>
                    <button className="island-secondary" disabled={disabled} onClick={() => void onAction({ type: 'edit-draft', edit: { type: 'clear' } })}>ばんを あける</button></div>
            </details>
        </div>}
        <footer className="island-workshop-footer island-panel-footer">{onPhoto && <button className="island-secondary" disabled={disabled} onClick={onPhoto}><Camera size={18} />しゃしんを とる</button>}
            <button className="island-secondary" disabled={disabled} onClick={onLearn}>まなぶ<ArrowRight size={18} /></button></footer>
    </section>;
}
