const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {assertProject} = require('./schema.cjs');
const VERSION = '1.0.0'; // Separate from the immutable KeepGoing v1 payload.
const sections = [['overview','概要'],['decisions','判断待ち'],['tasks','タスク'],['documents','資料'],['ai','AI の入口']];
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inside = (root, file) => file === root || file.startsWith(root + path.sep);
function noSymlinks(root, file) {
  if (!inside(root, file)) throw new Error('Path outside repository');
  let current = root;
  for (const part of ['', ...path.relative(root, file).split(path.sep)]) {
    current = path.join(current, part);
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Symlink rejected'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
}
function safeSource(repo, relative) {
  if (!relative || /[\\:#?\x00-\x1f]/.test(relative) || path.isAbsolute(relative) || relative.split('/').some(p => ['','..','.'].includes(p))) throw new Error('Expected a repository-relative file');
  if (/^(?:portal|node_modules|\.git|\.env[^/]*)(?:\/|$)/i.test(relative) || /(?:^|\/)\.env(?:\.|$)|\.(?:pem|key|p12|pfx)$/i.test(relative)) throw new Error('Forbidden source');
  const file = path.resolve(repo, relative);
  noSymlinks(repo, file);
  if (!fs.statSync(file).isFile()) throw new Error('Expected a source file');
  if (!/\.(?:md|txt|json)$/i.test(file)) throw new Error('Only text reference files can be embedded');
  return file;
}
function walk(root) {
  return fs.readdirSync(root, {withFileTypes:true}).flatMap(e => {
    const p = path.join(root, e.name);
    if (e.isSymbolicLink()) throw new Error('Symlink rejected');
    return e.isDirectory() ? walk(p) : [p];
  });
}
function shell(title, body) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="generator" content="hub-standard-portal/${VERSION}"><title>${esc(title)}</title><link rel="stylesheet" href="${body.reference ? '../' : ''}portal.css"></head><body><a href="#main">本文へ</a><main id="main">${body.html}</main></body></html>\n`;
}
function render(repo, project) {
  assertProject(project);
  const files = new Map();
  const references = new Map();
  function ref(relative) {
    if (!references.has(relative)) {
      const source = safeSource(repo, relative);
      const target = `references/${crypto.createHash('sha256').update(relative).digest('hex')}.html`;
      const text = fs.readFileSync(source, 'utf8');
      files.set(target, shell(relative, {reference:true, html:`<a href="../index.html">概要へ</a><h1>${esc(relative)}</h1><p>原文の閲覧用コピー。指示の実行や検査の合格を意味しません。</p><pre>${esc(text)}</pre>`}));
      references.set(relative, target);
    }
    return `<a href="${references.get(relative)}">${esc(relative)}</a>`;
  }
  const paragraph = (label, value) => `<p><strong>${label}</strong> ${esc(value || '未確認')}</p>`;
  const items = (list, make) => list?.length ? `<ul>${list.map(x => `<li>${make(x)}</li>`).join('')}</ul>` : '<p>未登録（0件確認済みとは限りません）</p>';
  const body = [
    `<h1>${esc(project.title)}</h1><nav aria-label="章">${sections.map(([id,label]) => `<a href="#${id}">${label}</a>`).join(' · ')}</nav>`,
    `<section id="overview"><h2>概要</h2>${paragraph('説明',project.summary)}${paragraph('状態',project.status)}${paragraph('担当',project.owner)}${paragraph('次の行動',project.nextAction)}${paragraph('内容確認日',project.lastChecked)}${paragraph('記録更新日',project.updated)}${project.note ? paragraph('補足',project.note) : ''}</section>`,
    `<section id="decisions"><h2>判断待ち</h2>${items(project.decisions, d => `<h3>${esc(d.id)} ${esc(d.title)}</h3>${paragraph('状態',d.status)}${paragraph('担当',d.owner)}${paragraph('期限',d.deadline)}${paragraph('リスク',d.risk)}${d.notes ? paragraph('根拠・補足',d.notes) : ''}`)}</section>`,
    `<section id="tasks"><h2>タスク</h2>${items(project.tasks, t => `<h3>${esc(t.id)} ${esc(t.title)}</h3>${paragraph('状態',t.status)}${paragraph('担当',t.owner)}${paragraph('実行',t.executor)}${paragraph('開始',t.started)}${paragraph('期限',t.deadline)}${t.output ? `<p>成果物 ${ref(t.output)}</p>` : ''}${t.notes ? paragraph('補足',t.notes) : ''}`)}</section>`,
    `<section id="documents"><h2>資料</h2>${items(project.docs, ref)}${items(project.commits, esc)}</section>`,
    `<section id="ai"><h2>AI の入口</h2>${items(project.ai || ['AGENTS.md'], ref)}</section>`,
    '<footer>生成物は閲覧用です。正本・検証条件は各リポジトリにあります。生成日時と内容確認日は別です。</footer>'
  ].join('\n');
  files.set('index.html', shell(project.title, {html:body}));
  files.set('data/project.json', JSON.stringify(project, null, 2) + '\n');
  files.set('portal.css', fs.readFileSync(path.join(__dirname,'portal.css'),'utf8'));
  return files;
}
function load(repo, input = 'docs/portal/project.json') {
  repo = path.resolve(repo);
  const file = safeSource(repo, input);
  return {repo, project:assertProject(JSON.parse(fs.readFileSync(file,'utf8')))};
}
function build(repo, input) {
  const loaded = load(repo, input);
  const expected = render(loaded.repo, loaded.project); // Validate all inputs before any write.
  const out = path.join(loaded.repo, 'portal');
  noSymlinks(loaded.repo, out);
  if (fs.existsSync(out)) {
    walk(out); // Reject nested symlinks before deleting generated output.
    if (!fs.existsSync(path.join(out,'.generated-by-hub-standard'))) throw new Error('Existing portal is not owned by this builder');
    fs.rmSync(out, {recursive:true});
  }
  fs.mkdirSync(out, {recursive:true});
  fs.writeFileSync(path.join(out,'.generated-by-hub-standard'), VERSION + '\n');
  for (const [relative, text] of expected) {
    const file = path.join(out, relative);
    fs.mkdirSync(path.dirname(file), {recursive:true});
    fs.writeFileSync(file, text);
  }
  return {status:'PASS', files:expected.size};
}
function verify(repo, input) {
  const loaded = load(repo, input), expected = render(loaded.repo, loaded.project);
  const out = path.join(loaded.repo,'portal');
  noSymlinks(loaded.repo, out);
  const actual = walk(out).map(f => path.relative(out,f).split(path.sep).join('/'));
  expected.set('.generated-by-hub-standard', VERSION + '\n');
  const stale = [...expected].filter(([f, text]) => !fs.existsSync(path.join(out,f)) || fs.readFileSync(path.join(out,f),'utf8') !== text).map(([f]) => f);
  const extra = actual.filter(f => !expected.has(f));
  if (stale.length || extra.length) throw new Error(`Stale portal: ${stale.length} changed/missing, ${extra.length} extra. Rebuild from source.`);
  return {status:'PASS', files:expected.size};
}
module.exports = {VERSION, sections, esc, inside, noSymlinks, safeSource, walk, render, build, verify};
