# 独立した島の保存・切替監査

2026-10-19 JST。利用者の「監査して」に対するローカル監査。結論は **公開HOLD**。以下の3件を再現した。製品コードの修正、commit、push、公開は行っていない。

修正依頼後、下記3件へ保存境界と編集対象の修正を加えた。対象の実旧writer/実IndexedDB/本番形式二タブ診断は[修正検証](./verification.md)に記録。以下は監査時の再現結果として保持し、公開判定は共通検査・配布条件と分ける。

## 指摘

### P1：旧版の写真保存が別の島の写真を削除する

[schema6](../../../src/domain/growingIsland/repository.ts)は島本体を新表へ隔離する一方、写真の `moments` は旧版と共用する。新版は島ごとに60枚を残すが、旧版の `addMoment` はプロフィール全体を60枚へ刈り込む。

旧schema5作成→schema6移行→森60枚・最初の島60枚保存→旧版repositoryを再度開いて1枚保存、という手順で、既存120枚のうち61枚が削除された。残った既存写真は森29枚・最初の島30枚で、新規の旧版写真1枚と合わせて60枚になった。旧タブがDBを開き直す場合やrollbackで成立する。新版の通常保存の写真分離テストだけでは防げない。

最小の対応方針は写真の保存系統も旧writerから隔離し、既存写真を引き継ぐこと。旧版への復帰を許す範囲と、旧writerを止められる条件も確認する。

### P2：旧版からの本人削除が新しい島を残す

同じschema6の新表追加に対し、旧版の `deleteGrowingOwner` は `voyageIslands` と `archivedIslands` を知らない。旧版の削除処理を完了させても、新現役島1件・退避島1件がDBに残ることを再現した。名前・配置などの本人データが削除されない。新版の [deleteGrowingOwner](../../../src/domain/growingIsland/repository.ts) は両表を削除しており、この指摘は旧タブ・rollbackからの削除に限る。

旧版が削除を行える状態を防ぐか、旧版の削除も新版データへ反映する削除契約が必要。写真だけの隔離では解決しない。

### P2：別タブの島切替後、入力中の名前が移動先へ保存される

[GrowingIsland](../../../src/components/island/growing/GrowingIsland.tsx) の島ID変更effectは配置や選択を閉じるが、名前の入力状態を閉じない。再描画後のsubmitは新しい島IDを持つdispatchへ接続されるため、repositoryの古い島ID拒否を通過する。

390×900の実DEV画面で、タブAの最初の島 `MAIN` の名前欄へ `MAIN-EDIT` を入力し、タブBから実repository APIで `FOREST` へ切り替えて通常のBroadcastChannel通知を送った。タブAが `FOREST` を描画したことを確認してから、残った名前欄の「きめる」を押すと、現役 `forest` の名前が `MAIN-EDIT` へ変わり、退避した最初の島は `MAIN` のままだった。実名前dialogと実保存を使用。タブB側の海図操作を含む全UI旅程ではない。

最小の対応は編集開始時の島IDを保持して保存時に照合すること。島ID変更時に名前欄などの島固有編集状態を閉じる処理も確認する。

## 判定

- Safety：Risk。写真消失と削除漏れがある。
- Spec alignment：NG。「別タブの切替後に旧画面の操作を別の島へ書かない」「本人削除は新旧の島と全写真を消す」を満たさない経路がある。
- Tone：今回の指摘対象に子どもを責める文言は認めなかった。無説明理解の評価ではない。
- Over-change：独立座標・一transactionの切替・共通残高の引継ぎは要求に対応する。公開安全性を通常の往復成功から判断できない。

## 証拠と検証範囲

- 旧writer診断：2026-10-19 08:20 JST、`node output/audit/voyages-2026-10-19/old-writer.mjs`。期待は別島写真と本人削除の保全、実結果は上記2件の不成立。実HEAD repositoryをesbuildで読込み、互換する現作業ツリーの依存とfake IndexedDBを使用。旧版repositoryのHEADは `882937581c46ec633a4e4663726385ad7e7a09f1`、SHA256は `8f21a839b2a9cc27fb444ce52bc7df44f70feb0cdc81f6c05649c2c94610242b`。新版repositoryのSHA256は `7ef8f589c4acb6ea137938944b430e36b033835b14e4336f9aabcce03d1ed3a3`。旧版全ソースの実ブラウザ／SW検査ではない。
- 名前欄診断：2026-10-19 08:24 JST、`node output/audit/voyages-2026-10-19/stale-name.mjs`。期待は元島への保存か切替後の拒否、実結果は別島へ保存。使い捨てDEVプロフィール、Chromium、390×900。版 `development-local:43dbb5d3-10d2-4fdc-b086-b835edc5f0ec`、Island=true / NatureTown=false、root設定delivery `snap-root-v1`。主要3ファイルの実行前後SHA一致。GrowingIsland SHA256は `74c3af200c3b133e3858e9c2d69955225f7435531dbace26c3c045fa1de506df`、useGrowingIslandは `33d01103ede8bc3befb7b149c97c0bbbcfdfe489e37295de4b24da4053517cc5`。ページ例外なし。
- `npx vitest run src/domain/growingIsland/voyages.test.ts src/domain/growingIsland/syncConcurrency.test.ts src/domain/growingIsland/syncUpdateProtection.test.ts`：3ファイル14テストPASS。上記の故障経路の合格を意味しない。
- 生の再現結果・スクリプト・画面はgitignore対象の `output/audit/voyages-2026-10-19/` に保存。個人の実ブラウザデータを使わない。
- この監査では全体suite、実二buildのSW更新／rollback、実機性能、子どもの理解・再訪を再検証していない。実装時の対象版と検証は [verification.md](./verification.md) を参照。同時進行のホームUI・ポータル変更全体の監査ではない。

## 修正後の確認

旧writerの写真保存・本人削除と、二タブで開いた名前欄を回帰へ追加し、保存先の隔離・既存写真移行・全本人データの削除を確認する。その後、固定した旧build→新build→対応rollbackの実SW旅程と、変更に対応するverification matrixを実行する。今回の再現診断だけで公開可とは判定しない。
