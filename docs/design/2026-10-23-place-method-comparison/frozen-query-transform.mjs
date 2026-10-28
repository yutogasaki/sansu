import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const trial = 'docs/design/2026-10-23-place-method-comparison/';
const targets = new Map([
    ['src/domain/growingIsland/editableTerrainWorld.ts', 3],
    ['src/domain/growingIsland/placeTerrain.ts', 1],
    ['src/domain/growingIsland/landscape.ts', 1],
    ['src/domain/growingIsland/commands.ts', 1],
    ['src/components/island/growing/worldScene.ts', 1],
    [trial + 'candidate.ts', 1],
    [trial + 'comparison-camera.ts', 2],
    [trial + 'TrialIsland.ts', 2],
    [trial + 'TrialEvidence.tsx', 2],
    [trial + 'TrialCadence.tsx', 2],
    [trial + 'LiveUse.tsx', 2],
]);

/** Apply LAST, after the actual method/base/ramp/single/curved/growth adapters.
 * Only the listed experiment modules are touched. Production files on disk are
 * unchanged. Revision strings stay identical: this removes repeated parsing,
 * not a geometry choice. The build revision identifies this implementation. */
export function frozenQueryTransform(source, id) {
    const filename = id.split('?')[0];
    const target = [...targets].find(([suffix]) => filename.endsWith('/' + suffix));
    const section = filename.endsWith('/' + trial + 'section-profile.ts');
    if (!target && !section) return source;
    const imports = 'trialQuery';
    if (section) {
        const signature = "export function terrainMethod(search = typeof window === 'undefined' ? '' : window.location.search): TerrainMethod {";
        const query = "const requested = new URLSearchParams(search).get('terrainTrial');";
        if (source.split(signature).length !== 2 || source.split(query).length !== 2) throw Error('Frozen query section-profile source mismatch');
        source = source.replace(signature, 'export function terrainMethod(search?: string): TerrainMethod {')
            .replace(query, "const requested = (search === undefined ? trialQuery() : new URLSearchParams(search)).get('terrainTrial');");
    } else {
        const expression = /new URLSearchParams\((?:window\.)?location\.search\)/g;
        const matches = [...source.matchAll(expression)];
        if (matches.length !== target[1]) throw Error(`Frozen query source mismatch: ${target[0]} expected ${target[1]}, got ${matches.length}`);
        source = source.replace(expression, 'trialQuery()');
    }
    let modulePath = path.relative(path.dirname(filename), path.join(directory, 'frozen-query')).replaceAll(path.sep, '/');
    if (!modulePath.startsWith('.')) modulePath = './' + modulePath;
    return `import { ${imports} } from '${modulePath}';\n` + source;
}
