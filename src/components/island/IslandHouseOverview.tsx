import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import { IslandToyIcon } from './IslandToyIcon';

interface Props {
    active: boolean;
    disabled: boolean;
    comparisonDisabled: boolean;
    walkingAvailable: boolean;
    onAlbum?: () => void;
    onPhotos?: () => void;
    children: (choose: (action: () => void) => void) => ReactNode;
}

/** Keep the room open; secondary destinations share the island's optional sheet. */
export function IslandHouseOverview({ active, disabled, comparisonDisabled, walkingAvailable, onAlbum, onPhotos, children }: Props) {
    const dialog = useRef<HTMLDialogElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    useEffect(() => {
        if (active && open) dialog.current?.showModal();
        else dialog.current?.close();
    }, [active, open]);
    const close = () => setOpen(false);
    const choose = (action: () => void) => { close(); action(); };
    return <div className="island-house-overview">
        <p className="island-house-hint">{walkingAvailable ? 'ゆかを タップすると カワウソが あるくよ。' : 'おもいでを ひらく。きねんを かざる。'}</p>
        <nav className="island-house-tools" aria-label="いえで できること">
            {onAlbum && <button type="button" data-keepsake-action="album" disabled={comparisonDisabled} onClick={onAlbum}>
                <IslandToyIcon kind="album" /><span>アルバム</span></button>}
            {onPhotos && <button type="button" data-keepsake-action="photos" disabled={disabled} onClick={onPhotos}>
                <IslandToyIcon kind="camera" /><span>しゃしん</span></button>}
            <button ref={trigger} type="button" data-house-menu-trigger aria-haspopup="dialog" aria-expanded={open} aria-label="いえの メニュー" disabled={comparisonDisabled}
                onClick={() => setOpen(true)}><Menu size={28} aria-hidden="true" /><span>メニュー</span></button>
        </nav>
        <dialog ref={dialog} className="island-menu island-house-menu" aria-labelledby="island-house-menu-title"
            onClose={() => { setOpen(false); if (active) trigger.current?.focus({ preventScroll: true }); }}
            onClick={event => { if (event.target === event.currentTarget) close(); }}>
            <div className="island-menu-surface">
                <header className="island-menu-heading"><h2 id="island-house-menu-title">いえの メニュー</h2>
                    <button type="button" className="island-text-button" onClick={close} aria-label="いえの メニューを とじる"><X size={20} aria-hidden="true" />とじる</button></header>
                <div className="island-menu-scroll">{children(choose)}</div>
            </div>
        </dialog>
    </div>;
}
