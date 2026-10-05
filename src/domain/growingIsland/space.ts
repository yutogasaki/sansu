import { occupiedCells } from '../islandLife/footprint';
import type { ItemKind } from '../islandLife/model';
import { OWN_LANDMARKS, type Cell, type GrowingState, type Landmark, type Plot } from './types';

export const HOME_CELL: Cell = { x: 2, z: 1 };
/** Pokomoko's house covers the two north cells and the doorstep that residents leave from. */
export const HOUSE_CELLS: readonly Cell[] = [{ x: 2, z: 0 }, { x: 3, z: 0 }, HOME_CELL];
export const key = (cell: Cell) => `${cell.x},${cell.z}`;
export const same = (a: Cell, b: Cell) => a.x === b.x && a.z === b.z;
export const distance = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
const NEIGHBORS: readonly Cell[] = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
export const neighbors = (cell: Cell) => NEIGHBORS.map(d => ({ x: cell.x + d.x, z: cell.z + d.z }));

type LandState = Pick<GrowingState, 'land'>;

/** Rectangular land keeps every saved coordinate of the current island (48 / 51 P-03). */
export function landBounds({ land }: LandState) {
    const sides = [land.expanded, ...land.extra];
    const west = sides.includes('west'), east = sides.includes('east');
    const districts = land.districts ?? [];
    return {
        minX: (land.capes.includes('west') ? -6 : west ? -3 : 0) - 3 * districts.filter(s => s === 'west').length,
        maxX: (land.capes.includes('east') ? 11 : east ? 8 : 5) + 3 * districts.filter(s => s === 'east').length,
        depth: (sides.includes('south') ? 8 : 5) + 3 * districts.filter(s => s === 'south').length,
    };
}

export function landCells(state: LandState): Cell[] {
    const { minX, maxX, depth } = landBounds(state), cells: Cell[] = [];
    for (let z = 0; z < depth; z++) for (let x = minX; x <= maxX; x++) cells.push({ x, z });
    return cells;
}

export function onLand(state: LandState, cell: Cell) {
    const { minX, maxX, depth } = landBounds(state);
    return Number.isInteger(cell.x) && Number.isInteger(cell.z) && cell.x >= minX && cell.x <= maxX && cell.z >= 0 && cell.z < depth;
}

export const isHouseCell = (cell: Cell) => HOUSE_CELLS.some(c => same(c, cell));

function landmarkCells(landmark: Landmark): Cell[] {
    if (!landmark.cell) return [];
    return OWN_LANDMARKS.includes(landmark.kind) ? [landmark.cell] : occupiedCells({ kind: landmark.kind as ItemKind, cell: landmark.cell });
}

/** What occupies a cell. Spread wild plants are reported so seeds can replace them. */
export function occupant(state: GrowingState, cell: Cell, except?: string):
    { type: 'house' } | { type: 'bridge' } | { type: 'landmark'; id: string } | { type: 'plot'; id: string; spread: boolean } | { type: 'keepsake'; id: string } | undefined {
    if (isHouseCell(cell)) return { type: 'house' };
    if (state.bridge && same(cell, bridgeAnchor(state))) return { type: 'bridge' };
    const landmark = state.landmarks.find(l => l.id !== except && landmarkCells(l).some(c => same(c, cell)));
    if (landmark) return { type: 'landmark', id: landmark.id };
    const plot = state.plots.find(p => p.id !== except && p.cell && same(p.cell, cell));
    if (plot) return { type: 'plot', id: plot.id, spread: plot.origin === 'spread' };
    const keepsake = state.keepsakes.find(k => k.id !== except && k.cell && same(k.cell, cell));
    if (keepsake) return { type: 'keepsake', id: keepsake.id };
}

export function isVacant(state: GrowingState, cell: Cell, except?: string) {
    return onLand(state, cell) && !occupant(state, cell, except);
}

/**
 * Crops, wild plants and flowers can be stepped between, so scattering flowers never walls
 * the island off; buildings, furniture and keepsakes block.
 */
function plotBlocks(plot: Plot) {
    // The polka-dot arch is walked through, like the flower arch.
    if (plot.kind === 'wonder') return plot.stage === 0 || !(plot.style === 'water' || plot.style === 'light');
    return plot.kind !== 'farm' && plot.kind !== 'wild';
}
const OPEN_LANDMARKS: ReadonlySet<string> = new Set(['water-channel', 'flower-arch', 'flower']);
function landmarkBlocks(landmark: Landmark) { return !OPEN_LANDMARKS.has(landmark.kind); }

export function walkableCells(state: GrowingState): Set<string> {
    const blocked = new Set<string>([key({ x: 2, z: 0 }), key({ x: 3, z: 0 })]);
    for (const l of state.landmarks) if (landmarkBlocks(l)) landmarkCells(l).forEach(c => blocked.add(key(c)));
    for (const p of state.plots) if (p.cell && plotBlocks(p)) blocked.add(key(p.cell));
    for (const k of state.keepsakes) if (k.cell) blocked.add(key(k.cell));
    const open = new Set(landCells(state).map(key).filter(k => !blocked.has(k)));
    if (state.bridge) {
        const { depth } = landBounds(state);
        open.add(key({ x: state.bridge.x, z: depth }));
        open.add(key({ x: state.bridge.x, z: depth + 1 }));
    }
    return open;
}

export function bridgeAnchor(state: GrowingState, x = state.bridge?.x ?? 2): Cell { return { x, z: landBounds(state).depth - 1 }; }
export function bridgeEnd(state: GrowingState): Cell { return { x: state.bridge!.x, z: landBounds(state).depth + 1 }; }

/** Existing objects and unreachable shores cannot be replaced by a bridge. */
export function canBuildBridge(state: GrowingState, x: number) {
    const bounds = landBounds(state), shore = bridgeAnchor(state, x);
    if (!Number.isInteger(x) || x < bounds.minX + 1 || x > bounds.maxX - 2) return false;
    const withoutBridge = { ...state, bridge: undefined };
    return !occupant(withoutBridge, shore) && reachableFromHome(withoutBridge).has(key(shore));
}

export function bridgeSite(state: GrowingState) {
    const { minX, maxX } = landBounds(state), preferred = state.bridge?.x ?? minX + 2;
    const candidates = [preferred, ...Array.from({ length: maxX - minX - 2 }, (_, i) => minX + 1 + i)];
    return candidates.find(x => canBuildBridge(state, x));
}

/** Cells reachable on foot from Pokomoko's doorstep. */
export function reachableFromHome(state: GrowingState, walkable = walkableCells(state)): Set<string> {
    const start = key(HOME_CELL), seen = new Set<string>([start]), queue: Cell[] = [HOME_CELL];
    while (queue.length) {
        const cell = queue.shift()!;
        for (const next of neighbors(cell)) {
            const k = key(next);
            if (walkable.has(k) && !seen.has(k)) { seen.add(k); queue.push(next); }
        }
    }
    return seen;
}

/** A thing is reachable when its own cell or an orthogonal neighbour can be walked to. */
export function isReachable(cell: Cell, reached: Set<string>) {
    return reached.has(key(cell)) || neighbors(cell).some(n => reached.has(key(n)));
}
