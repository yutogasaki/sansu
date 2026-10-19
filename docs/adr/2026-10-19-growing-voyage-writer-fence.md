# 海図の写真を隔離し、旧版の本人削除を失敗させる

- Date: 2026-10-19
- Status: Accepted; local implementation. Publication remains separate.
- Related spec: [海図](../product/island-voyages.md)、[保存](../product/13_data_storage_migration_spec.md)
- Related task: [実装と検証記録](../design/2026-10-19-island-voyages/verification.md)

愛着と保存保護のための境界で、土地拡張・学習・所有・島の個性の規則を変えない。

## Context

[監査](../design/2026-10-19-island-voyages/audit.md)で、schema6は島本体だけを隔離しており、旧版のプロフィール単位60枚制限が別島の写真を削除すること、旧本人削除が新表を残して成功することを再現した。旧アプリの配信済みコードを後から修正することはできない。

## Decision

Growing DBのschema7で、全写真をID・Blob・島ID・日時ごと専用の `voyageMoments` へ複製する。Dexieのcontent upgrade中には削除予定表も読めるため、コピー後に旧 `moments` を除ける。同じIndexedDB upgrade transaction内のschema8で `moments` を空の互換拒否用表として再作成する。自動採番と `profileId` / `[profileId+at]` indexを持たせない。

旧版の写真追加は自動採番を必要とするため失敗する。旧版の本人削除は写真のprofile indexを使用するためtransaction全体がabortし、主DBの本人・学習データを削除する段階へ進まない。新しい島・写真が残っているのに削除が成功したように扱う経路を止める。旧島表への通常書込は既存の系統内に隔離される。

新しい写真の読書きは専用表だけへ向ける。schema8対応版の本人削除は現役・退避・旧島表・全本人写真・贈り物を削除し、別本人を保持する。写真移行の失敗ではコピー・旧表の除去・拒否用表の生成を全てrollbackし、消去や手動ストレージ初期化を必要としない。

## Alternatives Considered

- schema番号を増やすだけ：Dexieは旧宣言でも新DBを開ける。
- 旧写真表を残す：旧版が新版の写真を刈り込む危険が残る。
- 写真を複製して旧表を単に除く：旧宣言のDexieが不足表を再作成し、旧本人削除が成功できる。回帰テストで再現した。
- 存在しないDB triggerへ依存する削除連携：IndexedDBは配信済み旧コードの削除を新表へ自動波及できない。

## Consequences

schema5/6の旧buildへのrollbackは写真保存・本人削除の互換を持たない。復旧用buildもschema8に対応させる。旧版の削除はGrowingより先に旧Life/Townの副DBを消す既存順序を持つため、全DBで無操作になるとは保証しない。主DB本人が残るので、新しい版で削除を完了できる。

## Verification

schema5/6からのコピー、写真Blob・ID保持、移行abort、旧写真保存・旧本人削除の拒否、新版の削除完了と別本人保持を検証する。実二buildのSW更新、対応writerへのrollback、実端末の評価は別の配布条件とし、単体テストだけで公開可としない。契約は[保存仕様13](../product/13_data_storage_migration_spec.md)と[海図仕様](../product/island-voyages.md)。
