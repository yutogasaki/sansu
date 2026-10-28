function replaceOnce(source, before, after) {
    if (source.split(before).length !== 2) throw Error(`Edge check memo source mismatch: ${before.slice(0, 100)}`);
    return source.replace(before, after);
}

/** Apply after singleCompileWorldTransform and before timing/frozen-query.
 * Cache only the primitive result of one directed walk check against this
 * compilation's immutable geometry. Body corridors and graph validation remain.
 * No published query uses this cache; discard it before returning the world. */
export function edgeCheckMemoTransform(source) {
    if (source.includes('let edgeCheckMemo =')) throw Error('Edge check memo already transformed');
    source = replaceOnce(source, '    if (edgeBuilder) {', `    let edgeCheckMemo = edgeMemoTrialQuery().get('edgeTrial') === 'memo'
        ? new Map<string, string | undefined>() : undefined;
    const checkedWalkEdge = (from: CompiledWorldSite | undefined, to: CompiledWorldSite | undefined): string | undefined => {
        if (!edgeCheckMemo || !from || !to) return walkEdgeError(from, to, cell => sample(cell, false));
        const id = JSON.stringify([refKey(from.ref), refKey(to.ref)]);
        if (edgeCheckMemo.has(id)) return edgeCheckMemo.get(id);
        const error = walkEdgeError(from, to, cell => sample(cell, false));
        edgeCheckMemo.set(id, error); return error;
    };
    if (edgeBuilder) {`);
    source = replaceOnce(source,
        '            isWalkEdgeSupported: (from: Cell, to: Cell) => !walkEdgeError(cells.get(cellKey(from)), cells.get(cellKey(to)), cell => sample(cell, false)) }));',
        '            isWalkEdgeSupported: (from: Cell, to: Cell) => !checkedWalkEdge(cells.get(cellKey(from)), cells.get(cellKey(to))) }));');
    source = replaceOnce(source,
        '            const error = walkEdgeError(refs.get(a), refs.get(b), cell => sample(cell, false));',
        '            const error = checkedWalkEdge(refs.get(a), refs.get(b));');
    source = replaceOnce(source, "    const neighbors = (cell: Cell, passage: WorldPassage = 'walk'): Cell[] => {",
        "    edgeCheckMemo?.clear(); edgeCheckMemo = undefined;\n    const neighbors = (cell: Cell, passage: WorldPassage = 'walk'): Cell[] => {");
    return "import { trialQuery as edgeMemoTrialQuery } from '../../../docs/design/2026-10-23-place-method-comparison/frozen-query';\n" + source;
}
