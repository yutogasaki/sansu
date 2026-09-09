import { IslandPanelHeading } from './IslandPanelHeading';
import { useEffect, useId, useState } from 'react';
import { Camera, Check, Eye, Flag, Flower2, Leaf, MapPin, Moon, PawPrint, RotateCcw, Save, Star, Trash2, Volume2, VolumeX, Waves, Wind } from 'lucide-react';
import { getIslandExperience, ISLAND_AMBIENCES, ISLAND_EMBLEMS, ISLAND_EXPERIENCE_NAME_LIMIT, ISLAND_LAYOUT_IDS,
    ISLAND_RESIDENT_LOOKS, ISLAND_RESIDENT_PROFILES, type IslandAmbience, type IslandEmblem, type IslandExperienceAction,
    type IslandLayoutId, type IslandResidentId, type IslandResidentLook } from '../../domain/island/experience';
import { isIslandHabitatUnlocked } from '../../domain/island/growth';
import { getIslandExpression, ISLAND_EXPRESSION_CATALOG } from '../../domain/island/expression';
import type { IslandRecord } from '../../domain/island/types';
import type { IslandAmbienceStatus } from './useIslandAmbience';
import './IslandExperiencePanel.css';
import './IslandPanel.css';

const emblemNames: Record<IslandEmblem, string> = { leaf: 'はっぱ', star: 'ほし', flower: 'おはな', wave: 'なみ' };
const emblemIcons = { leaf: Leaf, star: Star, flower: Flower2, wave: Waves };
const ambienceNames: Record<IslandAmbience, string> = { off: 'おとなし', breeze: 'かぜ', brook: 'みずべ', evening: 'ゆうぐれ' };
const ambienceIcons = { off: VolumeX, breeze: Wind, brook: Waves, evening: Moon };
const lookNames: Record<IslandResidentLook, string> = { original: 'いつもの', scarf: 'マフラー', cap: 'ぼうし' };
type Action = (action: IslandExperienceAction) => Promise<boolean>;

export interface IslandExperiencePanelProps {
    island: IslandRecord;
    disabled: boolean;
    onAction: Action;
    previewLayoutId?: IslandLayoutId;
    onPreview: (layoutId: IslandLayoutId | undefined) => void;
    onPhoto: () => void;
    onView: () => void;
    onClose: () => void;
    error?: string;
    onRetry?: () => void;
    initialTab?: 'island' | 'layouts';
    onVisitFavorite?: (residentId: IslandResidentId) => void;
    onFocusResident?: (residentId: IslandResidentId | undefined) => void;
    ambienceStatus?: IslandAmbienceStatus;
    onStartAmbience?: () => void;
    onExpression?: () => void;
}

function NameEditor({ label, name, disabled, onSave, actionLabel = 'なまえを つける' }: {
    label: string; name: string; disabled: boolean; onSave: (name: string) => Promise<boolean>; actionLabel?: string;
}) {
    const id = useId();
    const [draft, setDraft] = useState(name);
    return <form className="island-experience-name" onSubmit={event => { event.preventDefault(); if (!disabled) void onSave(draft); }}>
        <label htmlFor={id}>{label}</label>
        <div><input id={id} value={draft} onChange={event => setDraft(event.target.value)} disabled={disabled}
            maxLength={ISLAND_EXPERIENCE_NAME_LIMIT * 2} autoComplete="off" spellCheck={false} />
            <button className="island-secondary" type="submit" disabled={disabled || !draft.trim()}><Check size={16} aria-hidden="true" />{actionLabel}</button></div>
    </form>;
}

