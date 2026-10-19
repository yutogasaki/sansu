# 育成規則v0.4の実装と検証

2026-10-19。**v0.4のローカル実装と技術検証を完了。** [実装タスク](../../tasks/active/2026-10-19-island-growth-v04.md)、[採用ADR](../../adr/2026-10-19-island-growth-v04.md)、[現在の関係マップ](../../product/island-system/implementation-map.md)、[詳細規則](../../product/island-system/growth-rules.md)。

## 実装した範囲

- 購入終了6品と旧個体の継続、初期A/初入居B、青花・装い、Lvに依存しない土地4/5。学習の報酬・出題・支援・SRSは維持。
- 入居/所属/実経路/24・48・96まち時間による家の成長。木と花からの自生、単体からの木陰・水辺・花庭、家2軒の共有庭。大型は既存P02/P05の有限配置に適合する場合だけ使用。
- 共有庭の実床へ既存actorが歩き700ms以上滞在し、描画した行動だけを記録。家の収納/移動で庭が変われば中止する。新住人や架空床を追加しない。
- 島別W1〜W4と旧発行の根拠/保留、保護者確認後の一度復元、由来付き在庫と取消0返金。復元対象の島/枠/版を固定し、確認中の島切替で誤付与しない。
- record5/Dexie10。現役/休止島/写真/贈り物をcultivated系へ移し、旧写真/贈り物writerをsentinelで拒否。元lineage・写真key/Blob・共通資源・完了IDを保持。
- 「そだつ場所」の名前・材料図・不足条件・説明を新規則へ統一。初回の「まなぶ/ぜんぶひらく」を操作バーと案内から離し、safe areaを含む狭幅で押せる位置へ修正。

## 確認結果

[最終検証データ](verification-complete.json)に対象source/版/入力SHA・日時・コマンド・実結果・未確認範囲を保存した。

| 検査 | 結果と範囲 |
|---|---|
| 全体unit | 633 files / 5,434 tests、終端PASS・skipなし |
| 最後の案内/場所の対象検査 | 6 files / 73 tests PASS。全体実行中に確定した案内と初回CSSは、対象検査・固定production・実タップでも確認 |
| build/typecheck/assets | 最終NEW/対応ROLLBACKともPASS。precache141 files/8.56 MiB、上限12 MiB |
| lint | 0 errors。既存fast-refresh警告4件。最後の変更ファイルも再検査PASS |
| classic smoke | 32 cases PASS |
| docs/入口/標準portal | docsチェック、Node24の入口と標準portalの整合検査を実行。終端ログは `/tmp/sansu-growth-v04-complete-index-check-final.log` |
| v0.4 production | 390/768幅：無料家・入居・カタログ・保護者確認/復元・旧収納品・学習不変。明示した家2軒の成熟配置から両actorの庭利用保存、新しい材料図もPASS |
| 初回の実操作 | 320/390/768幅：44px以上/画面内/中央hitを測定し、実配置・下船・学習設定・実3問・同島/再読込/offlineをPASS。保存abort/retry、英語のみもPASS |
| 海図 | 2幅：島作成/往復/実SW offline、学習保持PASS。最終変更前と同じ海図・保存コード |
| 実SW更新/復旧 | 固定した実旧record4/Dexie5→最終record5/Dexie10→保存5対応writer。2幅×通常/通信中断の4ケース、学習中待機・安全checkpoint1回reload・同予約/所有保持・offline追加回答・対応版への復旧がPASS |
| 実旧writer | 旧ソースの実commandで正本隔離、写真追加/本人削除拒否、写真Blob保持、完了事実の一度取り込みをPASS。使い捨てfake IndexedDBの診断 |

最終候補のruntime入力1,331ファイルは固定buildと作業内容で一致。QA側の入力hashも各旅程の開始/終了で照合した。物理/保存の実装を保持し、最後の案内とレイアウトは別の対象検査と最終buildで確認している。

[実画面の一覧](contact-sheet.html)、[初回320幅](first-play-phone.png)、[共有庭](shared-garden-phone.png)、[新しい材料図](garden-guide-phone.png)、[更新後](sw-upgrade-phone.png)、[通信中断からの復旧後offline](sw-rollback-tablet.png)。共有庭の成熟配置と旧snapshotは明示fixtureで、実際の日数や有料取得を経た証拠ではない。庭の実利用確認はUTCの昼、tabletはreduced motion。

## 失敗からの修正と証拠

初回の全体suiteは旧形式のデータを新規則で生成する検査等が失敗した。旧カタログ/美術契約のfixtureを明示したlegacyへ分け、購入終了・新規則を別に検査。保存版/書込先の期待値と、手組みした住人fixtureの節目を整えた。検査を削除して通したものではない。

旧版の初回ショートカットは操作バーと重なるため、元の旧buildを変えずキーボードで設定へ進んだ。描画後のfocus復元と画面切替の競合をharnessで観測して待機。現候補には実タップを妨げるCSS上書きを修正した。閉じた材料図の読取り、英語ケースのhasTouch不足、保存中の一時disableを即失敗としたharnessも訂正。失敗reportを保持している。

raw出力は `output/island-growth-v04-completion-20261019/`、最終buildは同下 `builds-v4/`、実旧sourceは `builds/OLD/`。最終旅程は `ui-guide-final/`、`first-play-confirmed/`、`sw-final/`、`voyages/`。生ログは `/tmp/sansu-growth-v04-*.log`。ignored出力そのものを永続成果物と誤認しない。

[初回08:05 UTCの部分記録](verification.json)は履歴として保持する。現状の合否は最終検証データを使う。入力変更を検出して止まった中間builds-v2も最終候補へ流用していない。

## 残る別受入

実iPhone/iPad、実利用者の全保存・全写真、過去の全deployment、子どもの原因理解/楽しさ/翌日再訪、大型の未対応形と全配置の干渉/美術は未確認。共同大屋根や任意配置の巨大室を新規制作したものではない。既存の入り江の美術採用待ちは維持する。公開・commit・push・実利用者DB操作・外部送信は行っていない。

## 文書同期

変更分類はゲーム規則/UI/保存移行。01/52/13、ADR、詳細規則/完全マップ、初回仕様、検証matrix、更新runbook、共有キューと完了記録を更新。学習仕様02/03/29/31/34は挙動を変更していないため改訂しない。既存の他作業の差分を保持した。
