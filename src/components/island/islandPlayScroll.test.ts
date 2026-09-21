import { describe, expect, it } from 'vitest';
import { hasMoreContentBelow } from './islandPlayScroll';

describe('hasMoreContentBelow', () => {
    it('does not show a hint when the content fits', () => {
        expect(hasMoreContentBelow({ scrollTop: 0, clientHeight: 120, scrollHeight: 120 })).toBe(false);
    });

    it('shows a hint while content remains below the viewport', () => {
        expect(hasMoreContentBelow({ scrollTop: 20, clientHeight: 100, scrollHeight: 240 })).toBe(true);
    });

    it('hides a hint when the scroll surface reaches its end', () => {
        expect(hasMoreContentBelow({ scrollTop: 139, clientHeight: 100, scrollHeight: 240 })).toBe(false);
    });
});
