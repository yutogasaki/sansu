function replaceOnce(source, before, after) {
    if (source.split(before).length !== 2) throw Error(`Stable base source mismatch: ${before.slice(0, 100)}`);
    return source.replace(before, after);
}
const condition = always => always ? 'true' : "typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('baseTrial') === 'stable'";

/** Replace the shared base provider, not just editable-floor rendering. */
export function stableBaseTerrainTransform(source, { alwaysStable = false } = {}) {
    const signature = "export function baseTerrainHeightAt(state: Pick<GrowingState, 'land'>, cell: Cell): number {";
    source = replaceOnce(source, signature,
        `${signature}\n    if (stableBaseEnabled()) return stableBaseHeightAt(cell);`);
    return "import { stableBaseHeightAt } from '../../../docs/design/2026-10-23-place-method-comparison/stable-base-field';\n"
        + `const stableBaseEnabled = () => ${condition(alwaysStable)};\n` + source;
}

/** Apply after terrainMethodTransform so the actual world cache/revision names
 * the changed base even though its saved input format is unchanged. */
export function stableBaseWorldTransform(source, { alwaysStable = false } = {}) {
    source = replaceOnce(source, 'return JSON.stringify([mode ===',
        'return JSON.stringify([stableBaseEnabled() ? STABLE_BASE_REVISION : null, mode ===');
    return "import { STABLE_BASE_REVISION } from '../../../docs/design/2026-10-23-place-method-comparison/stable-base-field';\n"
        + `const stableBaseEnabled = () => ${condition(alwaysStable)};\n` + source;
}
