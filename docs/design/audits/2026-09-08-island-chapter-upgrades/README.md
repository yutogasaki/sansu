# 居場所の完成で、島全体が次の段階へ

- Date: 2026-09-08
- Status: 実装・作者の実画面確認・必須検証完了。公開操作なし。
- Governing spec: [育つ島の仕様](../../../product/30_living_island_growth_spec.md)
- Visual: `mystic-island-living-v5` / delivery: `mystic-island-v1` / art: `moon-garden`

[実画面の流れ](review.html) · [各画面の出所](capture-manifest.json) · [固定した入力](build-source.json)

## 変更と狙い

ユーザー選択「花壇や家などを育てきると、島全体が次の段階になる」を実装した。任意の1居場所を成熟させると東、2居場所を成熟させると西へ大きく広がる。花壇でも家でも最初の完成を作れる。旧仕様で開いた土地は失わない。

完成直前だけ短い予告を表示し、完成時には「しまが 大きく ひろがったよ」と、育てきった場所・新しい橋の方向を伝える。表示は入力や次問を止めず、帰島後には最新の節目から同じ縮尺の前後比較へ進める。育てる場所の選択で、別の予約済み対象が先に完成する場合は誤った拡張予告を出さない。

土地拡張と成熟を一つの記録にまとめ、標準24区間では `[0,6,12,18,24]` の5件となる。小さな成長だけでは記録を増やさない。既存snapshotを削除・書き換えせず、過去の姿は当時の土地段階で描く。今の4居場所が育ちきる章までを扱い、3回目以降の土地拡張は追加しない。

東の家具・キツネ・灯台、配置、住民の歩行、アルバムは実際に獲得した土地段階を共有する。新規データは明示的な段階0、旧データの省略値は当時の2/12区間の規則で解釈し、旧予約・移動した家具・以前の姿を保持する。

## 固定した検証対象

- Base: `9300ea0`
- Revision: `9300ea0-chapters-250bf14c2fe2`
- Production version: `9300ea0-chapters-250bf14c2fe2:3bb2848d-4f6d-4309-9278-0eb0a85fdbd5`
- Production target: `http://127.0.0.1:5540`
- DEV target: `http://127.0.0.1:5541`
- Flags: Island有効、BuildPlay無効、moon-garden
- Learning candidate: `mystic-island-learning-v2`
- App input inventory: 688ファイル。sourceHashはbuild-source.json。
- 保存先: `output/island-chapter-upgrades/9300ea0-chapters-250bf14c2fe2/`。固定build、raw report、復元可能な`verified-source.tar.gz`を保存する。

前回の固定版に今回の変更を加えた独立コピーで検証した。共有workspaceでは学習・教科・音・パッチワーク住民の別作業が進んでおり、それらの変更は元workspaceに保持している。この候補は従来の住民造形であり、別の住民候補や共有workspace全体の完了を認定しない。

## Runtime integrity

- `verify:core`: docs・lint・typecheck・173ファイル/2,020テスト・build/assets PASS。
- classic `e2e:smoke`: 31シナリオ PASS。
- classic `e2e:pwa-update`: 4保護/更新シナリオ PASS。classicの固定buildで実行。
- production living: phone 390×844 / tablet 768×1024各25区間・66画面 PASS。空DBの実設定から通常plannerで回答し、予兆5/11区間、土地拡張6/12区間、4居場所成熟、有限7物、5記録、自発発見、3D比較、再演、以前の姿、保存/再開を確認。新しいx=9.25の地面への実UI配置と再読込も含む。
- production chapters: 両viewportで花壇の初回予約後に家へ育成対象を変更。6区間時点は未拡張・完成直前、実7区間目で家が最初に成熟し東へ拡張することを確認。旧省略値の0/2区間snapshotと新しい明示値の7区間snapshotを混ぜる別fixtureも両viewportでPASS。fixtureを実獲得や子どもの観察とは扱わない。
- Island PWA: 8保護フローと実SW offline再読込・回答・成長・同予約再開 PASS。実6区間目の成熟後、段階1・記録`[0,6]`・5物・同じ次予約が更新を越えて復元された。
- Island DEV: `dev-02`で10シナリオ/47画面 PASS。入力、タッチ/キー、支援、旧外観、プロフィール分離、WebGL復旧を確認。
- 正式固定10問: 80run・全15gate PASS、`evidence.eligible = true`。正解→入力P95 phone195.1ms/tablet195.0ms、誤答→再入力193.8/193.8ms、区間境界194.3/193.8ms。追加操作0。Chromium145.0.7632.6のDEV固定fixture・自動keyboard測定であり、実機や子どもの解答速度ではない。実測DEV versionは`9300ea0-chapters-250bf14c2fe2:6e181fe8-08d3-4805-9578-c34685c5d0c9`。全sourceの開始/終了hash一致、同一描画revision/candidateを確認した。

