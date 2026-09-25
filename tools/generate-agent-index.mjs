import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith('.md') ? [`${dir}/${e.name}`] : []);
const title = file => read(file).match(/^# (.+)$/m)?.[1] || path.basename(file);
const href = (from, to) => path.relative(path.dirname(from), to).split(path.sep).map(encodeURIComponent).join('/');
const pages = [['.agents/index.html', '概要'], ['.agents/tasks/index.html', 'タスク'], ['docs/index.html', 'ドキュメント']];
const queue = (() => {
  let category = 'その他';
  const items = [];
  for (const line of read('.agents/tasks/TASKS.md').split('\n')) {
    const heading = line.match(/^### (.+)$/);
    if (heading) category = heading[1];
    const tableItem = line.match(/^\| ([^|]+?) \| \[(.+?)\]\(\.\.\/\.\.\/(docs\/tasks\/active\/[^\s)]+\.md)\) \| ([^|]+?) \| ([^|]+?) \|$/);
    const linkedItem = line.match(/^- \[(.+?)\]\(\.\.\/\.\.\/(docs\/tasks\/active\/[^\s)]+\.md)\)：(.+)$/);
    const legacyItem = line.match(/^- (.+?) -> (docs\/tasks\/active\/[^\s`]+\.md)\s*$/);
    if (tableItem) items.push({ name: `${tableItem[2]}：${tableItem[4]} 次：${tableItem[5]}`, file: tableItem[3], category: tableItem[1].trim() });
    else if (linkedItem) items.push({ name: `${linkedItem[1]}：${linkedItem[3]}`, file: linkedItem[2], category });
    else if (legacyItem) items.push({ name: legacyItem[1], file: legacyItem[2], category });
  }
  return items;
})();
const docs = walk('docs');
const docGroups = [
  {
    label: 'はじめに',
    description: '仕様・タスク・共有知識の入口。何を探すか迷ったときはここから。',
    matches: file => ['docs/index.md', 'docs/product/island-nature-integration.md', 'docs/product/README.md', 'docs/tasks/README.md', 'docs/wiki/index.md'].includes(file),
  },
  {
    label: '自然と町の仕組みの再利用資料',
    description: '旧Nature Townで検証した計算と操作。別の町として仕上げず、統合方針に従って今の島へ取り込む。',
    matches: file => file.startsWith('docs/product/nature-town/'),
  },
  {
    label: '仕様（何を作るか）',
    description: '製品、学習、画面、島、別モードのルール。現行・旧モード・試作の区別は「仕様書の地図」を参照。',
    matches: file => file.startsWith('docs/product/') && !file.startsWith('docs/product/archive/'),
  },
  {
    label: 'タスク（今何をするか）',
    description: '実行中の詳細、次の候補、過去のタスク資料。現在地は「現在のタスク一覧」を優先。',
    matches: file => file.startsWith('docs/tasks/') && !file.startsWith('docs/tasks/archive/'),
  },
  {
    label: '設計・実画面・検証記録',
    description: '特定の版や画面で確認した証拠。現行仕様や現在のタスクの代わりにはしない。',
    matches: file => file.startsWith('docs/design/'),
  },
  {
    label: '開発と検証のルール',
    description: '検証方針、共同作業、リリース、保存移行などの手順。',
    matches: file => file.startsWith('docs/ai/') || file.startsWith('docs/runbooks/'),
  },
  {
    label: '共有知識と設計判断',
    description: '複数の仕事で長く使う用語、リスク、分析、設計判断。',
    matches: file => file.startsWith('docs/wiki/') || file.startsWith('docs/adr/'),
  },
  {
    label: '過去の案・試作',
    description: '現在の作業から退避した資料。削除ではなく履歴の保管。今の仕様や開発指示として読まない。',
    matches: file => file.startsWith('docs/product/archive/') || file.startsWith('docs/tasks/archive/'),
  },
  {
    label: '完了履歴',
    description: '過去に完了した事実。現在の挙動は仕様書で確認する。',
    matches: file => file.startsWith('docs/done/'),
  },
];
function card(output, file, name = title(file), expanded = false) {
  const text = read(file);
  const excerpt = text.replace(/^---\n[\s\S]*?\n---\n/, '').split('\n').filter(l => l.trim() && !/^(#|\||```)/.test(l)).slice(0, 2).join(' ').slice(0, 210);
  return `<article class="card" data-search="${esc(`${name} ${file} ${expanded ? text : excerpt}`.toLowerCase())}"><h2><a href="${href(output, file)}">${esc(name)}</a></h2><p class="path">${esc(file)}</p><p>${esc(excerpt)}</p>${expanded ? `<details><summary>詳細を読む</summary><pre>${esc(text)}</pre></details>` : ''}</article>`;
}
function render([output, label]) {
  let content;
  if (label === '概要') {
    content = `<section class="intro"><p class="eyebrow">REPOSITORY OVERVIEW</p><h2>ぽこもこと不思議な島</h2><p>子どもがくり返し遊びたくなる、算数・英語の学習PWA。学習と島の暮らしをつなぎ、学習記録は端末内に保存します。</p><div class="stats"><span><strong>${queue.length}</strong> 実行キュー</span><span><strong>${docs.length}</strong> ドキュメント</span><span>React 19 / TypeScript / Vite / Dexie</span></div></section><h2 class="section-title">人向けの入口</h2><section class="grid">${['docs/index.md', 'docs/product/README.md', '.agents/tasks/TASKS.md', 'docs/tasks/backlog.md'].map(f => card(output, f)).join('')}</section><h2 class="section-title">開発ルールの入口</h2><section class="grid">${['CONSTITUTION.md', 'docs/product/01_app_spec.md', '.agents/agent-guide.md', 'docs/ai/verification_matrix.md', 'docs/ai/ownership_map.md'].map(f => card(output, f)).join('')}</section><section class="intro"><h2>ローカルで使う</h2><p>アプリの起動</p><pre>nvm use\nnpm ci\nnpm run dev</pre><p>このHTMLを更新 / 更新漏れを確認</p><pre>npm run agent:index\nnpm run agent:index:check</pre><p>HTMLは閲覧用の生成物です。内容を変えるときは元のMarkdownを編集して再生成してください。</p></section>`;
  } else if (label === 'タスク') {
    const categories = [...new Set(queue.map(item => item.category))];
    content = `<p>実行キューに登録された ${queue.length} 件。「何の話か／現在地／次の一手」で分類しています。登録は実装済み・公開済みを意味しません。</p>${categories.map(category => `<section class="doc-group"><h2 class="section-title">${esc(category)}</h2><div class="grid">${queue.filter(item => item.category === category).map(item => card(output, item.file, item.name, true)).join('')}</div></section>`).join('')}<h2 class="section-title">保留・計画・完了記録</h2><section class="grid">${['.agents/tasks/BLOCKED.md', 'docs/tasks/backlog.md', '.agents/tasks/DONE.md'].map(f => card(output, f, title(f), true)).join('')}</section>`;
  } else {
    const assigned = new Set();
    const sections = docGroups.map(group => {
      const files = docs.filter(file => !assigned.has(file) && group.matches(file));
      files.forEach(file => assigned.add(file));
      return { ...group, files };
    });
    const remaining = docs.filter(file => !assigned.has(file));
    if (remaining.length) sections.push({ label: 'その他', description: '上の分類に含まれない補助文書。', files: remaining });
    content = sections.filter(section => section.files.length).map(section => `<section class="doc-group"><h2 class="section-title">${esc(section.label)}</h2><p>${esc(section.description)}</p><div class="grid">${section.files.map(file => card(output, file)).join('')}</div></section>`).join('');
  }
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="generator" content="tools/generate-agent-index.mjs"><title>Sansu · ${label}</title><style>
:root{color-scheme:light;--ink:#213b35;--muted:#61736c;--line:#d8e1d9;--paper:#fffef9;--accent:#28634f}*{box-sizing:border-box}body{margin:0;background:#f3f5ef;color:var(--ink);font:15px/1.75 system-ui,-apple-system,sans-serif}a{color:var(--accent);text-underline-offset:4px}header{background:var(--paper);border-bottom:1px solid var(--line)}nav,main{max-width:1180px;margin:auto;padding:20px 28px}nav{display:flex;align-items:center;gap:24px;flex-wrap:wrap}nav strong{margin-right:auto;letter-spacing:.12em}nav a{text-decoration:none;padding:6px 2px}nav a[aria-current]{border-bottom:2px solid var(--accent);font-weight:700}main{padding-top:42px;padding-bottom:70px}h1{font-size:clamp(28px,5vw,44px);letter-spacing:-.035em;margin:0}h2{font-size:18px;line-height:1.5;margin:0 0 10px}p{margin:10px 0}.subtitle,.path,footer{color:var(--muted)}.eyebrow{font-size:12px;letter-spacing:.16em}.intro{padding:28px;background:#e7eee4;border:1px solid var(--line);border-radius:14px;margin:28px 0}.intro h2{font-size:26px}.stats{display:flex;flex-wrap:wrap;gap:24px;margin-top:22px}.stats strong{font-size:30px;margin-right:5px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.card{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:22px;overflow-wrap:anywhere}.path{font:12px/1.6 ui-monospace,monospace}.section-title{margin:32px 0 16px}label{display:block;font-weight:600;margin-top:24px}input{width:100%;font:inherit;padding:13px 16px;border:1px solid #93aa9b;border-radius:8px;background:var(--paper);margin:8px 0 24px;color:var(--ink)}summary{cursor:pointer;color:var(--accent);padding:10px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.8 ui-monospace,monospace;background:#f0f3ed;padding:16px;border-radius:8px;max-height:560px;overflow:auto}footer{margin-top:40px;font-size:13px}[hidden]{display:none!important}:focus-visible{outline:3px solid #b27523;outline-offset:4px}@media(max-width:640px){nav,main{padding-left:18px;padding-right:18px}nav{gap:16px}.grid{grid-template-columns:1fr}.intro{padding:20px}.card{padding:18px}}
</style></head><body><header><nav aria-label="メインナビゲーション"><strong>SANSU</strong>${pages.map(([f, n]) => `<a href="${href(output, f)}"${f === output ? ' aria-current="page"' : ''}>${n}</a>`).join('')}</nav></header><main><h1>${label}</h1><p class="subtitle">Sansu repository · Markdownから生成した閲覧用ポータル</p><label for="search">このページを検索</label><input id="search" type="search" placeholder="タイトル・ファイル名・キーワード"><p id="result" role="status" hidden></p>${content}<footer>正本は各カードのリンク先です。更新: <code>npm run agent:index</code> · <a href="${href(output, 'docs/runbooks/repository-portal.md')}">使い方</a></footer></main><script>
const search=document.querySelector('#search');const cards=[...document.querySelectorAll('[data-search]')];search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();let count=0;for(const card of cards){card.hidden=!card.dataset.search.includes(q);if(!card.hidden)count++;}for(const group of document.querySelectorAll('.doc-group'))group.hidden=![...group.querySelectorAll('.card')].some(card=>!card.hidden);const result=document.querySelector('#result');result.hidden=!q;result.textContent=count+' 件を表示';});
</script></body></html>\n`;
}
let stale = false;
for (const page of pages) {
  const html = render(page);
  const destination = path.join(root, page[0]);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== html) { console.error(`Stale: ${page[0]} — npm run agent:index`); stale = true; }
  } else { fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, html); console.log(`Generated: ${page[0]}`); }
}
if (stale) process.exitCode = 1;
