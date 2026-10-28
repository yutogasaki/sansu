# 保存済みの島が88%で止まる起動競合

2026-10-28。本人から、build `0358c72a03eec1b19004931077acb25cf53d0de8` のiPhoneで `scene-initialization (compact): Growing shader failed to link: 2`、手動再試行は成功・最新版の再読込は失敗、と報告された。目的は通常の起動を直すこと。愛着の柱として、育てた島へ戻る入口を保つ。子どもの理解・再訪は今回の自動検査で評価しない。

## 原因と変更

保存済みの島を先に表示し、通常の同期で最新の自然・学習反映へ更新する間に、`WonderScenery.build` が古いmaterialを解放する。Threeは参照がなくなったprogramを破棄する。一方、シェーダー準備は待機前のprogram一覧を保持していたため、削除後も照会を続け、`LINK_STATUS` の `null` をリンク失敗として扱っていた。

実際のproduction rendererで、KHRの完了報告だけを1.5秒遅らせ、保存済みの島を再度開くと、同じ番号2・同じエラーを再現した。GLプログラムの破壊や保存変更は注入していない。通常同期が実際に資源を入れ替えた。iPhoneの実GPU自体を再現したという意味ではない。

`growingShaderWarmup.ts` の待機ごとに現在のprogram一覧を取得し直す。現在のprogramの生存・リンク結果、描画で追加されるvariant、context喪失・中断・上限時間の検査は維持する。本当のリンク失敗は、program/vertex/fragmentのdriverログを各2,000文字まで診断へ追加する。

変更は通常起動に適用する。GPU選択・画質・影・モデル・保存同期・学習・PWA更新処理は変更していない。自動再試行の追加ではない。前の説明にあった「GPU設定の違いが開ける理由」は確定しておらず、再現で示した原因はこの寿命の競合である。

## 検証候補

- 共有作業ツリー：既存の未commit作業を保持したまま、変更箇所を検証。アプリ入力と結果は `output/2026-10-28-shader-startup/` に保持。
- 切り分けた候補：`0358c72a03eec1b19004931077acb25cf53d0de8` の完全なarchiveに、`growingShaderWarmup.ts`、同unit test、新しい起動検査CLIだけを追加。他作業の製品変更を含めない。ローカルcommit・push・公開は未実施。
- shader source SHA-256：`a0d79ae49c0ada69f13d85debc4eea0c9ed225d44d10a752329242b7109c4594`。
- 切り分けたbuild revision：`0358c72-shader-startup-isolated-a0d79ae49c0a`。実version・flag・入力識別は [検証結果](verification-summary.json) を参照。

## 検証

| 対象 | 期待と実結果 |
|---|---|
| 旧版の原因再現 | WebKitの通常同期とKHR待機が重なり、破棄済みhandleの照会と `failed to link: 2` を確認 |
| 対象unit | 修正前は新規回帰2件FAIL。修正後はshader・scene入力・renderer・画質の61件PASS。差し替え後の本当のリンク失敗も拒否 |
| 共有ツリーの全体unit | 689 files / 5,745 tests PASS。既存の重い造形統合を含め846.45秒 |
| lint / typecheck / build | 共有ツリーでPASS。lintは既存warning 5件。切り分けた候補のbuild・対象61件・lintもPASS（lint既存warning 4件） |
| production起動 | 共有候補・切り分けた候補の両方でWebKit 390×844 / Chromium 768×1024がPASS。更新URLも最初のcontextで開き、所有と学習記録を保持 |
| 本当のshaderエラー | 別ケースの不正fragment shaderを実コンパイルし、失敗詳細・自動反復なし・修正後の手動再試行・保存保持を確認 |
| classic smoke | 切り分けた候補で32ケースPASS |
| 文書・入口・portal | docs:check・agent:index:check（portal:verifyを含む）PASS。既存タスクの期限warningのみ |

実行コマンドは `npm ci`、`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:current-ui-entry`、`npm run e2e:smoke`、`npm run docs:check`、`npm run agent:index:check`、`npm run portal:verify`。アプリ検証はNode 22.23.3を`fnm exec --using=22`で使用した（この端末にnvmはない）。依存導入と標準portalはNode 24.18.0を使用し、portalの24以上必須条件を満たした。起動検査は `SANSU_SHADER_URL` と新規 `SANSU_SHADER_OUTPUT` を指定して `node tools/e2e-growing-shader-startup.mjs` を実行した。

開始/終了のsrc・public・dist等のhashを各browser reportで照合した。正常起動には実SWを許可し、制御状態も記録した。KHR非対応のChromiumは同期経路の結果として分ける。初期の検査失敗（再読込が同じ時刻で競合しなかったケース、KHR非対応engineへの再現要求、切り分けた環境の不足入力）はraw logを残し、条件を訂正して再実行した。実機の性能値にはしない。

## 境界と引継ぎ

同じ起動経路の実画面：[修正前の再現](before-webkit.png) / [切り分けた修正版](after-webkit.png)。画面は使い捨ての合成本人であり、本人のiPhoneの撮影ではない。

通常起動の競合はローカルのproduction候補で解消した。本人のiPhone・公開版での解消、二つのbuild間の実更新、実通信速度、子どもの再訪は未確認。通常の真のGPU故障を無条件に成功扱いする変更ではない。

親仕様01・子仕様52とverification matrixを更新。保存形式と学習仕様は不変。恒久的な製品方針の変更ではないのでADR・durable memoryは追加しない。担当は[既存の起動・性能タスク](../../tasks/active/2026-09-23-island-performance.md)に戻す。公開反映はAGENTS.mdの明示承認条件に従う。
