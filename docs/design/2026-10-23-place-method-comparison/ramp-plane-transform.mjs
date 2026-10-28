function replaceOnce(source, before, after) {
    if (source.split(before).length !== 2) throw Error(`Ramp plane source mismatch: ${before.slice(0, 100)}`);
    return source.replace(before, after);
}
/** Apply AFTER terrainMethodTransform. F/H height sampling and ownership remain
 * unchanged; rampTrial=linear changes only the offset basis and cache revision.
 */
export function rampPlaneTerrainTransform(source, { alwaysLinear = false } = {}) {
    const enabled = alwaysLinear ? 'true' : "typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('rampTrial') === 'linear'";
    source = replaceOnce(source, "(mode === 'F' || mode === 'H') ? convexTerraceOffset(state.terrain?.heights ?? {}, cell, bounds)",
        "(mode === 'F' || mode === 'H') ? (rampPlaneEnabled() ? rampPlaneOffset(state.terrain?.heights ?? {}, cell, bounds) : convexTerraceOffset(state.terrain?.heights ?? {}, cell, bounds))");
    source = replaceOnce(source, 'return JSON.stringify([', "return JSON.stringify([rampPlaneEnabled() && (mode === 'F' || mode === 'H') ? RAMP_PLANE_REVISION : 'ramp-default', " );
    return "import { rampPlaneOffset, RAMP_PLANE_REVISION } from '../../../docs/design/2026-10-23-place-method-comparison/ramp-plane-field';\n"
        + `const rampPlaneEnabled = () => ${enabled};\n` + source;
}
