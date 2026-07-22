# Root Pull v2 Value Loop Audit

- Date: 2026-07-21
- Candidate: `root-pull-v2`
- Baseline: `root-pull-v1` = 75 / 100（±4）
- Decision: **77 / 100（±3）、HOLD**
- Production fallback: `classic-v1`

## Outcome

v2は、1問目の葉先visor、2問目の「足がぴーん」、2種類のpayoff、3問目後のinline遷移、submit起点の誤答復帰予算を追加した。実TenKeyを残し、390×844と768×1024で3問を通せた。

身体ギャグと「次を見たい」は改善したが、全面生成JPGのAI感、2問目の弱い輪郭、似た2種類の帽子オチ、正解後の直列planner、量産時の画像・分岐・precache増加が残る。86点のproduction gateへは昇格しない。

## Score

| 軸 | v1 | v2 | 根拠 |
|---|---:|---:|---|
| 1秒理解 | 8 | **8** | readyで相棒・葉・埋まった対象を指せる。新規の無文字5人テストは未実施 |
| 回答・入力テンポ | 7 | **7** | 誤答feedbackは即時、submit起点420ms、2回目以降の支援assignmentはreceipt後にfeedback中予約、payoff後CTA 0。正解後planner先読みと50回P95は未実装 |
| 入力から世界反応までの因果 | 8 | **8** | 保存済み正解数だけでstageが進み、問題値とpayoffを分離。葉帽子の幅広葉が元の細葉と同一に見えにくい |
| 身体ギャグと驚き | 7 | **8** | 顔の葉先visor、片足、尻もち帽子へ笑いの部位が広がった。pull-twoはv1画像の再利用 |
| ポップな視覚魅力 | 7 | **7** | 色と輪郭は明るいが、丸い大目キャラと全面の均質な絵具textureはAI生成絵本の範囲 |
| 次のbeatを見たい欲求 | 7 | **8** | 葉が相棒へ返る規則を1問目で予告し、3問目まで追加tapなし。2問目では葉の返りが連続していない |
| リプレイ性 | 6 | **7** | 土帽子 / 葉帽子をrunごとに選び、同一UI sessionの直前variantを除外。最初の2問と着地型は同じ |
| コンテンツ拡張性 | 7 | **6** | 5枚の全面JPG、v2条件分岐、候補precacheが線形増加。layer / pose / anchor rendererは未実装 |
| 子どもの安全 | 9 | **9** | 対象も下から押す協力構図、痛み・敵対・羞恥なし。誤答stageは進まない |
| 学習との一体性 | 9 | **9** | 実planner / writer / receipt / SRSと数字TenKeyを維持。問題値・演算・assignmentを演出で変更しない |
| **合計** | **75** | **77** | **Go条件86、最初の6軸52、全軸8を満たさない** |

最新のpayoff anti-repeat、2回目以降誤答の支援assignment先読み、v2専用E2E、count-slot solver契約を反映した独立再採点でも **77 / 100（±3）、最初の6軸46 / 60、HOLD** のままとした。これらは回帰信頼性と7点評価の根拠を強めるが、P95、無文字テスト、画風・身体演技の改善証拠にはならないため加点しない。

最初の6軸は **46 / 60**。身体ギャグだけでなく、テンポ・非AI感・同じ物体が返る因果を同時に上げる必要がある。

## Implemented Evidence

- runtime assets: `public/assets/explore/opening-root-pull-v2/`
  - `ready.jpg`
  - `pull-one.jpg`
  - `pull-two.jpg`
  - `payoff-dirt-hat.jpg`
  - `payoff-leaf-hat.jpg`
- v1はrollback比較として維持し、local developmentだけv2を既定表示する
- payoff variantは問題値ではなくrun identityから決め、同一UI sessionの直前variantを除外する
- v2だけ3問目payoffを完了表示として使い、重複modalと説明用continue CTAを出さない
- 誤答は視覚feedbackだけ即時開始し、energy、attempt、SRS、stageはreceiptまで変更しない
- runtime JPGは800×1000を維持して再圧縮した

## Verification

- `npm run verify:core`: PASS
  - docs / lint / typecheck
  - 74 files、656 tests
  - production build
- `npm run e2e:smoke`: PASS
  - 19 scenarios
  - v2専用: 390×844、reduced motion、TenKey `1 / 2 / 3`、3 beats、inline payoff、dialog 0、説明CTA 0
  - ランダムに出る `5 / 10になるには あといくつ？` は、画面上のfilled / empty枠を数えるsolverで確認
- manual browser:
  - 390×844: ready、葉先visor、足ぴーん、葉帽子、土帽子、次の道選択
  - 768×1024: actor cropなし、TenKey表示
  - keyboard: 数字入力 → Enterで次問へ進行
  - 誤答復帰の外形単発観測: 474ms。P95ではないため採用根拠にはしない
- asset budget after build:
  - PWA precache 10.89 / 12.00 MiB
  - Explore artwork 6.63 / 8.00 MiB

未完了:

- silent / textless 5人中4人
- 正解・誤答各50回以上のP50 / P95
- Studyと同一10問の回答数/分比較
- 200%文字、インストール済みPWA offlineの手動確認

## Rejected Iterations

- `docs/design/characters/root-pull-v2/ready-candidate-rejected-01.png`
  - 葉の本数と形状が漂流し、ready改善にならないため却下
- `docs/design/characters/root-pull-v2/soil-cushion-rejected-01.png`
  - 土クッションとして受け止めた輪郭が弱く、普通に地面へ座っただけに見えるため却下

却下案は点数を上げるためにruntimeへ混ぜない。

## Next Loop

1. **Tempo**: 正解後も次問題をfeedback中に先読みする。実装済みの2回目誤答先読みと合わせ、50回計測で正解P95 650ms、誤答P95 550msを証明する。
2. **Art architecture**: 承認可能な相棒model sheetと対象behavior sheetを先に作り、固定背景 + 透明actor pose + 透明subject/effectを実viewBoxで合成するgeneric rendererへ移す。
3. **Physical continuity**: `pull-two` を、返った同じ葉で相棒が半回転する明確な全身silhouetteへ差し替える。葉帽子は引いた細葉そのものが返ったと読める形へ直す。
4. **Replay**: 葉帽子と異なる身体方向を持つ土クッションを、低い土盛りの輪郭が64pxでも読めるまで再設計する。
5. **Human gate**: 4状態を無文字で5人へ見せ、4人が `引く → 葉が返る → 相棒が崩れる` を説明できた場合だけ再採点する。
