import ts from 'typescript';

const relativeStore = id => id.includes('/components/')
    ? '../../../../docs/design/2026-10-23-place-method-comparison/timing-store'
    : '../../../docs/design/2026-10-23-place-method-comparison/timing-store';
const cases = [
    ['/domain/growingIsland/commands.ts', 'applyIntent', 'function', 'intent.command.type'],
    ['/domain/growingIsland/editableTerrainWorld.ts', 'editableIslandWorld', 'function', "'no-terrain'"],
    ['/domain/growingIsland/worldDefinition.ts', 'compileWorldDefinition', 'function', "edgeBuilder ? 'derived-edges' : 'supplied-edges'"],
    ['/components/island/growing/GrowingWorld.tsx', 'rebuild', 'variable', "''"],
    ['/components/island/growing/worldScene.ts', 'layout', 'property', "''"],
];

/** Apply LAST, after the trial's existing transforms, including single-compile.
 * Source AST boundaries preserve return/throw semantics; mismatch fails closed. */
export function trialTimingTransform(source, id) {
    const spec = cases.find(([suffix]) => id.endsWith(suffix)); if (!spec) return source;
    if (source.includes('__trialTimingToken') || source.includes('trialTimingEnter')) throw Error(`Timing already transformed: ${id}`);
    const [, name, kind, detail] = spec;
    if (name === 'compileWorldDefinition' && !source.includes('edgeBuilder?: (geometry: WorldGeometryQueries)')) throw Error('Timing expects current single-compile world transform');
    const ast = ts.createSourceFile(id, source, ts.ScriptTarget.Latest, true, id.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const matches = [];
    const visit = node => {
        if (kind === 'function' && ts.isFunctionDeclaration(node) && node.name?.text === name && node.body) matches.push(node.body);
        if (kind === 'variable' && ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name
            && node.initializer && ts.isArrowFunction(node.initializer) && ts.isBlock(node.initializer.body)) matches.push(node.initializer.body);
        if (kind === 'property' && ts.isPropertyAssignment(node) && node.name.getText(ast) === name
            && ts.isArrowFunction(node.initializer) && ts.isBlock(node.initializer.body)) matches.push(node.initializer.body);
        ts.forEachChild(node, visit);
    };
    visit(ast); if (matches.length !== 1) throw Error(`Timing ${name}: expected one body, found ${matches.length}`);
    const body = matches[0], start = body.getStart(ast) + 1, end = body.getEnd() - 1;
    let contents = source.slice(start, end);
    if (name === 'editableIslandWorld') {
        const cacheReturn = 'if (previous) return previous;';
        if (contents.split(cacheReturn).length !== 2) throw Error('Timing editable cache guard changed');
        contents = contents.replace(cacheReturn, "if (previous) { trialTimingDetail(__trialTimingToken, 'cache-hit'); return previous; }\n    trialTimingDetail(__trialTimingToken, 'cold');");
    }
    const label = kind === 'variable' ? 'GrowingWorld.rebuild' : kind === 'property' ? 'worldScene.layout' : name;
    const wrapped = `\nconst __trialTimingToken = trialTimingEnter('${label}', ${detail});\nlet __trialTimingFailed = false;\ntry {${contents}\n} catch (__trialTimingError) { __trialTimingFailed = true; throw __trialTimingError; } finally { trialTimingExit(__trialTimingToken, __trialTimingFailed); }\n`;
    return `import { trialTimingEnter, trialTimingExit${name === 'editableIslandWorld' ? ', trialTimingDetail' : ''} } from '${relativeStore(id)}';\n`
        + source.slice(0, start) + wrapped + source.slice(end);
}
