import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseTaskBoard } from '../tools/portal-content.mjs';
import { renderIntegrated } from '../tools/integrated-portal.mjs';
import { composeLibrary } from '../tools/portal-library.mjs';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const vendor = 'scripts/vendor/hub-standard/1.0.0';
const require = createRequire(import.meta.url);
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const plain = text => text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*/g, '');

export function checkVendor() {
  const lock = JSON.parse(read(`${vendor}/lock.json`));
  const names = ['portal.cjs', 'schema.cjs', 'project.schema.json', 'portal.css', 'build.cjs', 'verify.cjs'];
  if (lock.version !== '1.0.0' || !/^[a-f0-9]{40}$/.test(lock.hubCommit)
    || Object.keys(lock.files).sort().join() !== names.sort().join()) throw Error('Invalid standard lock');
  for (const [file, hash] of Object.entries(lock.files)) {
    if (sha(fs.readFileSync(path.join(root, vendor, file))) !== hash) throw Error(`Vendor changed: ${file}`);
  }
  if (sha(read(`${vendor}/REPO_STANDARD.md`)) !== lock.contractSha256) throw Error('Contract changed');
}

export function model(metadata, boardText, blockedText) {
  for (const reserved of ['tasks', 'decisions', 'status', 'nextAction']) {
    if (reserved in metadata) throw Error(`${reserved} must come from the canonical ledger`);
  }
  const board = parseTaskBoard(boardText);
  const seen = new Set();
  const tasks = board.queue.map(row => {
    if (seen.has(row.file)) throw Error(`Duplicate live task: ${row.file}`);
    seen.add(row.file);
    return {
      id: path.basename(row.file, '.md'), title: plain(row.name.split('：')[0]),
      status: row.section, owner: '未設定（要相談）', executor: '未設定（要相談）',
      deadline: '未設定（要相談）',
      notes: `${plain(row.name)}。根拠: .agents/tasks/TASKS.md → ${row.file}。IDは既存ファイル名。関連仕事の登録は同時開始や完了を意味しない。`,
    };
  });
  if (!tasks.length && /docs\/tasks\/active\//.test(boardText)) throw Error('Unrecognized live task ledger');
  const decisions = [];
  if (/レビュー|一時停止|HOLD/.test(board.summary)) decisions.push({
    id: 'queue-review', title: '共有キューの次段階を進める判断',
    status: plain(board.summary), owner: 'Yu（採用判断）', deadline: '未設定（要相談）',
    risk: '未採用の輪郭や美術を、通常保存・公開へ先行させない。',
    notes: `根拠: .agents/tasks/TASKS.md。${plain(board.next.join(' '))}`,
  });
  for (const line of blockedText.split(/\r?\n/)) {
    const match = line.match(/^\| ([^|]+) \| (\[[^\]]+\]\([^)]+\)) \| ([^|]+) \| ([^|]+) \|$/);
    if (!match) continue;
    decisions.push({
      id: `confirmation-${decisions.filter(d => d.id.startsWith('confirmation-')).length + 1}`,
      title: plain(match[2]), status: '確認条件待ち（二択の判断とは限らない）',
      owner: '未設定（要相談）', deadline: '未設定（要相談）',
      risk: plain(match[3].trim()), notes: `根拠: .agents/tasks/BLOCKED.md。次: ${plain(match[4].trim())}`,
    });
  }
  if (!decisions.some(d => d.id.startsWith('confirmation-')) && /^\| /m.test(blockedText)) {
    throw Error('Unrecognized blocked ledger');
  }
  return { ...metadata, status: plain(board.summary),
    nextAction: plain(board.next.join(' ')) || '共有キューで次の行動を確認する。', tasks, decisions };
}

export function project() {
  const metadata = JSON.parse(read('docs/portal/metadata.json'));
  const { standardOnlyDocs } = JSON.parse(read('docs/portal/legacy-boundary.json'));
  const expected = ['docs/portal/README.md', 'docs/maps/index.md',
    'docs/strategy/current-state-2026-10-15.md', 'docs/tasks/active/h-018.md'];
  if (!Array.isArray(standardOnlyDocs) || [...standardOnlyDocs].sort().join() !== expected.sort().join()
    || standardOnlyDocs.some(file => !metadata.docs.includes(file))) throw Error('Legacy/standard coverage gap');
  return require(`./vendor/hub-standard/1.0.0/schema.cjs`).assertProject(
    model(metadata, read('.agents/tasks/TASKS.md'), read('.agents/tasks/BLOCKED.md')),
  );
}

export function run(mode) {
  if (Number(process.versions.node.split('.')[0]) < 24) throw Error('Standard portal requires Node.js 24+');
  checkVendor();
  const data = project(), text = JSON.stringify(data, null, 2) + '\n';
  const common = require('./vendor/hub-standard/1.0.0/portal.cjs');
  const core = renderIntegrated(root, data, common.render(root, data), common);
  const home = core.get('index.html');
  const files = require('./vendor/portal-integration/1.0.2/adapter.cjs').apply(root, core);
  composeLibrary(root,files,home);
  require('./vendor/portal-reader/1.1.3/adapter.cjs').enhance(root,files,{sources:['scripts/standard-portal.mjs']});
  require('./vendor/portal-ui/1.0.2/adapter.cjs').enhance(root,files,{slug:'sansu',sources:['scripts/standard-portal.mjs']});
  // Keep the complete generated registry below GitHub's per-file size limit.
  const registry = files.get('data/unification.json');
  if (registry) files.set('data/unification.json', JSON.stringify(JSON.parse(registry)) + '\n');
  files.set('.generated-by-hub-standard', '1.0.0\n');
  const out = path.join(root, 'portal');
  common.noSymlinks(root, out);
  if (mode === 'build') {
    if (fs.existsSync(out)) {
      common.walk(out);
      if (!fs.existsSync(path.join(out, '.generated-by-hub-standard'))) throw Error('Unowned portal');
    }
    fs.writeFileSync(path.join(root, 'docs/portal/project.json'), text);
    fs.rmSync(out, { recursive: true, force: true });
    for (const [file, content] of files) {
      fs.mkdirSync(path.dirname(path.join(out, file)), { recursive: true });
      if (typeof content === 'string' || Buffer.isBuffer(content)) fs.writeFileSync(path.join(out, file), content);
      else fs.copyFileSync(path.join(root, content.source), path.join(out, file));
    }
    return { status: 'PASS', files: files.size };
  }
  if (mode === 'verify') {
    if (read('docs/portal/project.json') !== text) throw Error('Stale adapter: run npm run portal:build');
    const actual = common.walk(out).map(file => path.relative(out, file));
    const stale = [...files].filter(([file, content]) => !fs.existsSync(path.join(out, file)) || (Buffer.isBuffer(content) ? !fs.readFileSync(path.join(out,file)).equals(content) : (typeof content === 'string'
      ? fs.readFileSync(path.join(out, file), 'utf8') !== content
      : sha(fs.readFileSync(path.join(out, file))) !== content.sha256)));
    if (stale.length || actual.some(file => !files.has(file))) throw Error(`Stale portal: ${stale.length} changed/missing or extra files`);
    return { status: 'PASS', files: files.size };
  }
  throw Error('Usage: node scripts/standard-portal.mjs build|verify');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(run(process.argv[2])));
}
