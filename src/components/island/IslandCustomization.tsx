import { IslandPanelHeading } from './IslandPanelHeading';
import { useEffect, useState } from 'react';
import { Cloud, House, TreePine, Waves, Fence, Map, RotateCcw, Check, Gem, Heart, MoonStar, Sparkles, Star, Candy, ArrowRight } from 'lucide-react';
import { CUSTOMIZATION_CATALOG, getIslandCosmetics, getIslandCustomization, hasIslandCustomizationItem, quoteIslandCustomization,
    type IslandCosmetics, type IslandCustomizationAction, type IslandCustomizationItemId, type IslandThemeId } from '../../domain/island/customization';
import { ISLAND_APPEARANCE_PART_IDS, ISLAND_APPEARANCE_PART_SLOTS, type IslandAppearancePartId, type IslandAppearanceSlotId } from '../../domain/island/appearance';
import { previewIslandCustomization as previewAction } from '../../domain/island/customization';
import type { IslandRecord } from '../../domain/island/types';
import { sameIslandCosmetics } from './islandCustomizationPreview';
import { IslandRewardGoal, IslandRewardGoalChoice, IslandRewardGoalFeedback, type IslandRewardGoalControls } from './IslandRewardGoal';
import './IslandCustomization.css';
import './IslandPanel.css';

const themeIcons = { 'moon-garden': MoonStar, starry: Star, candy: Candy, crystal: Gem };
const setNames: Record<IslandThemeId, string> = { 'moon-garden': '', starry: 'ほしぞら', candy: 'おかし', crystal: 'すいしょう' };

function Stars({ amount }: { amount: number }) {
    return <span className="island-customization-stars"><Star size={15} aria-hidden="true" /><span>{amount}<span className="island-customization-unit">こ</span></span></span>;
}

export function IslandCustomizationPreviewNotice({ preview, saved }: { preview: IslandCosmetics; saved: IslandCosmetics }) {
    return <span className="island-customization-stage-label" data-testid="island-customization-preview-label">
        <Sparkles size={14} aria-hidden="true" />{sameIslandCosmetics(preview, saved) ? 'いまの しま' : 'おためし'}</span>;
}

const partLabels: Record<IslandAppearancePartId, string> = { sky: 'そら', ground: 'じめん・みち', water: 'みず', house: 'おうち', plants: 'しょくぶつ', bridge: 'はし' };
const slotLabels: Record<IslandAppearanceSlotId, string> = { sky: 'そら', ground: 'じめん', shore: 'きし', path: 'みち', water: 'みず',
    houseBody: 'かべ', houseRoof: 'やね', houseWindows: 'まど', tree: 'き', flower: 'はな', mushroom: 'きのこ', bridge: 'はし' };
const partIcons = { sky: Cloud, ground: Map, water: Waves, house: House, plants: TreePine, bridge: Fence };
type Kind = 'theme' | 'part' | 'set' | 'accent';
type Restore = Extract<IslandCustomizationAction, { type: 'restore-part' }>;

