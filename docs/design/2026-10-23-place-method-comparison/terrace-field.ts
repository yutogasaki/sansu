import type { Cell, GrowingState } from '../../../src/domain/growingIsland/types';
import { foundationEditWeight } from '../2026-10-22-place-strategy-trial/foundation';

export const TERRACE_FIELD_REVISION = 'connected-raised-terrace-v2';
type TerrainState = Pick<GrowingState, 'land'> & Partial<Pick<GrowingState, 'bridge' | 'terrain'>>;
export interface TerraceOptions { minX: number; maxX: number; minZ: number; maxZ: number; detail: number; dryLevel: number }
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const key = (cell: Cell) => `${cell.x},${cell.z}`;
const distanceToTop = (point: Cell, cells: Cell[], radius: number) => Math.min(...cells.map(cell =>
    Math.hypot(Math.max(0, Math.abs(point.x - cell.x) - radius), Math.max(0, Math.abs(point.z - cell.z) - radius))));

/** Pure physical field from raised acquired cells, never from placed owners.
 * Two or more adjacent cells at >=2 steps request one usable terrace. Their
 * highest raised centre defines the common top. This can lift a lower neighbour
 * but never makes an existing point descend when the child presses "raise".
 * A slope returns to A outside the top.
 * A wet triangle's adjacent vertices, the outer ownership band, and fixed
 * supports keep A exactly. The caller must triangulate this same heightAt for
 * rendering, support and navigation; this is not a decorative extra floor.
 */
export function createTerraceField(state: TerrainState, baselineHeight: (cell: Cell) => number, options: TerraceOptions) {
    const topRadius = .46 + 1 / options.detail + .02;
    const remaining = new Map<string, Cell>();
    for (const [id, height] of Object.entries(state.terrain?.heights ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
        const [x, z] = id.split(',').map(Number);
        if (height >= 2 && Number.isInteger(x) && Number.isInteger(z)
            && x >= options.minX + .5 && x <= options.maxX - .5 && z >= options.minZ + .5 && z <= options.maxZ - .5)
            remaining.set(id, { x, z });
    }
    const groups: { cells: Cell[]; top: number; rampWidth: number }[] = [];
    while (remaining.size) {
        const first = remaining.values().next().value!, cells = [first]; remaining.delete(key(first));
        for (let i = 0; i < cells.length; i++) for (const delta of [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]) {
            const next = { x: cells[i].x + delta.x, z: cells[i].z + delta.z };
            if (remaining.delete(key(next))) cells.push(next);
        }
        if (cells.length < 2) continue;
        const top = Math.max(...cells.map(baselineHeight));
        if (top <= options.dryLevel + .18) continue;
        const editRise = Math.max(...cells.map(cell => state.terrain!.heights[key(cell)])) * .18;
        groups.push({ cells, top, rampWidth: Math.max(.8, editRise * 2) });
    }
    const heightAt = (cell: Cell) => {
        const a = baselineHeight(cell); if (!groups.length || a <= options.dryLevel) return a;
        // min/max describe the outer half-cell ownership boundary. The entire
        // outer half-cell stays A, preserving every unowned triangle and shore.
        const interior = Math.min(cell.x - options.minX - .5, options.maxX - .5 - cell.x,
            cell.z - options.minZ - .5, options.maxZ - .5 - cell.z);
        const boundary = smooth(interior / (1 / options.detail)); if (!boundary) return a;
        const foundation = foundationEditWeight(state, cell); if (!foundation) return a;
        // If any vertex of a nearby source triangle can be wet, preserve A.
        // All vertices of every mixed wet/dry triangle therefore stay exact.
        let wetClearance = Infinity;
        for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1])
            wetClearance = Math.min(wetClearance, baselineHeight({ x: cell.x + dx / options.detail, z: cell.z + dz / options.detail }) - options.dryLevel);
        const waterGuard = smooth(wetClearance / .12); if (!waterGuard) return a;
        let uplift = 0;
        for (const group of groups) {
            const distance = distanceToTop(cell, group.cells, topRadius);
            if (distance >= group.rampWidth) continue;
            const weight = 1 - smooth(distance / group.rampWidth);
            uplift = Math.max(uplift, Math.max(0, group.top - a) * weight);
        }
        return a + uplift * boundary * foundation * waterGuard;
    };
    return { heightAt, proof: { revision: TERRACE_FIELD_REVISION, ownerIndependent: true, topRadius,
        groups, constraints: ['mixed water triangles retain A', 'outer half-cell retains A', 'fixed foundation retains A'],
        limitation: 'fixed supports and wet openings can trim a top or block its ramp; placement and actual walking must still validate' } };
}
