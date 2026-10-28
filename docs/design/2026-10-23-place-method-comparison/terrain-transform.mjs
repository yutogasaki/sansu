/** Apply after the common foundation transform. Every splice is guarded so a
 * changed production generator cannot silently produce a partly transformed B. */
export function terrainMethodTransform(source, options = {}) {
    if (options.mode !== undefined && !['A', 'B', 'C', 'D', 'F', 'G', 'H'].includes(options.mode)) throw Error('Unknown explicit terrain method');
    const replacements = [
        ['export function terrainRevision(state: TerrainLand): string {',
            'export function terrainRevision(state: TerrainLand, mode: TerrainMethod = terrainMethod()): string {'],
        ['return JSON.stringify([state.land, state.bridge?.x ?? null, heights]);',
            "return JSON.stringify([mode === 'H' ? CONVEX_TERRACE_FIELD_REVISION + '+' + CURVED_GRID_REVISION : mode === 'G' ? COASTAL_BASE_REVISION : mode === 'F' ? CONVEX_TERRACE_FIELD_REVISION : mode === 'D' ? TERRACE_FIELD_REVISION : mode === 'C' ? COASTAL_FIELD_REVISION : SECTION_PROFILE_REVISION, mode, state.land, state.bridge?.x ?? null, heights]);"],
        ['function rawHeight(state: TerrainLand, cell: Cell, curved: boolean): number {',
            'function rawHeight(state: TerrainLand, cell: Cell, curved: boolean, mode: TerrainMethod): number {'],
        ['const x = Math.floor(sx), z = Math.floor(sz), u = smooth(sx - x), v = smooth(sz - z);',
            'const x = Math.floor(sx), z = Math.floor(sz);'],
        ['const offset = ((1 - u) * height(0, 0) + u * height(1, 0)) * (1 - v)\n        + ((1 - u) * height(0, 1) + u * height(1, 1)) * v;',
            "const offset = (mode === 'F' || mode === 'H') ? convexTerraceOffset(state.terrain?.heights ?? {}, cell, bounds) : sectionOffset([height(0, 0), height(1, 0), height(0, 1), height(1, 1)], sx - x, sz - z, mode,\n        sectionRaiseWeight(cell, bounds));"],
        ['export function editableIslandWorld(state: TerrainLand, curved = true): IslandWorld | undefined {',
            'export function editableIslandWorld(state: TerrainLand, curved = true, mode: TerrainMethod = terrainMethod()): IslandWorld | undefined {'],
        ['const revision = `${curved}:${terrainRevision(state)}`, previous = cache.get(revision);',
            'const revision = `${curved}:${terrainRevision(state, mode)}`, previous = cache.get(revision);'],
        ['const detail = 6, margin = 1.5;', "const detail = (mode === 'F' || mode === 'H') ? CONVEX_TERRACE_DETAIL : 6, margin = 1.5;"],
        ['const physical = (cell: Cell) => curved ? landscapePoint(cell) : cell;',
            "const exterior = (cell: Cell) => cell.x <= bounds.minX || cell.x >= bounds.maxX || cell.z <= 0 || cell.z >= bounds.depth - 1;\n    const physical = (cell: Cell) => { const sample = (p: Cell) => curved ? landscapePoint(p) : p; return (mode === 'F' || mode === 'H') && exterior(cell) ? { x: coarseTriangleValue(p => sample(p).x, cell), z: coarseTriangleValue(p => sample(p).z, cell) } : sample(cell); };"],
        ['rawHeight(state, clamped, curved) * (1 - fade)', 'rawHeight(input, clamped, curved, mode) * (1 - fade)'],
        ['const surfaceHeight = (cell: Cell) => {', 'const baselineSurfaceHeightFor = (input: TerrainLand, cell: Cell) => {'],
        ['    type Sample = Cell & { y: number };',
            "    const baselineSurfaceHeight = (cell: Cell) => baselineSurfaceHeightFor(state, cell);\n    const zeroState: TerrainLand = { ...state, terrain: state.terrain && { ...state.terrain, heights: {} } };\n    const zeroHeightAt = (cell: Cell) => baselineSurfaceHeightFor(zeroState, cell);\n    const coastBase = mode === 'G' ? createCoastalBaseField(state, zeroHeightAt, { minX, maxX, minZ, maxZ, seaLevel: TERRAIN_SEA_LEVEL }) : undefined;\n    const surfaceHeight = coastBase ? (cell: Cell) => coastBase.heightAt(cell) + baselineSurfaceHeight(cell) - zeroHeightAt(cell) : (mode === 'F' || mode === 'H') ? (cell: Cell) => exterior(cell) ? coarseTriangleValue(baselineSurfaceHeight, cell) : baselineSurfaceHeight(cell) : mode === 'D' ? createTerraceField(state, baselineSurfaceHeight, { minX, maxX, minZ, maxZ, detail, dryLevel: TERRAIN_DRY_LEVEL }).heightAt : mode === 'C' ? createCoastalField(state, baselineSurfaceHeightFor, { minX, maxX, minZ, maxZ, detail, margin, dryLevel: TERRAIN_DRY_LEVEL, curved }).heightAt : baselineSurfaceHeight;\n    type Sample = Cell & { y: number };"],
    ];
    if (!source.includes('offset * TERRAIN_STEP * foundationEditWeight(state, cell);'))
        throw Error('Terrain method trial requires the common foundation transform first');
    for (const [before, after] of replacements) {
        if (source.split(before).length !== 2) throw Error(`Terrain method source mismatch: ${before.slice(0, 100)}`);
        source = source.replace(before, after);
    }
    // Node integration tests can select one explicit method for every internal
    // domain call, rather than mutating a browser/global flag.
    if (options.mode) source = source.replaceAll('mode: TerrainMethod = terrainMethod()', `mode: TerrainMethod = '${options.mode}'`);
    return "import { CURVED_GRID_REVISION } from '../../../docs/design/2026-10-23-place-method-comparison/curved-grid';\nimport { createCoastalBaseField, COASTAL_BASE_REVISION } from '../../../docs/design/2026-10-23-place-method-comparison/coastal-base-field';\nimport { convexTerraceOffset, coarseTriangleValue, CONVEX_TERRACE_FIELD_REVISION, CONVEX_TERRACE_DETAIL } from '../../../docs/design/2026-10-23-place-method-comparison/terrace-convex-field';\nimport { createTerraceField, TERRACE_FIELD_REVISION } from '../../../docs/design/2026-10-23-place-method-comparison/terrace-field';\nimport { createCoastalField, COASTAL_FIELD_REVISION } from '../../../docs/design/2026-10-23-place-method-comparison/coastal-field';\nimport { terrainMethod, sectionOffset, sectionRaiseWeight, SECTION_PROFILE_REVISION, type TerrainMethod } from '../../../docs/design/2026-10-23-place-method-comparison/section-profile';\n" + source;
}
