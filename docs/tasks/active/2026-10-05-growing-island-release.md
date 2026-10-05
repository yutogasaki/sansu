# 最新変更を一つの公開候補へまとめる

- 更新日: 2026-10-05
- Review By: 2026-10-12
- 状態: 固定統合候補のcore/本人切替確認済み。公開URL・Growing更新/復旧・実機/利用者は未確認
- 正本: [憲法](../../../CONSTITUTION.md)、[親仕様01](../../product/01_app_spec.md)、[ゲーム仕様52](../../product/52_growing_island_game_spec.md)、[保存13](../../product/13_data_storage_migration_spec.md)、[検証マトリクス](../../ai/verification_matrix.md)
- 目的: 実装済み変更を重複して作らず、学習・島・家・本人切替・保護者・橋を同じ版で評価できる候補にまとめる。

## 現在地と範囲

棚卸し時のHEADは `7eda1fd9`。その後、検証運用のmain `10515403` を基点にプロフィール切替/active IDの保存修正、保護者設定、橋と棚卸しを統合候補へ固定した。隔離core4,735と新buildのGrowing本人切替両幅PASS。既存smoke/Growing/橋UIは同一入力を照合して既存結果へ帰属させる。詳細は `docs/done/2026-10.md` とローカル `output/integration-index*.json`。各変更の検証を最新公開版の合格とは扱わない。

- [橋の統合](../../design/2026-10-05-growing-bridge/production.md)：既存変更を含むcore4,705・smoke・経済両幅・橋3サイズPASS。本番SW/two-build/実機は未実施。
- [保護者設定](../../design/2026-10-04-parent-settings/README.md)：共有ツリーでcore4,700、classic smoke30/31＋対象2件の再実行PASS。修正後の全31件の再実行ではない。
- [島の本人切替](../../design/2026-10-04-island-profile-switch/README.md)：実Growing両幅の保存/編集lock・故障retry・再開を確認。
- [導きと記念](2026-10-01-island-guidance.md)：保存3/schema4・旧writer隔離・本/挿絵v6。実two-buildと公開先の確認は別。

## 次にすること

1. 作業ツリーとGit反映済み変更を照合し、候補に含む機能・仕様・既存変更を記録する。採用範囲外の変更を巻き戻さない。
2. app/dist/QAの入力、revision、delivery flag、visual/learning candidateを固定する。既存結果は同じ入力に適用できる範囲だけ再利用する。
3. 同じ候補で必須検証と学習/島/家/本/本人切替/保護者/橋の往復・保存を確認。PWA更新と復旧は対応するGrowingの保存境界で確認する。
4. 採用候補と実画面の接触シートを比較し、視覚・理解/安全・runtimeの判定と未検証範囲を記録する。
5. 公開を依頼された時に配布を実行し、公開URLの版/flag、既存保存の引き継ぎ、実学習往復、offlineを照合する。実利用者の保存・実機・子どもの観察は[確認待ち](../../../.agents/tasks/BLOCKED.md)の担当へ渡す。

今回のタスク整理は公開・pushの依頼ではない。10/1の初回本番切替を未実施へ戻さず、その後の変更の公開確認を扱う。

## 完了条件

固定候補の範囲と適用チェック、結果、画面、更新/復旧手段が揃う。公開を実行した場合は公開URLと版が一致する。未実施の実機・子どもの観察を明記し、ローカルPASSから全release PASSを推定しない。

## Verification

- 実装を含む候補はマトリクスに従って `verify:core`、smoke、保存/本人切替/ルーティング/PWAの必須チェックを適用する。
- 本番形式のGrowingで実回答→取得/配置→家/本→同予約、二プロフィールの隔離、offline再起動、実two-build更新、中断復旧、旧writer/rollbackを確認する。旧Life用ハーネスのPASSで代用しない。
- 写真・音・reduced motionと人口/物の増えた島は対象を明示する。人の観察結果は自動検証と別に記録する。
- 棚卸し当時はdocs/portalのみ。今回の固定統合候補ではcoreとGrowing本番形式の本人切替を実行し、既存旅程の入力一致と最終indexのdocs/portalを確認した。最新公開URLや実two-buildを検証したとは扱わない。

## Docs To Touch

共有TASKS/BLOCKED、担当タスク、検証証拠と完了履歴。挙動変更が必要な場合のみ親仕様と該当子仕様を先に更新する。今回の棚卸しは仕様・ADR・運用memoryの変更不要。
