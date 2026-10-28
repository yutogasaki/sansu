# 「ひろく盛る」の最小構成案

2026-10-23。設計調査のみ。本体・保存仕様・DBは変更していない。F2 の実入力18診断は `evidence/terrace-F2-recipe.json`。そこでの6手を、子どもが説明なしに作れる操作と実証したわけではない。

## 結論

一度の操作で複数セルを変え、一度のUndoで全体を戻すなら、**一つのcommand、一つのDB transaction、一つの保存済み履歴group** が必要になる。画面から既存の単セルcommandを連続送信するだけでは、この意味を満たせない。

最小の機能は「選択範囲の各セルを同時に1段上げる/下げる」。平坦な上面・通れる裾・家具を置ける足元を自動保証する機能とは分ける。範囲内に既存の高低差があれば、その差は残る。今回の6手を1クリックへ圧縮するための、座標固定マクロにはしない。

Fは符号共通の固定凸結合なので、重複しない複数セルを各±1だけ変えた場合も、任意点の応答は最大0.18mに収まる。重みの総和が1であるため。一つのセルを同じ操作内で2回上げるとこの上限は0.36mになり、同じ契約ではない。

## 現行契約で使える部分

- `types.ts` の `TerrainEdit` は `{cell,before,after}` 一つ。地形v1のundo/redoはその配列。
- `terrainEditing.ts` は整数高さ−4〜12、1履歴の差±1、undo+redo合計64以下、履歴を逆算した前後の連続性を検査する。
- `applyIntent` は入力stateをcloneし、成功時だけintent IDを `applied` へ追加する。失敗/上限/履歴なしは元stateへ戻る。
- `commandGrowingIsland` は最新recordをDexie transaction内で再読込し、`upgrade/readable` 後にcommandを適用する。成功はrecord revisionを一つ進めて一回putする。
- 現在の編集revisionはgeometryとundo/redoの組合せ。通常の学習同期で履歴が変わらなければ編集を続けられる。
- 本体UIは編集時にactorの現在足元と、利用中回廊の実routeを採り、commandへ添える。確定前の二重送信をpendingで止める。
- 固定足場、既存所有物の全足元、actorの足元、使用中回廊は、変更後の実worldから判定できる。複数セルでも判定対象を省く必要はない。

根拠: `src/domain/growingIsland/types.ts`、`terrainEditing.ts`、`commands.ts`、`repository.ts`、`syncProjection.ts`、`src/components/island/growing/GrowingIsland.tsx`。正本は `docs/product/13_data_storage_migration_spec.md` の「ゲーム内の地形編集の保存境界」と仕様52。

## 提案するcommandと確定処理

概念上の追加API:

```ts
type TerrainAreaCommand = {
  type: 'terrain-edit-area';
  cells: Cell[]; // 1〜9、取得済み整数セル、重複不可、順序は正規化
  delta: 1 | -1;
  expectedTerrainRevision: string;
  actors?: Cell[];
  occupiedPlaceTargets?: OccupiedPlaceTarget[];
};
```

9は初版の固定した3×3ブラシの上限案。長いドラッグ軌跡の無制限配列は受け付けない。同じセルを重ねて2段上げる入力も拒否する。stampの種類やブラシ幅を保存する必要はなく、実際に変えたセルと前後値だけを残す。

1. 最新recordでowner/island、intent再送、地形revision、配列上限・整数・範囲・重複を検査する。
2. 全セルのbefore/afterを作る。範囲外・上限・固定足場等が一つでもあれば**全体を変更しない**。有効セルだけを黙って選び直さない。UIの範囲表示と実際の変更を一致させる。
3. clone上のheightsをまとめて更新し、最終candidateを一度構築する。各セルを別commandとして順に検証しない。途中形状を描画/保存することもない。
4. before→candidateで固定足場・全所有物・actor・使用中回廊を再検証する。actorが乗っている面を持ち上げる許可は追加しない。
5. 成功時だけ一つのgroupをundo末尾へ追加しredoを空にする。intent一つ、record revision一つ、DB put一つ。保存失敗は版/形/履歴/受領をまとめてrollbackする。

最終形状だけの判定にする理由は、同時に周囲を上げれば平坦な所有物の足元を保てる場合に、仮の中間傾斜で誤拒否しないため。途中形状を画面へ出すアニメーションは別問題で、足場として使うworldは確定candidate一つにする。

## 保存とUndo/Redo

地形v2の最小案:

```ts
type TerrainEditGroup = {
  edits: { cell: Cell; before: number; after: number }[];
};
type GrowingTerrainV2 = {
  version: 2;
  heights: Record<string, number>; // v1と同じ意味
  undo: TerrainEditGroup[];
  redo: TerrainEditGroup[];
};
```

