import { WebGLRenderer, type WebGLRendererParameters } from 'three';

const compactAppleDevice = () => typeof navigator !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
);

/** Keep Apple touch devices within a smaller GPU budget; retry other allocation failures once. */
export function createIslandRenderer(options: WebGLRendererParameters = {}, compact = false) {
    compact ||= compactAppleDevice();
    try {
        return { renderer: new WebGLRenderer({ ...options, antialias: !compact, powerPreference: 'low-power' }), compact };
    } catch (error) {
        if (compact) throw error;
        return { renderer: new WebGLRenderer({ ...options, antialias: false, powerPreference: 'low-power' }), compact: true };
    }
}
