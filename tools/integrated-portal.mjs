import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {legacyPages} from './generate-agent-index.mjs';
import {candidate} from './portal-graph.mjs';
import {parse, serialize, elements, textOf, hasClass, fragment, disclosure, technicalSurface, escape as esc} from './portal-html.mjs';

export const destinations = new Map([
  ['.agents/index.html','overview.html'], ['.agents/map.html','map.html'],
  ['.agents/plan.html','plan.html'], ['.agents/roles.html','roles.html'],
  ['.agents/operations.html','operations.html'], ['.agents/tasks/index.html','tasks.html'],
  ['docs/index.html','documents.html'],
]);
const names = ['概要','仕様と実装','計画','役割・手順','運用','仕事','知識・仕様'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const humanLabel = value => value.split('—').map(s=>s.trim()).find(s=>/[ぁ-んァ-ヶ一-龯]/.test(s)&&!technicalSurface.test(s)) || (/HOLD/.test(value)?'未完了の確認記録':/PASS|FAIL/.test(value)?'過去の確認結果':/runtime|Three\.js/i.test(value)?'実画面の検査記録':'詳しい資料');
export function evidenceState(current, records) {
  return records.map(record => ({...record, applies: !!record.candidate && record.candidate === current,
    accepted: record.result === 'PASS' && record.candidate === current && record.userAcceptance === true}));
}
export function trialSummary(record) {
  if(record.result==='PASS')return 'この対象の自動確認は完了しました。利用者による採用・製品の完成は別に確認します。';
  if(record.result!=='FAIL')return '確認結果を取得できていません。合格としては扱いません。';
  const reason=[record.firstMeaningfulError,record.diagnosis,record.reason].filter(Boolean).join(' ');
  if(/Repository evidence must|TMPDIR|temporary outputs/.test(reason))return '検査用の一時保存先が、許可した範囲から外れたため停止しました。';
  if(/fixture source|uuid realpath|dependency child symlinks/.test(reason))return '隔離した検査環境の参照先が、決められた範囲を外れたため停止しました。';
  return record.cause==='environment'?'検査環境に問題があり、自動確認が止まりました。':'自動確認で条件を満たせず停止しました。詳しい原因は記録で確認できます。';
}
export function renderIntegrated(root, data, files, common) {
  // The adapter exposes the same canonical documents inline; discard unused
  // standard reference wrappers rather than retaining a second copy.
  for(const file of files.keys())if(file.startsWith('references/'))files.delete(file);
  const originals = legacyPages();
  const css = originals.values().next().value.match(/<style>([\s\S]*?)<\/style>/)[1];
  const extraCss = fs.readFileSync(path.join(root,'tools/integrated-portal.css'),'utf8');
  files.set('portal.css',css+'\n'+extraCss);
  files.set('portal.js',fs.readFileSync(path.join(root,'tools/integrated-portal-browser.js'),'utf8'));
  const relative = (from,to) => path.posix.relative(path.posix.dirname(from),to)||path.posix.basename(to);
  const nav = from => `<header><nav aria-label="メインナビゲーション"><a class="brand" href="${relative(from,'index.html')}">SANSU</a><a href="${relative(from,'index.html')}#decisions">判断</a><a href="${relative(from,'plan.html')}">計画</a><details class="nav-more"><summary>資料</summary><div class="nav-links">${[...destinations].map(([,to],i)=>`<a href="${relative(from,to)}"${from===to?' aria-current="page"':''}>${names[i]}</a>`).join('')}<a href="${relative(from,'ai/index.html')}">AIの入口</a></div></details></nav></header>`;
  const shell = (from,title,body) => `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="generator" content="sansu-integrated-portal/2"><title>Sansu · ${esc(title)}</title><link rel="stylesheet" href="${relative(from,'portal.css')}"></head><body><a class="skip" href="#main">本文へ</a>${nav(from)}<main id="main">${from==='index.html'?'<h1 class="portal-title">さんすうの仕事場</h1>':`<a class="back" href="${relative(from,'index.html')}">← 現在地へ</a><h1>${esc(title)}</h1>`}${body}<footer>生成時点の閲覧面です。公開・実機・子どもの理解の合格は別に確認します。<a href="${relative(from,'ai/index.html')}">根拠とAIの入口</a></footer></main><dialog id="reader" aria-labelledby="reader-title"><div class="reader-toolbar"><button type="button" id="reader-back" hidden>ひとつ前の資料</button><button type="button" id="reader-close">閉じる</button></div><h2 id="reader-title"></h2><div id="reader-content"></div></dialog><script src="${relative(from,'search-index.js')}" defer></script><script src="${relative(from,'portal.js')}" defer></script></body></html>\n`;
  const sources = new Map(), resources = [];
  function register(source) {
    if (destinations.has(source)) return destinations.get(source);
    if(sources.has(source))return sources.get(source);
    const abs = path.resolve(root,source);
    // Every included dependency is explicit in generated HTML; never discover secrets or follow symlinks.
    if(!common.inside(root,abs)||/(?:^|\/)\.env|(?:^|\/)(?:\.git|node_modules)(?:\/|$)|\.(?:pem|key|p12|pfx)$/i.test(source))throw Error(`Forbidden portal dependency: ${source}`);
    common.noSymlinks(root,abs);
    if(!fs.existsSync(abs))throw Error(`Missing portal dependency: ${source}`);
    if(!fs.statSync(abs).isFile())throw Error(`Expected portal dependency file: ${source}`);
    // Keep dependencies in their canonical repository locations. The hub follows HTML
    // and converts images during publication; the portal never duplicates originals.
    const target = '../'+source;
    sources.set(source,target);
    const hash = digest(fs.readFileSync(abs));
    resources.push({source,target,sha256:hash,bytes:fs.statSync(abs).size,mode:'reference'});
    const ext=path.extname(source).toLowerCase();
    if(ext==='.css')for(const match of fs.readFileSync(abs,'utf8').matchAll(/url\(['\"]?([^)'\"]+)['\"]?\)/g)){
      if(!/^(?:https?:|data:|#)/.test(match[1]))register(resolve(source,match[1]));
    }
    if(source==='website/main.js')for(const match of fs.readFileSync(abs,'utf8').matchAll(/'\.\/images\/([^']+)'/g))register('website/public/images/'+match[1]);
    if (ext === '.html') {
      const doc = parse(fs.readFileSync(abs,'utf8'));
      for(const node of elements(doc,n=>!!n.attrs))for(const key of ['href','src','poster']) {
        const value=node.attrs[key];
        if(!value||/^(?:https?:|mailto:|data:|tel:|#)/.test(value))continue;
        register(resolve(source,value.split('#')[0]));
      }
    }
    return target;
  }
  function resolve(source,raw) {
    if(raw.startsWith('/')) {
      const base=source.startsWith('website/')?'website/public/':'public/';
      return base+decodeURIComponent(raw.slice(1));
    }
    return path.posix.normalize(path.posix.join(path.posix.dirname(source),decodeURIComponent(raw)));
  }
  function rewrite(doc,source,target) {
    for (const node of elements(doc,n=>!!n.attrs)) {
      for(const key of ['href','src','poster']) {
        const value = node.attrs[key];
        if(!value || /^(?:https?:|mailto:|data:|tel:|#)/.test(value))continue;
        const [raw,anchor] = value.split('#');
        const resolved = resolve(source,raw);
        const dest = register(resolved);
        node.attrs[key] = relative(target,dest)+(anchor?'#'+anchor:'');
      }
    }
  }
  const search = '<label for="search">このページを全文検索</label><input id="search" type="search" placeholder="言葉・資料名・詳しい本文から探す"><p id="result" role="status" hidden></p>';
  const memberships = [], parity = [];
  for(const [source,target] of destinations) {
    const original = originals.get(source);
    const doc = parse(original);
    rewrite(doc,source,target);
    // Keep the complete old visual/content surface available inside the integrated AI layer too.
    const aiDoc=parse(serialize(doc).replace(/(href|src)="(?!https?:|mailto:|data:|#)([^"]+)"/g,(_,k,v)=>`${k}="../${v}"`));
    const inventoryTags=new Set(['h1','h2','h3','article','section','details','a','img','input','nav','style','script']);
    const originalItems=elements(parse(original),n=>inventoryTags.has(n.tag));
    elements(aiDoc,n=>inventoryTags.has(n.tag)).forEach((node,index)=>{
      node.attrs.id ||= `parity-${index+1}`;
      parity.push({source,ordinal:index+1,tag:node.tag,originalTextSha256:digest(textOf(originalItems[index])),human:target,ai:`ai/${target}#${encodeURIComponent(node.attrs.id)}`});
    });
    elements(aiDoc,n=>n.tag==='body')[0].children.unshift(...fragment('<p><a href="../index.html">さんすうの現在地へ</a></p>'));
    files.set(`ai/${target}`,serialize(aiDoc));
    const main = elements(doc,n=>n.tag==='main')[0];
    let children = main.children.filter(n=>!['h1','label','input','footer','script'].includes(n.tag)&&n.attrs?.id!=='result'&&!hasClass(n,'subtitle'));
    function humanize(parent, inDetails=false) {
      parent.children = (parent.children||[]).flatMap(node=>{
        if(!node.tag)return [node];
        if(!inDetails&&(node.tag==='a'||(node.tag==='h2'&&!elements(node,n=>n.tag==='a').length))&&technicalSurface.test(textOf(node))) {
          node.children=fragment(esc(humanLabel(textOf(node))));
        }
        const technical = !inDetails && (['pre','code'].includes(node.tag)||hasClass(node,'path')||hasClass(node,'asset-full-list')||(['p','h3'].includes(node.tag)&&(technicalSurface.test(textOf(node))||/固定候補:|[`]|^>|\*\*|\]\(|失敗段階|原因区分|未実施:|合成入力|PARTIAL|N=0|Vite/.test(textOf(node)))));
        if(technical)return [disclosure([node])];
        // Raw folder names were on the old surface. Keep them in the same card, under disclosure.
        if(node.tag==='summary') {
          for(const child of elements(node,n=>n.tag==='small'||n.tag==='strong')) {
            const text=textOf(child);
            if(/^(?:docs|assets|public|src|output)\//.test(text)) {
              const headingFile=path.join(root,text,'README.md');
              const label=fs.existsSync(headingFile)?fs.readFileSync(headingFile,'utf8').match(/^# (.+)$/m)?.[1]:undefined;
              child.children=fragment(esc(child.tag==='small'?'素材・記録のフォルダ':label||(/pokomoko/.test(text)?'ぽこもこの画像':/growing-guide/.test(text)?'育つ島の案内画像':`制作・検証の記録 ${text.match(/20\d{2}-\d{2}-\d{2}/)?.[0]||''}`)));
            }
          }
        }
        humanize(node,inDetails||node.tag==='details');
        return [node];
      });
    }
    const content = {tag:'root',children,attrs:{}}; humanize(content);
    // Full source search, even on the old document cards which only searched an excerpt.
    for(const article of elements(content,n=>hasClass(n,'card')&&n.attrs['data-search']!==undefined)) {
      const a=elements(article,n=>n.tag==='a')[0];
      const sourceFile=a&&[...sources].find(([,v])=>relative(target,v)===a.attrs.href)?.[0];
      if(sourceFile && sourceFile.endsWith('.md'))article.attrs['data-search']+=' '+fs.readFileSync(path.join(root,sourceFile),'utf8').toLowerCase();
    }
    if(target==='plan.html') {
      const intro=elements(content,n=>hasClass(n,'intro'))[0];
      if(intro)intro.children=fragment('<h2>目標と実行順の関係</h2><p>子どもが自分から戻りたくなる島が目標です。正式な優先順は、公開準備・体験・性能・美術の順。下の6段階は、そのうち島を作る工程です。工程図は完了実績ではありません。</p><ol class="flow priority-flow"><li>公開準備</li><li>体験</li><li>性能</li><li>美術と成長</li></ol><p>いまは入り江の輪郭の採用待ち。採用後の成長と実利用から、一件ずつ進めます。共有キューとバックログを優先します。</p>');
    }
    const note=target==='map.html'?'<aside class="map-note"><strong>記録の地図 · 過去の画面も含みます</strong><p>今の採用判断は共有キューを優先します。</p><details><summary>記録の読み方</summary><p>元の登録内容をすべて残しています。現在の制作と受入は共有キュー・現行仕様で確認し、旧画面の結果を今の候補へ流用しません。</p></details></aside>':'';
    files.set(target,shell(target,names[[...destinations.keys()].indexOf(source)],note+search+serialize(content)));
    memberships.push({source,target,originalSha256:digest(original),ai:`ai/${target}`});
  }
  for(const source of [...data.ai,...data.docs,'.agents/tasks/BLOCKED.md','.agents/tasks/TASKS.md','tools/portal-graph.mjs'])register(source);
  const legacyCandidate=candidate();
  const generatorFiles=['scripts/standard-portal.mjs','tools/integrated-portal.mjs','tools/integrated-portal.css','tools/integrated-portal-browser.js','tools/portal-html.mjs','tools/check-portal-integration.mjs'];
  const current=digest(JSON.stringify({legacyCandidate,data,resources,generators:generatorFiles.map(file=>[file,digest(fs.readFileSync(path.join(root,file)))]),outputs:[...files].map(([file,value])=>[file,typeof value==='string'?digest(value):value.sha256])}));
  const archive = 'output/internal-portal-evidence/sansu-common-portal-application';
  const records = fs.existsSync(path.join(root,archive)) ? fs.readdirSync(path.join(root,archive)).filter(t=>/^trial\d+$/.test(t)).sort((a,b)=>Number(b.slice(5))-Number(a.slice(5))).map(trial=>{
    try{return {trial,...JSON.parse(fs.readFileSync(path.join(root,archive,trial,'summary.json'),'utf8'))};}
    catch{return {trial,result:'未取得'};}
  }) : [];
  const trials=evidenceState(current,records);
  const boardFile='.agents/tasks/TASKS.md', blockedFile='.agents/tasks/BLOCKED.md';
  const board=fs.readFileSync(path.join(root,boardFile),'utf8');
  const nextReview=board.match(/\[([^\]]+)\]\(\.\.\/\.\.\/(docs\/design\/[^)]+README\.md)\)/)?.[2];
  const reviewHref=nextReview?register(nextReview):'overview.html';
  const goal='子どもが自分から学び、育つ島へまた戻りたくなること。';
  const humanText = value => value.replace(/\*\*/g,'').replace(/`[^`]*`/g,'詳しい資料').replace(/根拠:[\s\S]*/,'').replace(/R3\s*成長と実利用/g,'成長と実利用').replace(/R4\s*通常取得・保存・拡張/g,'通常取得・保存・拡張').replace(/R5\s*美術と配布/g,'美術と配布').replace(/R3/g,'成長と実利用').replace(/R4/g,'通常取得・保存・拡張').replace(/R5/g,'美術と配布').trim();
  const queueReview=data.decisions.find(d=>d.id==='queue-review');
  const afterDecision=board.match(/採用後は ([^。]+)/)?.[1];
  const points=[['目標',goal],['現在地',humanText(data.status).split('。')[0]+'。'],['止まっているものと理由',queueReview?'採用レビュー待ち。採用前に、次の制作や通常保存を先行しません。':'確認条件待ちの項目は、端末や参加者などの準備が必要です。'],['判断',queueReview?humanText(data.nextAction).split('。')[0]+'。':'現在の台帳に採用判断の登録はありません。確認条件は別に示します。'],['判断後に進むもの',afterDecision?humanText(afterDecision)+'。':humanText(data.nextAction).split('。')[0]+'。']];
  const questions=points.map(([q,a],i)=>`<article class="question"><span class="question-number">${i+1}</span><h3>${q}</h3><p>${esc(a)}</p></article>`).join('');
  const decision=queueReview?`<article class="card decision"><span class="status">◆ 採用の判断待ち</span><h3>${esc(queueReview.title)}</h3><p><strong>決めること</strong> ${esc(points[3][1])}</p><div class="choices"><p><strong>進める【おすすめ】</strong><br>次は成長と実利用を一件に区切って制作します。</p><p><strong>直して比べる</strong><br>気になる輪郭を指定し、粗い形を比較し直します。</p><p><strong>保留する</strong><br>次工程を始めず、理由と再開条件を残します。</p></div><p><strong>おすすめと理由</strong> 同じ所有物の比較で輪郭差と対象動作を確認できています。この輪郭を採り、成長と実利用を一件に絞って確かめることをすすめます。美術と独立した理解は未達のため、完成・公開の判断は分けます。</p><p><strong>影響</strong> 採用は次の制作を始める判断です。通常保存・公開の承認にはなりません。</p><p><strong>比較材料</strong> 旧案と今の実画面、同じ所有物での輪郭差。<a href="${reviewHref}">比較の記録を開く</a> · <a href="map.html#evidence">画像で比べる</a></p><details class="ai-detail"><summary>共有キューの根拠</summary><pre>${esc(JSON.stringify(data.decisions.find(d=>d.id==='queue-review')||{},null,2))}</pre></details></article>`:'<p>採用判断は未登録です。端末・参加者などの確認条件は以下で開けます。</p>';
  const conditions=data.decisions.filter(d=>d.id!=='queue-review').map(d=>`<article class="card"><span class="status">◇ 確認条件待ち</span><h3>${esc(d.title)}</h3><p>${esc(d.risk)}</p><p><strong>次に必要なこと</strong> ${esc(d.notes.split('次: ')[1]||'条件を正本で確認する')}</p><p>端末や参加者を用意する確認です。二択の回答依頼ではありません。</p><details class="ai-detail"><summary>担当・期限・根拠</summary><pre>${esc(JSON.stringify(d,null,2))}</pre></details></article>`).join('');
  const tasks=data.tasks.map(t=>`<article class="card"><span class="badge">${esc(t.status)}</span><h3>${esc(t.title)}</h3><p><strong>つながる目標</strong> ${goal}</p><p>登録された関連仕事です。担当ごとの現在地と次の一手は、仕事の一覧で確認できます。</p><a href="tasks.html">現在地・次の一手・全文へ</a><details class="ai-detail"><summary>担当・期限・根拠</summary><pre>${esc(JSON.stringify(t,null,2))}</pre></details></article>`).join('');
  const warning=trials.some(t=>t.result==='PASS'&&!t.applies)?'<aside class="warning" role="status"><strong>△ 過去の合格は、今の候補には使えません</strong><p>検証した対象と現在の候補が違います。最新の正式試行の合格を現在版へ引き継がず、現在版の受入は未確認として扱います。</p></aside>':'<p>現在版の受入は未確認です。</p>';
  const history=trials.map(t=>`<li><strong>${esc(t.at?.slice(0,10)||'日付未記録')} · ${t.result==='PASS'?'過去候補の試行は合格':t.result==='FAIL'?'正式試行で停止':'記録未取得'}</strong><p><strong>理由</strong> ${esc(trialSummary(t))}</p><p><strong>今への影響</strong> ${t.applies?'対象は一致しています。未完了の確認や採用判断は引き続き必要です。':'現在の候補とは一致しません。今の版の合否は、この履歴では決まりません。'}</p><details class="ai-detail"><summary>対象・段階・原因の記録</summary><pre>${esc(JSON.stringify(t,null,2))}</pre></details></li>`).join('');
  const strategy=fs.readFileSync(path.join(root,'docs/product/island-construction-strategy.md'),'utf8');
  const milestones=[...strategy.matchAll(/^\| (M[0-5]・[^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)].map(m=>({name:m[1].trim(),output:m[2].trim(),gate:m[3].trim()}));
  const stageCopy=[
    {title:'同じ島の約束を決める',output:'地形・水・歩ける床を、同じ規則で扱います。',steps:['岸・丘・入口を定義','配置と歩行を照合'],gates:['見た目と歩ける場所が一致する','以前の保存を守る']},
    {title:'全島をひとつ作る',output:'入り江・丘・森・水庭・集落を、実際のアプリで見ます。',steps:['全島の粗い形','アプリで全景と近景','選ぶ・置く・歩く'],gates:['採用した見本と全景を比較できる','同じ形で選択・配置・歩行ができる','一本の木だけの完成で終わらない']},
    {title:'置き方で違いをつくる',output:'同じ材料・家の数・育ち具合で、三つの配置を比べます。',steps:['列に並べる','塊にする','中庭を囲む'],gates:['普段の操作で形や通路が変わる','複数の魅力的な景色になる']},
    {title:'育つ変化をつなぐ',output:'同じ土地で、育ち方と暮らしの変化を見ます。',steps:['単独','若いつながり','成熟','使う','分ける','つなぎ直す'],gates:['少ない材料でも景色になる','育つ理由が見える','持ち物・時間・入口・利用が一致する']},
    {title:'中心を残して広げる',output:'岸・森・花の丘へ広げ、地区どうしの関係を比べます。',steps:['今の中心','隣の地区','さらに先'],gates:['元の地区を変えずに広がる','大きくして単調なら組み方を直す']},
    {title:'同じ配布候補で確かめる',output:'学習・取得・保存・通信なしの利用・更新・復旧をつなぎます。',steps:['機能と保存','実機','理解と安全'],gates:['美術・理解と安全・動作を別に確認','未実施を自動検査の合格で埋めない']},
  ];
  const timeline=`<section aria-labelledby="stages-title"><h2 id="stages-title" class="section-title">島を作る6段階 <span class="badge">計画 · 完了実績とは別</span></h2><ol class="flow stage-flow">${stageCopy.map((m,i)=>`<li>M${i} ${m.title}</li>`).join('')}</ol><ol class="milestones">${milestones.map((m,i)=>`<li><span class="badge">計画 · 工程の合格は未確認</span><h3>M${i}・${stageCopy[i].title}</h3><p>${stageCopy[i].output}</p><ol class="flow">${stageCopy[i].steps.map(step=>`<li>${step}</li>`).join('')}</ol><strong>進む条件</strong><ul>${stageCopy[i].gates.map(gate=>`<li>${gate}</li>`).join('')}</ul><details class="ai-detail"><summary>工程の正本を読む</summary><p>${esc(m.name)}</p><p>${esc(m.output)}</p><p>${esc(m.gate)}</p></details></li>`).join('')}</ol></section>`;
  const planDoc=parse(files.get('plan.html'));
  const planIntro=elements(planDoc,n=>hasClass(n,'intro'))[0];
  const planMain=elements(planDoc,n=>n.tag==='main')[0];
  planMain.children.splice(planMain.children.indexOf(planIntro)+1,0,...fragment(timeline));
  files.set('plan.html',serialize(planDoc));
  const gallery=[...sources].filter(([source])=>/open-inlet-rough-v1-runtime\/.*\.(png|webp|jpg)$/.test(source)).slice(0,3);
  const preview=gallery.length?`<div class="hero-gallery">${gallery.map(([source,target],i)=>`<figure><a href="${target}"><img src="${target}" alt="開いた入り江の比較記録 ${i+1}" loading="lazy"></a><figcaption>輪郭を見るための開発中の記録</figcaption></figure>`).join('')}</div>`:'';
  const standardDocs=`<details><summary>入口と標準化の資料を開く</summary><ul>${data.docs.map(source=>{const title=fs.readFileSync(path.join(root,source),'utf8').match(/^# (.+)$/m)?.[1]||'詳しい資料';return `<li><a href="${register(source)}">${esc(title)}</a></li>`;}).join('')}</ul></details>`;
  const uses='<section class="use-cards" aria-label="使う場所"><a class="use-card" href="https://sansu-seven.vercel.app/"><strong>アプリ ↗</strong><span>学ぶ</span></a><a class="use-card" href="https://sansu-seven.vercel.app/promo/"><strong>紹介 ↗</strong><span>見る</span></a><div class="use-card"><strong>ヘルプ</strong><span class="badge">未接続</span></div></section>';
  const artifactSource=nextReview&&path.posix.join(path.posix.dirname(nextReview),'loop.png');
  const artifactImage=artifactSource&&fs.existsSync(path.join(root,artifactSource))?register(artifactSource):gallery[0]?.[1];
  const artifact=artifactImage?`<section class="entry-artifact" aria-label="画像つき成果"><a href="${reviewHref}" class="artifact-image"><img src="${artifactImage}" alt="開発中の島の全景。入り江を囲む二本の腕と水面" width="128" height="96" fetchpriority="high"></a><div><span class="badge">現在の判断対象 · 開発中</span><h2><a href="${reviewHref}">入り江の実画面</a></h2><p>輪郭を比較する最新資料。<br>公開版の最新状態は未確認。</p></div></section>`:'';
  const snapshot=`<section class="snapshot" aria-label="いまの状況と次の行動"><p class="purpose">学んで、島を育てる。</p><div class="snapshot-brief"><p><strong>いま</strong> ${queueReview?'入り江の輪郭の採用待ち。':'確認条件を準備中。'}</p><p><strong>注意</strong> 採用までは次工程を待つ。</p><p><a class="next-action" href="#decisions">次は、輪郭を比較して決める ↓</a></p></div></section>`;
  files.set('index.html',shell('index.html','育つ島の、いまと次。',`${snapshot}<div class="entry-work">${uses}${artifact}</div><aside class="original"><a href="../.agents/index.html">元のさんすうポータルを<span class="link-tail">開く →</span></a><p>図・画像・全文・履歴を保持しています。</p></aside><p class="checked-at">内容確認日 ${esc(data.lastChecked)} · 公開版の最新状態は未確認</p><nav class="map-jumps" aria-label="章"><a href="#overview">概要</a><a href="#decisions">判断待ち</a><a href="#tasks">タスク</a><a href="#documents">資料</a><a href="#ai">AIの入口</a></nav>${search}<section class="entry-search"><h2>資料の本文も探す</h2><label for="global-search">資料全体を検索</label><input id="global-search" type="search" placeholder="資料の中の言葉から探す"><p id="global-status" role="status"></p><ul id="global-results"></ul></section><section id="overview"><h2 class="section-title">5つの問いで、全体を見る</h2><div class="questions">${questions}</div>${preview}</section><section id="decisions"><h2 class="section-title">判断待ち</h2>${decision}<h3>回答依頼とは別の確認条件</h3><div class="grid">${conditions}</div></section><section id="tasks"><h2 class="section-title">ゴールにつながる仕事</h2><p>登録された関連仕事です。同時にすべてを開始する指示ではありません。</p><div class="grid">${tasks}</div></section><section id="documents"><h2 class="section-title">資料・図・画像</h2><div class="destinations">${[...destinations].map(([,target],i)=>`<article class="card"><h3><a href="${target}">${names[i]}</a></h3><p>${['正式試行と過去の未達、成果物への5導線','島と学習の進み具合、仕様分類、素材と画像','正式な仕事順と、制作の6段階','人とAIの担当、正本、引継ぎ','生成、検証、配布、保存互換と復旧','現在地、次の一手、保留と完了記録','すべての文書を本文から検索'][i]}</p></article>`).join('')}</div>${standardDocs}</section><section id="trials"><h2 class="section-title">正式検証の対象と履歴</h2>${warning}<ol class="trial-history">${history||'<li>この環境では正式試行を未取得</li>'}</ol></section><section id="ai"><h2 class="section-title">AIの入口</h2><p>同じ正本から作った詳しいデータ、全文、版の情報へ。</p><a href="ai/index.html">根拠と作業の入口を開く</a></section>`));
  const entryDoc=parse(files.get('index.html'));
  for(const section of elements(entryDoc,n=>n.tag==='section'&&n.attrs?.id))section.attrs['data-search']=textOf(section).toLowerCase();
  files.set('index.html',serialize(entryDoc));
  for(const source of [...data.ai,blockedFile,boardFile,'tools/portal-graph.mjs'])register(source);
  const searchRecords=[];
  for(const [source,target] of sources)if(/\.(?:md|txt|json|jsonl|log|mjs|tsx?)$/.test(source)){
    const text=fs.readFileSync(path.join(root,source),'utf8');
    const title=text.match(/^# (.+)$/m)?.[1]||path.basename(source);
    searchRecords.push({title,label:technicalSurface.test(title)?humanLabel(title):title,href:target,body:text});
  }
  files.set('data/search.json',JSON.stringify(searchRecords));
  files.set('search-index.js','window.sansuSearchIndex='+JSON.stringify(searchRecords)+';\n');
  files.set('documents.html',files.get('documents.html').replace(search,search+'<section class="intro"><h2>すべての資料を全文から探す</h2><p>ページ内の検索に加え、詳しい本文の中の言葉も探せます。</p><label for="global-search">資料全体を検索</label><input id="global-search" type="search"><p id="global-status" role="status"></p><ul id="global-results"></ul></section>'));
  const ai={schemaVersion:2,currentCandidate:current,legacyCandidate,project:data,humanQuestions:points,trials,milestones,memberships,resources,sources:[...sources].map(([source,target])=>({source,target}))};
  files.set('data/integration.json',JSON.stringify(ai,null,2)+'\n');
  files.set('data/parity.json',JSON.stringify(parity,null,2)+'\n');
  files.set('ai/index.html',shell('ai/index.html','正本・全文とAIの入口',`<p>人向けの現在地と同じ入力から生成しています。生ID・hash・原文はここで確認できます。</p><ul><li><a href="../data/project.json">標準プロジェクトデータ</a></li><li><a href="../data/integration.json">候補・試行・ページ・素材の対応データ</a></li>${[...destinations].map(([source,target])=>`<li><a href="${target}">${esc(source)} の全表示</a></li>`).join('')}${data.ai.map(source=>`<li><a href="${relative('ai/index.html',register(source))}">${esc(source)}</a></li>`).join('')}</ul><p>検証エンジンは既存の portal-graph を保持。試行や修正枠をこの閲覧画面から起動・リセットしません。</p><details><summary>現在の候補と全試行</summary><pre>${esc(JSON.stringify({currentCandidate:current,trials},null,2))}</pre></details><p><a href="${relative('ai/index.html',register('tools/portal-graph.mjs'))}">試行・修正上限と証拠整合のエンジン</a></p><p><a href="${relative('ai/index.html',register(blockedFile))}">確認条件の正本</a> · <a href="${relative('ai/index.html',register(boardFile))}">仕事の正本</a></p>`));
  return files;
}
