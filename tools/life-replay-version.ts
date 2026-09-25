import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Conservative runtime dependency fingerprint; never trust a manually bumped version. */
export function lifeReplayVersion(root: string, environment: Record<string, string>,
    entries = ['src/domain/islandLife/simulation.ts', 'src/domain/islandLife/repository.ts', 'src/domain/islandLife/replaySnapshot.ts']) {
    const files = new Map<string, string>();
    const resolve = (base: string) => {
        const candidates = [base, ...['.ts', '.tsx', '.js', '.json', '/index.ts', '/index.tsx'].map(ext => base + ext)];
        const found = candidates.find(file => { try { return statSync(file).isFile(); } catch { return false; } });
        if (!found) throw new Error(`Unresolved replay dependency: ${base}`);
        return found;
    };
    const visit = (file: string) => {
        const relative = path.relative(root, file).split(path.sep).join('/');
        if (files.has(relative)) return;
        const source = readFileSync(file, 'utf8');
        files.set(relative, source);
        if (!/\.[cm]?[jt]sx?$/.test(file)) return;
        // Removing type-only imports avoids pulling UI callers through shared types.
        const runtime = ts.transpileModule(source, { fileName: file, compilerOptions: {
            module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext, jsx: ts.JsxEmit.ReactJSX,
        } }).outputText;
        const ast = ts.createSourceFile(file + '.js', runtime, ts.ScriptTarget.Latest, true);
        const check = (node: ts.Node) => {
            if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
                && (!node.arguments[0] || !ts.isStringLiteral(node.arguments[0]))) {
                throw new Error(`Nonliteral replay dependency: ${relative}`);
            }
            ts.forEachChild(node, check);
        };
        check(ast);
        for (const { fileName: specifier } of ts.preProcessFile(runtime, true, true).importedFiles) {
            if (specifier.startsWith('.')) visit(resolve(path.resolve(path.dirname(file), specifier)));
            else if (specifier.startsWith('@/')) visit(resolve(path.resolve(root, 'src', specifier.slice(2))));
            // Package implementations are pinned by the entire lockfile below.
        }
    };
    entries.forEach(entry => visit(resolve(path.resolve(root, entry))));
    // Compiler/alias/define changes can alter rules without changing their source.
    const buildInputs = ['vite.config.ts', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json',
        'tools/life-replay-version.ts'].map(name => {
        try { return [name, readFileSync(path.join(root, name), 'utf8')]; }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; return [name, null]; }
    });
    const payload = JSON.stringify({ format: 1, files: Array.from(files).sort(([a], [b]) => a.localeCompare(b)),
        buildInputs,
        lock: readFileSync(path.join(root, 'package-lock.json'), 'utf8'),
        environment: Object.entries(environment).sort(([a], [b]) => a.localeCompare(b)),
    });
    return `life-rules-v1:${createHash('sha256').update(payload).digest('hex')}`;
}
