import type { Cell, GrowingState } from '../../../src/domain/growingIsland/types';
import { foundationEditWeight } from '../2026-10-22-place-strategy-trial/foundation';

export const LOCAL_TERRACE_FIELD_REVISION = 'local-linear-terrace-v1';
type TerrainState = Pick<GrowingState, 'land'> & Partial<Pick<GrowingState, 'bridge' | 'terrain'>>;
interface Options { minX: number; maxX: number; minZ: number; maxZ: number; detail: number; dryLevel: number }
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

/** Independent local caps. No component membership or legal-placement switch.
 * A cap's amplitude is exactly its own saved positive height times .18; shape
 * is fixed across all heights, so positive edits change any sample by <= .18.
 * max composition naturally connects equal neighbours and never promotes a
 * lower cap to a higher group's height. Original A remains a lower bound.
 * Negative edits still control the opening mask: their response is measured
 * separately and must not be assumed to obey the same amplitude bound.
 */
export function createLocalTerraceField(state: TerrainState, sourceHeight: (state: TerrainState, cell: Cell) => number, options: Options) {
    const reference: TerrainState = { ...state, terrain: state.terrain && { ...state.terrain,
        heights: Object.fromEntries(Object.entries(state.terrain.heights).filter(([, height]) => height < 0)) } };
    const caps = Object.entries(state.terrain?.heights ?? {}).sort(([a], [b]) => a.localeCompare(b)).flatMap(([id, height]) => {
        const [x, z] = id.split(',').map(Number);
        return height > 0 && Number.isInteger(x) && Number.isInteger(z)
            && x >= options.minX + .5 && x <= options.maxX - .5 && z >= options.minZ + .5 && z <= options.maxZ - .5
            ? [{ x, z, rise: height * .18 }] : [];
    });
    const topRadius = .46 + 1 / options.detail + .02, rampWidth = 1.2;
    const heightAt = (cell: Cell) => {
        const a = sourceHeight(state, cell); if (!caps.length || a <= options.dryLevel) return a;
        const interior = Math.min(cell.x - options.minX - .5, options.maxX - .5 - cell.x,
            cell.z - options.minZ - .5, options.maxZ - .5 - cell.z);
        const boundary = smooth(interior * options.detail), foundation = foundationEditWeight(state, cell);
        if (!boundary || !foundation) return a;
        let clearance = Infinity;
        for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1])
            clearance = Math.min(clearance, sourceHeight(reference, { x: cell.x + dx / options.detail, z: cell.z + dz / options.detail }) - options.dryLevel);
        const waterGuard = smooth(clearance / .12); if (!waterGuard) return a;
        let rise = 0;
        for (const cap of caps) {
            const distance = Math.hypot(Math.max(0, Math.abs(cell.x - cap.x) - topRadius), Math.max(0, Math.abs(cell.z - cap.z) - topRadius));
            rise = Math.max(rise, cap.rise * (1 - smooth(distance / rampWidth)));
        }
        return Math.max(a, sourceHeight(reference, cell) + rise * boundary * foundation * waterGuard);
    };
    return { heightAt, proof: { revision: LOCAL_TERRACE_FIELD_REVISION, ownerIndependent: true, topRadius, rampWidth, caps,
        positiveEditSampleBound: .18, limitation: 'High caps can have impassable slopes; opening recovery has a separately measured response; art and UI use remain unproven' } };
}
