import type { PartKind } from '../../../domain/park/types';

export const THREE_PARK_CANDIDATE = 'park-three-resin-v1';
export function threeParkRequested() {
    const override = import.meta.env.DEV && typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('parkRenderer') : null;
    return override ? override === 'three' : import.meta.env.VITE_PARK_RENDERER === 'three';
}
export const supportsThreePark = (layout: readonly (PartKind | null)[]) => layout.length === 3
    && layout.every(kind => kind === null || kind === 'slide' || kind === 'trampoline' || kind === 'bubble');