export function IslandCustomization({ island, preview, selectedId, selectedSlot, selectionReady = true, restore, celebration, disabled,
    error, onRetry, onSelect, onBrowse, onRestore, onUndoPart, onResetPreview, onAction, onClose, onSaveScene, onFurniture, onFocus, rewardGoal }: {
    island: IslandRecord; preview: IslandCosmetics; selectedId: IslandCustomizationItemId; selectedSlot?: IslandAppearanceSlotId;
    selectionReady?: boolean; restore?: Restore; celebration?: string; disabled: boolean; error?: string; onRetry?: () => void;
    onSelect: (id: IslandCustomizationItemId, slot?: IslandAppearanceSlotId) => void; onBrowse?: () => void;
    onRestore?: (part: IslandAppearancePartId, slot?: IslandAppearanceSlotId) => void;
    onUndoPart?: (part: IslandAppearancePartId, slot?: IslandAppearanceSlotId) => void; onResetPreview?: () => void;
    onAction: (action: IslandCustomizationAction) => void; onClose: () => void; onSaveScene?: () => void; onFurniture?: () => void;
    onFocus?: (slot: IslandAppearanceSlotId | 'all') => void;
    rewardGoal?: IslandRewardGoalControls;
}) {
    const state = getIslandCustomization(island), saved = getIslandCosmetics(island);
    const selected = CUSTOMIZATION_CATALOG.find(item => item.id === selectedId)!;
    const [kind, setKind] = useState<Kind>(selected.kind);
    const [part, setPart] = useState<IslandAppearancePartId>(selected.partId ?? 'house');
    const [slot, setSlot] = useState<IslandAppearanceSlotId | undefined>(selectedSlot);
    // Browsing owns the camera. Clearing a purchase/preview intent must not
    // change the comparison's magnification or select another saved object.
    const focus = kind === 'part' ? slot ?? (part === 'house' ? 'houseBody' : 'all') : 'all';
    useEffect(() => { onFocus?.(focus); }, [focus, onFocus]);
    const quote = quoteIslandCustomization(island, selectedId), owned = restore || quote.owned;
    const equipAction: IslandCustomizationAction = restore ?? { type: 'equip', itemId: selectedId, ...(selectedSlot ? { slot: selectedSlot } : {}) };
    const equipped = selectionReady && sameIslandCosmetics(saved, previewAction(saved, equipAction));
    const desired = state.desiredItemId === selectedId, missing = Math.max(0, quote.price - state.points);
    const locked = disabled || Boolean(onRetry), changed = !sameIslandCosmetics(preview, saved);
    const sets = (['starry', 'candy', 'crystal'] as const).filter(theme => hasIslandCustomizationItem(island, `${theme}-complete`));
    const categories = [{ id: 'part', label: 'ばしょごと' }, { id: 'theme', label: 'しまぜんたい' }, { id: 'set', label: 'セット' }, { id: 'accent', label: 'かざり' }] as const;
    const items = CUSTOMIZATION_CATALOG.filter(item => item.kind === kind && (kind !== 'part' || item.partId === part));
    return <section className="island-sheet island-panel island-customization" data-testid="island-customization" data-selected-item={selectedId}
        data-selected-slot={selectedSlot ?? 'all'} data-customization-category={kind} data-cosmetic-focus={focus} data-points={state.points} data-preview={changed} aria-label="しまの きせかえ">
        <IslandPanelHeading title="しまの きせかえ" onExit={onClose} disabled={disabled} exitAriaLabel="きせかえから もどる"
            actions={<div className="island-customization-wallet" aria-label={`もっている ほし ${state.points}こ`}><small>まなぶと たまる ほし</small><Stars amount={state.points} /></div>} />
        {error && <div className="island-customization-error" role="alert"><p>{error}</p>{onRetry && <button className="island-secondary" disabled={disabled}
            data-customization-action="retry" onClick={onRetry}>けっかを たしかめる</button>}</div>}
        <IslandRewardGoalFeedback controls={rewardGoal} disabled={disabled} />
        <div className="island-customization-categories island-panel-choices" role="group" aria-label="きせかえの えらびかた">{categories.map(category =>
            <button key={category.id} className="island-secondary" disabled={locked} data-customization-category={category.id} aria-pressed={kind === category.id}
                onClick={() => { setKind(category.id); onBrowse?.(); }}>{category.label}</button>)}</div>
        {onFurniture && <button className="island-text-button" disabled={disabled} onClick={onFurniture}>くらしの どうぐを みる <ArrowRight size={15} /></button>}
        {kind === 'part' && <div className="island-customization-targets">
            <div className="island-customization-parts island-panel-choices" role="group" aria-label="かえる ばしょ">{ISLAND_APPEARANCE_PART_IDS.map(id => {
                const Icon = partIcons[id]; return <button key={id} className="island-secondary" disabled={locked} aria-pressed={part === id}
                    data-appearance-part={id} onClick={() => { setPart(id); setSlot(undefined); onBrowse?.(); }}><Icon size={19} aria-hidden="true" />{partLabels[id]}</button>;
            })}</div>
            {ISLAND_APPEARANCE_PART_SLOTS[part].length > 1 && <div className="island-customization-slots island-panel-choices" role="group" aria-label={`${partLabels[part]}の かえる ところ`}>
                <button className="island-secondary" disabled={locked} aria-pressed={!slot} data-appearance-slot="all"
                    onClick={() => { setSlot(undefined); onBrowse?.(); }}>まとめて</button>
                {ISLAND_APPEARANCE_PART_SLOTS[part].map(id => <button key={id} className="island-secondary" disabled={locked} aria-pressed={slot === id}
                    data-appearance-slot={id} onClick={() => { setSlot(id); onBrowse?.(); }}>{slotLabels[id]}</button>)}</div>}
        </div>}
        <div className="island-customization-rails"><div><h3>{kind === 'part' ? `${slot ? slotLabels[slot] : partLabels[part]}を ためす`
            : kind === 'set' ? 'しまぜんたいと かざりが かわるよ' : kind === 'theme' ? 'しまぜんたいを ためす' : 'ちいさな かざり'}</h3>
            <div className="island-customization-rail island-panel-choices" role="group" aria-label="けしきを ためす">{items.map(item => {
                const Icon = kind === 'part' ? partIcons[part] : themeIcons[item.themeId], itemQuote = quoteIslandCustomization(island, item.id);
                return <button key={item.id} className="island-customization-item" data-customization-id={item.id} data-theme={item.themeId}
                    disabled={locked} aria-pressed={selectionReady && !restore && selectedId === item.id && selectedSlot === (kind === 'part' ? slot : undefined)}
                    onClick={() => onSelect(item.id, kind === 'part' ? slot : undefined)}>
                    <span className={`island-customization-silhouette island-customization-silhouette--${kind}`}><Icon size={29} strokeWidth={1.8} aria-hidden="true" />
                        {(kind === 'theme' || kind === 'set') && <i aria-hidden="true" />}</span><strong>{item.name}</strong>
                    <span className="island-customization-item-status">{itemQuote.owned ? <><Check size={12} aria-hidden="true" />もっている</> : <Stars amount={itemQuote.price} />}</span>
                </button>;
            })}</div>
            {kind === 'part' && <div className="island-customization-restore">
                {onRestore && <button className="island-text-button" disabled={locked} data-customization-action="preview-default-part" onClick={() => onRestore(part, slot)}>
                    <MoonStar size={16} aria-hidden="true" />いつもの {slot ? slotLabels[slot] : partLabels[part]}を ためす</button>}
                {onUndoPart && <button className="island-text-button" disabled={locked || !changed} data-customization-action="undo-preview-part" onClick={() => onUndoPart(part, slot)}>
                    <RotateCcw size={15} aria-hidden="true" />ここだけ おためしを もどす</button>}
            </div>}
        </div></div>
        {celebration && <p key={celebration} className="island-customization-celebration" role="status"><Sparkles size={19} aria-hidden="true" />{celebration}</p>}
        {selectionReady ? <div className="island-customization-choice" aria-live="polite">
            <div className="island-customization-choice-title"><strong>{restore ? `いつもの ${restore.slot ? slotLabels[restore.slot] : partLabels[restore.partId]}` : selected.name}</strong>
                <span className="island-customization-preview-label">{changed ? 'おためし' : 'いまの しま'}</span></div>
            {selected.kind === 'part' && selectedSlot && !restore && <p className="island-customization-scope">
                {owned ? `${slotLabels[selectedSlot]}に つかうよ。` : `${partLabels[selected.partId!]}の どこでも つかえるよ。いま かえるのは ${slotLabels[selectedSlot]}だけ。`}</p>}
            {!owned && quote.price < quote.listPrice && <p className="island-customization-credit">ぜんぶで <Stars amount={quote.listPrice} />・もっている ぶん <Stars amount={quote.listPrice - quote.price} /> を のぞくよ。</p>}
            <div className="island-customization-actions">
                {owned ? <button className="island-primary" disabled={locked || equipped} data-customization-action={restore ? 'restore-part' : 'equip'} onClick={() => onAction(equipAction)}>
                    {equipped ? <><Check size={18} aria-hidden="true" />つかっている</> : 'これを つかう'}</button>
                    : <button className="island-primary" disabled={locked || missing > 0} data-customization-action="purchase"
                        onClick={() => onAction({ type: 'purchase', itemId: selectedId, ...(selectedSlot ? { slot: selectedSlot } : {}) })}>
                        {missing > 0 ? <>あと <Stars amount={missing} /></> : <><Stars amount={quote.price} />こうかんして つかう</>}</button>}
                {!owned && (rewardGoal ? <IslandRewardGoalChoice island={island} target={{ category: 'customization', itemId: selectedId }} disabled={locked} controls={rewardGoal} /> : <button className="island-secondary island-customization-desire" disabled={locked} aria-pressed={desired}
                    data-customization-action={desired ? 'clear-desire' : 'desire'} onClick={() => onAction(desired ? { type: 'clear-desire' } : { type: 'desire', itemId: selectedId })}>
                    <Heart size={17} fill={desired ? 'currentColor' : 'none'} aria-hidden="true" />{desired ? 'ほしいを やめる' : 'これが ほしい'}</button>)}
            </div>
        </div> : <p className="island-customization-scope">すきな けしきを おして、しまに あわせてみよう。</p>}
        <div className="island-customization-bottom island-panel-footer">
            {changed && onResetPreview && <button className="island-text-button" disabled={locked} data-customization-action="reset-preview" onClick={onResetPreview}>おためしを ぜんぶ もどす</button>}
            {kind === 'accent' && <button className="island-text-button" data-customization-action="clear-accent" disabled={locked || !saved.accentId}
                onClick={() => onAction({ type: 'clear-accent' })}>かざりを はずす</button>}
            <button className="island-text-button" disabled={disabled} onClick={onClose}>しまへ <ArrowRight size={15} aria-hidden="true" /></button></div>
        {sets.length > 0 && <p className="island-customization-sets" data-testid="island-customization-sets"><Check size={14} aria-hidden="true" />{sets.map(theme => setNames[theme]).join('・')}の セットが そろった</p>}
        {onSaveScene && <button className="island-secondary island-customization-save" disabled={disabled || changed || Boolean(onRetry)} onClick={onSaveScene}>
            いまの けしきを のこす <ArrowRight size={15} aria-hidden="true" /></button>}
    </section>;
}

export function IslandCustomizationGoal({ island, disabled, onOpen }: { island: IslandRecord; disabled: boolean; onOpen: () => void }) {
    return <IslandRewardGoal island={island} disabled={disabled} onOpen={onOpen} />;
}
