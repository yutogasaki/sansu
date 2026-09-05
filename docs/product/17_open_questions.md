# docs/product/17_open_questions.md — 未決事項と判断理由

| No | 未決事項 | 選択肢 | 推奨 | 理由 |
|---:|---|---|---|---|
| 1 | 探索を主体験にする時期 | 即置換 / 独立検証後 | 独立検証後 | `/study` を壊すリスクが高い |
| 2 | 不正解ペナルティ | エネルギー減 / ボーナス減 / 両方 | MVPでA/B | 面白さと離脱のバランスを見る |
| 3 | 帰還失敗時の損失 | なし / 未確定素材のみ / スコアのみ | 未確定素材のみ | 緊張感が必要。ただし図鑑は守る |
| 4 | マップ形式 | ノード / グリッド | MVPはノード | 実装と認知負荷が小さい |
| 5 | 橋づくり | 固定選択 / 配置パズル / 物理 | 固定選択 | 最初から物理は重い |
| 6 | 英語 | 既存維持 / 地底統合 / 別ゲーム | 別ゲーム候補 | 英単語4択と地底採掘は相性が限定的 |
| 7 | バトル | 維持 / 主導線外 / 協力探索化 | 主導線外 | 主目的が分散する |
| 8 | いきもの消失 | 維持 / 旅立ち / 常駐 | 旅立ちか常駐 | 愛着損失を避ける |
| 9 | コンボ | MVPから / MVP後 | MVP後または簡易 | 先に基本ループ検証 |
| 10 | 保護者向け表現 | 学習成果中心 / ゲーム説明中心 | 両方 | 保護者信頼に必要 |
| 11 | cold-openのproduction actorと身体action | マキモドン継続 / Root Pull / Dig Pop / 別案 | **formal production採用は未決定**。既知mixed-lineage FAILを止めるcontainment defaultは `snap-root-v1` / `dig-pop-carry-bloom-v3` | `classic-v1` は実機で旧マキモドンから別rendererへ切り替わるためrollback不可。v3と後続v5は旧候補の点数を継承せず、exact-build監査と無文字5人テストまでformal承認HOLD |
| 12 | 固定8問reward graphを最終ゲームの土台にするか | 現行を演出改善 / 連鎖採掘へ再設計 / 別coreを探索 | **[コアゲーム再設計案](./18_core_game_redesign_proposal.md)で根因を確定し、候補の絞り込みは[問題起点のコア設計案](./19_problem_first_core_design.md)の手順に従う。G1の実算数、G2の継続性、学習安全性、three-gate通過後だけ正式仕様へ昇格する** | 現行は `正解数 = 移動数 = 発見数 = 報酬段階` の一本道で、選択、運、失敗、持ち帰りが次の作戦へ作用しない。停止削減やart改善だけでは再プレイ動機を作れない |
| 13 | コアメカニクスを自作するか、実績ある構造を借用するか | 自作を続ける / 操作文法と報酬構造を借用する | **借用する。[19_problem_first_core_design.md](./19_problem_first_core_design.md)を正とする** | 118スキル全部に載らないメカニクスをコアに据えると、問題編成をメカニクスへ合わせて曲げる圧力が必ず発生する。借り元が実績を持つなら、検証対象は「面白いか」ではなく「算数が壊れずに載るか」に縮小できる。借りるのは操作文法と報酬構造だけで、キャラクター、固有名、アート、音、画面構図は借りない |
| 14 | 全118スキルへの内在的統合をどの軸で作るか | 数量の意味を世界作用へ翻訳 / 難易度と速さを賭けと倍率へ変換 | **2層にする。共通レイヤは難易度と速さ、深いレイヤは契約が書けるskillのみ**（[19章 §3](./19_problem_first_core_design.md)） | 数量の意味は全スキル共通ではなく、[18章 §5.3](./18_core_game_redesign_proposal.md) の契約を書けるskillでしか成立しない。難易度と速さは全118スキルが持つ。契約のないskillでも共通レイヤが動くため体験が欠落しない |
| 15 | 子どもに出題難易度を選ばせるか | plannerが単一予約 / plannerが候補集合を予約し子どもが選ぶ | **候補集合の内側でだけ選ばせる**（[19章 §6.2](./19_problem_first_core_design.md)） | どれを選んでもSRS、Due、weak、解放guardの正当性が壊れない範囲に限定する。難易度選択はDue / weakの回避を生むため、少なくとも1枚に必ずDueまたはweakを含める。正式決定は [11_learning_integration_spec.md](./11_learning_integration_spec.md) で行う |

## MVP-0/1で採用中の実装選択

The first `/explore` implementation resolves only the following build-time choices; product-wide decisions remain open until playtesting.

- No.2: use the configurable **energy -1** incorrect-answer policy as the initial default. Keep the penalty in pure reducer configuration so a bonus-loss policy can replace it without rewriting the page.
- No.4: use a node map.
- No.5: include one fixed bridge choice event only after the base dig loop works; defer physics.
- No.9: コンボ数だけを表示し、コンボ報酬はまだ実装しない。
- Learning impact: do not write answer logs or SRS in MVP-0/1.

## cold-openの現在の判断境界

- 承認済みなのは「解く → 即世界反応 → 3問目に同じ身体規則のオチ」という体験順だけで、actor、固有名、図鑑ページは未決定
- 固定cold-openだったマキモドンはproduction承認を撤回し、画風混在が実機確認された `classic-v1` はrollback先にしない。既存コードやlegacy保存IDが残ることを採用根拠にしない
- `opening-root-pull-v1` は旧比較用検証IDであり、現行containmentのdelivery / feature flagは `snap-root-v1`、visual candidateは別ID `dig-pop-carry-bloom-v3` とする。既存 `root-tangle` 遭遇とは別物である
- Go条件は [15_mvp_rollout_verification_spec.md](/docs/product/15_mvp_rollout_verification_spec.md) の非補償三ゲートを正とする。runtime視覚52 / 60以上かつ全6軸8以上、無文字の主動詞・payoff一致4/5、続行希望4/5、危険解釈0、650ms / 550ms、追加0タップ、answer leak 0、同一10問throughput同等以上をすべて満たす。旧86点などの混合点は採用条件にしない
- 比較根拠は [2026-07-20 score benchmark](/docs/design/audits/2026-07-20-score-benchmark/README.md)、旧案の欠陥履歴は [2026-07-21 Root Pull value loop](/docs/design/audits/2026-07-21-root-pull-value-loop/README.md)、旧runtimeのplumbing証拠は [Dig Pop Painted v2 runtime監査](/docs/design/audits/2026-07-21-dig-pop-painted-v2/README.md) を参照する。v3は新しいexact-build証拠を正とし、自己採点や自動テストだけでproduction採用しない
