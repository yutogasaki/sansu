'use strict';
// Shared vocabulary for every portal. Repos may override a row explicitly;
// the original category, status text and IDs always stay visible in detail.

// One library taxonomy for all repos, in reading order.
const CATEGORIES=[
 {id:'strategy',title:'方針・判断',hint:'目的、戦略、計画、決めたこと'},
 {id:'spec',title:'仕様・設計',hint:'何をどう作るか、構造と契約'},
 {id:'guide',title:'手順・運用',hint:'作業の進め方、AIの規則、スキル'},
 {id:'ai',title:'AIの環境',hint:'AIへの指示（AGENTS/CLAUDE）、スキル、記憶、作業の決まり'},
 {id:'research',title:'調査・根拠',hint:'調べた結果、監査、比較、出典'},
 {id:'record',title:'作業記録',hint:'タスクごとの依頼・完了メモ・検証'},
 {id:'tool',title:'画面・素材',hint:'図、比較、素材一覧など固有の画面'},
 {id:'archive',title:'原文・保管',hint:'コード・データの原文、旧入口。普段は開かない',folded:true}
];
const RULES=[
 ['archive',/\.(?:py|js|cjs|mjs|ts|tsx|json|ya?ml|toml|css|sh)$|(?:^|\/)(?:archive|legacy|preserved|retained)\//i],
 ['record',/(?:^|\/)(?:tasks|inbox|runs|completion|done|qa|evidence)\/|(?:^|\/)[a-z]{1,8}-\d+[\w-]*\.md$/i],
 ['ai',/(?:^|\/)(?:AGENTS|CLAUDE|GEMINI|HANDOFF|CONSTITUTION)\.md$|^\.agents\/(?!tasks\/)|(?:^|\/)skills?\/|(?:^|\/)memory\/|agent-guide|(?:^|\/)agent\//i],
 ['guide',/(?:^|\/)(?:ai|runbooks?|wiki)\//i],
 ['strategy',/(?:^|\/)(?:strategy|roadmap|plan|plans|vision|adr|decisions?)\b|strategy|roadmap/i],
 ['guide',/(?:^|\/)CONTRIBUTING\.md$|(?:^|\/)(?:skills?|guides?|runbooks?|ops|operations|workflow|\.agents)\/|README\.md$|guide|_authoring|authoring\.md$/i],
 ['spec',/(?:^|\/)(?:spec|specs|design|architecture|maps?|portal|curriculum|schema|contracts?|product)\b|spec|mvp/i],
 ['research',/(?:^|\/)(?:research|audits?|reviews?|sources|references|knowledge|reports?|authoring)\b|audit|review|benchmark/i]
];
const TITLE_RULES=[
 ['strategy',/戦略|方針|作戦|ロードマップ|計画|判断|ビジョン/],
 ['spec',/仕様|設計|契約|構成|地図|MVP|モデル/],
 ['guide',/手順|ガイド|運用|規則|使い方|読み方|入口/],
 ['research',/監査|調査|比較|試験|状況|状態|分析|出典|根拠/],
 ['record',/完了|修正|実装|移行|再試行/]
];
function category(row){
 if(row.commonCategory)return row.commonCategory;
 const src=row.source||'';
 for(const [id,re] of RULES)if(re.test(src))return id;
 for(const [id,re] of TITLE_RULES)if(re.test(row.title||''))return id;
 return 'research';
}

// Five shared states. Free-form status text is kept next to the pill.
const STATES={doing:'進行中',review:'確認待ち',blocked:'止まっている',done:'完了',idle:'未着手'};
function state(text){
 const s=String(text||'');
 if(/保留|未決|停止|中断|blocked|paused/i.test(s))return 'blocked';
 if(/未着手|todo|backlog/i.test(s))return 'idle';
 if(/進行中|作業中|実施中|in.?progress|doing|running|^active/i.test(s))return 'doing';
 if(/待ち|未完了|引継|要確認|review|verify/i.test(s))return 'review';
 if(/完了|done|applied|確認（|commitで確認/i.test(s))return 'done';
 return 'review';
}

// IDs and hashes move out of titles into a label; nothing is replaced by
// placeholder prose. "H-030〜H-037: 整数の…" → {id:'H-030〜H-037', title:'整数の…'}.
const ID=/\b(?:[A-Z]{1,8}[-_]\d[\w-]*|[A-Z]{1,5}\d{2,})\b/;
function title(raw){
 let s=String(raw||'').replace(/\s+/g,' ').trim(),ids=[];
 const lead=new RegExp('^(?:'+ID.source+'(?:\\s*[〜~／/・,、と]\\s*)?)+(?:\\s*(?:後の|の|：|:|\\s|—|-)\\s*)?');
 const m=s.match(lead);
 if(m&&m[0].length<s.length){ids.push(m[0].replace(/(?:後の|の|：|:|\s|—|-)+$/,'').trim());s=s.slice(m[0].length).replace(/^[：:・、\s]+/,'');}
 return {title:s||String(raw||'').trim(),id:ids.join(' ')||null};
}
// Three tiers decide what the portal carries at all.
//   list : living documents, shown in the library (target 20–40 per repo)
//   link : dated reports, audits, task memos — opened from the task, decision
//          or search that refers to them, never listed
//   omit : code, data, logs, old entrances — no portal page; the source path
//          is named where something cites it
function tier(row){
 if(row.tier)return row.tier;
 const src=row.source||'';
 if(row.pinned)return 'list';
 if(row.cat==='archive'||/\.(?:py|js|cjs|mjs|ts|tsx|json|ya?ml|toml|css|sh|log|txt)$|LICENSE/i.test(src))return 'omit';
 if(row.cat==='record'||/(?:^|\/)(?:tasks|inbox|qa|evidence|runs|done|audits)\//.test(src)||/20\d\d-?\d\d-?\d\d/.test(src))return 'link';
 return 'list';
}

// Every listed document has one shape per type. The header (front matter)
// carries what the portal shows first; the sections give the reading order.
const SHAPES={
 strategy:{label:'方針',sections:[['結論',/結論|要点|まとめ/],['目的',/目的|ねらい|目指す/],['方針',/方針|戦略|進め方/],['決めたこと',/決め|決定|採用/],['まだ決めていないこと',/決めていない|未決|未確認|課題|次に|今後/],['根拠',/根拠|出典|参照|資料/]]},
 spec:{label:'仕様',sections:[['結論',/結論|要点|まとめ/],['目的',/目的|ねらい/],['範囲',/範囲|対象/],['構造',/構造|構成|形式|保存|画面|API|契約/],['約束と制約',/約束|制約|守る|互換|境界/],['まだ決めていないこと',/決めていない|未決|未確認|課題|次に/]]},
 guide:{label:'手順',sections:[['いつ使う',/いつ|目的|対象|始める|入口/],['手順',/手順|操作|進め方|起動|使い方|追加/],['確認',/確認|検証|検査/],['注意',/注意|守る|制約|限界|問題が出/]]},
 research:{label:'調査',sections:[['結論',/結論|要点|まとめ/],['事実',/事実|結果|公式|集計|現状/],['解釈',/解釈|分析|推測|考え|意味/],['限界',/限界|未確認|注意/],['出典',/出典|資料|参照|リンク/]]},
 record:{label:'記録',sections:[['依頼',/依頼|目的|範囲/],['やったこと',/変更|実装|実施|修正/],['結果',/結果|検証|検査/],['残り',/残り|未確認|次|引継/]]}
};
SHAPES.ai={label:'AIの環境',sections:[['役割',/役割|目的|使う|入口|概要/],['決まり',/決まり|規則|ルール|原則|必須|禁止/],['手順',/手順|進め方|流れ|ワークフロー/],['確認',/確認|検証|検査/]]};
SHAPES.tool={label:'画面',sections:[]};SHAPES.archive={label:'原文',sections:[]};
function shape(type,headings){
 const s=SHAPES[type]||SHAPES.research;
 return s.sections.map(([name,re])=>({name,found:headings.some(h=>re.test(h))}));
}
// Front matter a repo adds to each listed document (see README §5).
function frontMatter(md){
 const m=String(md||'').match(/^---\n([\s\S]*?)\n---\n/);if(!m)return {};
 const out={};let key=null;
 for(const line of m[1].split('\n')){const kv=line.match(/^(\w+):\s*(.*)$/);if(kv){key=kv[1];out[key]=kv[2].replace(/^["']|["']$/g,'');if(out[key]==='|')out[key]='';}else if(key&&/^\s+/.test(line))out[key]+=(out[key]?'\n':'')+line.trim();}
 return out;
}
module.exports={CATEGORIES,STATES,SHAPES,category,state,title,tier,shape,frontMatter};