function LayoutSlot({ island, layoutId, disabled, previewLayoutId, onAction, onPreview }: Pick<IslandExperiencePanelProps,
    'island' | 'disabled' | 'previewLayoutId' | 'onAction' | 'onPreview'> & { layoutId: IslandLayoutId }) {
    const saved = getIslandExperience(island).layouts.find(layout => layout.id === layoutId);
    const [deleting, setDeleting] = useState(false);
    const number = ISLAND_LAYOUT_IDS.indexOf(layoutId) + 1;
    const isPreview = previewLayoutId === layoutId;
    return <article className="island-experience-layout" data-layout-slot={layoutId} data-layout-saved={Boolean(saved)}>
        <div className="island-experience-layout-heading"><span aria-hidden="true">{number}</span>
            <h3>{saved ? saved.name : 'けしきを のこす'}</h3>{isPreview && <small>おためし</small>}</div>
        <NameEditor key={`${island.profileId}:${layoutId}:${saved?.name}`} label={`けしき ${number}の なまえ`}
            name={saved?.name ?? `けしき ${number}`} disabled={disabled || Boolean(previewLayoutId)}
            actionLabel={saved ? 'いまの しまに かえる' : 'いまの しまを のこす'}
            onSave={name => onAction({ type: 'save-layout', layoutId, name })} />
        {saved && <div className="island-experience-layout-actions">
            <button className="island-secondary" disabled={disabled} aria-pressed={isPreview}
                data-experience-action="preview-layout" onClick={() => onPreview(isPreview ? undefined : layoutId)}>
                {isPreview ? <RotateCcw size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}{isPreview ? 'いまに もどす' : 'ためしに みる'}</button>
            <button className={isPreview ? 'island-primary' : 'island-secondary'} disabled={disabled} data-experience-action="apply-layout"
                onClick={() => { void onAction({ type: 'apply-layout', layoutId }); }}><Check size={16} aria-hidden="true" />この けしきに する</button>
            <button className="island-icon-button" disabled={disabled} aria-label={`${saved.name}の きろくを けす`}
                aria-expanded={deleting} onClick={() => setDeleting(value => !value)}><Trash2 size={17} aria-hidden="true" /></button>
        </div>}
        {saved && deleting && <div className="island-experience-delete"><p>この きろくを けす？<small>しまの ものは のこるよ。</small></p>
            <button className="island-secondary" disabled={disabled} onClick={() => { void onAction({ type: 'delete-layout', layoutId }).then(ok => { if (ok) setDeleting(false); }); }}>きろくを けす</button>
            <button className="island-text-button" disabled={disabled} onClick={() => setDeleting(false)}>やめる</button></div>}
    </article>;
}

