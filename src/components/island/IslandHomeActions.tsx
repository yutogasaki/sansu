import { ArrowRight, BookOpen, Gift, House, PackageOpen, Palette, PawPrint, Search, Sparkles, Waves } from 'lucide-react';
import './IslandHomeActions.css';

export interface IslandHomeActionsProps {
    busy: boolean;
    comparisonDisabled: boolean;
    workshopUnlocked: boolean;
    pendingRewards: number;
    onPlay: () => void;
    onGuide: () => void;
    onWorkshop: () => void;
    onInventory: () => void;
    onCustomization: () => void;
    onExperience: () => void;
    onRewards: () => void;
    onAlbum: () => void;
    onShared: () => void;
    onKeepsakes?: () => void;
}

export function IslandHomeActions({ busy, comparisonDisabled, workshopUnlocked, pendingRewards,
    onPlay, onGuide, onWorkshop, onInventory, onCustomization, onExperience, onRewards, onAlbum, onShared, onKeepsakes }: IslandHomeActionsProps) {
    const actions = [
        { id: 'play', label: 'あそぶ', name: 'どうぶつと あそぶ', Icon: PawPrint, onClick: onPlay, disabled: busy },
        { id: 'guide', label: 'みつける', name: 'みつける', Icon: Search, onClick: onGuide, disabled: comparisonDisabled },
        ...(workshopUnlocked ? [{ id: 'workshop', label: 'つくる', name: 'おためしの いりえ', Icon: Waves, onClick: onWorkshop, disabled: busy }] : []),
        { id: 'inventory', label: 'もちもの', name: 'もちもの', Icon: PackageOpen, onClick: onInventory, disabled: busy },
        { id: 'customization', label: 'きせかえ', name: 'きせかえ', Icon: Sparkles, onClick: onCustomization, disabled: busy },
        { id: 'experience', label: 'しまづくり', name: 'しまづくり', Icon: Palette, onClick: onExperience, disabled: busy },
    ];
    return <div className="island-home-secondary island-home-actions">
        {pendingRewards > 0 && <button className="island-secondary island-home-arrival" disabled={busy} onClick={onRewards} data-home-action="rewards">
            <span className="island-home-arrival-icon" aria-hidden="true"><Gift size={25} /></span>
            <span>おくりものを えらぶ<small>{pendingRewards}こ とどいているよ</small></span>
            <ArrowRight size={19} aria-hidden="true" />
        </button>}
        <div className="island-home-action-grid">
            {actions.map(({ id, label, name, Icon, onClick, disabled }) => <button key={id}
                className={`island-secondary island-home-tile${id === 'play' ? ' island-play-entry' : ''}`}
                data-home-action={id} aria-label={name} disabled={disabled} onClick={onClick}>
                <span className="island-home-action-patch" aria-hidden="true"><Icon size={25} strokeWidth={2.2} /></span>
                <span>{label}</span>
            </button>)}
        </div>
        <div className="island-home-records">
            {onKeepsakes && <button className="island-secondary island-home-record" disabled={busy} onClick={onKeepsakes} data-home-action="keepsakes">
                <House size={19} aria-hidden="true" />いえ
            </button>}
            <button className="island-secondary island-home-record" disabled={comparisonDisabled} onClick={onAlbum} data-home-action="album">
                <BookOpen size={19} aria-hidden="true" />アルバム
            </button>
            {workshopUnlocked && <button className="island-secondary island-home-record" disabled={busy} onClick={onShared} data-home-action="shared">
                <PackageOpen size={19} aria-hidden="true" />かざりと きおく
            </button>}
        </div>
    </div>;
}
