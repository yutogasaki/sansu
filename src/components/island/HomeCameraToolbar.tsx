import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Maximize, RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { HOME_MAX_ZOOM, HOME_MIN_ZOOM, type HomeCameraAction, type HomeCameraView } from './three/homeCameraControls';
import './HomeCameraToolbar.css';

export function HomeCameraToolbar({ view, onAction }: { view: HomeCameraView; onAction: (action: HomeCameraAction) => void }) {
    const [open, setOpen] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const root = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const escape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus({ preventScroll: true });
        };
        const outside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
        document.addEventListener('keydown', escape); document.addEventListener('pointerdown', outside);
        return () => { document.removeEventListener('keydown', escape); document.removeEventListener('pointerdown', outside); };
    }, [open]);
    const close = () => { setOpen(false); trigger.current?.focus({ preventScroll: true }); };
    const moves = [
        ['left', 'ひだりを みる', ArrowLeft], ['up', 'うえを みる', ArrowUp],
        ['down', 'したを みる', ArrowDown], ['right', 'みぎを みる', ArrowRight],
        ['turn-left', 'ひだりに まわす', RotateCcw], ['turn-right', 'みぎに まわす', RotateCw],
        ['out', 'ひろく みる', ZoomOut], ['in', 'ちかくで みる', ZoomIn],
    ] as const;
    return <div ref={root} className="home-camera-tools">
        <button ref={trigger} type="button" className="home-camera-trigger" aria-expanded={open} onClick={() => setOpen(!open)}><Maximize size={18} aria-hidden="true" />ながめ</button>
        {open ? <section className="home-camera-panel" aria-label="いえの ながめ">
            <header><strong>いえを みまわす</strong><button type="button" aria-label="ながめを とじる" onClick={close}>×</button></header>
            <div className="home-camera-actions">
                {moves.map(([action, label, Icon]) => <button type="button" key={action} aria-label={label} title={label}
                    disabled={action === 'in' && view.zoom >= HOME_MAX_ZOOM || action === 'out' && view.zoom <= HOME_MIN_ZOOM} onClick={() => onAction(action)}><Icon size={22} aria-hidden="true" /></button>)}
            </div>
            <button type="button" className="home-camera-reset" onClick={() => onAction('reset')}>もとの ながめ</button>
            <p>なぞって 移動<br />2本指で 拡大・回転<br />さわると 本や かざりが ひらくよ</p>
        </section> : view.manual && <button type="button" className="home-camera-reset home-camera-return" onClick={() => onAction('reset')}>もとの ながめ</button>}
    </div>;
}
