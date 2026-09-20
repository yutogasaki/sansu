# 修正素材4点の本番採用

2026-09-20。ユーザー承認により家まわりの装飾として柵・じょうろ・植木鉢・ポストを採用。新規購入物・住民行動・通貨・保存形式・学習入力は変更していない。追加Meshy生成/クレジット消費0。

## 軽量化

|項目|修正マスターの配信用v2|今回|
|---|---:|---:|
|近景GLB 4点|4,903,780 bytes|1,253,268 bytes|
|遠景を含む転送量|遠景なし|1,912,228 bytes|
|近景三角形数|20,582|16,332|
|遠景三角形数|なし|10,542|

遠景込みでも転送量は約61%減。Base Color256px、補助画像128pxのKTX2。近景の単純化はUV境界を守るため、花の密な鉢などは大幅には削らない。GLBはPWA必須precache外。同種の形状/材質/画像を共有し、複数材質のポストは名前ごとに近遠で共有する。旧処理は最後の材質を全遠景meshへ割り当てていたため修正し、回帰テストを追加した。

配信 `VITE_ISLAND_HOME_PROPS` は既定on、falseで装飾追加を無効化する。既存6種の実験 `VITE_ISLAND_RUNTIME_ASSETS` は既定offを保持。候補ID `island-home-props-v1` は実Lifeのdata-runtime-assetsに表示する。初回描画後に読み込みを開始する。4点は家の予約済みマス内に固定し、島の拡大でも増殖しない。通信失敗/未キャッシュofflineでは手続き形状を表示し学習開始を止めない。

保存先は `assets/island-{fence,watering-can,planter,mailbox}-v1/home-runtime/{near,far}.glb`。原本とBlender修正版は保持。[生成条件とSHA](../../../assets/pipeline/island-design-v2/home-runtime.json)。再生成は `PATH=/tmp/sansu-ktx/bin:$PATH node tools/asset-pipeline/build-home-props.mjs`。外部依存は既存ASSET_TOOLS_ROOT（既定 `/tmp/sansu-asset-tools`）を利用し、API生成は行わない。

通常画角の実renderer診断は、旧表示176 calls / 8 texturesから採用版196 calls / 17 textures。三角形カウンタは旧101,738に対しphone129,982・tablet134,402で、影パスとLODも含む。転送量の減少を「元の素材なし画面より軽い」とは扱わない。

## 実画面と検証

[変更前後・起動から学習復帰までの比較](contact-sheet.html)、[固定ビルドの検査](runtime/report.json)、[flag offの比較基準](baseline/report.json)、[検証入力とbuildの証跡](provenance.json)。実アプリ対象はローカルproduction preview `http://127.0.0.1:5250`、baselineは5251。390×844 / 768×1024、通常/reduced motionを検査。実際の公開版の確認は公開後の別記録と区別する。

- 技術整合性：coreの438ファイル/4,084テストPASS。最終配置の調整後は敷地・配置・材質の12テスト、lint、typecheck/buildを再検証PASS。smokeもPASS。PWA precache 11.56MiB/12MiB、Explore4.92MiB/8MiB。
- 読込/データ：GLBを保留した状態で島を描画。全8ファイルを読込、カメラ拡縮で近遠を切替。拡張島でも4点。失敗時fallback、HTTP cacheを消去した実SW offline再読込と同じ学習予約への復帰、所有・credits・学習7store不変PASS。拡張だけは隔離ブラウザに200 QA creditsを入れた明示fixtureで、実獲得や学習効果の証明ではない。
- 見た目：実Lifeの家・照明・カメラで確認。最初の右側配置は壁に隠れたため、予約敷地内の左側へ調整。家入口と住民の前景を空け、近景ではポスト・鉢・じょうろの色と形が読める。遠景では小物であることを優先し細部を省略する。
- 理解/安全：装飾のみで新しい操作・因果・利用動作は導入しない。第三者の無文字理解調査や実スマホGPU測定は未実施（humanN=0）。性能を子どもの理解や魅力の合格へ読み替えない。

GLB圧縮の初回2案は遠景込み2MB上限を超え、画像サイズを見直して1.91MBに収めた。初回ブラウザハーネスは保留routeの解放前にunrouteして二重処理となった。読込完了後にunrouteするよう修正し、最終両幅を再検証した。これらを製品データの破損や通常速度の証拠とは扱わない。

この変更は装飾素材の採用であり、学習テンポ/問題生成/保存/PWA更新処理を変更しない。過去の全機能について新たな完全リリース認定を主張しない。残る改善は鉢の遠景専用形状やポストの材質統合、実機の低速回線/熱/メモリ計測。
