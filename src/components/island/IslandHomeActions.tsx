import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowRight, BookOpen, Gamepad2, Gift, House, PackageOpen, Palette, PawPrint, Search, Sparkles, Waves, Menu, X, ChevronDown } from 'lucide-react';
import './IslandHomeActions.css';

export interface IslandHomeActionsProps {
    active?: boolean;
    onHelp?: () => void;
    children?: ReactNode;
    onOpenChange?: (open: boolean) => void;
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
    onOtherGames?: () => void;
}

export function IslandHomeActions({ comparisonDisabled, onOpenChange, active = true, ...contents }: IslandHomeActionsProps) {
    const dialog = useRef<HTMLDialogElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (!active) dialog.current?.close();
    }, [active]);
    useEffect(() => {
        const element = dialog.current;
        return () => { element?.close(); onOpenChange?.(false); };
    }, [onOpenChange]);
    const close = () => { dialog.current?.close(); onOpenChange?.(false); };
    const choose = (action: () => void) => { close(); action(); };
    return <div className="island-home-actions">
        <button ref={trigger} type="button" className="island-menu-trigger" aria-haspopup="dialog" disabled={comparisonDisabled}
            onClick={() => { dialog.current?.showModal(); onOpenChange?.(true); }}><Menu size={21} aria-hidden="true" /><span>しまのメニュー</span></button>
        <dialog ref={dialog} className="island-menu" aria-labelledby="island-menu-title"
            onClose={() => { onOpenChange?.(false); if (active) trigger.current?.focus({ preventScroll: true }); }}
            onClick={event => { if (event.target === event.currentTarget) close(); }}>
            <div className="island-menu-surface">
                <header className="island-menu-heading"><h2 id="island-menu-title">しまのメニュー</h2>
                    <button type="button" className="island-text-button" onClick={close} aria-label="しまのメニューを とじる"><X size={20} />とじる</button></header>
                <IslandHomeMenuContents {...contents} comparisonDisabled={comparisonDisabled} onChoose={choose} />
            </div>
        </dialog>
    </div>;
}

type IslandHomeMenuContentsProps = Omit<IslandHomeActionsProps, 'active' | 'onOpenChange'> & {
    onChoose: (action: () => void) => void;
};

/** The action catalog is independent of the native dialog's focus lifecycle. */
export function IslandHomeMenuContents({ busy, comparisonDisabled, workshopUnlocked, pendingRewards,
    onPlay, onGuide, onWorkshop, onInventory, onCustomization, onExperience, onRewards, onAlbum, onShared, onKeepsakes, onOtherGames, onHelp, children, onChoose }: IslandHomeMenuContentsProps) {
    const actions = [
        { id: 'play', label: 'あそぶ', name: 'どうぶつと あそぶ', Icon: PawPrint, onClick: onPlay, disabled: busy },
        { id: 'guide', label: 'みつける', name: 'みつける', Icon: Search, onClick: onGuide, disabled: comparisonDisabled },
        ...(workshopUnlocked ? [{ id: 'workshop', label: 'つくる', name: 'おためしの いりえ', Icon: Waves, onClick: onWorkshop, disabled: busy }] : []),
        ...(onOtherGames ? [{ id: 'other-games', label: 'ほかの あそび', name: 'ほかの あそび', Icon: Gamepad2, onClick: onOtherGames, disabled: busy }] : []),
        { id: 'inventory', label: 'もちものを おく', name: 'もちものを おく', Icon: PackageOpen, onClick: onInventory, disabled: busy },
        { id: 'customization', label: 'しまの きせかえ', name: 'しまの きせかえ', Icon: Sparkles, onClick: onCustomization, disabled: busy },
        { id: 'experience', label: 'なまえ・けしき', name: 'なまえ・けしき', Icon: Palette, onClick: onExperience, disabled: busy },
    ];
    return <div className="island-menu-scroll">
        {pendingRewards > 0 && <button className="island-secondary island-home-arrival" disabled={busy} onClick={() => onChoose(onRewards)} data-home-action="rewards">
            <span className="island-home-arrival-icon" aria-hidden="true"><Gift size={25} /></span>
            <span>おくりものを えらぶ<small>{pendingRewards}こ とどいているよ</small></span>
            <ArrowRight size={19} aria-hidden="true" />
        </button>}
        <section aria-label="しまを たのしむ"><div className="island-home-action-grid">
            {actions.filter(action => ['play', 'guide'].includes(action.id)).map(({ id, label, name, Icon, onClick, disabled }) => <button key={id}
                className={`island-secondary island-home-tile${id === 'play' ? ' island-play-entry' : ''}`}
                data-home-action={id} aria-label={name} disabled={disabled} onClick={() => onChoose(onClick)}>
                <span className="island-home-action-patch" aria-hidden="true"><Icon size={25} /></span><span>{label}</span>
            </button>)}
        </div></section>
        <details className="island-menu-group" data-home-group="arrange">
            <summary><Palette size={22} aria-hidden="true" /><span>しまを ととのえる<small>もちもの・きせかえ・育てる ばしょ</small></span><ChevronDown size={18} aria-hidden="true" /></summary>
            <div className="island-home-action-grid">{actions.filter(action => ['inventory', 'customization', 'experience'].includes(action.id)).map(({ id, label, name, Icon, onClick, disabled }) => <button key={id}
                className="island-secondary island-home-tile" data-home-action={id} aria-label={name} disabled={disabled} onClick={() => onChoose(onClick)}>
                <span className="island-home-action-patch" aria-hidden="true"><Icon size={25} /></span><span>{label}</span>
            </button>)}</div>
            {children}
        </details>
        {onKeepsakes ? <button className="island-secondary island-home-record island-home-house" disabled={comparisonDisabled} onClick={() => onChoose(onKeepsakes)} data-home-action="keepsakes">
            <House size={22} aria-hidden="true" /><span>いえで おもいでを みる<small>しゃしん・アルバム・まなびの きねん</small></span><ArrowRight size={18} aria-hidden="true" />
        </button> : <div className="island-home-records">
            <button className="island-secondary island-home-record" disabled={comparisonDisabled} onClick={() => onChoose(onAlbum)} data-home-action="album"><BookOpen size={19} aria-hidden="true" />アルバム</button>
            {workshopUnlocked && <button className="island-secondary island-home-record" disabled={busy} onClick={() => onChoose(onShared)} data-home-action="shared"><PackageOpen size={19} aria-hidden="true" />かざりと きおく</button>}
        </div>}
        {(workshopUnlocked || onOtherGames) && <details className="island-menu-group" data-home-group="more-play">
            <summary><Gamepad2 size={22} aria-hidden="true" /><span>もっと あそぶ</span><ChevronDown size={18} aria-hidden="true" /></summary>
            <div className="island-home-action-grid">{actions.filter(action => ['workshop', 'other-games'].includes(action.id)).map(({ id, label, name, Icon, onClick, disabled }) => <button key={id}
                className="island-secondary island-home-tile" data-home-action={id} aria-label={name} disabled={disabled} onClick={() => onChoose(onClick)}>
                <span className="island-home-action-patch" aria-hidden="true"><Icon size={25} /></span><span>{label}</span>
            </button>)}</div>
        </details>}
        {onHelp && <button className="island-secondary island-home-record" disabled={comparisonDisabled} onClick={() => onChoose(onHelp)} data-home-action="help"><BookOpen size={19} aria-hidden="true" />あそびかた</button>}
    </div>;
}
