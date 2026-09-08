import { ArrowRight, Check, PackageOpen, PawPrint, Star, X } from 'lucide-react';
import { ISLAND_FURNITURE_CATALOG, getOwnedIslandFurniture, quoteIslandFurniture, type IslandOptionalFurnitureKind } from '../../domain/island/furniture';
import type { IslandResidentId } from '../../domain/island/experience';
import type { IslandItem, IslandRecord } from '../../domain/island/types';
import { ItemPicture } from './IslandItems';
import { IslandRewardGoalChoice, IslandRewardGoalFeedback, type IslandRewardGoalControls } from './IslandRewardGoal';
import './IslandFurniture.css';
import './IslandPanel.css';

interface ResidentChoice { id: IslandResidentId; name: string }
export function IslandFurniture({ island, kind, trial, residents, residentId, partnerId, disabled, pending, error, feedback, rewardGoal,
    onSelect, onResident, onPartner, onTry, onPurchase, onPlace, onInventory, onRetry, onClose, onLearn }: {
    island: IslandRecord; kind: IslandOptionalFurnitureKind; trial?: IslandItem; residents: ResidentChoice[];
    residentId: IslandResidentId; partnerId: IslandResidentId; disabled: boolean; pending: boolean; error?: string; feedback?: string;
    rewardGoal?: IslandRewardGoalControls;
    onSelect: (kind: IslandOptionalFurnitureKind) => void; onResident: (id: IslandResidentId) => void; onPartner: (id: IslandResidentId) => void;
    onTry: () => void; onPurchase: () => void; onPlace: (item: IslandItem) => void; onInventory: () => void;
    onRetry?: () => void; onClose: () => void; onLearn: () => void;
}) {
    const definition = ISLAND_FURNITURE_CATALOG.find(item => item.kind === kind)!;
    const owned = getOwnedIslandFurniture(island, kind), quote = quoteIslandFurniture(island, kind);
    const canTry = Boolean((owned?.position || trial?.position) && residents.some(resident => resident.id === residentId)
        && (kind !== 'tea-table' || partnerId !== residentId && residents.some(resident => resident.id === partnerId)));
    return <section className="island-sheet island-panel island-furniture-shop" aria-label="くらしの どうぐ" data-furniture-kind={kind}>
        <div className="island-sheet-title"><div><p className="island-eyebrow">なかまと すごす ばしょ</p><h2>くらしの どうぐ</h2></div>
            <button className="island-icon-button island-panel-back" aria-label="どうぐを とじる" onClick={onClose} disabled={disabled}><X size={20} /><span>もどる</span></button></div>
        <p className="island-furniture-wallet"><Star size={18} aria-hidden="true" /><strong>{quote.points}</strong><span>まなぶと たまる ほし</span></p>
        <div className="island-furniture-choices island-panel-choices" role="group" aria-label="どうぐを えらぶ">{ISLAND_FURNITURE_CATALOG.map(item => {
            const has = Boolean(getOwnedIslandFurniture(island, item.kind));
            return <button key={item.kind} className="island-reward" disabled={disabled || pending} aria-pressed={kind === item.kind}
                data-furniture-choice={item.kind} onClick={() => onSelect(item.kind)}>
                <ItemPicture kind={item.kind} /><strong>{item.name}</strong><small>{has ? <><Check size={14} />もっている</> : `${item.price} ほし`}</small>
            </button>;
        })}</div>
        <div className="island-furniture-detail"><h3>{definition.name}</h3><p>{definition.description}</p></div>
        <fieldset className="island-furniture-residents"><legend>だれと ためす？</legend><div className="island-panel-choices">{residents.map(resident => <button key={resident.id}
            className="island-secondary" disabled={disabled || pending} aria-pressed={resident.id === residentId}
            data-furniture-resident={resident.id} onClick={() => onResident(resident.id)}>{resident.name}</button>)}</div></fieldset>
        {kind === 'tea-table' && <fieldset className="island-furniture-residents"><legend>おちゃの おともだち</legend><div className="island-panel-choices">{residents.filter(resident => resident.id !== residentId).map(resident => <button key={resident.id}
            className="island-secondary" disabled={disabled || pending} aria-pressed={resident.id === partnerId}
            data-furniture-partner={resident.id} onClick={() => onPartner(resident.id)}>{resident.name}</button>)}</div></fieldset>}
        <div className="island-furniture-preview-actions">
            <button className="island-secondary" disabled={disabled || pending || !canTry} onClick={onTry}><PawPrint size={18} />{owned ? 'ここで ためす' : 'つかう ところを ためす'}</button>
            {!owned && <span>おためしは むりょう</span>}
        </div>
        {!canTry && <p className="island-note">{owned && !owned.position ? 'しまに おくと、なかまと ためせるよ。' : 'すこし ひろい ばしょを あけて ためそう。'}</p>}
        {feedback && <p className="island-play-message" role="status">{feedback}</p>}
        {error && <div className="island-error" role="alert"><p>{error}</p>{onRetry && <button className="island-secondary" disabled={disabled} onClick={onRetry}>むかえた どうぐを たしかめる</button>}</div>}
        <IslandRewardGoalFeedback controls={rewardGoal} disabled={disabled} />
        {rewardGoal && <IslandRewardGoalChoice island={island} target={{ category: 'furniture', kind }} disabled={disabled || pending} controls={rewardGoal} />}
        {!pending && (owned ? <button className="island-primary" disabled={disabled} onClick={() => onPlace(owned)}>
            <PackageOpen size={18} />{owned.position ? 'おく ばしょを かえる' : 'おく ばしょを えらぶ'}</button>
            : <><p className="island-furniture-price">{quote.missingStars > 0 ? `あと ${quote.missingStars} ほし` : `${quote.price} ほしで むかえられるよ`}</p>
                <button className="island-primary" disabled={disabled || quote.missingStars > 0} onClick={onPurchase}><Star size={18} />{quote.price}ほしで むかえる</button>
                <p className="island-note">むかえた あと、すきな ばしょに おけるよ。</p></>)}
        <div className="island-furniture-footer island-panel-footer"><button className="island-text-button" disabled={disabled} onClick={onInventory}>もちものを うごかす</button>
            <button className="island-secondary" disabled={disabled} onClick={onLearn}>まなぶ <ArrowRight size={18} /></button></div>
    </section>;
}
