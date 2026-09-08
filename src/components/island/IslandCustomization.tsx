import { Check, Gem, Heart, MoonStar, Sparkles, Star, Candy, X, ArrowRight } from 'lucide-react';
import { CUSTOMIZATION_CATALOG, getIslandCosmetics, getIslandCustomization,
    type IslandCosmetics, type IslandCustomizationAction, type IslandCustomizationItemId, type IslandThemeId } from '../../domain/island/customization';
import type { IslandRecord } from '../../domain/island/types';
import { sameIslandCosmetics } from './islandCustomizationPreview';
import './IslandCustomization.css';

const themeIcons = { 'moon-garden': MoonStar, starry: Star, candy: Candy, crystal: Gem };
const setNames: Record<IslandThemeId, string> = { 'moon-garden': '', starry: 'ほしぞら', candy: 'おかし', crystal: 'すいしょう' };

function Stars({ amount }: { amount: number }) {
    return <span className="island-customization-stars"><Star size={15} aria-hidden="true" /><span>{amount}<span className="island-customization-unit">こ</span></span></span>;
}

export function IslandCustomizationPreviewNotice({ preview, saved }: { preview: IslandCosmetics; saved: IslandCosmetics }) {
    return <span className="island-customization-stage-label" data-testid="island-customization-preview-label">
        <Sparkles size={14} aria-hidden="true" />{sameIslandCosmetics(preview, saved) ? 'いまの しま' : 'おためし'}</span>;
}

export function IslandCustomization({ island, preview, selectedId, celebration, disabled, onSelect, onAction, onClose }: {
    island: IslandRecord; preview: IslandCosmetics; selectedId: IslandCustomizationItemId; celebration?: string; disabled: boolean;
    onSelect: (id: IslandCustomizationItemId) => void; onAction: (action: IslandCustomizationAction) => void; onClose: () => void;
}) {
    const state = getIslandCustomization(island), saved = getIslandCosmetics(island);
    const selected = CUSTOMIZATION_CATALOG.find(item => item.id === selectedId)!;
    const owned = state.ownedItemIds.includes(selectedId);
    const equipped = selected.kind === 'theme' ? saved.themeId === selectedId : saved.accentId === selectedId;
    const desired = state.desiredItemId === selectedId;
    const missing = Math.max(0, selected.price - state.points);
    const sets = (['starry', 'candy', 'crystal'] as const).filter(theme =>
        CUSTOMIZATION_CATALOG.filter(item => item.themeId === theme).every(item => state.ownedItemIds.includes(item.id)));
    return <section className="island-sheet island-customization" data-testid="island-customization" data-selected-item={selectedId}
        data-points={state.points} data-preview={!sameIslandCosmetics(preview, saved)} aria-label="しまの きせかえ">
        <div className="island-customization-heading"><h2>きせかえ</h2><div className="island-customization-wallet" aria-label={`もっている ほし ${state.points}こ`}><small>まなぶと たまる ほし</small><Stars amount={state.points} /></div>
            <button className="island-icon-button" disabled={disabled} aria-label="きせかえを とじる" onClick={onClose}><X size={20} /></button></div>
        <div className="island-customization-rails">{(['theme', 'accent'] as const).map(kind => <div key={kind}>
            <h3>{kind === 'theme' ? 'しまの けしき' : 'ちいさな かざり'}</h3>
            <div className="island-customization-rail" role="group" aria-label={kind === 'theme' ? 'しまの けしきを ためす' : 'かざりを ためす'}>
                {CUSTOMIZATION_CATALOG.filter(item => item.kind === kind).map(item => {
                    const Icon = themeIcons[item.themeId], has = state.ownedItemIds.includes(item.id);
                    return <button key={item.id} className="island-customization-item" data-customization-id={item.id} data-theme={item.themeId}
                        disabled={disabled} aria-pressed={selectedId === item.id} onClick={() => onSelect(item.id)}>
                        <span className={`island-customization-silhouette island-customization-silhouette--${kind}`}><Icon size={29} strokeWidth={1.8} aria-hidden="true" />
                            {kind === 'theme' && <i aria-hidden="true" />}</span><strong>{item.name.split(' ').map((part, index) => <span key={part}>{index > 0 && ' '}{part}</span>)}</strong>
                        <span className="island-customization-item-status">{has ? <><Check size={12} aria-hidden="true" />もっている</> : <Stars amount={item.price} />}</span>
                    </button>;
                })}
            </div></div>)}</div>
        <div className="island-customization-choice" aria-live="polite">
            <div className="island-customization-choice-title"><strong>{selected.name}</strong>
                <span className="island-customization-preview-label">{sameIslandCosmetics(preview, saved) ? 'いまの しま' : 'おためし'}</span></div>
            {celebration && <p key={celebration} className="island-customization-celebration" role="status"><Sparkles size={19} aria-hidden="true" />{celebration}</p>}
            <div className="island-customization-actions">
                {owned ? <button className="island-primary" disabled={disabled || equipped} data-customization-action="equip" onClick={() => onAction({ type: 'equip', itemId: selectedId })}>
                    {equipped ? <><Check size={18} aria-hidden="true" />つかっている</> : 'これを つかう'}</button>
                    : <button className="island-primary" disabled={disabled || missing > 0} data-customization-action="purchase" onClick={() => onAction({ type: 'purchase', itemId: selectedId })}>
                        {missing > 0 ? <>あと <Stars amount={missing} /></> : <><Stars amount={selected.price} />こうかんして つかう</>}</button>}
                {!owned && <button className="island-secondary island-customization-desire" disabled={disabled} aria-pressed={desired}
                    data-customization-action={desired ? 'clear-desire' : 'desire'} onClick={() => onAction(desired ? { type: 'clear-desire' } : { type: 'desire', itemId: selectedId })}>
                    <Heart size={17} fill={desired ? 'currentColor' : 'none'} aria-hidden="true" />{desired ? 'ほしいを やめる' : 'これが ほしい'}</button>}
            </div>
        </div>
        <div className="island-customization-bottom"><button className="island-text-button" data-customization-action="clear-accent" disabled={disabled || !saved.accentId}
            onClick={() => onAction({ type: 'clear-accent' })}>かざりを はずす</button>
            <button className="island-text-button" disabled={disabled} onClick={onClose}>しまへ <ArrowRight size={15} aria-hidden="true" /></button></div>
        {sets.length > 0 && <p className="island-customization-sets" data-testid="island-customization-sets"><Check size={14} aria-hidden="true" />{sets.map(theme => setNames[theme]).join('・')}の セットが そろった</p>}
    </section>;
}

export function IslandCustomizationGoal({ island, disabled, onOpen }: { island: IslandRecord; disabled: boolean; onOpen: () => void }) {
    const state = getIslandCustomization(island), item = CUSTOMIZATION_CATALOG.find(candidate => candidate.id === state.desiredItemId);
    if (!item) return null;
    const Icon = themeIcons[item.themeId], missing = Math.max(0, item.price - state.points);
    return <button className="island-customization-goal" disabled={disabled} onClick={onOpen} data-testid="island-customization-goal">
        <Icon size={23} aria-hidden="true" /><span><strong>{item.name}</strong><small>{missing ? <>あと <Stars amount={missing} /></> : 'こうかん できるよ'}</small></span><ArrowRight size={16} aria-hidden="true" />
    </button>;
}
