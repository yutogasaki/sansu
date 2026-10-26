'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const source = 'docs/portal/learning-journey.json';

function load(root) {
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  const data = JSON.parse(read(source));
  const internalMath = [...read('docs/product/02_math_skills.md').split('## 4. レベル定義')[1].split('## 5.')[0].matchAll(/^\| (\d+) \| ([^|]+) \| ([^|]+) \|/gm)]
    .map(m => ({level: Number(m[1]), title: m[2].trim(), detail: m[3].trim()}));
  const math = [...read('docs/product/learning-levels.md').matchAll(/^\| Lv(\d+) \| ([^|]+) \| ([^|]+) \|/gm)]
    .map(m => {
      const internalLevels = m[3].split('、').map(x => Number(x.trim()));
      return {level: Number(m[1]), title: m[2].trim(), internalLevels,
        detail: internalLevels.map(n => internalMath.find(l => l.level === n)?.title || '不明な内部区分').join('、')};
    });
  const english = [...read('docs/product/05_english_words.md').matchAll(/^### Lv\.(\d+)（(\d+)語）(.+)$/gm)]
    .map(m => ({level: Number(m[1]), title: m[3], detail: `${m[2]}学習項目`, count: Number(m[2])}));
  const kokugo = [...read('docs/product/kokugo-levels.md').matchAll(/^\| Lv(\d+) \| ([^|]+) \| ([^|]+) \| (\d+) \|/gm)]
    .map(m => ({level: Number(m[1]), title: m[2].trim(), units: m[3].split('、').map(x => x.trim()), count: Number(m[4])}));
  const curriculum = read('src/domain/kokugo/curriculum.ts').split('const definitions:')[1].split('export const KOKUGO_STARTER_UNITS')[0];
  const units = {};
  for (const track of curriculum.matchAll(/\['([KHVSRE])', \[([\s\S]*?)\n    \]\]/g)) {
    [...track[2].matchAll(/\['([^']+)', (\d+), '[^']*'\]/g)].forEach((m, i) => {
      units[track[1] + String(i + 1).padStart(2, '0')] = {title: m[1], band: Number(m[2])};
    });
  }
  if (internalMath.length !== 29 || [math, english, kokugo].some(rows => rows.length !== 20 || rows.some((l,i) => l.level !== i + 1))) throw Error('Learning level source table changed');
  const mappedMath = math.flatMap(l => l.internalLevels);
  if (mappedMath.length !== 29 || new Set(mappedMath).size !== 29 || internalMath.some(l => !mappedMath.includes(l.level))) {
    throw Error('Math display levels must cover all 29 internal levels exactly once');
  }
  const mapped = kokugo.flatMap(l => l.units);
  const activities = ['H06', 'E05', 'E06', 'E07', 'E08'];
  if (Object.keys(units).length !== 46 || mapped.length !== 41 || new Set(mapped).size !== 41
    || mapped.some(id => !units[id] || activities.includes(id))
    || Object.keys(units).some(id => !mapped.includes(id) && !activities.includes(id))
    || kokugo.some(l => l.units.length !== l.count)) {
    throw Error('Kokugo levels must cover the 41 assessed units once and retain all five activities');
  }
  if (data.gates.length !== 5 || data.gates.some((g, i) => g.stage !== i + 1 || ['math','english','kokugo'].some(k =>
    g[k] !== [2,5,9,13,17][i] || !Number.isInteger(g[k]) || !({math,english,kokugo}[k]).some(l => l.level === g[k]) || (i && g[k] <= data.gates[i - 1][k])))) {
    throw Error('Invalid or non-monotonic voyage conditions');
  }
  return {...data, math, english, kokugo, units};
}

function symbol(kind) {
  const shapes = {
    flag:'<path d="M9 31V8m0 0h17l-4 6 4 6H9"/>',
    tree:'<path d="M20 33V21M9 23l11-17 11 17H9z"/>',
    house:'<path d="M7 18L20 7l13 11v15H7V18zm10 15V22h7v11"/>',
    book:'<path d="M20 12c-5-4-11-4-15-2v22c4-2 10-2 15 2 5-4 11-4 15-2V10c-4-2-10-2-15 2zm0 0v22"/>',
    flower:'<path d="M20 34V22m0 7c-7 0-9-5-9-5 6-1 9 2 9 5z"/><circle cx="20" cy="15" r="4"/><path d="M16 12c-9-7-9 8-1 6-7 9 8 9 6 1 9 7 9-8 1-6 7-9-8-9-6-1z"/>',
    boat:'<path d="M5 25h30l-7 9H12l-7-9zm15 0V6L8 22h12m3-14 10 14H23"/>'
  };
  return `<svg viewBox="0 0 40 40" class="journey-icon" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true">${shapes[kind]}</svg>`;
}
function islandArt(island) {
  const motifs = {
    shore:'<path d="M54 48q16-20 29 0l-14 9z" fill="#efb0bb"/><path d="m69 56-6-20m6 20 5-20" stroke="#9d6483"/><path d="M113 57h23l-6 7h-11z" fill="#a5b5ca"/>',
    forest:'<path d="M45 53V28m32 32V24m30 29V35" stroke="#76669d" stroke-width="6"/><g fill="#aaa2d0"><circle cx="45" cy="24" r="19"/><circle cx="77" cy="20" r="24"/><circle cx="107" cy="33" r="17"/></g><g fill="#f4d47f"><circle cx="41" cy="28" r="3"/><circle cx="80" cy="24" r="3"/><circle cx="104" cy="37" r="3"/></g>',
    water:'<path d="M50 48q24-14 42 2t32 4" fill="none" stroke="#82b7db" stroke-width="10"/><g fill="#b8d6e7"><path d="m47 52-5-25q17 11 5 25zm61 7 9-25q9 20-9 25z"/></g><path d="M73 46q9-14 18 0l-9 10z" fill="#e5b1d4"/>',
    cloud:'<path d="m34 62 24-35 21 35m-3 1 32-44 31 44" fill="#c6bfdc"/><g fill="#fff"><ellipse cx="56" cy="27" rx="22" ry="7"/><ellipse cx="112" cy="20" rx="25" ry="7"/></g><path d="M81 49V31" stroke="#a26b9a"/><circle cx="81" cy="28" r="9" fill="#d99db8"/>',
    mineral:'<g fill="#c9a24a" stroke="#7a6248" stroke-width="2"><circle cx="58" cy="40" r="17"/><circle cx="96" cy="32" r="12"/></g><g fill="#7a6248"><circle cx="58" cy="40" r="5"/><circle cx="96" cy="32" r="4"/></g><path d="M118 58V30" stroke="#8f9aa4" stroke-width="5"/><g fill="#eee"><circle cx="118" cy="24" r="5"/><circle cx="123" cy="16" r="4"/></g>',
    star:'<path d="m75 20 4 11 12 1-10 7 3 12-9-7-10 7 3-12-10-7 13-1z" fill="#eacb77"/><path d="M38 61q39-20 90 0" fill="none" stroke="#a6addb" stroke-width="9"/><g fill="#9a94ca"><circle cx="45" cy="39" r="4"/><circle cx="118" cy="30" r="4"/></g>'
  };
  return `<svg viewBox="0 0 170 100" role="img" aria-label="${esc(island.title)}の模式図"><ellipse cx="85" cy="81" rx="70" ry="10" fill="#e2edf4"/><path d="M21 68q4-17 28-17 14-11 33-2 24-7 42 4 23-2 26 16-6 13-57 15-50 0-72-16z" fill="#edeaf4" stroke="#b8b4cc" stroke-width="1.4"/>${motifs[island.id]}</svg>`;
}

function body(d) {
  const gateText = g => `算数 Lv${g.math} ／ 英単語 Lv${g.english} ／ 国語 Lv${g.kokugo}`;
  const levelPanel = (key, title, rows, note) => `<section class="journey-levels" aria-labelledby="levels-${key}"><h3 id="levels-${key}">${title} <span>${rows.length}段階</span></h3><p>${note}</p><ol class="journey-level-list">${rows.map(l => `<li${d.gates.some(g=>g[key]===l.level)?' class="journey-milestone"':''}><span class="journey-lv">Lv${l.level}</span><div><strong>${esc(l.title)}</strong><p>${key==='kokugo'?`${l.count}単元：${l.units.map(id=>esc(d.units[id].title)).join('、')}`:esc(l.detail)}</p>${d.gates.filter(g=>g[key]===l.level).map(g=>`<small>内容の確認で 追加航路${g.stage}</small>`).join('')}</div></li>`).join('')}</ol></section>`;
  return `<div class="learning-guide">
<header class="journey-hero"><div><p class="journey-eyebrow">LEARNING × ISLAND</p><h1>学びと島の<br>成長マップ。</h1><p class="journey-lead">チュートリアル・アチーブメント・3教科のレベル・島の解放を、一つの地図で。</p><p class="journey-boundary">${esc(d.status)}</p></div><div class="journey-hero-map" aria-label="学びから島へつながる設計"><div class="journey-map-top">${symbol('book')}<span>算数・英語・国語</span></div><div class="journey-dotted" aria-hidden="true"></div><div class="journey-map-middle">${symbol('flag')}<span>できたことが残る</span></div><div class="journey-dotted" aria-hidden="true"></div><div class="journey-map-bottom">${islandArt(d.islands[0])}<span>次の島へ</span></div></div></header>
<nav class="journey-nav" aria-label="このページの目次"><a href="#relationship">全体のつながり</a><a href="#first-voyage">最初の航海</a><a href="#achievement-book">達成の本</a><a href="#simulator">解放を試す</a><a href="#subject-levels">3教科のレベル</a><a href="#island-catalog">島と固有種</a></nav>
<section class="journey-section" id="relationship"><p class="journey-eyebrow">01 / STRUCTURE</p><h2>案内する。達成する。次へ進む。</h2><div class="journey-roles"><article>${symbol('flag')}<span>使い方を案内</span><h3>チュートリアル</h3><p>島も、家も、学習も。初めて必要になった場面で短く伝える。</p><small>閉じても、実際に操作すれば達成できる</small></article><span class="journey-arrow" aria-hidden="true">→</span><article class="journey-role-core">${symbol('book')}<span>いろいろな「できた」</span><h3>アチーブメント</h3><p>島づくり・暮らし・発見・学習。目標、進捗、記念と特典をまとめる。</p><small>学びの節目の記録が航路の枠と結びつく</small></article><span class="journey-arrow" aria-hidden="true">→</span><article>${symbol('boat')}<span>行ける世界が増える</span><h3>島と固有種</h3><p>新しい島を選び、その場所の植物や生き物に出会う。</p><small>開いた島は、あとから閉じない</small></article></div><p class="journey-note">学習の正しさは教科ごとに判定。「練習した」「独力で内容を確認した」「後日も思い出せた」を区別し、アチーブメントから参照します。</p></section>
<section class="journey-section" id="first-voyage"><p class="journey-eyebrow">02 / FIRST VOYAGE</p><h2>最初の島は、軽い一歩で。</h2><p>チュートリアルの途中で、新しい島の楽しさに出会う。学習や成長待ちを最初の航海の条件にしません。</p><ol class="journey-first-flow">${d.starter.map((s,i)=>`<li><b>${i+1}</b><strong>${esc(s)}</strong><small>実際の操作を保存</small></li>`).join('')}<li class="journey-first-reward">${symbol('boat')}<strong>しおかぜの小島へ</strong><small>航路が開く・出航は自分で選ぶ</small></li></ol><div class="journey-two"><p><b>目標は初回5〜10分</b><br>家と仲間まで約5分、初航海まで約10分。実測前の目標です。</p><p><b>最初の固有種に、確実に出会う</b><br>種を持ち帰る → 自分の島に植える → また海の向こうへ。</p></div></section>
<section class="journey-section" id="achievement-book"><p class="journey-eyebrow">03 / ACHIEVEMENTS</p><h2>学習も、島を触ることも。<br>「できた」が集まる本。</h2><div class="journey-achievements">${d.achievements.map(a=>`<article>${symbol(a.icon)}<h3>${esc(a.title)}</h3><ul>${a.examples.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><small>${esc(a.reward)}</small></article>`).join('')}</div><p class="journey-note">チュートリアルの「説明を見た」回数ではなく実際の行動で達成。すべての達成に島や通貨を付けず、同じ行動の特典は一度だけ。</p><details><summary>チュートリアルが案内する範囲</summary><div class="journey-tutorial-grid">${d.tutorials.map(t=>`<article><h3>${esc(t.title)}</h3><p>${esc(t.action)}</p><small>→ ${esc(t.result)}</small></article>`).join('')}</div></details></section>
<section class="journey-section" id="simulator"><p class="journey-eyebrow">04 / TRY THE RULES</p><h2>このレベルなら、どこまで開く？</h2><p>内容を確認できたレベルを選んで、仮の解放条件を試せます。<b>このページの見本だけが変わります。</b></p><div class="journey-simulator"><div class="journey-controls"><fieldset><legend>初回の島づくり</legend><label class="journey-check"><input id="journey-first" type="checkbox"> 家を開き、最初の仲間を迎えた</label></fieldset><fieldset><legend>確認できた内容のレベル</legend>${[['math','算数',d.math],['english','英単語',d.english],['kokugo','国語',d.kokugo]].map(([key,label,rows])=>`<label class="journey-subject journey-${key}"><span>${label}</span><select id="journey-${key}" data-journey-level="${key}"><option value="-1">まだ確認していない</option>${rows.map(l=>`<option value="${l.level}">Lv${l.level} ${esc(l.title)}</option>`).join('')}</select></label>`).join('')}</fieldset><button type="button" id="journey-reset">見本を最初に戻す</button></div><div class="journey-result"><div id="journey-summary" role="status" aria-live="polite"><strong>最初の小島から始めよう</strong><p>家と仲間の体験で、最初の航路が開きます。</p></div><ol id="journey-gates">${d.gates.map(g=>`<li data-journey-stage="${g.stage}"><span class="journey-stage">${g.stage}</span><div><strong>追加航路${g.stage}</strong><small>${gateText(g)} のどれか</small></div><b data-journey-state>これから</b></li>`).join('')}</ol></div></div><div class="journey-two"><p><b>3教科の、どれかで進める</b><br>全教科をそろえる必要はありません。同じ段階を別の教科で達成しても、航路は重複しません。</p><p><b>テーマは、自分で選ぶ</b><br>開いた枠から森・水辺・高原などを選ぶ案。教科で行き先を固定しません。</p></div><details><summary>解放条件の一覧と例外を見る</summary><div class="journey-table-wrap"><table><caption>後続五段階の仮条件。対象レベルの内容確認が必要。</caption><thead><tr><th>航路</th><th>算数</th><th>英単語</th><th>国語</th><th>条件</th></tr></thead><tbody>${d.gates.map(g=>`<tr><th>${g.stage}つ目</th><td>Lv${g.math}</td><td>Lv${g.english}</td><td>Lv${g.kokugo}</td><td>どれか一つ</td></tr>`).join('')}</tbody></table></div><ul><li>保護者の設定値や、単にそのレベルを選んだことは習得の証拠にしません。</li><li>英語基礎のABC・音は別コース。初回の取り組みを記念できますが、英単語のレベルへ換算しません。</li><li>高いレベルから始める子・最高レベルの子への資格確認は実装前に確定します。下位の学習記録を補作しません。</li><li>3教科とも表示Lv1〜20、航路の節目はLv2・5・9・13・17に統一する案です。教科間の必要時間は実測して調整します。</li><li>この見本は学習記録・保存・航路を読み書きせず、確認できたレベルだけで資格を比較します。仮所有者と本人設定後の引継ぎは本体実装時に検証します。</li></ul></details></section>
<section class="journey-section" id="subject-levels"><p class="journey-eyebrow">05 / SUBJECT LEVELS</p><h2>3教科、どれもLv1〜20。</h2><p>レベル数と島が開く節目をそろえます。数字の大きさは教科をまたいだ学力の比較ではありません。</p><div class="journey-subject-summary"><a href="#levels-math"><b>算数</b><strong>Lv1—20</strong><span>数 → 計算 → 分数 → 応用</span><small>既存29区分を20段階へ・設計案</small></a><a href="#levels-english"><b>英単語</b><strong>Lv1—20</strong><span>身近な語 → 社会 → 抽象的な語</span><small>基礎のABC・音は別コース</small></a><a href="#levels-kokugo"><b>国語</b><strong>Lv1—20</strong><span>音と文字 → 文 → 読解と資料</span><small>新しいレベル設計・アプリ未反映</small></a></div>
<div class="journey-level-panels">${levelPanel('kokugo','国語',d.kokugo,'既存の採点対象41単元を、内容で20段階へ。各段階の必要内容を確認して進む設計。自由な作文・読書・話す活動は別の達成として残します。')}<details><summary>算数の全20段階を開く</summary>${levelPanel('math','算数',d.math,'既存の内部29区分を20段階へまとめる設計。アプリ未反映。印の付いた範囲は航路の仮の節目です。')}</details><details><summary>英単語の全20段階を開く</summary>${levelPanel('english','英単語',d.english,'既存の1,184学習項目。単語の認識から、聞く・話す・書く能力全体を推定しません。')}</details></div><p class="journey-note">国語は「取り組むレベル」と「内容を確認できたレベル」を別表示にします。年齢・学年を理由に内容をロックせず、六領域の得意・練習中も残します。スターターの漢字単元だけで全配当漢字の習得とは扱いません。</p></section>
<section class="journey-section" id="island-catalog"><p class="journey-eyebrow">06 / ISLAND VARIATIONS</p><h2>海の向こうに、違う暮らし。</h2><p>最初の小島は共通。その先は、学びの節目で開く航路から一つずつ選び、自分で育てる。</p><div class="journey-islands">${d.islands.map(i=>`<article style="--island-accent:${i.color}">${islandArt(i)}<small>${i.fixed?'最初の島・固定':'追加の航路で選ぶ'}</small><h3>${esc(i.title)}</h3><p>${esc(i.scene)}</p><dl><div><dt>植物</dt><dd>${esc(i.plant)}</dd></div><div><dt>生き物</dt><dd>${esc(i.creature)}</dd></div></dl><p class="journey-island-play">${esc(i.play)}</p></article>`).join('')}</div><p class="journey-note">絵は違いを伝える模式図。どの島も自分で育てる島で、探しに行かない。固有種は着いた時の1種と、環境を工夫すると来る1種。見つけた種はおみやげとして、どの島にも1つずつ連れて行ける。</p></section>
<section class="journey-section journey-scope" id="scope"><h2>決まった方針と、これからの実装。</h2><div class="journey-two"><article><h3>今回まとめたこと</h3><ul><li>算数・英単語・国語を共通のLv1〜20で見せる設計。</li><li>チュートリアルはアプリ全体、アチーブメントは多様な達成。</li><li>最初の小島と後続五段階の航路を島で実装（確かめたLvは進級テストの合格と国語単元の全形式の確認から読むだけ）。</li><li>6つの特別な島・固有種・おみやげ・しまの きろく5系統。</li></ul></article><article><h3>これから詰めること</h3><ul><li>学習画面のLv表示を共通20段階へ。</li><li>英語基礎だけの子の後続航路、最上位の確認方法。</li><li>教科間の解放速度と、児童の理解の観察。</li></ul></article></div><details><summary>仕様と根拠の原文を開く</summary><ul>${d.sources.filter(s=>s.endsWith('.md')).map(s=>`<li><a href="../${esc(s)}">${esc({'docs/product/island-journey.md':'島の航路と まなびの節目（採用）','docs/product/learning-levels.md':'3教科の共通レベル設計','docs/product/kokugo-levels.md':'国語のレベル進行','docs/product/island-achievements-unlock-proposal.md':'アチーブメントと島解放の詳細案','docs/product/02_math_skills.md':'算数の教材とレベル','docs/product/05_english_words.md':'英単語の教材とレベル','docs/product/island-first-play-onboarding.md':'現在の初回導線','docs/product/island-starter-achievements-proposal.md':'現在のスターターと達成'}[s])}</a></li>`).join('')}</ul><p>参照資料の内容から生成。本人の学習記録は使っていません。</p></details></section></div>`;
}

function apply({root, files}) {
  const data = load(root);
  const template = Buffer.from(files.get('strategy.html')).toString();
  const html = template.replace(/<title>[\s\S]*?<\/title>/, '<title>学びと島の成長｜Sansu</title>')
    .replace(/<main\b[\s\S]*?<\/main>/, () => '<main id="main">' + body(data) + '</main>')
    .replace('</head>', '<link rel="stylesheet" href="learning-guide.css"></head>')
    .replace('</body>', '<script id="journey-data" type="application/json">' + JSON.stringify(data).replace(/</g,'\\u003c') + '</script><script src="learning-guide.js" defer></script></body>');
  files.set('learning-journey.html', html);
  files.set('learning-guide.css', fs.readFileSync(path.join(root,'scripts/portal-learning-guide.css')));
  files.set('learning-guide.js', fs.readFileSync(path.join(root,'scripts/portal-learning-guide.js')));
  files.set('data/learning-journey.json', JSON.stringify(data, null, 2) + '\n');
  const card = '<section class="section journey-entry"><a class="card" href="learning-journey.html"><small>設計を図で見る</small><h2>学びと島の成長</h2><p>3教科のレベル・チュートリアル・アチーブメント・島の解放を、一つの図と見本で。</p><strong>3教科の共通20段階と、航路の解放条件へ →</strong></a></section>';
  for (const file of ['index.html','strategy.html','knowledge.html']) {
    files.set(file, Buffer.from(files.get(file)).toString().replace(/(<header class="page-head">[\s\S]*?<\/header>)/, '$1' + card));
  }
  const jump = Buffer.from(files.get('site-index.js')).toString();
  if (!jump.includes('window.PORTAL_INDEX=[')) throw Error('Portal quick-jump format changed');
  files.set('site-index.js', jump.replace('window.PORTAL_INDEX=[', 'window.PORTAL_INDEX=[{"k":"ページ","t":"学びと島の成長","s":"国語 レベル アチーブメント チュートリアル 航路","u":"learning-journey.html"},'));
  const manifest = JSON.parse(files.get('data/unification-manifest.json'));
  for (const file of [source, ...data.sources, 'scripts/portal-learning-guide.cjs', 'scripts/portal-learning-guide.css', 'scripts/portal-learning-guide.js']) {
    manifest.sourceFiles[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
  }
  files.set('data/unification-manifest.json', JSON.stringify(manifest,null,2) + '\n');
}
module.exports = {load, apply};