- 1groupは1〜9件、cellは重複なし、各差は±1。同じcommandからのgroupなので方向は共通。64はセル数でなく「子どもの操作数」とする。undo+redo合計64group、最大576cell差分。古いgroup全体から捨て、途中で切らない。
- Undoは最新groupの全afterが現在値に一致することを確認し、全beforeへ戻したcandidateを再検証してから一括保存する。Redoも対称。後から家具や住人が来て戻せなくなった場合は、group全体を保持して拒否する。
- 旧v1の各entryは `{edits:[entry]}` へ一対一変換する。高さ、既存Undo/Redoの順序・手数・所有・clock・学習・残高を変えない。
- 初回の**成功した**範囲commandでだけv2へ移る案が最小。commandが拒否されたらv1のまま。v2になった後の単セル編集も一件groupへ統一する。Undoで昔へ戻っても保存版をv1へ下げない。
- `terrainEditingRevision` には地形版も含め、groupとredoまで比較する。同期・再読込でgroup境界を再推定しない。
- 描画mesh/経路/actor位置は従来どおり保存しない。UIの一時的な選択範囲も保存不要。

現行v1 validatorはgroupを読めず、旧writerは地形があればrecord版を6へ設定する。v1のまま `groupId` を足す案では旧writerが1セルだけUndoできてしまう。**地形v2＋本人record版7相当の読込拒否境界** を設ける設計が必要。

現行の通常command/sync/島往復は `readable/upgrade` を通るため、未知record版の拒否を使える。ただし「版7を足しただけで全旧writerが安全」とはまだ判定しない。古い実writerのcommand、同期と学習outbox ACK、島往復、コピー/復旧を実行して、未知版をput前に拒否することを検証する。最初からDB表を総複製する移行を提案しない。拒否境界を通らないwriterが見つかった場合にのみ、既存schema13/14の隔離方針に従って追加境界を設計する。schema番号を上げるだけでは防げないことは既存repositoryのコメントにも明記されている。

FirstPlayは同じownerIdをプロフィールへ引き継ぐ設計で、地形を別recordへ描き直す案にしない。版7のまま引継ぎ、archive往復、通常sync後にもgroup境界が完全保持されるテストを加える。

## 最小のUI

既存の地形編集に「1マス / ひろく」の選択を足し、選択した範囲を実際の島上に出す。初版の「ひろく」は固定3×3程度。範囲端、固定足場、住人/所有物に阻まれる部分を確定前に示し、押すと何が変わるかを見えるようにする。

一つの確定操作で1段。次の1段は別操作。Undoの文言/動きも「さっきひろく盛った分」を一度で戻す。画面内で6回の保存を自動連打する演出にしない。

今の成功recipeは、既にある2段の地形に「4セルへ+1、1セルへ+2」を加えるもの。単純な3×3の+1と同じではない。3×3なら既存の2段セルも3段へ上がる。**現在の6手をそのまま2タップにできたとは主張しない。** 子どもの旅程としては、別の空き領域で「広く1段、その内側をもう1段」の2操作が本当に置ける/歩けるかを改めて検査する。合わなければ範囲形状を再検討し、保存契約は保つ。

将来「平らにする」を足す場合は別command/別表示にする。最大/最小へ自動吸着させる処理を「ひろく上げる」の中へ隠さない。負セルの開口を平らに埋める行為も、選択範囲と変更予定が見える必要がある。

## 採用しない近道

| 案 | 採用しない理由 |
| --- | --- |
| UIから既存commandをN回送る | 途中保存・途中拒否・N回Undo・他tabとの割込みが生じる。1操作ではない。 |
| DB transaction内だけでN回commandを回す | 保存はatomicでも履歴はN件。中間足場判定も残る。Undoをまとめるには結局groupが必要。 |
| UIメモリだけでUndoをN回まとめる | reload、同期、別tab、履歴上限後に境界が消える。 |
| v1履歴へoptional groupIdを足す | 旧writerが意味を無視して1セルずつ戻す。原子性を保てない。 |
| 一回のブラシ内で同セルを2回上げる | 0.18m/操作という応答上限を破る。2段は2操作へ分ける。 |
| 使えるセルだけ自動skip | 見た範囲と結果が違い、不連続な穴や段差が残る。部分成功を子どもに推測させる。 |
| 全stateのbefore/after snapshotを履歴へ保存 | 不要に大きく、Undoで学習/残高/所有物まで巻き戻す実装を誘発する。必要なのは地形差分だけ。 |
| 家具を置いた場所だけ地形を平坦化 | owner移動で物理床が変わり、Fのowner非依存と保存値の意味を失う。 |

## 実装に進む場合の最小検証

1. 1範囲commandで全セル反映・1group・record revision+1。再送で不変。
2. 所有外/重複/上限/固定足場/住人/使用中回廊を含む範囲は全体不変。失敗時に版も変わらない。
3. 一度Undo/Redoで全体復元。所有物が後から来たケースでは全体拒否し履歴保持。
4. v1→v2変換、履歴64groupの境界、redoあり状態、新編集でredo消去、破損groupの拒否。
5. 保存失敗rollback、reload、通常sync、古い編集revision、別tab、島往復、FirstPlay同owner引継ぎ、実旧writer/outbox ACK。
6. Fの同符号/異符号領域、負中心、開口、固定足場、所有外床について範囲編集の応答≤0.18mを検査。
7. 実入力18のp1/v2を残したUI操作で、範囲表示→1操作→一度Undo→Redo→配置→実利用→保存再開。

この検証は美術品質や、子どもが「ひろく盛る」を自力で使えることの代わりにはならない。現在は設計案のみで、保存版変更もUI追加も実施していない。
