import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import { IslandToyIcon } from './IslandToyIcon';
import './IslandHouseMenu.css';

interface Props {
    active: boolean;
    disabled: boolean;
    comparisonDisabled: boolean;
    walkingAvailable: boolean;
    onAlbum?: () => void;
    onPhotos?: () => void;
    children: (choose: (action: () => void, destinationFocus?: boolean) => void) => ReactNode;
}

/** Keep the room open; secondary destinations share the island's optional sheet. */
export function IslandHouseOverview({ active, disabled, comparisonDisabled, walkingAvailable, onAlbum, onPhotos, children }: Props) {
    const dialog = useRef<HTMLDialogElement>(null);
    const destinationOwnsFocus = useRef(false);
    const title = useRef<HTMLHeadingElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const [memory] = useState(() => ({ scroll: 0, focus: null as HTMLElement | null, content: null as HTMLDivElement | null }));
    const [open, setOpen] = useState(false);
    const controls = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const page = controls.current?.closest<HTMLElement>('.island-page');
        const header = page?.querySelector<HTMLElement>(':scope > .island-header');
        const toolbar = controls.current;
        if (!page || !header || !toolbar || typeof ResizeObserver === 'undefined') return;
        const measure = () => {
            page.style.setProperty('--house-header-height', `${header.getBoundingClientRect().height}px`);
            page.style.setProperty('--house-controls-height', `${toolbar.getBoundingClientRect().height + 24}px`);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(header); observer.observe(toolbar);
        return () => { observer.disconnect(); page.style.removeProperty('--house-header-height'); page.style.removeProperty('--house-controls-height'); };
    }, []);
    useEffect(() => {
        if (active && open) {
            dialog.current?.showModal();
            if (memory.content) memory.content.scrollTop = memory.scroll;
            const previous = memory.focus;
            const valid = previous?.isConnected && memory.content?.contains(previous) && previous.checkVisibility() && !previous.matches(':disabled, [aria-disabled=true]') && !previous.closest('[inert]');
            (valid ? previous : title.current)?.focus({ preventScroll: true });
        }
        else dialog.current?.close();
    }, [active, open, memory]);
    const close = useCallback((destination = false) => {
        destinationOwnsFocus.current = destination;
        memory.scroll = memory.content?.scrollTop ?? 0;
        const focus = document.activeElement;
        if (focus instanceof HTMLElement && memory.content?.contains(focus)) memory.focus = focus;
        setOpen(false);
    }, [memory]);
    const choose = useCallback((action: () => void, destinationFocus = true) => { close(destinationFocus); action(); }, [close]);
    return <div className="island-house-overview">
        <div ref={controls} className="island-house-controls">
        <p className="island-house-hint">{walkingAvailable ? <>ゆかで あるく。<span className="island-house-hint-desk">つくえの </span>カードで まなぶ</> : 'おもいでを ひらく。きねんを かざる。'}</p>
        <nav className="island-house-tools" aria-label="いえで できること">
            {onAlbum && <button type="button" data-keepsake-action="album" disabled={comparisonDisabled} onClick={onAlbum}>
                <IslandToyIcon kind="album" /><span>アルバム</span></button>}
            {onPhotos && <button type="button" data-keepsake-action="photos" disabled={disabled} onClick={onPhotos}>
                <IslandToyIcon kind="camera" /><span>しゃしん</span></button>}
            <button ref={trigger} type="button" data-house-menu-trigger aria-haspopup="dialog" aria-expanded={open} aria-label="いえの メニュー" disabled={comparisonDisabled}
                onClick={() => setOpen(true)}><Menu size={28} aria-hidden="true" /><span>メニュー</span></button>
        </nav>
        </div>
        <dialog ref={dialog} className="island-menu island-house-menu" aria-labelledby="island-house-menu-title" data-house-menu-candidate="house-paper-atelier-v1"
            onCancel={event => { event.preventDefault(); close(); }}
            onClose={() => {
                if (dialog.current?.open) return;
                setOpen(false);
                if (!destinationOwnsFocus.current && active && trigger.current?.checkVisibility() && !trigger.current.disabled) trigger.current.focus({ preventScroll: true });
                destinationOwnsFocus.current = false;
            }}
            onClick={event => { if (event.target === event.currentTarget) close(); }}>
            <div className="island-menu-surface">
                <header className="island-menu-heading"><div className="island-house-menu-title"><span className="island-house-menu-patch"><IslandToyIcon kind="house" size={34} /></span><div><h2 ref={title} tabIndex={-1} id="island-house-menu-title">いえの メニュー</h2><p>たからものと、くらしの こと。</p></div></div>
                    <button type="button" className="island-text-button" onClick={() => close()} aria-label="いえの メニューを とじる"><X size={20} aria-hidden="true" />とじる</button></header>
                <div ref={element => { memory.content = element; }} className="island-menu-scroll island-house-menu-content">
                    <p className="island-house-menu-hint">ゆかで あるく。つくえの カードで まなぶ</p>{children(choose)}</div>
            </div>
        </dialog>
    </div>;
}
