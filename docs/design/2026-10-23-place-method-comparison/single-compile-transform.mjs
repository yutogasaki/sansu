function replaceOnce(source, before, after) {
    if (source.split(before).length !== 2) throw Error(`Single compile source mismatch: ${before.slice(0, 100)}`);
    return source.replace(before, after);
}

/** Build the immutable geometry/site indices first, derive edges against that
 * geometry, then validate and construct graphs once before publishing a world.
 * No published world or frozen definition is subsequently mutated. */
export function singleCompileWorldTransform(source) {
    source = replaceOnce(source, 'export function compileWorldDefinition(input: WorldDefinition) {',
        `export interface WorldGeometryQueries {
    readonly floors: readonly CompiledWorldFloor[];
    floorAt(cell: Cell, floorId?: string): WorldFloorSample | undefined;
    isWalkEdgeSupported(from: Cell, to: Cell): boolean;
}
export function compileWorldDefinition(input: WorldDefinition,
    edgeBuilder?: (geometry: WorldGeometryQueries) => WorldDefinition['edges']) {`);
    source = replaceOnce(source, "    const graphs = Object.fromEntries((['walk', 'join', 'water'] as const).map(kind => [kind, new Map<string, Set<string>>()]));",
        `    if (edgeBuilder) {
        requireWorld(definition.edges.length === 0, 'derived edges require an empty input graph');
        const generated = edgeBuilder(Object.freeze({ floors: freeze(floors),
            floorAt: (cell: Cell, floorId?: string) => sample(cell, false, floorId),
            isWalkEdgeSupported: (from: Cell, to: Cell) => !walkEdgeError(cells.get(cellKey(from)), cells.get(cellKey(to)), cell => sample(cell, false)) }));
        requireWorld(Array.isArray(generated), 'derived edges must be an array');
        definition.edges = structuredClone(generated);
    }
    const graphs = Object.fromEntries((['walk', 'join', 'water'] as const).map(kind => [kind, new Map<string, Set<string>>() ]));`);
    return source;
}

/** Apply after the actual terrain method/stable base/ramp transforms. Browser
 * selection is explicit; Node comparisons pass alwaysSingle: true. */
export function singleCompileTerrainTransform(source, { alwaysSingle = false } = {}) {
    source = replaceOnce(source, '    const geometry = compileWorldDefinition(definition);',
        "    const buildEdges = (geometry: WorldGeometryQueries): WorldDefinition['edges'] => {");
    source = replaceOnce(source, '    const world = compileWorldDefinition({ ...definition, edges });',
        `    return edges;
    };
    const world = singleCompileEnabled() ? compileWorldDefinition(definition, buildEdges)
        : compileWorldDefinition({ ...definition, edges: buildEdges(compileWorldDefinition(definition)) });`);
    source = replaceOnce(source, 'export function editableTerrainSegmentSupported(world: IslandWorld, from: Cell, to: Cell, radius = .18): boolean {',
        "export function editableTerrainSegmentSupported(world: Pick<WorldGeometryQueries, 'floors' | 'floorAt'>, from: Cell, to: Cell, radius = .18): boolean {");
    const enabled = alwaysSingle ? 'true' : "typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('compileTrial') === 'single'";
    return `import type { WorldGeometryQueries } from './worldDefinition';\nconst singleCompileEnabled = () => ${enabled};\n` + source;
}
