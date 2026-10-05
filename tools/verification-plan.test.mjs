import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildPlan, changedPaths, commandCoverage, formatPlan, main, parseMatrix, parseOptions } from './verification-plan.mjs';

const matrix = parseMatrix(fs.readFileSync(new URL('../docs/ai/verification_matrix.md', import.meta.url), 'utf8'));
const scripts = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts;
const fixtures = [];
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const write = (root, file, text) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
};
function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sansu-plan-test-'));
    fixtures.push(root);
    git(root, 'init', '-q');
    write(root, 'docs/base.md', 'baseline');
    write(root, 'docs/deleted.md', 'deleted');
    write(root, 'docs/renamed.md', 'rename');
    write(root, '.gitignore', 'ignored/\n');
    write(root, 'docs/ai/verification_matrix.md', fs.readFileSync(new URL('../docs/ai/verification_matrix.md', import.meta.url), 'utf8'));
    write(root, 'package.json', JSON.stringify({ scripts }));
    git(root, 'add', '.');
    git(root, '-c', 'user.name=Plan Test', '-c', 'user.email=plan@example.invalid', 'commit', '-qm', 'baseline');
    return root;
}
afterEach(() => { for (const root of fixtures.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

describe('verification plan boundaries', () => {
    it('keeps docs-only work lightweight and retains the behavior-text exception', () => {
        const plan = buildPlan(['docs/product/01_app_spec.md', '.agents/tasks/DONE.md'], matrix, scripts);
        expect(plan.commands).toEqual(['npm run docs:check']);
        expect(plan.categories[0].notes).toContain('behavior text changed');
        expect(plan.checksExecuted).toBe(false);
        expect(plan.releaseEvaluated).toBe(false);
    });
    it('unions mixed risks, keeps target boundaries and preserves targeted tests', () => {
        const plan = buildPlan(['src/App.tsx', 'src/domain/growingIsland/guidance.repository.ts', 'src/pwa.ts', 'docs/index.md'], matrix, scripts);
        expect(plan.risks.sort()).toEqual(['pwa', 'routing', 'storage']);
        expect(plan.commands).toContain('npm run verify:core');
        expect(plan.commands).toContain('npm run e2e:pwa-two-build');
        expect(plan.commands).toContain('npx vitest run src/domain/growingIsland/guidance.test.ts src/domain/growingIsland/guidance.repository.test.ts');
        expect(plan.commands).not.toContain('npm run build');
        expect(plan.covered.find(item => item.command === 'npm run docs:check').by).toContain('npm run verify:core');
        expect(plan.categories.find(row => row.category === 'PWA/deploy/update flow').notes).toContain('classic build');
        expect(plan.specs).toContain('docs/product/13_data_storage_migration_spec.md');
    });
    it('adds independent visual gates for runtime assets', () => {
        const plan = buildPlan(['public/assets/home.glb'], matrix, scripts);
        expect(plan.categories[0].category).toBe('Image-led UI / encounter');
        expect(plan.categories[0].notes).toContain('silent comprehension/safety');
        expect(plan.commands).toContain('npm run benchmark:fixed-ten');
    });
    it('retains prose requirements that are not executable commands', () => {
        const plan = buildPlan(['src/domain/explore/reducer.ts'], matrix, scripts);
        expect(plan.categories[0].additionalRequired).toBe('targeted reducer/generator tests');
        expect(formatPlan({ ...plan, scope: 'test' })).toContain('追加必須: targeted reducer/generator tests');
    });
    it('requires core and classification for unknown files, but nothing for an empty diff', () => {
        const plan = buildPlan(['new-runtime.xyz'], matrix, scripts);
        expect(plan.unknown).toEqual(['new-runtime.xyz']);
        expect(plan.commands).toEqual(['npm run verify:core']);
        expect(plan.cautions.some(note => note.includes('担当者'))).toBe(true);
        expect(buildPlan([], matrix, scripts).commands).toEqual([]);
    });
    it('reads changed matrix commands and manual requirements instead of freezing copies', () => {
        const updated = new Map(matrix);
        updated.set('Docs only', { ...updated.get('Docs only'), commands: ['npm run docs:custom'], manual: 'new manual rule' });
        const plan = buildPlan(['docs/new.md'], updated, { ...scripts, 'docs:custom': 'node check.mjs' });
        expect(plan.commands).toEqual(['npm run docs:custom']);
        expect(plan.categories[0].manual).toBe('new manual rule');
    });
    it('fails on missing required matrix rows or package commands', () => {
        const missing = new Map(matrix);
        missing.delete('Storage/schema/profile data');
        expect(() => buildPlan(['src/domain/user/repository.ts'], missing, scripts)).toThrow('Storage/schema/profile data');
        expect(() => buildPlan(['docs/a.md'], matrix, {})).toThrow('docs:check');
        expect(() => parseMatrix('# missing table')).toThrow('Change Type');
    });
    it('only attributes explicit standalone calls and rejects cyclic scripts', () => {
        expect(commandCoverage('npm run wrapper', { wrapper: 'if true; then npm run child; fi', child: 'node c.mjs' })).toEqual([]);
        expect(commandCoverage('npm run wrapper', { wrapper: 'FLAG=true npm run child', child: 'node c.mjs' })).toEqual([]);
        expect(commandCoverage('npm run wrapper', { wrapper: "node -e 'text && npm run child && text'", child: 'node c.mjs' })).toEqual([]);
        expect(commandCoverage('npm run wrapper', { wrapper: 'exit 0 && npm run child', child: 'node c.mjs' })).toEqual([]);
        expect(() => commandCoverage('npm run a', { a: 'npm run b', b: 'npm run a' })).toThrow('循環');
    });
    it('rejects ambiguous or unknown options', () => {
        expect(() => parseOptions(['--staged', '--base', 'main'])).toThrow('同時');
        expect(() => parseOptions(['--base', '--json'])).toThrow('基準commit');
        expect(() => parseOptions(['--execute'])).toThrow('不明');
        expect(parseOptions(['--base', 'origin/main', '--json']).base).toBe('origin/main');
    });
});

describe('Git scope and read-only CLI', () => {
    it('includes staged, unstaged, untracked, deleted and both rename paths, excludes ignored files', () => {
        const root = fixture();
        write(root, 'docs/base.md', 'stage');
        git(root, 'add', 'docs/base.md');
        write(root, 'docs/unstaged.md', 'new');
        write(root, 'ignored/secret.env', 'private');
        fs.unlinkSync(path.join(root, 'docs/deleted.md'));
        git(root, 'mv', 'docs/renamed.md', 'docs/new-name.md');
        const all = changedPaths(root, parseOptions([])).paths;
        expect(all).toEqual(['docs/base.md', 'docs/deleted.md', 'docs/new-name.md', 'docs/renamed.md', 'docs/unstaged.md']);
        const staged = changedPaths(root, parseOptions(['--staged'])).paths;
        expect(staged).toEqual(['docs/base.md', 'docs/new-name.md', 'docs/renamed.md']);
    });
    it('resolves a commit ref safely and includes later commits plus working changes', () => {
        const root = fixture();
        const base = git(root, 'rev-parse', 'HEAD').trim();
        write(root, 'docs/base.md', 'new commit');
        git(root, 'add', '.');
        git(root, '-c', 'user.name=Plan Test', '-c', 'user.email=plan@example.invalid', 'commit', '-qm', 'second');
        write(root, 'docs/new.md', 'untracked');
        const result = changedPaths(root, parseOptions(['--base', base]));
        expect(result.resolvedBase).toBe(base);
        expect(result.paths).toEqual(['docs/base.md', 'docs/new.md']);
        expect(() => changedPaths(root, parseOptions(['--base', 'missing-ref']))).toThrow();
    });
    it('uses staged contracts, and leaves index/working contents unchanged', () => {
        const root = fixture();
        write(root, 'docs/base.md', 'changed');
        git(root, 'add', 'docs/base.md');
        write(root, 'package.json', '{invalid unstaged json');
        write(root, 'docs/ai/verification_matrix.md', 'invalid unstaged table');
        const tree = git(root, 'write-tree');
        const status = git(root, 'status', '--porcelain=v1', '-z');
        const result = JSON.parse(main(['--staged', '--json'], root));
        expect(result.scope).toBe('staged');
        expect(result.commands).toEqual(['npm run docs:check']);
        expect(result.status).toBe('ADVISORY');
        expect(git(root, 'write-tree')).toBe(tree);
        expect(git(root, 'status', '--porcelain=v1', '-z')).toBe(status);
        expect(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).toBe('{invalid unstaged json');
        expect(fs.existsSync(path.join(root, 'dist'))).toBe(false);
    });
    it('rejects missing related specs and escapes unusual filenames in text', () => {
        const root = fixture();
        write(root, 'src/App.tsx', 'changed');
        expect(() => main([], root)).toThrow('関連仕様');
        const plan = buildPlan(['docs/line\nbreak.md'], matrix, scripts);
        expect(formatPlan({ ...plan, scope: 'test' })).toContain('"docs/line\\nbreak.md"');
    });
});
