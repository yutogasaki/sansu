# Mystic Island — implementation and runtime audit

## Status

ローカル実装・必要な技術検証を完了。最終ビルドの画面、回答録画、保存、連問速度を以下に保存した。公開先の変更はこの作業に含めていない。

## Adopted scope

- [島の仕様](../../../product/28_mystic_island_spec.md)
- [ユーザー提供の原資料](../../references/mystic-island-goal-pack-v0.1/README.md)
- 学ぶ→光→島の反応→区切りの受取権→選ぶ/配置/再移動→住民が使う→次の学習。
- 通常6問、初見/複雑3問。通常問題間は追加0タップ。報酬は後回しにできる。
- 自律補完: 2区間で橋と庭、4区間でキツネ、6区間で灯台。家具6種類。通貨・ガチャ・放置罰は導入しない。

## Source and visual transfer

原資料の明るい海、草、赤い屋根、星の木、住民の生活を採用。描き込まれた葉、絵画質感、過剰なボケ、既存IPのキャラクターは移さない。Three.jsで島と物を独立造形し、学習・受取・配置で同一sceneを保持する。DOMが全問題・入力・操作を持つ。

最初の実画面は海と芝生が白く抜け、島が平たい台に見えた。海と屋根・草の色を分け、砂浜の輪郭と水の奥行き、住民の大きさを修正。住民が海を直線で横切る問題は、岸からの余白と建物・家具の障害物を避け、橋経由で歩く経路へ修正した。338フレームの実座標と橋上の足元、東の庭のベンチ着座を確認。技術テストを絵の魅力の証拠に数えない。

通常6問・初見/複雑3問としたのは、毎問の入力をそのまま使い、頻繁な受取操作で連問を止めないため。180msの短い入力保護は押し続け・連打が次問へ混入するのを防ぎ、光と動物の演出は次の入力と並行する。獲得の選択・配置を後へ回しても受取権は残る。島の大きな変化は2/4/6区間で実際に起こる。

## Non-compensating gates

| Gate | Evidence boundary |
|---|---|
| Visual appeal | 作者のローカル画面確認はPASS。[同一ビルドのcontact sheet](contact-sheet.html)で390×844/768×1024とムードを並べ、草・屋根・海の色分け、独立した物、入力の読みやすさを確認。独立した美術承認と子どもの再遊び評価は未実施 |
| Silent comprehension / safety | 作者の表現・操作確認はPASS。誤答時の罰・獲得物没収・放置罰はなし。未説明5人の理解/自発的再遊び観察は未実施。公開昇格はHOLD |
| Runtime integrity | 全入力・保存・再開・報酬・配置・PWAと固定10問の正式反復はPASS。ソースを固定し、最終productionビルドと照合 |

## Final app identity

- App target: `http://127.0.0.1:5298/#/island`。production形式のローカルpreview。
- Revision: `aa36adad7dcc-island-ff6a931ccb86`。
- Build version: `aa36adad7dcc-island-ff6a931ccb86:f3e7948e-d4d3-492a-9962-a6974fcb8420`。
- Delivery: `mystic-island-v1` / `VITE_ISLAND_ENABLED=true`。
- Visual candidate: `mystic-island-three-v1`。
- [415入力ファイルのSHA-256](evidence/build-source.json)、[16画面それぞれの版とSHA-256](evidence/production-capture-report.json)。既存の未コミット変更を含む作業ツリーからbuild。Git HEADだけを最終実装のrevisionとは称さない。
- [通常6問の全テンキー、筆算、分数の画面記録](evidence/production-input-report.json)も同じmanifestへ照合。正解の光が届いている時点で次問は入力できる。[実回答の録画](runtime/phone-numeric-actual-answer.webm)。

## Requirements and evidence

| Requirement | Authoritative evidence |
|---|---|
| Normal learning, existing SRS and sticky support | island domain tests; normal planner E2E math/multi/hissan/choice/vocab; support/reload/Due assertions |
| Rapid, nonblocking correct response | fixed-ten Study/Island comparison, input-ready timers, zero ordinary extra taps and no input carry-over |
| Frozen6/3-question sections | domain reservation/reopen tests and first-learning/ordinary E2E |
| Meso reward can defer, never duplicated | atomic completion/claim rollback, duplicate and CAS tests; real continue-before-claim flow |
| Free placement/move/rotation/storage | terrain and footprint domain assertions; touch canvas + keyboard controls and reload E2E |
| Two residents, house, initial plants/lamp | actual first-visit runtime captures |
| Residents use possessions | rendered bench sit target, route points and reaction frame |
| Long-term world progression | 実際に6区間をUIで解き、2区間の橋、4区間の3体目、6区間の灯台を確認。[経路・成長記録](evidence/east-growth.json) |
| Offline/profile boundaries/update safety | additive v6→v7 migration, deletion/profile isolation tests, production PWA/offline report |
| Consistent readable3D on critical path | welcome/home/learning/reward/placement/next-learning contact sheet, candidate/build metadata |

## Verification

