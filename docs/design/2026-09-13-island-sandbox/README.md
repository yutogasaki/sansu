# 砂場と混合遊具のDEV接続

2026-09-13。candidate `life-v3-sandbox-v1`、world `canopy-dots-c3-v1`。DEV `http://127.0.0.1:5223` / `VITE_ISLAND_LIFE_PREVIEW=true`。50件のQA creditから実UIで砂場18とブランコ2個を購入する。通常学習による取得や実参加者の証拠ではない。

前後の利用位置に別々に到着し、1人なら山、2人なら城を作る。砂場はGP2/GP3の成分・地面・巡回に含める。R3のベンチからは砂場の実利用者へ視線を向ける。砂の形は利用中の表現であり、成長・収集・新たな報酬を持たない。保存版9/receipt `life-v3-sandbox-v1`、旧価格/経済/土地/巡回を保持する。

- **視覚:** HOLD。砂場の山・城と作業する住民は通常画面では小さい。C3の光・奥行き・包まれる空間との隔たりを保持する。既存キャラの顔・輪郭・頭身・耳・配色・布・好みは変更しない。
- **無文字理解/安全:** Human N=0。自動検証は子どもの理解・愛着の合格ではない。
- **runtime:** DEV限定の対象確認。全PWA/offline/update/throughput/全smokeと実機上限、残り2施設・R5/R6・魔法/出会いは未完。


初回実画面で混合GP3が記録されず、rendererで再現した。砂場の縁が従来の共有地面/接続点を隠していたため、砂場を含む成分の実地面を1.12幅へ広げ、その露出した外縁をray判定する。地面を非表示にすると拒否する検査は維持。旧砂場なしの地面とsnapshotは変更しない。初回診断 `/tmp/sansu-sandbox-runtime-1`、初回source `b5185de8a5ff9029131a9269598d175ac9fd476d6e6ea2605e0e676ca7addd58` と修正前失敗 `/tmp/sansu-sandbox-ground-before.log` を保持する。

対象テストは18しずくのreceipt・旧風車と土地の保持・欠落/改変/降格拒否・同意図retry・半額返却9、2役と片側1役、分割再生、混合GP3の2役巡回とR3、山/城/離脱時の1人復帰・足元と利用者分離・1マス本体・記録姿勢の固定を確認する。R3の現物タップ入口を追加。既存の文字selectは従来の花/ブランコのみの候補を残しており、施設追加と合わせた全対象の入口整理・実UI切替検証は残件。R3の視線はrenderer検査で、今回の実UIは砂場/混合GP3を対象とする。


最終source `19dbfd0da4766238e97027fa2e39664e6ec44d97a1bf05f563b2ad7c9792a6cd`、撮影元 `4ba1468cbe80c7430725d0905c2bc732e1ea3c3b` 上の差分。source開始/終了一致。実DOM deliveryは[report](report.json)へ記録。[critical-path contact sheet](contact-sheet.png) / [比較HTML](contact-sheet.html)。phone390×844・tablet768×1024（reduced motion）、両幅の実購入→2人の城→片側配置/1人の山→元の場所へ復元→ブランコ2個と混合GP3のlive記録→収納→再読込/学習入力復帰PASS。保存版9、残高70、収納、元イベント本文、学習正本不変、pageerror/console error 0を確認。

修正版verify:core PASS（382 files /3832 tests、docs/lint/typecheck/build/assets）。既存Fast Refresh・期限・chunk警告あり。precache98件/10.82MiB。ログ `/tmp/sansu-sandbox-core2.log` と `/tmp/sansu-sandbox-ui2.log`。共通地面の修正前core1は最終sourceの証拠に含めない。対象runtimeの合格は、視覚・無文字理解や全体releaseの合格を意味しない。
