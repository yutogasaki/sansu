# ぽこもこの名前と共通画面

- Review By: 2026-09-15

## Goal / Scope

正式名を「ぽこもこと不思議な島」、アイコン下は「ぽこもこ」とする。ユーザーの設定画面にある黄色の全面背景と黄色の主操作を、採用くまのラベンダー・青・生成り、局所的な布のワッペンへ統一する。設定・記録・共通ナビ・初回・島の外側の操作面を対象にする。

## Docs To Touch

- docs/product/01_app_spec.md
- docs/product/07_ui_design_guideline.md
- design-system/MASTER.md
- docs/design/audits/2026-09-08-pokomoko-world/README.md
- docs/done/2026-09.md

## Boundaries

固定worktree `/tmp/sansu-pokomoko-world`、基準463508f。所有はindex.cssの新規色トークン、IslandShell.css、新規PokomokoWorld.css、Header/Footer/Layout、設定の見出しアイコン、正式名表記、対応するQA識別。並行中の島のロジック・成長・カメラ・正誤/効果音の変更を上書きしない。学習・保存・3Dアート・意味色・全キー・追加0操作は保持。公開について前回の「名前とアイコンだけ」のpush実績をこのUI全体の公開済み証拠とは扱わない。

## Verification

core、smoke/PWA、島の設定/記録/学習往復と保存、通常/縮小動作、phone/tablet・実初回画面。参考アイコンと実画面を比較し、視覚・理解/安全・runtimeを別判定。独立した子どもの観察は未実施。画像の世界や入力のレイアウトを変えないため、新しい遭遇フレームや新しい3D候補は制作しない。

## Progress

- 正式/短縮名、共有色、くまのヘッダーとナビ、設定の布ワッペン、初回画面を実装し、担当18ファイルの一致を確認して共有workspaceへ統合。
- docs/lint/typecheck、194ファイル/2,232テスト、classic build/smoke31/PWA4、島PWA8と実offlineがPASS。初回unit timeoutは元ログを残し、assertとtimeoutを変えず並列数2で全件PASS。
- 最終補助文字は生成り5.40:1、薄紫4.85:1。r3 productionでphone/tabletの往復22画面、新規welcome/setup4画面と正式/短縮名を確認。作者の視覚確認はPASS、子ども観察N=0。
- 固定10問80runは正解P95はPASSだが、phone誤答後と両サイズの区切り時間が未達。Runtime総合PARTIALを保持。最後の文字色/背景CSS優先度修正前の速度/PWA結果を、最終版のhashへ付け替えない。
- ローカルのデザイン実装として完了。追加UIのcommit/push/deployなし。公開前の固定production・競合なし速度測定と原因の切り分けを残す。
- [実画面比較](../../design/audits/2026-09-08-pokomoko-world/review.html) / [検証と未達](../../design/audits/2026-09-08-pokomoko-world/README.md)。
