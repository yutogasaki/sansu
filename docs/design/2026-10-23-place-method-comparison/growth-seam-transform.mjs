function replaceOnce(source, before, after) {
    if (source.split(before).length !== 2) throw Error(`Growth seam source mismatch: ${before.slice(0, 100)}`);
    return source.replace(before, after);
}
/** Trial-only acquisition transaction. Node tests explicitly select inheritance
 * and browser builds require growthTrial=inherit. No landscape mode dependency. */
export function growthSeamCommandTransform(source, { alwaysInherit = false } = {}) {
    const enabled = alwaysInherit ? 'true' : "typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('growthTrial') === 'inherit'";
    source = replaceOnce(source, 'function expand(state: GrowingState, side: Side) {',
        'function expand(state: GrowingState, side: Side) {\n    const seamBefore = growthSeamTrial() && state.terrain ? structuredClone(state) : undefined;');
    source = replaceOnce(source, '    if (state.growth) state.growth.expanded = true;\n    syncSoil(state);',
        '    if (state.growth) state.growth.expanded = true;\n    if (seamBefore) inheritGrowthBoundary(seamBefore, state);\n    syncSoil(state);');
    source = replaceOnce(source, '    state.applied = [...state.applied, intent.id].slice(-RULES.appliedMemory);\n    return { state, events };',
        "    if (intent.command.type === 'expand' && growthSeamTrial() && state.terrain) validateGrowthOwnerSupport(previous, state);\n    state.applied = [...state.applied, intent.id].slice(-RULES.appliedMemory);\n    return { state, events };");
    return "import { inheritGrowthBoundary, validateGrowthOwnerSupport } from '../../../docs/design/2026-10-23-place-method-comparison/growth-seam';\n"
        + `const growthSeamTrial = () => ${enabled};\n` + source;
}
