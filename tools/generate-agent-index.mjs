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
const queue = [...read('.agents/tasks/TASKS.md').matchAll(/^- (.+?) -> (docs\/tasks\/active\/[^\s`]+\.md)\s*$/gm)].map(m => ({ name: m[1], file: m[2] }));
const docs = walk('docs');
function card(output, file, name = title(file), expanded = false) {
  const text = read(file);
  const excerpt = text.replace(/^---\n[\s\S]*?\n---\n/, '').split('\n').filter(l => l.trim() && !/^(#|\||```)/.test(l)).slice(0, 2).join(' ').slice(0, 210);
  return `<article class="card" data-search="${esc(`${name} ${file} ${expanded ? text : excerpt}`.toLowerCase())}"><h2><a href="${href(output, file)}">${esc(name)}</a></h2><p class="path">${esc(file)}</p><p>${esc(excerpt)}</p>${expanded ? `<details><summary>詳細を読む</summary><pre>${esc(text)}</pre></details>` : ''}</article>`;
}
function render([output, label]) {
  let content;
  if (label === '概要') {
    content = `<section class="intro"><p class="eyebrow">REPOSITORY OVERVIEW</p><h2>ぽこもこと不思議な島</h2><p>子どもがくり返し遊びたくなる、算数・英語の学習PWA。学習と島の暮らしをつなぎ、学習記録は端末内に保存します。</p><div class="stats"><span><strong>${queue.length}</strong> 実行キュー</span><span><strong>${docs.length}</strong> ドキュメント</span><span>React 19 / TypeScript / Vite / Dexie</span></div></section><h2 class="section-title">リポジトリの入口</h2><section class="grid">${['CONSTITUTION.md', 'docs/product/01_app_spec.md', '.agents/agent-guide.md', 'docs/ai/verification_matrix.md', 'docs/tasks/backlog.md', 'docs/ai/ownership_map.md'].map(f => card(output, f)).join('')}</section><section class="intro"><h2>ローカルで使う</h2><p>アプリの起動</p><pre>nvm use\nnpm ci\nnpm run dev</pre><p>このHTMLを更新 / 更新漏れを確認</p><pre>npm run agent:index\nnpm run agent:index:check</pre><p>HTMLは閲覧用の生成物です。内容を変えるときは元のMarkdownを編集して再生成してください。</p></section>`;
  } else if (label === 'タスク') {
    content = `<p>実行キューに登録された ${queue.length} 件。ここへの登録は、実装済み・リリース済みを意味しません。</p><section class="grid">${queue.map(t => card(output, t.file, t.name, true)).join('')}</section><h2 class="section-title">保留・計画・完了記録</h2><section class="grid">${['.agents/tasks/BLOCKED.md', 'docs/tasks/backlog.md', '.agents/tasks/DONE.md'].map(f => card(output, f, title(f), true)).join('')}</section>`;
  } else {
    const groups = [...new Set(docs.map(f => f.split('/')[1]))];
    content = groups.map(group => `<section class="doc-group"><h2 class="section-title">${esc(group)}</h2><div class="grid">${docs.filter(f => f.split('/')[1] === group).map(f => card(output, f)).join('')}</div></section>`).join('');
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
