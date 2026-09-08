import { Maximize, RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { ISLAND_MAX_ZOOM, ISLAND_MIN_ZOOM, type IslandCameraAction, type IslandCameraView } from './three/islandCameraControls';

export function IslandCameraToolbar({ view, onAction, disabled = false }: { view: IslandCameraView; onAction: (action: IslandCameraAction) => void; disabled?: boolean }) {
    return <div className="island-camera" role="group" aria-label="しまの ながめ">
        <button type="button" disabled={disabled} aria-label="しまを ひだりに まわす" title="しまを ひだりに まわす" onClick={() => onAction('left')}><RotateCcw size={20} aria-hidden="true" /></button>
        <button type="button" disabled={disabled} aria-label="しまを みぎに まわす" title="しまを みぎに まわす" onClick={() => onAction('right')}><RotateCw size={20} aria-hidden="true" /></button>
        <span className="island-camera__divider" aria-hidden="true" />
        <button type="button" aria-label="しまを ちいさく" title="しまを ちいさく" disabled={disabled || view.zoom <= ISLAND_MIN_ZOOM} onClick={() => onAction('out')}><ZoomOut size={20} aria-hidden="true" /></button>
        <button type="button" aria-label="しまを おおきく" title="しまを おおきく" disabled={disabled || view.zoom >= ISLAND_MAX_ZOOM} onClick={() => onAction('in')}><ZoomIn size={20} aria-hidden="true" /></button>
        <button type="button" disabled={disabled} className="island-camera__reset" aria-label="もとの ながめ" title="もとの ながめ" onClick={() => onAction('reset')}><Maximize size={19} aria-hidden="true" /><span>もとの ながめ</span></button>
    </div>;
}
