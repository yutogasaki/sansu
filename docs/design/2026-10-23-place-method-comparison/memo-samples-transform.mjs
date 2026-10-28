function replaceOnce(source, before, after) {
    if (source.split(before).length !== 2) throw Error(`Memo samples source mismatch: ${before.slice(0, 100)}`);
    return source.replace(before, after);
}

/** Trial-only exact memoization. Apply after method/base/ramp/single/timing and
 * before frozenQueryTransform. No coordinate rounding or cross-build cache.
 * The optional Node override is explicit; the browser uses memoTrial=samples. */
export function memoSamplesTransform(source, { alwaysMemo } = {}) {
    const enabled = alwaysMemo === undefined ? "memoTrialQuery().get('memoTrial') === 'samples'" : String(Boolean(alwaysMemo));
    source = replaceOnce(source,
        'const source = original.definition.districts[0], bounds = landBounds(state);',
        `const source = original.definition.districts[0], bounds = landBounds(state);
    const memoSamplesEnabled = ${enabled};
    const projectSample = memoSamplesEnabled && curved ? memoTerrainSamples(landscapePoint) : landscapePoint;`);
    source = replaceOnce(source,
        'const sample = (p: Cell) => curved ? landscapePoint(p) : p;',
        'const sample = (p: Cell) => curved ? projectSample(p) : p;');
    source = replaceOnce(source,
        'const baselineSurfaceHeightFor = (input: TerrainLand, cell: Cell) => {',
        'const calculateSurfaceHeightFor = (input: TerrainLand, cell: Cell) => {');
    source = replaceOnce(source,
        '    const baselineSurfaceHeight = (cell: Cell) => baselineSurfaceHeightFor(state, cell);',
        `    // C/G may pass zero-height or other inputs. Their sample values must
    // never share a coordinate-only cache with the edited input.
    const heightSamples = new WeakMap<TerrainLand, (cell: Cell) => number>();
    const baselineSurfaceHeightFor = (input: TerrainLand, cell: Cell): number => {
        if (!memoSamplesEnabled) return calculateSurfaceHeightFor(input, cell);
        let sample = heightSamples.get(input);
        if (!sample) { sample = memoTerrainSamples(cell => calculateSurfaceHeightFor(input, cell)); heightSamples.set(input, sample); }
        return sample(cell);
    };
    const baselineSurfaceHeight = (cell: Cell) => baselineSurfaceHeightFor(state, cell);`);
    const helper = `
// Each factory belongs to one synchronous cold world build. Values are read
// only by scalar interpolation or copied into vertices; none is published as
// a mutable cache value. Number Map keys preserve every finite double; -0 gets
// a distinct key because Map's default SameValueZero would merge it with +0.
function memoTerrainSamples<T>(sample: (cell: Cell) => T): (cell: Cell) => T {
    const rows = new Map<number | string, Map<number | string, { value: T }>>();
    return cell => {
        const x = Object.is(cell.x, -0) ? '-0' : cell.x;
        const z = Object.is(cell.z, -0) ? '-0' : cell.z;
        let row = rows.get(x);
        const known = row?.get(z); if (known) return known.value;
        const value = sample(cell);
        if (!row) { row = new Map(); rows.set(x, row); }
        row.set(z, { value }); return value;
    };
}
`;
    return (alwaysMemo === undefined
        ? "import { trialQuery as memoTrialQuery } from '../../../docs/design/2026-10-23-place-method-comparison/frozen-query';\n"
        : '') + source + helper;
}
