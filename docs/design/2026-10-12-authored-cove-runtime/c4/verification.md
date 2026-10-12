# c4 — 入り江の局所実装と回帰検証

2026-10-12。低い殻・入口・丸い共有岸を同じworldへ接続した制作単位のruntime検証はPASS。全島の美術はHOLD、独立理解／安全N=0。M1と包括ゴールは継続する。

## 対象と固定入力

- 実app: `http://127.0.0.1:5357/prototypes/place-qa/authored.html?water=wide&reference=preflight32&cove=corner`
- Build: `authored-cove-c4`。実app version: `authored-cove-c4:f25abb6b-15f7-44f7-ad92-e74165c1c42e`。
- Visual: `native05-authored-cove-shore-v4`。殻source: `native05-authored-cove-corner-v3`。
- Island=true／設定native=false、明示DEV診断でnative=true。新しいbrowser contextにSW制御なし。
- [core／全旅程の同byte証拠](core-full-archive-proof.json): core 2,137入力とdriver 2,012入力が前後一致し、後者は同byteのsubset。固定snapshot SHAは `555fd26d832c74536005d58f2bd947a9c439965841dabae35e3cb40ffdc811fe`。
- [source復元](source-recovery/README.md)はc2 baseとQA差分から全2,137入力を再構成する。後続の作業ツリーが固定c4と同一であるとは主張しない。

## 結果

| 検証 | 結果 |
| --- | --- |
| `verify:core` | docs・lint・typecheck・606 files／5,265 tests・build・asset budget PASS |
| 入り江の全旅程 | 全景／近景／回転／390×844／768×1024の10画像、予告1画像、実canvas選択1件、取消・移動・収納・復元の4編集 PASS |
| 元27所有物の編集 | 6項目／7画像 PASS、1,581入力がcoreの同byte subset |
| 元27所有物の水庭 | 6項目／14画像 PASS、1,585入力がcoreの同byte subset |
| 通常Growing | 8旅程／22画像 PASS、1,580入力がcoreの同byte subset |
| classic smoke | 独立4173／Island=false、32項目 PASS。固定closure・command環境・harness SHAで来歴を確認。実画面のbuild値は未取得 |
| 花庭 | 同入力の全再実行で12画像／4canvas選択／4編集、若い／成熟入力 PASS。1,899入力が前後一致しcoreの同byte subset |

入り江の編集は同じ32所有物・家8軒・73配置権を維持する。移動先 `(12,-9)` では32 ownerの接近を保ち、元の `(8,0)` へ戻すとstate・world・成熟・色・時計が復元する。[全景から編集を追える実画面シート](contact-sheet.html)を保存した。

[既存4回帰と初回花庭](regressions/README.md)、[花庭の再実行](flower-full-retry-2400/verification.md)を別の証拠として保持する。初回は外側900秒上限で回転中に終了したFAIL／未完了。再実行は外側上限だけ2,400秒へ変更し、1,326.932秒で完了した。driver・内部assertions・app入力は同byte。時間を延ばした合格は操作性能の合格ではない。

## 配布と非代替のゲート

[通常false build](build-boundary/README.md)はPWA precache 145 files／8.48 MiB／上限12 MiB。raw native／cove GLB・gzip・Blender assetは配布にない。ただし共有岸の床JSONとadapter JSは残るため、全native code/dataの除外とは扱わない。実SW offline／更新をこのbuild検査から認定しない。

[作者の美術評価](art-review.md)はdesktop38/60、phone35/60、tablet34/60で各HOLD。中央の裸丘、薄い森、地面の均一さ、直線的な道、tablet全景の余白が残る。独立理解／安全N=0。runtimeは今回の明示診断と既存回帰の範囲のみPASSで、本人取得／自然成熟／保存移行／学習との新世界統合／offline／更新／実機／性能／全rig幅の全床支持／実施設利用／一般の殻配置／M1完成を認定しない。

次の中央丘肩・全native樹木guard・原本法線／材質は別候補として検証する。この記録へ後続候補の合格を混ぜない。
