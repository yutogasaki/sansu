import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, RotateCcw, RotateCw, Settings2, X } from 'lucide-react';
import type { Side, Villager } from '../../../domain/growingIsland/types';
import { IslandToyIcon } from '../IslandToyIcon';
import { villagerName } from './growingCopy';
import './growingIslandMenu.css';

export interface GrowingIslandMenuProps {
    villagers: Villager[];
    faces: Record<string, string>;
    drops: number;
    busy: boolean;
    quote?: { sides: Side[]; price: number };
    onClose: () => void;
    onFriends: () => void;
    onSeeds: () => void;
    onTrace: () => void;
    onStored: () => void;
    onHome: () => void;
    onShow: () => void;
    onFlowers: () => void;
    onGuide: () => void;
    onSettings: () => void;
    onRotate: (direction: -1 | 1) => void;
    onExpand: (side: Side) => void;
}

/** A small, optional paper beside the live island; every entry opens its real destination. */
export function GrowingIslandMenuContents(props: GrowingIslandMenuProps) {
    const { villagers, faces, quote } = props;
    const entries = [
        { label: 'たね', icon: 'island', action: props.onSeeds },
        { label: 'なぞる', icon: 'palette', action: props.onTrace },
        { label: 'もちもの', icon: 'box', action: props.onStored },
        { label: 'いえ', icon: 'house', action: props.onHome },
        { label: 'みせる', icon: 'camera', action: props.onShow },
        { label: 'はなずかん', icon: 'display', action: props.onFlowers },
    ] as const;
    return <div className="growing-pocket-entries">
        <button className="growing-pocket-friends" aria-label="なかま" onClick={props.onFriends}>
            <span className="growing-pocket-faces" aria-hidden="true">
                {villagers.length ? villagers.slice(0, 3).map(v => <span key={v.id}>
                    {faces[v.id] ? <img src={faces[v.id]} alt="" /> : <span>{villagerName(v).slice(0, 1)}</span>}
                </span>) : <IslandToyIcon kind="play" size={36} />}
            </span>
            <span><strong>なかま <small>{villagers.length}にん</small></strong><span className="growing-pocket-note">{villagers.length ? 'みんなの かおを みる' : 'これからの なかま'}</span></span>
            <ChevronRight className="growing-pocket-arrow" size={18} aria-hidden="true" />
        </button>
        {entries.map(entry => <button key={entry.label} className="growing-pocket-action" onClick={entry.action}>
            <IslandToyIcon kind={entry.icon} size={28} /><span>{entry.label}</span>
        </button>)}
        <button className="growing-pocket-guide" aria-label="しまの あそびかた" onClick={props.onGuide}>
            <IslandToyIcon kind="book" size={28} /><span>あそびかた</span><ChevronRight className="growing-pocket-arrow" size={18} aria-hidden="true" />
        </button>
        <details className="growing-pocket-tools" onToggle={event => {
            if (event.currentTarget.open) event.currentTarget.querySelector('.growing-pocket-tool-buttons')?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        }}>
            <summary><span>しまの そうさ</span><ChevronDown size={18} aria-hidden="true" /></summary>
            <div className="growing-pocket-tool-buttons">
                <button aria-label="ひだりに まわす" onClick={() => props.onRotate(-1)}><RotateCcw size={18} aria-hidden="true" /><span>ひだり</span></button>
                <button aria-label="みぎに まわす" onClick={() => props.onRotate(1)}><RotateCw size={18} aria-hidden="true" /><span>みぎ</span></button>
                <button onClick={props.onSettings}><Settings2 size={18} aria-hidden="true" /><span>せってい</span></button>
            </div>
            {quote && <div className="growing-pocket-expansion" aria-label="しまを ひろげる">
                {quote.sides.map(side => <button key={side} disabled={props.busy || props.drops < quote.price} onClick={() => props.onExpand(side)}>
                    <span>{side === 'east' ? 'ひがし' : side === 'west' ? 'にし' : 'みなみ'}へ ひろげる</span><small>💧 {quote.price}</small>
                </button>)}
            </div>}
        </details>
    </div>;
}

export function GrowingIslandMenu(props: GrowingIslandMenuProps) {
    const { onClose } = props;
    const close = useRef<HTMLButtonElement>(null);
    useEffect(() => { close.current?.focus({ preventScroll: true }); }, []);
    useEffect(() => {
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } };
        window.addEventListener('keydown', escape);
        return () => window.removeEventListener('keydown', escape);
    }, [onClose]);
    return <section className="growing-menu growing-pocket-menu" aria-label="メニュー" data-menu-candidate="island-pocket-v2">
        <header className="growing-pocket-heading"><h2>しまのメニュー</h2><button ref={close} className="growing-close" aria-label="メニューを とじる" onClick={props.onClose}><X size={20} aria-hidden="true" /></button></header>
        <GrowingIslandMenuContents {...props} />
    </section>;
}
