import type { Cell, GrowingState } from '../../../src/domain/growingIsland/types';
import { compositeOf } from './composite-field';
import { createBayCoastalSection } from './bay-section';
import type { CoastalSection } from './coastal-section';
import { coastSetEnabled } from './assembly-mode';

const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const axes = { north: { x: 0, z: -1 }, south: { x: 0, z: 1 }, west: { x: -1, z: 0 }, east: { x: 1, z: 0 } };

/** Platforms are already compiled into sample. The bay is a separate lowering
 * operator. Reserve the usable flats and full entrance strips with a C1 fade,
 * allowing only their outer shoulders to overlap the displaced shore. No
 * owner/actor coordinate is used to carve the field; command safety validates
 * their support against the final triangles before accepting an edit. */
export function createAssemblySection(state: Pick<GrowingState, 'land'>, sample: (cell: Cell) => number): CoastalSection {
    const set = compositeOf(state) ?? {};
    const bays = [set.bay, ...(coastSetEnabled() ? [set.bay2] : [])].map(shape =>
        createBayCoastalSection({ ...state, trialPlace: shape } as Pick<GrowingState, 'land'>, sample, 'bay08', shape?.bayDepth));
    const bay = bays[0];
    const platforms = [set.west, set.east].filter(shape => shape !== undefined);
    const weightAt = (cell: Cell) => {
        let weight = 1;
        for (const shape of platforms) {
            const dx = cell.x - shape.center.x, dz = cell.z - shape.center.z;
            const flat = shape.flatRadius ?? shape.radius * .55;
            const flatWeight = smooth((Math.hypot(dx, dz / .8) - flat - 2 / 12) / .25);
            const axis = axes[shape.rampDirection ?? 'north'];
            const along = dx * axis.x + dz * axis.z, lateral = -dx * axis.z + dz * axis.x;
            const side = smooth((Math.abs(lateral) - shape.entrance / 2 - .5 - 2 / 12) / .25);
            const behind = 1 - smooth((along + 2 / 12 + .25) / .25);
            weight = Math.min(weight, flatWeight, Math.max(side, behind));
        }
        return weight;
    };
    const influenceContains = (cell: Cell) => bays.some(section => section.influenceContains(cell)) && weightAt(cell) > 0;
    return { ...bay, reserved: cell => weightAt(cell) === 0,
        influenceContains,
        meshInfluenceContains(cell, detail) {
            if (!(Number.isFinite(detail) && detail > 0)) throw Error('Invalid mesh detail');
            const x = Math.floor(cell.x * detail + 1e-8) / detail, z = Math.floor(cell.z * detail + 1e-8) / detail;
            return [0, 1 / detail].some(dx => [0, 1 / detail].some(dz => influenceContains({ x: x + dx, z: z + dz })));
        },
        heightAt(cell) {
            const old = sample(cell), weight = weightAt(cell);
            return weight === 0 ? old : Math.min(old, old + (Math.min(...bays.map(section => section.heightAt(cell))) - old) * weight);
        },
    };
}