/** The scene above this panel is the only live preview. The controls never create a renderer or reserve learning. */
export function IslandExperiencePanel({ island, disabled, onAction, previewLayoutId, onPreview, onPhoto, onView, onClose,
    error, onRetry, initialTab = 'island', onVisitFavorite, onFocusResident, ambienceStatus = 'off', onStartAmbience, onExpression }: IslandExperiencePanelProps) {
    const state = getIslandExperience(island);
    const expression = getIslandExpression(island).selection;
    const [tab, setTab] = useState<'island' | 'friends' | 'layouts'>(initialTab);
    const [residentId, setResidentId] = useState<IslandResidentId>('otter');
    const hasFox = island.completedSets >= 4 && isIslandHabitatUnlocked(island, 'waterside');
    const residents: IslandResidentId[] = hasFox ? ['otter', 'rabbit', 'fox'] : ['otter', 'rabbit'];
    const selected = residents.includes(residentId) ? residentId : 'otter';
    useEffect(() => { onFocusResident?.(tab === 'friends' ? selected : undefined); }, [tab, selected, onFocusResident]);
    const friend = state.residents[selected], profile = ISLAND_RESIDENT_PROFILES[selected];
    const tabs = [{ id: 'island', name: 'しま', Icon: Flag }, { id: 'friends', name: 'なかま', Icon: PawPrint },
        { id: 'layouts', name: 'けしき', Icon: Save }] as const;
    return <section className="island-sheet island-panel island-experience" data-testid="island-experience" data-experience-tab={tab} aria-label="わたしの しま">
        <IslandPanelHeading title="なまえ・けしき" onExit={onClose} disabled={disabled} exitAriaLabel="なまえ・けしきから もどる" />
        <div className="island-experience-tabs island-panel-choices" role="group" aria-label="かえたい もの">{tabs.map(({ id, name, Icon }) =>
            <button key={id} className="island-secondary" disabled={disabled} aria-pressed={tab === id}
                onClick={() => { onPreview(undefined); setTab(id); }}><Icon size={18} aria-hidden="true" />{name}</button>)}</div>
        {error && <div className="island-experience-error" role="alert"><p>{error}</p>{onRetry && <button className="island-secondary" disabled={disabled}
            data-experience-action="retry" onClick={onRetry}>けっかを たしかめる</button>}</div>}
        {tab === 'island' && <div className="island-experience-section">
            <NameEditor key={`${island.profileId}:${state.islandName}`} label="しまの なまえ" name={state.islandName}
                disabled={disabled} onSave={name => onAction({ type: 'rename-island', name })} />
            <fieldset className="island-experience-fieldset"><legend>はたの しるし</legend><div className="island-experience-choices island-panel-choices">
                {ISLAND_EMBLEMS.map(emblem => { const Icon = emblemIcons[emblem]; return <button key={emblem} disabled={disabled}
                    aria-pressed={state.emblem === emblem} data-emblem={emblem} onClick={() => { void onAction({ type: 'emblem', emblem }); }}>
                    <Icon size={24} aria-hidden="true" /><span>{emblemNames[emblem]}</span>{state.emblem === emblem && <Check size={13} className="island-experience-check" aria-hidden="true" />}</button>; })}</div></fieldset>
            <fieldset className="island-experience-fieldset"><legend>しまの おと</legend><div className="island-experience-choices island-panel-choices">
                {ISLAND_AMBIENCES.map(ambience => { const Icon = ambienceIcons[ambience]; return <button key={ambience} disabled={disabled}
                    aria-pressed={!expression.soundscape && state.ambience === ambience} data-ambience={ambience} onClick={() => { void onAction({ type: 'ambience', ambience }); }}>
                    <Icon size={23} aria-hidden="true" /><span>{ambienceNames[ambience]}</span>{!expression.soundscape && state.ambience === ambience && <Check size={13} className="island-experience-check" aria-hidden="true" />}</button>; })}</div>
                {expression.soundscape && <p className="island-experience-caption">いまの おと：{ISLAND_EXPRESSION_CATALOG.find(item => item.itemId === expression.soundscape)?.name}</p>}
                {(expression.soundscape || state.ambience !== 'off') && onStartAmbience && <div className="island-experience-audio" data-ambience-status={ambienceStatus}>
                    <button className="island-text-button" disabled={disabled} onClick={onStartAmbience}><Volume2 size={16} aria-hidden="true" />{ambienceStatus === 'playing' ? 'おとを きいているよ' : 'おとを きく'}</button>
                    {ambienceStatus === 'blocked' && <small role="status">おとを きくを おしてみよう。</small>}
                </div>}</fieldset>
        </div>}
        {tab === 'friends' && <div className="island-experience-section">
            <div className="island-experience-friends island-panel-choices" role="group" aria-label="なかまを えらぶ">{residents.map(id =>
                <button key={id} className="island-secondary" disabled={disabled} aria-pressed={selected === id}
                    data-resident-id={id} onClick={() => setResidentId(id)}>{state.residents[id].name}<small>{ISLAND_RESIDENT_PROFILES[id].name}</small></button>)}</div>
            <div className="island-experience-favorite"><Leaf size={18} aria-hidden="true" /><p>{profile.favoriteLabel}が すき</p>
                {onVisitFavorite && <button className="island-text-button" disabled={disabled} onClick={() => onVisitFavorite(selected)}><MapPin size={16} aria-hidden="true" />いっしょに みる</button>}</div>
            <NameEditor key={`${island.profileId}:${selected}:${friend.name}`} label={`${profile.name}の よびなまえ`} name={friend.name}
                disabled={disabled} onSave={name => onAction({ type: 'resident-name', residentId: selected, name })} />
            <fieldset className="island-experience-fieldset"><legend>きょうの よそおい</legend><div className="island-experience-choices island-experience-looks island-panel-choices">
                {ISLAND_RESIDENT_LOOKS.map(look => <button key={look} disabled={disabled} aria-pressed={!expression.residents[selected].outfit && friend.look === look}
                    data-resident-look={look} onClick={() => { void onAction({ type: 'resident-look', residentId: selected, look }); }}>
                    <span className={`island-experience-look island-experience-look--${look}`} aria-hidden="true">{look === 'original' ? <PawPrint size={25} /> : <i />}</span>
                    <span>{lookNames[look]}</span>{!expression.residents[selected].outfit && friend.look === look && <Check size={13} className="island-experience-check" aria-hidden="true" />}</button>)}</div>
                {expression.residents[selected].outfit && <p className="island-experience-caption">いまの よそおい：{ISLAND_EXPRESSION_CATALOG.find(item => item.itemId === expression.residents[selected].outfit)?.name}</p>}
            </fieldset>
        </div>}
        {tab === 'layouts' && <div className="island-experience-section">
            <p className="island-experience-caption">ものの ならべかた・きせかえ・なかまの よそおい・おと・はたを いっしょに のこせるよ。</p>
            <p className="island-experience-caption">いえに かざったものは、この けしきとは べつに のこるよ。</p>
            {previewLayoutId && <div className="island-experience-preview" role="status"><Eye size={17} aria-hidden="true" /><span>おためしの けしき</span>
                <button className="island-text-button" disabled={disabled} onClick={() => onPreview(undefined)}>いまに もどす</button></div>}
            {ISLAND_LAYOUT_IDS.map(layoutId => <LayoutSlot key={`${island.profileId}:${layoutId}`} island={island} layoutId={layoutId}
                disabled={disabled} previewLayoutId={previewLayoutId} onAction={onAction} onPreview={onPreview} />)}
        </div>}
        {onExpression && <button className="island-secondary" disabled={disabled} data-experience-action="expression" onClick={onExpression}><PawPrint size={18} />みじたくと コレクション</button>}
        <div className="island-experience-souvenirs island-panel-footer"><button className="island-secondary" disabled={disabled || Boolean(previewLayoutId)} onClick={onPhoto}>
            <Camera size={18} aria-hidden="true" />しゃしんを とる</button><button className="island-secondary" disabled={disabled || Boolean(previewLayoutId)} onClick={onView}>
            <Eye size={18} aria-hidden="true" />しまを ながめる</button></div>
    </section>;
}
