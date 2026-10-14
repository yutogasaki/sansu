import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
export const portalNav = [['.agents/index.html','概要'],['.agents/plan.html','計画'],['.agents/tasks/index.html','仕事'],['docs/index.html','知識・仕様'],['.agents/roles.html','役割・手順'],['.agents/operations.html','運用']];
export function parseTaskBoard(text) {
  const lines = text.split('\n');
  const summary = lines.slice(1).join('\n').trim().split(/\n\s*\n/)[0] || '現在地は未記録。';
  const next = text.match(/^## 次の一手\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1].trim().split(/\n\s*\n/).slice(0, 2) || [];
  let section = '実行キュー', category = 'その他', excluded = false;
  const queue = [];
  for (const line of lines) {
    const heading = line.match(/^(#{2,6}) (.+)$/);
    if (heading) {
      if (heading[1].length === 2) {
        section = heading[2];
        category = 'その他';
        excluded = /実装済み|完了|実行キューから分ける|保留|後続候補/.test(section);
      } else category = heading[2];
    }
    if (excluded) continue;
    const table = line.match(/^\| ([^|]+?) \| \[(.+?)\]\(\.\.\/\.\.\/(docs\/tasks\/active\/[^\s)]+\.md)\) \| ([^|]+?) \| ([^|]+?) \|$/);
    const linked = line.match(/^- \[(.+?)\]\(\.\.\/\.\.\/(docs\/tasks\/active\/[^\s)]+\.md)\)：(.+)$/);
    const legacy = line.match(/^- (.+?) -> (docs\/tasks\/active\/[^\s`]+\.md)\s*$/);
    if (table) queue.push({ name: `${table[2]}：${table[4]} 次：${table[5]}`, file: table[3], category: table[1].trim(), section });
    else if (linked) queue.push({ name: `${linked[1]}：${linked[3]}`, file: linked[2], category, section });
    else if (legacy) queue.push({ name: legacy[1], file: legacy[2], category, section });
  }
  return { summary, next, queue };
}
export function portalContent(label, {root, output, href, esc, card, queue}) {
  const link=(file,name)=> {
    const [target, fragment] = file.split('#');
    return `<a href="${href(output,target)}${fragment ? `#${encodeURIComponent(fragment)}` : ''}">${esc(name)}</a>`;
  };
  const markdown = text => text.split(/(\[[^\]]+\]\([^)]+\))/g).map(part => {
    const match = part.match(/^\[([^\]]+)\]\(\.\.\/\.\.\/([^)]+)\)$/);
    return match ? link(match[2], match[1]) : esc(part).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }).join('');
  const taskBoard = parseTaskBoard(fs.readFileSync(path.join(root,'.agents/tasks/TASKS.md'),'utf8'));
  const currentNote = `<article class="card"><h2>共有キューの現在地</h2><p>${markdown(taskBoard.summary)}</p><h3>次の一手</h3>${taskBoard.next.map(text=>`<p>${markdown(text)}</p>`).join('')}<p>${link('.agents/tasks/TASKS.md','仕事の現在地・正本')}</p></article>`;
  const source=(file,name)=> {
    const text=fs.readFileSync(path.join(root,file),'utf8');
    const sha=createHash('sha256').update(text).digest('hex');
    return `<article class="card" data-search="${esc((name+' '+file+' '+text).toLowerCase())}"><h2>${link(file,name)}</h2><details><summary>正本・内容と版の根拠</summary><p class="path">${esc(file)} · 内容SHA256 ${sha}</p><p>生成時の正本を掲載。内容の確認日は未記録、配布版は未確認。内容hashはcommit IDではありません。</p><pre>${esc(text)}</pre></details></article>`;
  };
  const cards=items=>`<div class="grid">${items.map(([f,n])=>source(f,n)).join('')}</div>`;
  const sources={
    '計画':[['docs/tasks/backlog.md','正式な仕事順と後続候補'],['.agents/tasks/TASKS.md','現在の実行担当'],['docs/product/island-construction-strategy.md','全島制作のM0〜M5と進む条件'],['docs/product/island-art-strategy.md','美術の方針と比較'],['docs/product/island-place-goals.md','場所ごとの目標']],
    '役割・手順':[['docs/ai/contributor-guide.md','人とAIの共有運用'],['docs/ai/ownership_map.md','内容ごとの正本と更新担当領域'],['.agents/agent-guide.md','始め方と引継ぎ'],['.agents/skills/sansu-doc-sync/SKILL.md','正本の更新判断'],['.agents/skills/sansu-verify/SKILL.md','検証と原因の切り分け'],['.agents/skills/sansu-review/SKILL.md','独立した差分確認']],
    '運用':[['docs/runbooks/repository-portal.md','入口の更新と検証'],['docs/ai/verification_matrix.md','変更ごとの必須検証'],['docs/runbooks/release-checklist.md','配布時の確認'],['docs/runbooks/schema-migration.md','保存互換と復旧'],['docs/internal-portal/contract.md','今回一件の依存と修正ループ']]
  };
  const archive='output/internal-portal-evidence/sansu-common-portal-application/index.html';
  const evidenceRoot = path.dirname(archive);
  const trials = fs.existsSync(path.join(root,evidenceRoot)) ? fs.readdirSync(path.join(root,evidenceRoot)).filter(name=>/^trial\d+$/.test(name)).sort((a,b)=>Number(b.slice(5))-Number(a.slice(5))) : [];
  const latest = trials[0];
  const retainedFailures = trials.slice(1).map(trial => {
    const file = `${evidenceRoot}/${trial}/summary.json`;
    try {
      const record = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
      return record.result === 'FAIL'
        ? `<p>過去の正式試行: ${link(file, `${trial} · FAIL`)}（履歴として保持）</p>`
        : '';
    } catch {
      return `<p>過去の正式試行: ${esc(trial)} · 記録は未確認</p>`;
    }
  }).join('');
  const summaryFile = latest && `${evidenceRoot}/${latest}/summary.json`;
  let latestNote = '<p>最新の正式試行の記録はこの環境では未取得。現候補の合格は未確認です。</p>';
  if (summaryFile) {
    try {
      const result = JSON.parse(fs.readFileSync(path.join(root,summaryFile),'utf8'));
      const closeout = `${evidenceRoot}/${latest}/closeout.md`;
      latestNote = `<h3>最新の正式試行: ${esc(latest)} · ${esc(result.result || '未記録')}</h3><p>失敗段階: ${esc(result.failedStage || '記録なし')}。原因区分: ${esc(result.cause || '記録なし')}（environmentは環境要因）。${esc(result.reason || '')}</p><p>未実施: ${esc((result.notCompleted || []).join(' / ') || '記録なし')}。</p><p>再試行は利用者の判断待ち。今回の表示訂正・整合検査を正式試行の合格へ昇格させません。</p><details><summary>正式試行の対象版と停止記録</summary><p>記録日時: ${esc(result.at || '未記録')}</p><p class="path">固定候補: ${esc(result.candidate || '未記録')}</p><p>${link(summaryFile,'正式試行の結果原文')}${fs.existsSync(path.join(root,closeout)) ? ` · ${link(closeout,'停止記録')}` : ''}</p></details>`;
    } catch {
      latestNote = `<p>最新の正式試行 ${esc(latest)} の記録を読み取れません。合格は未確認です。</p>`;
    }
  }
  const archiveNote=`<section class="intro"><h2>正式検証の現在地</h2>${latestNote}${retainedFailures}<p>${fs.existsSync(path.join(root,archive)) ? link(archive,'過去の保存証拠・レビュー・履歴・画像') : '永続ローカル原証拠の索引はこの環境では未取得。'} trial3の旧PASSは旧候補の歴史的結果です。trial4や現候補へ転記しません。</p></section>`;
  if(label==='概要') return `${archiveNote}<section class="intro"><p class="eyebrow">LOCAL PROJECT PORTAL</p><h2>ぽこもこと、自分の島を育てる。</h2><p>子どもが自分から「まなぶ」を選び、次の日も戻ってくるか。${link('CONSTITUTION.md','目的と守る条件')}</p><p>資料の入口はこのページ。実行状態は共有キュー、アプリの挙動は仕様が正本です。</p></section><h2 class="section-title">状況・判断・次の動き</h2><div class="grid">${currentNote}<article class="card"><h2>過去の全島固定版・未達の記録</h2><p>初期36/60・成熟31/60は2026-10-11固定版の作者評価。美術 HOLD、runtime PARTIAL、独立理解／安全 N=0。現候補の合格ではありません。</p><p>${link('docs/design/2026-10-11-authored-whole-preflight/README.md','固定版の測定と未達')} · ${link('docs/design/2026-10-11-authored-whole-preflight/contact-sheet.html','原本と実画面')}</p></article></div><section class="intro"><h2>証拠の読み方</h2><p>27 → 32 所有物、家8軒、権利73は合成入力の購入・成長診断。本人保存ではありません。5,199テストや過去CI合格を、美術・性能・実機・保存・PWA受入へ読み替えません。</p></section><h2 class="section-title">成果物への5導線</h2><div class="destinations"><article class="card"><h2>アプリ</h2><a href="https://sansu-seven.vercel.app/#/island">既存の島入口</a><p>紹介サイト記載のURL。最新公開版の実確認は未実施。</p></article><article class="card"><h2>紹介サイト</h2>${link('website/index.html','既存のローカル紹介資料')}<p>Vite起動・公開版との一致は別確認。</p></article><article class="card"><h2>ヘルプ</h2><p>独立した現行URLは未確認。${link('docs/product/06_screen_specs.md','既存の画面仕様')}</p></article><article class="card"><h2>配布資料</h2><p>現行の正式配布版は未確認。${link('docs/index.html','資料の専門索引')}</p></article><article class="card"><h2>管理画面</h2><p>独立した管理URL・権限は未確認。リンクを補作しません。</p></article></div><h2 class="section-title">仕事の入口</h2><p>${queue.length}件は登録件数。完成率ではありません。${link('.agents/tasks/index.html','現在地と次の一手')}</p><div class="grid">${queue.map(q=>card(output,q.file,q.name,true)).join('')}</div><h2 class="section-title">専門資料と相談</h2><div class="grid">${card(output,'docs/internal-portal/contract.md','今回の範囲・Pecoへの報告と相談',true)}${card(output,'docs/wiki/index.md','再利用する知識と未確認の仮説')}</div><p>${link('.agents/map.html','仕様と実装の専門マップ')} · ${link('docs/index.html','文書の専門索引')}</p>`;
  if(sources[label]) return `<section class="intro"><h2>${label==='計画'?'目標と実行順の関係':label==='役割・手順'?'誰が何を判断するか':'検証・配布・復旧の境界'}</h2><p>${label==='計画'?'正式な実行順はバックログと共有キューを優先。M0〜M5は全島制作の工程、美術計画は表現の判断軸です。資料の存在を工程合格と扱いません。製品全体の採用ロードマップの安定ID・全受入条件は未確認。':label==='役割・手順'?'内容の正本を確認 → 範囲を固定 → 最小変更 → 検証 → 独立確認 → 人へ報告。統合担当は入口と証拠を整え、島の担当は実装、方針・公開・ユーザー受入は人が判断します。個人の担当者名・代行権限は未確認。':'正本編集 → agent:index → 整合確認 → 局所検証 → 独立レビュー → 人の判断。既存CIはverify:coreをPR/main pushで実行します。今回CIは起動しません。hook登録・実発火は未確認、自動同期・自動送信は未実装です。'}</p></section>${cards(sources[label])}`;
  return null;
}