production living / chaptersはapp・QA入力の開始/終了hash不変と実build/candidateを照合。採用画像は同一の最終候補から取得し、混在履歴fixtureの画像はmanifestとreview.htmlで明記している。

正式固定10問は別作業のbenchmarkとほぼ全期間重なった。原測定と開始時刻・cwdを`benchmark-01-conditions.md`へ保存し、並列負荷のある環境で閾値を通過した結果として扱う。独占環境の速度認定や、前のDEV失敗原因の確定には使わない。

共有workspaceでも最終のdocs:check・typecheck・diff checkがPASS。今回の対象13ファイル/94テストの統合確認もPASSした。静的比較で成長・土地・記録・予告・岸の画角修正が共有workspaceに残り、差分が並行作業の追加であることを確認した。これらは固定候補の全検証と区別し、`shared-*-final.log`へ保存する。docsの既存棚卸し期限WARNは変更していない。

## 検証中に見つかった問題

最初の候補`4025ba4b044a`は画角テスト2件がFAILした。旧fixtureが描画フラグだけを持ち実状態を持たない点と、明示的な初期土地で外周のミント色の波紋が僅かにはみ出す点を修正した。実際の岸の輪郭・高さ・波紋をカメラ計算とテストで共用し、明示0/1/2と旧互換を同じ厳しい画角条件で検査した。

途中のコピー`49de303fd9bd`は、別作業の新しい住民造形を一部含み、共有活動の画角テスト2件がFAILした。これを採用せず、最初の候補へ上記の岸の修正だけを加えて最終候補を固定した。共有workspaceの住民変更は戻していない。両候補の原ログと入力manifestも保存している。

最終候補のDEV初回`dev-01`はphone-keyboardの正解→入力P95が748.8msで650ms基準を超えた。その時は別の検証も稼働していたが、負荷が原因とは確定していない。app・QA・閾値を変更せず、担当する他の検証を止めた`dev-02`は全10シナリオを通過し、同じphone-keyboardのP95は207.0msだった。原FAILを保持し、原因を修正済みとは扱わない。

任意の旧E2E 6本には、前回から古い手動報酬待ちが残り、今回の成熟ルールとも合わない区間数による土地・キツネの前提がある。現行互換fixtureではないため[検証matrix](../../../ai/verification_matrix.md)で履歴用と明記した。今回の必須フローは更新・実行済みだが、旧ハーネス固有の受渡し・歩行途中の中断を全て再認定したものではない。

## Visual appeal

作者による実画面評価: 予兆、小さい島、完成通知、広がった島、同じ倍率の前後比較がつながることを確認した。前回v4と今回v5の成熟した島も並べ、土地や成長造形の継続を確認した。岸と住民の不自然な見切れはなく、問題・テンキー・確定キーへの通知の重なりはない。

通知が一時的に花の細部を覆う点は改善余地として残る。完成の造形は帰島後と比較で確認できる。作者と別担当の画像評価であり、独立した美術審査や子どもの魅力評価とは扱わない。

## Silent comprehension and safety

human N=0。無説明の理解・自発的な再遊び・学習効果は未測定。作者操作と自動検査では、音なしでも読める具体的な変化、reduced motion、追加の確認操作0、支援による成長減なし、旧土地・記録・配置・学習保存の保持を確認した。美術・人の理解/安全・runtimeを別々の判定として扱う。
