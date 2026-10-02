import { useEffect, useRef } from 'react';
import { Archive, BookOpen, Camera, ChevronDown, Flower2, House, PawPrint, Pencil, RotateCcw, RotateCw, Settings2, Sprout, X } from 'lucide-react';
import type { Side, Villager } from '../../../domain/growingIsland/types';
import { villagerName } from './growingCopy';
import type { MenuPictures } from './menuMiniatures';
import './growingIslandMenu.css';

export interface GrowingIslandMenuProps {
    villagers: Villager[];
    faces: Record<string, string>;
    pictures?: MenuPictures;
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
    const { villagers, quote, pictures } = props;
    return <div className="growing-pocket-entries">
        <div className="growing-pocket-primary">
            <button className="growing-pocket-friends" aria-label="なかま" aria-describedby="growing-menu-population" onClick={props.onFriends}>
                <span className="growing-pocket-model" aria-hidden="true">
                    {pictures?.friends && villagers.length ? <img src={pictures.friends} alt="" /> : <PawPrint size={48} strokeWidth={1.5} />}
                </span>
                <span className="growing-pocket-main-copy"><strong>{villagers.length ? 'なかまに あう' : 'なかま'}</strong><small id="growing-menu-population">{villagers.length}にん<span className="growing-pocket-names"> · {villagers.length ? villagers.slice(0, 2).map(villagerName).join('・') : 'これからの なかま'}</span></small></span>
            </button>
            <button className="growing-pocket-seeds" aria-label="たね" onClick={props.onSeeds}>
                <span className="growing-pocket-model" aria-hidden="true">{pictures?.seeds ? <img src={pictures.seeds} alt="" /> : <Sprout size={48} strokeWidth={1.5} />}</span>
                <span className="growing-pocket-main-copy"><strong>たねを おく</strong><small>すきな ばしょに</small></span>
            </button>
        </div>
        <div className="growing-pocket-shortcuts">
            <button onClick={props.onHome}><House size={21} aria-hidden="true" /><span>いえ</span></button>
            <button onClick={props.onStored}><Archive size={21} aria-hidden="true" /><span>もちもの</span></button>
            <button onClick={props.onTrace}><Pencil size={21} aria-hidden="true" /><span>なぞる</span></button>
        </div>
        <div className="growing-pocket-memories">
            <button onClick={props.onShow}><Camera size={20} aria-hidden="true" /><span>みせる</span></button>
            <button onClick={props.onFlowers}><Flower2 size={20} aria-hidden="true" /><span>はなずかん</span></button>
        </div>
        <div className="growing-pocket-footer">
            <button className="growing-pocket-guide" aria-label="しまの あそびかた" onClick={props.onGuide}><BookOpen size={20} aria-hidden="true" /><span>あそびかた</span></button>
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
        </div>
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
    return <section className="growing-menu growing-pocket-menu" aria-label="メニュー" data-menu-candidate="island-play-diorama-v3">
        <header className="growing-pocket-heading"><h2>しまのメニュー</h2><button ref={close} className="growing-close" aria-label="メニューを とじる" onClick={props.onClose}><X size={20} aria-hidden="true" /></button></header>
        <GrowingIslandMenuContents {...props} />
    </section>;
}
