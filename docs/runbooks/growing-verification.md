# 育つ島の検証入口

## Purpose

`npm run verify:growing` は、現在の作業ツリーから隔離した候補に対して、core、classic回帰smoke、Growing本番形式の学習/購入/本/保存/実SW offline旅程を順に実行する。各検査のログ、候補の入力hash、実version、runtime identity、画面、結果を一つの新規出力へ保存する。

## Contract

- Git管理対象と未ignoreの新規ファイルを一時ディレクトリへコピーする（rootの`.env*`は除外）。未コミットの変更も含む。開始/コピー完了時に入力hashを照合し、コピー中の変更は失敗とする。全入力のhashと、root設定/src/public/tools、参照されるassets内JSON、実装が直接参照する`docs/product/island-place-goals.json`、場所の診断とsource同定に使う`prototypes/place-qa/`の圧縮コピーを保存し、終了時に隔離候補の入力とdistが不変であることを確認する。
- `node_modules` は既存のローカル依存を使う。`npm ci` 済みであることが前提。lock hashとNode版を記録する。rootの環境ファイルは取り込まず、継承したVITE/SANSU変数を除去し、Growing/Island/Life/FantasyをON、DEV preview/Nature Town/DiscoveryをOFFに固定する。
- 開発サーバーや共有distを使用せず、隔離候補をbuildし、空きloopback portでpreviewする。URLのversionと候補distのversionを一致させる。新規ブラウザーcontextのみを使い、実利用者の保存や本番URLへ触れない。
- 子検査は順次実行する。最初の失敗で後続を止め、失敗ログとreportを残し、サーバーと一時コピーを片付ける。既存の出力を上書きしない。
- `checks: PASS` / exit 0 は組み込まれた自動検査の合格だけを表す。公開判定は常に `PARTIAL` とし、実Growing two-build更新、中断復旧、旧writer/rollback、既存利用者の実保存、本人切替の故障診断、実機、視覚/無説明理解/翌日の再訪は未検証項目として残す。旧Life/classic更新のPASSをGrowingへ流用しない。

## Usage

島のホームは[育つ島へ一本化](../architecture/island-runtime.md)している。開発は`npm run dev`（5198）を使う。旧Life/Home Journey/Nature Townの専用UI・起動コマンドは撤去済み。旧flag/URLの回帰は同文書の`e2e-single-island.mjs`で検査する。

```bash
npm run verify:growing
npm run verify:growing -- --output-dir /absolute/path/to/new-output
```

既定出力は `output/verify-growing/<時刻とUUID>`。`report.json` と `summary.md` が入口で、各stepの `*.log` と子旅程の `report.json`/画像を参照する。出力には隔離プロフィールの診断保存とソースが含まれるため、公開成果物にしない。

## Verification

runnerの回帰テストは、環境の混入防止、コピー中/検証中の変更検出、子reportの偽合格拒否、失敗時の停止を検査する。入口自身の確認は本コマンドを実行して、実buildと本番形式のGrowing旅程を確認する。公開時は[検証マトリクス](../ai/verification_matrix.md)と[公開チェックリスト](release-checklist.md)の追加項目を適用する。

実SWを使う版切替・中断復旧・対応writerへのrollbackは[Growing更新検証](growing-update.md)で固定した別buildを使う。`verify:growing`の通常offline検査と分けて記録する。

## 育つ場所v1の追加検証

`node tools/e2e-growing-places.mjs --url LOCAL_URL --output-dir NEW_DIRECTORY --build-dir FIXED_BUILD`で、390/768/320幅の実回答→苗の取得→接続→分離/再接続→同じ学習への復帰と、390/768幅の15配置・4関係・全島の20件の明示成熟診断を検査する。DEVの診断には`--development`を指定する。前後のapp/QA sourceを一致させ、productionではdist hashも一致させる。目標選択は無料で、成熟条件や実利用の記録を直接成立させない。

DEV専用の`/prototypes/place-qa/`は20件のnative診断を新しい本人として読み込む。元の本人の保存を上書きせず、本人の選択を戻す操作を備える。資源・成熟・人口を明示した診断であり、実取得・実時間7日・子どもの自発的な理解の代用にはしない。この入口はproductionで利用できない。全島の美術はnative-05と実rendererの全景を並べ、視覚・理解/安全・runtimeを別々に判定する。

全島のP06は、3つ以上の現行・到達可能な系列と、実在するぽこもこ/住人の現行の場所・原本・対象・完全revisionの利用原記録を照合する。特定の花庭や最初の住人への利用を追加条件にしない。初期診断へ利用/達成を注入せず、実描画の行動から新しいP06節目が成立したことを確認する。単独P01〜P05の実利用は個別の対象を厳密に照合する。v2の花庭限定条件で停止した原reportはFAILのまま保全し、この修正を過去の結果へ適用しない。配置のtap座標は実worldの地形・所有物・派生空間を含むcamera fitから計算する。

productionにはDEV actor座標のtelemetryがないため、単独の指定本人・指定対象の自律利用と、全島P06の現行本人/住人利用は90秒の実観察窓を使う。抽選と席の占有でこの時間内の利用は保証されない。最大3窓に限り通常のpage reloadから再観察し、各窓の待ち切れなかった事実と実保存をreportへ残す。乱数・時計・actor位置・利用受領を注入せず、actor/target/完全revisionの成功条件は変えない。実pointerで動かした経路は1窓のまま。過去の90秒timeoutの原FAILは保持する。通常取得と成熟診断を別runで完了した場合は、同じapp/build/fixture、QA差と取得driver部分のbyte一致を明示し、一つのrun全体のPASSとは書かない。

移動/収納からの再配置は、画面に残る確定ボタンの実tapだけで進める。元のID・style・育成履歴・残高・全owner一覧と目的の保存座標を照合して初めて成功とする。通常取得では自然時計を止めず、数値のgrowthだけは保存されたnature.hoursの増分×既存の最大土壌係数1.25以内を許す。他の個体情報は完全一致とし、収納からの成熟個体の復元はgrowthも完全一致にする。確認が保存されなければ15秒の再試行開始期限内、最大4回の可視・enabledな実tapに限って再試行する。tap内部の待機まで含む厳密な実時間上限ではない。ボタン消失、他の個体や別の座標、成長の逆行や注入、買い直しは失敗とし、DBへ直接配置を書かない。検査コードだけを修正した場合も、旧候補と失敗記録は保持し、別QAコピーの実byte差を明示して同じ固定配信へ再実行する。

成熟診断の完了範囲を分けて再実行するときは、`--diagnostic-only --diagnostic-viewport 390|768 --diagnostic-case PACK_ID`を使える。指定IDは実pack内、幅は既定の390/768だけとし、`selectedDiagnosticRuns`を原reportへ記録する。無指定は20配置×2幅の40件。subsetのPASSを全40件のPASSへ広げず、集約では同じapp/build/packと重複のない全40組を照合し、取得3旅程の原report全体のFAILや、観察窓のtimeoutもそのまま残す。
