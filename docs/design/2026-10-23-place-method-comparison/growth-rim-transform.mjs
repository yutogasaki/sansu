function replaceOnce(source, before, after) {
    if (source.split(before).length !== 2) throw Error(`Growth rim source mismatch: ${before.slice(0, 100)}`);
    return source.replace(before, after);
}
/** Rejected-candidate diagnostic: cap only outside the acquired half-cell.
 * Apply after terrainMethodTransform and growthFixedFieldTransform. No browser
 * enablement: this is an explicitly selected Node experiment until validated. */
export function growthRimTransform(source) {
    source = replaceOnce(source, 'const baselineSurfaceHeightFor = (input: TerrainLand, cell: Cell) => {',
        'const baselineSurfaceHeightFor = (input: TerrainLand, cell: Cell, sampleMode: TerrainMethod = mode) => {');
    source = replaceOnce(source, 'rawHeight(input, clamped, curved, mode) * (1 - fade)',
        'rawHeight(input, clamped, curved, sampleMode) * (1 - fade)');
    source = replaceOnce(source, 'const surfaceHeight = coastBase ?', 'const uncappedSurfaceHeight = coastBase ?');
    source = replaceOnce(source, '    type Sample = Cell & { y: number };',
        "    const surfaceHeight = (cell: Cell) => {\n        const fixed = uncappedSurfaceHeight(cell);\n        if (cell.x >= minX && cell.x <= maxX && cell.z >= minZ && cell.z <= maxZ) return fixed;\n        const original = coarseTriangleValue(p => baselineSurfaceHeightFor(state, p, 'A'), cell);\n        return Math.min(fixed, original);\n    };\n    type Sample = Cell & { y: number };");
    source = replaceOnce(source, 'return JSON.stringify([growthFixedFieldEnabled()',
        "return JSON.stringify(['outside-owned-rim-cap-v1', growthFixedFieldEnabled()");
    return source;
}
