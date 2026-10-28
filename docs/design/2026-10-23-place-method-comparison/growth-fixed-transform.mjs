function replaceOnce(source, before, after) {
    if (source.split(before).length !== 2) throw Error(`Growth fixed field source mismatch: ${before.slice(0, 100)}`);
    return source.replace(before, after);
}

/** Apply after terrainMethodTransform. Independent diagnostic, deliberately not
 * enabled by the existing inheritance flag. Browser: growthField=fixed.
 * This changes the initial F/H surface and therefore needs separate adoption. */
export function growthFixedFieldTransform(source, { alwaysFixed = false } = {}) {
    const enabled = alwaysFixed ? 'true' : "typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('growthField') === 'fixed'";
    source = replaceOnce(source, 'convexTerraceOffset(state.terrain?.heights ?? {}, cell, bounds)',
        '(growthFixedFieldEnabled() ? growthFixedOffset : convexTerraceOffset)(state.terrain?.heights ?? {}, cell, bounds)');
    source = replaceOnce(source, "const exterior = (cell: Cell) => cell.x <= bounds.minX || cell.x >= bounds.maxX || cell.z <= 0 || cell.z >= bounds.depth - 1;",
        "const exterior = (cell: Cell) => !growthFixedFieldEnabled() && (cell.x <= bounds.minX || cell.x >= bounds.maxX || cell.z <= 0 || cell.z >= bounds.depth - 1);");
    source = replaceOnce(source, 'return JSON.stringify([mode ===',
        "return JSON.stringify([growthFixedFieldEnabled() && (mode === 'F' || mode === 'H') ? GROWTH_FIXED_FIELD_REVISION : null, mode ===");
    return "import { growthFixedOffset, GROWTH_FIXED_FIELD_REVISION } from '../../../docs/design/2026-10-23-place-method-comparison/growth-fixed-field';\n"
        + `const growthFixedFieldEnabled = () => ${enabled};\n` + source;
}
