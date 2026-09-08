import { describe, expect, it, vi } from 'vitest';
import { canControlIslandCamera, IslandCameraControls } from './islandCameraControls';
import { getIslandWorkshop } from '../../../domain/island/workshop';
import type { CameraPanFraming } from './cameraPanFraming';

const viewport = { left: 0, top: 0, width: 390, height: 390 };
const framing: CameraPanFraming = { center: { x: 0, y: 0 }, height: 10, aspect: 1,
    bounds: { minX: -30, maxX: 30, minY: -20, maxY: 20 }, regions: [] };
function camera(change = vi.fn()) {
    const controls = new IslandCameraControls(change); controls.setFrame(framing); return controls;
}

describe('island view gestures', () => {
    it('keeps small tap jitter selectable, but consumes a drag even after it returns to its start', () => {
        const controls = camera();
        controls.down(1, { x: 100, y: 100 });
        controls.move(1, { x: 103, y: 101 }, viewport);
        expect(controls.up(1, { x: 103, y: 101 })).toBe(true);
        controls.down(2, { x: 100, y: 100 });
        controls.move(2, { x: 180, y: 100 }, viewport);
        expect(controls.view.pan.x).toBeLessThan(-2);
        expect(controls.view.azimuth).toBe(0);
        controls.move(2, { x: 100, y: 100 }, viewport);
        expect(controls.up(2, { x: 100, y: 100 })).toBe(false);
    });

    it('pans vertically, and cancels without selecting a house/item or leaving a stuck pointer', () => {
        const change = vi.fn(), controls = camera(change);
        controls.down(1, { x: 100, y: 100 });
        controls.move(1, { x: 101, y: 150 }, viewport);
        expect(change).toHaveBeenCalledOnce();
        expect(controls.view.pan.y).toBeCloseTo(50 / 390 * 10);
        expect(controls.view.azimuth).toBe(0);
        controls.cancel();
        expect(controls.up(1, { x: 101, y: 150 })).toBe(false);
        controls.down(2, { x: 100, y: 100 });
        expect(controls.up(2, { x: 100, y: 100 })).toBe(true);
    });

    it('pinches to zoom and never turns either remaining finger into a tap', () => {
        const controls = camera();
        controls.down(1, { x: 100, y: 100 });
        controls.down(2, { x: 200, y: 100 });
        controls.move(2, { x: 250, y: 100 }, viewport);
        expect(controls.view.zoom).toBeCloseTo(1.5);
        expect(controls.up(2, { x: 250, y: 100 })).toBe(false);
        controls.move(1, { x: 130, y: 160 }, viewport);
        expect(controls.up(1, { x: 100, y: 100 })).toBe(false);
    });

    it('does not turn a pinch twist into rotation; buttons still rotate', () => {
        const controls = camera();
        controls.down(1, { x: 200, y: 200 });
        controls.down(2, { x: 100, y: 201 });
        controls.move(2, { x: 100, y: 199 }, viewport);
        expect(controls.view.azimuth).toBe(0);
        expect(controls.view.zoom).toBeCloseTo(1);
        controls.action('right'); expect(controls.view.azimuth).toBeCloseTo(Math.PI / 6);
    });

    it('bounds wheel and button zoom, releases outward scrolling at limits, and resets safely', () => {
        const controls = new IslandCameraControls(vi.fn());
        expect(controls.wheel(80)).toBe(false);
        for (let i = 0; i < 20; i++) controls.action('in');
        expect(controls.view.zoom).toBe(6);
        expect(controls.wheel(-80)).toBe(false);
        expect(controls.wheel(80)).toBe(true);
        controls.action('right');
        controls.down(1, { x: 10, y: 10 });
        controls.action('reset');
        expect(controls.view).toEqual({ zoom: 1, azimuth: 0, pan: { x: 0, y: 0 }, manual: true });
        expect(controls.up(1, { x: 10, y: 10 })).toBe(false);
        controls.reset();
        expect(controls.view.manual).toBe(false);
    });

    it('preserves the actual world point below the moving pinch midpoint and wheel cursor', () => {
        const controls = camera();
        const world = (point: { x: number; y: number }) => ({
            x: controls.view.pan.x + (point.x / 390 - .5) * 10 / controls.view.zoom,
            y: controls.view.pan.y + (.5 - point.y / 390) * 10 / controls.view.zoom,
        });
        controls.down(1, { x: 100, y: 100 }); controls.down(2, { x: 200, y: 100 });
        const before = world({ x: 150, y: 100 });
        controls.move(2, { x: 250, y: 130 }, viewport);
        const after = world({ x: 175, y: 115 });
        expect(after.x).toBeCloseTo(before.x, 12); expect(after.y).toBeCloseTo(before.y, 12);
        const cursor = { x: 220, y: 175 }, anchor = world(cursor);
        controls.wheel(-80, cursor, viewport);
        expect(world(cursor).x).toBeCloseTo(anchor.x, 12); expect(world(cursor).y).toBeCloseTo(anchor.y, 12);
        const focus = { ...controls.view.pan };
        controls.action('in'); expect(controls.view.pan).toEqual(focus);
    });

    it('uses canvas offsets and retains pan through ordinary framing/viewport updates', () => {
        const controls = camera();
        controls.down(1, { x: 140, y: 270 });
        controls.move(1, { x: 200, y: 340 }, { ...viewport, left: 40, top: 170 });
        const view = structuredClone(controls.view);
        controls.setFrame({ ...framing }); expect(controls.view).toEqual(view);
        controls.setFrame({ ...framing, aspect: 2 }); expect(controls.view).toEqual(view);
        controls.reset(); expect(controls.view.pan).toEqual({ x: 0, y: 0 });
        expect(controls.up(1, { x: 200, y: 340 })).toBe(false);
    });

    it('does not capture editing, learning, read-only comparisons or explicit replays', () => {
        const state = { learning: false, items: [], completedSets: 0, pulse: 0 };
        expect(canControlIslandCamera(state)).toBe(true);
        expect(canControlIslandCamera({ ...state, learning: true })).toBe(false);
        expect(canControlIslandCamera({ ...state, readOnly: true })).toBe(false);
        expect(canControlIslandCamera({ ...state, learningKeepsakes: {} })).toBe(false);
        expect(canControlIslandCamera({ ...state, residentPortraitId: 'rabbit' })).toBe(false);
        expect(canControlIslandCamera({ ...state, expressionFlagFocus: true })).toBe(false);
        // Capturing suspends input in runtime without changing/resetting the already chosen photo view.
        expect(canControlIslandCamera({ ...state, photographing: true })).toBe(true);
        expect(canControlIslandCamera({ ...state, preview: { id: 'flower', kind: 'flower', rotation: 0 } })).toBe(false);
        expect(canControlIslandCamera({ ...state, playRequest: { id: 'play', itemId: 'flower' } })).toBe(false);
        expect(canControlIslandCamera({ ...state, workshop: { active: true, mode: 'observe', workshop: getIslandWorkshop({ profileId: 'test' }) } })).toBe(false);
        expect(canControlIslandCamera()).toBe(false);
    });
});
