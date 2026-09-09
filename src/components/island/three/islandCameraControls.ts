import type { IslandStageState } from './types';
import { frameIslandCameraPan, type CameraPanFraming, type CameraPanPoint } from './cameraPanFraming';

export const ISLAND_MIN_ZOOM = 1;
export const ISLAND_MAX_ZOOM = 6;
export type IslandCameraAction = 'left' | 'right' | 'in' | 'out' | 'reset';
export interface IslandCameraView { zoom: number; azimuth: number; pan: CameraPanPoint; manual: boolean }
export const initialIslandCameraView = (): IslandCameraView => ({ zoom: 1, azimuth: 0, pan: { x: 0, y: 0 }, manual: false });
interface Point { x: number; y: number }
interface Pointer extends Point { start: Point; moved: boolean }
export interface IslandCameraViewport { left: number; top: number; width: number; height: number }

export function canControlIslandCamera(state?: IslandStageState) {
    return Boolean(state && !state.learning && !state.readOnly && !state.learningKeepsakes && !state.preview && !state.cosmeticFocus && !state.furnitureTrial && !state.playRequest && !state.workshop?.active
        && !state.shared?.active && !state.shared?.focusDisplayId && !state.expressionResidentId && !state.residentPortraitId && !state.expressionFlagFocus);
}

const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

/** Camera-only state. A gesture never becomes an item tap after a drag, pinch,
 * cancellation, or after the first finger of a pinch has lifted. */
export class IslandCameraControls {
    view: IslandCameraView = initialIslandCameraView();
    private pointers = new Map<number, Pointer>();
    private framing?: CameraPanFraming;

    constructor(private readonly changed: (view: IslandCameraView) => void) {}

    reset(notify = true) {
        this.cancel();
        this.view = initialIslandCameraView();
        this.framing = undefined;
        if (notify) this.changed(this.view);
    }

    /** Called after the normal-island base fit, never from a learning or authored close-up frame. */
    setFrame(framing: CameraPanFraming) {
        this.framing = framing;
        const frame = frameIslandCameraPan(framing, this.view.zoom, this.view.pan);
        this.view = { ...this.view, pan: frame.pan };
        return frame;
    }

    private change(azimuth: number, zoom: number, pan = this.view.pan) {
        if (![azimuth, zoom, pan.x, pan.y].every(Number.isFinite)) return;
        zoom = Math.max(ISLAND_MIN_ZOOM, Math.min(ISLAND_MAX_ZOOM, zoom));
        if (this.framing && azimuth === this.view.azimuth) pan = frameIslandCameraPan(this.framing, zoom, pan).pan;
        this.view = { azimuth: wrapAngle(azimuth), zoom, pan: { ...pan }, manual: true };
        this.changed(this.view);
    }

    action(action: IslandCameraAction) {
        this.cancel();
        if (action === 'reset') this.change(0, 1, { x: 0, y: 0 });
        else if (action === 'left' || action === 'right') this.change(this.view.azimuth + (action === 'left' ? -1 : 1) * Math.PI / 6, this.view.zoom);
        else this.change(this.view.azimuth, this.view.zoom * (action === 'in' ? 1.25 : .8));
    }

    wheel(delta: number, point?: Point, viewport?: IslandCameraViewport) {
        if (!Number.isFinite(delta) || delta === 0) return false;
        const zoom = Math.max(ISLAND_MIN_ZOOM, Math.min(ISLAND_MAX_ZOOM, this.view.zoom * Math.exp(-Math.max(-160, Math.min(160, delta)) * .003)));
        if (zoom === this.view.zoom) return false;
        this.zoomAndMove(zoom, point, point, viewport);
        return true;
    }

    down(id: number, point: Point) {
        this.pointers.set(id, { ...point, start: point, moved: false });
        if (this.pointers.size > 1) this.pointers.forEach(pointer => { pointer.moved = true; });
    }

    private zoomAndMove(zoom: number, before?: Point, after?: Point, viewport?: IslandCameraViewport, rotation = 0) {
        zoom = Math.max(ISLAND_MIN_ZOOM, Math.min(ISLAND_MAX_ZOOM, zoom));
        const pan = { ...this.view.pan };
        if (this.framing && before && after && viewport && viewport.width > 0 && viewport.height > 0) {
            const height = this.framing.height / this.view.zoom, width = height * this.framing.aspect;
            const ratio = this.view.zoom / zoom;
            pan.x += ((before.x - viewport.left) / viewport.width - .5) * width
                - ((after.x - viewport.left) / viewport.width - .5) * width * ratio;
            pan.y += (.5 - (before.y - viewport.top) / viewport.height) * height
                - (.5 - (after.y - viewport.top) / viewport.height) * height * ratio;
        }
        this.change(this.view.azimuth + rotation, zoom, pan);
    }

    move(id: number, point: Point, viewport: IslandCameraViewport) {
        const pointer = this.pointers.get(id);
        if (!pointer) return;
        const pair = [...this.pointers.values()].slice(0, 2);
        const distance = () => Math.hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y);
        const midpoint = () => ({ x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 });
        const angle = () => Math.atan2(pair[1].y - pair[0].y, pair[1].x - pair[0].x);
        const oldAngle = pair.length === 2 ? angle() : 0;
        const oldDistance = pair.length === 2 ? distance() : 0;
        const before = pair.length === 2 ? midpoint() : { x: pointer.x, y: pointer.y };
        pointer.x = point.x; pointer.y = point.y;
        if (pair.length === 2) {
            if (pair.includes(pointer)) {
                const stablePair = oldDistance > 12 && distance() > 12;
                this.zoomAndMove(stablePair ? this.view.zoom * distance() / oldDistance : this.view.zoom,
                    before, midpoint(), viewport, stablePair ? wrapAngle(angle() - oldAngle) : 0);
            }
            return;
        }
        const totalX = point.x - pointer.start.x, totalY = point.y - pointer.start.y;
        if (!pointer.moved && Math.hypot(totalX, totalY) < 8) return;
        pointer.moved = true;
        this.zoomAndMove(this.view.zoom, before, point, viewport);
    }

    up(id: number, point: Point) {
        const pointer = this.pointers.get(id);
        this.pointers.delete(id);
        return Boolean(pointer && !pointer.moved && Math.hypot(point.x - pointer.start.x, point.y - pointer.start.y) < 8);
    }

    cancel() { this.pointers.clear(); }
    hasPointer(id: number) { return this.pointers.has(id); }
}
