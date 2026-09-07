import type { IslandItemKind } from './types';

export interface FurniturePoint { x: number; y: number; z: number }
export interface FurnitureAnchors { seat?: FurniturePoint; look: FurniturePoint; light?: FurniturePoint }

const ANCHORS: Record<IslandItemKind, FurnitureAnchors> = {
    bench: { seat: { x: 0, y: .5, z: 0 }, look: { x: 0, y: .78, z: -.23 } },
    flower: { look: { x: 0, y: .46, z: 0 }, light: { x: .1, y: .55, z: -.085 } },
    lantern: { look: { x: .12, y: .91, z: 0 }, light: { x: .12, y: .91, z: 0 } },
    swing: { seat: { x: 0, y: .5, z: 0 }, look: { x: 0, y: .5, z: 0 } },
    mushroom: { seat: { x: 0, y: .64, z: 0 }, look: { x: 0, y: .64, z: 0 } },
    fountain: { look: { x: 0, y: .35, z: 0 }, light: { x: 0, y: .72, z: 0 } },
};

/** Local model coordinates. Seats identify the supporting surface, not the actor origin. */
export function getFurnitureAnchors(kind: IslandItemKind): FurnitureAnchors {
    const anchor = ANCHORS[kind];
    return { look: { ...anchor.look }, ...(anchor.seat ? { seat: { ...anchor.seat } } : {}),
        ...(anchor.light ? { light: { ...anchor.light } } : {}) };
}

/** One short arrival gesture; phase 0 and 1 are at rest. Shared by seat and resident. */
export function sampleFurnitureSwing(phase: number) {
    const t = Math.max(0, Math.min(1, Number.isFinite(phase) ? phase : 0));
    const angle = t === 0 || t === 1 ? 0 : .12 * Math.sin(t * Math.PI * 2) * Math.sin(t * Math.PI);
    const pivot = { x: 0, y: 1.55, z: 0 };
    const length = pivot.y - ANCHORS.swing.seat!.y;
    return { angle, pivot, seat: { x: 0, y: pivot.y - length * Math.cos(angle), z: -length * Math.sin(angle) } };
}

export const getSwingSeatPosition = (phase: number) => sampleFurnitureSwing(phase).seat;
