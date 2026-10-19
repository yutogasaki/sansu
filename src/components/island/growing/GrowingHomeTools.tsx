import { useEffect, useRef, type RefObject } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ChevronRight, Ellipsis, Maximize2, RotateCcw, RotateCw, Telescope, Scan, ZoomIn, X } from 'lucide-react';
import type { Side } from '../../../domain/growingIsland/types';
import type { PlaceStatus } from '../../../domain/growingIsland/placeTypes';
import { IslandToyIcon } from '../IslandToyIcon';
import { GrowingPlaceArt } from './GrowingPlaceBook';

type Quote = { sides: Side[]; price: number };
interface HomeToolsProps {
    islandName: string; drops: number; quote?: Quote; status?: PlaceStatus;
    visible: boolean; goalVisible: boolean; menuOpen: boolean;
    menuRef: RefObject<HTMLButtonElement | null>;
    onName: () => void; onView: () => void; onExpand: () => void;
    onPlace: () => void; onStored: () => void; onMenu: () => void; onGoal: () => void;
}

/** The world is the play area; these tools never start learning or spend resources. */
export function GrowingHomeTools({ menuRef, ...p }: HomeToolsProps) {
    return <>
        {p.visible && <div className="growing-home-heading">
            <div className="growing-home-identity"><button aria-label={`しまの なまえ：${p.islandName}`} onClick={p.onName}>{p.islandName}</button><span aria-label={`しずく ${p.drops}`}><span aria-hidden="true">💧</span>{p.drops}</span></div>
            <button className="growing-home-view" aria-label="ながめ" onClick={p.onView}><Telescope size={21} aria-hidden="true" /><span>ながめ</span></button>
        </div>}
        {p.visible && p.goalVisible && <button className="growing-place-current growing-home-goal" aria-label={p.status ? `${p.status.name}の ヒント` : 'そだつ場所'} onClick={p.onGoal}>
            <GrowingPlaceArt id={p.status?.id ?? 'P01'} /><span><strong>{p.status?.name ?? 'そだつ場所'}</strong><small>{!p.status ? 'どんな 場所に しよう？' : p.status.stage === 'grown' || p.status.stage === 'lived' ? 'ここで あそぼう' : p.status.hint}</small></span><ChevronRight size={17} aria-hidden="true" />
        </button>}
        {p.visible && p.goalVisible && p.quote && <button className="growing-home-expand" aria-label="しまを ひろげる" onClick={p.onExpand} data-affordable={p.drops >= p.quote.price}>
            <Maximize2 size={20} aria-hidden="true" /><span><strong>{p.drops >= p.quote.price ? 'ひろげられるよ' : 'ひろげる'}</strong><small>💧 {p.quote.price}</small></span>
        </button>}
        {(p.visible || p.menuOpen) && <div className="growing-home-tools" role="toolbar" aria-label="しまの あそび">
            {!p.menuOpen && <><button className="growing-home-place" aria-label="しまに おく" onClick={p.onPlace}><IslandToyIcon kind="house" size={34} /><span>おく</span></button>
                <button className="growing-home-stored" aria-label="もちもの" onClick={p.onStored}><IslandToyIcon kind="box" size={32} /><span>もちもの</span></button></>}
            <button ref={menuRef} className="growing-menu-button" aria-label="しまのメニュー" aria-expanded={p.menuOpen} onClick={p.onMenu}><Ellipsis size={25} aria-hidden="true" /><span>メニュー</span></button>
        </div>}
    </>;
}

function usePanelExit(onClose: () => void) {
    const close = useRef<HTMLButtonElement>(null);
    useEffect(() => { close.current?.focus({ preventScroll: true }); }, []);
    useEffect(() => {
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); onClose(); } };
        window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape);
    }, [onClose]);
    return close;
}

export function GrowingViewControls({ onClose, onRotate, onDistance }: { onClose: () => void; onRotate: (direction: -1 | 1) => void; onDistance: (close: boolean) => void }) {
    const close = usePanelExit(onClose);
    return <section className="growing-home-view-panel" aria-label="ながめ">
        <header><h2>ながめ</h2><button ref={close} className="growing-close" aria-label="ながめを とじる" onClick={onClose}><X size={20} aria-hidden="true" /></button></header>
        <div><button onClick={() => onDistance(true)}><ZoomIn size={22} aria-hidden="true" />ちかくで みる</button><button onClick={() => onDistance(false)}><Scan size={22} aria-hidden="true" />しま全体</button></div>
        <div><button aria-label="ひだりに まわす" onClick={() => onRotate(-1)}><RotateCcw size={22} aria-hidden="true" />ひだり</button><button aria-label="みぎに まわす" onClick={() => onRotate(1)}><RotateCw size={22} aria-hidden="true" />みぎ</button></div>
    </section>;
}

export function GrowingExpansion({ quote, drops, busy, onClose, onExpand }: { quote?: Quote; drops: number; busy: boolean; onClose: () => void; onExpand: (side: Side) => void }) {
    const close = usePanelExit(onClose);
    return <section className="growing-tray growing-expansion" aria-label="しまを ひろげる">
        <header><div><h2>どちらへ ひろげる？</h2><p>いまの しまの となりに 土地が ふえるよ</p></div><button ref={close} className="growing-close" aria-label="ひろげるを とじる" onClick={onClose}><X size={20} aria-hidden="true" /></button></header>
        <div className="growing-expansion-choices" data-sides={quote?.sides.length}>{quote?.sides.map(side => <button key={side} disabled={busy || drops < quote.price} onClick={() => onExpand(side)}>
            {side === 'east' ? <ArrowRight aria-hidden="true" /> : side === 'west' ? <ArrowLeft aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}<strong>{side === 'east' ? 'ひがし' : side === 'west' ? 'にし' : 'みなみ'}へ ひろげる</strong><span>💧 {quote.price}</span>
        </button>)}</div>
        {quote && <p className="growing-expansion-balance">いまの しずく：{drops}{drops < quote.price && ` ／ ひろげるには ${quote.price}`}</p>}
    </section>;
}
