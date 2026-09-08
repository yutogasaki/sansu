# 島の大きな成長と、意味のある記録

- Date: 2026-09-08
- Status: 実装・作者の実画面確認・必須検証完了。公開操作なし。
- Governing spec: [育つ島の仕様](../../../product/30_living_island_growth_spec.md)
- Visual: `mystic-island-living-v4` / delivery: `mystic-island-v1` / art: `moon-garden`

[実画面の比較](review.html) · [各画面の出所](capture-manifest.json) · [固定した入力](build-source.json)

## 変更と狙い

東西の土地を各半径3.0×3.4へ広げ、一地区ごとに初期主島の約59%の面積を追加した。以前の岸、橋、配置、住民の足場は保持し、新しい外側にも実際に配置・移動できる。花壇は複数の花、噴水は高い水の柱、ブランコは花のアーチ、木は大きな樹冠、家は屋根窓とテラスへ育つ。

大きな節目は居場所の成熟と土地拡張。保存後に6秒の短い案内を出し、入力や次問を止めない。帰島時に最新の節目一つから比較へ進める。次予約だけの保存失敗からの再試行では案内を保持し、描画エラー中は復旧案内への重なりを防ぐ。

新しい成長記録は初期・成熟・拡張だけ。標準24区間では `[0,2,6,12,18,24]` の6件となり、以前の14件から減る。小さな進行は毎区間保存するが、節目の通知や記録は作らない。既存snapshotを消したり書き換えたりせず、地区別の比較はその場所の開始時点と成熟に絞る。学習・SRS・Due・旧予約のおくりもの契約を変えない。

狙いは、戻った島の大きな差と新しい配置場所が、もう一度学んで眺める理由になること。子どもの再遊び・理解は未測定。

## 固定した検証対象

- Base: `9300ea0`
- Revision: `9300ea0-milestones-cc26726dd0e3`
- Production version: `9300ea0-milestones-cc26726dd0e3:f5b520c6-0dd4-46dc-92c7-64eaad288fb9`
- Production target: `http://127.0.0.1:5524`
- DEV target: `http://127.0.0.1:5525`
- Flags: Island有効、BuildPlay無効、moon-garden
- App input inventory: 683ファイル。sourceHashはbuild-source.json。
- 保存先: `output/island-milestones/9300ea0-milestones-cc26726dd0e3/`。固定build、全raw report、復元可能な`verified-source.tar.gz`を保存する。

共有workspaceで学習入力・音声などの別作業が並行していたため、baseと今回の変更を独立コピーへ固定した。共有ファイル内の別作業の差分はコピー側だけで除外し、元のworkspaceでは保持している。この証拠は上記候補のもので、並行作業を含む全体版の完了を認定しない。

## Runtime integrity

- `verify:core`: docs・lint・typecheck・170ファイル/1,995テスト・build/assets PASS。
- classic `e2e:smoke`: 31シナリオ PASS。
- classic `e2e:pwa-update`: 4保護/更新シナリオ PASS。島buildと区別したclassic固定buildで実行。
- Island DEV: 10シナリオ/47画面 PASS。全入力、タッチ/キー、支援、旧外観、プロフィール分離、WebGL復旧。
- production living: phone 390×844 / tablet 768×1024各25区間・66画面 PASS。空DBの実設定から通常plannerで実回答し、4地区成熟、有限7物、6記録、自発発見、3D比較、再演、古い外観、保存/再開を確認。新しいx=9.25の地面への実UI配置と再読込も含む。tabletはreduced motion。
- Island PWA: 7保護フローと実SW offline再読込・回答・成長・同予約再開 PASS。
- 正式固定10問: 80run・全15gate PASS、`evidence.eligible = true`。正解→入力P95 phone194.4ms/tablet254.6ms、誤答→再入力194.2/194.1ms、区間境界192.8/471.4ms。追加操作0。Node24.14.0 / Chromium145.0.7632.6のDEV固定fixture・自動keyboard測定であり、実機や子どもの解答速度ではない。実測DEV versionは`9300ea0-milestones-cc26726dd0e3:059b4b32-7400-4bbe-93ae-278035e27381`。全sourceの開始/終了hash一致、同一描画revision/candidateを確認した。

production livingは全app/QA入力が開始・終了で不変であることと、実build/candidateを照合。合成した成長状態を画面へ入れた初期診断は`output/playwright/island-milestones-diagnostic`で区別し、このページの採用画像へ混ぜていない。

前候補`c34ce4b30e27`も一式を通過したが、実画面で成熟した樹冠の上切れを発見。木かげ比較の画角修正と実meshの収まりを確認する2テスト、おくりもの型の旧予約を節目通知へ入れないguardを加え、最終候補ですべて再実行した。前候補の証拠も別フォルダへ保持している。

最終候補の`living-01`はphone第12区間の比較ボタンクリック後に画面遷移が起きず30秒でFAIL。成長12区間の保存は保持されていた。直前の住民発見の自動保存と一時的なボタン無効化が重なった可能性はあるが、イベント時刻の証拠がなく原因は未確定。app/QAを変更せずに`living-02`を再実行し、phone/tablet各25区間を通過した。元FAIL・画像・ログも保存し、原因を修正済みとは扱わない。

共有workspaceでも最終`docs:check`・diff checkがPASS。typecheckは並行変更の`LearningSlot[].at`で一度FAILし、その担当側の`slice`修正後に再実行してPASS。対象9ファイルの統合テストは80/82 PASS、`island.test.ts`の旧学習期待値2件がFAILした。固定候補との差分を別担当が確認し、支援後Dueが学習日開始から`beginRelearning(now)`へ変わった点と、英語解除条件が独力専用履歴へ変わった点に起因する。今回の成長コードとテストは固定候補と同一で、`growthRepository`9件を含む他8ファイルはPASS。進行中の別作業は変更せず、この不一致を共有版の未解消事項として残す。`shared-*-final.log`と`shared-typecheck-02.log`を固定候補の合格証拠とは別に保存した。

## Visual appeal

作者の実画面評価: 改善を確認。前回v3と最新v4をreview.htmlで並べた。広い土地の差は同じ倍率の比較で見え、水と家は輪郭ごと変わる。花壇が住民に隠れる初回診断から庭の比較角度を調整し、家の比較上部にも余裕を設けた。最終の木かげ比較は樹冠全体と上の余白を別担当も実画像で確認した。広い芝生は配置可能な余地として残す。

アルバムの2枚は同じ画角・縮尺。全景だけで家具の細部を読ませず、地区別比較へ進める。作者評価を独立した美術審査や子どもの魅力評価とは扱わない。

## Silent comprehension and safety

human N=0。無説明の理解・自発的な再遊び・学習効果は未測定。作者操作と自動検査では、音を使わずに節目名と景色の差が分かる表示、reduced motion、追加の確認操作0、支援による成長減なし、旧記録/配置/学習保存の保持を確認。美術・人の理解/安全・runtimeの判定を合算しない。
