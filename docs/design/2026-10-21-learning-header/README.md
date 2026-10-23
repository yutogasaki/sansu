# 学習ヘッダーと筆算の作業領域

監査後の小画面の語の折り返し・指示固定の修正は[追加実装と実画面](refinement/README.md)を参照。以下の画像・検証は初回実装時点の記録。

ユーザーの実装依頼により、通常Island学習のぽこもこを島名と音の間へ移した。相棒専用の大きな舞台を撤去し、48px全身（360px以下は32px）で既存モデル・着替え・入力反応を保つ。愛着を保ちながら筆算を主役に戻す。採点・問題生成・保存・自動確定は変更しない。

[相談](https://chatgpt.com/g/g-p-6ad58d0857b881918e46e346350848e7/c/6ad75886-d5c0-83ec-8f33-cc19ef39e6c7)を踏まえたローカル実装。[正本44](../../product/44_display_layout_spec.md#学習と退出)と[UI仕様07](../../product/07_ui_design_guideline.md)を先に更新した。新しい入力方式・通貨・採点・音設定は追加していない。既存の未コミット変更は保持し、commit/push/公開はしていない。

## 表示

- 正誤・支援完了・短い連続反応は同じ高さの領域を使い、通常の発話は常設しない。短い縦画面では科目・問数の間へ返事を収める。ヒント本文は従来の支援面に残す。
- 長い筆算は途中行へ残りの高さを渡す。高さ660px以下では用紙を一箇所でscrollし、商・被除数をstickyで残す。現在入力欄の下端が枠線に隠れないようclientHeightで判定し、回転・header reflowにも追従する。商の入力中は最新のおろした行を見せる。
- 短い横画面の筆算は左を用紙、右を科目/問数・全キー・支援操作とする。島名は折り返し、headerは音・退出の文字付き操作を保ってwrapする。
- 相棒のportal後も、入力元・実際の前足・解答欄の座標基準を用紙に揃える。演出はpointerを取らず、回答を待たせない。

## 実画面と検証範囲

対象は `/#/island` の通常学習、Island=true / NatureTown=false、delivery `snap-root-v1`、learning candidate `pokomoko-pop-live-v8`、layout `header-companion-v1`。revision・version・対象ファイルSHAは[source.json](source.json)、runtimeと各寸法は[browser-verification.json](browser-verification.json)、商の入力時は[quotient-verification.json](quotient-verification.json)。DEVの隔離ブラウザであり公開版・実iPhoneの証拠ではない。

写真の157÷6を全段筆算v2の明示IndexedDB fixtureとして再現した。これは通常plannerがその問題を選んだ証拠ではない。390×844 / 390×700 / 320×568 / 768×1024 / 568×320で全数字、編集キー、現在入力、支援、音、退出の44px以上・画面内hitを検査。37・36・入力欄、また商入力とおろした37の可視性がPASS。9の誤答→1へ訂正→次問、ヒント前後のテンキー位置不変、帰島/再入場で同じ予約・cursor、音off、reduced motionを確認した。

長い島名とheader文字2倍の診断は390/320幅・高さ844で音/退出の可視性を確認した。DOM文字/フォントの診断であり、OSズームや320×568の全文字200%合格ではない。最小画面では見出し・指示・補助文を読むためのscrollが残る。相棒の小ささが子どもの愛着や演技の理解へ与える影響、独立理解・再訪、実機音とWebKit、cold-cache/PWA更新は未確認。

- [通常スマホ](ready-390x844.png) / [小画面](ready-320x568.png) / [短い横画面](ready-568x320.png)
- [誤答訂正](retry.png) / [ヒント](hint.png) / [再開・reduced motion](resume-reduced.png)

## コマンド

Node22.23.3を直接PATHへ指定して検証。nvmは未導入、fnmのmultishell作成はsandboxに拒否されたため既設runtimeを使用し、依存lockは変更していない。ローカルのrawログと実行スクリプトは `output/learning-header-20261021/`。

- `npm run docs:check`: PASS（既存タスクのReview By警告あり）。
- `npm run lint`: PASS（既存prototypeのFast Refresh警告4件、errorなし）。
- `npm run typecheck`: PASS。
- `npm run build`: PASS、`assets:check` PASS（precache 8.82MiB/12MiB）。最終Node22 buildは `build-final-node22.log`。
- 対象 `IslandAnswerFeedback` / `IslandAnswerForm` / `writtenArithmetic`: 3ファイル82テストPASS。
- `npm run test:run`: 651ファイル5,526テストPASS（819.39秒）。共有dirty checkoutで開始。実行中に表示の最終調整と返事の優先順位1件を追加したため、最終差分は対象82テストと開始/終了SHA一致の実画面検査で補完した。全release/PWAの合格とは扱わない。

UI検査の初回失敗もrawログに保持。Chromium起動のsandbox拒否は隔離browserの承認実行で解消。再読込後に自動復帰するのに開始buttonを待つ、次問も筆算と固定する、という2件はharness誤りとして訂正。小画面のhistoryが潰れる/入力枠下端が切れる失敗はアプリ側を直して再実行した。

### 索引の別件不整合

追加の `npm run agent:index:check` は閲覧用4ページがstaleとして失敗したため、指定どおり `npm run agent:index` を実行して `.agents/index.html`・`.agents/tasks/index.html`・`docs/index.html`・`.agents/map.html` を再生成した。続く標準portal生成は `Stale flow evidence: docs/tasks/active/2026-09-27-living-fantasy-first-playable.md` で停止した。この文書とflow証拠は開始時から別作業の未コミット変更があり、今回の学習UI変更では触れていない。他作業の証拠hashを通過目的で更新しない。portal全体の検証は未完、製品のdocs/lint/typecheck/unit/buildと対象UIの結果とは分離する。rawログは `output/learning-header-20261021/agent-index-refresh.log`。
