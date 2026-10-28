function replaceOnce(source, before, after) {
    if (source.split(before).length !== 2) throw Error(`Coarse linear source mismatch: ${before.slice(0, 100)}`);
    return source.replace(before, after);
}
/** Experimental tessellation only: apply after terrain/stable/ramp transforms.
 * Only F/H + linear can use meshTrial=coarse. Sites, ownership, edge validation,
 * sampler and renderer all retain the same single actual compiled mesh. */
export function coarseLinearTerrainTransform(source, { alwaysCoarse = false } = {}) {
    if (!source.includes('const rampPlaneEnabled =')) throw Error('Coarse linear requires rampPlaneTerrainTransform');
    source = replaceOnce(source,
        "const detail = (mode === 'F' || mode === 'H') ? CONVEX_TERRACE_DETAIL : 6, margin = 1.5;",
        "const detail = (mode === 'F' || mode === 'H') ? (rampPlaneEnabled() && coarseLinearEnabled() ? 6 : CONVEX_TERRACE_DETAIL) : 6, margin = 1.5;");
    source = replaceOnce(source, 'return JSON.stringify([',
        "return JSON.stringify([...(rampPlaneEnabled() && coarseLinearEnabled() && (mode === 'F' || mode === 'H') ? ['linear-mesh6-v1'] : []), ");
    const enabled = alwaysCoarse ? 'true' : "typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('meshTrial') === 'coarse'";
    return `const coarseLinearEnabled = () => ${enabled};\n` + source;
}
