# 通常ゲームの地形編集 — 検証記録

検査日：2026-10-22 JST。対象は共有working treeのローカル製品build。commitや公開版の合格ではない。

## 固定した対象

- app: `http://127.0.0.1:5495/#/island`、Island=true、NatureTown=false、delivery `snap-root-v1`。
- revision: `development-local`、最終buildVersion: `development-local:7854d428-6f2a-4891-ad97-7f90dee5ba83`。
- candidate: `editable-lived-island-v1`、floor: `editable-common-floor-v1`。通常ゲーム素材で検査し、native05 viewerを本体の証拠にしない。
- [最終入力manifest](input-manifest.json)はsrc/public/package/config/indexとdistのSHAを持つ。[終了照合](input-manifest-after.json)で同一性を確認。[検査と共有運用の入力](verification-inputs.json)は別に固定する。
- [時刻付き実操作](journeys.json)、[contact sheet](../index.html)。初期取得、経路修正版、最終画角版を区別。学習面には世界candidateがないためroot identityだけを記録。

## 実操作の結果

期待：地形、所有物、住人、学習、保存が同じ通常ゲームでつながる。

実結果：新規originの通常初回体験で家を置き、うさこを迎えた。岸を3段掘って水辺にし、家を移し、地形undo/redoで所有物を巻き戻さないことを確認。支持を失う家の足元・現在の住人の足元の変更は拒否。初回設定へ同じ島を引き継ぎ、実問題4問に回答してしずく8。移したベンチを自然に歩いたうさこが利用した。

最終版では同じ保存を通常reloadで更新。回転した全景の岸、390/320幅の編集、近景/全体、以前の履歴undo/redoを確認。320幅のscrollWidth=320、全編集ボタン44px以上。サーバーを停止しcurlの接続拒否を確認後、キャッシュから島と学習予約2/6を再開。停止中のundo保存をreloadしてredoできた。最終観察時のconsole errorは0件。

DB注入・残高付与・時計加速なし。サーバー停止は対象originへの通信不能であり、OS機内モードや実端末PWAの証拠ではない。実参加者の理解/再訪は測っていない。

## コマンド検査

| コマンド（Node 22.23.3、portalのみ24.18.0） | 期待 | 実結果 |
|---|---|---|
| `npm run build`（tsc + 製品/website build + assets） | 型・生成・予算成功 | PASS。precache158件8.89/12MiB、美術2.97/8MiB。[ログ](acceptance-build.txt) |
| `npm run lint` | errorなし | PASS、既存refresh warning4件。[ログ](acceptance-lint.txt) |
| `npm run test:run -- --maxWorkers=2 --minWorkers=2` | 全体完走 | PASS、660ファイル / 5,570テスト、exit0。08:17:35開始、1322.66秒。[最終ログ](acceptance-tests.txt)。 |
| `npm run e2e:smoke` | classic32旅程 | 再実行32 PASS、exit0。[ログ](classic-smoke-32-pass.txt)。最初はtablet数値10が1になる1件FAIL。原因断定せず[初回ログ](classic-smoke-first-failure.txt)を保持。地形以外の学習入力を変更していない。smokeはDEV classicであり本体production旅程とは別。 |
| occupied gallery/store guard対象 | 外の通路を切って滞在床を消すedit/undo/redoを拒否 | 3ファイル15 PASS。[ログ](occupied-place-guard.txt) |
| fixture/firstPlay/onboarding/persistence対象 | schema変更と既存初回移行の互換 | 4ファイル36 PASS。[ログ](fixture-compatibility.txt) |
| `npm run typecheck` / `npm run check:current-ui-entry` | 型と通常入口 | PASS。[型](acceptance-typecheck.txt)・[入口](acceptance-entry.txt)。 |
| `npm run docs:check` | 正本・リンクの整合 | PASS、期限超過の既存警告14件。[ログ](acceptance-docs.txt)。終了文書の最終再検査は `acceptance-closeout-docs.txt`。 |
| `npm run agent:index` / `npm run agent:index:check`（portal含む） | 現在目標と生成物の一致 | 目標/flow同期後の生成2054ファイル、元7ページ/43,218項目/372,945リンクの検査は通過。検査fixture修正後の生成manifestを最終再生成して照合する。最終コマンド結果は `acceptance-closeout-index.txt` の終端を参照。 |

初回全体検査は編集中のmodule読込と古いQA table期待値で失敗し修正。初回と画角修正前の2回目は中断したためPASSには含めない。最終固定版は660ファイル5,570件を完走し、失敗0。

共有キューとflowが旧入り江の輪郭選択待ちを現在の停止条件にしていたため、本体の地形・配置・暮らし・保存へ現在目標を同期。旧候補の美術採用とは切り分けた。portal初回検査は古い生成原本との不一致がある状態でexit137となった。生成を試すとflow根拠hashの不一致を明示検出したため、意味を確認してキュー/flow/生成物を同期した。再検査では「承認待ちが必ず一件ある」という負例検査の前提が落ちたため、検査専用の有効な承認待ちfixtureを作ってから空の依頼を拒否する検査へ修正。検査の除外や架空の承認待ちの追加はしていない。アプリsource/distは変更していない。

## 未確認・別の受入

参考作品と同等の全島美術、どの配置でも魅力が保たれること、子どもの無説明理解/再訪、実機の長時間性能、自然な数日の成長、全旧配布版からの更新/rollback、公開受入は未確認。ローカルcommit・push・公開・新たな外部監査送信は行っていない。