- Final `npm run verify:core`: PASS (109 files /1181 tests)。[全ログ](evidence/core.log)。docs/lint/typecheck/production build/assetsもPASS。PWA precache10.49MiB /12MiB。
- Existing `npm run e2e:smoke`: PASS.
- Existing `npm run e2e:pwa-update`: PASS,4 flows including controlledSW version recovery.
- Existing Park: DEV6 flows and production3 PWA flows PASS with Islandflag off.
- Island: actual signup +8 normal-planner variants PASS; real context loss/fallback answering/recovery PASS.
- Final production Island: PWA保護4フローと実Service Workerでのoffline回答・再開PASS。[PWA記録](evidence/pwa-report.json)。2サイズで実際に解いた一区間→受取→回転配置→ベンチ着座→reload→次の学習PASS。
- Final fixed-ten: 80lane完走、`evidence.eligible=true` / `pass=true`。全12gate PASS。[正式raw記録](evidence/fixed-ten.json)。

通常plannerと回帰の記録は [通常入力](evidence/normal-planner.json)、[表示の復旧](evidence/webgl-recovery.json)、[Park回帰](evidence/park-regression.json)、[Park production回帰](evidence/park-production-regression.json)、[smoke](evidence/smoke.log)、[既存PWA](evidence/existing-pwa.log)。これらは実装中のDEV/回帰証拠であり、最終画面のビルド同一性は別途production contact sheetで示す。

## Growing-island performance

同じ材質の描画をまとめ、実際に影を落とす物が変わった時だけshadow mapを更新するよう修正。配置の当たり判定・個体の選択・発光材質を保持した。6種類を並べた画像は変更前後で全pixel一致。50小物の画像は786,432pixel中1pixelのみ微差。

地形・衝突の配置条件を満たす50小物で、idleのdraw callsは433→169、普通の回答演出中は最大170。初回の影uploadは303で、回答中とは区別する。通常の本番画面は76〜80draw calls。[詳細](density/README.md)。

実Apple M4 Metalのウォームアップ後の一回診断では、50小物の描画間隔P95は42.2ms、次の入力まで192.4ms。[hardware記録](density/hardware.json)。世界の描画は約30fpsを上限にし、入力処理は独立する。これはdesktop Chromiumの診断で、実機スマートフォンのfps・電池寿命を保証しない。固定問題の反復比較は別の証拠とする。

## Consecutive-learning comparison

固定10問、各サイズ10反復、全問正答/4・8問目誤答の2条件、Study/Islandを交互に実行した80lane。6問目の区切りで実際に「つづけて とく」を操作し、贈り物を保留した次の区間まで含める。演出中も入力でき、通常の問題間の追加操作は0。各サイズの正答180標本・誤答20標本で、同問再試行、入力残留なし、atomic receipt一致を確認。

| Metric | 390×844 | 768×1024 |
|---|---:|---:|
| Study中央値（問/分） | 123.18 | 123.15 |
| Island中央値（問/分） | 271.50 | 275.13 |
| Island / Study | 2.204 | 2.234 |
| 正解→次の入力 P95 | 194.0ms | 194.2ms |
| 誤答→同じ問題の再入力 P95 | 192.7ms | 193.2ms |

326.843秒で完走。開始/終了SHA一致、最終production manifestと重複する411ソースファイルがすべて一致。[照合記録](evidence/benchmark-build-match.json)。DEVの固定fixtureで入力内容を揃え、実際のIsland writerを使う。Studyは既存の記録しないDEV fixtureなので、通常planner真正性と子どもの実学習速度の証拠にはしない。音なし・reduced motionでの自動キーボード操作速度である。

最初の試行はStudy laneの応答待ちで中止し、[診断記録](evidence/fixed-ten-first-study-timeout.json)を保全した。失敗時の観測を追加し、操作順・待ち時間・判定・アプリは変えず再実行した80laneでは再発しなかった。DOM表示と入力受付のタイミング差はコード上の仮説で、原因確定とは扱わない。最初の部分結果を正式集計へ混ぜない。

## Local use

`npm run dev:island` → [島を開く](http://127.0.0.1:5198/#/island)。既存プロフィールがあればその学習状態を利用する。初回は島と同じ表現の設定から始まる。productionは `VITE_ISLAND_ENABLED=true` のbuildで有効。flag-off rollbackでもv7の保存データは消さない。

再検証: DEVを5198で起動して `npm run e2e:island` と `npm run benchmark:island-fixed-ten`。島flagを有効にbuildし5298でpreviewを起動して `npm run e2e:island-pwa`、`node tools/e2e-island-production-capture.mjs`、`node tools/e2e-island-production-inputs.mjs`。速度の正式測定中はソース変更・別のブラウザ検証・buildを並走させない。

## Release observation still needed

子どもが無説明で何を理解し、もう一度戻りたくなるかは未説明の利用者観察が必要。自動解答の高い処理速度を子どもの実学習速度と同一視しない。実機の長時間熱・バッテリー・PWAインストール確認はdesktop Chromiumの代用検証とは別。
