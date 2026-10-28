/** Private G adapter. Input is production source after foundationTransform.
 * Existing comparison flags/transforms remain untouched. */
export function coastalBaseTransform(source) {
    const replacements = [
        ['return JSON.stringify([state.land, state.bridge?.x ?? null, heights]);', 'return JSON.stringify([COASTAL_BASE_REVISION, state.land, state.bridge?.x ?? null, heights]);'],
        ['const surfaceHeight = (cell: Cell) => {', 'const baselineSurfaceHeightFor = (input: TerrainLand, cell: Cell) => {'],
        ['rawHeight(state, clamped, curved) * (1 - fade)', 'rawHeight(input, clamped, curved) * (1 - fade)'],
        ['    type Sample = Cell & { y: number };',
            '    const zeroState: TerrainLand = { ...state, terrain: state.terrain && { ...state.terrain, heights: {} } };\n    const zeroHeightAt = (cell: Cell) => baselineSurfaceHeightFor(zeroState, cell);\n    const base = createCoastalBaseField(state, zeroHeightAt, { minX, maxX, minZ, maxZ, seaLevel: TERRAIN_SEA_LEVEL });\n    const surfaceHeight = (cell: Cell) => base.heightAt(cell) + baselineSurfaceHeightFor(state, cell) - zeroHeightAt(cell);\n    type Sample = Cell & { y: number };'],
    ];
    if (!source.includes('offset * TERRAIN_STEP * foundationEditWeight(state, cell);')) throw Error('G requires the common foundation transform');
    for (const [before, after] of replacements) {
        if (source.split(before).length !== 2) throw Error(`G source mismatch: ${before.slice(0, 100)}`);
        source = source.replace(before, after);
    }
    return "import { createCoastalBaseField, COASTAL_BASE_REVISION } from '../../../docs/design/2026-10-23-place-method-comparison/coastal-base-field';\n" + source;
}
