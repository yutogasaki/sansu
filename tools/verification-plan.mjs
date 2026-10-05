import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MATRIX = 'docs/ai/verification_matrix.md';
const product = name => `docs/product/${name}.md`;
const parentSpec = product('01_app_spec');
const storageSpec = product('13_data_storage_migration_spec');
const growingSpec = product('52_growing_island_game_spec');
const navigationSpec = product('43_island_navigation_spec');
const learningSpecs = [product('29_learning_progression_spec'), product('31_learning_units_spec')];

// Required commands and manual checks belong to the matrix, not these path hints.
export const rules = [
    { category: 'Docs only', reason: '文書・共有運用・生成ポータル',
        match: f => /^(docs\/|design-system\/)/.test(f) || /^(?:\.agents|\.claude|\.codex)\/.*\.(?:md|html)$/.test(f) || /^(?:AGENTS|CLAUDE|CONSTITUTION|README)\.md$/.test(f), specs: [] },
    { category: 'Verification tooling / test harness', reason: '検証・依存・build設定',
        match: f => /^(?:tools|tests|\.github)\//.test(f) || /^(?:package(?:-lock)?\.json|[^/]*config\.[^/]+|\.nvmrc|\.gitignore)$/.test(f), specs: [MATRIX] },
    { category: 'App routing', risk: 'routing', reason: '入口・route・レイアウト',
        match: f => /^src\/(?:App|main)\./.test(f) || /(?:^|\/)(?:LaunchRoute|Layout|routes|router)\./i.test(f), specs: [parentSpec, navigationSpec] },
    { category: 'Shared UI component', reason: '画面間で共有するUI',
        match: f => /^src\/components\//.test(f) && !/^src\/components\/(?:island|explore|natureTown|battle)\//.test(f), specs: [product('07_ui_design_guideline')] },
    { category: 'Page-level UI/state', reason: '画面・画面状態',
        match: f => /^src\/pages\//.test(f), specs: [parentSpec, product('06_screen_specs')] },
    { category: 'Learning/domain logic', reason: '学習・出題・進行',
        match: f => /^src\/(?:domain|hooks|utils)\/.*(?:learning|math|english|srs|planner|curriculum|grading|problem|session|levelProgression|finish|battle|challenge)/i.test(f), specs: learningSpecs },
    { category: 'Exploration pure domain', reason: '探索ルール',
        match: f => /^src\/domain\/explore\//.test(f), specs: [product('10_exploration_game_spec'), product('11_learning_integration_spec')] },
    { category: 'Exploration page/routing', risk: 'routing', reason: '探索画面・導線',
        match: f => /^src\/components\/explore\//.test(f) || /^src\/pages\/Explore\./.test(f), specs: [product('12_screen_flow_spec')] },
    { category: 'Mystic Island domain/page/storage', risk: 'storage', reason: '従来Island/Life、または島の共通入口',
        match: f => /^src\/domain\/(?:island|islandLife)\//.test(f) || /^src\/components\/island\/(?!growing\/)/.test(f) || /^src\/pages\/Island\./.test(f), specs: [navigationSpec] },
    { category: 'Build-and-play domain/page/storage', risk: 'storage', reason: '制作あそび',
        match: f => /^src\/domain\/park\//.test(f), specs: [parentSpec] },
    { category: 'Growing Island balance/storage', risk: 'storage', reason: '育つ島のルール・表示、または島の共通入口',
        match: f => /^src\/domain\/growingIsland\//.test(f) || /^src\/components\/island\/growing\//.test(f) || /^src\/pages\/Island\./.test(f), specs: [growingSpec] },
    { category: 'Growing Island guidance v1', reason: '育つ島の導き・本・記念',
        match: f => /^src\/(?:domain\/growingIsland|components\/island\/growing)\/.*(?:guidance|Guide|Book|OpeningPreparation)/i.test(f), specs: [product('island-starter-achievements-proposal')] },
    { category: 'Storage/schema/profile data', risk: 'storage', reason: '正本・保存・本人データ',
        match: f => /^src\/(?:db|domain\/user)\//.test(f) || /^src\/utils\/storage\./.test(f) || /^src\/.*(?:repository|writer|migration|profile)/i.test(f), specs: [storageSpec] },
    { category: 'PWA/deploy/update flow', risk: 'pwa', reason: '更新・cache・配信設定',
        match: f => /^src\/pwa[^/]*\./i.test(f) || /^vite\.config\./.test(f) || /^(?:vercel\.json|public\/(?:sw\.|manifest)|tools\/.*(?:pwa|two-build)|\.github\/workflows\/.*(?:deploy|release))/i.test(f), specs: [storageSpec, 'docs/runbooks/pwa-release.md'] },
    { category: 'Image-led UI / encounter', reason: 'runtime画像・3D素材',
        match: f => /^(?:public|src\/assets|assets)\/.*\.(?:png|jpe?g|webp|avif|svg|glb|gltf)$/i.test(f), specs: [product('07_ui_design_guideline'), 'design-system/MASTER.md'] },
];

export function parseOptions(args) {
    const options = { staged: false, base: null, json: false, help: false };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--staged') options.staged = true;
        else if (arg === '--json') options.json = true;
        else if (arg === '--help' || arg === '-h') options.help = true;
        else if (arg === '--base') {
            if (options.base !== null || !args[i + 1] || args[i + 1].startsWith('-')) throw new Error('--base に基準commitを一つ指定してください');
            options.base = args[++i];
        } else throw new Error(`不明な引数: ${arg}`);
    }
    if (options.staged && options.base !== null) throw new Error('--staged と --base は同時に使えません');
    return options;
}

function git(root, args) {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
}

export function changedPaths(root, options) {
    const base = options.base === null ? 'HEAD' : git(root, ['rev-parse', '--verify', '--end-of-options', `${options.base}^{commit}`]).trim();
    const diff = git(root, ['diff', '--no-ext-diff', '--name-only', '-z', '--no-renames', ...(options.staged ? ['--cached'] : []), base, '--']);
    const untracked = options.staged ? '' : git(root, ['ls-files', '--others', '--exclude-standard', '-z']);
    return { paths: [...new Set((diff + untracked).split('\0').filter(Boolean))].sort(), resolvedBase: base };
}

export function parseMatrix(markdown) {
    const lines = markdown.split('\n');
    const start = lines.findIndex(line => line.trim() === '| Change Type | Required Checks | Manual Checks | Notes |');
    if (start < 0) throw new Error('検証マトリクスのChange Type表がありません');
    const rows = new Map();
    for (const line of lines.slice(start + 2)) {
        if (!line.startsWith('|')) break;
        const cells = line.slice(1, line.lastIndexOf('|')).split(/(?<!\\)\|/).map(s => s.trim().replaceAll('\\|', '|'));
        if (cells.length !== 4 || rows.has(cells[0])) throw new Error(`検証マトリクスの行が不正です: ${line}`);
        const [category, required, manual, notes] = cells;
        const commands = [...required.matchAll(/`([^`]+)`/g)].map(m => m[1]);
        const extra = required.replace(/`[^`]+`/g, '').replace(/^[\s,]+|[\s,]+$/g, '').trim();
        rows.set(category, { category, commands, additionalRequired: extra, manual, notes });
    }
    return rows;
}

// Only standalone npm calls in an explicit && sequence imply coverage.
export function commandCoverage(command, scripts, seen = new Set()) {
    const name = /^npm run ([\w:-]+)$/.exec(command)?.[1];
    if (!name) return [];
    if (seen.has(name)) throw new Error(`npm scriptが循環しています: ${name}`);
    if (!(name in scripts)) throw new Error(`必要なnpm scriptがありません: ${name}`);
    const next = new Set([...seen, name]);
    const segments = scripts[name].split(/\s*&&\s*/).map(segment => segment.trim());
    // Quotes, shell control flow and early exits can make a later call conditional
    // or merely a string literal. Only a simple executable sequence is supported.
    if (!segments.every(segment => /^(?:npm run [\w:-]+|(?:node|tsc)(?: [\w./:-]+)+)$/.test(segment))) return [];
    return [...new Set(segments.flatMap(segment => {
        if (!/^npm run [\w:-]+$/.test(segment.trim())) return [];
        const call = segment.trim();
        return [call, ...commandCoverage(call, scripts, next)];
    }))];
}

export function buildPlan(paths, matrix, scripts) {
    const files = [...new Set(paths)].sort();
    const categories = [];
    for (const rule of rules) {
        const matched = files.filter(rule.match);
        if (!matched.length) continue;
        const row = matrix.get(rule.category);
        if (!row || !row.commands.length) throw new Error(`必要な検証マトリクス行がありません: ${rule.category}`);
        categories.push({ ...row, reason: rule.reason, files: matched, specs: rule.specs, risk: rule.risk ?? null });
    }
    const unknown = files.filter(file => !rules.some(rule => rule.match(file)));
    const required = [...new Set([...categories.flatMap(row => row.commands), ...(unknown.length ? ['npm run verify:core'] : [])])];
    const coverage = new Map(required.map(command => [command, commandCoverage(command, scripts)]));
    const covered = required.flatMap(command => {
        const by = required.filter(other => other !== command && coverage.get(other).includes(command));
        return by.length ? [{ command, by }] : [];
    });
    const commands = required.filter(command => !covered.some(item => item.command === command));
    // Reject an ambiguous circular script graph rather than silently proposing no checks.
    if (required.length && !commands.length) throw new Error('npm scriptの相互参照により検証を選べません');
    return {
        status: 'ADVISORY', checksExecuted: false, releaseEvaluated: false,
        files, categories, commands, covered, unknown,
        specs: [...new Set(categories.flatMap(row => row.specs))],
        risks: [...new Set(categories.map(row => row.risk).filter(Boolean))],
        cautions: [
            'パスからの案内です。挙動を変える仕様、画像主体の体験、公開候補は担当者が追加行を適用してください。',
            ...(unknown.length ? ['未分類ファイルあり: verify:coreに加え、担当者が影響と手動確認を分類してください。'] : []),
        ],
    };
}

export function formatPlan(plan) {
    const lines = ['ADVISORY — 検査は未実行。公開判定はしていません。', `対象: ${plan.scope} (${plan.files.length} files)`];
    if (!plan.files.length) return `${lines.join('\n')}\n差分なし。\n`;
    lines.push('\n必要コマンド:', ...plan.commands.map(command => `  ${command}`));
    if (plan.covered.length) lines.push('\n内包されるチェック:', ...plan.covered.map(item => `  ${item.command} ← ${item.by.join(', ')}`));
    if (plan.risks.length) lines.push(`\n高リスク: ${plan.risks.join(', ')}`);
    for (const row of plan.categories) {
        lines.push(`\n${row.category}: ${row.reason}`, ...row.files.map(file => `  ${JSON.stringify(file)}`));
        if (row.additionalRequired) lines.push(`  追加必須: ${row.additionalRequired}`);
        lines.push(`  手動: ${row.manual}`, `  注意: ${row.notes}`);
    }
    if (plan.unknown.length) lines.push('\n未分類:', ...plan.unknown.map(file => `  ${JSON.stringify(file)}`));
    if (plan.specs.length) lines.push('\n関連仕様:', ...plan.specs.map(file => `  ${file}`));
    lines.push('\n範囲:', ...plan.cautions.map(note => `  ${note}`));
    return `${lines.join('\n')}\n`;
}

export function main(args = process.argv.slice(2), cwd = process.cwd()) {
    const options = parseOptions(args);
    if (options.help) return 'Usage: npm run verify:plan -- [--staged | --base REF] [--json]\n検査を実行せず、必要な検証を案内します。\n';
    const root = git(cwd, ['rev-parse', '--show-toplevel']).trim();
    const changes = changedPaths(root, options);
    const read = file => options.staged ? git(root, ['show', `:${file}`]) : fs.readFileSync(path.join(root, file), 'utf8');
    const matrix = parseMatrix(read(MATRIX));
    const scripts = JSON.parse(read('package.json')).scripts;
    const plan = buildPlan(changes.paths, matrix, scripts);
    for (const spec of plan.specs) {
        if (options.staged) git(root, ['cat-file', '-e', `:${spec}`]);
        else if (!fs.existsSync(path.join(root, spec))) throw new Error(`関連仕様がありません: ${spec}`);
    }
    plan.scope = options.staged ? 'staged' : options.base !== null ? `working tree vs ${options.base}` : 'working tree vs HEAD';
    plan.resolvedBase = changes.resolvedBase;
    plan.matrix = MATRIX;
    return options.json ? `${JSON.stringify(plan, null, 2)}\n` : formatPlan(plan);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
    try { process.stdout.write(main()); }
    catch (error) { process.stderr.write(`verify:plan: ${error.message}\n`); process.exitCode = 1; }
}
