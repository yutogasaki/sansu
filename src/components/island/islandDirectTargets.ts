import type { IslandResidentId } from '../../domain/island/experience';

export type IslandDirectTarget = { kind: 'home' } | { kind: 'garden' }
    | { kind: 'resident'; id: IslandResidentId } | { kind: 'item'; id: string };
export interface IslandDirectMarker { target: IslandDirectTarget; x: number; y: number }

/** Keep labels inside the viewport without inventing an offscreen destination. */
export function visibleDirectMarkers(markers: IslandDirectMarker[], width: number, height: number) {
    const visible: IslandDirectMarker[] = [];
    for (const marker of markers) {
        if (!Number.isFinite(marker.x + marker.y) || marker.x < 0 || marker.x > width || marker.y < 0 || marker.y > height) continue;
        const placed = { ...marker, x: Math.max(48, Math.min(width - 48, marker.x)), y: Math.max(28, Math.min(height - 28, marker.y)) };
        // Labels must not obscure another label's hit area. The actual model
        // remains tappable when its optional label cannot fit.
        if (!visible.some(other => Math.abs(other.x - placed.x) < 96 && Math.abs(other.y - placed.y) < 52)) visible.push(placed);
    }
    return visible;
}
