import { describe, expect, it } from 'vitest';
import { visibleDirectMarkers } from './islandDirectTargets';

describe('world target labels', () => {
    it('does not turn offscreen or invalid objects into clickable destinations', () => {
        expect(visibleDirectMarkers([{ target: { kind: 'home' }, x: -1, y: 30 },
            { target: { kind: 'garden' }, x: 200, y: 800 }, { target: { kind: 'home' }, x: NaN, y: 0 }], 390, 600)).toEqual([]);
    });
    it('keeps touch areas inside the viewport and avoids overlapping labels', () => {
        expect(visibleDirectMarkers([{ target: { kind: 'home' }, x: 2, y: 3 },
            { target: { kind: 'garden' }, x: 40, y: 40 }, { target: { kind: 'resident', id: 'rabbit' }, x: 389, y: 599 }], 390, 600))
            .toEqual([{ target: { kind: 'home' }, x: 48, y: 28 }, { target: { kind: 'resident', id: 'rabbit' }, x: 342, y: 572 }]);
    });
});
