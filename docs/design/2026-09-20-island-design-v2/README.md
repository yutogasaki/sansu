# 島素材 Blender デザイン修正 v2

2026-09-20。追加Meshy生成・消費クレジットともに0。原本を保持して4素材を修正した。本番組み込みは未実施。

## 修正

- 柵：反復する緑・紫を木の色に変更。木目を残す。
- じょうろ：青緑の塗装と真鍮色を分け、木目状の法線を弱める。初回プレビューでは黒く見えたため、塗装のmetallicを0.65から0.08へ、roughnessを0.28から0.4へ変更し色も明るくした。金属部と塗装は同じ材質設定なので、厳密な材質分離は今後の改善。
- 植木鉢：テラコッタ色へ。花と装飾は保持。法線を残して面の粗さを抑える。
- ポスト：石台と木柱を残して上部を再構築。単一の扉・投函口・取っ手に整理し、赤い曲面屋根を平滑化。高さは約1.20mから1.209m（面取り分）。底面中央配置を維持。

|素材|三角形数（前→後）|配信用GLB|
|---|---:|---:|
|柵|4,912→4,912|1,356,836 bytes|
|じょうろ|6,204→6,204|1,177,908 bytes|
|植木鉢|5,223→5,223|1,742,144 bytes|
|ポスト|5,769→4,243|626,892 bytes|

合計20,582三角形、4,903,780 bytes（4.90 MB）。これは4素材の転送容量で、島全体のメモリ・起動時間の保証ではない。ポストは5材質あり描画呼び出し削減余地がある。

## 保存と再現

`assets/island-{fence,watering-can,planter,mailbox}-v1/design-v2/` に編集用 `editable.blend`、修正版 `model.glb`、1K版 `model-1024.glb`、KTX2配信用 `near.glb`、四方向レンダーと `verification.json` を保存。元の `source/`、`meshy_raw/`、`final/` は変更しない。

Blender内で `tools/asset-pipeline/revise_design.py` の `revise(root, aid)`、`pack(root, aid)` を順に実行。その後 `pack-design.mjs`、`verify-design-files.mjs` を実行する。圧縮には `/tmp/sansu-asset-tools` のglTF Transformと `/tmp/sansu-ktx/bin` のKTXが必要で、依存の固定・持ち運びは今後の改善。全自動での見た目合格判定は行わない。

## 比較と独立した判定

[比較コンタクトシート](contact-sheet.html) / [ブラウザ検証記録](report.json)。対象URLは `http://127.0.0.1:5246/prototypes/asset-lab/?set=design-v2`。candidate=`island-design-v2`、delivery=`isolated-development-asset-lab`。基準HEADと未コミット候補のSHA256はreportに記録。現在の公開版Lifeとは異なる開発用プレビューで、本番フラグの有効化はしていない。

- 見た目：作業者の実画面比較では素材の差とポスト形状が改善。じょうろは改善後も濃い色であり、本番照明・遠景での読みやすさは再確認が必要。
- 理解・安全：形状の不整合は整理したが、参加者による意味理解、設置操作、当たり判定は未検証。
- 実行整合性：390×844 / 768×1024の3品質、計6ケースPASS。GLB読込、品質切替、失敗時の再試行、再読込、横はみ出し、WebGL/page errorを確認。実機FPS測定ではない。

Blender GLB再インポートの形状・レンダー一致PASS。原本SHA一致PASS。初回1K書出しでは法線バイトが変わる検査失敗があり、既存preserve_geometryで画像バッファのみ交換する方式に修正し、master→1K→KTX2で頂点属性・indicesの完全一致PASS。Blender addonはprotocol5（server期待7）の警告があり、使用した編集・書出しは成功したが更新は別途必要。

ESLint、TypeScript、Python12件、Vitest4件PASS。Vitestファイルをnode --testで実行した初回はランナー不一致で失敗し、正規のVitestで再実行PASS。作業ツリーのproduction buildもPASS（precache11.41MiB/12MiB、Explore4.92MiB/8MiB）。共有作業ツリーには他変更があるため、このbuildをコミット単独のリリース証明とは扱わない。

次は本番Lifeの実照明・カメラで配置候補を確認し、配信用容量、テクスチャメモリ、draw callsを含めて採用判断する。今回は形状修正と比較可能な成果物の保存まで。
