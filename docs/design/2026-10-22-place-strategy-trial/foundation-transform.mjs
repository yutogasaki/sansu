export function foundationTransform(source) {
    const needle = 'offset * TERRAIN_STEP;';
    if (!source.includes(needle)) throw Error('Editable floor changed; re-review the foundation experiment');
    return "import { foundationEditWeight } from '../../../docs/design/2026-10-22-place-strategy-trial/foundation';\n"
        + source.replace(needle, 'offset * TERRAIN_STEP * foundationEditWeight(state, cell);');
}

export function foundationCommandTransform(source) {
    const needle = 'const before = terrain.heights[key(command.cell)]';
    if (!source.includes(needle)) throw Error('Terrain commands changed; re-review the foundation experiment');
    return "import { foundationEditWeight } from '../../../docs/design/2026-10-22-place-strategy-trial/foundation';\n"
        + source.replace(needle, "if (foundationEditWeight(state, command.cell) === 0) fail('おうちと ふなつきばの 足もとは そのままに しよう。');\n        " + needle);
}
