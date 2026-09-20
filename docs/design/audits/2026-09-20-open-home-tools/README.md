# 島ホームの箱を外す — 2026-09-20

## 変更範囲

`open-home-tools-v1`。島ホームの「つくる・ようす・ながめ」だけを対象に、白い箱・枠・押し出し影を外し、既存の絵の下へ文字を置いた。操作領域は64px高、キーボードfocusを保持。「ながめ」の開状態は文字の下線で示す。海と絵の間に新しいパネルや装飾を増やさない。

|参照から取り入れる|取り入れない|
|---|---|
|暮らしの絵が主役、広い余白、物ごとに違う輪郭|C3内の生成キャラ、固定配置やカメラ|
|操作面が世界を覆わない構成|承認されていない世界表現の自動本番切替|

花・ぽこもこ・望遠鏡の絵そのもの、DOMの操作順・名称・処理、可視canvasの寸法、学習入力・通常連問・保存・歩行・自由配置・PWAロジックは変更していない。画像生成/画像編集は行っていない。学習の正誤/次問タイミング、キー配置は既存契約を維持するCSS変更。

## 検証対象

[build manifest](build-manifest.json)に実version、base revision、全入力hash、固定dist hash、delivery、world candidate、UI candidateを保存。previewは固定したdistを配信し、別の検査用buildが上書きしないよう分離。

既存 `tools/e2e-island-life-world-first.mjs` を実行時コピーで使用。変更前CSSを同じ画面へ一時適用してbeforeを撮影し、取り外してafterとfocusを撮影する箇所だけ追加。fixtureは明示のcredit/家具を使い、実獲得の証拠としない。

## 独立判定

- 視覚: ホームの白い箱を除く局所改善。C3の巨大植物・奥行き・局所陰との隔たりは残り、世界美術全体はHOLD。
- 無文字理解・安全: Human N=0。アイコンと文字・44px以上のhit target・focusの作者検査と、子どもの理解は区別。
- runtime: 結果は以下に記録。CSSだけの変更で、学習throughputの新規認定や全release認定をしない。

mainの別作業で家まわり素材が更新されているため、今回の前後比較は同じmain入力と同じworld candidateを使う。他作業の未commitの家画面/navigation変更は取り込んでいない。

初回の画面検査は、既存ハーネスが現行版18のcutoverを残したまま過去actionを差し替えたため、履歴整合性チェックで島を開けずFAIL。現行データを壊すアプリ不具合とは区別し、初期版1の明示fixtureを作って通常migrationへ通すよう検査側だけを修正。[初回失敗](initial-harness-failure.json)を保持した。[撮影スクリプト](capture.mjs)は同梱のbefore CSSを使う診断用。URLと新しい出力先は `SANSU_WORLD_FIRST_URL` / `SANSU_WORLD_FIRST_OUTPUT` で指定する。

2回目はfixture注入後の獲得・住民通知が続き、静止ホーム撮影前の10秒待機がtimeout。pageerrorは0。表示時間7000msやアプリ動作は変えず、複数通知を待つharnessの上限だけ30秒へ変更した。[2回目の失敗](notification-wait-failure.json)も保持する。通知の実時間性能を合格とする変更ではない。

## Verification boundary

Core docs/lint/typecheck passed. Full tests: 436/439 files passed, 4082 PASS / 3 timeouts. A one-worker rerun of those three files produced 27 PASS / one learning-progression timeout. That test and its non-CSS dependencies are unchanged. Other test processes were running, but load has not been proven to be the sole cause. The full suite is NOT PASS. See [initial core](core.txt) and [focused rerun](focused-recheck.txt).

The separate Life-enabled production build passed. [Asset budget](asset-budget.txt) passed: precache 11.56 MiB / 12 MiB. Core stopped before its build step due to the test failures.

The broad UI harness's third attempt timed out waiting 20 seconds for rendering; the fourth was interrupted during the long fixture journey. Neither is PASS. The final scoped check uses real onboarding and one empty-island owner resized to four viewports, without database/credit/time injection. It checks the three entrances, hit targets, overflow, keyboard Enter, focus return, camera choices, and return to the full learning screen. It does not certify earned acquisition, save-failure recovery, PWA updates, or learning throughput.

## Final scoped UI result

[Four-viewport report](controls-report.json): phone 390x844, tablet 768x1024 (reduced motion), small 320x568 and landscape 844x390 PASS. Actual UI entrances, keyboard Enter, focus return, camera selection, no horizontal overflow and the learning screen were exercised. The sound-label probe did not match the current Japanese label, so this run does not certify an explicit sound-off state. CSS itself adds no audio or motion.

[Contact sheet](contact-sheet.html) uses the rendered `focus` captures and the subsequent build/camera/learning screens. The name `focus` denotes the focused control, not proof that programmatic focus must paint a keyboard ring. Intermediate before/after captures made while replacing style tags were excluded: the temporary baseline retained a new flex-direction declaration, and one immediate after capture had incomplete compositing. They are not claimed as exact baseline screenshots. The static CSS diff and original committed stylesheet define the before state.

[Scoped capture script](controls-check.mjs) is a diagnostic recorder with URL/output arguments as above. No app inputs changed after the frozen production build. Visual verdict remains a local UI improvement / overall C3 HOLD; human silent comprehension remains N=0; runtime is scoped UI PASS with the unrelated learning-progression timeout still unresolved. No full-release or public-site confirmation is claimed.
