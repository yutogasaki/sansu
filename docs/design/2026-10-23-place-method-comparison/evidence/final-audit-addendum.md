# 最終監査追記（81–83）

この追記は既存の `final-ui-check.json`、`ordinary-restoration-check.json`、各performance pair JSONを変更しない。

## 82：復元後の新しい利用は未確認

81 step2-live、82 before-wait、82 restored-liveの内容・SHA256は完全一致した。countは全て2で、記録時刻は2026-10-22 22:22:37.743 UTCと22:22:45.140 UTC。両方とも81の編集開始より前。操作者は22:27:19 UTCまで観測したが、このcapture群から復元後の新しい利用receiptは確認できない。82 JSON自身には「待機終了時刻」の別timestampがないため、22:27:19は操作者の観測報告として区別する。

`GrowingLife.observeUse` はplace ID・place revision・actor ID・target IDで重複を抑制し、syncでその集合をclearしない。同じ場所へUndoで戻った後の同じ利用が新receiptを出さない可能性はある。しかし、この仕組みは「復元後に実際に利用した」という証拠にはならない。未確認を維持する。81と82の復元stateはplaceProgressだけ異なり、幾何・所有物・全Undo/Redo等は一致した。この進捗差も可視の新利用の代わりには使わない。

- 81/82の3つのlive JSON共通SHA256: `3f0f17990a432e5a394a9ffbf7323269c561ce35e23aafb92d957c0b6c4f4eb2`
- 82 restored-state SHA256: `ea4b84a62c461d87e9ce36ad77af107dde05c6c00d53e24a7c3e6878afc21f66`

## 83：通常保存への最終復帰

通常UIの「実保存の島をこの試作方式で開く」リンクで戻った83を、53および76と独立照合した。新しい結果は [ordinary-final-restoration-check.json](ordinary-final-restoration-check.json)。land・全terrain（Undo/Redo含む）・plots・landmarks・keepsakes・villagers・character・drops=8・town・派生placesは両比較で完全一致。診断用96区画/診断通貨が、これら通常保存の値を置き換えた形跡はない。

useHistoryは3captureとも33件の配列が完全一致し、milestones/shownも一致。違いは代表usesのat/targetIdだけ。53対83ではPokomoko/villagerの4葉、76対83ではvillagerの2葉である。新履歴の追加を主張しない。試作方式のcandidateは変化しており、描画自体のbyte一致や全セーブ互換性・offline・配布版安全性の証明ではない。

## 照合スクリプトの保全と再現

一時領域の3本を [checkers/](checkers/) へbyte同一でコピーし、元の各check JSONが持つchecker SHA256とも一致を確認した。対応表・出力を元証拠から分離する再現コマンドは [checkers/README.md](checkers/README.md)。3本と83の新checkerをwrapper経由で `/private/tmp/sansu-audit-reproduction` へ再実行し、各判定の一致を確認した。元captureと既存check JSONは上書きしていない。

81の高さ復元は合格だが、初期Undo64件へ2編集したため最終履歴はUndo62件＋Redo2件である。古い2件が上限で落ちることは既存結果にも明記済み。滑らかな連続編集の合格や、復元後の可視利用の合格へ読み替えない。

## 追記：81/82のdomain受理と85の新規起動

追加の狭い監査を [life-continuity-audit.md](life-continuity-audit.md) と [post-edit-life-check.json](post-edit-life-check.json) に保存した。81→82では別target2件が22:24:10/11 UTCにdomain受理されていたが、可視fresh記録は増えていない。UI遮蔽後retryが観測から除外される仮説と整合するものの、原因確定・可視利用の証明にはしない。85の別sessionでは2人×庭/benchの4組の可視fresh利用を確認した。これは最終候補の新規起動時の利用証明で、81Undo後の継続証明とは分ける。
