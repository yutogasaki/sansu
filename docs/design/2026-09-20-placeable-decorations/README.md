# 柵・植木鉢の配置対応

対象は `https://sansu-seven.vercel.app` の暮らす島。新規生成は行わず、既存のBlender修正版を購入可能な飾りへ接続する。Meshy消費は0。

## 契約

[島の仕様](../../product/48_island_life_spec.md)を正本とする。木のさく4しずく、うえ木ばち6しずく。移動、90度回転、収納、再配置、削除と直近操作のundoに対応。上限30個。新2種は住民の利用施設・成長対象ではない。過去の価格や報酬を変更しない。最初の新2種操作は保存版19へ進み、古いアプリからの書込みを拒否する。

## 初回候補の検証

実行先 `http://127.0.0.1:5252`、build revision `placeable-props-v2-ad223e39`。Island/Life=true、preview=false、home props既定on、旧runtime assets既定off。visual candidate `island-placeable-decorations-v1`。実version、開始終了で一致したapp/dist/QA入力hash、全指標は [v2-report.json](v2-report.json)。これは公開確認ではない。

390×844と768×1024で、空保存から実際に6問を完了し12しずくを取得。実UIで柵と鉢を購入し残高2。回転、移動、収納、再配置で方向保持。保存を一度だけabortする明示障害から再試行し、保存は1回だけ増える。reload・実SW offline再起動・同じ問題への学習復帰で所有、方向、学習storeを保持。tabletはreduced motion。

多数配置は自然獲得と別の明示QA fixture。200 creditsを加え、正式なcommandLifeによる土地拡張・合法配置で30個にする。実ユーザーDBには注入しない。近遠LODの切替を確認。

| 指標 | 2個＋固定4個 | 30個＋固定4個 |
|---|---:|---:|
| GLB要求数 | 8 | 8 |
| GLB encoded bytes | 1,912,228 | 1,912,228 |
| テクスチャ数 | 17 | 17 |
| tablet renderer triangles | 150,704 | 372,106 |
| tablet draw calls | 210 | 317 |

rendererの三角形数は影などを含むフレーム指標で、GLB本体のユニーク三角形数ではない。モデルとテクスチャは共有されるが、インスタンスごとの描画費用は増える。30個時の再読込はこのローカル環境で約3.5–3.6秒。複数のブラウザ検証が同時実行されたHeadless ChromiumのrAF値は実機FPSの合格証拠にしない。端末上限や島拡張上限を引き上げる前に実機GPU・cold network・長時間編集を測る。

## 独立した判定

- 視覚: 採用済みの家まわり素材を共有。接地・サイズ・回転とスマートフォン/タブレットでの識別を画像で確認。大量配置は負荷fixtureであり配置デザインの推奨ではない。
- 理解/安全: 家/重複/住民の配置判定、通路の警告と移動/収納の復旧を継承。human N=0。子どもの無文字理解・楽しさは認定していない。
- 実装: 初回候補の新機能journeyは両幅PASS。公開版の配布確認と統合後の結果は追記する。

## 検査記録

- [初回core](core-initial.txt): docs/lint/typecheck通過、全440ファイル中4失敗。1件は版19を未知とする旧期待値を修正。残り4件はtimeout。
- [焦点を絞った再検査](focused-recheck.txt): 失敗した全ケースと新契約/形状を含む6ファイル45件PASS。timeoutは再現しなかった。
- production build / asset budget PASS。PWA precache11.56MiB / 12MiB。
- [初回smoke](smoke-initial.txt): 旧root-tangleの1024px縦画面の支援文待機1件失敗。新機能journeyとは分ける。
- [classic PWA](classic-pwa.txt): 4ケースPASS。Life無効の別buildで既存導線の回帰。
- [旧島PWA](legacy-island-pwa.txt): Life無効の別buildで8protected-flow checksと実SW offline PASS。

今後は実機での多数配置測定を行い、必要なら鉢の遠景LODと同種描画の集約を優先する。追加生成や高解像度テクスチャで解決しない。
