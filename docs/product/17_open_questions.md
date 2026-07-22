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
| 11 | cold-openのproduction actorと身体action | マキモドン継続 / Root Pull / Dig Pop / 別案 | **production採用は未決定**。local validationは `snap-root-v1` / `dig-pop-painted-v2` | v2はruntime視覚52〜53 / 60と速度・入力サブゲートを通過したが、無文字5人テストと旧高速10問throughput比較が未完了。defaultは `classic-v1` |

## MVP-0/1で採用中の実装選択

The first `/explore` implementation resolves only the following build-time choices; product-wide decisions remain open until playtesting.

- No.2: use the configurable **energy -1** incorrect-answer policy as the initial default. Keep the penalty in pure reducer configuration so a bonus-loss policy can replace it without rewriting the page.
- No.4: use a node map.
- No.5: include one fixed bridge choice event only after the base dig loop works; defer physics.
- No.9: コンボ数だけを表示し、コンボ報酬はまだ実装しない。
- Learning impact: do not write answer logs or SRS in MVP-0/1.

## cold-openの現在の判断境界

- 承認済みなのは「解く → 即世界反応 → 3問目に同じ身体規則のオチ」という体験順だけで、actor、固有名、図鑑ページは未決定
- 固定cold-openだったマキモドンはproduction承認を撤回する。既存コードやlegacy保存IDが残ることを採用根拠にしない
- `opening-root-pull-v1` は旧比較用検証IDであり、現行local validationのdelivery / feature flagは `snap-root-v1`、visual candidateは別ID `dig-pop-painted-v2` とする。既存 `root-tangle` 遭遇とは別物である
- Go条件は [15_mvp_rollout_verification_spec.md](/docs/product/15_mvp_rollout_verification_spec.md) の非補償三ゲートを正とする。runtime視覚52 / 60以上かつ全6軸8以上、無文字の主動詞・payoff一致4/5、続行希望4/5、危険解釈0、650ms / 550ms、追加0タップ、answer leak 0、同一10問throughput同等以上をすべて満たす。旧86点などの混合点は採用条件にしない
- 比較根拠は [2026-07-20 score benchmark](/docs/design/audits/2026-07-20-score-benchmark/README.md)、旧案の欠陥履歴は [2026-07-21 Root Pull value loop](/docs/design/audits/2026-07-21-root-pull-value-loop/README.md)、現行runtime証跡は [Dig Pop Painted v2 runtime監査](/docs/design/audits/2026-07-21-dig-pop-painted-v2/README.md) を参照する。自己採点や自動テストだけでproduction採用しない
