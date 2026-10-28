import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Mountain, Redo2, Undo2, Waves, X, ZoomIn, Scan, Minus, Square, Grid2x2 } from 'lucide-react';
import type { Cell } from '../../../domain/growingIsland/types';
import './growingTerrain.css';

type Brush = 'up' | 'flat' | 'sea';
const BRUSHES: { id: Brush; label: string; icon: typeof Mountain }[] = [
    { id: 'up', label: 'おか', icon: Mountain }, { id: 'flat', label: 'たいら', icon: Minus }, { id: 'sea', label: 'うみ', icon: Waves },
];

export function GrowingTerrainControls({ cell, busy, canUndo, canRedo, onEdit, onUndo, onRedo, onClose, onDistance, brush, onBrush, wide, onWide, note, warn }: {
    cell?: Cell; busy: boolean; canUndo: boolean; canRedo: boolean;
    /** What the last change did for the island; the bubble is hidden while this panel is open. */
    note?: string; warn?: boolean;
    /** DEV terrace form: choose a brush and stroke the island with one finger. */
    brush?: Brush; onBrush?: (brush: Brush) => void;
    /** The brush shapes 2×2 cells at a touch instead of one (spec 52 §1.5). */
    wide?: boolean; onWide?: (wide: boolean) => void;
    onEdit: (delta: 1 | -1) => void; onUndo: () => void; onRedo: () => void; onClose: () => void; onDistance: (close: boolean) => void;
}) {
    const close = useRef<HTMLButtonElement>(null);
    const [near, setNear] = useState(false);
    useEffect(() => { close.current?.focus({ preventScroll: true }); }, []);
    useEffect(() => {
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose(); } };
        window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape);
    }, [busy, onClose]);
    // With the brush the panel stays small (spec 52 §1.5): the island is the canvas.
    if (brush) return <section className="growing-terrain-controls growing-terrain-compact" aria-label="じめんを かえる" aria-busy={busy}>
        {note && <p role="status" data-note={!warn || undefined} data-warn={warn || undefined}>{note}</p>}
        <div className="growing-terrain-row">
            <div className="growing-terrain-brushes" role="radiogroup" aria-label="ふで">
                {BRUSHES.map(({ id, label, icon: Icon }) => <button key={id} role="radio" aria-checked={brush === id} data-active={brush === id || undefined}
                    disabled={busy} onClick={() => onBrush?.(id)}><Icon aria-hidden="true" />{label}</button>)}
            </div>
            <button className="growing-terrain-size" aria-pressed={Boolean(wide)} aria-label={wide ? 'ふとさ 2×2' : 'ふとさ 1マス'} onClick={() => onWide?.(!wide)}>
                {wide ? <Grid2x2 aria-hidden="true" /> : <Square aria-hidden="true" />}{wide ? '2×2' : '1マス'}</button>
        </div>
        <div className="growing-terrain-row growing-terrain-tools">
            <button disabled={!canUndo || busy} onClick={onUndo} aria-label="もどす"><Undo2 size={19} aria-hidden="true" />もどす</button>
            <button disabled={!canRedo || busy} onClick={onRedo} aria-label="やりなおす"><Redo2 size={19} aria-hidden="true" /></button>
            <button onClick={() => { onDistance(!near); setNear(!near); }} aria-label={near ? '全体を みる' : '近くで みる'}>{near ? <Scan size={19} aria-hidden="true" /> : <ZoomIn size={19} aria-hidden="true" />}</button>
            <button ref={close} onClick={onClose} disabled={busy}><X size={18} aria-hidden="true" />おわる</button>
        </div>
    </section>;
    return <section className="growing-terrain-controls" aria-label="じめんを かえる" aria-busy={busy}>
        <header><div><h2>じめんを かえる</h2><p role="status" data-note={note && !warn ? true : undefined} data-warn={note && warn ? true : undefined}>{busy ? 'しまに ほぞんしているよ' : note ? note : brush ? 'ゆびで なぞると かわるよ。2ほんゆびで うごかせるよ' : cell ? 'わっかの ところを かえるよ' : 'かえたい じめんを さわってね'}</p></div>
            <button ref={close} onClick={onClose} disabled={busy}><X size={18} aria-hidden="true" />おわる</button></header>
        {brush ? <div className="growing-terrain-height growing-terrain-brushes" role="radiogroup" aria-label="ふで">
            {BRUSHES.map(({ id, label, icon: Icon }) => <button key={id} role="radio" aria-checked={brush === id} data-active={brush === id || undefined}
                disabled={busy} onClick={() => onBrush?.(id)}><Icon aria-hidden="true" />{label}</button>)}
        </div> : <div className="growing-terrain-height">
            <button disabled={!cell || busy} onClick={() => onEdit(1)}><ArrowUp aria-hidden="true" />じめんを あげる</button>
            <button disabled={!cell || busy} onClick={() => onEdit(-1)}><ArrowDown aria-hidden="true" />じめんを さげる</button>
        </div>}
        <div className="growing-terrain-history">
            <button disabled={!canUndo || busy} onClick={onUndo}><Undo2 size={19} aria-hidden="true" />もどす</button>
            <button disabled={!canRedo || busy} onClick={onRedo}><Redo2 size={19} aria-hidden="true" />やりなおす</button>
            <button onClick={() => { onDistance(!near); setNear(!near); }}>{near ? <Scan size={19} aria-hidden="true" /> : <ZoomIn size={19} aria-hidden="true" />}{near ? '全体を みる' : '近くで みる'}</button>
        </div>
        <small>もどるのは じめんだけだよ</small>
    </section>;
}
