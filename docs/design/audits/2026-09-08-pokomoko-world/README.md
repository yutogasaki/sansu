# ぽこもこと不思議な島 — 共通画面

[実画面の比較](review.html) · [画面の識別とhash](capture-manifest.json) · [往復検査](ui-report.json) · [固定ソース](source-manifest.json)

## ユーザーの採用と範囲

正式名は「ぽこもこと不思議な島」、アイコン下の短縮名とAppleホーム画面名は「ぽこもこ」。ユーザーの「こんなきいろじゃなくてぽこもこ世界観にしたい」に対応する。

参考は[採用くま](../../brand/pokomoko-icon-master.png)と[user-before.png](user-before.png)。大きな色面はラベンダー・青・生成りへ、顔はヘッダーと中央ナビへ移し、設定の4項目は小さな布のワッペンとして表現。画像の細かな織り目や全面の模様を情報面に移さず、問題と入力は読みやすい無地を保つ。新しい生成画像はない。

設定・記録・復習/テスト・共通ナビ・初回と島の外側の操作面を変更。3Dの住民・地形・家具、学習図形の意味色、正誤、レイアウトと全キー、ルーティング、保存処理は変更しない。設定の見出しには開閉状態の`aria-expanded`を付けた。

## 確認対象

- 固定作業コピー: `/tmp/sansu-pokomoko-world`、基準commit `463508f`。
- Production preview: `http://127.0.0.1:5373/`、revision `pokomoko-world-463508f-r3`。
- Delivery: `mystic-island-v1` / `VITE_ISLAND_ENABLED=true`、world `mystic-island-living-v5`、learning `mystic-island-learning-v2`、resident `patchwork-otter-v1`。
- 共通画面候補: `pokomoko-shell-v1`。実DOMの`data-shell-candidate`で確認。
- 本番形式buildのphone 390×844（touch・通常motion）とtablet 768×1024（reduced motion）、計26画面。実versionの完全値はcapture manifestと各names JSONへ保存。
- 往復検査は捨てられるnativeプロフィールを明示的に初期化し、実plannerの学習と1問の回答から始める。子どもの実参加や、実プロフィールの初回導入を装った証拠ではない。新規プロフィールのwelcome/setupは別contextで追加確認。
- 並行中の学習・島・成長・カメラ・効果音などの変更はこの固定ベースに混ぜず、担当する表示ファイルと仕様の差分だけを共有workspaceへ統合した。

## 別々の判定

| 観点 | 結果と限界 |
|---|---|
| 見た目 | 作者が参考と実画面を比較。黄色い全面背景を解消し、同じくま・青い主操作・ワッペンで設定と島を接続。文字や操作を布の模様に埋めていない。新しい3Dアートの承認ではない |
| 理解・安全 | 既存の見出し、ナビ3項目、戻る、全入力を保持。色だけに依存せずアイコン・文字・選択状態がある。主操作の白/青は6.11:1、本文/面は11.70:1、補助文字/生成り面は5.40:1、補助文字/薄紫面は4.85:1。独立した子どもの観察はN=0、学習効果・再遊びは未評価 |
| Runtime | 全2,232テスト、起動とPWA回帰、最終productionの保存を保った往復がPASS。固定10問は誤答後/区切りの時間基準FAIL。Runtimeの総合判定はPARTIALとし、公開認定にしない |

## 検証と最初の失敗

- docs/lint/typecheck PASS。初回の全testは学習進行の1件が15秒のtimeout、残り2,231件PASS。関係する学習処理は変更していない。同時実行数を2に制限して全194ファイル・2,232件を再実行しPASS。assertやtimeoutは変更せず、元の失敗をinitial-timeout.log（`initial-timeout.log`）へ保存。負荷が疑われるが原因を断定しない。
- build/assets（`build.log`）、smoke31（`smoke.log`）、classic PWA4（`classic-pwa.log`） PASS。PWA容量10.21MiB / 12MiB。
- production UI: 設定の開閉、記録、島、通常学習へ戻る、reload、旧通常練習リンク、明示的な復習/テスト、他ゲーム一覧。保存済み問題・cursor・支援・報酬・ログを往復前後で照合しPASS。ナビの44px/hit/文字・横溢れも検査。
- 新しいwordmarkの初回追加撮影では、2段の見出しに対する空白なしの完全一致を待ちtimeout。目視とDOMでは正しい見出しだったため、QAで段の境界の空白だけを許容し、全文・metadata・短縮名を保持して再確認した。appや検査すべき名前は変更していない。
- 共有workspaceへ統合後のtypecheck PASS。最終版の担当18ファイルが固定コピーと一致（[merged-source.json](merged-source.json)）。共有workspaceの別作業の全体認定には用いない。

## 速度の未達と最終色調整の境界

- [固定10問report](throughput-report.json)はphone/tablet × 2 lanes × 2シナリオ × 10反復、80 run。ソース810ファイルが前後一致、誤答20件/サイズ、問題間の追加操作0、入力リセット、保存整合、browser errorなしを確認。
- 正解後の入力可能P95はphone 645.5ms / tablet 500.9msで650ms以内。誤答後は925.8 / 407.5msでphoneが550ms超過。区切りP95は737.1 / 835.7msで両方650ms超過。Island/Studyの正答throughput比は1.065 / 1.011。`pass=false`を保持し、速度の合格へ読み替えない。
- このDEV測定中には他作業のE2E/build/testも動いており、負荷を統制していない。重複だけが原因とは断定できず、公開前に固定production・競合なしの測定と未達原因の切り分けが必要。学習ロジックや時間基準をこの表示変更に便乗して変更しない。
- 速度・unit・smoke・classic PWA・[Island PWA](island-pwa-report.json)は最後の補助文字色と背景CSSの優先度修正前。Island PWAは5371の実productionで保護境界8件と実service workerによるoffline再読込、回答/自動成長保存、同予約への再開がPASS。対応する入力は[throughput-source.json](throughput-source.json)。速度測定自体は5370 DEVであり、PWAとは別の実行環境。
- 最終目視で補助文字`#687087`が薄紫面では4.36:1と分かったため、共有トークン1個を`#606980`へ修正。さらに一覧比較で学習画面の背景だけ旧黄色と判明。同詳細度の既存CSSが後から優先されていたため、背景と作業面のセレクタを限定したまま優先度を上げた。問題の意味色・回答UIの色・動作は変更していない。変更後にr3をbuildし、phone/tabletの往復22画面と空プロフィールのwelcome/setup4画面、正式/短縮名を再検査した。final-build.log（`final-build.log`）と[ui-report.json](ui-report.json)が最終版の証拠。PWA precacheは10.22MiB/12MiB。最終色へ旧速度reportのhashを付け替えず、再測定済みとはしない。

## 配布

ローカルに実装・統合。前回の名前/アイコンのpushは、この追加UIの公開済み証拠ではない。iOS/Android実機、インストール済み名称がOSで更新される時期、公開先は未確認。
