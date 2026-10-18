# 内部ポータルUI 1.0.2（全リポ共通ポータル外枠・固定ナビ・検索/資料基盤）

`adapter.cjs` の `page` / `enhance` で明示採用した内部HTMLだけが対象。製品画面・公開サイト・保存原本には適用しない。固定shell/reader/integrationは変更しない。

## 担当

- `ui.css`：本文の字体・見出し・幅・余白、共通ナビ（スマホ2段コンパクト＋320px/200%折返し）、フォーム、検索結果、資料一覧、原文ダイアログ。
- `ui.js`：固定メニューの現在地、project切替、Escape、旧headerのページ内目次への移動。通常リンクをiframeへ変換しない。
- repo：データ抽出、検索索引、原文全件、固有の比較/図/フィルター、状態保存、復旧。repo CSSは固有のclassで限定し、body/main/header/見出し/共通フォームの宣言を重ねない。
- 既存のreader runtimeは検索条件復元/コピーAPIのため保持できる。旧reader/shell/integrationのCSSとshell runtimeは採用HTMLから除去する。固定vendor原本は保持する。

## 導入

このディレクトリ一式をrepo内vendorへpinする。lockはSHA-256で照合する。導入側だけを未commit修正する。

```js
const ui = require('./vendor/portal-ui/1.0.2/adapter.cjs');
ui.enhance(root, files, {
  slug: 'jishu', outputRoot: 'portal',
  // pages省略時はdata/unification.jsonまたはdata/integrated.jsonから同一台帳を自動派生
  pages: [{path:'index.html',title:'概要',category:'主要ページ',audience:'internal'}],
  currentPages: ['authoring/index.html'],
  preserve: [/* 原本/歴史HTML */], sources: [/* 導入側生成元 */]
});
```

`page(html,{slug,home,assetBase,workspaceHref,pages,projectLinks})` も使用可。すべてのページのメニューは同じ台帳から生成し、現在のDOMに依存しない。ページ固有headerのリンク/フォーム/注意文は本文の「このページの目次と関連リンク」へ移す。

`</head>` / `</body>` / `main` がないHTMLは生成エラー。生成元で妥当なHTMLへ直し、下層を黙って対象外にしない。

既存integration runtimeの通常ページviewerは導入側で無効化する。原文JSONや画像比較のcontextual dialogは保持。旧`?view=`は対象URLへ移行し、検索のshown/result/result-link条件と履歴を維持する。hubの旧`/view/<slug>/`はこの版の採用マーカーがあるときだけ`/repos/<slug>/`へ互換遷移する。

人向け検索はコード/スタイル/構造だけの行を既定結果に出さず、明示した原文表示で元の全件に到達できること。原レコードを削除・改変しない。

## 検証

`node --test common-portal/ui/1.0.2/adapter.test.cjs`（hub）。導入先の生成一致・必須検証と実ブラウザーの概要→資料→検索→内容→戻る、固定menu、1440/390/320、キー操作を別途確認する。HTML直開きの生成/参照検査をHTTPの実操作と同一視しない。

戻す場合は導入側のadapter呼出しとpinを前版へ戻して再生成。新UIは原文レコード・保存形式・元vendorを変更しない。
