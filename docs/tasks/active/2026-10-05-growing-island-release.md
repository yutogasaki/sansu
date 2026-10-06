# 最新変更を一つの公開候補へまとめる

- 更新日: 2026-10-06
- Review By: 2026-10-12
- 状態: 固定統合候補のcore/本人切替/実SW旧保存1→3・更新中断/対応writer復旧をlocal確認。公開URL・実機/利用者は未確認
- 正本: [憲法](../../../CONSTITUTION.md)、[親仕様01](../../product/01_app_spec.md)、[ゲーム仕様52](../../product/52_growing_island_game_spec.md)、[保存13](../../product/13_data_storage_migration_spec.md)、[検証マトリクス](../../ai/verification_matrix.md)
- 目的: 実装済み変更を重複して作らず、学習・島・家・本人切替・保護者・橋を同じ版で評価できる候補にまとめる。

## 現在地と範囲

2026-10-06 session追補: 配置選択/保存/空editorの復帰をhookへ、写真の対象/metadataと工作draft/保存作品再演の表示を専用panelへ分割。同本人のsessionと既存writer/戻り先を保持。core4,761、classic31、Growing production実操作/offline、本人切替/履歴、390/768幅で写真保存/読込故障/削除と配置/作品再演の往復がPASS。旧所有fixtureを使う任意機能の診断は実獲得の証明と区別し、公開/実機/子ども評価へ広げない。[構成](../../architecture/island-runtime.md)と `docs/done/2026-10.md`。

2026-10-06共用描画: 元のぽこもこの組立元と庭/家/光/時計をthree配下へ整理。現行Growing・家・学習が旧Home Journeyの建物/成長を参照せず共用する。形状/素材/布と移動18ファイルの処理を照合し、core4,757、最終smoke31、Growing実操作/offlineと家/学習の履歴往復がPASS。初回classicの1024px縦で再試行メッセージ待ちがtimeoutした記録を残し、対象5サイズと全31件を同じ候補で再確認。性能計測/公開/実機/利用者の評価は含めない。[配置と解放の境界](../../architecture/island-runtime.md)。

2026-10-06追補: sessionの初期読込/学習commit/家を分離し、core4,757・smoke31・Growing production両幅PASS。実旧Git `cca109ef` →最終候補→現行writerの `b7c6a562` の3buildで、旧保存1→3、学習中の更新待機・通信切断・offline同予約の追加回答・rollbackを両幅確認。実旧writerのguided正本隔離と旧tabの学習事実一回回復はfake IndexedDBの別診断。初回配置の10秒timeoutを残し、最終同旅程はPASS。[再実行手順](../../runbooks/growing-update.md)と `docs/done/2026-10.md` が対象と未評価範囲を持つ。公開/全写真/本物の保存/実機/子どもの合格へは広げない。

2026-10-06: [島runtimeの一本化](../../architecture/island-runtime.md)を追加。旧独立UIを撤去し、Growing/家/学習と旧保存互換を保持。隔離core4,756、smoke31、Growing本番形式の実SW offlineと通常/旧flag buildでの本人切替・履歴・同予約を確認。異なる設定の独立build検査であり、実SW two-build更新・公開URL・実機/実利用者の合格ではない。

棚卸し時のHEADは `7eda1fd9`。その後、プロフィール切替/active IDの保存修正、保護者設定、橋と棚卸しをmain `2c9e4850` へコミット・pushした。隔離core4,735と新buildのGrowing本人切替両幅PASS。既存smoke/Growing/橋UIは同一入力を照合して既存結果へ帰属させる。詳細は `docs/done/2026-10.md` とローカル `output/integration-index*.json`。各変更の検証を最新公開版の合格とは扱わない。

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
